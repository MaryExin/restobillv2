'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const php = process.env.LIGHTEM_TEST_PHP || path.resolve(__dirname, '../cache/standalone-runtime/darwin/bin/php');
const helper = path.resolve(__dirname, '../common/phpmyadmin-config.php');
function fixture(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-pma-config-')));
  t.after(() => fs.rmSync(base, {recursive:true, force:true}));
  const root = path.join(base, 'browser'), temp = path.join(base, 'private temp'), secret = path.join(base, 'secret.txt');
  fs.mkdirSync(root); fs.mkdirSync(temp); fs.writeFileSync(path.join(root, 'index.php'), '<?php');
  const run = () => spawnSync(php, ['-n', helper, '--root',root,'--temp-dir',temp,'--secret-file',secret], {encoding:'utf8'});
  const config = () => {
    const result = spawnSync(php, ['-n','-r','require $argv[1]; echo json_encode($cfg, JSON_THROW_ON_ERROR);',path.join(root,'config.inc.php')], {encoding:'utf8'});
    assert.equal(result.status,0,result.stderr); return JSON.parse(result.stdout);
  };
  return {base,root,temp,secret,run,config};
}
test('browser configuration requires credentials and disables automatic database storage', t => {
  const f=fixture(t), result=f.run(); assert.equal(result.status,0,result.stderr);
  const config=f.config(), server=config.Servers['1'];
  assert.equal(server.auth_type,'cookie'); assert.equal(server.host,'127.0.0.1'); assert.equal(server.port,'3307');
  assert.equal(server.AllowNoPassword,false); assert.equal(config.AllowArbitraryServer,false);
  assert.equal(config.ZeroConf,false); assert.equal(config.TempDir,f.temp); assert.equal(config.VersionCheck,false);
  for(const field of ['user','password','controluser','controlpass','pmadb'])assert.equal(Object.hasOwn(server,field),false);
  assert.equal(config.blowfish_secret.length,32); assert.equal(config.LoginCookieStore,0);
  assert.equal(fs.statSync(f.secret).mode & 0o777,0o600);
  assert.equal(fs.statSync(path.join(f.root,'config.inc.php')).mode & 0o777,0o600);
  assert.equal(result.stdout.includes(config.blowfish_secret),false);
});
test('updates preserve the cookie key and generate different keys on separate devices',t=>{
  const a=fixture(t),b=fixture(t); assert.equal(a.run().status,0); const first=a.config();
  assert.equal(a.run().status,0); assert.deepEqual(a.config(),first);
  assert.equal(b.run().status,0); assert.notEqual(a.config().blowfish_secret,b.config().blowfish_secret);
});
test('invalid existing key is preserved and setup stops before replacing configuration',t=>{
  const f=fixture(t);fs.writeFileSync(f.secret,'invalid key');fs.writeFileSync(path.join(f.root,'config.inc.php'),'existing configuration');
  assert.notEqual(f.run().status,0);assert.equal(fs.readFileSync(f.secret,'utf8'),'invalid key');
  assert.equal(fs.readFileSync(path.join(f.root,'config.inc.php'),'utf8'),'existing configuration');
});
for(const target of ['secret','config','parent'])test('configuration refuses redirected '+target+' path',t=>{
  const f=fixture(t),outside=path.join(f.base,'preserve');fs.writeFileSync(outside,'preserve');
  if(target==='secret')fs.symlinkSync(outside,f.secret);
  else if(target==='config')fs.symlinkSync(outside,path.join(f.root,'config.inc.php'));
  else {fs.renameSync(f.root,f.root+'-real');fs.symlinkSync(f.root+'-real',f.root);}
  assert.notEqual(f.run().status,0);assert.equal(fs.readFileSync(outside,'utf8'),'preserve');
});
