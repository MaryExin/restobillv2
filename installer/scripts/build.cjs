#!/usr/bin/env node
// Builds a self-contained installer. Only the build computer needs Node/npm.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { validateLocalRelease } = require('../../electron/system-updater.cjs');

const ROOT = path.resolve(__dirname, '../..');
const XAMPP = require('../xampp.json');
const pkg = require('../../package.json');
const FEED = 'https://github.com/MaryExin/restobillv2/releases/latest/download/latest.json';
const STANDALONE_FEED = 'https://github.com/MaryExin/restobillv2/releases/latest/download/latest-standalone.json';
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: ROOT, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(file)} failed (${result.status}).`);
}
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, dereference: false, filter: p => {
    const name=path.basename(p);
    return !['.DS_Store','.git','config.php'].includes(name) && !/^\.env(?:\.|$)/.test(name) && !/^(?:debug.*|.*\.log|config\.php\..*)$/i.test(name);
  }});
}
function json(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function treeHash(directory) {
  const hash = crypto.createHash('sha256');
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in backend payload: ${file}`);
      if (entry.isDirectory()) walk(file);
      else { hash.update(path.relative(directory, file).split(path.sep).join('/') + '\0'); hash.update(sha256(file)); }
    }
  }
  walk(directory); return hash.digest('hex');
}
function options(args) {
  const opts = { platform: process.platform, arch: process.platform === 'darwin' ? 'universal' : 'x64', buildId: new Date().toISOString().replace(/\D/g,'').slice(0,14), version: pkg.version, updateUrl: FEED };
  for (let i=0; i<args.length; i++) {
    if (['--offline','--prepare-only','--standalone'].includes(args[i])) opts[args[i].slice(2)] = true;
    else if (['--platform','--arch','--vendor','--build-id','--version','--update-url'].includes(args[i]) && args[i+1] && !args[i+1].startsWith('--')) {
      const key = {'build-id':'buildId','update-url':'updateUrl'}[args[i].slice(2)] || args[i].slice(2);
      opts[key] = args[++i];
    } else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
  }
  if (!['win32','darwin'].includes(opts.platform)) throw new Error('Use --platform win32 or darwin.');
  if (opts.platform === 'win32') opts.arch = 'x64';
  if (!['x64','arm64','universal'].includes(opts.arch)) throw new Error('Unsupported architecture.');
  if (opts.standalone && !args.includes('--update-url')) opts.updateUrl = STANDALONE_FEED;
  validateLocalRelease(opts,opts.platform,opts.arch === 'universal' ? 'arm64' : opts.arch);
  return opts;
}
async function prepare(opts) {
  const stage = path.join(ROOT, 'installer/stage', ...(opts.standalone ? ['standalone'] : []), `${opts.platform}-${opts.arch}`);
  const payload = path.join(stage, 'setup');
  const vendor = path.resolve(opts.vendor || process.env.LIGHTEM_VENDOR_DIR || (opts.standalone ? path.join(ROOT,'installer/cache/build-vendor') : (process.platform === 'darwin' ? '/Applications/XAMPP/xamppfiles/htdocs/vendor' : 'C:/xampp/htdocs/vendor')));
  if (!fs.existsSync(path.join(vendor,'composer/installed.json'))) throw new Error('Set --vendor to a complete Composer vendor directory.');
  const installed = JSON.parse(fs.readFileSync(path.join(vendor,'composer/installed.json'), 'utf8'));
  const packages = Array.isArray(installed) ? installed : installed.packages;
  if (!packages.some(p => p.name === 'vlucas/phpdotenv')) throw new Error('The vendor directory is missing vlucas/phpdotenv.');
  const source = XAMPP[opts.platform];
  const cached = path.join(ROOT, 'installer/cache', source.file);
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  if (!opts.standalone && !fs.existsSync(cached)) {
    if (opts.offline) throw new Error(`Offline cache is missing ${source.file}. Build once online first.`);
    // curl is only used on the build machine. The installed setup is offline.
    run('curl', ['--fail','--location','--proto','=https','--proto-redir','=https','--connect-timeout','20','--max-time','600',source.url,'--output',cached]);
  }
  if (!opts.standalone && sha256(cached) !== source.sha256) throw new Error('XAMPP checksum mismatch. Remove the cached file and download it again.');
  fs.rmSync(stage, { recursive:true, force:true });
  fs.mkdirSync(payload, { recursive:true });
  for (const part of ['api','src']) copy(path.join(ROOT,'backend',part),path.join(payload,'backend',part));
  // Do not copy stray vendor/api or vendor/src trees, local credentials or data.
  for (const part of ['autoload.php','composer', ...packages.map(p => p.name)]) {
    if (part.includes('..') || path.isAbsolute(part)) throw new Error('Invalid Composer package path.');
    copy(path.join(vendor,part),path.join(payload,'backend/vendor',part));
  }
  for (const file of fs.readdirSync(path.join(ROOT,'installer/schema')).filter(file => file.endsWith('.sql') || file === 'schema-manifest.json')) copy(path.join(ROOT,'installer/schema',file),path.join(payload,'database',file));
  for (const file of ['provision.php','verify.php']) copy(path.join(ROOT,'installer/common',file),path.join(payload,file));
  // Include any shared implementation required by the provisioning entrypoints.
  for (const file of fs.readdirSync(path.join(ROOT,'installer/common'))) {
    if (file.endsWith('.php')) copy(path.join(ROOT,'installer/common',file),path.join(payload,file));
  }
  if (opts.platform === 'win32') copy(path.join(ROOT,'installer/windows',opts.standalone ? 'install-standalone.ps1' : 'install.ps1'),path.join(payload,'install.ps1'));
  let runtime, phpMyAdmin;
  if (opts.standalone) {
    const preparedRuntime = await require('../runtime/prepare.cjs').prepareRuntime({platform:opts.platform,arch:opts.arch,stage,payload,offline:!!opts.offline});
    // Server architecture is separate from the universal desktop app. Keep
    // build-machine paths and internal cache fields out of release metadata.
    runtime = Object.fromEntries(['runtimeVersion','runtimeSha256','phpVersion','apacheVersion','mariadbVersion','requiresRosetta'].filter(key=>preparedRuntime[key]!==undefined).map(key=>[key,preparedRuntime[key]]));
    if(preparedRuntime.arch)runtime.runtimeArch=preparedRuntime.arch;
    copy(path.join(ROOT,'installer/runtime/verify.php'),path.join(payload,'verify-runtime.php'));
    phpMyAdmin = await require('../phpmyadmin/prepare.cjs').preparePhpMyAdmin({stage,payload,offline:!!opts.offline});
    copy(path.join(ROOT,'installer/phpmyadmin/verify.php'),path.join(payload,'verify-phpmyadmin.php'));
  }
  else copy(cached,path.join(payload,opts.platform === 'win32' ? 'xampp-installer.exe' : 'xampp-installer.dmg'));
  const metadata = { schemaVersion:1, version:opts.version, buildId:opts.buildId, platform:opts.platform, arch:opts.arch, updateUrl:opts.updateUrl, ...(opts.standalone ? {runtimeKind:'standalone'} : {}) };
  const manifest = { ...metadata, ...(opts.standalone ? {...runtime,...phpMyAdmin} : {xamppVersion:XAMPP.version, phpVersion:XAMPP.phpVersion, xamppSha256:source.sha256}), backendSha256:treeHash(path.join(payload,'backend')) };
  json(path.join(payload,'manifest.json'),manifest);
  json(path.join(stage,'system-release.json'),metadata);
  json(path.join(stage,'vendor-versions.json'),packages.map(p => ({name:p.name,version:p.version})));
  console.log(`Prepared ${opts.platform}/${opts.arch}, ${opts.standalone ? 'Lightem standalone runtime' : `XAMPP ${XAMPP.version}`}, build ${opts.buildId}. No database rows or backend credentials included.`);
  return { stage,payload,metadata };
}
async function build(opts) {
  const prepared = await prepare(opts);
  if (opts['prepare-only']) return prepared;
  const offline = opts.offline ? require('./offline.cjs').configureOfflineBuild({
    platform:opts.platform, arch:opts.arch,
    electronVersion:require('electron/package.json').version, stage:prepared.stage,
  }) : null;
  try { return await packagePrepared(opts, prepared, offline); }
  finally { offline?.restore(); }
}
async function packagePrepared(opts, prepared, offline) {
  if (opts.platform === 'darwin' && process.platform !== 'darwin') throw new Error('Build the Mac installer on macOS.');
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm',['run','build']);
  const defaults=cleanConfiguration(opts);
  configureDesktopHtml(path.join(ROOT,'dist/index.html'),opts);
  writeConfiguration(path.join(ROOT,'dist'),defaults);
  const { build:electronBuild, Platform, Arch } = require('electron-builder');
  const output = path.join(ROOT,'release',...(opts.standalone ? ['standalone'] : []),'full-setup',`${opts.platform}-${opts.arch}`);
  const artifactPrefix = opts.standalone ? 'Lightem-POS-Standalone' : 'Lightem-POS-Setup';
  fs.mkdirSync(output,{recursive:true});
  const config = {
    ...pkg.build,
    ...(offline ? { electronDist:offline.electronDist } : {}),
    directories:{...pkg.build.directories, output},
    ...desktopBuildIdentity(opts),
    extraResources:[...pkg.build.extraResources, {from:path.join(prepared.stage,'system-release.json'),to:'system-release.json'}, ...(opts.platform === 'win32' ? [{from:prepared.payload,to:'setup'}] : [])],
    nsis:{...pkg.build.nsis, perMachine:true, include:opts.standalone ? 'installer/windows/installer-standalone.nsh' : 'installer/windows/installer.nsh', artifactName:`${artifactPrefix}-${opts.version}-${opts.buildId}-x64.exe`, deleteAppDataOnUninstall:false},
    afterPack:async context => {
      const resources = opts.platform === 'darwin' ? path.join(context.appOutDir,'Lightem Pos.app/Contents/Resources') : path.join(context.appOutDir,'resources');
      if(opts.standalone && opts.platform==='win32')require('../runtime/prepare.cjs').validateRuntime(path.join(resources,'setup/runtime'),'win32');
      if(opts.standalone && opts.platform==='win32')require('../phpmyadmin/prepare.cjs').validateDirectory(path.join(resources,'setup/phpmyadmin'));
      // A new store always starts locally; an upgrade restores its own files.
      writeConfiguration(resources,defaults);
      writeConfiguration(path.join(resources,'images'),defaults);
      const asar=require('@electron/asar');
      for (const file of ['electron/main.cjs','electron/preload.cjs','electron/system-updater.cjs','electron/standalone-routing.cjs']) {
        if (!asar.extractFile(path.join(resources,'app.asar'),file).equals(fs.readFileSync(path.join(ROOT,file)))) {
          throw new Error(`Source changed while packaging ${file}. Run the build again with no source edits.`);
        }
      }
    },
    publish:null
  };
  const targets = opts.platform === 'win32' ? Platform.WINDOWS.createTarget(['nsis'],Arch.x64) : Platform.MAC.createTarget(['dir'],Arch[opts.arch]);
  await electronBuild({targets,config,publish:'never'});
  let artifact, importArtifact;
  if (opts.platform === 'win32') artifact=path.join(output,`${artifactPrefix}-${opts.version}-${opts.buildId}-x64.exe`);
  else {
    const folder = opts.arch === 'x64' ? 'mac' : `mac-${opts.arch}`;
    const appFile = path.join(output,folder,'Lightem Pos.app');
    if (!fs.existsSync(appFile)) throw new Error(`Packaged POS app missing: ${appFile}`);
    const pkgRoot = path.join(prepared.stage,'pkg-root');
    const support = path.join(pkgRoot,opts.standalone ? 'Library/Application Support/LightemStandalone/setup' : 'Library/Application Support/Lightem/setup');
    // The prepared payload is already sanitized and integrity-checked. Preserve
    // complete dependency trees; source-only config filters would remove files
    // that belong to the official phpMyAdmin distribution.
    if(opts.standalone) {
      fs.mkdirSync(path.dirname(support),{recursive:true});
      fs.cpSync(prepared.payload,support,{recursive:true,dereference:false});
      require('../phpmyadmin/prepare.cjs').validateDirectory(path.join(support,'phpmyadmin'));
    } else copy(prepared.payload,support);
    run('/usr/bin/ditto',[appFile,path.join(support,'Lightem Pos.app')]);
    // Do not let Installer relocate the nested application before backend setup.
    const componentPlist = path.join(prepared.stage,'components.plist');
    fs.writeFileSync(componentPlist,'<?xml version="1.0"?><plist version="1.0"><array/></plist>');
    artifact=path.join(output,`${artifactPrefix}-${opts.version}-${opts.buildId}-${opts.arch}.pkg`);
    const scripts=path.join(ROOT,opts.standalone ? 'installer/mac-standalone' : 'installer/mac');
    const importScripts=opts.standalone ? macImportScripts(scripts,prepared.stage) : null;
    const packageArgs=['--root',pkgRoot,'--component-plist',componentPlist,'--identifier',opts.standalone ? 'com.lightem.standalone.system' : 'com.lenard.restobill.system','--version',opts.version,'--install-location','/'];
    run('/usr/bin/pkgbuild',[...packageArgs,'--scripts',scripts,artifact]);
    if(importScripts) {
      // Both choices install exactly the same application/backend/runtime.
      // Only this package's compiled-in consent to copy XAMPP differs.
      importArtifact=artifact.replace(/\.pkg$/,'-import-xampp.pkg');
      run('/usr/bin/pkgbuild',[...packageArgs,'--scripts',importScripts,importArtifact]);
    }
  }
  const artifactInfo=file=>({url:`https://github.com/MaryExin/restobillv2/releases/download/${opts.standalone ? 'standalone-' : ''}v${opts.version}-${opts.buildId}/${path.basename(file)}`,sha256:sha256(file),size:fs.statSync(file).size});
  const release = {version:opts.version,buildId:opts.buildId,platform:opts.platform,arch:opts.arch,...(opts.standalone ? {runtimeKind:'standalone'} : {}),...artifactInfo(artifact),
    ...(opts.standalone&&opts.platform==='win32'?{supportsXamppImport:true}:{}),...(importArtifact?{xamppImport:artifactInfo(importArtifact)}:{})};
  json(path.join(output,'release-entry.json'),release);
  json(path.join(output,opts.standalone ? 'latest-standalone.json' : 'latest.json'),{schemaVersion:1,releases:[release]});
  console.log(`Installer ready: ${artifact}\nUse the same build ID for both platforms; merge release entries before publishing.`);
  return {...prepared,artifact,...(importArtifact?{importArtifact}:{})};
}
function macImportScripts(sourceScripts,stage) {
  const postinstall=path.join(sourceScripts,'postinstall');
  const stat=fs.lstatSync(postinstall);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('The normal Mac postinstall must be a regular script.');
  const source=fs.readFileSync(postinstall,'utf8');
  const assignments=source.match(/^[ \t]*(?:export[ \t]+)?COPY_XAMPP_REQUESTED=.*$/gm)||[];
  if(assignments.length!==1||assignments[0]!=='COPY_XAMPP_REQUESTED=0')throw new Error('The normal Mac installer must contain exactly one COPY_XAMPP_REQUESTED=0 setting.');
  const directory=path.join(stage,'mac-import-scripts');
  fs.rmSync(directory,{recursive:true,force:true});
  fs.cpSync(sourceScripts,directory,{recursive:true,dereference:false});
  fs.writeFileSync(path.join(directory,'postinstall'),source.replace(/^COPY_XAMPP_REQUESTED=0$/m,'COPY_XAMPP_REQUESTED=1'));
  return directory;
}
// A Windows standalone desktop must not replace the XAMPP desktop or share its
// browser profile. Keep the existing macOS and XAMPP application identities.
function desktopBuildIdentity(opts) {
  if (opts.standalone && opts.platform === 'win32') {
    return {
      appId:'com.lightem.standalone.pos',
      productName:'Lightem Pos Standalone',
      extraMetadata:{version:opts.version,name:'lightem_pos_standalone',productName:'Lightem Pos Standalone'},
    };
  }
  return {extraMetadata:{version:opts.version}};
}
function cleanConfiguration(opts = {}) {
  if (opts.standalone) return standaloneConfiguration();
  const businessInfo=JSON.parse(fs.readFileSync(path.join(ROOT,'public/businessInfo.json'),'utf8'));
  for (const key of Object.keys(businessInfo)) if (!key.startsWith('posProvider')) businessInfo[key]='';
  const posConfig=JSON.parse(fs.readFileSync(path.join(ROOT,'public/pos-config.json'),'utf8'));
  for (const key of Object.keys(posConfig)) posConfig[key]='';
  const localHost = opts.standalone ? 'http://localhost:8080' : 'http://localhost';
  return {'ip.txt':`LOCAL: ${localHost}\nWEB: \nTENANT: \n`,'printer.txt':'', 'businessInfo.json':businessInfo,'pos-config.json':posConfig,'printer_categories.json':{newTransaction:{bluetooth:{connection:'',categories:[]},lan:{connection:'',categories:[]}}}};
}
function standaloneConfiguration() {
  // This standalone build carries the desktop profile from this checkout.
  // Keep all editable copies aligned, including the TENANT fallback in ASAR.
  const read = name => {
    const file = path.join(ROOT,'public',name);
    const entry = fs.lstatSync(file);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`public/${name} must be a regular configuration file.`);
    return fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
  };
  const source = read('ip.txt');
  const seen = new Set();
  let tenant = '';
  const lines = source.split(/\r?\n/).map(line => {
    const match = line.match(/^[ \t]*(LOCAL|WEB|TENANT)[ \t]*:[ \t]*(.*)$/i);
    if (!match) return line;
    const key = match[1].toUpperCase();
    if (seen.has(key)) throw new Error(`public/ip.txt contains multiple ${key} entries.`);
    seen.add(key);
    if (key === 'TENANT') tenant = match[2].trim();
    return key + ': ' + (key === 'LOCAL' ? 'http://localhost:8080' : match[2]);
  });
  if (!tenant) throw new Error('Set TENANT in public/ip.txt before building standalone so product and sales sync have a company configured.');
  if (!seen.has('LOCAL')) lines.unshift('LOCAL: http://localhost:8080');
  if (!seen.has('WEB')) lines.push('WEB: ');
  const values = {'ip.txt':lines.join('\n').replace(/\n*$/,'\n'),'printer.txt':read('printer.txt')};
  for (const name of ['businessInfo.json','pos-config.json','printer_categories.json']) {
    const value = JSON.parse(read(name));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`public/${name} must contain a JSON object.`);
    values[name] = value;
  }
  return values;
}
function configureDesktopHtml(filename,opts) {
  if (!opts.standalone) return;
  const source = fs.readFileSync(filename,'utf8');
  let directives = 0;
  let updated = source.replace(/(\b(?:img-src|connect-src)\s+)([^;]*)(;)/g, (match,prefix,values,suffix) => {
    directives++;
    const origins = values.trim().split(/\s+/);
    // LOCAL is editable after installation. The Electron response CSP limits
    // requests to that configured origin; the static meta policy must not
    // reject a supported LAN address or custom port before that policy runs.
    for (const origin of ['http:']) {
      if (!origins.includes(origin)) origins.push(origin);
    }
    return prefix + origins.join(' ') + suffix;
  });
  if (directives !== 2) throw new Error('Standalone desktop CSP is missing the expected image/API directives.');
  const marker = `<meta name="lightem-runtime" content="${opts.platform === 'darwin' ? 'macos' : 'windows'}-standalone">`;
  if (!updated.includes(marker)) {
    if (!/<\/head>/i.test(updated)) throw new Error('Standalone desktop HTML is missing its head element.');
    updated = updated.replace(/<\/head>/i, marker+'\n</head>');
  }
  fs.writeFileSync(filename,updated);
}
function writeConfiguration(directory,values) {
  fs.mkdirSync(directory,{recursive:true});
  for (const [file,value] of Object.entries(values)) {
    if (typeof value==='string') fs.writeFileSync(path.join(directory,file),value);
    else json(path.join(directory,file),value);
  }
}
if (require.main === module) build(options(process.argv.slice(2))).catch(error=>{console.error(error.message);process.exit(1);});
module.exports={options,prepare,treeHash,build,desktopBuildIdentity,cleanConfiguration,configureDesktopHtml,writeConfiguration,macImportScripts};
