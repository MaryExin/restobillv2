'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const source = fs.readFileSync(path.resolve(__dirname, '../mac-standalone/postinstall'), 'utf8');
const php = path.resolve(__dirname, '../cache/standalone-runtime/darwin/bin/php');
const available = {skip: process.platform !== 'darwin' || !fs.existsSync(php)};
const block = name => source.split(`# BEGIN STANDALONE ${name}\n`)[1].split(`# END STANDALONE ${name}`)[0];
const processCode = block('PROCESS CHECKS').replaceAll('/usr/sbin/lsof', 'fixture_lsof')
  .replaceAll('/bin/launchctl', 'fixture_launchctl').replaceAll('/bin/ps', 'fixture_ps');
const trap = source.split('\n').find(line => line.startsWith("trap 'die "));
const basics = String.raw`
die(){ printf '%s\n' "$*" >&2; exit 42; }
say(){ printf '%s\n' "$*"; }
run_php(){ "$PHP_BINARY" -n "$@"; }
safe_path(){ [ ! -L "$1" ] || die 'redirected fixture path'; }
sleep(){ :; }
`;
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lightem-mac-coexist-')));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const app = path.join(root, 'Lightem Pos.app');
  fs.mkdirSync(path.join(app, 'Contents/Resources'), {recursive: true});
  function run(code, env = {}) {
    const result = spawnSync('/bin/bash', ['-Eeu', '-o', 'pipefail', '-c', basics + '\n' + trap + '\n' + code], {
      env: {...process.env, STATE: root, APP: app, PHP_BINARY: php, HTTP_PORT: '8080',
        RUNTIME_BASE: '/Library/Lightem/runtime', PHASE: 'ready', ...env}, encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(result.error);
    return result;
  }
  return {root, app, run};
}

for (const [name, record, expected] of [
  ['old protected marker defaults to port80', {}, '80'],
  ['explicit old port is accepted', {httpPort: 80}, '80'],
  ['separate-port marker is accepted', {httpPort: 8080}, '8080'],
]) test(name, available, t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root, 'standalone-runtime.json'), JSON.stringify(record));
  const r = f.run(block('HTTP TRANSITION') + '\nexisting_http_port');
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, expected);
});
for (const port of [81, 3307, '8080', false, []]) test(`invalid existing HTTP port is rejected: ${JSON.stringify(port)}`, available, t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root, 'standalone-runtime.json'), JSON.stringify({httpPort: port}));
  const r = f.run(block('HTTP TRANSITION') + '\nexisting_http_port');
  assert.equal(r.status, 42, r.stderr);
});
test('fresh setup selects8080 without reading a prior marker', available, t => {
  const f = fixture(t), r = f.run(block('HTTP TRANSITION') + '\nexisting_http_port', {PHASE: 'none'});
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, '8080');
});

const processStubs = String.raw`
fixture_launchctl(){ printf '%s\n' "$*" >> "$STATE/service-calls"; touch "$STATE/stopped"; }
fixture_lsof(){
 if [ "$1" = -a ]; then
  case "$3" in
   80) printf 'n/Applications/XAMPP/xamppfiles/bin/httpd\n';;
   8080) if [ "$TARGET" = owned ]; then printf 'n/Library/Lightem/runtime/123/bin/httpd\n'; else printf 'n/another/server/httpd\n'; fi;;
  esac
  return
 fi
 local arg port=''
 for arg in "$@"; do case "$arg" in -iTCP:*) port="${'${arg#-iTCP:}'}";; esac; done
 printf '%s\n' "$port" >> "$STATE/port-checks"
 [ "$TARGET" != error ] || return 2
 if [ "$port" = 80 ]; then printf '80\n'; return; fi
 if [ "$port" = 8080 ] && [ "$TARGET" != empty ]; then printf '8080\n'; return; fi
 return 1
}
fixture_ps(){
 if [ ! -f "$STATE/stopped" ] || [ "$WORKERS" = stuck ]; then printf '/Library/Lightem/runtime/123/bin/httpd -DFOREGROUND\n'; fi
 printf '/Applications/XAMPP/xamppfiles/bin/httpd -k start\n'
}
`;
const transition = block('HTTP TRANSITION');
const transitionCall = String.raw`
check_http_destination
stop_private_http
ACTIVE_HTTP_PORT="$HTTP_PORT"
check_http_destination
`;
test('80-to8080 transition stops only owned Apache while XAMPP keeps port80', available, t => {
  const f = fixture(t), r = f.run(processStubs + processCode + transition + transitionCall,
    {ACTIVE_HTTP_PORT: '80', TARGET: 'empty', WORKERS: 'exit'});
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(f.root, 'service-calls'), 'utf8'), 'bootout system/com.lightem.standalone.http\n');
  assert.equal(fs.readFileSync(path.join(f.root, 'port-checks'), 'utf8'), '8080\n80\n8080\n');
});
for (const target of ['foreign', 'error']) test(`destination8080 ${target} fails before any service changes`, available, t => {
  const f = fixture(t), r = f.run(processStubs + processCode + transition + transitionCall,
    {ACTIVE_HTTP_PORT: '80', TARGET: target, WORKERS: 'exit'});
  assert.equal(r.status, 42, r.stderr); assert.equal(fs.existsSync(path.join(f.root, 'service-calls')), false);
});
test('remaining owned workers prevent transition even with an unrelated port80 listener', available, t => {
  const f = fixture(t), r = f.run(processStubs + processCode + transition + transitionCall,
    {ACTIVE_HTTP_PORT: '80', TARGET: 'empty', WORKERS: 'stuck'});
  assert.equal(r.status, 42, r.stderr); assert.match(r.stderr, /private web server did not stop/);
});

