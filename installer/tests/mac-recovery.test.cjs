const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const macOnly = { skip: process.platform !== 'darwin' };
const quote = value => `'${value.replace(/'/g, `'\\''`)}'`;
const completeFiles = ['api/bootstrap.php', 'api/read_transaction_records.php', 'api/login.php', 'api/pos_lan_health.php', 'api/config.php', 'src/Database.php', 'src/JWTCodec.php', 'src/UserGateway.php', 'vendor/autoload.php', '.env'];

async function fixture(t, files = [], exitCode = 0) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lightem-mac-recovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const webroot = path.join(root, 'htdocs');
  await fs.mkdir(webroot);
  for (const name of files) {
    await fs.mkdir(path.dirname(path.join(webroot, name)), { recursive: true });
    await fs.writeFile(path.join(webroot, name), `original ${name}`);
  }
  const fakePhp = path.join(root, 'fixture-php');
  await fs.writeFile(fakePhp, `#!/bin/bash
printf '%s\\n' "$1" >> "$EVENTS"
exit ${exitCode}
`, { mode: 0o700 });
  const source = await fs.readFile(path.join(__dirname, '../mac/postinstall'), 'utf8');
  const start = source.indexOf('# BEGIN BACKEND CLASSIFICATION');
  const end = source.indexOf('# END BACKEND CLASSIFICATION');
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  function run(body = '') {
    return spawnSync('/bin/bash', ['-c', `
set -Eeuo pipefail
WEBROOT=${quote(webroot)}
STATE=${quote(path.join(root, 'state'))}
PHP=${quote(fakePhp)}
PAYLOAD=${quote(path.join(root, 'payload'))}
BACKUP=${quote(path.join(root, 'backup'))}
RUN_ID=20260926100000-123
RECOVERY=''
RECOVERED_SETTINGS=0
export EVENTS=${quote(path.join(root, 'events'))}
step() { :; }
die() { printf '%s\\n' "$*" >&2; exit 1; }
${block}
prepare_existing_backend
printf 'STATE %s %s\\n' "$EXISTING" "$RECOVERED_SETTINGS"
${body}
`], { encoding: 'utf8' });
  }
  async function calls() {
    try { return (await fs.readFile(path.join(root, 'events'), 'utf8')).trim().split('\n').map(value => path.basename(value)); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  return { root, webroot, run, calls };
}

test('Mac clean web root follows fresh setup without looking for old settings', macOnly, async t => {
  const f = await fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /STATE 0 0/);
  assert.deepEqual(await f.calls(), []);
});

test('Mac marker-only installation requests recovery without modifying the original files', macOnly, async t => {
  const f = await fixture(t, ['.lightem-managed-install.json']);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /STATE 1 1/);
  assert.deepEqual(await f.calls(), ['recover.php']);
  assert.deepEqual(await fs.readdir(f.webroot), ['.lightem-managed-install.json']);
});

test('Mac partial managed backend with surviving settings requests repair', macOnly, async t => {
  const f = await fixture(t, ['.lightem-managed-install.json', '.env', 'api/config.php']);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /STATE 1 1/);
  assert.deepEqual(await f.calls(), ['recover.php']);
});

test('Mac complete backend verifies normally even when the desktop app is absent', macOnly, async t => {
  const f = await fixture(t, completeFiles);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /STATE 1 0/);
  assert.deepEqual(await f.calls(), ['verify.php']);
});

test('Mac managed backend missing its transaction endpoint enters repair', macOnly, async t => {
  const f = await fixture(t, [...completeFiles.filter(file => file !== 'api/read_transaction_records.php'), '.lightem-managed-install.json']);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /STATE 1 1/);
  assert.deepEqual(await f.calls(), ['recover.php']);
});

test('Mac recovery rejects a linked staging parent before changing its target permissions', macOnly, async t => {
  const f = await fixture(t, ['.lightem-managed-install.json']);
  const target = path.join(f.root, 'outside');
  await fs.mkdir(target, { mode: 0o755 });
  await fs.chmod(target, 0o755);
  await fs.mkdir(path.join(f.root, 'state'));
  await fs.symlink(target, path.join(f.root, 'state/recovery'));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /symbolic link/);
  assert.equal((await fs.stat(target)).mode & 0o777, 0o755);
  assert.deepEqual(await f.calls(), []);
});

test('Mac recovery failure stops before setup can mark the backend as ready', macOnly, async t => {
  const f = await fixture(t, ['.lightem-managed-install.json'], 17);
  const result = f.run('touch "$WEBROOT/should-not-exist"');
  assert.equal(result.status, 17);
  assert.doesNotMatch(result.stdout, /STATE/);
  assert.deepEqual(await fs.readdir(f.webroot), ['.lightem-managed-install.json']);
});

test('Mac unmarked partial backend is rejected without invoking recovery', macOnly, async t => {
  const f = await fixture(t, ['api/unrelated.php']);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unrelated or incomplete/);
  assert.deepEqual(await f.calls(), []);
});

test('Mac recovered configuration is applied only after the original state is backed up', macOnly, async t => {
  const f = await fixture(t, ['.lightem-managed-install.json']);
  const result = f.run(`
mkdir -p "$BACKUP/backend" "$WEBROOT/api" "$RECOVERY/api"
cp "$WEBROOT/.lightem-managed-install.json" "$BACKUP/backend/"
printf 'recovered environment' > "$RECOVERY/.env"
printf 'recovered config' > "$RECOVERY/api/config.php"
restore_existing_settings
`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await fs.readFile(path.join(f.webroot, '.env'), 'utf8'), 'recovered environment');
  assert.equal(await fs.readFile(path.join(f.webroot, 'api/config.php'), 'utf8'), 'recovered config');
  assert.deepEqual(await fs.readdir(path.join(f.root, 'backup/backend')), ['.lightem-managed-install.json']);
});
