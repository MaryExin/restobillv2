'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const source = fs.readFileSync(path.resolve(__dirname, '../mac-standalone/postinstall'), 'utf8');
const php = path.resolve(__dirname, '../cache/standalone-runtime/darwin/bin/php');
const available = {skip: process.platform !== 'darwin' || !fs.existsSync(php)};
const start = '# BEGIN STANDALONE INCOMPLETE DATABASE\n';
const end = '# END STANDALONE INCOMPLETE DATABASE';
assert.equal(source.split(start).length, 2);
assert.equal(source.split(end).length, 2);
const original = source.split(start)[1].split(end)[0];
assert.ok(original.includes('chown _lightemdb:_lightemdb "$DATA"'));
// Preserve the production shell and PHP checks; only use the fixture's owner.
const recovery = original.replace('chown _lightemdb:_lightemdb "$DATA"', 'chown "$FIXTURE_OWNER" "$DATA"');
const safePath = source.slice(source.indexOf('safe_path() {'), source.indexOf('# BEGIN STANDALONE PROCESS CHECKS'));
const productionTrap = source.split('\n').find(line => line.startsWith("trap 'die "));

function write(root, relative, contents = 'preserve fixture bytes\n') {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, contents);
  return file;
}
function snapshot(root) {
  const entries = [];
  function walk(file, relative) {
    const info = fs.lstatSync(file);
    const entry = {path: relative, mode: info.mode & 0o777, inode: info.ino};
    if (info.isSymbolicLink()) entry.link = fs.readlinkSync(file);
    else if (info.isDirectory()) {
      entry.directory = true;
      entries.push(entry);
      for (const name of fs.readdirSync(file).sort()) walk(path.join(file, name), path.join(relative, name));
      return;
    } else entry.bytes = fs.readFileSync(file).toString('hex');
    entries.push(entry);
  }
  walk(root, '');
  return entries;
}
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync('/private/tmp/lightem-bootstrap-recovery-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const state = path.join(root, 'Application Support', 'Lightem');
  const data = path.join(state, 'data');
  const webroot = path.join(state, 'backend');
  const backup = path.join(state, 'backups', 'attempt');
  const secret = path.join(state, 'secrets', 'database-root.txt');
  for (const directory of [data, webroot, backup, path.dirname(secret)]) fs.mkdirSync(directory, {recursive: true});
  fs.chmodSync(data, 0o700);
  const run = (env = {}) => spawnSync('/bin/bash', ['-Eeu', '-o', 'pipefail', '-c', `
umask 077
exec 3>&2
die() { printf '%s\\n' "$*" >&3; exit 42; }
say() { printf '%s\\n' "$*"; }
run_php() { "$FIXTURE_PHP" -n "$@"; }
${productionTrap}
${safePath}
${recovery}
recover_incomplete_bootstrap
`], {
    env: {...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', STATE: state,
      DATA: data, WEBROOT: webroot, BACKUP: backup, ROOT_SECRET: secret,
      PHASE: 'pending-fresh', MODE: 'fresh', FIXTURE_PHP: php,
      FIXTURE_OWNER: `${process.getuid()}:${process.getgid()}`, ...env},
    encoding: 'utf8', timeout: 10000,
  });
  return {root, state, data, webroot, backup, secret, run};
}
function succeeds(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stderr, '');
}
function rejectedUnchanged(f, expression) {
  const before = snapshot(f.root);
  const result = f.run();
  assert.ifError(result.error);
  assert.equal(result.status, 42, result.stdout + result.stderr);
  assert.match(result.stderr, expression);
  assert.deepEqual(snapshot(f.root), before, 'A rejected recovery must preserve every file, mode, and inode.');
}

test('pending fresh bootstrap archives known engine files intact and recreates a private empty datadir', available, t => {
  const f = fixture(t);
  for (const file of ['aria_log.00000001', 'aria_log_control', 'ibdata1', 'ib_logfile0', 'ib_buffer_pool', 'tc.log']) write(f.data, file, `original ${file}\0\n`);
  const before = snapshot(f.data);
  const result = f.run();
  succeeds(result);
  assert.match(result.stdout, /Preserved interrupted database initialization/);
  assert.deepEqual(snapshot(path.join(f.backup, 'incomplete-database')), before);
  assert.deepEqual(fs.readdirSync(f.data), []);
  assert.notEqual(fs.statSync(f.data).ino, before[0].inode);
  assert.equal(fs.statSync(f.data).mode & 0o777, 0o700);
  assert.equal(fs.statSync(f.data).uid, process.getuid());
  assert.equal(fs.existsSync(f.secret), false);
});

