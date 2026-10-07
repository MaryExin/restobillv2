#!/usr/bin/env node
'use strict';
// Fetch verified build inputs; never run a downloaded installer.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {seed}=require('./prepare.cjs');
const ROOT=path.resolve(__dirname,'../..');
const CACHE=path.join(ROOT,'installer/cache');
function run(file,args) {
 const r=spawnSync(file,args,{stdio:'inherit',cwd:ROOT});
 if(r.error||r.status!==0)throw new Error(`${path.basename(file)} failed (${r.error?.message||r.status}).`);
}
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function fetchWindows({offline=false}={}) {
 const lock=require('./sources.lock.json').platforms.win32.archive;
 if(!lock||!/^https:\/\//.test(lock.url))throw new Error('The Windows runtime source archive is not pinned.');
 const archive=path.join(CACHE,lock.file),partial=archive+'.partial';fs.mkdirSync(CACHE,{recursive:true});
 if(!fs.existsSync(archive)) {
  if(offline)throw new Error(`Offline cache is missing ${lock.file}. Run runtime/fetch.cjs once online.`);
  try {
   run('curl',['--fail','--location','--proto','=https','--proto-redir','=https','--connect-timeout','20','--max-time','900',lock.url,'--output',partial]);
   if(sha(partial)!==lock.sha256||fs.statSync(partial).size!==lock.size)throw new Error('Downloaded Windows runtime checksum failed.');
   fs.renameSync(partial,archive);
  }finally{fs.rmSync(partial,{force:true});}
 }
 if(sha(archive)!==lock.sha256||fs.statSync(archive).size!==lock.size)throw new Error('Cached Windows runtime source checksum failed; it was not used.');
 const temp=fs.mkdtempSync(path.join(CACHE,'.runtime-source-'));
 try {
  run(require('7zip-bin').path7za,['x',archive,'-o'+temp,'-y']);
  return seed({platform:'win32',source:path.join(temp,'xampp')});
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(require.main===module){try{for(const a of process.argv.slice(2))if(a!=='--offline')throw new Error('Only --offline is supported.');fetchWindows({offline:process.argv.includes('--offline')});}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={fetchWindows};
