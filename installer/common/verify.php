<?php
declare(strict_types=1);

const LIGHTEM_INSTALLER_ID = 'com.lenard.restobill.setup';
const LIGHTEM_MARKER = '.lightem-managed-install.json';
// Older stores can operate without these optional feature tables. The backend
// explicitly disables custom-discount setup without its mapping table and skips
// only absent optional tables during an authorized reset. Never skip columns in
// an existing table, or relax the complete schema required for a fresh database.
const LIGHTEM_LEGACY_OPTIONAL_TABLES = [
    'tbl_pos_discount_type_sales_type',
    'tbl_pos_zreading_archive_log',
];

final class LightemSetupException extends RuntimeException {}

function lightemJson(string $path): array
{
    if (!is_file($path)) {
        throw new LightemSetupException('Required installation metadata is missing: ' . basename($path));
    }
    $value = json_decode((string)file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($value)) {
        throw new LightemSetupException('Invalid installation metadata: ' . basename($path));
    }
    return $value;
}

function lightemRoot(string $path): string
{
    $root = realpath($path);
    if ($root === false || !is_dir($root)) {
        throw new LightemSetupException('The installation root must be an existing directory.');
    }
    return rtrim($root, '/\\');
}

function lightemIdentifier(string $value): string
{
    if (!preg_match('/\A[A-Za-z0-9_]{1,64}\z/D', $value)) {
        throw new LightemSetupException('Invalid database or schema identifier.');
    }
    return '`' . $value . '`';
}

function lightemIsLegacy(string $root): bool
{
    foreach (['api/bootstrap.php', 'api/login.php', 'api/pos_lan_health.php', 'api/config.php', 'src/Database.php', 'src/JWTCodec.php', 'src/UserGateway.php', 'vendor/autoload.php', '.env'] as $file) {
        if (!is_file($root . '/' . $file)) {
            return false;
        }
    }
    return true;
}

function lightemMarker(string $root): ?array
{
    $path = $root . '/' . LIGHTEM_MARKER;
    if (!is_file($path)) {
        return null;
    }
    $marker = lightemJson($path);
    if (($marker['installerId'] ?? '') !== LIGHTEM_INSTALLER_ID) {
        throw new LightemSetupException('This directory belongs to a different installer.');
    }
    return $marker;
}

function lightemRuntime(string $root): void
{
    if (PHP_VERSION_ID < 80200) {
        throw new LightemSetupException('PHP 8.2 or later is required.');
    }
    foreach (['pdo_mysql', 'mysqli', 'mbstring', 'curl', 'openssl', 'fileinfo', 'gd', 'zip'] as $extension) {
        if (!extension_loaded($extension)) {
            throw new LightemSetupException('Required PHP extension is unavailable: ' . $extension);
        }
    }
    if (!is_file($root . '/vendor/autoload.php')) {
        throw new LightemSetupException('The packaged Composer runtime is missing.');
    }
    // Migration verifies two backend directories in one process. Composer's
    // generated loader class has the same name in identical runtime copies.
    if (!class_exists('Dotenv\\Dotenv')) require_once $root . '/vendor/autoload.php';
    foreach (['Dotenv\\Dotenv', 'PHPMailer\\PHPMailer\\PHPMailer', 'Database', 'JWTCodec', 'UserGateway'] as $class) {
        if (!class_exists($class)) {
            throw new LightemSetupException('A required backend dependency is unavailable: ' . $class);
        }
    }
}

