const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const macOnly = { skip: process.platform !== 'darwin' };
const quote = value => `'${value.replace(/'/g, `'\\''`)}'`;
const shortcuts = ['bin', 'cgi-bin', 'etc', 'htdocs', 'logs', 'manager-osx.app'];
// Exact unsigned XAMPP 8.2.4-0 wrapper; fixtures never execute its real runtime.
const stock = "#!/bin/sh\n\nruntimes_dir=$(cd \"$(dirname \"${0}\")\" && pwd)\nos_version=`uname -r`\nmachine_platform=`uname -p`\nmachine_arch=`uname -m`\nif [ \"${os_version:0:1}\" == \"6\" ];then\n    executable=\"none\"\nelif [ \"${machine_platform}\" == \"i386\" ];then\n\n  if [ \"${machine_arch}\" == \"x86_64\" ]; then\n    runtimes=\"osx-x86_64 osx-intel\"\n  else\n    runtimes=\"osx-intel osx-x86_64\"\n  fi\n  executable=none\n  for r in ${runtimes} ; do\n    if [ -f \"${runtimes_dir}/${r}\" ]; then\n      executable=${r}\n      break\n    fi\n  done\n\nelse\n    executable=\"none\"\nfi\n\nif [ \"$executable\" == \"none\" ]; then\n    echo \"The current OS X version is not supported\"\n    exit 1\nfi\n\nbasename=`basename \"${0}\"`\nabsApplicationPath=$runtimes_dir/$basename\nrequire_admin=0\n\nos_version=`uname -r`\nmachine_platform=`uname -p`\n\nif [ ! -O \"$absApplicationPath\" ] || [ x$require_admin == \"x1\" ]\nthen\n\"`dirname \\\"${0}\\\"`/Application Manager\" $executable \"$@\"\nelse \n\"`dirname \\\"${0}\\\"`/$executable\" \"$@\"\nfi\n";
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const mode = async file => (await fs.lstat(file)).mode & 0o777;

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lightem-mac-manager-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const top = path.join(root, 'XAMPP');
  const xampp = path.join(top, 'xamppfiles');
  const manager = path.join(xampp, 'manager-osx.app');
  const executableDir = path.join(manager, 'Contents/MacOS');
  const wrapper = path.join(executableDir, 'installbuilder.sh');
  const state = path.join(root, 'state');
  await fs.mkdir(executableDir, { recursive: true, mode: 0o700 });
  await fs.mkdir(path.join(manager, 'Contents/Resources'), { mode: 0o700 });
  await fs.mkdir(state, { mode: 0o700 });
  await fs.writeFile(wrapper, stock, { mode: 0o700 });
  await fs.writeFile(path.join(manager, 'Contents/Info.plist'), 'fixture info', { mode: 0o600 });
  await fs.writeFile(path.join(manager, 'Contents/Resources/installbuilder.icns'), 'fixture icon', { mode: 0o600 });
  await fs.writeFile(path.join(executableDir, 'osx-x86_64'), '#!/bin/sh\nprintf "direct-runtime:"; printf "<%s>" "$@"; printf "\\n"\n', { mode: 0o700 });
  await fs.writeFile(path.join(executableDir, 'Application Manager'), '#!/bin/sh\nprintf "authorized-runtime:"; printf "<%s>" "$@"; printf "\\n"\n', { mode: 0o700 });
  for (const part of shortcuts) {
    await fs.mkdir(path.join(xampp, part), { recursive: true, mode: 0o700 });
    await fs.symlink(`xamppfiles/${part}`, path.join(top, part));
    assert.equal(spawnSync('/bin/chmod', ['-h', '700', path.join(top, part)]).status, 0);
  }
  await fs.mkdir(path.join(xampp, 'var/mysql'), { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(xampp, 'var/mysql/store.sql'), 'private sales sentinel', { mode: 0o600 });
  await fs.writeFile(path.join(xampp, 'htdocs/.env'), 'private settings sentinel', { mode: 0o600 });
  const commands = path.join(root, 'commands');
  await fs.mkdir(commands);
  await fs.writeFile(path.join(commands, 'uname'), `#!/bin/sh
case "$1" in
-r) printf '25.0.0\\n';;
-p) printf '%s\\n' "$FIXTURE_PLATFORM";;
-m) printf '%s\\n' "$FIXTURE_ARCH";;
*) exit 2;;
esac
`, { mode: 0o700 });
  const source = await fs.readFile(path.join(__dirname, '../mac/postinstall'), 'utf8');
  const start = source.indexOf('# BEGIN XAMPP MANAGER');
  const end = source.indexOf('# END XAMPP MANAGER');
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  function repair(denyAccess = false) {
    return spawnSync('/bin/bash', ['-c', `
set -Eeuo pipefail
umask 077
XAMPP=${quote(xampp)}
STATE=${quote(state)}
die() { printf '%s\\n' "$*" >&2; exit 1; }
${block}
# Only the permission-check boundary is stubbed; no sudo, GUI or host changes.
xampp_manager_user_access() {
  printf '%s %s %s\\n' "$1" "$2" "$3" >> ${quote(path.join(root, 'access-checks'))}
  ${denyAccess ? 'return 1' : '/bin/test "$2" "$3"'}
}
repair_xampp_manager
printf 'repair-complete\\n'
`], { encoding: 'utf8' });
  }
  function launch(platform, nonOwner = false) {
    // Source the unmodified repaired script with $0 pointing to itself. Only
    // the ownership test is stubbed to exercise its administrator-helper path.
    const ownerStub = nonOwner ? 'function [() { if [[ "$1" == -O ]]; then return 1; fi; if [[ "$1" == "!" && "$2" == -O ]]; then return 0; fi; builtin [ "$@"; }' : '';
    return spawnSync('/bin/bash', ['-c', `${ownerStub}\nsource "$0"`, wrapper, 'argument with spaces'], {
      encoding: 'utf8', env: { ...process.env, PATH: `${commands}:/usr/bin:/bin`, FIXTURE_PLATFORM: platform, FIXTURE_ARCH: platform === 'i386' ? 'x86_64' : 'arm64' },
    });
  }
  return { root, top, xampp, manager, executableDir, wrapper, state, repair, launch };
}

