// Resolve the installed electron-builder toolchain locally before offline builds.
// The preflight performs filesystem reads only; missing caches are never fetched.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function isFile(filename) {
  try { return fs.statSync(filename).isFile() && fs.statSync(filename).size > 0; } catch { return false; }
}
function directories(root, maxDepth = 5) {
  const result = [];
  function visit(directory, depth) {
    if (result.length > 12000) throw new Error('Offline cache contains too many directories. Set explicit cache paths.');
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    result.push(directory);
    if (!depth) return;
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(path.join(directory, entry.name), depth - 1);
    }
  }
  visit(root, maxDepth);
  return result;
}
function standardCaches({ env, hostPlatform, home }) {
  const systemRoot = hostPlatform === 'darwin' ? path.join(home, 'Library/Caches')
    : hostPlatform === 'win32' ? (env.LOCALAPPDATA || path.join(home, 'AppData/Local'))
      : (env.XDG_CACHE_HOME || path.join(home, '.cache'));
  return {
    electron: path.resolve(env.ELECTRON_CACHE || path.join(systemRoot, 'electron', ...(hostPlatform === 'win32' ? ['Cache'] : []))),
    builder: path.resolve(env.ELECTRON_BUILDER_CACHE || path.join(systemRoot, 'electron-builder', ...(hostPlatform === 'win32' ? ['Cache'] : []))),
  };
}
function missing(item) {
  throw new Error(`Offline build cache is missing ${item}. Complete an online build for this target first, or provide populated ELECTRON_CACHE and ELECTRON_BUILDER_CACHE paths.`);
}
function checkZip(filename) {
  const handle = fs.openSync(filename, 'r');
  try {
    const size = fs.fstatSync(handle).size;
    const header = Buffer.alloc(4);
    fs.readSync(handle, header, 0, 4, 0);
    const tail = Buffer.alloc(Math.min(size, 65557));
    fs.readSync(handle, tail, 0, tail.length, size - tail.length);
    if (size < 64 || header.readUInt32LE(0) !== 0x04034b50 || tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) < 0) {
      throw new Error(`Offline Electron archive is incomplete or invalid: ${path.basename(filename)}. Restore a complete cache from an online build.`);
    }
  } finally { fs.closeSync(handle); }
}

function blockNodeDownloads() {
  const originals = [];
  const blocked = () => { throw new Error('Network downloads are disabled for this offline build. Populate the build caches while online.'); };
  for (const protocol of ['node:http', 'node:https']) {
    const api = require(protocol);
    for (const method of ['get', 'request']) {
      originals.push([api, method, api[method]]);
      api[method] = blocked;
    }
  }
  if (typeof globalThis.fetch === 'function') {
    originals.push([globalThis, 'fetch', globalThis.fetch]);
    globalThis.fetch = blocked;
  }
  return () => { for (const [object, key, value] of originals) object[key] = value; };
}

