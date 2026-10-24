const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateSetupRelease, readInstalled, markerPath, copyVerifiedPackage, verifyPackage,
  createLauncherController, configureLauncherIdentity, supportsDevice, trustedSender } = require('../launcher/main.cjs');

const bytes = Buffer.from('test installer bytes');
const importBytes = Buffer.from('separate Mac XAMPP import installer');
const item = (file) => ({ file, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
const release = () => ({ version: '1.2.3', buildId: '20260926010000',
  installers: { win32: item('win32.exe'), darwin: item('darwin.pkg') },
  updateUrl: 'https://github.com/MaryExin/restobillv2/releases/latest/download/latest.json' });
const importRelease = () => {
  const metadata = {...release(), runtimeKind: 'standalone'};
  metadata.installers.win32.supportsXamppImport = true;
  metadata.installers.darwin.supportsXamppImport = true;
  metadata.installers.darwin.importPackage = {file: 'darwin-import.pkg', size: importBytes.length,
    sha256: crypto.createHash('sha256').update(importBytes).digest('hex')};
  return metadata;
};

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lightem-launcher-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'installers'));
  await Promise.all(['win32.exe', 'darwin.pkg'].map(file => fs.writeFile(path.join(root, 'installers', file), bytes)));
  await fs.writeFile(path.join(root, 'installers/darwin-import.pkg'), importBytes);
  const calls = { opened: [], imports: [], quit: 0, checked: [], saved: [], updateMetadata: [], disposed: 0 };
  const controller = createLauncherController({
    app: { getPath: (name) => name === 'userData' ? path.join(root, 'userdata') : root, quit: () => { calls.quit++; } },
    shell: { openPath: async (filename) => { calls.opened.push(filename); return options.launchError || ''; } },
    windowsImportLauncher: async filename => {
      calls.imports.push(filename);
      if (options.importError) throw new Error(options.importError);
    },
    dialog: { showSaveDialog: async (value) => {
      calls.saved.push(value);
      return options.save || { filePath: path.join(root, 'saved.pkg'), canceled: false };
    } },
    installedReader: async () => ({ version: '1.2.2', buildId: '20260925010000' }),
    createUpdater: (parameters) => ({
      check: async (value) => {
        calls.checked.push(value);
        calls.updateMetadata.push(JSON.parse(await fs.readFile(parameters.metadataPath, 'utf8')));
        if (options.check) await options.check();
      },
      dispose: () => { calls.disposed++; },
    }),
    resourcesPath: root, release: release(), platform: 'win32', arch: 'x64', ...options.controller,
  });
  return { root, controller, calls };
}

test('setup metadata requires both fixed platform packages with bounded sizes and valid identities', () => {
  assert.equal(validateSetupRelease(release()).installers.win32.file, 'win32.exe');
  for (const invalid of ['../other.exe', '/tmp/other.exe', 'darwin.pkg']) {
    const metadata = release(); metadata.installers.win32.file = invalid;
    assert.throws(() => validateSetupRelease(metadata), /package information/);
  }
  for (const size of [0, -1, 1.5, '20', 4 * 1024 ** 3 + 1]) {
    const metadata = release(); metadata.installers.darwin.size = size;
    assert.throws(() => validateSetupRelease(metadata));
  }
  for (const override of [{ version: 'latest' }, { buildId: '../bad' }, { buildId: 12 },
    { installers: {} }, { updateUrl: 'http://example.test/latest.json' }, { updateUrl: 'https://user:secret@example.test/latest.json' }]) {
    assert.throws(() => validateSetupRelease({ ...release(), ...override }));
  }
});

test('platform package identities preserve older Mac installers in a newer setup bundle', () => {
  const mixed = release();
  mixed.installers.win32 = {...mixed.installers.win32, version: mixed.version, buildId: mixed.buildId};
  mixed.installers.darwin = {...mixed.installers.darwin, version: mixed.version, buildId: '20260925010000'};
  assert.equal(validateSetupRelease(mixed).installers.darwin.buildId, '20260925010000');
  assert.equal(validateSetupRelease(release()).installers.darwin.buildId, release().buildId, 'old setup metadata stays compatible');
  for (const identity of [{version:'1.2.3'}, {buildId:'2'}, {version:'1.2.3',buildId:'../wrong'}]) {
    const invalid=release(); invalid.installers.darwin={...invalid.installers.darwin,...identity};
    assert.throws(() => validateSetupRelease(invalid), /identity/);
  }
});

