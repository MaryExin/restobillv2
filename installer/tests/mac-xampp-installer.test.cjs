const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const quote = value => `'${value.replace(/'/g, `'\\''`)}'`;
const macOnly = { skip: process.platform !== 'darwin' };

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lightem-vendor-permissions-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = await fs.readFile(path.join(__dirname, '../mac/postinstall'), 'utf8');
  const start = source.indexOf('# BEGIN XAMPP INSTALLER');
  const end = source.indexOf('# END XAMPP INSTALLER');
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  const vendor = path.join(root, 'vendor installer');
  await fs.writeFile(vendor, `#!/bin/bash
set -eu
printf '%s\\n' "$@" > "$FIXTURE_ROOT/arguments"
mkdir "$FIXTURE_ROOT/xamppfiles"
ln -s xamppfiles "$FIXTURE_ROOT/shortcut"
echo public > "$FIXTURE_ROOT/xamppfiles/manager-info"
exit "$FIXTURE_EXIT"
`, { mode: 0o700 });
  return {
    root,
    run(exitCode = 0) {
      return spawnSync('/bin/bash', ['-c', `
set -u
umask 077
${block}
run_xampp_installer ${quote(vendor)}
status=$?
echo secret > "$FIXTURE_ROOT/private-settings"
mkdir "$FIXTURE_ROOT/private-backup"
exit "$status"
`], { encoding: 'utf8', env: { ...process.env, FIXTURE_ROOT: root, FIXTURE_EXIT: String(exitCode) } });
    },
  };
}

test('fresh XAMPP receives usable public permissions while installer secrets stay private', macOnly, async t => {
  const f = await fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await fs.stat(path.join(f.root, 'xamppfiles'))).mode & 0o777, 0o755);
  assert.equal((await fs.lstat(path.join(f.root, 'shortcut'))).mode & 0o777, 0o755);
  assert.equal((await fs.stat(path.join(f.root, 'xamppfiles/manager-info'))).mode & 0o777, 0o644);
  assert.equal((await fs.stat(path.join(f.root, 'private-settings'))).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.join(f.root, 'private-backup'))).mode & 0o777, 0o700);
  assert.equal(await fs.readFile(path.join(f.root, 'arguments'), 'utf8'), '--mode\nunattended\n--unattendedmodeui\nnone\n');
});

test('failed XAMPP installation retains its failure and private parent permissions', macOnly, async t => {
  const f = await fixture(t);
  const result = f.run(37);
  assert.equal(result.status, 37, result.stderr);
  assert.equal((await fs.stat(path.join(f.root, 'private-settings'))).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.join(f.root, 'private-backup'))).mode & 0o777, 0o700);
});