test('Mac Manager stock arm launcher fails and repaired launcher selects the Intel runtime', macOnly, async t => {
  assert.equal(hash(stock), 'a371be1db4f6410bf23e47fde81dd9838e04b378010788c4481d8c0ef0adcae3');
  const f = await fixture(t);
  const before = f.launch('arm');
  assert.equal(before.status, 1);
  assert.match(before.stdout, /not supported/);
  const repair = f.repair();
  assert.equal(repair.status, 0, repair.stderr);
  for (const platform of ['arm', 'arm64']) {
    const after = f.launch(platform);
    assert.equal(after.status, 0, after.stderr);
    assert.equal(after.stdout, 'direct-runtime:<argument with spaces>\n');
  }
  assert.equal(hash(await fs.readFile(f.wrapper)), 'bf6097f435a575723e49d44c9936cb7fee6c38c8a084c72903f8c5397e279036');
});

test('Mac Manager retains Intel behavior and the administrator-helper path', macOnly, async t => {
  const f = await fixture(t);
  assert.equal(f.launch('i386').stdout, 'direct-runtime:<argument with spaces>\n');
  assert.equal(f.repair().status, 0);
  assert.equal(f.launch('i386').stdout, 'direct-runtime:<argument with spaces>\n');
  for (const platform of ['arm', 'i386']) {
    const result = f.launch(platform, true);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'authorized-runtime:<osx-x86_64><argument with spaces>\n');
  }
});

test('Mac Manager repairs only canonical shortcuts and GUI access, preserving private data', macOnly, async t => {
  const f = await fixture(t);
  const result = f.repair();
  assert.equal(result.status, 0, result.stderr);
  for (const part of shortcuts) {
    assert.equal(await mode(path.join(f.top, part)), 0o755);
    assert.equal(await fs.readlink(path.join(f.top, part)), `xamppfiles/${part}`);
  }
  for (const file of [f.top, f.xampp, f.manager, path.join(f.manager, 'Contents'), f.executableDir, path.join(f.manager, 'Contents/Resources')]) {
    assert.equal((await mode(file)) & 0o555, 0o555);
  }
  for (const file of ['Contents/Info.plist', 'Contents/Resources/installbuilder.icns']) assert.equal(await mode(path.join(f.manager, file)), 0o644);
  assert.equal(await mode(f.wrapper), 0o755);
  assert.equal(await mode(path.join(f.executableDir, 'Application Manager')), 0o755);
  assert.equal(await mode(path.join(f.executableDir, 'osx-x86_64')), 0o700);
  assert.equal(await mode(path.join(f.xampp, 'var/mysql')), 0o700);
  assert.equal(await mode(path.join(f.xampp, 'var/mysql/store.sql')), 0o600);
  assert.equal(await fs.readFile(path.join(f.xampp, 'var/mysql/store.sql'), 'utf8'), 'private sales sentinel');
  assert.equal(await mode(path.join(f.xampp, 'htdocs/.env')), 0o600);
  assert.equal(await fs.readFile(path.join(f.xampp, 'htdocs/.env'), 'utf8'), 'private settings sentinel');
  // chmod -h must not alter the other vendor shortcut targets.
  for (const part of shortcuts.filter(part => part !== 'manager-osx.app')) assert.equal(await mode(path.join(f.xampp, part)), 0o700);
});