test('a shared Mac setup launches its preserved Mac package and exports the corrected Windows package', async (t) => {
  const windows = Buffer.from('corrected Windows installer');
  const mac = Buffer.from('unchanged working Mac installer');
  const mixed = {...release(), runtimeKind:'standalone'};
  for (const [platform, content, buildId] of [['win32',windows,mixed.buildId],['darwin',mac,'20260925010000']]) {
    mixed.installers[platform] = {...mixed.installers[platform], version:mixed.version, buildId,
      size:content.length, sha256:crypto.createHash('sha256').update(content).digest('hex')};
  }
  const {root,controller,calls}=await fixture(t,{save:{canceled:true},controller:{release:mixed,platform:'darwin',arch:'arm64',installedReader:async()=>null}});
  await fs.writeFile(path.join(root,'installers/win32.exe'),windows);
  await fs.writeFile(path.join(root,'installers/darwin.pkg'),mac);
  const status=await controller.status();
  assert.equal(status.buildId,mixed.installers.darwin.buildId);
  await controller.checkForUpdates();
  assert.equal(calls.updateMetadata[0].buildId,mixed.installers.darwin.buildId,'fresh Mac update checks use the Mac package, not the Windows bundle ID');
  await controller.install('darwin');
  assert.deepEqual(await fs.readFile(calls.opened[0]),mac);
  const saved=path.join(root,'corrected-windows.exe');
  const other=await fixture(t,{save:{canceled:false,filePath:saved},controller:{release:mixed,platform:'darwin',arch:'arm64'}});
  await fs.writeFile(path.join(other.root,'installers/win32.exe'),windows);
  await other.controller.saveInstaller('win32');
  assert.deepEqual(await fs.readFile(saved),windows);
  assert.equal(other.calls.opened.length,0);
});

test('installation detection reads only a bounded managed marker and returns only release identity', async (t) => {
  const { root } = await fixture(t);
  const filename = path.join(root, 'marker.json');
  const marker = { installerId: 'com.lenard.restobill.setup', formatVersion: 1,
    version: '1.2.3', buildId: '20260926010000', privateField: 'do-not-return' };
  await fs.writeFile(filename, JSON.stringify(marker));
  assert.deepEqual(await readInstalled('win32', filename), { version: marker.version, buildId: marker.buildId });
  for (const value of [{ ...marker, installerId: 'other-product' }, { ...marker, buildId: 'invalid' }, { ...marker, formatVersion: 2 }]) {
    await fs.writeFile(filename, JSON.stringify(value));
    assert.equal(await readInstalled('win32', filename), null);
  }
  await fs.writeFile(filename, ' '.repeat(16385));
  assert.equal(await readInstalled('win32', filename), null);
  await fs.unlink(filename);
  assert.equal(await readInstalled('win32', filename), null);
  await fs.symlink(path.join(root, 'installers/win32.exe'), filename);
  assert.equal(await readInstalled('win32', filename), null);
  assert.equal(markerPath('win32'), 'C:\\xampp\\htdocs\\.lightem-managed-install.json');
  assert.equal(markerPath('darwin'), '/Applications/XAMPP/xamppfiles/htdocs/.lightem-managed-install.json');
});

test('copy rejects corruption and symlinks without replacing an existing destination or leaving partials', async (t) => {
  const { root } = await fixture(t);
  const source = path.join(root, 'installers/win32.exe');
  const destination = path.join(root, 'destination.exe');
  await fs.writeFile(destination, 'existing');
  await fs.writeFile(source, Buffer.alloc(bytes.length, 0));
  await assert.rejects(copyVerifiedPackage(source, destination, item('win32.exe')), /integrity/);
  assert.equal(await fs.readFile(destination, 'utf8'), 'existing');
  assert.equal((await fs.readdir(root)).some(name => name.endsWith('.partial')), false);
  await fs.unlink(source);
  await fs.symlink(path.join(root, 'installers/darwin.pkg'), source);
  await assert.rejects(copyVerifiedPackage(source, destination, item('win32.exe')), /integrity/);
  assert.equal(await verifyPackage(source, item('win32.exe')), false);
});

