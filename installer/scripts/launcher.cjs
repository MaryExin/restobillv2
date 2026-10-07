#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {configureOfflineBuild}=require('./offline.cjs');
const {validateRelease}=require('../../electron/system-updater.cjs');
const ROOT=path.resolve(__dirname,'../..');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function json(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}

// The wrapper is a delivery bundle. Its newest build ID must never overwrite
// the identity of an unchanged platform installer inside that bundle.
function readLauncherReleasePlan(full,standalone=false){
  const releases=[['win32','x64'],['darwin','universal']].map(([platform,arch])=>{
    const folder=path.join(full,`${platform}-${arch}`);
    const release=validateRelease(JSON.parse(fs.readFileSync(path.join(folder,'release-entry.json'),'utf8')));
    if(release.platform!==platform||release.arch!==arch)throw new Error(`The ${platform} installer release has the wrong platform or architecture.`);
    if((release.runtimeKind==='standalone')!==standalone)throw new Error('Do not mix standalone and XAMPP installers.');
    if(release.supportsXamppImport!==undefined&&typeof release.supportsXamppImport!=='boolean')throw new Error('The installer import capability is invalid.');
    if(!standalone&&release.supportsXamppImport)throw new Error('Only standalone installers can offer an optional XAMPP import.');
    let xamppImport,importSource;
    if(release.xamppImport!==undefined){
      const variant=release.xamppImport;
      if(!standalone||platform!=='darwin'||!variant||typeof variant!=='object'||Array.isArray(variant)||Object.keys(variant).length!==3||Object.keys(variant).some(key=>!['url','sha256','size'].includes(key)))throw new Error('The Mac XAMPP import package metadata is invalid.');
      validateRelease({...release,...variant,xamppImport:undefined});
      xamppImport={url:variant.url,sha256:variant.sha256.toLowerCase(),size:variant.size};
      importSource=path.join(folder,path.basename(new URL(variant.url).pathname));
    }
    if(platform==='darwin'&&release.supportsXamppImport&&!xamppImport)throw new Error('The Mac import capability needs a verified import package.');
    return {...release,buildId:String(release.buildId),sha256:release.sha256.toLowerCase(),source:path.join(folder,path.basename(new URL(release.url).pathname)),...(xamppImport?{xamppImport,importSource}:{})};
  });
  const version=releases[0].version;
  if(releases.some(release=>release.version!==version))throw new Error('The Windows and Mac installers must have matching semantic versions.');
  if(!standalone&&releases.some(release=>release.buildId!==releases[0].buildId))throw new Error('The XAMPP Windows and Mac installers must have matching version/build IDs.');
  const buildId=releases.reduce((newest,release)=>BigInt(release.buildId)>BigInt(newest)?release.buildId:newest,releases[0].buildId);
  const installers={};
  for(const release of releases){
    const stat=fs.lstatSync(release.source);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==release.size||hash(release.source)!==release.sha256)throw new Error('A full installer does not match its verified release information.');
    const file=release.platform==='win32'?'win32.exe':'darwin.pkg';
    const item={file,size:release.size,sha256:release.sha256,version:release.version,buildId:release.buildId};
    if(release.platform==='win32'&&release.supportsXamppImport)item.supportsXamppImport=true;
    if(release.xamppImport){
      const variant=release.xamppImport,importStat=fs.lstatSync(release.importSource);
      if(release.importSource===release.source||!importStat.isFile()||importStat.isSymbolicLink()||importStat.size!==variant.size||hash(release.importSource)!==variant.sha256)throw new Error('A Mac import installer does not match its verified release information.');
      item.supportsXamppImport=true;
      item.importPackage={file:'darwin-import.pkg',sha256:variant.sha256,size:variant.size};
    }
    installers[release.platform]=item;
  }
  return {version,buildId,installers,releases};
}

function stageLauncherInstallers(plan,binaries){
  fs.mkdirSync(binaries,{recursive:true});
  for(const release of plan.releases){
    const item=plan.installers[release.platform];
    const target=path.join(binaries,item.file);
    fs.copyFileSync(release.source,target,fs.constants.COPYFILE_EXCL);
    if(fs.statSync(target).size!==item.size||hash(target)!==item.sha256)throw new Error('A full installer changed while preparing the shared setup app.');
    if(item.importPackage){
      const variant=item.importPackage,importTarget=path.join(binaries,variant.file);
      fs.copyFileSync(release.importSource,importTarget,fs.constants.COPYFILE_EXCL);
      if(fs.statSync(importTarget).size!==variant.size||hash(importTarget)!==variant.sha256)throw new Error('A Mac import installer changed while preparing the shared setup app.');
    }
  }
}

