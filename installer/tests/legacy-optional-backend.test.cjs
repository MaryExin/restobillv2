'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const source = path.resolve(__dirname, '../../backend/api');
const runtimeRoot = '/Library/Lightem/runtime';
const candidates = [process.env.LIGHTEM_TEST_PHP, 'php',
  ...(fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot).sort().reverse().map(name => path.join(runtimeRoot, name, 'bin/php')) : []),
  '/Applications/XAMPP/xamppfiles/bin/php'].filter(Boolean);
const php = candidates.find(binary => spawnSync(binary, ['-r', 'exit(PHP_VERSION_ID >= 80200 && class_exists("PDO") ? 0 : 1);']).status === 0);
const mapping = 'tbl_pos_discount_type_sales_type';
const archive = 'tbl_pos_zreading_archive_log';

// These PDO subclasses never open a connection. Every attempted SQL operation
// is recorded; unrecognized statements fail the fixture rather than reaching a DB.
const fakePdo = `<?php
$GLOBALS['fixtureEvents'] = [];
register_shutdown_function(function () {
    file_put_contents(getenv('LIGHTEM_FIXTURE_EVENTS'), json_encode([
        'status' => http_response_code() ?: 200,
        'events' => $GLOBALS['fixtureEvents'],
    ]));
});
final class OptionalFixtureStatement extends PDOStatement {
    public function __construct(private array $rows = [], private mixed $column = false) {}
    public function execute(?array $params = null): bool {
        $GLOBALS['fixtureEvents'][] = ['execute', $params];
        return true;
    }
    public function fetchColumn(int $column = 0): mixed { return $this->column; }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array { return $this->rows; }
}
final class OptionalFixtureMetadataStatement extends PDOStatement {
    private string $table = '';
    public function __construct(private array $config) {}
    public function execute(?array $params = null): bool {
        $this->table = $params[0];
        $GLOBALS['fixtureEvents'][] = ['metadata', $this->table];
        return true;
    }
    public function fetchColumn(int $column = 0): mixed {
        return in_array($this->table, $this->config['present'] ?? [], true) ? $this->table : false;
    }
}
final class OptionalFixturePdo extends PDO {
    public array $config;
    public function __construct(?array $config = null) {
        $this->config = $config ?? json_decode(getenv('LIGHTEM_FIXTURE_CONFIG'), true);
    }
    public function prepare(string $query, array $options = []): PDOStatement|false {
        $GLOBALS['fixtureEvents'][] = ['prepare', $query];
        if (str_contains($query, 'information_schema.TABLES')) {
            if (!str_contains($query, 'TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?')) {
                throw new RuntimeException('Metadata probe is not scoped to this database and table.');
            }
            if (!empty($this->config['metadataError'])) throw new PDOException('Metadata unavailable');
            return new OptionalFixtureMetadataStatement($this->config);
        }
        return $this->read($query);
    }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        $GLOBALS['fixtureEvents'][] = ['query', $query];
        return $this->read($query);
    }
    private function read(string $query): PDOStatement {
        if (str_contains($query, 'tbl_pos_discount_type_sales_type')) {
            if (!in_array('tbl_pos_discount_type_sales_type', $this->config['present'] ?? [], true)) {
                throw new PDOException('Missing table must not be queried.');
            }
            if (!empty($this->config['missingColumn'])) throw new PDOException('Unknown column percent_value');
            return new OptionalFixtureStatement(str_contains($query, 'JOIN')
                ? [['id' => 7, 'discount_name' => 'Custom discount', 'percent' => '5.00']]
                : [['discount_type_id' => 7, 'sales_type_id' => 'SALE-1', 'is_active' => 1, 'percent_value' => '5.00']]);
        }
        if (str_contains($query, 'FROM lkp_discount_type')) {
            return new OptionalFixtureStatement([['id' => 7, 'discount_name' => 'Custom discount']]);
        }
        if (str_contains($query, 'FROM lkp_sales_type')) {
            return new OptionalFixtureStatement([['sales_type_id' => 'SALE-1', 'sales_type' => 'DINE IN']]);
        }
        throw new RuntimeException('Unexpected SQL in read-only fixture: ' . $query);
    }
    public function exec(string $statement): int|false {
        $GLOBALS['fixtureEvents'][] = ['exec', $statement];
        if (!str_starts_with($statement, 'TRUNCATE TABLE ')) throw new RuntimeException('Unexpected mutation');
        if (str_contains($statement, 'required_missing')) throw new PDOException('Required table is missing');
        return 0;
    }
}
$pdo = new OptionalFixturePdo();
`;