test('legacy detection reports unrecorded installations from file presence without exposing configuration', async (t) => {
  const { root } = await fixture(t);
  for (const file of ['api/bootstrap.php', 'api/read_transaction_records.php', 'api/config.php', 'src/JWTCodec.php', '.env', 'vendor/autoload.php']) {
    const filename = path.join(root, file);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, 'PRIVATE_CONFIGURATION=do-not-return');
  }
  const marker = path.join(root, '.lightem-managed-install.json');
  assert.deepEqual(await readInstalled('darwin', marker), { legacy: true, version: 'Legacy', buildId: 'unrecorded' });
  await fs.unlink(path.join(root, 'vendor/autoload.php'));
  assert.equal(await readInstalled('darwin', marker), null, 'unrelated or incomplete servers are not claimed as installations');
});

test('matching OS installer launches a persistent verified copy and only then quits', async (t) => {
  const { root, controller, calls } = await fixture(t);
  assert.deepEqual(await controller.status(), { platform: 'win32', version: '1.2.3', buildId: '20260926010000',
    installed: { version: '1.2.2', buildId: '20260925010000' }, canInstall: true });
  assert.deepEqual(await controller.install('win32'), { started: true });
  assert.equal(calls.quit, 1);
  assert.equal(calls.opened.length, 1);
  assert.equal(path.dirname(calls.opened[0]), path.join(root, 'userdata/installers'));
  assert.equal(await verifyPackage(calls.opened[0], item('win32.exe')), true);
  await fs.rm(path.join(root, 'installers'), { recursive: true });
  assert.equal(await verifyPackage(calls.opened[0], item('win32.exe')), true, 'installer survives portable resource cleanup');
});

test('a corrupted cache is replaced and OS launch failure never quits the launcher', async (t) => {
  const { root, controller, calls } = await fixture(t, { launchError: 'cannot open' });
  const cached = path.join(root, 'userdata/installers', `lightem-${item('win32.exe').sha256}.exe`);
  await fs.mkdir(path.dirname(cached), { recursive: true });
  await fs.writeFile(cached, 'corrupted');
  await assert.rejects(controller.install('win32'), /could not open/);
  assert.equal(await verifyPackage(cached, item('win32.exe')), true);
  assert.equal(calls.quit, 0);
});

test('foreign platform can be saved but is never executed', async (t) => {
  const { root, controller, calls } = await fixture(t);
  assert.throws(() => controller.install('darwin'), /compatible computer/);
  assert.throws(() => controller.install('linux'), /Choose Windows or Mac/);
  assert.equal(calls.opened.length, 0);
  assert.deepEqual(await controller.saveInstaller('darwin'), { saved: true });
  assert.equal(await verifyPackage(path.join(root, 'saved.pkg'), item('darwin.pkg')), true);
  assert.equal(calls.quit, 0);
  assert.equal(calls.opened.length, 0);
});

test('canceled save does not copy anything or launch an installer', async (t) => {
  const { controller, calls } = await fixture(t, { save: { canceled: true } });
  assert.deepEqual(await controller.saveInstaller('win32'), { saved: false, canceled: true });
  assert.equal(calls.opened.length, 0);
});

test('update checks use native updater and exclude concurrent install actions', async (t) => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { controller, calls } = await fixture(t, { check: () => pending });
  const check = controller.checkForUpdates();
  await assert.rejects(controller.install('win32'), /in progress/);
  finish();
  assert.deepEqual(await check, { checked: true });
  assert.deepEqual(calls.checked, [{ interactive: true }]);
  assert.equal(calls.disposed, 1);
  assert.equal(calls.opened.length, 0);
});

test('online check compares the actual installed version and always uses the bundled trusted update address', async (t) => {
  const installed = { version: '5.0.1', buildId: '20270926010000', updateUrl: 'https://untrusted.example.test/latest.json' };
  const { controller, calls } = await fixture(t, { controller: { installedReader: async () => installed } });
  await controller.checkForUpdates();
  assert.deepEqual(calls.updateMetadata[0], {
    version: installed.version, buildId: installed.buildId, platform: 'win32', arch: 'x64', updateUrl: release().updateUrl,
  });
  installed.version = '5.0.2'; installed.buildId = '20270927010000';
  await controller.checkForUpdates();
  assert.equal(calls.updateMetadata[1].buildId, installed.buildId, 'refreshes the device marker on every check');
});

