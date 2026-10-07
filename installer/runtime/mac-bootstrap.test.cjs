'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const runtime = path.resolve(__dirname, '../cache/standalone-runtime/darwin');
const bootstrap = path.join(runtime, 'bin/mysql_install_db');
const nativeAvailable = process.platform === 'darwin' && fs.existsSync(bootstrap);
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync('/private/tmp/lightem-bootstrap-regression-'));
  const data = path.join(root, 'Application Support', 'Lightem Store', 'data');
  const state = path.dirname(data);
  const databaseTemp = path.join(state, 'run/database/tmp');
  const installerTemp = path.join(root, 'PKInstallSandbox.fixture', 'tmp');
  fs.mkdirSync(data, {recursive:true});
  fs.mkdirSync(databaseTemp, {recursive:true,mode:0o700});
  fs.mkdirSync(installerTemp, {recursive:true});
  // An unprivileged fixture cannot create a root-owned directory. Mode 000
  // reproduces the same inaccessible inherited TMPDIR seen after privilege
  // drop in macOS Installer, without modifying any live service account.
  fs.chmodSync(installerTemp, 0o000);
  return {root, state, data, databaseTemp, installerTemp, clean:() => {
    fs.chmodSync(installerTemp, 0o700);
    fs.rmSync(root, {recursive:true,force:true});
  }};
}
function run(args, options = {}) {
  return spawnSync('/bin/bash', args, {
    encoding:'utf8', timeout:60000, maxBuffer:2*1024*1024,
    env:{...process.env, PATH:'/usr/bin:/bin:/usr/sbin:/sbin', PHP_INI_SCAN_DIR:''}, ...options,
  });
}
test('vendor bootstrap reproduces the spaced datadir failure when --user is supplied', {skip:!nativeAvailable}, () => {
  const f = fixture();
  try {
    const r = run([bootstrap, '--no-defaults', `--basedir=${runtime}`, `--datadir=${f.data}`,
      `--user=${os.userInfo().username}`, '--auth-root-authentication-method=normal', '--skip-test-db']);
    assert.ifError(r.error);
    assert.notEqual(r.status, 0, 'The known unquoted vendor chown must fail for an absolute path containing spaces.');
    assert.match(r.stdout+r.stderr, /chown:.*(?:No such file|does not exist)/i);
    assert.match(r.stdout+r.stderr, /Cannot change ownership of the database directories/);
    assert.equal(fs.existsSync(path.join(f.data, 'mysql/global_priv.frm')), false);
  } finally { f.clean(); }
});
test('production bootstrap helper ignores inaccessible Installer TMPDIR and initializes a spaced datadir', {skip:!nativeAvailable}, () => {
  const f = fixture();
  try {
    const source = fs.readFileSync(path.resolve(__dirname, '../mac-standalone/postinstall'), 'utf8');
    const begin = '# BEGIN STANDALONE BOOTSTRAP\n';
    const end = '# END STANDALONE BOOTSTRAP';
    assert.ok(source.includes(begin) && source.includes(end), 'The production bootstrap function must expose its test boundary.');
    const original = source.split(begin)[1].split(end)[0];
    assert.ok(original.includes('--user=_lightemdb'), 'Test only replaces the production service identity.');
    const helper = original.replace('--user=_lightemdb', '--user="$FIXTURE_USER"');
    const r = run(['-eu', '-o', 'pipefail', '-c', helper+'\nbootstrap_database\n'], {
      env:{...process.env, PATH:'/usr/bin:/bin:/usr/sbin:/sbin', RUNTIME:runtime,
        DATA:f.data, STATE:f.state, FIXTURE_USER:os.userInfo().username, TMPDIR:f.installerTemp, PHP_INI_SCAN_DIR:''},
      cwd:f.root,
    });
    assert.ifError(r.error);
    assert.equal(r.status, 0, r.stdout+r.stderr);
    assert.equal(fs.readFileSync(path.join(f.data, 'mysql_upgrade_info'), 'utf8'), '10.4.28-MariaDB');
    for (const table of ['global_priv.frm','user.frm','db.frm']) {
      assert.equal(fs.existsSync(path.join(f.data,'mysql',table)), true, `Missing initialized system table: ${table}`);
    }
    assert.equal(fs.existsSync(path.join(f.root,'mysql')), false, 'Bootstrap must write inside the selected datadir only.');
    assert.equal(fs.existsSync(path.join(f.data,'test')), false, 'Bootstrap must not create the sample test database.');
    fs.chmodSync(f.installerTemp, 0o700);
    assert.deepEqual(fs.readdirSync(f.installerTemp), [], 'The installer-owned temporary directory must not be used.');
  } finally { f.clean(); }
});

test('vendor bootstrap reproduces failure from inaccessible inherited Installer TMPDIR', {skip:!nativeAvailable}, () => {
  const f = fixture();
  try {
    const r = run([bootstrap, '--no-defaults', `--basedir=${runtime}`, '--datadir=.',
      `--user=${os.userInfo().username}`, '--auth-root-authentication-method=normal', '--skip-test-db'], {
      cwd:f.data,
      env:{...process.env, PATH:'/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR:f.installerTemp, PHP_INI_SCAN_DIR:''},
    });
    assert.ifError(r.error);
    assert.notEqual(r.status, 0, 'Bootstrap must fail when it inherits an inaccessible temporary directory.');
    assert.match(r.stdout+r.stderr, /(?:Permission denied|Errcode: 13)/i);
    assert.match(r.stdout+r.stderr, /PKInstallSandbox[.]fixture/);
    assert.equal(fs.existsSync(path.join(f.data, 'mysql_upgrade_info')), false);
  } finally { f.clean(); }
});
