<?php
declare(strict_types=1);

require_once __DIR__ . '/../common/migrate.php';
require_once __DIR__ . '/../../backend/api/pos_database_backup.php';

$options = getopt('', ['fixture:', 'source-port:', 'target-port:']);
$fixture = realpath((string)($options['fixture'] ?? ''));
if ($fixture === false || !preg_match('~/lightem-standalone-dbtest-[A-Za-z0-9_-]+$~', $fixture)) throw new RuntimeException('Use a dedicated temporary standalone database fixture.');
$sourcePort = lightemDatabasePort($options['source-port'] ?? 0);
$targetPort = lightemDatabasePort($options['target-port'] ?? 0);
$sourceRootPassword = lightemReadRootPassword($fixture . '/source-root.txt');
$targetRootPassword = lightemReadRootPassword($fixture . '/target-root.txt');
$adminConfig = static fn(int $port, string $password): array => ['host' => '127.0.0.1', 'port' => $port, 'user' => 'root', 'pass' => $password];
$sourceAdmin = lightemConnect($adminConfig($sourcePort, $sourceRootPassword));
$targetAdmin = lightemConnect($adminConfig($targetPort, $targetRootPassword));
foreach ([[$sourceAdmin, 'source-data', $sourcePort], [$targetAdmin, 'target-data', $targetPort]] as [$pdo, $dir, $port]) lightemVerifyPrivateDatabase($pdo, $fixture . '/' . $dir, $port);
$count = 0;
function checkStandalone(bool $value, string $label): void {
    global $count;
    if (!$value) throw new RuntimeException('FAIL ' . $label);
    $count++;
    echo 'PASS ' . $label . PHP_EOL;
}
function rejectsStandalone(callable $action, string $fragment, string $label): void {
    try { $action(); } catch (Throwable $error) {
        checkStandalone(str_contains($error->getMessage(), $fragment), $label);
        return;
    }
    throw new RuntimeException('FAIL ' . $label . ' did not reject');
}
$seams = ['writeRuntimeSecret' => static fn(string $path, string $contents) => lightemWriteFile($path, $contents, 0600, true)];
$sourceRoot = $fixture . '/source-backend';
$targetRoot = $fixture . '/target-backend';
$payload = $fixture . '/payload';
mkdir($fixture . '/source-backups', 0700);
mkdir($fixture . '/target-backups', 0700);
rejectsStandalone(fn() => lightemBackupDirectory($targetRoot, $targetRoot . '/api'), 'outside the public', 'database backups cannot be configured inside the public backend');
checkStandalone(lightemDatabaseAdmin(['credentials' => $fixture . '/target-root.txt', 'data-dir' => $fixture . '/target-data', 'database-port' => $targetPort])['mode'] === 'verified', 'first-start initialization authenticates with generated root password');
rejectsStandalone(fn() => lightemConnect($adminConfig($targetPort, '')), 'Cannot connect', 'blank root password is rejected');
rejectsStandalone(fn() => lightemVerifyPrivateDatabase($targetAdmin, $fixture . '/source-data', $targetPort), 'not the private', 'administrator validation rejects another datadir');
rejectsStandalone(fn() => lightemDatabaseAdmin(['credentials' => $fixture . '/target-root.txt', 'data-dir' => $fixture . '/target-data', 'prepare-init-file' => $fixture . '/second-init.sql']), 'must not already exist', 'database administrator credential cannot be silently rotated');
$rootHash = hash_file('sha256', $fixture . '/target-root.txt');
checkStandalone(lightemDatabaseAdmin(['credentials' => $fixture . '/target-root.txt', 'data-dir' => $fixture . '/target-data', 'prepare-init-file' => $fixture . '/resumed-init.sql', 'resume-init-file' => true])['success'] && hash_file('sha256', $fixture . '/target-root.txt') === $rootHash, 'pending initialization can recreate a missing init-file without rotating its protected password');
$fresh = lightemProvision(['root' => $sourceRoot, 'payload' => $payload, 'credentials' => $fixture . '/source-access.txt', 'bootstrap-password-file' => $fixture . '/source-root.txt', 'database-port' => $sourcePort, 'mysqldump-path' => '/Applications/XAMPP/xamppfiles/bin/mysqldump', 'backup-dir' => $fixture . '/source-backups'], $seams);
[$sourceEnv, $sourceConfig] = lightemSettings($sourceRoot);
checkStandalone($fresh['mode'] === 'fresh' && (int)$sourceEnv['DB_PORT'] === $sourcePort && $sourceConfig['port'] === $sourcePort, 'fresh provisioning persists private port in both settings formats');
checkStandalone($sourceEnv['POS_DB_BACKUP_DIR'] === $fixture . '/source-backups', 'fresh installation saves its private scheduled backup directory');
checkStandalone(lightemMarker($sourceRoot)['runtimeKind'] === 'standalone', 'standalone marker identifies its independent runtime');
rejectsStandalone(fn() => lightemDatabaseAdmin(['credentials' => $fixture . '/forbidden-root.txt', 'data-dir' => $fixture . '/source-data', 'prepare-init-file' => $fixture . '/forbidden-init.sql']), 'containing application data', 'administrator initialization refuses a populated data directory');
rejectsStandalone(fn() => lightemDatabaseAdmin(['credentials' => $fixture . '/source-root.txt', 'data-dir' => $fixture . '/source-data', 'prepare-init-file' => $fixture . '/forbidden-resume.sql', 'resume-init-file' => true]), 'containing application data', 'resuming initialization cannot reset administrator accounts for populated databases');
mkdir($fixture . '/unrelated-data', 0700);
mkdir($fixture . '/unrelated-data/mysql', 0700);
lightemDatabaseAdmin(['credentials' => $fixture . '/unrelated-root.txt', 'data-dir' => $fixture . '/unrelated-data', 'prepare-init-file' => $fixture . '/unrelated-init.sql']);
$targetAdmin->exec((string)file_get_contents($fixture . '/unrelated-init.sql'));
checkStandalone(lightemConnect($adminConfig($targetPort, $targetRootPassword)) instanceof PDO, 'initialization SQL for another datadir cannot rotate the active administrator');
rejectsStandalone(fn() => lightemConnect($adminConfig($targetPort, lightemReadRootPassword($fixture . '/unrelated-root.txt'))), 'Cannot connect', 'a mismatched datadir init-file cannot introduce its new root credential');
$source = lightemConnect($sourceConfig, 'db_cnc_pos');
$report = lightemConnect($sourceConfig, 'reports_database');
$source->exec('CREATE TABLE migration_sentinel (id INT PRIMARY KEY, value VARBINARY(200) NULL, amount DECIMAL(10,2))');
$source->prepare('INSERT INTO migration_sentinel VALUES (?, ?, ?)')->execute([1, "binary\0quote'\\newline\n", '12.34']);
$source->exec('INSERT INTO migration_sentinel VALUES (2, NULL, -1.25)');
$source->exec('CREATE TABLE migration_duplicates (value VARCHAR(30) NULL)');
$source->exec("INSERT INTO migration_duplicates VALUES ('one'), ('one'), ('two'), (NULL), (NULL)");
$source->exec('CREATE VIEW migration_view AS SELECT id, amount FROM migration_sentinel');
$source->exec('CREATE TRIGGER migration_trigger BEFORE INSERT ON migration_sentinel FOR EACH ROW SET NEW.amount = COALESCE(NEW.amount, 0)');
$source->exec('CREATE PROCEDURE migration_procedure() SELECT COUNT(*) FROM migration_sentinel');
$report->exec('CREATE TABLE migration_report_sentinel (value VARCHAR(50))');
$report->exec("INSERT INTO migration_report_sentinel VALUES ('report history stays')");
$sourceEnv['FOO'] = 'must not expand';
$sourceEnv['SECRET_KEY'] = 'literal${FOO}signing-key';
$sourceEnv['CUSTOM_SETTING'] = 'Café ₱ store';
$sourceEnv['WINDOWS_PATH'] = 'C:\\José\\with "quote"\\file';
$sourceEnv['MULTILINE'] = "first line\nsecond line";
file_put_contents($sourceRoot . '/.env', lightemSerializeEnvironment($sourceEnv));
$sourceEnvHash = hash_file('sha256', $sourceRoot . '/.env');
$sourceConfigHash = hash_file('sha256', $sourceRoot . '/api/config.php');
$args = ['source-root' => $sourceRoot, 'root' => $targetRoot, 'payload' => $payload, 'credentials' => $fixture . '/migrated-access.txt', 'bootstrap-password-file' => $fixture . '/target-root.txt', 'database-port' => $targetPort, 'data-dir' => $fixture . '/target-data', 'mysqldump-path' => '/Applications/XAMPP/xamppfiles/bin/mysqldump', 'mysql-path' => '/Applications/XAMPP/xamppfiles/bin/mysql'];
$args['backup-dir'] = $fixture . '/target-backups';
$migrated = lightemMigrate($args, $seams);
[$targetEnv, $targetConfig] = lightemSettings($targetRoot);
$target = lightemConnect($targetConfig, 'db_cnc_pos');
$targetReport = lightemConnect($targetConfig, 'reports_database');
checkStandalone($migrated['mode'] === 'migrated' && $migrated['databasePreserved'], 'both databases migrate through actual bundled dump and mysql programs');
checkStandalone($targetEnv['POS_DB_BACKUP_DIR'] === $fixture . '/target-backups' && $sourceEnv['POS_DB_BACKUP_DIR'] === $fixture . '/source-backups', 'migration relocates scheduled backups without changing the original configuration');
checkStandalone(hash_file('sha256', $sourceRoot . '/.env') === $sourceEnvHash && hash_file('sha256', $sourceRoot . '/api/config.php') === $sourceConfigHash, 'migration never changes source credentials or settings');
checkStandalone($source->query('SELECT * FROM migration_sentinel ORDER BY id')->fetchAll() === $target->query('SELECT * FROM migration_sentinel ORDER BY id')->fetchAll(), 'binary, null and decimal source rows are preserved');
checkStandalone($targetReport->query('SELECT value FROM migration_report_sentinel')->fetchColumn() === 'report history stays', 'report database history is preserved');
checkStandalone($targetEnv['SECRET_KEY'] === $sourceEnv['SECRET_KEY'] && $targetEnv['CUSTOM_SETTING'] === $sourceEnv['CUSTOM_SETTING'] && $targetEnv['WINDOWS_PATH'] === $sourceEnv['WINDOWS_PATH'] && $targetEnv['MULTILINE'] === $sourceEnv['MULTILINE'], 'JWT literals, Unicode, quoted Windows paths and multiline environment settings are retained');
checkStandalone($targetEnv['DB_PASS'] !== $sourceEnv['DB_PASS'] && $targetEnv['DB_USER'] === $sourceEnv['DB_USER'] && $targetEnv['DB_USER'] !== 'root', 'application database password rotates while existing object definers remain valid');
checkStandalone($target->query("SELECT password FROM tbl_users_global_assignment WHERE email = 'admin'")->fetchColumn() === $source->query("SELECT password FROM tbl_users_global_assignment WHERE email = 'admin'")->fetchColumn(), 'existing POS administrator password hash is unchanged');
checkStandalone((int)$target->query('SELECT COUNT(*) FROM migration_view')->fetchColumn() === 2, 'copied view remains readable by the application account');
checkStandalone(lightemMigrate($args, $seams)['mode'] === 'migrated-resumed', 'unchanged verified migration copy resumes without replacing data');
$target->exec('INSERT INTO migration_sentinel VALUES (3, NULL, NULL)');
checkStandalone((string)$target->query('SELECT amount FROM migration_sentinel WHERE id=3')->fetchColumn() === '0.00', 'copied trigger executes under preserved definer');
$procedure = $target->query('CALL migration_procedure()');
checkStandalone((int)$procedure->fetchColumn() === 3, 'copied stored procedure remains executable');
$procedure->closeCursor();
checkStandalone((int)$source->query('SELECT COUNT(*) FROM migration_sentinel')->fetchColumn() === 2, 'new standalone writes do not modify original XAMPP database');
checkStandalone((int)$targetAdmin->query("SELECT COUNT(*) FROM mysql.user WHERE User='' OR (User='root' AND Host NOT IN ('localhost','127.0.0.1'))")->fetchColumn() === 0, 'private database has no anonymous or remote root accounts');
rejectsStandalone(fn() => $target->query('SELECT * FROM mysql.global_priv'), 'denied', 'application database account cannot read administrator credentials');
checkStandalone(is_file($migrated['backupFile']) && (fileperms($migrated['backupFile']) & 0777) === 0600 && !is_file($args['credentials'] . '.source.cnf') && !is_file($args['credentials'] . '.target.cnf'), 'migration backup remains private and temporary client credential files are removed');
rejectsStandalone(fn() => lightemMigrate($args, $seams), 'Database content changed', 'rerunning migration cannot overwrite an activated standalone database');
posDatabaseExport($targetConfig, $fixture . '/api-backup.sql');
checkStandalone(filesize($fixture . '/api-backup.sql') > 0 && str_contains((string)file_get_contents($fixture . '/api-backup.sql'), 'migration_sentinel'), 'actual POS export helper uses configured runtime binary and private database port');
$envSave = $_ENV;
$_ENV['DB_HOST'] = '127.0.0.1';
$_ENV['DB_PORT'] = (string)$targetPort;
$_ENV['DB_USER'] = $targetConfig['user'];
$database = new Database('127.0.0.1', 'db_cnc_pos', $targetConfig['user'], $targetConfig['pass']);
checkStandalone((int)$database->getConnection()->query('SELECT @@port')->fetchColumn() === $targetPort, 'shared login Database class connects using DB_PORT');
$_ENV = $envSave;
$target->exec("UPDATE migration_duplicates SET value='changed' WHERE value='one' LIMIT 1");
checkStandalone(lightemMigrationRowDigest($source, 'migration_duplicates') !== lightemMigrationRowDigest($target, 'migration_duplicates'), 'row-content verification detects changed duplicate rows despite equal counts');

