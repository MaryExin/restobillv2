const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { configureOfflineBuild, standardCaches } = require('../scripts/offline.cjs');

function write(root, relative, value = 'fixture tool') {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value);
  return filename;
}
function fixture(t, platform = 'darwin', arch = 'arm64') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-offline-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const env = {
    ELECTRON_CACHE: path.join(directory, 'electron'), ELECTRON_BUILDER_CACHE: path.join(directory, 'builder'),
    HTTPS_PROXY: 'https://existing-proxy.example', NO_PROXY: 'localhost',
  };
  const input = { platform, arch, electronVersion: '40.9.2', stage: path.join(directory, 'stage'), env, hostPlatform: platform, home: directory };
  return { directory, env, input };
}
function zip(directory, platform, arch) {
  // A bounded ZIP-format fixture; offline preflight checks container framing.
  const bytes = Buffer.alloc(80);
  bytes.writeUInt32LE(0x04034b50, 0);
  bytes.writeUInt32LE(0x06054b50, bytes.length - 22);
  return write(directory, `hashed-cache/electron-v40.9.2-${platform}-${arch}.zip`, bytes);
}
function windowsTools(root, host = 'win32') {
  const nsis = 'nsis/extracted-nsis';
  for (const filename of [host === 'darwin' ? 'mac/makensis' : 'makensis.exe', 'elevate.exe', 'Include/MUI2.nsh']) write(root, `${nsis}/${filename}`);
  for (const filename of ['UAC.dll', 'StdUtils.dll', 'nsProcess.dll']) write(root, `nsis-resources/extracted/plugins/x86-unicode/${filename}`);
  for (const filename of ['rcedit-x64.exe', 'rcedit-ia32.exe']) write(root, `winCodeSign/winCodeSign-2.6.0/${filename}`);
}

test('missing Electron cache fails before changing environment or creating staging files', (t) => {
  const { input, env } = fixture(t);
  const before = { ...env };
  assert.throws(() => configureOfflineBuild(input), /missing electron-v40.9.2-darwin-arm64.zip/);
  assert.deepEqual(env, before);
  assert.equal(fs.existsSync(input.stage), false);
});

test('universal Mac builds require both architecture archives and reuse exact local paths', (t) => {
  const { input, env } = fixture(t, 'darwin', 'universal');
  const arm = zip(env.ELECTRON_CACHE, 'darwin', 'arm64');
  assert.throws(() => configureOfflineBuild(input), /darwin-x64.zip/);
  const intel = zip(env.ELECTRON_CACHE, 'darwin', 'x64');
  const offline = configureOfflineBuild(input);
  assert.equal(offline.electronDist({ arch: 'arm64' }), arm);
  assert.equal(offline.electronDist({ arch: 1 }), intel);
  assert.equal(fs.existsSync(offline.electronDist({ arch: 'ia32' })), false);
  assert.equal(env.HTTPS_PROXY, 'http://127.0.0.1:9');
  assert.equal(env.NO_PROXY, '');
  assert.equal(env.npm_config_offline, 'true');
  assert.equal(fs.existsSync(input.stage), false, 'cache files are read in place, not copied');
  offline.restore();
  offline.restore();
  assert.equal(env.HTTPS_PROXY, 'https://existing-proxy.example');
  assert.equal(env.NO_PROXY, 'localhost');
  assert.equal(env.LIGHTEM_OFFLINE_BUILD, undefined);
});

test('truncated cached downloads are rejected before packaging', (t) => {
  const { input, env } = fixture(t);
  const filename = zip(env.ELECTRON_CACHE, 'darwin', 'arm64');
  fs.truncateSync(filename, 30);
  assert.throws(() => configureOfflineBuild(input), /incomplete or invalid/);
  assert.equal(env.LIGHTEM_OFFLINE_BUILD, undefined);
});

test('Windows packaging preflights NSIS, resources and resource-editing tool caches', (t) => {
  const { input, env } = fixture(t, 'win32', 'x64');
  zip(env.ELECTRON_CACHE, 'win32', 'x64');
  assert.throws(() => configureOfflineBuild(input), /NSIS compiler/);
  windowsTools(env.ELECTRON_BUILDER_CACHE);
  const resource = path.join(env.ELECTRON_BUILDER_CACHE, 'nsis-resources/extracted/plugins/x86-unicode/UAC.dll');
  fs.unlinkSync(resource);
  assert.throws(() => configureOfflineBuild(input), /NSIS resources/);
  fs.writeFileSync(resource, 'fixture');
  const offline = configureOfflineBuild(input);
  assert.equal(env.ELECTRON_BUILDER_NSIS_DIR, path.join(env.ELECTRON_BUILDER_CACHE, 'nsis/extracted-nsis'));
  assert.equal(env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR, path.join(env.ELECTRON_BUILDER_CACHE, 'nsis-resources/extracted'));
  offline.restore();
  assert.equal(env.ELECTRON_BUILDER_NSIS_DIR, undefined);
});

test('Mac-to-Windows offline packaging refuses a missing cached Wine runtime', (t) => {
  const { input, env } = fixture(t, 'win32', 'x64');
  input.hostPlatform = 'darwin';
  zip(env.ELECTRON_CACHE, 'win32', 'x64');
  windowsTools(env.ELECTRON_BUILDER_CACHE, 'darwin');
  assert.throws(() => configureOfflineBuild(input), /Wine 4.0.1/);
  for (const name of ['wine64', 'wineserver']) write(env.ELECTRON_BUILDER_CACHE, `wine/wine-4.0.1-mac/bin/${name}`);
  configureOfflineBuild(input).restore();
});

test('cache discovery honors explicit paths and standard OS cache roots', () => {
  assert.equal(standardCaches({ env: {}, hostPlatform: 'darwin', home: '/fixture' }).electron, '/fixture/Library/Caches/electron');
  assert.equal(standardCaches({ env: { LOCALAPPDATA: '/local' }, hostPlatform: 'win32', home: '/fixture' }).builder, '/local/electron-builder/Cache');
  assert.equal(standardCaches({ env: { XDG_CACHE_HOME: '/xdg' }, hostPlatform: 'linux', home: '/fixture' }).electron, '/xdg/electron');
  assert.equal(standardCaches({ env: { ELECTRON_CACHE: '/explicit' }, hostPlatform: 'darwin', home: '/fixture' }).electron, '/explicit');
});

test('spawned Node build hooks block HTTP, HTTPS and fetch before creating a request', (t) => {
  const { input } = fixture(t);
  const script = `for (const scheme of ['http','https']) { try { require(scheme).get(scheme+'://127.0.0.1:1/'); process.exit(2); } catch(e) { if (!e.message.includes('disabled for this offline build')) throw e; } } try { fetch('http://127.0.0.1:1/'); process.exit(3); } catch(e) { if (!e.message.includes('disabled for this offline build')) throw e; }`;
  const result = spawnSync(process.execPath, ['--require', path.resolve(__dirname, '../scripts/offline.cjs'), '-e', script], {
    env: { ...process.env, LIGHTEM_OFFLINE_BUILD: '1' }, encoding: 'utf8', timeout: 5000, cwd: input.home,
  });
  assert.equal(result.status, 0, result.stderr);
});
