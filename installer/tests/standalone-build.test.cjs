'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const JSZip=require('jszip');
const SCRIPTS=path.resolve(__dirname,'../scripts');
// Run the production module against a disposable project root. Only dispatcher
// build dependencies are replaced; release/archive tests use real filesystem,
// hashing, streams, JSON and ZIP implementations.
function load(name,root,dependencies={},platform='darwin') {
 const module={exports:{}};
 const wrapper=vm.runInThisContext('(function(require,module,exports,__dirname,__filename,process,console){'+fs.readFileSync(path.join(SCRIPTS,name),'utf8').replace(/^#!.*\n/,'')+'\n})',{filename:path.join(SCRIPTS,name)});
 wrapper(id=>Object.hasOwn(dependencies,id)?dependencies[id]:require(id),module,module.exports,path.join(root,'installer/scripts'),path.join(root,'installer/scripts',name),{platform,argv:[]},{log(){}});
 return module.exports;
}
function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'lightem-standalone-build-'));}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));}
function releaseEntry(platform,kind='standalone'){return {version:'0.0.1',buildId:'20260926112233',platform,arch:platform==='win32'?'x64':'universal',...(kind?{runtimeKind:kind}:{})};}
function launcherFixtures(root,standalone=true){
 const output=path.join(root,'release',...(standalone?['standalone']:[]),'setup-app');
 for(const platform of ['win32','darwin']){
  const entry=releaseEntry(platform,standalone?'standalone':'');
  entry.file=platform==='win32'?'Lightem Setup.exe':'Lightem Setup-mac.zip';
  const bytes=Buffer.from(platform+' executable fixture');
  entry.size=bytes.length;entry.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const folder=path.join(output,platform+'-'+entry.arch);write(path.join(folder,'launcher-entry.json'),entry);fs.writeFileSync(path.join(folder,entry.file),bytes);
 }
 return output;
}
function dispatcher(root){
 const calls=[];
 const deps={
  './build.cjs':{options(args){calls.push(['options',args]);return {buildId:'20260926112233',version:'0.0.1',arch:'universal',offline:true,standalone:true};},async build(opts){calls.push(['build',opts]);return opts;}},
  './release.cjs':{release(...args){calls.push(['release',...args]);}},
  './launcher.cjs':{async buildLauncher(...args){calls.push(['launcher',...args]);}},
  './bundle.cjs':{async bundle(...args){calls.push(['bundle',...args]);}},
 };
 return {calls,...load('standalone.cjs',root,deps)};
}
test('standalone dispatcher selects Windows x64 and forwards offline/build arguments',async()=>{
 const d=dispatcher('/unused');await d.standalone(['installer:win','--offline','--build-id','20260926112233']);
 assert.deepEqual(d.calls[0],['options',['--standalone','--offline','--build-id','20260926112233']]);
 assert.equal(d.calls[1][1].platform,'win32');assert.equal(d.calls[1][1].arch,'x64');assert.equal(d.calls[1][1].standalone,true);
});
test('standalone all command builds both platforms before merging and bundling',async()=>{
 const d=dispatcher('/unused');await d.standalone(['installer:all','--offline']);
 assert.deepEqual(d.calls.map(x=>x[0]),['options','build','build','release','launcher','launcher','bundle']);
 assert.equal(d.calls[1][1].platform,'win32');assert.equal(d.calls[2][1].platform,'darwin');
 assert.equal(d.calls[1][1].buildId,d.calls[2][1].buildId);
 assert.deepEqual(d.calls[3],['release',[],true]);
 assert.deepEqual(d.calls[4],['launcher','win32',true,true]);assert.deepEqual(d.calls[5],['launcher','darwin',true,true]);assert.deepEqual(d.calls[6],['bundle',true]);
});
test('standalone setup and release commands route to the separate flavor',async()=>{
 const d=dispatcher('/unused');await d.standalone(['setup:mac','--offline']);await d.standalone(['installer:release','fixture-entry.json']);await d.standalone(['installer:bundle']);
 assert.deepEqual(d.calls,[['launcher','darwin',true,true],['release',[path.resolve('fixture-entry.json')],true],['bundle',true]]);
});
test('standalone dispatcher rejects unsupported commands/options before invoking builds',async()=>{
 const d=dispatcher('/unused');await assert.rejects(d.standalone(['unknown']),/Commands/);await assert.rejects(d.standalone(['setup:win','--publish']),/only --offline/);await assert.rejects(d.standalone(['installer:bundle','--offline']),/takes no options/);assert.equal(d.calls.length,0);
});
test('standalone release writes only its own update feed',()=>{const root=fixture();try{
 const output=path.join(root,'release/standalone/full-setup');
 const legacy=path.join(root,'release/full-setup/latest.json');write(legacy,'existing XAMPP feed');
 for(const platform of ['win32','darwin'])write(path.join(output,platform,'release-entry.json'),releaseEntry(platform));
 const file=load('release.cjs',root).release([],true);
 assert.equal(file,path.join(output,'latest-standalone.json'));assert.equal(JSON.parse(fs.readFileSync(file)).releases.length,2);assert.equal(fs.readFileSync(legacy,'utf8'),'existing XAMPP feed');
 assert.equal(fs.existsSync(path.join(output,'latest.json')),false);
}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('release refuses mixed standalone/XAMPP entries without writing a feed',()=>{const root=fixture();try{
 const output=path.join(root,'release/standalone/full-setup');const a=path.join(output,'win32/release-entry.json'),b=path.join(output,'darwin/release-entry.json');write(a,releaseEntry('win32'));write(b,releaseEntry('darwin',''));
 assert.throws(()=>load('release.cjs',root).release([a,b],true),/Do not mix/);assert.equal(fs.existsSync(path.join(output,'latest-standalone.json')),false);
}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('legacy release channel refuses standalone entries',()=>{const root=fixture();try{const input=path.join(root,'entry.json');write(input,releaseEntry('win32'));assert.throws(()=>load('release.cjs',root).release([input],false),/Do not mix/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('standalone feed preserves the working Mac release when only Windows is rebuilt',()=>{const root=fixture();try{
 const output=path.join(root,'release/standalone/full-setup');
 const mac=releaseEntry('darwin'),windows={...releaseEntry('win32'),buildId:'20260927112233'};
 const a=path.join(output,'win32-x64/release-entry.json'),b=path.join(output,'darwin-universal/release-entry.json');
 write(a,windows);write(b,mac);
 const file=load('release.cjs',root).release([a,b],true);
 assert.deepEqual(JSON.parse(fs.readFileSync(file)).releases,[windows,mac]);
 assert.deepEqual(JSON.parse(fs.readFileSync(b)),mac);
}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('standalone ZIP contains both verified binaries and its own instructions without touching legacy output',async()=>{const root=fixture();try{
 const output=launcherFixtures(root);const legacy=path.join(root,'release/setup-app/existing.zip');write(legacy,'existing XAMPP archive');
 await load('bundle.cjs',root).bundle(true);
 const archive=await JSZip.loadAsync(fs.readFileSync(path.join(output,'Lightem-Standalone-Setup-0.0.1-20260926112233-Windows-and-Mac.zip')));
 assert.equal(await archive.file('Lightem Setup/Windows/Lightem Setup.exe').async('string'),'win32 executable fixture');
 assert.equal(await archive.file('Lightem Setup/Mac/Lightem Setup-mac.zip').async('string'),'darwin executable fixture');
 const readme=await archive.file('Lightem Setup/READ ME FIRST.txt').async('string');assert.match(readme,/LIGHTEM STANDALONE SETUP/);assert.match(readme,/db_cnc_pos and reports_database/);assert.match(readme,/XAMPP is not installed or required/);
 assert.equal(fs.readFileSync(legacy,'utf8'),'existing XAMPP archive');
}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('bundle refuses mixed setup flavors before producing an archive',async()=>{const root=fixture();try{
 const output=launcherFixtures(root);const file=path.join(output,'darwin-universal/launcher-entry.json');const entry=JSON.parse(fs.readFileSync(file));delete entry.runtimeKind;write(file,entry);
 await assert.rejects(load('bundle.cjs',root).bundle(true),/Do not mix/);assert.equal(fs.readdirSync(output).some(n=>n.endsWith('.zip')),false);
}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('bundle refuses a modified setup binary before producing an archive',async()=>{const root=fixture();try{
 const output=launcherFixtures(root);fs.appendFileSync(path.join(output,'win32-x64/Lightem Setup.exe'),'corrupt');
 await assert.rejects(load('bundle.cjs',root).bundle(true),/integrity check failed/);assert.equal(fs.readdirSync(output).some(n=>n.endsWith('.zip')),false);
}finally{fs.rmSync(root,{recursive:true,force:true});}});