// Exercise rollback in this disposable target only. Both services were checked
// against the dedicated temporary datadirs before any test mutation above.
foreach (['db_cnc_pos', 'reports_database'] as $db) $targetAdmin->exec('DROP DATABASE ' . lightemIdentifier($db));
foreach (['localhost', '127.0.0.1'] as $host) $targetAdmin->exec('DROP USER ' . $targetAdmin->quote($targetConfig['user']) . '@' . $targetAdmin->quote($host));
foreach (['.env', 'api/config.php', LIGHTEM_MARKER, '.lightem-migration.json'] as $file) unlink($targetRoot . '/' . $file);
$failureArgs = $args;
$failureArgs['credentials'] = $fixture . '/failed-migration-access.txt';
$failureServices = $seams + ['process' => static function (array $command, string $diagnostics, ?string $input = null): void {
    if ($input !== null) throw new LightemSetupException('Simulated import failure.');
    lightemMigrationProcess($command, $diagnostics, $input);
}];
rejectsStandalone(fn() => lightemMigrate($failureArgs, $failureServices), 'Simulated import failure', 'an import failure is reported without activating the private copy');
checkStandalone((int)$targetAdmin->query("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('db_cnc_pos','reports_database')")->fetchColumn() === 0, 'failed migration removes only its newly created destination databases');
$query = $targetAdmin->prepare('SELECT COUNT(*) FROM mysql.user WHERE User = ?');
$query->execute([$targetConfig['user']]);
checkStandalone((int)$query->fetchColumn() === 0 && !is_file($targetRoot . '/.env') && !is_file($targetRoot . '/' . LIGHTEM_MARKER), 'failed migration removes its new application accounts and leaves no success marker');
checkStandalone((int)$source->query('SELECT COUNT(*) FROM migration_sentinel')->fetchColumn() === 2 && hash_file('sha256', $sourceRoot . '/.env') === $sourceEnvHash, 'failed migration preserves original data and credentials');

$tamperArgs = $args;
$tamperArgs['credentials'] = $fixture . '/tampered-migration-access.txt';
$tamperServices = $seams + ['process' => static function (array $command, string $diagnostics, ?string $input = null) use ($targetAdmin): void {
    lightemMigrationProcess($command, $diagnostics, $input);
    if ($input !== null) $targetAdmin->exec('UPDATE db_cnc_pos.migration_sentinel SET amount=999 WHERE id=1');
}];
rejectsStandalone(fn() => lightemMigrate($tamperArgs, $tamperServices), 'mismatched database content', 'equal row counts with corrupted copied content block migration');
checkStandalone((int)$targetAdmin->query("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('db_cnc_pos','reports_database')")->fetchColumn() === 0 && !is_file($targetRoot . '/' . LIGHTEM_MARKER), 'content verification failure rolls back the new private databases');
echo "Completed {$count} isolated standalone database checks.\n";