test('standalone setup reads its public descriptor and preserves its channel during online checks', async (t) => {
  const standalone = {...release(),runtimeKind:'standalone',updateUrl:release().updateUrl.replace('latest.json','latest-standalone.json')};
  let inspected;
  const {controller,calls} = await fixture(t,{controller:{release:standalone,installedReader:async (platform,file) => {
    inspected=file;
    return {version:'1.2.2',buildId:'20260925010000'};
  }}});
  await controller.checkForUpdates();
  assert.match(inspected, /LightemStandalone[\\/]installation\.json$/);
  assert.equal(calls.updateMetadata[0].runtimeKind,'standalone');
  assert.equal(calls.updateMetadata[0].updateUrl,standalone.updateUrl);
  assert.equal(markerPath('darwin','standalone'),'/Library/Application Support/LightemStandalone/installation.json');
  assert.throws(() => validateSetupRelease({...standalone,runtimeKind:'unknown'}));
});

test('standalone launcher separates its instance lock and cache from the legacy setup app', async (t) => {
  const {root} = await fixture(t);
  const calls = [];
  const app = {setName: name => calls.push(['name',name]),getPath: () => root,setPath: (key,value) => calls.push([key,value])};
  assert.equal(configureLauncherIdentity(app,{runtimeKind:'standalone'}),'Lightem Standalone Setup');
  const standaloneCache = path.join(root,'Lightem Standalone Setup');
  assert.deepEqual(calls,[['name','Lightem Standalone Setup'],['userData',standaloneCache]]);
  assert.equal((await fs.stat(standaloneCache)).isDirectory(),true);
  calls.length=0;
  assert.equal(configureLauncherIdentity(app,{}),'Lightem Setup');
  assert.deepEqual(calls,[['name','Lightem Setup']],'the legacy cache location remains unchanged');
  await fs.rm(standaloneCache,{recursive:true});
  await fs.symlink(path.join(root,'installers'),standaloneCache);
  assert.throws(() => configureLauncherIdentity(app,{runtimeKind:'standalone'}),/cache is unavailable/);
});

test('Mac standalone status and updates never inspect XAMPP before explicit import', async (t) => {
  const inspected=[];
  const standalone={...release(),runtimeKind:'standalone'};
  const {controller,calls}=await fixture(t,{controller:{platform:'darwin',arch:'arm64',release:standalone,installedReader:async (_platform,file)=>{
    inspected.push(file);
    return file===markerPath('darwin','xampp') ? {version:'9.9.9',buildId:'20270926010000'} : null;
  }}});
  assert.equal((await controller.status()).installed,null);
  await controller.checkForUpdates();
  assert.deepEqual(inspected,[markerPath('darwin','standalone'),markerPath('darwin','standalone')]);
  assert.equal(calls.updateMetadata[0].version,standalone.version);
  assert.equal(calls.updateMetadata[0].buildId,standalone.buildId);
  assert.equal(calls.updateMetadata[0].runtimeKind,'standalone');
});

test('import metadata allows only a supported standalone release and a pinned Mac package', () => {
  const valid = validateSetupRelease(importRelease());
  assert.equal(valid.installers.win32.supportsXamppImport, true);
  assert.equal(valid.installers.darwin.importPackage.file, 'darwin-import.pkg');
  for (const flag of ['true', 1, null, {}]) {
    const invalid = importRelease(); invalid.installers.win32.supportsXamppImport = flag;
    assert.throws(() => validateSetupRelease(invalid), /import information/);
  }
  for (const mutate of [
    metadata => { delete metadata.runtimeKind; },
    metadata => { metadata.runtimeKind = 'xampp'; },
    metadata => { delete metadata.installers.darwin.importPackage; },
    metadata => { metadata.installers.darwin.supportsXamppImport = false; },
    metadata => { metadata.installers.win32.importPackage = metadata.installers.darwin.importPackage; },
  ]) {
    const invalid = importRelease(); mutate(invalid);
    assert.throws(() => validateSetupRelease(invalid), /import/i);
  }
  for (const override of [{file: '../darwin-import.pkg'}, {file: 'darwin.pkg'}, {file: '/tmp/darwin-import.pkg'},
    {size: 0}, {size: '10'}, {size: 4 * 1024 ** 3 + 1}, {sha256: 'invalid'}]) {
    const invalid = importRelease(); Object.assign(invalid.installers.darwin.importPackage, override);
    assert.throws(() => validateSetupRelease(invalid), /import package/);
  }
});