const endpoint = block('DESKTOP ENDPOINT');
const localCases = [
  ['http://localhost', 'http://localhost'], ['http://127.0.0.1:80', 'http://127.0.0.1:80'],
  ['http://[::1]/', 'http://[::1]/'], ['http://localhost:8080', 'http://localhost:8080'],
  ['legacy backslashes', String.raw`http:\\localhost`], ['empty LOCAL', ''],
];
for (const [name, origin] of localCases) test(`desktop local endpoint updates: ${name}`, available, t => {
  const f = fixture(t), file = path.join(f.app, 'Contents/Resources/ip.txt');
  fs.writeFileSync(file, `LOCAL: ${origin}\r\nWEB: https://cloud.example.test\r\nTENANT: STORE-42\r\n`);
  const r = f.run(endpoint + '\nset_desktop_local_endpoint');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(file, 'utf8'), 'LOCAL: http://localhost:8080\r\nWEB: https://cloud.example.test\r\nTENANT: STORE-42\r\n');
});
for (const origin of ['http://192.168.1.50', 'https://localhost', 'http://localhost:8090', 'http://localhost/api', 'http://example.test', 'http://user:pass@localhost', 'http://localhost?route=1', 'not-an-origin']) {
  test(`intentional or invalid desktop endpoint is preserved: ${origin}`, available, t => {
    const f = fixture(t), file = path.join(f.app, 'Contents/Resources/ip.txt'), contents = `LOCAL: ${origin}\nWEB: https://cloud.example.test\nTENANT: T\n`;
    fs.writeFileSync(file, contents); const r = f.run(endpoint + '\nset_desktop_local_endpoint');
    assert.equal(r.status, 0, r.stderr); assert.equal(fs.readFileSync(file, 'utf8'), contents);
  });
}
test('ambiguous desktop LOCAL entries stop setup without rewriting settings', available, t => {
  const f = fixture(t), file = path.join(f.app, 'Contents/Resources/ip.txt'), contents = 'LOCAL: http://localhost\nLOCAL: http://remote.test\n';
  fs.writeFileSync(file, contents); const r = f.run(endpoint + '\nset_desktop_local_endpoint');
  assert.equal(r.status, 42, r.stderr); assert.equal(fs.readFileSync(file, 'utf8'), contents);
});

test('rollback restores old configuration without starting it on XAMPP-owned port80', available, t => {
  const f = fixture(t), backup = path.join(f.root, 'backups/attempt'), services = path.join(f.root, 'services');
  for (const dir of [backup, services, path.join(f.root, 'data'), path.join(f.root, 'config'), path.join(backup, 'config')]) fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(f.root, 'data/store'), 'private sales unchanged');
  fs.writeFileSync(path.join(f.root, 'config/httpd.conf'), 'Listen8080');
  fs.writeFileSync(path.join(backup, 'config/httpd.conf'), 'Listen80');
  for (const kind of ['http', 'database']) fs.writeFileSync(path.join(backup, `com.lightem.standalone.${kind}.plist`), kind);
  const cleanup = source.slice(source.indexOf('cleanup() {'), source.indexOf('\ntrap cleanup EXIT'))
    .replaceAll('/Library/LaunchDaemons/', services + '/').replaceAll('/bin/launchctl', 'fixture_launchctl');
  const code = cleanup + String.raw`
stop_service(){ printf '%s\n' "$*" >> "$STATE/stops"; }
port_belongs_to(){ [ "$1" != 80 ]; }
fixture_launchctl(){ printf '%s\n' "$*" >> "$STATE/launches"; }
exec 3>&2
trap - ERR
set +e
false
cleanup
`;
  const r = f.run(code, {BACKUP: backup, CHANGED: '1', MODE: 'update', APP_CHANGED: '0', PROVISIONED: '1',
    ACTIVE_HTTP_PORT: '8080', EXISTING_HTTP_PORT: '80', PHPMYADMIN: path.join(f.root, 'phpmyadmin'), STEP: 'fixture', LOG: '/fixture.log'});
  assert.equal(r.status, 1, r.stderr);
  assert.equal(fs.readFileSync(path.join(f.root, 'config/httpd.conf'), 'utf8'), 'Listen80');
  assert.equal(fs.readFileSync(path.join(f.root, 'data/store'), 'utf8'), 'private sales unchanged');
  assert.equal(fs.readFileSync(path.join(f.root, 'stops'), 'utf8'), 'http 8080\ndatabase 3307\n');
  assert.equal(fs.readFileSync(path.join(f.root, 'launches'), 'utf8'), `bootstrap system ${services}/com.lightem.standalone.database.plist\n`);
  assert.match(r.stdout, /port 80 is now occupied/);
});

