'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawnSync}=require('node:child_process');
const source=fs.readFileSync(path.resolve(__dirname,'../mac-standalone/postinstall'),'utf8');
const productionTrap=source.split('\n').find(line=>line.startsWith("trap 'die "))+'\n';
function block(name){return source.split(`# BEGIN STANDALONE ${name}\n`)[1].split(`# END STANDALONE ${name}`)[0];}
const processCode=block('PROCESS CHECKS').replaceAll('/usr/sbin/lsof','fixture_lsof').replaceAll('/bin/ps','fixture_ps').replaceAll('/bin/launchctl','fixture_launchctl');
const stubs=String.raw`
die(){ printf '%s\n' "$*" >&2; exit 42; }
fixture_launchctl(){ return 0; }
sleep(){ local n=0; [ ! -f "$FIXTURE/sleeps" ] || n=$(cat "$FIXTURE/sleeps"); echo $((n+1)) > "$FIXTURE/sleeps"; }
fixture_lsof(){
 if [ "$LSOF_MODE" = error ]; then return 2; fi
 if [ "$LSOF_MODE" = empty ]; then return 1; fi
 if [ "$1" = -a ]; then
  [ "${'${LSOF_TEXT_MODE:-}'}" != error ] || return 2
  printf 'n%s\n' "$OWNER"
  if [ "${'${LSOF_TEXT_MODE:-}'}" = large ]; then /usr/bin/awk 'BEGIN {for(i=0;i<100000;i++) print "n/library/additional-mapped-file-" i}'; fi
 else printf '500\n'; fi
}
fixture_ps(){
 local n=0; [ ! -f "$FIXTURE/ps-calls" ] || n=$(cat "$FIXTURE/ps-calls"); n=$((n+1)); echo "$n" > "$FIXTURE/ps-calls"
 case "$PS_MODE" in
 error) return 1;;
 delayed) [ "$n" -gt 3 ] || printf '%s/123/bin/httpd -DFOREGROUND\n' "$RUNTIME_BASE";;
 active) printf '%s/123/bin/httpd -DFOREGROUND\n' "$RUNTIME_BASE";;
 foreign) printf '/another/application/bin/httpd -DFOREGROUND\n';;
 esac
 return 0
}
`;
function execute(code,env={}){const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'lightem-mac-control-'));const r=spawnSync('/bin/bash',['-eu','-o','pipefail','-c',stubs+'\n'+processCode+'\n'+code],{env:{...process.env,LSOF_MODE:'empty',PS_MODE:'empty',FIXTURE:fixture,RUNTIME_BASE:'/Library/Lightem/runtime',...env},encoding:'utf8',timeout:5000});return {fixture,r,clean:()=>fs.rmSync(fixture,{recursive:true,force:true})};}
for(const [name,cmd,env,status] of [
 ['port ownership rejects inspection failure','port_belongs_to 80 "$RUNTIME_BASE"',{LSOF_MODE:'error'},1],
 ['port shutdown rejects inspection failure','wait_port_closed 80',{LSOF_MODE:'error'},1],
 ['service shutdown rejects port inspection failure','stop_service http 80',{LSOF_MODE:'error'},1],
 ['service shutdown rejects process inspection failure','stop_service http 80',{PS_MODE:'error'},1],
 ['service shutdown accepts absent owned process and port','stop_service http 80',{},0],
 ['unrelated HTTP worker does not block owned shutdown','stop_service http 80',{PS_MODE:'foreign'},0],
 ['persistent worker blocks shutdown after bounded wait','stop_service http 80',{PS_MODE:'active'},1],
 ['foreign listener is not owned','port_belongs_to 80 "$RUNTIME_BASE"',{LSOF_MODE:'listener',OWNER:'/unrelated/bin/httpd'},1],
 ['owned listener is recognized','port_belongs_to 80 "$RUNTIME_BASE"',{LSOF_MODE:'listener',OWNER:'/Library/Lightem/runtime/123/bin/httpd'},0],
])test(name,()=>{const f=execute(cmd,env);try{assert.equal(f.r.status,status,f.r.stdout+f.r.stderr);if(env.PS_MODE==='active')assert.equal(fs.readFileSync(path.join(f.fixture,'ps-calls'),'utf8').trim(),'30');}finally{f.clean();}});
test('shutdown waits for remaining workers after port closes',()=>{const f=execute('stop_service http 80',{PS_MODE:'delayed'});try{assert.equal(f.r.status,0,f.r.stderr);assert.equal(fs.readFileSync(path.join(f.fixture,'ps-calls'),'utf8').trim(),'4');assert.equal(fs.readFileSync(path.join(f.fixture,'sleeps'),'utf8').trim(),'3');}finally{f.clean();}});
const cases=[
 ['empty device is fresh','none',[],[],false,'fresh',0],
 ['recognized interrupted fresh setup resumes','pending-fresh',['api/partial.php'],['mysql/placeholder'],false,'fresh',0],
 ['ready store without backend marker is preserved and rejected','ready',[],['mysql/placeholder'],false,'',42],
 ['backend marker without protected state is rejected','none',['.lightem-managed-install.json'],[],false,'',42],
 ['existing standalone store is updated','ready',['.lightem-managed-install.json'],['mysql/placeholder'],false,'update',0],
 ['committed pending fresh store resumes as update','pending-fresh',['.lightem-managed-install.json'],['mysql/placeholder'],false,'update',0],
 ['recognized interrupted migration resumes','pending-legacy',['api/partial.php'],['mysql/placeholder'],true,'migrate',0],
 ['interrupted migration without original source stops','pending-legacy',['api/partial.php'],['mysql/placeholder'],false,'',42],
 ['unrelated private backend is preserved','none',['unrelated.txt'],[],false,'',42],
 ['unrecognized private database is preserved','none',[],['existing-store/sale'],false,'',42],
 ['legacy source enters migration','none',[],[],true,'migrate',0],
 ['legacy source cannot replace unrelated private data','none',[],['existing-store/sale'],true,'',42],
];
for(const [name,phase,webfiles,datafiles,legacy,mode,status]of cases)test(name,()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lightem-mac-classify-'));try{
 const web=path.join(dir,'backend'),data=path.join(dir,'data'),old=path.join(dir,'legacy');fs.mkdirSync(web);fs.mkdirSync(data);
 for(const [root,files]of [[web,webfiles],[data,datafiles],[old,legacy?['htdocs/api/bootstrap.php','htdocs/.env']:[]]])for(const file of files){const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'preserve\n');}
 const script=stubs+'\n'+block('CLASSIFICATION')+'\ninstallation_phase(){ printf "%s" "$FIXTURE_PHASE"; };\nMODE=fresh; classify_installation; printf "%s" "$MODE"';
 const r=spawnSync('/bin/bash',['-eu','-o','pipefail','-c',script],{env:{...process.env,STATE:dir,WEBROOT:web,DATA:data,LEGACY:old,FIXTURE_PHASE:phase},encoding:'utf8'});
 assert.equal(r.status,status,r.stdout+r.stderr);if(status===0)assert.equal(r.stdout,mode);
 for(const [root,files]of[[web,webfiles],[data,datafiles]])for(const file of files)assert.equal(fs.readFileSync(path.join(root,file),'utf8'),'preserve\n');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