test('Windows import is explicit and launches only the verified cached installer with the fixed import helper', async t => {
  const metadata = importRelease();
  const ordinary = await fixture(t, {controller: {release: metadata}});
  await ordinary.controller.install('win32', {copyXampp: false});
  assert.equal(ordinary.calls.opened.length, 1);
  assert.equal(ordinary.calls.imports.length, 0);
  const imported = await fixture(t, {controller: {release: metadata}});
  await imported.controller.install('win32', {copyXampp: true});
  assert.equal(imported.calls.opened.length, 0);
  assert.equal(imported.calls.imports.length, 1);
  assert.equal(imported.calls.quit, 1);
  assert.equal(path.dirname(imported.calls.imports[0]), path.join(imported.root, 'userdata/installers'));
  assert.equal(await verifyPackage(imported.calls.imports[0], metadata.installers.win32), true);
  await fs.rm(path.join(imported.root, 'installers'), {recursive: true});
  assert.equal(await verifyPackage(imported.calls.imports[0], metadata.installers.win32), true);
});

test('declined Windows elevation keeps setup open and releases its busy state for a normal retry', async t => {
  const {controller, calls} = await fixture(t, {importError: 'Administrator prompt canceled', controller: {release: importRelease()}});
  await assert.rejects(controller.install('win32', {copyXampp: true}), /prompt canceled/);
  assert.equal(calls.quit, 0);
  assert.equal(calls.opened.length, 0);
  assert.equal(calls.imports.length, 1);
  await controller.install('win32', {copyXampp: false});
  assert.equal(calls.quit, 1);
  assert.equal(calls.opened.length, 1);
});

test('Mac unchecked setup uses the default package and explicit import uses its separately verified package', async t => {
  const metadata = importRelease();
  const ordinary = await fixture(t, {controller: {release: metadata, platform: 'darwin', arch: 'arm64'}});
  await ordinary.controller.install('darwin', {copyXampp: false});
  assert.deepEqual(await fs.readFile(ordinary.calls.opened[0]), bytes);
  const imported = await fixture(t, {controller: {release: metadata, platform: 'darwin', arch: 'arm64'}});
  await imported.controller.install('darwin', {copyXampp: true});
  assert.deepEqual(await fs.readFile(imported.calls.opened[0]), importBytes);
  assert.equal(await verifyPackage(imported.calls.opened[0], metadata.installers.darwin.importPackage), true);
  assert.equal(imported.calls.imports.length, 0, 'Windows launch helper never executes on Mac');
  assert.equal(imported.calls.quit, 1);
  const saved = path.join(ordinary.root, 'exported-default.pkg');
  const exporter = await fixture(t, {save: {filePath: saved}, controller: {release: metadata}});
  await exporter.controller.saveInstaller('darwin');
  assert.deepEqual(await fs.readFile(saved), bytes, 'saving for another computer never opts into its XAMPP import');
});

test('missing, corrupt, and linked Mac import packages cannot launch or silently fall back to default', async t => {
  for (const problem of ['missing', 'corrupt', 'symlink']) {
    const {root, controller, calls} = await fixture(t, {controller: {release: importRelease(), platform: 'darwin', arch: 'arm64'}});
    const variant = path.join(root, 'installers/darwin-import.pkg');
    if (problem === 'corrupt') await fs.writeFile(variant, Buffer.alloc(importBytes.length, 120));
    else {
      await fs.unlink(variant);
      if (problem === 'symlink') await fs.symlink(path.join(root, 'installers/darwin.pkg'), variant);
    }
    await assert.rejects(controller.install('darwin', {copyXampp: true}), /integrity|ENOENT/);
    assert.equal(calls.opened.length, 0, problem);
    assert.equal(calls.imports.length, 0, problem);
    assert.equal(calls.quit, 0, problem);
    await controller.install('darwin', {copyXampp: false});
    assert.deepEqual(await fs.readFile(calls.opened[0]), bytes, 'default package still works independently');
  }
});

