<?php
declare(strict_types=1);

// This integration test refuses to run outside a dedicated, socket-only test
// datadir. Initialize a disposable MariaDB first; never use the installed DB.
require_once __DIR__ . '/../common/provision.php';
require_once __DIR__ . '/../common/recover.php';

$options = getopt('', ['test-socket:', 'backend:']);
$socket = (string)($options['test-socket'] ?? '');
$backend = realpath((string)($options['backend'] ?? ''));
$base = realpath(dirname($socket));
if ($base === false || !preg_match('~/lightem-installer-dbtest-[A-Za-z0-9_-]+$~', $base) || basename($socket) !== 'mysql.sock' || $backend === false) {
    fwrite(STDERR, "Use --test-socket in a dedicated /tmp/lightem-installer-dbtest-* directory and --backend with a staged backend.\n");
    exit(1);
}
$connect = static function (array $config, ?string $database = null) use ($socket): PDO {
    return new PDO('mysql:unix_socket=' . $socket . ($database === null ? '' : ';dbname=' . $database) . ';charset=utf8mb4', $config['user'], $config['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
};
$admin = $connect(['user' => 'root', 'pass' => '']);
if (rtrim(realpath((string)$admin->query('SELECT @@datadir')->fetchColumn()) ?: '', '/') !== $base . '/data' || (int)$admin->query('SELECT @@skip_networking')->fetchColumn() !== 1) {
    throw new RuntimeException('Refusing tests: database must use the dedicated datadir with networking disabled.');
}
foreach (['db_cnc_pos', 'reports_database'] as $database) {
    $exists = $admin->prepare('SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
    $exists->execute([$database]);
    if ((int)$exists->fetchColumn() !== 0) throw new RuntimeException('Tests require an unused isolated database instance.');
}
$testCount = 0;
function check(bool $ok, string $name): void {
    global $testCount;
    if (!$ok) throw new RuntimeException('FAIL: ' . $name);
    $testCount++;
    echo 'PASS ' . $name . PHP_EOL;
}
function rejects(callable $callback, string $fragment, string $name): void {
    try { $callback(); } catch (LightemSetupException $error) {
        check(str_contains($error->getMessage(), $fragment), $name);
        return;
    }
    throw new RuntimeException('FAIL: ' . $name . ' did not reject');
}
function copyTree(string $source, string $target): void {
    if (!is_dir($target)) mkdir($target, 0700, true);
    foreach (new DirectoryIterator($source) as $entry) {
        if ($entry->isDot()) continue;
        $destination = $target . '/' . $entry->getFilename();
        if ($entry->isDir()) copyTree($entry->getPathname(), $destination);
        else copy($entry->getPathname(), $destination);
    }
}
// Existing-store checks and updates must never issue DDL/DML. This connection
// fails before any non-SELECT statement can reach the disposable database.
class ReadOnlySetupConnection extends PDO {
    public static array $queries = [];
    private function recordRead(string $sql): void {
        if (!preg_match('/\ASELECT\s/i', $sql)) throw new RuntimeException('Existing-store update attempted a database write.');
        self::$queries[] = $sql;
    }
    public function prepare(string $query, array $options = []): PDOStatement|false {
        $this->recordRead($query);
        return parent::prepare($query, $options);
    }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        $this->recordRead($query);
        return $fetchMode === null ? parent::query($query) : parent::query($query, $fetchMode, ...$fetchModeArgs);
    }
    public function exec(string $statement): int|false {
        throw new RuntimeException('Existing-store update attempted an exec statement.');
    }
}
function databaseSnapshot(PDO $connection): array {
    $snapshot = [];
    foreach ($connection->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $identifier = lightemIdentifier((string)$table);
        $definition = $connection->query('SHOW CREATE TABLE ' . $identifier)->fetch(PDO::FETCH_NUM)[1];
        $rows = array_map(static fn(array $row): string => serialize($row), $connection->query('SELECT * FROM ' . $identifier)->fetchAll());
        sort($rows, SORT_STRING);
        $snapshot[$table] = ['definition' => $definition, 'rows' => $rows];
    }
    ksort($snapshot, SORT_STRING);
    return $snapshot;
}
$fixture = $base . '/fixtures-' . bin2hex(random_bytes(4));
mkdir($fixture, 0700);
$root = $fixture . '/htdocs';
copyTree($backend, $root);
foreach (['uploads', 'item_pictures', 'api/images'] as $dir) if (!is_dir($root . '/' . $dir)) mkdir($root . '/' . $dir, 0700, true);
$payload = $fixture . '/payload';
copyTree(__DIR__ . '/../schema', $payload . '/database');
$manifest = ['version' => 'test-1', 'buildId' => 'test-build-1', 'backendSha256' => str_repeat('a', 64)];
file_put_contents($payload . '/manifest.json', json_encode($manifest));
$services = ['connect' => $connect, 'writeRuntimeSecret' => static fn(string $path, string $contents) => lightemWriteFile($path, $contents, 0600, true)];
$credentials = $fixture . '/initial-access.txt';
$args = ['root' => $root, 'payload' => $payload, 'credentials' => $credentials];
$result = lightemProvision($args, $services);
check($result['success'] && $result['mode'] === 'fresh', 'fresh provisioning imports complete schemas');
[$env, $config] = lightemSettings($root);
$primary = $connect($config, $config['db']);
$report = $connect($config, $config['report_db']);
check((int)$primary->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn() === 0 && (int)$report->query('SELECT COUNT(*) FROM tbl_pos_transactions')->fetchColumn() === 0, 'both databases contain no historical transactions');
check((int)$primary->query('SELECT COUNT(*) FROM tbl_users_global_assignment')->fetchColumn() === 1 && (int)$report->query('SELECT COUNT(*) FROM tbl_users_global_assignment')->fetchColumn() === 0, 'only primary receives a fresh admin account');
check((int)$primary->query('SELECT COUNT(*) FROM tbl_pos_permissions')->fetchColumn() > 0, 'permission defaults imported');
check((int)$primary->query('SELECT COUNT(*) FROM lkp_discount_type')->fetchColumn() > 0, 'discount defaults imported');
check($env['WEB_SYNC_DB_HOST'] === '' && $env['MASTER_API_ENDPOINT_PATH'] === '', 'fresh installation disables remote synchronization');
check($env['DB_USER'] !== 'root' && strlen($env['SECRET_KEY']) >= 64, 'dedicated DB user and fresh signing key created');
$login = (string)file_get_contents($result['loginFile']);
preg_match('/^Password: (.+)$/m', $login, $passwordMatch);
$password = $passwordMatch[1] ?? '';
check($password !== '' && !str_contains($login, $env['DB_PASS']) && !str_contains($login, $env['SECRET_KEY']) && !str_contains($login, 'Database'), 'desktop login note contains no DB or signing secrets');
check((fileperms($credentials) & 0777) === 0600 && (fileperms($result['loginFile']) & 0777) === 0600, 'credential outputs are private files');
check(!str_contains(json_encode($result), $password) && !str_contains(json_encode($result), $env['DB_PASS']), 'JSON output contains no credentials');
$database = new class($primary) extends Database {
    public function __construct(private PDO $connection) {}
    public function getConnection(): PDO { return $this->connection; }
};
$gateway = new UserGateway($database);
$user = $gateway->getByUsername('admin');
check(is_array($user) && $user['status'] === 'Active' && (string)$user['classification'] === '2' && password_verify($password, $user['password']), 'actual login gateway accepts new superadmin credentials');
check(is_array($gateway->getRole((string)$user['uuid'])), 'actual login role query works on fresh schema');
check(str_contains((string)file_get_contents($root . '/.htaccess'), 'LIGHTEM INSTALLER PROTECTION') && str_contains((string)file_get_contents($root . '/src/.htaccess'), 'Require all denied'), 'runtime HTTP protection installed');
$verified = lightemVerifyInstallation($root, $payload, false, false, $connect);
check($verified['success'] && $verified['mode'] === 'managed', 'full installed schema verification succeeds');
$envHash = hash_file('sha256', $root . '/.env');
$configHash = hash_file('sha256', $root . '/api/config.php');
$primary->exec('CREATE TABLE installer_test_sentinel (id INT PRIMARY KEY, value VARCHAR(30))');
$primary->exec("INSERT INTO installer_test_sentinel VALUES (1, 'keep existing data')");
$manifest['buildId'] = 'test-build-2';
file_put_contents($payload . '/manifest.json', json_encode($manifest));
$updated = lightemProvision($args, $services);
check($updated['mode'] === 'updated' && $updated['databasePreserved'], 'managed install updates without reimport');
check(hash_file('sha256', $root . '/.env') === $envHash && hash_file('sha256', $root . '/api/config.php') === $configHash && $primary->query('SELECT value FROM installer_test_sentinel')->fetchColumn() === 'keep existing data', 'update preserves credentials, config and existing rows');
check(lightemMarker($root)['buildId'] === 'test-build-2', 'marker records newly installed build');
unlink($root . '/' . LIGHTEM_MARKER);
check(lightemVerifyInstallation($root, $payload, true, false, $connect)['mode'] === 'legacy', 'legacy backend passes read-only preflight');
rejects(fn() => lightemVerifyInstallation($root, $payload, false, false, $connect), 'marker', 'unmanaged backend requires explicit adoption');
$adopted = lightemProvision($args + ['adopt-existing' => false], $services);
check($adopted['mode'] === 'adopted' && hash_file('sha256', $root . '/.env') === $envHash, 'legacy adoption preserves existing settings');
$secondRoot = $fixture . '/second-htdocs';
copyTree($backend, $secondRoot);
// Composer's generated function names are identical across copies. A normal
// installer invokes a new PHP process for each root; reuse the loaded fixture
// autoloader for this in-process test only.
file_put_contents($secondRoot . '/vendor/autoload.php', "<?php require_once " . var_export($root . '/vendor/autoload.php', true) . ";\n");
rejects(fn() => lightemProvision(['root' => $secondRoot, 'payload' => $payload, 'credentials' => $fixture . '/second.txt'], $services), 'contains tables', 'fresh install refuses existing populated databases');
check(!is_file($fixture . '/second.txt') && !is_file($secondRoot . '/.env'), 'refused fresh install writes no credentials or config');

// Reproduce a removed backend with its managed marker still present. The
// installer backup is deliberately legacy/unmarked, as in a first adoption.
// All paths and connections stay in this guarded, disposable test instance.
$brokenRoot = $fixture . '/removed-backend';
mkdir($brokenRoot, 0700);
$recoveryMarker = lightemMarker($root);
$recoveryMarker['buildId'] = '20260926073235';
file_put_contents($brokenRoot . '/' . LIGHTEM_MARKER, json_encode($recoveryMarker, JSON_THROW_ON_ERROR));
$markerHash = hash_file('sha256', $brokenRoot . '/' . LIGHTEM_MARKER);
$backupParent = $fixture . '/protected-backups';
$backupId = '20260926073235-12345';
$backupRoot = $backupParent . '/' . $backupId . '/backend';
copyTree($root, $backupRoot);
unlink($backupRoot . '/' . LIGHTEM_MARKER);
copyTree($backend, $payload . '/backend');
// Reuse the already loaded Composer fixture in this single-process test. A
// real recovery/provision run loads each staged runtime in its own process.
file_put_contents($payload . '/backend/vendor/autoload.php', "<?php require_once " . var_export($root . '/vendor/autoload.php', true) . ";\n");
$recoveryStage = $fixture . '/recovery-stage';
$verificationCount = 0;
$recovery = lightemRecover([
    'root' => $brokenRoot, 'payload' => $payload, 'backups' => $backupParent,
    'destination' => $recoveryStage,
], static function (string $stage, string $stagedPayload, bool $beforeUpdate) use ($connect, &$verificationCount): array {
    $verificationCount++;
    return lightemVerifyInstallation($stage, $stagedPayload, $beforeUpdate, false, $connect);
});
check($recovery['success'] && $recovery['source'] === 'backup' && $recovery['backupId'] === $backupId && $verificationCount === 1, 'removed backend recovers from a verified legacy backup using existing databases');
check(!is_dir($brokenRoot . '/api') && !is_file($brokenRoot . '/.env') && hash_file('sha256', $brokenRoot . '/' . LIGHTEM_MARKER) === $markerHash, 'recovery preflight leaves the incomplete live fixture unchanged');
check(hash_file('sha256', $recoveryStage . '/.env') === $envHash && hash_file('sha256', $recoveryStage . '/api/config.php') === $configHash && hash_file('sha256', $backupRoot . '/.env') === $envHash && !is_file($backupRoot . '/' . LIGHTEM_MARKER), 'recovery stages original credentials without modifying the legacy backup');
check(hash_file('sha256', $recoveryStage . '/' . LIGHTEM_MARKER) === $markerHash && lightemIsLegacy($recoveryStage), 'recovery combines packaged backend with the existing managed marker');
copyTree($recoveryStage, $brokenRoot);
foreach (['uploads', 'item_pictures', 'api/images'] as $dir) if (!is_dir($brokenRoot . '/' . $dir)) mkdir($brokenRoot . '/' . $dir, 0700, true);
$recovered = lightemProvision([
    'root' => $brokenRoot, 'payload' => $payload, 'adopt-existing' => true,
    'credentials' => $fixture . '/recovered-initial-access.txt',
], $services);
check($recovered['success'] && $recovered['databasePreserved'] && $recovered['credentialsPreserved'], 'provisioning accepts the recovered backend through its existing-install path');
check(hash_file('sha256', $brokenRoot . '/.env') === $envHash && hash_file('sha256', $brokenRoot . '/api/config.php') === $configHash && $primary->query('SELECT value FROM installer_test_sentinel')->fetchColumn() === 'keep existing data', 'recovered installation preserves the database sentinel and exact settings');
check(!is_file($fixture . '/recovered-initial-access.txt') && password_verify($password, (string)$primary->query("SELECT password FROM tbl_users_global_assignment WHERE email = 'admin'")->fetchColumn()) && (int)$report->query('SELECT COUNT(*) FROM tbl_users_global_assignment')->fetchColumn() === 0, 'recovery keeps the original login and report data without issuing new credentials');

// Reproduce the earlier standalone database exactly: both feature tables can
// be absent. Their absence must not trigger schema upgrades or erase store data.
$optionalTables = ['tbl_pos_discount_type_sales_type', 'tbl_pos_zreading_archive_log'];
$restoreTables = [];
foreach (['primary' => $primary, 'report' => $report] as $kind => $connection) {
    foreach ($optionalTables as $table) {
        $identifier = lightemIdentifier($table);
        $restoreTables[$kind][$table] = $connection->query('SHOW CREATE TABLE ' . $identifier)->fetch(PDO::FETCH_NUM)[1];
        $connection->exec('DROP TABLE ' . $identifier);
    }
}
$report->exec('CREATE TABLE installer_test_sentinel (id INT PRIMARY KEY, value VARCHAR(30))');
$report->exec("INSERT INTO installer_test_sentinel VALUES (1, 'keep report data')");
$beforePrimary = databaseSnapshot($primary);
$beforeReport = databaseSnapshot($report);
$readOnlyConnect = static function (array $settings, ?string $database = null) use ($socket): PDO {
    return new ReadOnlySetupConnection('mysql:unix_socket=' . $socket . ($database === null ? '' : ';dbname=' . $database) . ';charset=utf8mb4', $settings['user'], $settings['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
};
$readOnlyServices = array_replace($services, ['connect' => $readOnlyConnect]);
$requirements = lightemSchemaRequirements($payload);
rejects(fn() => lightemVerifySchema($primary, $config['db'], $requirements['primary']['tables'], 'primary'), $optionalTables[0], 'fresh schema verification still requires both optional feature tables');
foreach ([true => 'preflight', false => 'post-install'] as $before => $label) {
    $legacyVerified = lightemVerifyInstallation($root, $payload, (bool)$before, false, $readOnlyConnect);
    check($legacyVerified['success'] && $legacyVerified['optionalTablesUnavailable'] === ['primary' => $optionalTables, 'report' => $optionalTables], 'managed legacy ' . $label . ' reports absent optional tables and permits update');
}
$legacyUpdated = lightemProvision($args, $readOnlyServices);
check($legacyUpdated['mode'] === 'updated' && $legacyUpdated['databasePreserved'] && $legacyUpdated['credentialsPreserved'], 'existing legacy update succeeds using SELECT-only database connections');
check(databaseSnapshot($primary) === $beforePrimary && databaseSnapshot($report) === $beforeReport, 'legacy update preserves every table definition and row in both databases without recreating absent tables');
check(hash_file('sha256', $root . '/.env') === $envHash && hash_file('sha256', $root . '/api/config.php') === $configHash && password_verify($password, (string)$primary->query("SELECT password FROM tbl_users_global_assignment WHERE email = 'admin'")->fetchColumn()), 'legacy update preserves exact connection settings and existing login');
unlink($root . '/' . LIGHTEM_MARKER);
rejects(fn() => lightemVerifyInstallation($root, $payload, false, true, $readOnlyConnect), 'migration', 'unmarked fresh verification remains strict despite allowing a missing marker');
check(lightemVerifyInstallation($root, $payload, true, false, $readOnlyConnect)['mode'] === 'legacy', 'unmarked existing-store preflight accepts the narrow optional-table exception');
check(lightemVerifyInstallation($root, $payload, false, true, $readOnlyConnect, true)['success'], 'explicit copied-legacy validation accepts the narrow optional-table exception');
$legacyAdopted = lightemProvision($args + ['adopt-existing' => true], $readOnlyServices);
check($legacyAdopted['mode'] === 'adopted' && databaseSnapshot($primary) === $beforePrimary && databaseSnapshot($report) === $beforeReport, 'legacy adoption uses SELECT-only checks and preserves both databases exactly');
foreach ($optionalTables as $table) {
    $identifier = lightemIdentifier($table);
    $firstColumn = lightemIdentifier($requirements['primary']['tables'][$table][0]);
    $primary->exec('CREATE TABLE ' . $identifier . ' (' . $firstColumn . ' INT)');
    rejects(fn() => lightemVerifyInstallation($root, $payload, true, false, $readOnlyConnect), $table . '.', 'an existing malformed ' . $table . ' still blocks the update');
    $primary->exec('DROP TABLE ' . $identifier);
}
$primary->exec('RENAME TABLE tbl_expenses TO installer_test_saved_expenses');
rejects(fn() => lightemVerifyInstallation($root, $payload, true, false, $readOnlyConnect), 'tbl_expenses', 'a missing required core table still blocks the update');
$primary->exec('RENAME TABLE installer_test_saved_expenses TO tbl_expenses');
check(ReadOnlySetupConnection::$queries !== [] && databaseSnapshot($primary) === $beforePrimary && databaseSnapshot($report) === $beforeReport, 'all legacy compatibility checks are read-only and leave database content unchanged');
foreach (['primary' => $primary, 'report' => $report] as $kind => $connection) {
    foreach ($restoreTables[$kind] as $sql) $connection->exec($sql);
}

$primary->exec('ALTER TABLE tbl_expenses DROP COLUMN expenses_desc');
rejects(fn() => lightemVerifyInstallation($root, $payload, true, false, $connect), 'migration', 'incompatible schema blocks update before modifications');
foreach (['db_cnc_pos', 'reports_database'] as $db) $admin->exec('DROP DATABASE ' . lightemIdentifier($db));
$admin->exec('DROP USER ' . $admin->quote($env['DB_USER']) . "@'localhost'");
unlink($payload . '/database/bootstrap-discounts.sql');
foreach (['uploads', 'item_pictures', 'api/images'] as $dir) if (!is_dir($secondRoot . '/' . $dir)) mkdir($secondRoot . '/' . $dir, 0700, true);
rejects(fn() => lightemProvision(['root' => $secondRoot, 'payload' => $payload, 'credentials' => $fixture . '/failure.txt'], $services), 'integrity', 'partial fresh import failure is reported');
check((int)$admin->query("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('db_cnc_pos', 'reports_database')")->fetchColumn() === 0, 'failed fresh run cleans only databases it created');
check((int)$admin->query("SELECT COUNT(*) FROM mysql.user WHERE User LIKE 'lightem_%'")->fetchColumn() === 0, 'failed fresh run removes only its generated user');
check(!is_file($secondRoot . '/' . LIGHTEM_MARKER) && !is_file($secondRoot . '/.env') && is_file($fixture . '/failure.txt'), 'failed fresh run retains protected recovery note and no success marker');
echo "Completed {$testCount} isolated provisioning checks.\n";