function lightemSettings(string $root): array
{
    lightemRuntime($root);
    if (!is_file($root . '/.env') || !is_file($root . '/api/config.php')) {
        throw new LightemSetupException('The existing database settings are incomplete.');
    }
    $env = Dotenv\Dotenv::parse((string)file_get_contents($root . '/.env'));
    $config = require $root . '/api/config.php';
    if (!is_array($config)) {
        throw new LightemSetupException('The PHP database configuration is invalid.');
    }
    foreach (['DB_HOST' => 'host', 'DB_NAME' => 'db', 'DB_USER' => 'user', 'DB_PASS' => 'pass'] as $envName => $key) {
        if (!array_key_exists($envName, $env) || !array_key_exists($key, $config) || (string)$env[$envName] !== (string)$config[$key]) {
            throw new LightemSetupException('The .env and API database configuration disagree for ' . $envName . '. Correct them before updating.');
        }
    }
    if (lightemDatabasePort($env['DB_PORT'] ?? 3306) !== lightemDatabasePort($config['port'] ?? 3306)) {
        throw new LightemSetupException('The .env and API database configuration disagree for DB_PORT. Correct them before updating.');
    }
    if (trim((string)($env['SECRET_KEY'] ?? '')) === '') {
        throw new LightemSetupException('The existing JWT signing key is missing.');
    }
    foreach (['db', 'report_db'] as $name) {
        lightemIdentifier((string)($config[$name] ?? ''));
    }
    if ((string)$config['db'] === (string)$config['report_db']) {
        throw new LightemSetupException('Primary and report databases must be separate.');
    }
    return [$env, $config];
}

function lightemDatabasePort(mixed $value): int
{
    if (filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]) === false) {
        throw new LightemSetupException('Invalid database port.');
    }
    return (int)$value;
}