function configureOfflineBuild({ platform, arch, electronVersion, stage,
  env = process.env, hostPlatform = process.platform, home = os.homedir(),
}) {
  if (!['win32', 'darwin'].includes(platform) || !['x64', 'arm64', 'universal'].includes(arch) ||
      (platform === 'win32' && arch !== 'x64') || !/^\d+\.\d+\.\d+$/.test(electronVersion || '') || !stage) {
    throw new Error('Offline build requires a supported target, exact Electron version, and staging directory.');
  }
  if (platform === 'darwin' && hostPlatform !== 'darwin') throw new Error('Build the Mac installer on macOS.');
  const caches = standardCaches({ env, hostPlatform, home });
  const electronDirectories = directories(caches.electron, 4);
  const targets = arch === 'universal' ? ['x64', 'arm64'] : [arch];
  const archives = {};
  for (const target of targets) {
    const filename = `electron-v${electronVersion}-${platform}-${target}.zip`;
    const found = electronDirectories.map(directory => path.join(directory, filename)).find(isFile);
    if (!found) missing(filename);
    checkZip(found);
    archives[target] = found;
  }
  const updates = { ELECTRON_CACHE: caches.electron, ELECTRON_BUILDER_CACHE: caches.builder };
  if (platform === 'win32') {
    const toolDirectories = directories(caches.builder, 5);
    function findTool(label, override, required) {
      const candidates = override ? [path.resolve(override)] : toolDirectories;
      const found = candidates.find(directory => required.every(file => isFile(path.join(directory, file))));
      if (!found) missing(label);
      return found;
    }
    const nsisExecutable = hostPlatform === 'darwin' ? 'mac/makensis' : hostPlatform === 'win32' ? 'makensis.exe' : 'linux/makensis';
    caches.nsis = findTool('extracted NSIS compiler', env.ELECTRON_BUILDER_NSIS_DIR, [nsisExecutable, 'elevate.exe', 'Include/MUI2.nsh']);
    caches.nsisResources = findTool('extracted NSIS resources', env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR, ['plugins/x86-unicode/UAC.dll', 'plugins/x86-unicode/StdUtils.dll', 'plugins/x86-unicode/nsProcess.dll']);
    // app-builder's resource editing uses the legacy winCodeSign cache even
    // when an unsigned installer is requested.
    caches.winCodeSign = findTool('winCodeSign 2.6.0/rcedit tool bundle', path.join(caches.builder, 'winCodeSign/winCodeSign-2.6.0'), ['rcedit-x64.exe', 'rcedit-ia32.exe']);
    if (hostPlatform === 'darwin') {
      caches.wine = findTool('Mac Wine 4.0.1 runtime for Windows packaging', path.join(caches.builder, 'wine/wine-4.0.1-mac'), ['bin/wine64', 'bin/wineserver']);
    } else if (hostPlatform !== 'win32') {
      throw new Error('Offline Windows packaging is supported on Windows or macOS with cached Wine. Build on Windows or complete the Linux toolchain separately.');
    }
    updates.ELECTRON_BUILDER_NSIS_DIR = caches.nsis;
    updates.ELECTRON_BUILDER_NSIS_RESOURCES_DIR = caches.nsisResources;
  }
  // Child native downloaders honor these proxies. All known required assets
  // were resolved above, so a new dependency fails locally instead of fetching.
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) updates[name] = 'http://127.0.0.1:9';
  updates.NO_PROXY = '';
  updates.no_proxy = '';
  updates.npm_config_offline = 'true';
  updates.npm_config_audit = 'false';
  updates.npm_config_fund = 'false';
  updates.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  updates.LIGHTEM_OFFLINE_BUILD = '1';
  // Also block HTTP(S) in spawned Node processes, including build hooks.
  updates.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require ${JSON.stringify(__filename)}`.trim();
  const previous = Object.fromEntries(Object.keys(updates).map(key => [key, env[key]]));
  Object.assign(env, updates);
  const restoreDownloads = env === process.env ? blockNodeDownloads() : () => {};
  let restored = false;
  return {
    caches: { ...caches, archives },
    electronDist(options) {
      const requestedArch = typeof options.arch === 'number' ? ({ 1: 'x64', 3: 'arm64' })[options.arch] : options.arch;
      // electron-builder catches callback throws and falls back to downloading.
      // Return a missing path for an unexpected request; file validation then
      // fails outside its download fallback instead.
      return archives[requestedArch] || path.resolve(stage, 'offline-electron-target-not-prepared.zip');
    },
    restore() {
      if (restored) return;
      restored = true;
      restoreDownloads();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete env[key]; else env[key] = value;
      }
    },
  };
}

// NODE_OPTIONS preload for child build processes; never runs on an installed POS.
if (process.env.LIGHTEM_OFFLINE_BUILD === '1') blockNodeDownloads();
module.exports = { configureOfflineBuild, standardCaches, blockNodeDownloads };
