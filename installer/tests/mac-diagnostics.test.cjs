const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourcePath = path.join(__dirname, '../mac/postinstall');
const shellQuote = value => `'${value.replace(/'/g, `'\\''`)}'`;
const macOnly = { skip: process.platform !== 'darwin' };

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lightem-mac-diagnostics-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = await fs.readFile(sourcePath, 'utf8');
  const start = source.indexOf('# BEGIN SETUP DIAGNOSTICS');
  const end = source.indexOf('# END SETUP DIAGNOSTICS');
  assert.ok(start >= 0 && end > start, 'The isolated diagnostics block must exist');
  const diagnostics = source.slice(start, end);
  const shutdown = source.slice(source.indexOf('# BEGIN APACHE SHUTDOWN'), source.indexOf('# END APACHE SHUTDOWN'));
  const run = (body) => spawnSync('/bin/bash', ['-c', `
set -Eeuo pipefail
umask 077
STATE=${shellQuote(root)}
LOG="$STATE/private.log"
ERROR_SUMMARY="$STATE/summary.txt"
BACKUP="$STATE/backup"
XAMPP="$STATE/xampp"
WEBROOT="$STATE/webroot"
APP="$STATE/Lightem Pos.app"
STEP='Checking setup package and device'
MOUNT=''
CHANGED=0
EXISTING=0
PROVISIONED=0
SERVICES_TOUCHED=0
APACHE_WAS_RUNNING=0
MYSQL_WAS_RUNNING=0
APACHE_STOP_REQUESTED=0
exec 3>&2
exec >>"$LOG" 2>&1
${shutdown}
# These isolated tests never inspect or stop the host's Apache.
apache_listener_present() { return 1; }
apache_processes_present() { return 1; }
${diagnostics}
${body}
`], { encoding: 'utf8' });
  return { root, run };
}

test('Mac explicit errors reach Installer stderr and a protected summary', macOnly, async t => {
  const { root, run } = await fixture(t);
  const result = run("step 'Checking XAMPP installation'; die 'This setup requires XAMPP 8.2.4-0.'");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Lightem setup failed during: Checking XAMPP installation/);
  assert.match(result.stderr, /This setup requires XAMPP 8.2.4-0/);
  assert.equal(result.stdout, '');
  const summary = await fs.readFile(path.join(root, 'summary.txt'), 'utf8');
  assert.equal(summary, result.stderr);
  assert.equal((await fs.stat(path.join(root, 'summary.txt'))).mode & 0o777, 0o600);
  assert.match(await fs.readFile(path.join(root, 'private.log'), 'utf8'), /Setup stopped/);
});

test('Mac unexpected failures preserve exit status without exposing command output', macOnly, async t => {
  const { root, run } = await fixture(t);
  const result = run(`
step 'Configuring backend and databases'
failing_operation() { echo 'password=private-fixture-value'; return 37; }
failing_operation
`);
  assert.equal(result.status, 37);
  assert.match(result.stderr, /Configuring backend and databases/);
  assert.match(result.stderr, /exit 37/);
  assert.doesNotMatch(result.stderr, /private-fixture-value|failing_operation/);
  assert.match(await fs.readFile(path.join(root, 'private.log'), 'utf8'), /password=private-fixture-value/);
  assert.doesNotMatch(await fs.readFile(path.join(root, 'summary.txt'), 'utf8'), /private-fixture-value/);
});

test('Mac rollback continues after cleanup failures and retains the initial error', macOnly, async t => {
  const { root, run } = await fixture(t);
  const backendParts = ['api', 'src', 'vendor', '.env', '.htaccess', '.lightem-managed-install.json'];
  await fs.mkdir(path.join(root, 'backup/backend'), { recursive: true });
  await fs.mkdir(path.join(root, 'backup/Lightem Pos.app'), { recursive: true });
  await fs.mkdir(path.join(root, 'webroot'));
  await fs.mkdir(path.join(root, 'xampp'));
  for (const part of backendParts) await fs.writeFile(path.join(root, 'backup/backend', part), `previous ${part}`);
  await fs.writeFile(path.join(root, 'backup/Lightem Pos.app', 'app-fixture'), 'previous app');
  await fs.writeFile(path.join(root, 'xampp/xampp'), '#!/bin/bash\nprintf "%s\\n" "$1" >> "${0%/*}/calls"\n[ "$1" = stopapache ] && exit 0\nexit 63\n', { mode: 0o700 });
  const result = run(`
