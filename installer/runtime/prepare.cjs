#!/usr/bin/env node
'use strict';
// Build-time only. No services or installers are started by this module.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const CACHE = path.join(ROOT, 'installer/cache/standalone-runtime');
const LOCK = path.join(__dirname, 'sources.lock.json');
const ID = 'lightem-server-8.2.4-1';
const VERSIONS = {php:'8.2.4',apache:'2.4.56',mariadb:'10.4.28'};
const MAC_PREFIX = '/Applications/XAMPP/xamppfiles/';
const REQUIRED_EXTENSIONS = ['pdo_mysql','mysqli','mbstring','curl','openssl','fileinfo','gd','zip'];
const APACHE_MODULES = ['libphp.so','mod_authz_core.so','mod_authz_host.so','mod_authz_user.so','mod_authn_core.so','mod_authn_file.so','mod_auth_basic.so','mod_access_compat.so','mod_log_config.so','mod_mime.so','mod_dir.so','mod_alias.so','mod_headers.so','mod_rewrite.so','mod_unixd.so','mod_env.so','mod_setenvif.so','mod_ssl.so','mod_socache_shmcb.so','mod_filter.so','mod_deflate.so'];
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(file,args,options={}) {
  const r = spawnSync(file,args,{encoding:'utf8',maxBuffer:20*1024*1024,...options});
  if(r.error || r.status !== 0) throw new Error(`${path.basename(file)} failed: ${r.error?.message || r.stderr || r.stdout}`);
  return r.stdout;
}
function walk(dir,callback,base=dir) {
  for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const file=path.join(dir,e.name);
    if(e.isSymbolicLink()) throw new Error(`Symlinks are not permitted in prepared runtime: ${file}`);
    if(e.isDirectory()) walk(file,callback,base); else if(e.isFile()) callback(file,path.relative(base,file).split(path.sep).join('/'));
    else throw new Error(`Unexpected runtime entry: ${file}`);
  }
}
function inventory(dir) { const files={};walk(dir,(file,name)=>{if(name!=='runtime-manifest.json') files[name]={sha256:sha256(file),size:fs.statSync(file).size};});return files; }
function treeDigest(files) { return crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'); }
function macho(file) { const fd=fs.openSync(file,'r');const b=Buffer.alloc(4);fs.readSync(fd,b,0,4,0);fs.closeSync(fd);return ['cffaedfe','cefaedfe','cafebabe','bebafeca'].includes(b.toString('hex')); }
function dependencies(file) { return run('/usr/bin/otool',['-L',file]).split('\n').slice(file.endsWith('.dylib')?2:1).filter(s=>s.startsWith('\t')).map(s=>s.trim().split(' (compatibility version')[0]); }
function rpaths(file) { const lines=run('/usr/bin/otool',['-l',file]).split('\n');return lines.flatMap((l,i)=>l.trim()==='cmd LC_RPATH'?[lines[i+2]?.trim().replace(/^path /,'').replace(/ \(offset .*$/,'')]:[]); }
function absoluteSource(root,relative) {
  const file=path.join(root,relative), resolved=fs.realpathSync(file);
  if(!resolved.startsWith(root+path.sep)) throw new Error(`Input escapes its runtime root: ${relative}`);
  if(!fs.statSync(resolved).isFile()) throw new Error(`Runtime input is not a regular file: ${relative}`);
  return resolved;
}
function collector(root,out) {
  const inputs={};
  function copy(relative,dest=relative) {
    if(path.isAbsolute(dest)||dest.split(/[\\/]/).includes('..')) throw new Error('Unsafe runtime destination');
    const source=absoluteSource(root,relative), target=path.join(out,dest), digest=sha256(source);
    if(fs.existsSync(target)) {if(sha256(target)!==digest) throw new Error(`Colliding runtime files: ${dest}`);return;}
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
    fs.chmodSync(target,fs.statSync(source).mode&0o111?0o755:0o644);
    inputs[dest]={source:relative,sha256:digest,size:fs.statSync(source).size};
  }
  function tree(relative,dest=relative,filter=()=>true) {
    for(const e of fs.readdirSync(path.join(root,relative),{withFileTypes:true})) {
      const from=path.posix.join(relative,e.name), to=path.posix.join(dest,e.name);
      if(!filter(from,e)) continue;
      if(e.isDirectory()) tree(from,to,filter);else copy(from,to);
    }
  }
  return {copy,tree,inputs};
}
function buildMac(root,out) {
  if(process.platform!=='darwin') throw new Error('Build/relocate the Mac runtime on macOS.');
  const c=collector(root,out);
  for(const name of ['php','httpd','mysql','mysqldump','mysqladmin','my_print_defaults','resolveip','mysql_install_db']) c.copy(`bin/${name}`);
  c.copy('sbin/mysqld','bin/mysqld');
  for(const name of APACHE_MODULES)c.copy(`modules/${name}`);
  c.copy('lib/mysql/plugin/auth_pam.so');
  // XAMPP's Mac share directory includes obsolete/missing bootstrap SQL. Use
  // the matching official MariaDB source tag instead, never installed tables.
  for(const name of ['mysql_system_tables.sql','mysql_system_tables_data.sql','mysql_performance_tables.sql','fill_help_tables.sql','mysql_test_db.sql','maria_add_gis_sp.sql.in']) {
    const source=path.join(__dirname,'mariadb-10.4.28',name);
    const dest=`share/mysql/${name==='maria_add_gis_sp.sql.in'?'maria_add_gis_sp_bootstrap.sql':name}`;
    fs.mkdirSync(path.join(out,'share/mysql'),{recursive:true});
    if(name.endsWith('.in')) {
      const sql=fs.readFileSync(source,'utf8').replaceAll('@ADD_GIS_SP_SET_DELIMITER@','').replaceAll('@ADD_GIS_SP_RESET_DELIMITER@','').replaceAll('@ADD_GIS_SP_EOL@',';');
      if(/@ADD_GIS_/.test(sql))throw new Error('Unprocessed MariaDB bootstrap template.');
      fs.writeFileSync(path.join(out,dest),sql);
    }else fs.copyFileSync(source,path.join(out,dest));
    c.inputs[dest]={source:`MariaDB/server/mariadb-10.4.28/scripts/${name}`,sha256:sha256(source),size:fs.statSync(source).size};
  }
  c.tree('share/mysql/charsets');c.tree('share/mysql/english');c.tree('licenses');
  c.copy('THIRDPARTY','licenses/MARIADB-THIRDPARTY.txt');
  // Discover only the dependencies reachable from selected executables/modules.
  const visited=new Set();
  while(true) {
    const pending=[];walk(out,(file,rel)=>{if(!visited.has(rel)&&macho(file)) pending.push([file,rel]);});
    if(!pending.length)break;
    for(const [file,rel] of pending) {
      visited.add(rel);
      for(const dep of dependencies(file)) {
        if(dep.startsWith('/usr/lib/')||dep.startsWith('/System/Library/'))continue;
        let source;
        if(dep.startsWith(MAC_PREFIX)) source=dep.slice(MAC_PREFIX.length);
        else if(dep.startsWith('@rpath/')) source=`lib/${path.basename(dep)}`;
        else throw new Error(`Unapproved binary dependency in ${rel}: ${dep}`);
        c.copy(source,`lib/${path.basename(dep)}`);
      }
    }
  }
  // Change every runtime-local dylib to a relative loader path; remove vendor
  // rpaths entirely so dyld cannot fall back to a developer/XAMPP installation.
  for(const rel of visited) {
    const file=path.join(out,rel),args=[];
    for(const dep of dependencies(file)) {
      if(dep.startsWith(MAC_PREFIX)||dep.startsWith('@rpath/')) {
        const target=path.posix.join('lib',path.basename(dep));
        const loader='@loader_path/'+path.posix.relative(path.posix.dirname(rel),target);
        args.push('-change',dep,loader);
      }
    }
    for(const rpath of new Set(rpaths(file))) args.push('-delete_rpath',rpath);
    if(rel.endsWith('.dylib')) args.push('-id','@loader_path/'+path.basename(rel));
    if(args.length)run('/usr/bin/install_name_tool',[...args,file]);
    run('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',file]);
    for(const dep of dependencies(file)) {
      if(!(dep.startsWith('/usr/lib/')||dep.startsWith('/System/Library/')||dep.startsWith('@loader_path/'))) throw new Error(`Nonportable library dependency remains: ${rel}: ${dep}`);
      if(dep.startsWith('@loader_path/')&&!fs.existsSync(path.resolve(path.dirname(file),dep.slice('@loader_path/'.length)))) throw new Error(`Missing relocated dependency: ${rel}: ${dep}`);
    }
  }
  const modules=run(path.join(out,'bin/php'),['-n','-r','echo json_encode(["version"=>PHP_VERSION,"extensions"=>get_loaded_extensions()]);'],{env:{PATH:'/usr/bin:/bin',PHP_INI_SCAN_DIR:''}});
  const result=JSON.parse(modules);
  if(result.version!==VERSIONS.php||REQUIRED_EXTENSIONS.some(e=>!result.extensions.includes(e)))throw new Error('Relocated PHP version/extensions do not match the pinned runtime.');
  return c.inputs;
}
function buildWindows(root,out) {
  const c=collector(root,out);
  c.tree('apache/bin','apache/bin',(file,e)=>e.isDirectory()||/\.(exe|dll)$/i.test(file));
  c.copy('apache/conf/mime.types');
  c.copy('apache/bin/curl-ca-bundle.crt');
  c.tree('apache/modules','apache/modules',(file,e)=>e.isDirectory()||/\.so$/i.test(file));
  for(const e of fs.readdirSync(path.join(root,'php'),{withFileTypes:true})) if(e.isFile()&&/\.(dll|exe)$/i.test(e.name))c.copy(`php/${e.name}`);
  c.tree('php/ext','php/ext',(file,e)=>e.isDirectory()||/\.dll$/i.test(file));
  c.tree('mysql/bin','mysql/bin',(file,e)=>e.isDirectory()||/\.(exe|dll)$/i.test(file));
  if(fs.existsSync(path.join(root,'mysql/lib/plugin')))c.tree('mysql/lib/plugin');
  c.tree('mysql/share');
  // The portable database bundles Microsoft's app-local C/C++ runtime. PHP
  // and Apache need these too on a clean Windows computer with no VC redist.
  for(const e of fs.readdirSync(path.join(root,'mysql/bin'),{withFileTypes:true})) {
    if(e.isFile()&&/^(?:vcruntime|msvcp|concrt|ucrtbase|api-ms-win-(?:core|crt)-).*\.dll$/i.test(e.name)) {
      c.copy(`mysql/bin/${e.name}`,`php/${e.name}`);
      c.copy(`mysql/bin/${e.name}`,`apache/bin/${e.name}`);
    }
  }
  for(const part of ['apache/LICENSE.txt','apache/NOTICE.txt','php/license.txt','mysql/COPYING','mysql/THIRDPARTY']) if(fs.existsSync(path.join(root,part))) c.copy(part,`licenses/${part.replaceAll('/','-')}`);
  if(fs.existsSync(path.join(root,'licenses')))c.tree('licenses');
  for(const rel of ['apache/bin/httpd.exe','php/php.exe','php/php8apache2_4.dll','mysql/bin/mysqld.exe','mysql/bin/mysql.exe','mysql/bin/mysqldump.exe','mysql/bin/mysql_install_db.exe']) if(!fs.existsSync(path.join(out,rel)))throw new Error(`Runtime component is missing: ${rel}`);
  return c.inputs;
}
function seed({platform,source,acceptLock=false}) {
  if(!['darwin','win32'].includes(platform))throw new Error('Use darwin or win32.');
  const root=fs.realpathSync(source);fs.mkdirSync(CACHE,{recursive:true});
  const temporary=fs.mkdtempSync(path.join(CACHE,`.${platform}-`)),out=path.join(temporary,'runtime');fs.mkdirSync(out);
  try {
    const inputs=platform==='darwin'?buildMac(root,out):buildWindows(root,out);
    const locks=fs.existsSync(LOCK)?JSON.parse(fs.readFileSync(LOCK,'utf8')):{schemaVersion:1,id:ID,versions:VERSIONS,platforms:{}};
    const current=locks.platforms[platform];
    if(current&&JSON.stringify(current.files)!==JSON.stringify(inputs)&&!acceptLock)throw new Error('Runtime source hashes changed. Review the input before using --accept-source-lock.');
    if(!current&&!acceptLock)throw new Error('No pinned runtime source exists. Seed once with --accept-source-lock after reviewing the input.');
    fs.copyFileSync(path.join(__dirname,'NOTICE.md'),path.join(out,'NOTICE.md'));
    const files=inventory(out),manifest={schemaVersion:1,id:ID,platform,arch:'x64',requiresRosetta:platform==='darwin',versions:VERSIONS,extensions:REQUIRED_EXTENSIONS,sha256:treeDigest(files),files};
    if(current && current.preparedSha256!==manifest.sha256 && !acceptLock)throw new Error('Prepared runtime changed despite pinned inputs. Review the builder before accepting a new runtime lock.');
    fs.writeFileSync(path.join(out,'runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    locks.platforms[platform]={...(current?.archive?{archive:current.archive}:{}),source:platform==='darwin'?'Apache Friends XAMPP 8.2.4-0 macOS developer runtime (allowlisted code only)':'Apache Friends XAMPP 8.2.4-0 Windows portable archive',files:inputs,preparedSha256:manifest.sha256};
    if(acceptLock)fs.writeFileSync(LOCK,JSON.stringify(locks,null,2)+'\n');
    const final=path.join(CACHE,platform);fs.rmSync(final,{recursive:true,force:true});fs.renameSync(out,final);
    console.log(`Prepared independent ${platform} runtime: ${Object.keys(files).length} files, ${manifest.sha256}`);
    return manifest;
  } finally { fs.rmSync(temporary,{recursive:true,force:true}); }
}
function validateRuntime(directory,platform) {
  if(!fs.existsSync(path.join(directory,'runtime-manifest.json')))throw new Error(`Standalone ${platform} runtime cache is missing. Seed it with installer/runtime/prepare.cjs before building offline.`);
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'runtime-manifest.json'),'utf8'));
  const lock=JSON.parse(fs.readFileSync(LOCK,'utf8'));
  if(manifest.schemaVersion!==1||manifest.id!==ID||manifest.platform!==platform||manifest.arch!=='x64') throw new Error('Standalone runtime metadata is incompatible.');
  const files=inventory(directory),digest=treeDigest(files);
  if(digest!==manifest.sha256||digest!==lock.platforms[platform]?.preparedSha256||JSON.stringify(files)!==JSON.stringify(manifest.files))throw new Error('Standalone runtime checksum mismatch; rebuild its cache from the pinned source.');
  return manifest;
}
function prepareRuntime({platform,payload,stage}) {
  const source=path.join(CACHE,platform),manifest=validateRuntime(source,platform);
  const target=path.join(payload||path.join(stage,'setup'),'runtime');
  if(fs.existsSync(target))throw new Error('Standalone runtime destination already exists.');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(source,target,{recursive:true,dereference:false});
  validateRuntime(target,platform);
  fs.copyFileSync(path.join(target,'runtime-manifest.json'),path.join(path.dirname(target),'runtime-manifest.json'));
  return {runtimeVersion:manifest.id,runtimeSha256:manifest.sha256,id:manifest.id,phpVersion:manifest.versions.php,apacheVersion:manifest.versions.apache,mariadbVersion:manifest.versions.mariadb,sha256:manifest.sha256,platform,arch:manifest.arch,requiresRosetta:manifest.requiresRosetta,directory:target};
}
if(require.main===module) {
  const args=process.argv.slice(2),opts={};const action=args.shift();
  for(let i=0;i<args.length;i++){if(args[i]==='--accept-source-lock')opts.acceptLock=true;else if(['--platform','--source'].includes(args[i])&&args[i+1])opts[args[i].slice(2)]=args[++i];else throw new Error(`Unknown argument: ${args[i]}`);}
  try {if(action==='seed')seed(opts);else if(action==='verify')console.log(validateRuntime(path.join(CACHE,opts.platform),opts.platform));else throw new Error('Use seed or verify.');}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={prepareRuntime,validateRuntime,seed,inventory,treeDigest,APACHE_MODULES,REQUIRED_EXTENSIONS};