test('Mac Manager stores a private exact original backup and repeated repair is idempotent', macOnly, async t => {
  const f = await fixture(t);
  assert.equal(f.repair().status, 0);
  const backupDir = path.join(f.state, 'xampp-manager');
  const backup = path.join(backupDir, 'installbuilder-stock.sh');
  assert.equal(await fs.readFile(backup, 'utf8'), stock);
  assert.equal(await mode(backupDir), 0o700);
  assert.equal(await mode(backup), 0o600);
  const wrapper = await fs.readFile(f.wrapper);
  const backupStat = await fs.stat(backup);
  const result = f.repair();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await fs.readFile(f.wrapper), wrapper);
  assert.equal((await fs.stat(backup)).mtimeMs, backupStat.mtimeMs);
  assert.equal(await fs.readFile(backup, 'utf8'), stock);
});

test('Mac Manager preserves unknown custom launchers without changing shortcuts or creating backups', macOnly, async t => {
  const f = await fixture(t);
  await fs.writeFile(f.wrapper, '#!/bin/sh\necho custom launcher\n');
  const result = f.repair();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /customized launcher/);
  assert.equal(await fs.readFile(f.wrapper, 'utf8'), '#!/bin/sh\necho custom launcher\n');
  for (const part of shortcuts) assert.equal(await mode(path.join(f.top, part)), 0o700);
  assert.deepEqual(await fs.readdir(f.state), []);
});

test('Mac Manager rejects escaping shortcuts before patching or permission changes', macOnly, async t => {
  const f = await fixture(t);
  const outside = path.join(f.root, 'outside');
  await fs.mkdir(outside, { mode: 0o700 });
  await fs.unlink(path.join(f.top, 'logs'));
  await fs.symlink(outside, path.join(f.top, 'logs'));
  const result = f.repair();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unexpected target/);
  assert.equal(await mode(outside), 0o700);
  assert.equal(await fs.readFile(f.wrapper, 'utf8'), stock);
  assert.equal(await mode(path.join(f.top, 'bin')), 0o700);
  assert.deepEqual(await fs.readdir(f.state), []);
});

test('Mac Manager rejects a redirected manager directory or launcher file', macOnly, async t => {
  for (const redirect of ['directory', 'launcher']) {
    const f = await fixture(t);
    const original = redirect === 'directory' ? f.manager : f.wrapper;
    const outside = path.join(f.root, `outside-${redirect}`);
    await fs.rename(original, outside);
    await fs.symlink(outside, original);
    const result = f.repair();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /redirected/);
    assert.equal(await mode(path.join(f.top, 'bin')), 0o700);
    assert.deepEqual(await fs.readdir(f.state), []);
    if (redirect === 'launcher') assert.equal(await fs.readFile(outside, 'utf8'), stock);
  }
});

test('Mac Manager refuses redirected backup storage and preserves an unexpected backup', macOnly, async t => {
  for (const redirect of [true, false]) {
    const f = await fixture(t);
    const backupDir = path.join(f.state, 'xampp-manager');
    if (redirect) {
      const outside = path.join(f.root, 'outside-backups');
      await fs.mkdir(outside, { mode: 0o755 });
      await fs.symlink(outside, backupDir);
    } else {
      await fs.mkdir(backupDir, { mode: 0o700 });
      await fs.writeFile(path.join(backupDir, 'installbuilder-stock.sh'), 'unexpected prior backup', { mode: 0o600 });
    }
    const result = f.repair();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /backup/);
    assert.equal(await fs.readFile(f.wrapper, 'utf8'), stock);
    assert.equal(await mode(path.join(f.top, 'bin')), 0o700);
    if (redirect) assert.equal(await mode(path.join(f.root, 'outside-backups')), 0o755);
    else assert.equal(await fs.readFile(path.join(backupDir, 'installbuilder-stock.sh'), 'utf8'), 'unexpected prior backup');
  }
});


test('Mac Manager surfaces regular-user access failures instead of claiming success', macOnly, async t => {
  const f = await fixture(t);
  const result = f.repair(true);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /inaccessible to a regular user/);
  assert.doesNotMatch(result.stdout, /repair-complete/);
  const checks = await fs.readFile(path.join(f.root, 'access-checks'), 'utf8');
  assert.match(checks, / -x /);
  assert.doesNotMatch(checks, /^root /m);
  // A subsequent permitted repair succeeds without re-patching or losing backup.
  assert.equal(f.repair().status, 0);
  assert.equal(await fs.readFile(path.join(f.state, 'xampp-manager/installbuilder-stock.sh'), 'utf8'), stock);
});