async function buildLauncher(platform,offlineOnly=false,standalone=false){
  if(!['win32','darwin'].includes(platform))throw new Error('Choose --platform win32 or darwin.');
  const arch=platform==='darwin'?'universal':'x64';
  const full=path.join(ROOT,'release',...(standalone?['standalone']:[]),'full-setup');
  const plan=readLauncherReleasePlan(full,standalone);
  const {version,buildId,installers}=plan;
  const stage=path.join(ROOT,'installer/stage',...(standalone?['standalone']:[]),`launcher-${platform}-${arch}`);
  fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage,{recursive:true});
  const app=path.join(stage,'app');fs.mkdirSync(path.join(app,'assets'),{recursive:true});
  const binaries=path.join(stage,'installers');
  stageLauncherInstallers(plan,binaries);
  const updateUrl=`https://github.com/MaryExin/restobillv2/releases/latest/download/${standalone?'latest-standalone.json':'latest.json'}`;
  const flavor=standalone?{runtimeKind:'standalone'}:{};
  json(path.join(stage,'setup-release.json'),{version,buildId,installers,updateUrl,...flavor});
  json(path.join(stage,'system-release.json'),{schemaVersion:1,version,buildId,platform,arch,updateUrl,...flavor});
  for(const file of ['main.cjs','preload.cjs'])fs.copyFileSync(path.join(ROOT,'installer/launcher',file),path.join(app,file));
  fs.copyFileSync(path.join(ROOT,'electron/system-updater.cjs'),path.join(app,'system-updater.cjs'));
  for(const file of ['Poppins-Regular.ttf','Poppins-SemiBold.ttf'])fs.copyFileSync(path.join(ROOT,'src/fonts',file),path.join(app,'assets',file));
  const template=fs.readFileSync(path.join(ROOT,'installer/launcher.html'),'utf8');
  const identities=Object.fromEntries(Object.entries(installers).map(([target,item])=>[target,{version:item.version,buildId:item.buildId,...(item.supportsXamppImport?{supportsXamppImport:true}:{})}]));
  fs.writeFileSync(path.join(app,'index.html'),template.replace('/* LIGHTEM_RELEASE */',JSON.stringify({version,buildId,...flavor,installers:identities})));
  json(path.join(app,'package.json'),{name:standalone?'lightem-standalone-setup':'lightem-setup',version,description:'Install or update the complete Lightem POS system',author:'Lightem',main:'main.cjs',private:true});
  const electronVersion=require('electron/package.json').version;
  const offline=offlineOnly?configureOfflineBuild({platform,arch,electronVersion,stage}):null;
  try{
    const {build,Platform,Arch}=require('electron-builder');
    const output=path.join(ROOT,'release',...(standalone?['standalone']:[]),'setup-app',`${platform}-${arch}`);
    const prefix=standalone?'Lightem-Standalone-Setup':'Lightem-Setup';
    const config={extends:null,appId:standalone?'com.lightem.standalone.setup':'com.lightem.setup',productName:'Lightem Setup',electronVersion,extraMetadata:{version},
      directories:{app,output,buildResources:path.join(ROOT,'build')},files:['**/*','!node_modules{,/**/*}'],asar:true,
      extraResources:[{from:binaries,to:'installers'},{from:path.join(stage,'setup-release.json'),to:'setup-release.json'},{from:path.join(stage,'system-release.json'),to:'system-release.json'}],
      npmRebuild:false,nodeGypRebuild:false,buildDependenciesFromSource:false,
      win:{target:['portable'],icon:path.join(ROOT,'build/icon.ico')},portable:{requestExecutionLevel:'user',artifactName:`${prefix}-${version}-${buildId}-Windows.exe`},
      mac:{target:['zip'],category:'public.app-category.utilities',icon:path.join(ROOT,'public/logo.png'),artifactName:`${prefix}-${version}-${buildId}-Mac.zip`},
      ...(offline?{electronDist:offline.electronDist}:{}),publish:null,
    };
    // Isolate both package metadata and builder configuration from the POS app.
    await build({projectDir:app,config,targets:platform==='win32'?Platform.WINDOWS.createTarget(['portable'],Arch.x64):Platform.MAC.createTarget(['zip'],Arch.universal),publish:'never'});
    const file=`${prefix}-${version}-${buildId}-${platform==='win32'?'Windows.exe':'Mac.zip'}`;
    const artifact=path.join(output,file);
    json(path.join(output,'launcher-entry.json'),{version,buildId,platform,arch,file,size:fs.statSync(artifact).size,sha256:hash(artifact),...flavor});
    console.log(`Native setup app ready: ${artifact}`);
  }finally{offline?.restore();}
}
if(require.main===module){const args=process.argv.slice(2),index=args.indexOf('--platform');buildLauncher(index>=0?args[index+1]:process.platform,args.includes('--offline')).catch(error=>{console.error(error.message);process.exit(1);});}
module.exports={buildLauncher,readLauncherReleasePlan,stageLauncherInstallers};