const safePath=source.slice(source.indexOf('safe_path() {'),source.indexOf('# BEGIN STANDALONE PROCESS CHECKS'));
const ownershipCode=block('SERVICE OWNERSHIP').replaceAll('/bin/launchctl','fixture_launchctl').replaceAll('/usr/bin/stat','fixture_stat').replace('plist="/Library/LaunchDaemons/$label.plist"','plist="$SERVICE_DIR/$label.plist"');
const phpBinary=path.resolve(__dirname,'../cache/standalone-runtime/darwin/bin/php');
function serviceFixture(options={}){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'lightem-owned-service-')));const kind=options.kind||'http',label='com.lightem.standalone.'+kind;
 const executable='/Library/Lightem/runtime/20260926120000/bin/'+(kind==='http'?'httpd':'mysqld');
 const plist={Label:label,UserName:kind==='http'?'root':'_lightemdb',ProgramArguments:kind==='http'?[executable,'-f',dir+'/config/httpd.conf','-DFOREGROUND']:[executable,'--defaults-file='+dir+'/config/database.cnf']};
 if(options.mutate)options.mutate(plist);
 const file=path.join(dir,label+'.plist');if(!options.missing)fs.writeFileSync(file,JSON.stringify(plist));
 if(options.symlink){fs.renameSync(file,file+'.target');fs.symlinkSync(file+'.target',file);}
 const script=stubs+'\n'+productionTrap+safePath+'\n'+ownershipCode+String.raw`
run_php(){ "$PHP_BINARY" -n "$@"; }
fixture_stat(){ printf '%s' "$METADATA"; }
fixture_launchctl(){
 [ "$1" = print ] || exit 99
 case "$LOADED" in absent) return 113;; error) return 5;; esac
 printf '    program = %s\n' "$LOADED_PROGRAM"
}
validate_service_ownership "$SERVICE_KIND"
`;
 const r=spawnSync('/bin/bash',['-Eeu','-o','pipefail','-c',script],{env:{...process.env,PHP_BINARY:phpBinary,SERVICE_DIR:dir,STATE:dir,RUNTIME_BASE:'/Library/Lightem/runtime',SERVICE_KIND:kind,METADATA:options.metadata||'0:644',LOADED:options.loaded||'absent',LOADED_PROGRAM:options.loadedProgram||executable},encoding:'utf8'});
 return {r,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
for(const [name,opts,expected]of[
 ['absent service and plist are safe for a fresh install',{missing:true},0],
 ['loaded service without an owned plist is rejected',{missing:true,loaded:'present'},42],
 ['root-owned expected HTTP service is accepted',{loaded:'present'},0],
 ['root-owned expected database service is accepted',{kind:'database',loaded:'present'},0],
 ['root-owned unloaded HTTP service is accepted',{},0],
 ['root-owned unloaded database service is accepted',{kind:'database'},0],
 ['foreign-owned service plist is rejected',{metadata:'501:644'},42],
 ['group-writable service plist is rejected',{metadata:'0:664'},42],
 ['redirected service plist is rejected',{symlink:true},42],
 ['service inspection failure is rejected',{loaded:'error'},42],
 ['different loaded executable is rejected',{loaded:'present',loadedProgram:'/unrelated/httpd'},42],
 ['unexpected service label is rejected',{mutate:p=>{p.Label='another.service';}},42],
 ['unexpected service account is rejected',{mutate:p=>{p.UserName='somebody';}},42],
 ['foreign executable in service plist is rejected',{mutate:p=>{p.ProgramArguments[0]='/unrelated/httpd';}},42],
 ['unexpected config argument is rejected',{mutate:p=>{p.ProgramArguments[2]='/unrelated/httpd.conf';}},42],
 ['additional startup arguments are rejected',{mutate:p=>{p.ProgramArguments.push('-DUNEXPECTED');}},42],
])test(name,{skip:!fs.existsSync(phpBinary)},()=>{const f=serviceFixture(opts);try{assert.equal(f.r.status,expected,f.r.stdout+f.r.stderr);if(expected===0)assert.equal(f.r.stderr,'');}finally{f.clean();}});
for(const [mode,expected] of [['empty',0],['listener',0],['error',42]])test(`port inspection preserves ${mode} status with the installer ERR trap`,()=>{
 const script=stubs+'\n'+productionTrap+processCode+'\nlisteners=$(port_pids 3307); printf "%s" "$listeners"';
 const r=spawnSync('/bin/bash',['-Eeu','-o','pipefail','-c',script],{env:{...process.env,LSOF_MODE:mode},encoding:'utf8'});
 assert.equal(r.status,expected,r.stdout+r.stderr);
 if(expected===0){assert.equal(r.stderr,'');assert.equal(r.stdout,mode==='empty'?'':'500');}
 else assert.match(r.stderr,/Cannot inspect local service ports/);
});
const accountCode=block('ACCOUNTS').replaceAll('/usr/bin/dscl','fixture_dscl');
for(const [name,owner,mode,expected] of [
 ['large owned process listing','/Library/Lightem/runtime/123/bin/httpd','large','owned'],
 ['large unrelated process listing','/unrelated/httpd','large','rejected'],
 ['failed executable inspection','/Library/Lightem/runtime/123/bin/httpd','error','rejected'],
])test(`production ERR trap handles ${name} without a false failure`,()=>{
 const script=stubs+'\n'+productionTrap+processCode+'\nif port_belongs_to 80 "$RUNTIME_BASE"; then printf owned; else printf rejected; fi';
 const r=spawnSync('/bin/bash',['-Eeu','-o','pipefail','-c',script],{env:{...process.env,LSOF_MODE:'listener',LSOF_TEXT_MODE:mode,OWNER:owner,RUNTIME_BASE:'/Library/Lightem/runtime'},encoding:'utf8',timeout:10000});
 assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(r.stdout,expected);assert.equal(r.stderr,'');
});
for(const failure of ['users','groups'])test(`service account ${failure} inventory failure performs no mutation`,()=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'lightem-account-safety-')));try{
 const script=stubs+'\n'+safePath+'\n'+accountCode+String.raw`
fixture_dscl(){
 if [ "$2" = -list ]; then
  if [ "$FAILURE" = users ] && [ "$3" = /Users ]; then return 5; fi
  if [ "$FAILURE" = groups ] && [ "$3" = /Groups ]; then return 5; fi
  printf 'root 0\n';return 0
 fi
 printf 'MUTATION' > "$STATE/mutation";return 0
}
ensure_service_account _lightemhttp
`;
 const r=spawnSync('/bin/bash',['-eu','-o','pipefail','-c',script],{env:{...process.env,STATE:dir,FAILURE:failure},encoding:'utf8'});
 assert.equal(r.status,42,r.stdout+r.stderr);assert.equal(fs.existsSync(path.join(dir,'mutation')),false);assert.equal(fs.existsSync(path.join(dir,'accounts')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