test('pending migration preserves partial mysql system tables before retrying bootstrap', available, t => {
  const f = fixture(t);
  for (const file of ['mysql/global_priv.frm', 'mysql/nested/partial', 'performance_schema/db.opt', 'sys/db.opt', 'aria_log_control']) write(f.data, file);
  const before = snapshot(f.data);
  succeeds(f.run({PHASE: 'pending-legacy', MODE: 'migrate'}));
  assert.deepEqual(snapshot(path.join(f.backup, 'incomplete-database')), before);
  assert.deepEqual(fs.readdirSync(f.data), []);
});

test('an empty datadir is left in place without creating a recovery copy', available, t => {
  const f = fixture(t);
  const before = snapshot(f.root);
  succeeds(f.run());
  assert.deepEqual(snapshot(f.root), before);
});

for (const entry of ['db_cnc_pos/sales.frm', 'reports_database/transactions.frm', 'unexpected.txt']) {
  test(`bootstrap recovery preserves and rejects unknown data ${entry}`, available, t => {
    const f = fixture(t);
    write(f.data, entry);
    rejectedUnchanged(f, /Unrecognized database files were preserved/);
  });
}

for (const entry of ['ibdata1', 'mysql/global_priv.frm']) {
  test(`bootstrap recovery rejects a linked data entry ${entry}`, available, t => {
    const f = fixture(t);
    const target = write(f.root, 'outside-store/sales', 'external store bytes\n');
    fs.mkdirSync(path.dirname(path.join(f.data, entry)), {recursive: true});
    fs.symlinkSync(target, path.join(f.data, entry));
    rejectedUnchanged(f, /Unrecognized database files were preserved/);
  });
}

test('bootstrap recovery rejects a redirected datadir without moving the link or its target', available, t => {
  const f = fixture(t);
  const target = path.join(f.root, 'outside-data');
  write(target, 'aria_log_control');
  fs.rmdirSync(f.data);
  fs.symlinkSync(target, f.data);
  rejectedUnchanged(f, /installation path is a symbolic link/);
});

for (const entry of ['.env', 'api/config.php', '.lightem-managed-install.json']) {
  test(`bootstrap recovery preserves backend evidence ${entry}`, available, t => {
    const f = fixture(t);
    write(f.data, 'aria_log_control');
    write(f.webroot, entry);
    rejectedUnchanged(f, /Private backend files were preserved/);
  });
}

for (const options of [
  {name: 'existing administrator secret', secret: true},
  {name: 'linked administrator secret', linkedSecret: true},
  {name: 'ready installation', env: {PHASE: 'ready'}},
  {name: 'update mode', env: {MODE: 'update'}},
  {name: 'unmarked installation', env: {PHASE: 'none'}},
]) {
  test(`bootstrap recovery does not archive: ${options.name}`, available, t => {
    const f = fixture(t);
    write(f.data, 'aria_log_control');
    if (options.secret) write(path.dirname(f.secret), path.basename(f.secret), 'existing credential fixture\n');
    if (options.linkedSecret) fs.symlinkSync(path.join(f.root, 'missing-secret'), f.secret);
    const before = snapshot(f.root);
    succeeds(f.run(options.env));
    assert.deepEqual(snapshot(f.root), before);
  });
}

test('bootstrap recovery never replaces an existing recovery destination', available, t => {
  const f = fixture(t);
  write(f.data, 'aria_log_control');
  write(f.backup, 'incomplete-database/original-backup');
  rejectedUnchanged(f, /recovery destination already exists/);
});

test('bootstrap recovery rejects a redirected recovery destination', available, t => {
  const f = fixture(t);
  write(f.data, 'aria_log_control');
  const target = path.join(f.root, 'outside-backup');
  fs.mkdirSync(target);
  fs.symlinkSync(target, path.join(f.backup, 'incomplete-database'));
  rejectedUnchanged(f, /installation path is a symbolic link/);
});
