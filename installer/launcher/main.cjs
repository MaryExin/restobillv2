const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');

const MAX_PACKAGE_BYTES = 4 * 1024 ** 3;
const INSTALLER_ID = 'com.lenard.restobill.setup';
const FILES = Object.freeze({ win32: 'win32.exe', darwin: 'darwin.pkg' });
const CHANNELS = Object.freeze({ status: 'lightem-setup:status', install: 'lightem-setup:install', save: 'lightem-setup:save', updates: 'lightem-setup:updates' });

function validatePlatform(platform) {
  if (!Object.hasOwn(FILES, platform)) throw new Error('Choose Windows or Mac.');
  return platform;
}

function validIdentity(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.version === 'string' && /^\d{1,9}\.\d{1,9}\.\d{1,9}$/.test(value.version) &&
    typeof value.buildId === 'string' && /^[1-9]\d{0,19}$/.test(value.buildId);
}

function validateSetupRelease(value) {
  if (!validIdentity(value)) throw new Error('Setup release information is invalid.');
  if(value.runtimeKind !== undefined && !['standalone','xampp'].includes(value.runtimeKind))throw new Error('Setup runtime type is invalid.');
  const installers = {};
  for (const platform of Object.keys(FILES)) {
    const item = value.installers?.[platform];
    if (!item || item.file !== FILES[platform] || !/^[a-fA-F0-9]{64}$/.test(item.sha256 || '') ||
        !Number.isSafeInteger(item.size) || item.size <= 0 || item.size > MAX_PACKAGE_BYTES) {
      throw new Error('Setup package information is invalid.');
    }
    const identity = item.version === undefined && item.buildId === undefined ? value : item;
    if (!validIdentity(identity)) throw new Error('Setup installer release identity is invalid.');
    installers[platform] = { file: item.file, sha256: item.sha256.toLowerCase(), size: item.size,
      version: identity.version, buildId: identity.buildId };
    if (item.supportsXamppImport !== undefined && typeof item.supportsXamppImport !== 'boolean') throw new Error('Setup import information is invalid.');
    if (item.supportsXamppImport) {
      if (value.runtimeKind !== 'standalone') throw new Error('Setup import information is invalid.');
      installers[platform].supportsXamppImport = true;
    }
    if (item.importPackage !== undefined) {
      const imported = item.importPackage;
      if (platform !== 'darwin' || !item.supportsXamppImport || !imported || imported.file !== 'darwin-import.pkg' ||
          !/^[a-fA-F0-9]{64}$/.test(imported.sha256 || '') || !Number.isSafeInteger(imported.size) || imported.size <= 0 || imported.size > MAX_PACKAGE_BYTES) {
        throw new Error('Setup import package information is invalid.');
      }
      installers[platform].importPackage = {file: imported.file, sha256: imported.sha256.toLowerCase(), size: imported.size};
    }
    if (platform === 'darwin' && item.supportsXamppImport && !item.importPackage) throw new Error('The Mac import package is missing.');
  }
  if (value.updateUrl) {
    let url;
    try { url = new URL(value.updateUrl); } catch { throw new Error('The online update address is invalid.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('The online update address is invalid.');
  }
  return { version: value.version, buildId: value.buildId, installers, updateUrl: value.updateUrl || '', ...(value.runtimeKind?{runtimeKind:value.runtimeKind}:{}) };
}

async function readBoundedJson(filename, maximum = 65536) {
  const stat = await fsp.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum) throw new Error('Setup information is invalid.');
  const chunks = [];
  let size = 0;
  for await (const chunk of fs.createReadStream(filename)) {
    size += chunk.length;
    if (size > maximum) throw new Error('Setup information is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function markerPath(platform, runtimeKind='xampp') {
  if(runtimeKind==='standalone'){
    if(platform==='win32')return 'C:\\ProgramData\\LightemStandalone\\installation.json';
    if(platform==='darwin')return '/Library/Application Support/LightemStandalone/installation.json';
    return null;
  }
  if (platform === 'win32') return 'C:\\xampp\\htdocs\\.lightem-managed-install.json';
  if (platform === 'darwin') return '/Applications/XAMPP/xamppfiles/htdocs/.lightem-managed-install.json';
  return null;
}

async function readInstalled(platform, filename = markerPath(platform)) {
  if (!filename) return null;
  try {
    const marker = await readBoundedJson(filename, 16384);
    if (marker.installerId === INSTALLER_ID && marker.formatVersion === 1 && validIdentity(marker)) {
      // The renderer receives only release identity, never configuration or credentials.
      return { version: marker.version, buildId: marker.buildId };
    }
  } catch { /* Older installations may predate managed release markers. */ }
  const root = path.dirname(filename);
  const required = ['api/bootstrap.php', 'api/read_transaction_records.php', 'api/config.php', 'src/JWTCodec.php', '.env', 'vendor/autoload.php'];
  const present = await Promise.all(required.map(async (file) => {
    try {
      const stat = await fsp.lstat(path.join(root, file));
      return stat.isFile() && !stat.isSymbolicLink();
    } catch { return false; }
  }));
  // Presence-only legacy detection: credentials and user data are never opened.
  return present.every(Boolean) ? { legacy: true, version: 'Legacy', buildId: 'unrecorded' } : null;
}

async function verifyPackage(filename, item) {
  try {
    const stat = await fsp.lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== item.size) return false;
    const hash = crypto.createHash('sha256');
    let size = 0;
    for await (const chunk of fs.createReadStream(filename)) {
      size += chunk.length;
      if (size > item.size) return false;
      hash.update(chunk);
    }
    return size === item.size && hash.digest('hex') === item.sha256.toLowerCase();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function copyVerifiedPackage(source, destination, item) {
  const stat = await fsp.lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== item.size) throw new Error('The bundled installer failed its integrity check.');
  const partial = `${destination}.${crypto.randomBytes(12).toString('hex')}.partial`;
  const hash = crypto.createHash('sha256');
  let received = 0;
  try {
    await pipeline(fs.createReadStream(source), new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > item.size) return callback(new Error('The bundled installer failed its integrity check.'));
        hash.update(chunk);
        callback(null, chunk);
      },
    }), fs.createWriteStream(partial, { flags: 'wx', mode: 0o600 }));
    if (received !== item.size || hash.digest('hex') !== item.sha256.toLowerCase()) throw new Error('The bundled installer failed its integrity check.');
    await fsp.rename(partial, destination);
    return destination;
  } catch (error) {
    await fsp.rm(partial, { force: true });
    throw error;
  }
}

