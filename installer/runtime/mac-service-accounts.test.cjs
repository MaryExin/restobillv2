'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const source = fs.readFileSync(path.resolve(__dirname, '../mac-standalone/postinstall'), 'utf8');
const accountCode = source.split('# BEGIN STANDALONE ACCOUNTS\n')[1]
  .split('# END STANDALONE ACCOUNTS')[0].replaceAll('/usr/bin/dscl', 'fixture_dscl');
const safePath = source.slice(source.indexOf('safe_path() {'), source.indexOf('# BEGIN STANDALONE PROCESS CHECKS'));
const productionTrap = source.split('\n').find(line => line.startsWith("trap 'die "));
const complete = [
  'UniqueID: 309', 'PrimaryGroupID: 309', 'UserShell: /usr/bin/false',
  'NFSHomeDirectory: /var/empty', 'dsAttrTypeNative:IsHidden: 1',
].join('\n') + '\n';

function fixture(t, options = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-account-update-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'accounts'), {mode: 0o700});
  const record = path.join(root, 'accounts/_lightemhttp');
  if (options.managed !== false) fs.writeFileSync(record, options.record || '309:309\n', {mode: 0o600});
  fs.writeFileSync(path.join(root, 'users'), options.users ?? 'root 0\n_lightemhttp 309\n');
  fs.writeFileSync(path.join(root, 'groups'), options.groups ?? 'wheel 0\n_lightemhttp 309\n');
  fs.writeFileSync(path.join(root, 'properties'), options.properties ?? complete);
  const before = fs.existsSync(record) ? fs.statSync(record).mtimeMs : null;
  const script = `die(){ printf '%s\\n' "$*" >&2; exit 42; }\n${productionTrap}\n${safePath}\n${accountCode}\n` + String.raw`
fixture_dscl() {
  [ "$1" = . ] || return 91
  case "$2" in
    -list)
      case "$3:$4" in
        /Users:UniqueID) cat "$STATE/users" ;;
        /Groups:PrimaryGroupID) cat "$STATE/groups" ;;
        *) return 92 ;;
      esac ;;
    -read)
      [ "$*" = '. -read /Users/_lightemhttp UniqueID PrimaryGroupID UserShell NFSHomeDirectory IsHidden' ] || return 93
      [ "$READ_FAILURE" != 1 ] || return 5
      cat "$STATE/properties" ;;
    -create)
      printf '%s|' "$@" >> "$STATE/mutations"
      printf '\n' >> "$STATE/mutations"
      [ "$FORBID_WRITES" != 1 ] || return 77 ;;
    *) return 94 ;;
  esac
}
ensure_service_account _lightemhttp
`;
  const result = spawnSync('/bin/bash', ['-Eeu', '-o', 'pipefail', '-c', script], {
    env: {...process.env, STATE: root, READ_FAILURE: options.readFailure ? '1' : '0',
      FORBID_WRITES: options.forbidWrites ? '1' : '0'}, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  return {root, record, before, result,
    writes: fs.existsSync(path.join(root, 'mutations')) ? fs.readFileSync(path.join(root, 'mutations'), 'utf8').trim().split('\n') : []};
}

for (const native of [true, false]) test(`complete managed account update makes no directory or record writes (${native ? 'native' : 'plain'} hidden attribute)`, t => {
  const f = fixture(t, {forbidWrites: true, properties: native ? complete : complete.replace('dsAttrTypeNative:', '')});
  assert.equal(f.result.status, 0, f.result.stderr); assert.equal(f.result.stderr, '');
  assert.deepEqual(f.writes, []); assert.equal(fs.readFileSync(f.record, 'utf8'), '309:309\n');
  assert.equal(fs.statSync(f.record).mtimeMs, f.before);
});

for (const [property, original, unsafe] of [
  ['UniqueID', 'UniqueID: 309', 'UniqueID: 501'],
  ['PrimaryGroupID', 'PrimaryGroupID: 309', 'PrimaryGroupID: 20'],
  ['UserShell', 'UserShell: /usr/bin/false', 'UserShell: /bin/zsh'],
  ['NFSHomeDirectory', 'NFSHomeDirectory: /var/empty', 'NFSHomeDirectory: /Users/example'],
  ['IsHidden', 'dsAttrTypeNative:IsHidden: 1', 'dsAttrTypeNative:IsHidden: 0'],
]) test(`changed ${property} is rejected without repair or password reset`, t => {
  const f = fixture(t, {properties: complete.replace(original, unsafe)});
  assert.equal(f.result.status, 42, f.result.stderr); assert.match(f.result.stderr, new RegExp('property was changed: ' + property));
  assert.deepEqual(f.writes, []); assert.equal(fs.readFileSync(f.record, 'utf8'), '309:309\n');
});

test('property read failure aborts before every mutation under the production ERR trap', t => {
  const f = fixture(t, {readFailure: true}); assert.equal(f.result.status, 42);
  assert.match(f.result.stderr, /Cannot inspect managed service account properties/); assert.deepEqual(f.writes, []);
});

for (const invalid of ['UserShell: /usr/bin/false /bin/zsh\n', 'UserShell: /usr/bin/false\nUserShell: /usr/bin/false\n']) {
  test('malformed or repeated property cannot be treated as a safe existing account', t => {
    const f = fixture(t, {properties: complete.replace('UserShell: /usr/bin/false\n', invalid)});
    assert.equal(f.result.status, 42); assert.deepEqual(f.writes, []);
  });
}

test('protected partial account fills only its missing hidden attribute and never resets Password', t => {
  const f = fixture(t, {properties: complete.replace('dsAttrTypeNative:IsHidden: 1\n', 'No such key: IsHidden\n')});
  assert.equal(f.result.status, 0, f.result.stderr);
  assert.deepEqual(f.writes, ['.|-create|/Users/_lightemhttp|IsHidden|1|']);
  assert.equal(fs.statSync(f.record).mtimeMs, f.before);
});

test('protected partial user with no UniqueID resumes only that missing property', t => {
  const f = fixture(t, {users: 'root 0\n_lightemhttp\n', properties: complete.replace('UniqueID: 309\n', 'No such key: UniqueID\n')});
  assert.equal(f.result.status, 0, f.result.stderr);
  assert.deepEqual(f.writes, ['.|-create|/Users/_lightemhttp|UniqueID|309|']);
});

test('protected partial installation recreates only its absent group', t => {
  const f = fixture(t, {groups: 'wheel 0\n'}); assert.equal(f.result.status, 0, f.result.stderr);
  assert.deepEqual(f.writes, ['.|-create|/Groups/_lightemhttp|', '.|-create|/Groups/_lightemhttp|PrimaryGroupID|309|']);
});

test('protected partial group with no identifier fills only its missing identifier', t => {
  const f = fixture(t, {groups: 'wheel 0\n_lightemhttp\n'}); assert.equal(f.result.status, 0, f.result.stderr);
  assert.deepEqual(f.writes, ['.|-create|/Groups/_lightemhttp|PrimaryGroupID|309|']);
});

test('protected partial installation creates an absent user with locked password and safe properties', t => {
  const f = fixture(t, {users: 'root 0\n'}); assert.equal(f.result.status, 0, f.result.stderr);
  assert.equal(f.writes.length, 7); assert.equal(f.writes[0], '.|-create|/Users/_lightemhttp|');
  assert.equal(f.writes.at(-1), '.|-create|/Users/_lightemhttp|Password|*|');
  assert.ok(f.writes.includes('.|-create|/Users/_lightemhttp|UserShell|/usr/bin/false|'));
  assert.ok(f.writes.includes('.|-create|/Users/_lightemhttp|NFSHomeDirectory|/var/empty|'));
});

test('fresh installation allocates a free identifier and creates safe user and group', t => {
  const f = fixture(t, {managed: false, users: 'root 0\n', groups: 'wheel 0\n'});
  assert.equal(f.result.status, 0, f.result.stderr); assert.equal(fs.readFileSync(f.record, 'utf8'), '300:300\n');
  assert.equal(fs.statSync(f.record).mode & 0o777, 0o600); assert.equal(f.writes.length, 9);
  assert.ok(f.writes.includes('.|-create|/Users/_lightemhttp|UniqueID|300|'));
  assert.ok(f.writes.includes('.|-create|/Groups/_lightemhttp|PrimaryGroupID|300|'));
  assert.equal(f.writes.at(-1), '.|-create|/Users/_lightemhttp|Password|*|');
});

for (const [description, options] of [
  ['unmanaged existing name', {managed: false}],
  ['changed user identifier', {users: 'root 0\n_lightemhttp 501\n'}],
  ['changed group identifier', {groups: 'wheel 0\n_lightemhttp 501\n'}],
  ['identifier reused by another user', {users: 'root 0\n_lightemhttp 309\nother 309\n'}],
  ['invalid protected account record', {record: '309:310\n'}],
]) test(`${description} is rejected before directory changes`, t => {
  const f = fixture(t, options); assert.equal(f.result.status, 42); assert.deepEqual(f.writes, []);
});