CHANGED=1
EXISTING=1
SERVICES_TOUCHED=1
APACHE_WAS_RUNNING=1
# Simulate an unsuccessful removal; restoration and later services still run.
rm() { printf '%s\\n' "$*" >> "$STATE/removals"; return 62; }
step 'Installing the POS application'
/bin/bash -c 'exit 37'
`);
  assert.equal(result.status, 37);
  assert.match(result.stderr, /exit 37/);
  for (const part of backendParts) {
    assert.equal(await fs.readFile(path.join(root, 'webroot', part), 'utf8'), `previous ${part}`);
  }
  assert.equal(await fs.readFile(path.join(root, 'Lightem Pos.app/app-fixture'), 'utf8'), 'previous app');
  assert.equal(await fs.readFile(path.join(root, 'xampp/calls'), 'utf8'), 'stopapache\nstartapache\nstopmysql\n');
  assert.equal((await fs.readFile(path.join(root, 'removals'), 'utf8')).trim().split('\n').length, 7);
});

test('Mac rollback preserves live files and backups when Apache shutdown cannot be verified', macOnly, async t => {
  const { root, run } = await fixture(t);
  await fs.mkdir(path.join(root, 'backup/backend'), { recursive: true });
  await fs.mkdir(path.join(root, 'backup/Lightem Pos.app'), { recursive: true });
  await fs.mkdir(path.join(root, 'Lightem Pos.app'));
  await fs.mkdir(path.join(root, 'webroot'));
  await fs.mkdir(path.join(root, 'xampp'));
  await fs.writeFile(path.join(root, 'backup/backend/api'), 'previous backend');
  await fs.writeFile(path.join(root, 'webroot/api'), 'current backend');
  await fs.writeFile(path.join(root, 'backup/Lightem Pos.app/app-fixture'), 'previous app');
  await fs.writeFile(path.join(root, 'Lightem Pos.app/app-fixture'), 'current app');
  await fs.writeFile(path.join(root, 'xampp/xampp'), '#!/bin/bash\nprintf "%s\\n" "$1" >> "${0%/*}/calls"\nexit 0\n', { mode: 0o700 });
  const result = run(`
CHANGED=1
EXISTING=1
SERVICES_TOUCHED=1
APACHE_WAS_RUNNING=1
apache_processes_present() { return 3; }
/bin/bash -c 'exit 37'
`);
  assert.equal(result.status, 37);
  assert.equal(await fs.readFile(path.join(root, 'webroot/api'), 'utf8'), 'current backend');
  assert.equal(await fs.readFile(path.join(root, 'backup/backend/api'), 'utf8'), 'previous backend');
  assert.equal(await fs.readFile(path.join(root, 'Lightem Pos.app/app-fixture'), 'utf8'), 'current app');
  assert.equal(await fs.readFile(path.join(root, 'backup/Lightem Pos.app/app-fixture'), 'utf8'), 'previous app');
  assert.equal(await fs.readFile(path.join(root, 'xampp/calls'), 'utf8'), 'stopapache\nstopmysql\n');
  assert.match(await fs.readFile(path.join(root, 'private.log'), 'utf8'), /Backend recovery deferred/);
});

test('Mac summary write failures still report the original failure to Installer', macOnly, async t => {
  const { root, run } = await fixture(t);
  await fs.mkdir(path.join(root, 'summary.txt'));
  const result = run("step 'Checking XAMPP installation'; /bin/bash -c 'exit 42'");
  assert.equal(result.status, 42);
  assert.match(result.stderr, /exit 42/);
  assert.match(result.stderr, /Checking XAMPP installation/);
});

test('Mac successful cleanup exits successfully without a failure summary', macOnly, async t => {
  const { root, run } = await fixture(t);
  const result = run('exit 0');
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  await assert.rejects(fs.stat(path.join(root, 'summary.txt')), { code: 'ENOENT' });
});