function supportsDevice(platform, arch) {
  return (platform === 'win32' && arch === 'x64') || (platform === 'darwin' && ['x64', 'arm64'].includes(arch));
}

function configureLauncherIdentity(app, metadata) {
  const name = metadata.runtimeKind === 'standalone' ? 'Lightem Standalone Setup' : 'Lightem Setup';
  app.setName(name);
  if (metadata.runtimeKind === 'standalone') {
    // Electron's single-instance lock is scoped to userData. Separate this
    // before acquiring the lock so another edition cannot take this launch.
    const directory = path.join(app.getPath('appData'), name);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('The standalone setup cache is unavailable.');
    app.setPath('userData', directory);
  }
  return name;
}

// Only the fixed opt-in flag is passed to the verified Windows installer.
// The filename is environment data, never interpolated into PowerShell code.
async function launchWindowsImport(filename, { execute = execFile, environment = process.env } = {}) {
  const systemRoot = environment.SystemRoot || environment.WINDIR;
  if (!systemRoot || !path.win32.isAbsolute(systemRoot) || !path.win32.isAbsolute(filename) || !filename.toLowerCase().endsWith('.exe') || filename.includes('\0')) {
    throw new Error('The Windows installer path is unavailable.');
  }
  const powershell = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = "$ErrorActionPreference = 'Stop'; try { Start-Process -FilePath $env:LIGHTEM_SETUP_PACKAGE -ArgumentList '/COPYXAMPP' -Verb RunAs -ErrorAction Stop | Out-Null; exit 0 } catch { exit 1 }";
  await new Promise((resolve, reject) => execute(powershell,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    {windowsHide: true, maxBuffer: 65536, env: {...environment, LIGHTEM_SETUP_PACKAGE: filename}},
    error => error ? reject(new Error('Windows did not open the XAMPP import installer. Allow the administrator prompt and try again.')) : resolve()));
}

function importRequested(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => key !== 'copyXampp') ||
      (options.copyXampp !== undefined && typeof options.copyXampp !== 'boolean')) throw new Error('The XAMPP import choice is invalid.');
  return options.copyXampp === true;
}

