'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const runtimeRoot = '/Library/Lightem/runtime';
const candidates = [process.env.LIGHTEM_TEST_PHP, 'php',
  ...(fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot).sort().reverse().map(name => path.join(runtimeRoot, name, 'bin/php')) : []),
  '/Applications/XAMPP/xamppfiles/bin/php'].filter(Boolean);
const php = candidates.find(binary => spawnSync(binary, ['-n', '-r', 'exit(PHP_VERSION_ID >= 80200 && class_exists("PDO") ? 0 : 1);']).status === 0);
const fixture = path.join(__dirname, 'schema-compatibility.fixture.php');
const schemas = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../schema/schema-manifest.json'), 'utf8')).schemas;
const optional = ['tbl_pos_discount_type_sales_type', 'tbl_pos_zreading_archive_log'];

function run(kind, change, allow) {
  const required = schemas[kind].tables;
  const present = structuredClone(required);
  change(present);
  const input = { database: kind === 'primary' ? 'db_cnc_pos' : 'reports_database', kind, required, present };
  if (allow !== undefined) input.allow = allow;
  const result = spawnSync(php, ['-n', fixture], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.reads, 1, 'verification issues only one metadata SELECT and no database writes');
  return output;
}
function phpTest(name, fn) { test(name, { skip: !php && 'PHP 8.2+ with PDO is required for connection-free schema fixtures' }, fn); }

phpTest('complete fresh schemas pass strict verification for primary and reports', () => {
  for (const kind of ['primary', 'report']) assert.deepEqual(run(kind, () => {}), { success: true, unavailable: [], reads: 1 });
});
phpTest('strict verification requires both feature tables unless compatibility is explicitly enabled', () => {
  for (const kind of ['primary', 'report']) {
    for (const allow of [undefined, false]) {
      const result = run(kind, present => optional.forEach(name => delete present[name]), allow);
      assert.equal(result.success, false);
      for (const table of optional) assert.ok(result.message.includes(table));
      assert.match(result.message, /No schema was changed/);
    }
  }
});
phpTest('legacy compatibility accepts each absent optional table and both together', () => {
  for (const kind of ['primary', 'report']) {
    for (const missing of [[optional[0]], [optional[1]], optional]) {
      const result = run(kind, present => missing.forEach(name => delete present[name]), true);
      assert.deepEqual(result, { success: true, unavailable: missing, reads: 1 });
    }
  }
});
phpTest('legacy compatibility rejects incomplete columns on an existing optional table', () => {
  for (const kind of ['primary', 'report']) {
    for (const table of optional) {
      const removed = schemas[kind].tables[table].at(-1);
      const result = run(kind, present => present[table].pop(), true);
      assert.equal(result.success, false);
      assert.ok(result.message.includes(`${table}.${removed}`));
    }
  }
});
phpTest('legacy compatibility still rejects absent required tables and core columns', () => {
  for (const kind of ['primary', 'report']) {
    const table = 'tbl_pos_transactions';
    const missingTable = run(kind, present => { optional.forEach(name => delete present[name]); delete present[table]; }, true);
    assert.equal(missingTable.success, false);
    assert.ok(missingTable.message.includes(table));
    const column = schemas[kind].tables[table].at(-1);
    const missingColumn = run(kind, present => { optional.forEach(name => delete present[name]); present[table].pop(); }, true);
    assert.equal(missingColumn.success, false);
    assert.ok(missingColumn.message.includes(`${table}.${column}`));
  }
});
phpTest('extra store tables and columns are accepted without rewriting their schema', () => {
  for (const kind of ['primary', 'report']) {
    const result = run(kind, present => {
      present.customer_extension_table = ['id', 'value'];
      present.tbl_pos_transactions.push('custom_store_column');
    }, true);
    assert.deepEqual(result, { success: true, unavailable: [], reads: 1 });
  }
});
