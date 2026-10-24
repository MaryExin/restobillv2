'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const helper = path.resolve(__dirname, '../common/desktop-settings.php');
const runtimeRoot = '/Library/Lightem/runtime';
const candidates = [process.env.LIGHTEM_TEST_PHP, 'php',
  ...(fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot).sort().reverse().map(name => path.join(runtimeRoot, name, 'bin/php')) : []),
  '/Applications/XAMPP/xamppfiles/bin/php'].filter(Boolean);
const php = candidates.find(binary => spawnSync(binary, ['-n', '-r', 'exit(PHP_VERSION_ID >= 80200 ? 0 : 1);']).status === 0);
const defaults = {
  'ip.txt': 'LOCAL: http://localhost:8080\nWEB: https://\nTENANT: CRABSNCRACK\n',
  'printer.txt': 'printReceipt: COM5\nprintEscpos: usb:auto\n',
  'businessInfo.json': JSON.stringify({ companyName: 'Example company', terminalId: '1', address: 'Example address', logo: null }),
  'pos-config.json': JSON.stringify({ unitCode: 'BU-example', terminalNumber: '1', nested: { value: 'default', other: 'added' }, enabled: true }),
  'printer_categories.json': JSON.stringify({ newTransaction: { bluetooth: { connection: 'bt:COM5', categories: ['EXAMPLE'] }, lan: { connection: '192.0.2.10', categories: ['OTHER'] }, usb: { connection: '', categories: [] } } }),
};

function fixture(t, existing = {}, mac = false) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lightem-desktop-settings-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resources = mac ? path.join(root, 'app/Contents/Resources') : path.join(root, 'resources');
  const pristine = path.join(root, 'packaged-defaults');
  fs.mkdirSync(resources, { recursive: true }); fs.mkdirSync(pristine);
  for (const [name, value] of Object.entries(defaults)) fs.writeFileSync(path.join(pristine, name), value);
  for (const [name, value] of Object.entries(existing)) fs.writeFileSync(path.join(resources, name), value);
  return { resources, pristine, run() {
    return spawnSync(php, ['-n', helper, '--resources', resources, '--defaults', pristine], { encoding: 'utf8' });
  }, read(name) { return fs.readFileSync(path.join(resources, name), 'utf8'); } };
}
function runOk(f) {
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function phpTest(name, fn) { test(name, { skip: !php && 'PHP 8.2+ is required for filesystem-only helper fixtures' }, fn); }

phpTest('fresh desktop gets all five exact packaged resources, including the tenant', t => {
  const f = fixture(t);
  assert.equal(runOk(f).changed.length, 5);
  for (const [name, value] of Object.entries(defaults)) {
    assert.equal(f.read(name), value);
    assert.equal(fs.readFileSync(path.join(f.pristine, name), 'utf8'), value);
  }
  assert.deepEqual(runOk(f).changed, [], 'reinstall is idempotent');
});

phpTest('earlier blank settings gain tenant and business defaults without resetting custom fields', t => {
  const f = fixture(t, {
    'ip.txt': '\uFEFF# Keep this note\r\nLOCAL: http://localhost\r\nWEB: https://custom.example\r\nTENANT: \t\r\nCUSTOM: keep\r\n',
    'printer.txt': 'printReceipt: COM9\nprintEscpos: \ncustomJob: custom-value\n',
    'businessInfo.json': JSON.stringify({ companyName: 'My company', terminalId: '', address: null, custom: false }),
    'pos-config.json': JSON.stringify({ unitCode: '', terminalNumber: '3', enabled: false, nested: { value: 'custom' }, zero: 0 }),
  });
  runOk(f);
  assert.match(f.read('ip.txt'), /LOCAL: http:\/\/localhost\r\nWEB: https:\/\/custom.example\r\nTENANT: CRABSNCRACK/);
  assert.match(f.read('ip.txt'), /# Keep this note/);
  assert.match(f.read('ip.txt'), /CUSTOM: keep/);
  assert.equal(f.read('printer.txt'), 'printReceipt: COM9\nprintEscpos: usb:auto\ncustomJob: custom-value\n');
  assert.deepEqual(JSON.parse(f.read('businessInfo.json')), { companyName: 'My company', terminalId: '1', address: 'Example address', custom: false, logo: null });
  assert.deepEqual(JSON.parse(f.read('pos-config.json')), { unitCode: 'BU-example', terminalNumber: '3', enabled: false, nested: { value: 'custom', other: 'added' }, zero: 0 });
});

phpTest('custom printer arrays and disabled empty branches survive backfill', t => {
  const categories = { newTransaction: { bluetooth: { connection: 'bt:COM9', categories: ['CUSTOM'] }, lan: { connection: '192.0.2.20', categories: [] }, usb: {} } };
  const f = fixture(t, { 'printer_categories.json': JSON.stringify(categories) });
  runOk(f);
  assert.deepEqual(JSON.parse(f.read('printer_categories.json')), categories);
});

phpTest('missing and whitespace-only resource files are repaired from defaults', t => {
  const f = fixture(t, { 'ip.txt': '\n ', 'printer.txt': '', 'pos-config.json': '\r\n\t', 'businessInfo.json': '{}' });
  runOk(f);
  for (const name of Object.keys(defaults)) assert.deepEqual(name.endsWith('.json') ? JSON.parse(f.read(name)) : f.read(name), name.endsWith('.json') ? JSON.parse(defaults[name]) : defaults[name]);
});

phpTest('matching tenant comparisons ignore case and surrounding whitespace', t => {
  const f = fixture(t, { 'ip.txt': 'LOCAL: http://localhost:8080\nTENANT: crabsncrack  \n' });
  assert.equal(runOk(f).preservedDifferentTenant, false);
  assert.match(f.read('ip.txt'), /TENANT: crabsncrack  /, 'custom spelling is preserved');
  assert.ok(f.read('businessInfo.json'));
});

phpTest('different existing tenant never receives another stores defaults, including missing files', t => {
  const existing = { 'ip.txt': 'LOCAL: https://remote.example\nTENANT: ANOTHER_STORE\nWEB: \n', 'businessInfo.json': '{"companyName":""}', 'printer.txt': '' };
  const f = fixture(t, existing);
  assert.deepEqual(runOk(f), { changed: [], preservedDifferentTenant: true });
  for (const [name, value] of Object.entries(existing)) assert.equal(f.read(name), value);
  assert.equal(fs.existsSync(path.join(f.resources, 'pos-config.json')), false);
  assert.equal(fs.existsSync(path.join(f.resources, 'printer_categories.json')), false);
});

phpTest('legacy single-line local and remote endpoints are retained while adding tenant', t => {
  for (const endpoint of ['http://localhost', 'http:\\\\localhost', 'http://192.0.2.25:8085']) {
    const f = fixture(t, { 'ip.txt': endpoint });
    runOk(f);
    assert.equal(f.read('ip.txt'), `LOCAL: ${endpoint}\nWEB: https://\nTENANT: CRABSNCRACK\n`);
  }
});

phpTest('malformed last JSON file prevents changes to every earlier file', t => {
  const existing = { 'ip.txt': 'TENANT: \n', 'printer_categories.json': '{broken' };
  const f = fixture(t, existing);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid JSON in printer_categories.json/);
  for (const [name, value] of Object.entries(existing)) assert.equal(f.read(name), value);
  assert.equal(fs.existsSync(path.join(f.resources, 'printer.txt')), false);
});

phpTest('duplicate TENANT entries with different casing fail without writing', t => {
  const text = 'TENANT: CRABSNCRACK\ntenant: other\n';
  const f = fixture(t, { 'ip.txt': text });
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate setting in ip.txt: TENANT/);
  assert.equal(f.read('ip.txt'), text);
  assert.equal(fs.existsSync(path.join(f.resources, 'businessInfo.json')), false);
});

