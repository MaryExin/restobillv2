const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {launchWindowsImport, importRequested} = require('../launcher/main.cjs');

function captureLaunch(filename, environment = {SystemRoot: 'C:\\Windows'}) {
  let captured;
  const promise = launchWindowsImport(filename, {environment, execute(file, args, options, done) {
    captured = {file, args, options}; done(null);
  }});
  return {promise, get captured() { return captured; }};
}

test('the import option accepts only an explicit boolean and no additional launch arguments', () => {
  for (const options of [{}, {copyXampp: false}, {copyXampp: undefined}]) assert.equal(importRequested(options), false);
  assert.equal(importRequested({copyXampp: true}), true);
  for (const options of [undefined, null, false, [], 'true', {copyXampp: 1}, {copyXampp: 'false'},
    {copyXampp: null}, {copyXampp: true, command: 'anything'}]) assert.throws(() => importRequested(options), /choice is invalid/);
});

test('Windows import passes hostile-looking paths as environment data and invokes a fixed encoded command without a shell', async () => {
  const filename = "C:\\Users\\O'Brien & echo BAD\\$(throw 'injected'); setup.exe";
  const environment = {SystemRoot: 'C:\\Windows', LIGHTEM_SETUP_PACKAGE: 'stale value', EXTRA_VALUE: 'preserved'};
  const launched = captureLaunch(filename, environment);
  await launched.promise;
  const {file, args, options} = launched.captured;
  assert.equal(file, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(args.slice(0, -1), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand']);
  assert.equal(options.env.LIGHTEM_SETUP_PACKAGE, filename);
  assert.equal(options.env.EXTRA_VALUE, 'preserved');
  assert.equal(environment.LIGHTEM_SETUP_PACKAGE, 'stale value', 'parent environment is never mutated');
  assert.equal(options.windowsHide, true);
  assert.notEqual(options.shell, true);
  const script = Buffer.from(args.at(-1), 'base64').toString('utf16le');
  assert(!script.includes(filename) && !args.includes(filename), 'path is never interpolated into code or the command line');
  assert.match(script, /Start-Process -FilePath \$env:LIGHTEM_SETUP_PACKAGE -ArgumentList '\/COPYXAMPP' -Verb RunAs/);
  const ordinary = captureLaunch('C:\\Cache\\setup.exe');
  await ordinary.promise;
  assert.equal(ordinary.captured.args.at(-1), args.at(-1), 'encoded program is constant regardless of the path');
});

test('Windows launch validates its paths before invoking PowerShell and supports WINDIR fallback', async () => {
  let executions = 0;
  const execute = (_file, _args, _options, done) => { executions++; done(null); };
  for (const filename of ['setup.exe', 'C:setup.exe', 'C:\\setup.pkg', 'C:\\nul\0.exe']) {
    await assert.rejects(launchWindowsImport(filename, {execute, environment: {SystemRoot: 'C:\\Windows'}}), /path is unavailable/);
  }
  for (const environment of [{}, {SystemRoot: 'Windows'}, {SystemRoot: 'C:Windows'}]) {
    await assert.rejects(launchWindowsImport('C:\\setup.exe', {execute, environment}), /path is unavailable/);
  }
  assert.equal(executions, 0);
  const fallback = captureLaunch('C:\\setup.exe', {WINDIR: 'D:\\Windows'});
  await fallback.promise;
  assert.equal(fallback.captured.file, 'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
});

test('a denied or failed Windows elevation is reported without exposing captured process output', async () => {
  for (const code of [1, 1223, 'ENOENT']) {
    const failure = Object.assign(new Error('private process details'), {code});
    await assert.rejects(launchWindowsImport('C:\\Cache\\setup.exe', {environment: {SystemRoot: 'C:\\Windows'},
      execute(_file, _args, _options, done) { done(failure, 'private stdout', 'private stderr'); },
    }), error => /Allow the administrator prompt/.test(error.message) && !/private/.test(error.message));
  }
});

const pwsh = [process.env.LIGHTEM_TEST_PWSH, 'pwsh', '/private/tmp/lightem-powershell-test-7.5.4/pwsh'].filter(Boolean)
  .find(file => spawnSync(file, ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {encoding: 'utf8'}).status === 0);

test('the actual encoded script preserves the literal path and fixed argument when Start-Process is mocked', {skip: !pwsh && 'PowerShell is required'}, async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-import-command-'));
  t.after(() => fs.rmSync(temporary, {recursive: true, force: true}));
  const capture = path.join(temporary, 'arguments.json');
  const filename = "C:\\Users\\O'Brien & echo BAD\\$($env:LIGHTEM_TEST_INJECTED='yes'); setup.exe";
  const launched = captureLaunch(filename);
  await launched.promise;
  const script = Buffer.from(launched.captured.args.at(-1), 'base64').toString('utf16le');
  const fixture = `
function Start-Process {
  param([string]$FilePath, [string[]]$ArgumentList, [string]$Verb, [string]$ErrorAction)
  if ($env:LIGHTEM_TEST_REJECT -eq '1') { throw 'Mocked UAC rejection' }
  $record = @{file=$FilePath; arguments=@($ArgumentList); verb=$Verb; errorAction=$ErrorAction; injected=$env:LIGHTEM_TEST_INJECTED}
  [IO.File]::WriteAllText($env:LIGHTEM_TEST_CAPTURE, ($record | ConvertTo-Json -Compress))
}
${script}
exit 99
`;
    const options = {encoding: 'utf8', env: {...process.env, LIGHTEM_SETUP_PACKAGE: filename,
      LIGHTEM_TEST_CAPTURE: capture, LIGHTEM_TEST_INJECTED: '', LIGHTEM_TEST_REJECT: '0'}};
    const result = spawnSync(pwsh, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(fixture, 'utf16le').toString('base64')], options);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const recorded = JSON.parse(fs.readFileSync(capture, 'utf8'));
    assert.equal(recorded.file, filename);
    assert.deepEqual(recorded.arguments, ['/COPYXAMPP']);
    assert.equal(recorded.verb, 'RunAs');
    assert.equal(recorded.errorAction, 'Stop');
    assert(!recorded.injected, 'path contents never execute as PowerShell');
    fs.unlinkSync(capture);
    const denied = spawnSync(pwsh, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(fixture, 'utf16le').toString('base64')],
      {...options, env: {...options.env, LIGHTEM_TEST_REJECT: '1'}});
    assert.equal(denied.status, 1, denied.stdout + denied.stderr);
    assert(!fs.existsSync(capture), 'rejection never reports a successful Start-Process');
});