test('Mac installer never controls XAMPP services or executes XAMPP PHP', () => {
  assert.doesNotMatch(source, /\$LEGACY\/(?:xampp|bin\/php)|com\.lightem\.xampp\./);
  assert.match(source, /check_legacy_source verify/);
  assert.match(source, /if \[ "\$MODE" = migrate \]; then\n  check_legacy_source\n/);
});

const legacyStubs = String.raw`
port_pids(){ [ "$1" = 3306 ] || exit 99; [ "$SOURCE_STATUS" != stopped ] || return 0; printf '3306'; }
port_belongs_to(){ [ "$1" = 3306 ] && [ "$2" = "$LEGACY" ] && [ "$SOURCE_STATUS" != foreign ]; }
`;
function sourceFixture(t, settings, status = 'running') {
  const f = fixture(t), payload = path.join(f.root, 'payload'), legacy = path.join(f.root, 'XAMPP');
  fs.mkdirSync(payload); fs.mkdirSync(path.join(legacy, 'htdocs'), {recursive: true});
  fs.writeFileSync(path.join(legacy, 'htdocs/settings.json'), JSON.stringify(settings));
  // Only dependencies are replaced. The production shell and inline PHP guard
  // execute unchanged, with a PDO subtype that cannot contact a live server.
  fs.writeFileSync(path.join(payload, 'verify.php'), `<?php
class LightemSetupException extends RuntimeException {}
class FixturePdo extends PDO { public function __construct() {} }
function lightemRoot(string $root): string { return $root; }
function lightemSettings(string $root): array { return [[],json_decode(file_get_contents($root.'/settings.json'),true)]; }
function lightemDatabasePort(mixed $value): int { return (int)$value; }
function lightemConnect(array $settings,?string $database=null): PDO {
  file_put_contents(getenv('STATE').'/connection.json',json_encode([$settings,$database]));
  return new FixturePdo();
}
function lightemVerifyInstallation(string $root,string $payload,bool $before,bool $allow,callable $connect): array {
  [, $settings]=lightemSettings($root);$connect($settings,'db_cnc_pos');return ['success'=>true];
}
function lightemFail(Throwable $error): never { fwrite(STDERR,$error->getMessage());exit(1); }
`);
  const result = f.run(legacyStubs + block('LEGACY COPY CHECKS') + '\ncheck_legacy_source verify',
    {PAYLOAD: payload, LEGACY: legacy, SOURCE_STATUS: status});
  return {...f, result};
}
for (const host of ['localhost', '127.0.0.1']) test(`source preflight forces local TCP3306 for ${host}`, available, t => {
  const f = sourceFixture(t, {host, port: 3306, db: 'db_cnc_pos'});
  assert.equal(f.result.status, 0, f.result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root, 'connection.json'))), [{host: '127.0.0.1', port: 3306, db: 'db_cnc_pos'}, 'db_cnc_pos']);
});
for (const settings of [{host: 'remote.example.test'}, {host: 'localhost', port: 3307}, {host: '127.0.0.1', port: 3333}]) {
  test(`source configuration rejected before connecting: ${JSON.stringify(settings)}`, available, t => {
    const f = sourceFixture(t, settings);
    assert.equal(f.result.status, 42, f.result.stderr);
    assert.equal(fs.existsSync(path.join(f.root, 'connection.json')), false);
    assert.match(f.result.stderr, /no remote or custom-port database was contacted/);
  });
}
for (const status of ['stopped', 'foreign']) test(`source database ${status} is not started or contacted`, available, t => {
  const f = sourceFixture(t, {host: 'localhost'}, status);
  assert.equal(f.result.status, 42, f.result.stderr);
  assert.equal(fs.existsSync(path.join(f.root, 'connection.json')), false);
});