phpTest('missing packaged tenant fails without inventing a tenant', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.pristine, 'ip.txt'), 'LOCAL: http://localhost:8080\nTENANT: \n');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /packaged desktop TENANT is missing/);
  assert.deepEqual(fs.readdirSync(f.resources), []);
});

phpTest('symbolic links cannot redirect privileged settings writes or default reads', t => {
  for (const which of ['resources', 'pristine']) {
    const f = fixture(t);
    const target = path.join(path.dirname(f.resources), 'protected-file');
    fs.writeFileSync(target, 'protected');
    const link = path.join(f[which], 'printer.txt');
    fs.rmSync(link, { force: true });
    fs.symlinkSync(target, link);
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /symbolic link/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'protected');
  }
});

test('both installers restore settings, backfill pristine defaults, then select the private endpoint', () => {
  const windows = fs.readFileSync(path.resolve(__dirname, '../windows/install-standalone.ps1'), 'utf8');
  const mac = fs.readFileSync(path.resolve(__dirname, '../mac-standalone/postinstall'), 'utf8');
  assert.match(windows, /Restore-DesktopSettings\s+Restore-PreviousStandaloneDesktopSettings\s+Complete-DesktopSettings\s+Set-DesktopLocalEndpoint/);
  assert.match(windows, /Invoke-BundledPhp \(Join-Path \$PayloadRoot 'runtime'\) '' @\('-n', \(Join-Path \$PayloadRoot 'desktop-settings.php'\)/);
  assert.match(windows, /\$defaults = Join-Path \$resources 'images'/);
  assert.match(windows, /Restore-DesktopSettingsFrom \(Join-Path \$DesktopRecoveryRoot 'app\\resources'\)/);
  assert.match(windows, /Restore-DesktopSettingsFrom \$oldResources/);
  assert.match(mac, /fi\nrun_php "\$PAYLOAD\/desktop-settings.php" --resources "\$APP\/Contents\/Resources" --defaults "\$PAYLOAD\/Lightem Pos.app\/Contents\/Resources\/images"\nset_desktop_local_endpoint/);
});

const pwsh = [process.env.LIGHTEM_TEST_PWSH, 'pwsh', '/private/tmp/lightem-powershell-test-7.5.4/pwsh'].filter(Boolean)
  .find(binary => spawnSync(binary, ['-NoProfile', '-Command', 'exit 0']).status === 0);

test('Windows restoration removes packaged editable files before tenant-aware backfill', { skip: (!php || !pwsh) && 'PHP and PowerShell are required' }, t => {
  for (const tenant of ['ANOTHER_STORE', 'CRABSNCRACK']) {
    // Model the real installer: the new app already contains packaged defaults,
    // while the previous verified application profile has only two files.
    const f = fixture(t, defaults);
    const oldResources = path.join(path.dirname(f.resources), 'old-resources');
    fs.mkdirSync(oldResources);
    fs.writeFileSync(path.join(oldResources, 'ip.txt'), `LOCAL: http://localhost:8080\nTENANT: ${tenant}\n`);
    fs.writeFileSync(path.join(oldResources, 'businessInfo.json'), '{"companyName":"Existing company"}');
    const script = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens = $null; $errors = $null
$tree = [Management.Automation.Language.Parser]::ParseFile($env:LIGHTEM_SOURCE, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
foreach ($name in @('Assert-NoReparsePoint', 'Restore-DesktopSettingsFrom')) {
  $definition = $tree.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $false)
  . ([scriptblock]::Create($definition.Extent.Text))
}
$AppRoot = $env:LIGHTEM_TEST_APP
Restore-DesktopSettingsFrom $env:LIGHTEM_TEST_OLD
`;
    const restore = spawnSync(pwsh, ['-NoProfile', '-Command', script], { encoding: 'utf8', env: { ...process.env,
      LIGHTEM_SOURCE: path.resolve(__dirname, '../windows/install-standalone.ps1'), LIGHTEM_TEST_APP: path.dirname(f.resources), LIGHTEM_TEST_OLD: oldResources } });
    assert.equal(restore.status, 0, restore.stderr);
    assert.equal(fs.existsSync(path.join(f.resources, 'printer.txt')), false, 'absent old files do not retain new defaults');
    const result = runOk(f);
    assert.equal(result.preservedDifferentTenant, tenant === 'ANOTHER_STORE');
    assert.equal(JSON.parse(f.read('businessInfo.json')).companyName, 'Existing company');
    assert.equal(fs.existsSync(path.join(f.resources, 'pos-config.json')), tenant === 'CRABSNCRACK');
    assert.equal(fs.existsSync(path.join(f.resources, 'printer_categories.json')), tenant === 'CRABSNCRACK');
    for (const [name, value] of Object.entries(defaults)) assert.equal(fs.readFileSync(path.join(f.pristine, name), 'utf8'), value);
  }
});

test('Mac restore overlay keeps fresh defaults but clears absent prior files before tenant backfill', { skip: (!php || process.platform !== 'darwin') && 'macOS and PHP are required' }, t => {
  const source = fs.readFileSync(path.resolve(__dirname, '../mac-standalone/postinstall'), 'utf8');
  const start = source.indexOf('if [ -d "$BACKUP/Lightem Pos.app/Contents/Resources" ]; then');
  const end = source.indexOf('\nrun_php "$PAYLOAD/desktop-settings.php"', start);
  assert.ok(start > 0 && end > start);
  const safeStart = source.indexOf('safe_path() {');
  const safeEnd = source.indexOf('\n# BEGIN STANDALONE PROCESS CHECKS', safeStart);
  const script = `set -Eeuo pipefail\ndie() { echo "$*" >&2; exit 1; }\n${source.slice(safeStart, safeEnd)}\n${source.slice(start, end)}`;
  for (const tenant of [null, 'ANOTHER_STORE', 'CRABSNCRACK']) {
    const f = fixture(t, defaults, true);
    const app = path.dirname(path.dirname(f.resources));
    const backup = path.join(path.dirname(app), 'backup');
    if (tenant !== null) {
      const oldResources = path.join(backup, 'Lightem Pos.app/Contents/Resources');
      fs.mkdirSync(oldResources, { recursive: true });
      fs.writeFileSync(path.join(oldResources, 'ip.txt'), `LOCAL: http://localhost:8080\nTENANT: ${tenant}\n`);
      fs.writeFileSync(path.join(oldResources, 'businessInfo.json'), '{"companyName":"Existing company"}');
    }
    const restore = spawnSync('/bin/bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, APP: app, BACKUP: backup } });
    assert.equal(restore.status, 0, restore.stderr);
    if (tenant === null) for (const [name, value] of Object.entries(defaults)) assert.equal(f.read(name), value);
    else assert.equal(fs.existsSync(path.join(f.resources, 'printer.txt')), false);
    const result = runOk(f);
    assert.equal(result.preservedDifferentTenant, tenant === 'ANOTHER_STORE');
    assert.equal(fs.existsSync(path.join(f.resources, 'pos-config.json')), tenant !== 'ANOTHER_STORE');
    assert.equal(fs.existsSync(path.join(f.resources, 'printer_categories.json')), tenant !== 'ANOTHER_STORE');
    if (tenant !== null) assert.equal(JSON.parse(f.read('businessInfo.json')).companyName, 'Existing company');
  }
});