function lightemConnect(array $config, ?string $database = null): PDO
{
    $host = (string)($config['host'] ?? '127.0.0.1');
    if (str_contains($host, ';') || str_contains($host, "\0")) {
        throw new LightemSetupException('Invalid database host configuration.');
    }
    $dsn = 'mysql:host=' . $host . ';charset=utf8mb4';
    if (isset($config['port'])) {
        $port = lightemDatabasePort($config['port']);
        $dsn .= ';port=' . $port;
    }
    if ($database !== null) {
        lightemIdentifier($database);
        $dsn .= ';dbname=' . $database;
    }
    try {
        return new PDO($dsn, (string)$config['user'], (string)$config['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $error) {
        throw new LightemSetupException('Cannot connect to the configured database. Check the database service and local credentials.');
    }
}

function lightemSchemaRequirements(string $payload): array
{
    $manifest = lightemJson($payload . '/database/schema-manifest.json');
    if (($manifest['formatVersion'] ?? null) !== 1 || ($manifest['mode'] ?? '') !== 'fresh-empty') {
        throw new LightemSetupException('Unsupported schema manifest format.');
    }
    foreach (['primary', 'report'] as $kind) {
        $meta = $manifest['schemas'][$kind] ?? null;
        $sql = $payload . '/database/' . $kind . '.sql';
        if (!is_array($meta) || !is_array($meta['tables'] ?? null) || !is_file($sql) || !hash_equals((string)($meta['sha256'] ?? ''), hash_file('sha256', $sql))) {
            throw new LightemSetupException('Schema payload integrity check failed for ' . $kind . '.');
        }
    }
    return $manifest['schemas'];
}

function lightemVerifySchema(PDO $pdo, string $database, array $required, string $kind, bool $allowLegacyOptionalTables = false): array
{
    $stmt = $pdo->prepare('SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?');
    $stmt->execute([$database]);
    $present = [];
    foreach ($stmt->fetchAll() as $row) {
        $present[$row['TABLE_NAME']][$row['COLUMN_NAME']] = true;
    }
    $missing = [];
    $optionalUnavailable = [];
    foreach ($required as $table => $columns) {
        if (!isset($present[$table])) {
            if ($allowLegacyOptionalTables && in_array($table, LIGHTEM_LEGACY_OPTIONAL_TABLES, true)) {
                $optionalUnavailable[] = $table;
                continue;
            }
            $missing[] = $table;
            continue;
        }
        foreach ($columns as $column) {
            if (!isset($present[$table][$column])) {
                $missing[] = $table . '.' . $column;
            }
        }
    }
    if ($missing) {
        throw new LightemSetupException('A reviewed database migration is required before this update (' . $kind . ': ' . implode(', ', array_slice($missing, 0, 8)) . (count($missing) > 8 ? ', ...' : '') . '). No schema was changed.');
    }
    return $optionalUnavailable;
}

function lightemVerifyInstallation(string $root, ?string $payload = null, bool $beforeUpdate = false, bool $allowUnmarked = false, ?callable $connect = null, bool $allowLegacyOptionalTables = false): array
{
    $connect ??= 'lightemConnect';
    $marker = lightemMarker($root);
    if ($marker === null && (!$beforeUpdate && !$allowUnmarked)) {
        throw new LightemSetupException('The managed-installation marker is missing.');
    }
    if (!lightemIsLegacy($root)) {
        throw new LightemSetupException('This directory is not a recognizable complete Lightem backend.');
    }
    [, $config] = lightemSettings($root);
    $primary = $connect($config, (string)$config['db']);
    $report = $connect($config, (string)$config['report_db']);
    $primary->query('SELECT 1');
    $report->query('SELECT 1');
    $optionalUnavailable = ['primary' => [], 'report' => []];
    if ($payload !== null) {
        $schemas = lightemSchemaRequirements($payload);
        $allowLegacyOptionalTables = $beforeUpdate || $marker !== null || $allowLegacyOptionalTables;
        $optionalUnavailable['primary'] = lightemVerifySchema($primary, (string)$config['db'], $schemas['primary']['tables'], 'primary', $allowLegacyOptionalTables);
        $optionalUnavailable['report'] = lightemVerifySchema($report, (string)$config['report_db'], $schemas['report']['tables'], 'report', $allowLegacyOptionalTables);
    } else {
        lightemVerifySchema($primary, (string)$config['db'], [
            'tbl_users_global_assignment' => ['uuid', 'email', 'password', 'classification', 'status', 'deletestatus'],
            'tbl_refresh_token' => ['token_hash', 'expires_at'],
            'tbl_pos_transactions' => ['transaction_id', 'transaction_date', 'TotalAmountDue'],
        ], 'primary');
        lightemVerifySchema($report, (string)$config['report_db'], [
            'tbl_pos_transactions' => ['transaction_id', 'transaction_date', 'TotalAmountDue'],
        ], 'report');
    }
    $account = $primary->query("SELECT 1 FROM tbl_users_global_assignment WHERE status = 'Active' AND deletestatus = 'Active' LIMIT 1")->fetchColumn();
    if ($account === false) {
        throw new LightemSetupException('No active POS account exists. Complete account recovery before updating.');
    }
    return [
        'success' => true,
        'mode' => $marker === null ? 'legacy' : 'managed',
        'phpVersion' => PHP_VERSION,
        'version' => $marker['version'] ?? null,
        'buildId' => $marker['buildId'] ?? null,
        'backendSha256' => $marker['backendSha256'] ?? null,
        'schemaCompatible' => true,
        'optionalTablesUnavailable' => $optionalUnavailable,
    ];
}

function lightemFail(Throwable $error): never
{
    $message = $error instanceof LightemSetupException
        ? $error->getMessage()
        : 'Setup verification failed. No credential details are logged. Check the supplied files and local services.';
    fwrite(STDERR, $message . PHP_EOL);
    exit(1);
}

if (PHP_SAPI === 'cli' && realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    try {
        $options = getopt('', ['root:', 'payload:', 'before-update']);
        $root = lightemRoot((string)($options['root'] ?? ''));
        $payload = isset($options['payload']) ? lightemRoot((string)$options['payload']) : null;
        echo json_encode(lightemVerifyInstallation($root, $payload, isset($options['before-update'])), JSON_THROW_ON_ERROR) . PHP_EOL;
    } catch (Throwable $error) {
        lightemFail($error);
    }
}
