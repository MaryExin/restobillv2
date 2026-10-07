'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {inventory,treeDigest}=require('./prepare.cjs');
const php=process.env.LIGHTEM_TEST_PHP || path.resolve(__dirname,'../cache/standalone-runtime/darwin/bin/php');
const available=fs.existsSync(php);
function fixture() {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lightem-runtime-integrity-'));
 fs.mkdirSync(path.join(root,'bin'));fs.writeFileSync(path.join(root,'bin/server'),'server binary fixture\n');
 const files=inventory(root),digest=treeDigest(files);
 const manifest={schemaVersion:1,id:'lightem-server-8.2.4-1',platform:'darwin',arch:'x64',sha256:digest,files};
 fs.writeFileSync(path.join(root,'runtime-manifest.json'),JSON.stringify(manifest));
 return {root,digest,manifest};
}
function verify(f) {return spawnSync(php,['-n',path.join(__dirname,'verify.php'),'--root',f.root,'--sha256',f.digest,'--platform','darwin'],{encoding:'utf8'});}
for(const [name,change,expected] of [
 ['accepts matching files and pinned inventory',()=>{},0],
 ['rejects changed runtime bytes',f=>fs.writeFileSync(path.join(f.root,'bin/server'),'tampered\n'),1],
 ['rejects a missing runtime file',f=>fs.unlinkSync(path.join(f.root,'bin/server')),1],
 ['rejects an unlisted executable',f=>fs.writeFileSync(path.join(f.root,'bin/unlisted'),'unexpected'),1],
 ['rejects a runtime symlink',f=>fs.symlinkSync('server',path.join(f.root,'bin/linked')),1],
 ['rejects a forged inventory even when files match',f=>{f.manifest.files['bin/server'].sha256='0'.repeat(64);fs.writeFileSync(path.join(f.root,'runtime-manifest.json'),JSON.stringify(f.manifest));},1],
 ['rejects the wrong platform',f=>{f.manifest.platform='win32';fs.writeFileSync(path.join(f.root,'runtime-manifest.json'),JSON.stringify(f.manifest));},1],
])test(name,{skip:!available},()=>{const f=fixture();try{change(f);const r=verify(f);assert.equal(r.status,expected,r.stdout+r.stderr);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
test('build inventory rejects symbolic links',()=>{const f=fixture();try{fs.symlinkSync('server',path.join(f.root,'bin/link'));assert.throws(()=>inventory(f.root),/Symlinks/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}});