function createLauncherController({ app, dialog, shell, resourcesPath, release,
  platform = process.platform, arch = process.arch, installedReader = readInstalled, createUpdater,
  windowsImportLauncher = launchWindowsImport,
}) {
  const metadata = validateSetupRelease(release);
  // Discover only this edition. XAMPP source checks belong to an explicitly
  // selected import, never to opening the standalone setup screen.
  const installedOnDevice = () => installedReader(platform, markerPath(platform, metadata.runtimeKind));
  let busy = false;
  async function exclusive(action) {
    if (busy) throw new Error('Another setup action is in progress. Please wait.');
    busy = true;
    try { return await action(); } finally { busy = false; }
  }
  async function cachedInstaller(item) {
    const directory = path.join(app.getPath('userData'), 'installers');
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    const directoryStat = await fsp.lstat(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error('The installer cache is unavailable.');
    const filename = path.join(directory, `lightem-${item.sha256}${path.extname(item.file)}`);
    if (!await verifyPackage(filename, item)) {
      await copyVerifiedPackage(path.join(resourcesPath, 'installers', item.file), filename, item);
    }
    return filename;
  }
  return {
    async status() {
      const bundled = metadata.installers[platform] || metadata;
      return { platform, version: bundled.version, buildId: bundled.buildId,
        installed: await installedOnDevice(), canInstall: supportsDevice(platform, arch) };
    },
    install(selected, options = {}) {
      validatePlatform(selected);
      if (selected !== platform || !supportsDevice(platform, arch)) throw new Error('Save this installer and open it on a compatible computer.');
      const copyXampp = importRequested(options);
      const standard = metadata.installers[selected];
      if (copyXampp && !standard.supportsXamppImport) throw new Error('Use the latest standalone setup app to import XAMPP data.');
      return exclusive(async () => {
        // Portable app resources may disappear when the launcher exits. Keep a
        // verified persistent copy until the separate OS installer has finished.
        const item = copyXampp && selected === 'darwin' ? standard.importPackage : standard;
        const filename = await cachedInstaller(item);
        if (!await verifyPackage(filename, item)) throw new Error('The installer changed before it could start.');
        if (copyXampp && selected === 'win32') await windowsImportLauncher(filename);
        else {
          const error = await shell.openPath(filename);
          if (error) throw new Error('The system installer could not open. Try opening setup again.');
        }
        app.quit();
        return { started: true };
      });
    },
    saveInstaller(selected) {
      validatePlatform(selected);
      return exclusive(async () => {
        const item = metadata.installers[selected];
        const extension = path.extname(item.file).slice(1);
        const answer = await dialog.showSaveDialog({
          title: `Save ${selected === 'win32' ? 'Windows' : 'Mac'} installer`,
          defaultPath: path.join(app.getPath('downloads'), `${metadata.runtimeKind === 'standalone' ? 'Lightem-Standalone-Setup' : 'Lightem-Setup'}-${item.version}-${selected === 'win32' ? 'Windows' : 'Mac'}.${extension}`),
          filters: [{ name: 'Lightem system installer', extensions: [extension] }],
          properties: ['showOverwriteConfirmation', 'createDirectory'],
        });
        if (answer.canceled || !answer.filePath) return { saved: false, canceled: true };
        if (path.extname(answer.filePath).toLowerCase() !== `.${extension}`) throw new Error(`Save the installer with a .${extension} extension.`);
        await copyVerifiedPackage(path.join(resourcesPath, 'installers', item.file), answer.filePath, item);
        return { saved: true };
      });
    },
    checkForUpdates() {
      return exclusive(async () => {
        if (!createUpdater || !metadata.updateUrl) throw new Error('Online updates are unavailable in this setup build.');
        if (!supportsDevice(platform, arch)) throw new Error('Online updates are unavailable for this computer.');
        const installed = await installedOnDevice();
        // Compare the online feed with this device, not the USB/setup app's
        // bundled version. Legacy installations have no recorded release ID.
        const identity = installed?.legacy ? { version: '0.0.0', buildId: '1' }
          : validIdentity(installed) ? installed : metadata.installers[platform];
        const directory = path.join(app.getPath('userData'), 'update-check');
        await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
        const directoryStat = await fsp.lstat(directory);
        if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error('The update cache is unavailable.');
        const metadataPath = path.join(directory, 'system-release.json');
        const temporary = `${metadataPath}.${crypto.randomBytes(12).toString('hex')}.partial`;
        try {
          await fsp.writeFile(temporary, JSON.stringify({
            version: identity.version, buildId: identity.buildId,
            platform, arch: platform === 'darwin' ? 'universal' : 'x64', updateUrl: metadata.updateUrl,
            ...(metadata.runtimeKind?{runtimeKind:metadata.runtimeKind}:{}),
          }), { flag: 'wx', mode: 0o600 });
          await fsp.rename(temporary, metadataPath);
        } finally { await fsp.rm(temporary, { force: true }); }
        const updater = createUpdater({ metadataPath, platform, arch });
        try {
          await updater.check({ interactive: true });
          return { checked: true };
        } finally { updater.dispose(); }
      });
    },
  };
}

function trustedSender(event, window, rendererUrl) {
  return Boolean(window && !window.isDestroyed() && event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame && event.senderFrame?.url === rendererUrl);
}

async function boot() {
  const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
  let release;
  let appName;
  try {
    release = validateSetupRelease(await readBoundedJson(path.join(process.resourcesPath, 'setup-release.json')));
    appName = configureLauncherIdentity(app, release);
  } catch {
    await app.whenReady();
    dialog.showErrorBox('Lightem Setup', 'Setup could not load its bundled release files or private cache. Download a complete setup package and try again.');
    app.quit();
    return;
  }
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  let window;
  app.on('second-instance', () => {
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.show(); window.focus();
    }
  });
  await app.whenReady();
  const rendererUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
  try {
    const { registerSystemUpdater } = require('./system-updater.cjs');
    const createUpdater = (options) => {
      const updater = registerSystemUpdater({ app, dialog, shell, BrowserWindow, ...options });
      return { check: updater.check, dispose() {
        updater.dispose();
        app.removeListener('before-quit', updater.dispose);
      } };
    };
    const controller = createLauncherController({ app, dialog, shell, resourcesPath: process.resourcesPath, release, createUpdater });
    const setupSession = session.fromPartition('lightem-setup');
    setupSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    setupSession.setPermissionCheckHandler(() => false);
    setupSession.webRequest.onBeforeRequest((details, callback) => {
      // This UI only needs its bundled HTML, fonts, and icons. Update downloads
      // run in the main process and never grant network access to the renderer.
      callback({ cancel: !details.url.startsWith('file:') && !details.url.startsWith('data:') });
    });
    window = new BrowserWindow({
      title: appName, width: 940, height: 850, minWidth: 700, minHeight: 680,
      backgroundColor: '#f3f7fc', autoHideMenuBar: true, show: false,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
        nodeIntegration: false, sandbox: true, webSecurity: true, session: setupSession },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => { if (url !== rendererUrl) event.preventDefault(); });
    window.webContents.on('will-redirect', (event) => event.preventDefault());
    window.webContents.on('will-attach-webview', (event) => event.preventDefault());
    for (const [channel, action] of [
      [CHANNELS.status, () => controller.status()],
      [CHANNELS.install, (selected, options) => controller.install(selected, options)],
      [CHANNELS.save, (selected) => controller.saveInstaller(selected)],
      [CHANNELS.updates, () => controller.checkForUpdates()],
    ]) {
      ipcMain.handle(channel, async (event, ...args) => {
        if (!trustedSender(event, window, rendererUrl)) throw new Error('Setup request rejected.');
        try { return await action(...args); }
        catch (error) {
          // Filesystem exception strings can contain personal directory names.
          if (error.code) throw new Error('Setup could not access its files. Check available disk space and folder permissions.');
          throw error;
        }
      });
    }
    window.once('ready-to-show', () => window.show());
    await window.loadURL(rendererUrl);
    app.on('window-all-closed', () => app.quit());
  } catch {
    dialog.showErrorBox('Lightem Setup', 'Setup could not load its bundled release files. Download a complete setup package and try again.');
    app.quit();
  }
}

module.exports = { validatePlatform, validateSetupRelease, readBoundedJson, markerPath, readInstalled,
  verifyPackage, copyVerifiedPackage, supportsDevice, configureLauncherIdentity, createLauncherController, trustedSender, launchWindowsImport, importRequested, boot };
if (require.main === module) void boot();