function fixture(t, config = {}, request = {}, script = null) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lightem-optional-backend-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ['pos_discount_types.php', 'pos_legacy_optional_tables.php']) fs.copyFileSync(path.join(source, name), path.join(root, name));
  fs.writeFileSync(path.join(root, 'pdo.php'), fakePdo);
  fs.writeFileSync(path.join(root, 'secure_guard.php'), '<?php $GLOBALS["pos_user_id"] = "fixture-user";');
  fs.writeFileSync(path.join(root, 'pos_role_authorization.php'), `<?php
function posRoleAuthRequirePermission(PDO $pdo, string $user, string $section, string $permission): void {
    $GLOBALS['fixtureEvents'][] = ['authorize', $user, $section, $permission];
    if (!empty($pdo->config['denyAuthorization'])) {
        http_response_code(403); echo json_encode(['success' => false, 'message' => 'Denied']); exit;
    }
}`);
  const wrapper = script || `<?php
$_SERVER['REQUEST_METHOD'] = getenv('LIGHTEM_FIXTURE_METHOD');
$_GET = json_decode(getenv('LIGHTEM_FIXTURE_QUERY'), true);
require __DIR__ . '/pos_discount_types.php';
`;
  fs.writeFileSync(path.join(root, 'run.php'), wrapper);
  const eventsFile = path.join(root, 'events.json');
  const result = spawnSync(php, [path.join(root, 'run.php')], { encoding: 'utf8', env: { ...process.env,
    LIGHTEM_FIXTURE_CONFIG: JSON.stringify(config), LIGHTEM_FIXTURE_EVENTS: eventsFile,
    LIGHTEM_FIXTURE_METHOD: request.method || 'GET', LIGHTEM_FIXTURE_QUERY: JSON.stringify(request.query || {}),
  } });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  return { body: JSON.parse(result.stdout), ...JSON.parse(fs.readFileSync(eventsFile, 'utf8')) };
}
function phpTest(name, fn) { test(name, { skip: !php && 'PHP 8.2+ with PDO is required for isolated fixtures' }, fn); }

phpTest('legacy discount settings remain readable with explicit unavailable flag and no mappings', t => {
  const result = fixture(t);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.custom_discount_setup_available, false);
  assert.deepEqual(result.body.data.mappings, []);
  assert.equal(result.body.data.discount_types[0].id, 7, 'master types are not reset or hidden');
  assert.ok(result.events.every(event => event[0] !== 'exec'));
});

phpTest('legacy sales-type lookup offers no invented custom discounts', t => {
  const result = fixture(t, {}, { query: { sales_type_description: 'DINE IN' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data, { discount_types: [], custom_discount_setup_available: false });
  assert.ok(result.events.every(event => event[0] !== 'query'), 'missing mappings do not enable every master discount');
});

phpTest('legacy POST is rejected after authorization and before any mutation or payload action', t => {
  const result = fixture(t, {}, { method: 'POST' });
  assert.equal(result.status, 409);
  assert.equal(result.body.success, false);
  assert.equal(result.body.data.custom_discount_setup_available, false);
  assert.match(result.body.message, /database does not support custom discount setup/);
  assert.deepEqual(result.events[0], ['authorize', 'fixture-user', 'settings', 'discountMode']);
  assert.ok(result.events.every(event => !['query', 'exec'].includes(event[0])));
});

phpTest('unauthorized POST never probes schema or writes data', t => {
  const result = fixture(t, { denyAuthorization: true }, { method: 'POST' });
  assert.equal(result.status, 403);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0][0], 'authorize');
});