test('foreign-platform, unsupported-build, and malformed import requests never start an installer', async t => {
  const supported = await fixture(t, {controller: {release: importRelease()}});
  assert.throws(() => supported.controller.install('darwin', {copyXampp: true}), /compatible computer/);
  for (const options of [null, true, [], {copyXampp: 'true'}, {copyXampp: 1}, {copyXampp: null}, {copyXampp: true, arguments: '/S'}]) {
    assert.throws(() => supported.controller.install('win32', options), /choice is invalid/);
  }
  for (const runtimeKind of [undefined, 'xampp', 'standalone']) {
    const metadata = release(); if (runtimeKind) metadata.runtimeKind = runtimeKind;
    const unsupported = await fixture(t, {controller: {release: metadata}});
    assert.throws(() => unsupported.controller.install('win32', {copyXampp: true}), /latest standalone/);
    assert.equal(unsupported.calls.imports.length + unsupported.calls.opened.length + unsupported.calls.quit, 0);
  }
  assert.equal(supported.calls.imports.length + supported.calls.opened.length + supported.calls.quit, 0);
});

test('Windows standalone never inspects or migrates XAMPP when choosing installation or update identity', async (t) => {
  const inspected=[];
  const standalone={...release(),runtimeKind:'standalone'};
  const {controller,calls}=await fixture(t,{controller:{release:standalone,installedReader:async (_platform,file)=>{
    inspected.push(file);
    if(file===markerPath('win32','xampp'))throw new Error('XAMPP must remain independent');
    return null;
  }}});
  assert.equal((await controller.status()).installed,null);
  await controller.checkForUpdates();
  assert.deepEqual(inspected,[markerPath('win32','standalone'),markerPath('win32','standalone')]);
  assert.equal(calls.updateMetadata[0].version,standalone.version);
  assert.equal(calls.updateMetadata[0].buildId,standalone.buildId);
  assert.equal(calls.updateMetadata[0].runtimeKind,'standalone');
});

test('standalone exported installers retain a distinct filename', async (t) => {
  const {controller,calls}=await fixture(t,{save:{canceled:true},controller:{release:{...release(),runtimeKind:'standalone'}}});
  await controller.saveInstaller('darwin');
  assert.equal(path.basename(calls.saved[0].defaultPath),'Lightem-Standalone-Setup-1.2.3-Mac.pkg');
});

test('online check offers current releases to legacy devices and uses bundled identity for fresh devices', async (t) => {
  const legacy = await fixture(t, { controller: { installedReader: async () => ({ legacy: true, version: 'Legacy', buildId: 'unrecorded' }) } });
  await legacy.controller.checkForUpdates();
  assert.equal(legacy.calls.updateMetadata[0].version, '0.0.0');
  assert.equal(legacy.calls.updateMetadata[0].buildId, '1');
  const fresh = await fixture(t, { controller: { platform: 'darwin', arch: 'arm64', installedReader: async () => null } });
  await fresh.controller.checkForUpdates();
  assert.deepEqual(fresh.calls.updateMetadata[0], {
    version: release().version, buildId: release().buildId, platform: 'darwin', arch: 'universal', updateUrl: release().updateUrl,
  });
});

test('failed online checks dispose native updater timers and permit retry', async (t) => {
  const { controller, calls } = await fixture(t, { check: () => { throw new Error('offline'); } });
  await assert.rejects(controller.checkForUpdates(), /offline/);
  assert.equal(calls.disposed, 1);
  await assert.rejects(controller.checkForUpdates(), /offline/);
  assert.equal(calls.disposed, 2);
});

test('IPC accepts only the exact trusted window main frame and local renderer URL', () => {
  const url = 'file:///setup/index.html';
  const frame = { url };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents };
  assert.equal(trustedSender({ sender: contents, senderFrame: frame }, window, url), true);
  assert.equal(trustedSender({ sender: {}, senderFrame: frame }, window, url), false);
  assert.equal(trustedSender({ sender: contents, senderFrame: { url } }, window, url), false);
  assert.equal(trustedSender({ sender: contents, senderFrame: frame }, window, url + '?injected'), false);
  assert.equal(trustedSender({ sender: contents, senderFrame: frame }, { ...window, isDestroyed: () => true }, url), false);
  assert.equal(supportsDevice('win32', 'arm64'), false);
  assert.equal(supportsDevice('darwin', 'arm64'), true);
});
