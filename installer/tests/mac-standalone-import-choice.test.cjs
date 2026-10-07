'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const source = fs.readFileSync(path.resolve(__dirname, '../mac-standalone/postinstall'), 'utf8');
const classification = source.split('# BEGIN STANDALONE CLASSIFICATION\n')[1]
  .split('# END STANDALONE CLASSIFICATION')[0];
const defaultChoice = source.match(/^COPY_XAMPP_REQUESTED=0$/gm);
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;

function fixture(t, options = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-mac-import-choice-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const webroot = path.join(root, 'backend'), data = path.join(root, 'data'), legacy = path.join(root, 'XAMPP');
  fs.mkdirSync(webroot); fs.mkdirSync(data);
  if (options.legacy) {
    fs.mkdirSync(path.join(legacy, 'htdocs/api'), {recursive: true});
    fs.writeFileSync(path.join(legacy, 'htdocs/api/bootstrap.php'), 'original backend');
    if (options.legacy !== 'incomplete') fs.writeFileSync(path.join(legacy, 'htdocs/.env'), 'original private settings');
  }
  if (options.marker) fs.writeFileSync(path.join(webroot, '.lightem-managed-install.json'), 'owned fixture');
  if (options.privateFiles) fs.writeFileSync(path.join(data, 'preserved-sales'), 'keep these sales');
  const code = `set -Eeu -o pipefail
MODE=fresh
COPY_XAMPP_REQUESTED=${options.import === true ? '1' : defaultChoice?.[0]?.split('=')[1]}
WEBROOT=${quote(webroot)}
DATA=${quote(data)}
LEGACY=${quote(legacy)}
die(){ printf '%s\\n' "$*" >&2; exit 42; }
${classification}
installation_phase(){ printf '%s' ${quote(options.phase || 'none')}; }
# Track the actual production file predicates, including missing source paths.
# Off, pending-fresh, and owned-update cases must not even inspect XAMPP files.
function [ {
  local argument
  for argument in "$@"; do
    case "$argument" in "$LEGACY"/*)
      printf '%s\\n' "$argument" >> ${quote(path.join(root, 'legacy-probes'))}
      ${options.noProbe ? 'exit 90' : ':'}
    ;; esac
  done
  builtin [ "$@"
}
classify_installation
printf '%s:%s:%s' "$PHASE" "$MODE" "$SOURCE_KIND"
`;
  const result = spawnSync('/bin/bash', ['-c', code], {encoding: 'utf8', timeout: 10000});
  assert.ifError(result.error);
  if (options.legacy) assert.equal(fs.readFileSync(path.join(legacy, 'htdocs/api/bootstrap.php'), 'utf8'), 'original backend');
  if (options.privateFiles) assert.equal(fs.readFileSync(path.join(data, 'preserved-sales'), 'utf8'), 'keep these sales');
  return {...result, probes: fs.existsSync(path.join(root, 'legacy-probes'))
    ? fs.readFileSync(path.join(root, 'legacy-probes'), 'utf8') : ''};
}

test('Mac packages have one explicit build-time default that does not read process environment', () => {
  assert.equal(defaultChoice?.length, 1);
  assert.doesNotMatch(source, /COPY_XAMPP_REQUESTED=\$|COPY_XAMPP_REQUESTED="\$/);
});

for (const legacy of [false, true, 'incomplete']) {
  test(`unchecked Mac setup starts independently without inspecting XAMPP: ${legacy}`, t => {
    const result = fixture(t, {legacy, noProbe: true});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'none:fresh:fresh');
    assert.equal(result.probes, '');
  });
}

test('checked Mac setup selects an intact XAMPP source for copying', t => {
  const result = fixture(t, {legacy: true, import: true});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'none:migrate:legacy');
  assert.match(result.probes, /htdocs\/api\/bootstrap\.php/);
  assert.match(result.probes, /htdocs\/\.env/);
});

for (const legacy of [false, 'incomplete']) {
  test(`checked Mac setup refuses a missing or incomplete selected source: ${legacy}`, t => {
    const result = fixture(t, {legacy, import: true});
    assert.equal(result.status, 42, result.stderr);
    assert.match(result.stderr, /Copy data from XAMPP was selected/);
    assert.match(result.stderr, /Uncheck this option for a new standalone store/);
  });
}

for (const importChoice of [false, true]) {
  test(`owned Mac update preserves its store without inspecting XAMPP, checkbox=${importChoice}`, t => {
    const result = fixture(t, {phase: 'ready', marker: true, import: importChoice, privateFiles: true, noProbe: true});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'ready:update:fresh');
    assert.equal(result.probes, '');
  });
  test(`pending fresh setup keeps its original source choice, checkbox=${importChoice}`, t => {
    const result = fixture(t, {phase: 'pending-fresh', legacy: true, import: importChoice, privateFiles: true, noProbe: true});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'pending-fresh:fresh:fresh');
    assert.equal(result.probes, '');
  });
  test(`unrecognized private files cannot be replaced, checkbox=${importChoice}`, t => {
    const result = fixture(t, {legacy: true, import: importChoice, privateFiles: true, noProbe: !importChoice});
    assert.equal(result.status, 42, result.stderr);
    assert.match(result.stderr, /preserved|recovery is required before replacement/);
  });
  test(`ready state with a missing backend marker requires recovery, checkbox=${importChoice}`, t => {
    const result = fixture(t, {phase: 'ready', import: importChoice, noProbe: true});
    assert.equal(result.status, 42, result.stderr);
    assert.match(result.stderr, /backend marker is missing/);
  });
}

test('unchecking an unfinished Mac import preserves it and asks to resume without inspecting XAMPP', t => {
  const result = fixture(t, {phase: 'pending-legacy', marker: true, privateFiles: true, noProbe: true});
  assert.equal(result.status, 42, result.stderr);
  assert.match(result.stderr, /unfinished XAMPP import was preserved/);
  assert.match(result.stderr, /Select Copy data from XAMPP/);
  assert.equal(result.probes, '');
});

test('checked unfinished Mac import resumes its original source even with a backend marker', t => {
  const result = fixture(t, {phase: 'pending-legacy', marker: true, privateFiles: true, legacy: true, import: true});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'pending-legacy:migrate:legacy');
});

test('checked unfinished Mac import with no original source cannot become a fresh store', t => {
  const result = fixture(t, {phase: 'pending-legacy', privateFiles: true, import: true});
  assert.equal(result.status, 42, result.stderr);
  assert.match(result.stderr, /original backend is required/);
});

test('Mac backend marker without protected state is preserved', t => {
  const result = fixture(t, {marker: true, noProbe: true});
  assert.equal(result.status, 42, result.stderr);
  assert.match(result.stderr, /no matching protected installation state/);
});