phpTest('available mappings preserve existing full-state and active-discount results', t => {
  const full = fixture(t, { present: [mapping] });
  assert.equal(full.body.data.custom_discount_setup_available, true);
  assert.equal(full.body.data.mappings[0].percent_value, '5.00');
  const active = fixture(t, { present: [mapping] }, { query: { sales_type_id: 'SALE-1' } });
  assert.equal(active.body.data.custom_discount_setup_available, true);
  assert.equal(active.body.data.discount_types[0].percent, '5.00');
  assert.ok(active.events.some(event => event[0] === 'execute' && event[1][':sales_type_id'] === 'SALE-1'));
});

phpTest('present but incomplete mappings and metadata failures remain errors', t => {
  for (const config of [{ present: [mapping], missingColumn: true }, { metadataError: true }]) {
    const result = fixture(t, config);
    assert.equal(result.status, 500);
    assert.equal(result.body.success, false);
    assert.equal(result.body.data, null);
  }
});

phpTest('reset skips only confirmed absent optional tables, independently for each database', t => {
  const result = fixture(t, {}, {}, `<?php
require __DIR__ . '/pdo.php';
require __DIR__ . '/pos_legacy_optional_tables.php';
$primary = new OptionalFixturePdo(['present' => ['tbl_pos_discount_type_sales_type']]);
$report = new OptionalFixturePdo(['present' => ['tbl_pos_zreading_archive_log']]);
foreach ([$primary, $report] as $db) {
    posTruncateExistingResetTable($db, 'tbl_pos_discount_type_sales_type');
    posTruncateExistingResetTable($db, 'tbl_pos_zreading_archive_log');
    posTruncateExistingResetTable($db, 'tbl_pos_transactions');
}
try { posTruncateExistingResetTable($primary, 'required_missing'); }
catch (PDOException $e) { echo json_encode(['requiredStillFails' => true]); }
`);
  assert.equal(result.body.requiredStillFails, true);
  assert.deepEqual(result.events.filter(event => event[0] === 'exec').map(event => event[1]), [
    'TRUNCATE TABLE `tbl_pos_discount_type_sales_type`;', 'TRUNCATE TABLE `tbl_pos_transactions`;',
    'TRUNCATE TABLE `tbl_pos_zreading_archive_log`;', 'TRUNCATE TABLE `tbl_pos_transactions`;',
    'TRUNCATE TABLE `required_missing`;',
  ]);
  assert.deepEqual(result.events.filter(event => event[0] === 'metadata').map(event => event[1]), [mapping, archive, mapping, archive]);
  const reset = fs.readFileSync(path.join(source, 'pos_db_reset_api.php'), 'utf8');
  assert.match(reset, /foreach \(\$tables as \$table\) \{\s+posTruncateExistingResetTable\(\$pdo, \$table\);/);
  assert.match(reset, /foreach \(\$reportTables as \$table\) \{\s+posTruncateExistingResetTable\(\$reportPdo, \$table\);/);
});

phpTest('reset metadata errors propagate without truncating an optional table', t => {
  const result = fixture(t, { metadataError: true }, {}, `<?php
require __DIR__ . '/pdo.php';
require __DIR__ . '/pos_legacy_optional_tables.php';
try { posTruncateExistingResetTable($pdo, 'tbl_pos_zreading_archive_log'); }
catch (PDOException $e) { echo json_encode(['failed' => true]); }
`);
  assert.equal(result.body.failed, true);
  assert.equal(result.events.filter(event => event[0] === 'exec').length, 0);
});
