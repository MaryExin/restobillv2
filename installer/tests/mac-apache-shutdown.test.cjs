const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourcePath = path.join(__dirname, '../mac/postinstall');
const shellQuote = value => `'${value.replace(/'/g, `'\\''`)}'`;
const macOnly = { skip: process.platform !== 'darwin' };

async function fixture(t, stopExit = 0) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lightem-apache-shutdown-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = await fs.readFile(sourcePath, 'utf8');
  const start = source.indexOf('# BEGIN APACHE SHUTDOWN');
  const end = source.indexOf('# END APACHE SHUTDOWN');
  assert.ok(start >= 0 && end > start, 'The isolated Apache shutdown block must exist');
  const shutdown = source.slice(start, end);
  const guardStart = source.indexOf("step 'Stopping Apache before installing backend'");
  const guardEnd = source.indexOf('\nCHANGED=1', guardStart);
  assert.ok(guardStart >= 0 && guardEnd > guardStart, 'Backend changes must follow a shutdown guard');
  const mainGuard = source.slice(guardStart, guardEnd + '\nCHANGED=1'.length);
  await fs.mkdir(path.join(root, 'xampp'));
  await fs.writeFile(path.join(root, 'xampp/xampp'), `#!/bin/bash
printf '%s\\n' "$1" >> "$EVENTS"
exit ${stopExit}
`, { mode: 0o700 });

  async function run({ listenerUntil = 0, processesUntil = 0, listenerError = 0, processError = 0, stop = false, guard = false } = {}) {
    const action = guard ? `(
step() { :; }
die() { exit 1; }
CHANGED=0
${mainGuard}
# This fixture represents the first backend write after the production guard.
printf 'replacement allowed\\n' > "$XAMPP/backend-write"
printf 'backend-write\\n' >> "$EVENTS"
)` : stop ? 'stop_apache_and_wait' : 'wait_for_apache_shutdown';
    const result = spawnSync('/bin/bash', ['-c', `
set -Eeuo pipefail
XAMPP=${shellQuote(path.join(root, 'xampp'))}
export EVENTS=${shellQuote(path.join(root, 'events'))}
: > "$EVENTS"
APACHE_STOP_REQUESTED=0
TICK=0
say() { :; }
${shutdown}
# Override both production probes before invoking anything. No real process or
# network inspection, service commands, filesystem replacement, or waits run.
apache_listener_present() {
  printf 'listener:%s\\n' "$TICK" >> "$EVENTS"
  if [ ${listenerError} -gt 1 ]; then return ${listenerError}; fi
  [ "$TICK" -lt ${listenerUntil} ]
}
apache_processes_present() {
  printf 'processes:%s\\n' "$TICK" >> "$EVENTS"
  if [ ${processError} -gt 1 ]; then return ${processError}; fi
  [ "$TICK" -lt ${processesUntil} ]
}
sleep() {
  [ "$#" -eq 1 ] && [ "$1" = 1 ] || return 64
  TICK=$((TICK + 1))
  printf 'sleep:%s\\n' "$TICK" >> "$EVENTS"
}
if ${action}; then RESULT=0; else RESULT=$?; fi
printf 'RESULT %s %s %s\\n' "$RESULT" "$TICK" "$APACHE_STOP_REQUESTED"
`], { encoding: 'utf8', timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const values = result.stdout.match(/^RESULT (\d+) (\d+) (\d+)$/m);
    assert.ok(values, `Missing harness result: ${result.stdout}`);
    return {
      status: Number(values[1]),
      sleeps: Number(values[2]),
      stopRequested: Number(values[3]),
      events: (await fs.readFile(path.join(root, 'events'), 'utf8')).trim().split('\n'),
      backendWritten: await fs.stat(path.join(root, 'xampp/backend-write')).then(() => true, error => {
        if (error.code === 'ENOENT') return false;
        throw error;
      }),
    };
  }
  return { run };
}

test('Mac Apache shutdown returns immediately when listeners and workers have exited', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run();
  assert.equal(result.status, 0);
  assert.equal(result.sleeps, 0);
  assert.equal(result.stopRequested, 0);
  assert.ok(result.events.includes('listener:0'));
  assert.ok(result.events.includes('processes:0'));
});

test('Mac Apache shutdown waits for a delayed port release', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ listenerUntil: 3, processesUntil: 1 });
  assert.equal(result.status, 0);
  assert.equal(result.sleeps, 3);
  assert.ok(result.events.includes('listener:3'));
  assert.ok(result.events.includes('processes:3'));
});

test('Mac Apache shutdown waits for remaining workers after the port has closed', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ processesUntil: 5 });
  assert.equal(result.status, 0);
  assert.equal(result.sleeps, 5);
  assert.ok(result.events.includes('processes:5'));
});

test('Mac Apache shutdown has a bounded timeout for a persistent listener', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ listenerUntil: 100 });
  assert.equal(result.status, 1);
  assert.equal(result.sleeps, 30);
});

test('Mac Apache shutdown has a bounded timeout for persistent workers', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ processesUntil: 100 });
  assert.equal(result.status, 1);
  assert.equal(result.sleeps, 30);
});

test('Mac Apache shutdown rejects a listener inspection failure', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ listenerError: 2 });
  assert.equal(result.status, 2);
  assert.equal(result.sleeps, 0);
});

test('Mac Apache shutdown rejects a process inspection failure', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ processError: 3 });
  assert.equal(result.status, 2);
  assert.equal(result.sleeps, 0);
});

test('Mac Apache stop requests shutdown before waiting for completion', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ stop: true, listenerUntil: 2, processesUntil: 4 });
  assert.equal(result.status, 0);
  assert.equal(result.stopRequested, 1);
  assert.equal(result.sleeps, 4);
  assert.equal(result.events[0], 'stopapache');
  assert.equal(result.events.filter(event => event === 'stopapache').length, 1);
});

test('Mac Apache stop preserves a service-command failure without polling', macOnly, async t => {
  const { run } = await fixture(t, 63);
  const result = await run({ stop: true });
  assert.equal(result.status, 63);
  assert.equal(result.stopRequested, 1);
  assert.equal(result.sleeps, 0);
  assert.deepEqual(result.events, ['stopapache']);
});

test('Mac backend installation stays untouched when Apache shutdown times out', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ guard: true, listenerUntil: 100 });
  assert.equal(result.status, 1);
  assert.equal(result.backendWritten, false);
  assert.equal(result.events.filter(event => event.startsWith('sleep:')).length, 30);
});

test('Mac backend installation proceeds only after delayed Apache shutdown completes', macOnly, async t => {
  const { run } = await fixture(t);
  const result = await run({ guard: true, listenerUntil: 2, processesUntil: 4 });
  assert.equal(result.status, 0);
  assert.equal(result.backendWritten, true);
  assert.equal(result.events[0], 'stopapache');
  assert.equal(result.events.at(-1), 'backend-write');
  assert.ok(result.events.indexOf('processes:4') < result.events.indexOf('backend-write'));
});
