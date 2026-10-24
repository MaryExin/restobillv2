const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const vm=require('node:vm');
const builder=require('../scripts/launcher.cjs');
const fullBuilder=require('../scripts/build.cjs');
const updater=require('../../electron/system-updater.cjs');
const source=fs.readFileSync(path.join(__dirname,'../scripts/launcher.cjs'),'utf8');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='object'&&!Buffer.isBuffer(value)?JSON.stringify(value):value);}
function fixture(t,{standalone=true,winBuild='20260926160539',macBuild='20260926142957',importChoice=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lightem-launcher-build-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const full=path.join(root,'release',...(standalone?['standalone']:[]),'full-setup');
 const entries={},files={};
 for(const [platform,arch,buildId,extension] of [['win32','x64',winBuild,'exe'],['darwin','universal',macBuild,'pkg']]){
  const bytes=Buffer.from(`verified full installer for ${platform}`);
  const file=path.join(full,`${platform}-${arch}`,`Lightem-${buildId}.${extension}`);
  const entry={version:'0.0.1',buildId,platform,arch,url:`https://releases.example.test/${path.basename(file)}`,size:bytes.length,sha256:hash(bytes),...(standalone?{runtimeKind:'standalone'}:{})};
  write(file,bytes);write(path.join(path.dirname(file),'release-entry.json'),entry);entries[platform]=entry;files[platform]=file;
 }
 const updateEntry=(platform,change)=>{Object.assign(entries[platform],change);write(path.join(path.dirname(files[platform]),'release-entry.json'),entries[platform]);};
 if(importChoice){
  updateEntry('win32',{supportsXamppImport:true});
  const bytes=Buffer.from('verified Mac installer with explicit XAMPP import');
  files.macImport=path.join(path.dirname(files.darwin),`Lightem-${macBuild}-import-xampp.pkg`);
  write(files.macImport,bytes);
  updateEntry('darwin',{xamppImport:{url:`https://releases.example.test/${path.basename(files.macImport)}`,size:bytes.length,sha256:hash(bytes)}});
 }
 return {root,full,entries,files,updateEntry};
}

test('shared standalone setup keeps each platform identity and uses the newest full build as wrapper identity',t=>{
 const f=fixture(t),plan=builder.readLauncherReleasePlan(f.full,true);
 assert.equal(plan.version,'0.0.1');assert.equal(plan.buildId,f.entries.win32.buildId);
 for(const platform of ['win32','darwin']){
  const entry=f.entries[platform];
  assert.deepEqual(plan.installers[platform],{file:platform==='win32'?'win32.exe':'darwin.pkg',size:entry.size,sha256:entry.sha256,version:entry.version,buildId:entry.buildId});
 }
});

test('Mac import scripts change only explicit consent and preserve the normal installer',t=>{
 const f=fixture(t),scripts=path.join(f.root,'mac-scripts'),stage=path.join(f.root,'stage');
 const original='#!/bin/bash\nset -e\nCOPY_XAMPP_REQUESTED=0\necho "$COPY_XAMPP_REQUESTED"\n';
 write(path.join(scripts,'postinstall'),original);fs.chmodSync(path.join(scripts,'postinstall'),0o755);
 write(path.join(scripts,'preinstall'),'#!/bin/bash\nexit 0\n');fs.chmodSync(path.join(scripts,'preinstall'),0o755);
 const imported=fullBuilder.macImportScripts(scripts,stage);
 assert.equal(imported,path.join(stage,'mac-import-scripts'));
 assert.equal(fs.readFileSync(path.join(imported,'postinstall'),'utf8'),original.replace('COPY_XAMPP_REQUESTED=0','COPY_XAMPP_REQUESTED=1'));
 assert.equal(fs.readFileSync(path.join(scripts,'postinstall'),'utf8'),original);
 assert.deepEqual(fs.readFileSync(path.join(imported,'preinstall')),fs.readFileSync(path.join(scripts,'preinstall')));
 assert.equal(fs.statSync(path.join(imported,'postinstall')).mode&0o777,0o755);
 assert.equal(fs.statSync(path.join(imported,'preinstall')).mode&0o777,0o755);
 write(path.join(imported,'stale-script'),'must not be reused');
 fullBuilder.macImportScripts(scripts,stage);
 assert.equal(fs.existsSync(path.join(imported,'stale-script')),false);
});

test('Mac import packaging refuses ambiguous or already-enabled normal scripts',t=>{
 const f=fixture(t),scripts=path.join(f.root,'mac-scripts'),stage=path.join(f.root,'stage');
 for(const source of ['#!/bin/bash\n','COPY_XAMPP_REQUESTED=1\n','COPY_XAMPP_REQUESTED=0\nCOPY_XAMPP_REQUESTED=0\n','COPY_XAMPP_REQUESTED=0\n  COPY_XAMPP_REQUESTED=1\n']){
  write(path.join(scripts,'postinstall'),source);
  assert.throws(()=>fullBuilder.macImportScripts(scripts,stage),/exactly one COPY_XAMPP_REQUESTED=0/);
  assert.equal(fs.existsSync(stage),false);
 }
 fs.rmSync(path.join(scripts,'postinstall'));
 write(path.join(f.root,'external-postinstall'),'COPY_XAMPP_REQUESTED=0\n');
 fs.symlinkSync(path.join(f.root,'external-postinstall'),path.join(scripts,'postinstall'));
 assert.throws(()=>fullBuilder.macImportScripts(scripts,stage),/regular script/);
});

test('optional import capabilities embed both verified Mac choices and the explicit Windows capability',t=>{
 const f=fixture(t,{importChoice:true}),plan=builder.readLauncherReleasePlan(f.full,true);
 assert.equal(plan.installers.win32.supportsXamppImport,true);
 assert.equal(plan.installers.win32.importPackage,undefined);
 assert.deepEqual(plan.installers.darwin.importPackage,{file:'darwin-import.pkg',size:f.entries.darwin.xamppImport.size,sha256:f.entries.darwin.xamppImport.sha256});
 assert.equal(plan.installers.darwin.supportsXamppImport,true);
 const stage=path.join(f.root,'stage/installers');builder.stageLauncherInstallers(plan,stage);
 assert.deepEqual(fs.readdirSync(stage).sort(),['darwin-import.pkg','darwin.pkg','win32.exe']);
 for(const [file,original] of [['win32.exe',f.files.win32],['darwin.pkg',f.files.darwin],['darwin-import.pkg',f.files.macImport]])assert.deepEqual(fs.readFileSync(path.join(stage,file)),fs.readFileSync(original));
});

test('changed, linked or reused Mac import packages are rejected',t=>{
 const f=fixture(t,{importChoice:true}),plan=builder.readLauncherReleasePlan(f.full,true);
 fs.appendFileSync(f.files.macImport,'changed');
 assert.throws(()=>builder.stageLauncherInstallers(plan,path.join(f.root,'stage/installers')),/Mac import installer changed/);
 assert.throws(()=>builder.readLauncherReleasePlan(f.full,true),/Mac import installer does not match/);
 const original=path.join(f.root,'external.pkg');fs.renameSync(f.files.macImport,original);fs.symlinkSync(original,f.files.macImport);
 assert.throws(()=>builder.readLauncherReleasePlan(f.full,true),/Mac import installer does not match/);
 f.updateEntry('darwin',{xamppImport:{url:f.entries.darwin.url,size:f.entries.darwin.size,sha256:f.entries.darwin.sha256}});
 assert.throws(()=>builder.readLauncherReleasePlan(f.full,true),/Mac import installer does not match/);
});

for(const [label,change,pattern] of [
 ['insecure URL',{url:'http://example.test/import.pkg'},/HTTPS/],
 ['wrong extension',{url:'https://example.test/import.exe'},/full-system setup package/],
 ['invalid size',{size:0},/package size/],
 ['invalid checksum',{sha256:'not a hash'},/checksum/],
 ['nested identity',{platform:'win32'},/metadata is invalid/],
 ['missing checksum',{sha256:undefined},/metadata is invalid/],
])test(`optional Mac import rejects ${label} before staging`,t=>{
 const f=fixture(t,{importChoice:true});f.updateEntry('darwin',{xamppImport:{...f.entries.darwin.xamppImport,...change}});
 assert.throws(()=>builder.readLauncherReleasePlan(f.full,true),pattern);
});

test('legacy editions and unsupported platforms cannot advertise import packages',t=>{
 const f=fixture(t,{importChoice:true});
 f.updateEntry('win32',{xamppImport:f.entries.darwin.xamppImport});
 assert.throws(()=>builder.readLauncherReleasePlan(f.full,true),/metadata is invalid/);
 const legacy=fixture(t,{standalone:false,winBuild:'10',macBuild:'10'});
 legacy.updateEntry('win32',{supportsXamppImport:true});
 assert.throws(()=>builder.readLauncherReleasePlan(legacy.full,false),/Only standalone/);
});

test('wrapper build selection compares numbers rather than lexical order',t=>{
 const f=fixture(t,{winBuild:'9',macBuild:'10'});
 assert.equal(builder.readLauncherReleasePlan(f.full,true).buildId,'10');
});

test('staging a corrected Windows installer preserves the original Mac package bytes',t=>{
 const f=fixture(t),macBefore=fs.readFileSync(f.files.darwin),statBefore=fs.statSync(f.files.darwin);
 const plan=builder.readLauncherReleasePlan(f.full,true),stage=path.join(f.root,'stage/installers');
 builder.stageLauncherInstallers(plan,stage);
 assert(fs.readFileSync(path.join(stage,'win32.exe')).equals(fs.readFileSync(f.files.win32)));
 assert(fs.readFileSync(path.join(stage,'darwin.pkg')).equals(macBefore));
 assert(fs.readFileSync(f.files.darwin).equals(macBefore));
 assert.equal(fs.statSync(f.files.darwin).mtimeMs,statBefore.mtimeMs);
 assert.equal(plan.installers.darwin.buildId,f.entries.darwin.buildId);
});

test('a source package changed after verification cannot be embedded',t=>{
 const f=fixture(t),plan=builder.readLauncherReleasePlan(f.full,true);
 fs.appendFileSync(f.files.darwin,'modified after verification');
 assert.throws(()=>builder.stageLauncherInstallers(plan,path.join(f.root,'stage/installers')),/changed while preparing/);
});

for(const [label,platform,change,pattern] of [
 ['wrong platform','win32',{platform:'darwin'},/full-system setup package|wrong platform/],
 ['wrong architecture','darwin',{arch:'x64'},/wrong platform or architecture/],
 ['mixed runtime flavor','darwin',{runtimeKind:'xampp'},/Do not mix/],
 ['different semantic versions','darwin',{version:'0.0.2'},/matching semantic versions/],
 ['incorrect file size','win32',{size:1},/verified release information/],
 ['incorrect file checksum','darwin',{sha256:'a'.repeat(64)},/verified release information/],
 ['insecure source URL','darwin',{url:'http://example.test/installer.pkg'},/HTTPS/],
 ['invalid build ID','win32',{buildId:'../latest'},/positive integer/],
]){
 test(`release planning rejects ${label} before staging`,t=>{
  const f=fixture(t);f.updateEntry(platform,change);
  assert.throws(()=>builder.readLauncherReleasePlan(f.full,true),pattern);
  assert.equal(fs.existsSync(path.join(f.root,'installer/stage')),false);
 });
}

test('linked full installers are rejected',t=>{
 const f=fixture(t),copy=path.join(f.root,'outside.pkg');
 fs.renameSync(f.files.darwin,copy);fs.symlinkSync(copy,f.files.darwin);
 assert.throws(()=>builder.readLauncherReleasePlan(f.full,true),/verified release information/);
});

test('legacy XAMPP wrappers retain the matching-build requirement',t=>{
 const f=fixture(t,{standalone:false});
 assert.throws(()=>builder.readLauncherReleasePlan(f.full,false),/matching version\/build IDs/);
 f.updateEntry('darwin',{buildId:f.entries.win32.buildId});
 assert.equal(builder.readLauncherReleasePlan(f.full,false).buildId,f.entries.win32.buildId);
});

for(const importChoice of [false,true])test(`both real launcher build paths emit platform identities with import choice ${importChoice}`,async t=>{
 const f=fixture(t,{importChoice}),calls=[];
 for(const file of ['installer/launcher/main.cjs','installer/launcher/preload.cjs','electron/system-updater.cjs','src/fonts/Poppins-Regular.ttf','src/fonts/Poppins-SemiBold.ttf'])write(path.join(f.root,file),`fixture ${file}`);
 write(path.join(f.root,'installer/launcher.html'),'const release = /* LIGHTEM_RELEASE */;');
 const module={exports:{}};
 const dependencies={
  './offline.cjs':{configureOfflineBuild(opts){calls.push(['offline',opts.platform]);return {electronDist:'/fixture/electron',restore(){calls.push(['restored',opts.platform]);}};}},
  '../../electron/system-updater.cjs':updater,
  'electron/package.json':{version:'40.9.2'},
  'electron-builder':{
   Platform:{WINDOWS:{createTarget:()=> 'win32'},MAC:{createTarget:()=> 'darwin'}},Arch:{x64:'x64',universal:'universal'},
   async build({config,targets}){calls.push(['packaged',targets]);write(path.join(config.directories.output,targets==='win32'?config.portable.artifactName:config.mac.artifactName),'fixture launcher binary');},
  },
 };
 const wrapper=vm.runInThisContext('(function(require,module,exports,__dirname,__filename,process,console){'+source.replace(/^#!.*\n/,'')+'\n})');
 wrapper(id=>Object.hasOwn(dependencies,id)?dependencies[id]:require(id),module,module.exports,path.join(f.root,'installer/scripts'),path.join(f.root,'installer/scripts/launcher.cjs'),{argv:[],platform:'darwin'},{log(){}});
 const originalMac=fs.readFileSync(f.files.darwin);
 for(const platform of ['win32','darwin']){
  await module.exports.buildLauncher(platform,true,true);
  const arch=platform==='win32'?'x64':'universal';
  const stage=path.join(f.root,'installer/stage/standalone',`launcher-${platform}-${arch}`);
  const setup=JSON.parse(fs.readFileSync(path.join(stage,'setup-release.json')));
  const system=JSON.parse(fs.readFileSync(path.join(stage,'system-release.json')));
  const entry=JSON.parse(fs.readFileSync(path.join(f.root,'release/standalone/setup-app',`${platform}-${arch}`,'launcher-entry.json')));
  const html=fs.readFileSync(path.join(stage,'app/index.html'),'utf8');
  const ui=JSON.parse(html.slice('const release = '.length,-1));
  for(const metadata of [setup,system,entry,ui])assert.equal(metadata.buildId,f.entries.win32.buildId);
  assert.deepEqual(ui.installers,{win32:{version:'0.0.1',buildId:f.entries.win32.buildId,...(importChoice?{supportsXamppImport:true}:{})},darwin:{version:'0.0.1',buildId:f.entries.darwin.buildId,...(importChoice?{supportsXamppImport:true}:{})}});
  assert.equal(setup.installers.darwin.buildId,f.entries.darwin.buildId);
  assert(fs.readFileSync(path.join(stage,'installers/darwin.pkg')).equals(originalMac));
  if(importChoice){
   assert.equal(setup.installers.win32.supportsXamppImport,true);
   assert.equal(setup.installers.darwin.supportsXamppImport,true);
   assert.deepEqual(setup.installers.darwin.importPackage,{file:'darwin-import.pkg',size:f.entries.darwin.xamppImport.size,sha256:f.entries.darwin.xamppImport.sha256});
   assert.deepEqual(fs.readFileSync(path.join(stage,'installers/darwin-import.pkg')),fs.readFileSync(f.files.macImport));
  }else assert.equal(fs.existsSync(path.join(stage,'installers/darwin-import.pkg')),false);
 }
 assert(fs.readFileSync(f.files.darwin).equals(originalMac));
 assert.deepEqual(calls.map(call=>call[0]),['offline','packaged','restored','offline','packaged','restored']);
});
