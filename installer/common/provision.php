<?php
declare(strict_types=1);

require_once __DIR__ . '/verify.php';

function lightemSqlStatements(string $sql): array
{
    $statements = [];
    $buffer = '';
    $quote = null;
    $comment = null;
    $length = strlen($sql);
    for ($i = 0; $i < $length; $i++) {
        $char = $sql[$i];
        $next = $sql[$i + 1] ?? '';
        if ($comment === 'line') {
            if ($char === "\n") {
                $comment = null;
                $buffer .= "\n";
            }
            continue;
        }
        if ($comment === 'block') {
            if ($char === '*' && $next === '/') {
                $comment = null;
                $buffer .= ' ';
                $i++;
            }
            continue;
        }
        if ($quote !== null) {
            $buffer .= $char;
            if ($char === '\\' && $next !== '') {
                $buffer .= $next;
                $i++;
            } elseif ($char === $quote) {
                if ($next === $quote) {
                    $buffer .= $next;
                    $i++;
                } else {
                    $quote = null;
                }
            }
            continue;
        }
        if ($char === '/' && $next === '*') {
            $comment = 'block';
            $i++;
        } elseif ($char === '#' || ($char === '-' && $next === '-' && ctype_space($sql[$i + 2] ?? ' '))) {
            $comment = 'line';
            if ($char === '-') $i++;
        } elseif (in_array($char, ["'", '"', '`'], true)) {
            $quote = $char;
            $buffer .= $char;
        } elseif ($char === ';') {
            if (trim($buffer) !== '') $statements[] = trim($buffer);
            $buffer = '';
        } else {
            $buffer .= $char;
        }
    }
    if ($quote !== null || $comment === 'block') {
        throw new LightemSetupException('The staged SQL contains an unfinished string or comment.');
    }
    if (trim($buffer) !== '') $statements[] = trim($buffer);
    return $statements;
}

function lightemImportSql(PDO $pdo, string $path, string $sha256, bool $defaults = false): void
{
    if (!is_file($path) || !hash_equals($sha256, hash_file('sha256', $path))) {
        throw new LightemSetupException('Staged SQL integrity check failed: ' . basename($path));
    }
    foreach (lightemSqlStatements((string)file_get_contents($path)) as $index => $statement) {
        $allowed = $defaults
            ? '/\A(?:INSERT(?:\s+IGNORE)?\s+INTO|UPDATE)\s+`(?:tbl_pos_permissions|tbl_pos_roles|tbl_pos_role_permissions|lkp_discount_type)`/i'
            : '/\A(?:CREATE\s+TABLE|ALTER\s+TABLE)\s+`[A-Za-z0-9_]+`/i';
        if (!preg_match($allowed, $statement)) {
            throw new LightemSetupException('Unexpected SQL operation in the staged ' . basename($path) . '.');
        }
        try {
            $pdo->exec($statement);
        } catch (PDOException $error) {
            throw new LightemSetupException('Fresh schema/default import failed in ' . basename($path) . ' at statement ' . ($index + 1) . '. Existing databases were not dropped; retain the protected recovery file.');
        }
    }
}

function lightemInsert(PDO $pdo, string $table, array $values): void
{
    $columns = array_map('lightemIdentifier', array_keys($values));
    $sql = 'INSERT INTO ' . lightemIdentifier($table) . ' (' . implode(',', $columns) . ') VALUES (' . implode(',', array_fill(0, count($values), '?')) . ')';
    $pdo->prepare($sql)->execute(array_values($values));
}

function lightemSeedStore(PDO $pdo): void
{
    $now = date('Y-m-d H:i:s');
    lightemInsert($pdo, 'tbl_main_business_category', [
        'ID' => 1, 'Category_Code' => 'GEN', 'Category_Name' => 'General',
        'Category_Description' => 'General', 'Print_Color1' => 0, 'Print_Color2' => 0,
        'Print_Color3' => 0, 'Status' => 'Active', 'Remarks' => '',
    ]);
    lightemInsert($pdo, 'tbl_main_business_units', [
        'ID' => 1, 'Category_Code' => 'GEN', 'Corp_Code' => '', 'Unit_Code' => '1001',
        'Unit_Name' => 'Lightem Store', 'Unit_TIN' => '', 'Unit_Address' => '',
        'Business_Type' => '', 'VAT_Registration' => '', 'Region_Name' => '', 'Area_Name' => '',
        'Notes' => '', 'MD' => '', 'GM' => '', 'BP' => '', 'Code_2' => '',
        'Status' => 'Active', 'Remarks' => 'Complete business and receipt settings before trading.',
        'Date_Open' => date('Y-m-d'),
    ]);
    lightemInsert($pdo, 'tbl_pos_document_counters', [
        'Category_Code' => 'GEN', 'Unit_Code' => '1001', 'next_billing_no' => 3000000001,
        'next_invoice_no' => 4000000001, 'next_transaction_id' => 1000000001,
        'next_order_slip_no' => 2000000001, 'next_refund_id' => '9000000001', 'next_void_id' => '8000000001',
    ]);
    lightemInsert($pdo, 'tbl_pos_terminal_config', [
        'categoryCode' => 'GEN', 'unitCode' => '1001', 'businessUnitName' => 'Lightem Store',
        'terminalNumber' => '1', 'corpName' => '', 'machineNumber' => '', 'serialNumber' => '',
        'ptuNumber' => '', 'ptuDateIssued' => '', 'status' => 'Active',
    ]);
    lightemInsert($pdo, 'tbl_mode_of_payment', [
        'mop_id' => 'MP-LOCAL-CASH', 'mop' => 'Cash', 'sl_code' => '10002',
        'reference_On_Off' => 0, 'MOP_On_Off' => 1,
    ]);
    foreach (['DINE IN', 'TAKE OUT'] as $index => $description) {
        $salesType = 'ST-LOCAL-' . ($index + 1);
        lightemInsert($pdo, 'lkp_sales_type', [
            'sales_type_id' => $salesType, 'description' => $description, 'deletestatus' => 'Active',
            'usertracker' => 'INSTALLER', 'createdtime' => $now,
        ]);
        lightemInsert($pdo, 'tbl_pricing_by_sales_type', [
            'busunitcode' => '1001', 'sales_type_id' => $salesType, 'pricing_category' => 'PRICE-LOCAL',
            'deletestatus' => 'Active', 'usertracker' => 'INSTALLER', 'createdtime' => $now,
        ]);
    }
    lightemInsert($pdo, 'tbl_pos_tables', [
        'category_code' => 'GEN', 'unit_code' => '1001', 'table_name' => 'Table 01',
        'transaction_reference' => 0, 'status' => 'Available',
    ]);
    foreach ([
        ['Layout', 'Layout Mode', 'resto'],
        ['General', 'Enable Billing', 'True'],
        ['BusinessInfo', 'companyName', 'Lightem Store'],
        ['BusinessInfo', 'storeName', 'Lightem Store'],
        ['BusinessInfo', 'terminalId', '1'],
    ] as $index => [$category, $description, $value]) {
        lightemInsert($pdo, 'tbl_pos_settings', ['ID' => $index + 1, 'category' => $category, 'description' => $description, 'value' => $value]);
    }
    lightemInsert($pdo, 'tbl_theme_settings', ['Setting_Key' => 'default', 'Theme_Name' => 'default']);
}

function lightemSeedAdmin(PDO $pdo, string $password): void
{
    $now = date('Y-m-d H:i:s');
    lightemInsert($pdo, 'tbl_users_global_assignment', [
        'uuid' => '1', 'email' => 'admin', 'classification' => '2',
        'password' => password_hash($password, PASSWORD_BCRYPT),
        'firstname' => 'Store', 'middlename' => null, 'lastname' => 'Administrator',
        'company' => '', 'department' => 'ADMIN', 'contactnumber' => '', 'status' => 'Active',
        'verified' => 'Verified', 'passlock' => 0, 'otp' => 0, 'otplock' => 0,
        'usertracker' => 'INSTALLER', 'deletestatus' => 'Active', 'createtime' => $now,
    ]);
    lightemInsert($pdo, 'tbl_main_users_credentials_business_units', [
        'user_id' => 1, 'category_code' => 'GEN', 'unit_code' => '1001',
    ]);
}

function lightemWriteFile(string $path, string $contents, int $mode = 0644, bool $exclusive = false): void
{
    $handle = @fopen($path, $exclusive ? 'x' : 'wb');
    if ($handle === false) {
        throw new LightemSetupException('Cannot write the required installation file: ' . basename($path));
    }
    try {
        if (!chmod($path, $mode) || fwrite($handle, $contents) !== strlen($contents) || !fflush($handle)) {
            throw new LightemSetupException('Cannot securely write installation file: ' . basename($path));
        }
    } finally {
        fclose($handle);
    }
}

function lightemRuntimeSecret(string $path, string $contents, string $runtimeGroup = 'daemon'): void
{
    lightemWriteFile($path, $contents, 0600, true);
    if (PHP_OS_FAMILY === 'Darwin') {
        if (!chgrp($path, $runtimeGroup) || !chmod($path, 0640)) {
            throw new LightemSetupException('Cannot grant the Apache service access to its local configuration.');
        }
    }
    // Windows ACLs are applied by the elevated installer: Administrators and
    // SYSTEM only. Credentials outside htdocs never receive Apache access.
}

/** Preserve literal settings across phpdotenv parsing, including $ and Unicode. */
function lightemSerializeEnvironment(array $values): string
{
    $expected = [];
    $contents = '';
    foreach ($values as $key => $value) {
        if (!preg_match('/\A[A-Za-z_][A-Za-z0-9_]*\z/D', (string)$key)) {
            throw new LightemSetupException('An environment setting has an invalid key.');
        }
        $expected[$key] = (string)$value;
        $encoded = json_encode((string)$value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $contents .= $key . '=' . str_replace('$', '\\$', $encoded) . "\n";
    }
    try {
        if (Dotenv\Dotenv::parse($contents) !== $expected) throw new RuntimeException('Round-trip mismatch.');
    } catch (Throwable $error) {
        throw new LightemSetupException('An environment setting cannot be safely preserved in the runtime configuration.');
    }
    return $contents;
}

function lightemBackupDirectory(string $root, string $path): string
{
    $directory = realpath($path);
    if ($directory === false || !is_dir($directory)) {
        throw new LightemSetupException('Create the protected database backup directory before provisioning.');
    }
    $normalizedRoot = strtolower(str_replace('\\', '/', $root));
    $normalizedDirectory = strtolower(str_replace('\\', '/', $directory));
    if ($normalizedDirectory === $normalizedRoot || str_starts_with($normalizedDirectory, $normalizedRoot . '/')) {
        throw new LightemSetupException('Database backups must be stored outside the public backend directory.');
    }
    return $directory;
}

function lightemCredentialsPath(string $root, string $path): string
{
    if ($path === '' || is_file($path)) {
        throw new LightemSetupException('Fresh installation requires a new protected credentials output file.');
    }
    $directory = realpath(dirname($path));
    if ($directory === false) {
        throw new LightemSetupException('Create a protected credentials directory outside htdocs before provisioning.');
    }
    $normalizedRoot = strtolower(str_replace('\\', '/', $root)) . '/';
    $normalizedTarget = strtolower(str_replace('\\', '/', $directory . '/' . basename($path)));
    if (str_starts_with($normalizedTarget, $normalizedRoot)) {
        throw new LightemSetupException('The credentials file must be outside the public installation root.');
    }
    return $directory . DIRECTORY_SEPARATOR . basename($path);
}

function lightemProtectHttp(string $root, string $runtimeGroup = 'daemon'): void
{
    $block = <<<'APACHE'
# BEGIN LIGHTEM INSTALLER PROTECTION
Options -Indexes
<FilesMatch "^(?:\.env(?:\..*)?|\.lightem-.*)$">
  Require all denied
</FilesMatch>
# END LIGHTEM INSTALLER PROTECTION
APACHE;
    foreach ([$root . '/.htaccess' => $block, $root . '/src/.htaccess' => "Require all denied\n", $root . '/vendor/.htaccess' => "Require all denied\n"] as $path => $addition) {
        $current = is_file($path) ? (string)file_get_contents($path) : '';
        if (!str_contains($current, trim($addition))) {
            if (file_put_contents($path, rtrim($current) . "\n\n" . $addition . "\n", LOCK_EX) === false) {
                throw new LightemSetupException('Cannot protect backend configuration from HTTP access.');
            }
        }
    }
    foreach (['uploads', 'item_pictures', 'api/images'] as $directory) {
        $path = $root . '/' . $directory;
        if (!is_dir($path)) {
            if (!mkdir($path, 0755, true)) throw new LightemSetupException('Cannot create the backend upload directories.');
            if (PHP_OS_FAMILY === 'Darwin' && (!chgrp($path, $runtimeGroup) || !chmod($path, 0775))) {
                throw new LightemSetupException('Cannot grant Apache upload-directory access.');
            }
        }
    }
}

function lightemWriteMarker(string $root, array $manifest, string $mode): void
{
    foreach (['version', 'buildId', 'backendSha256'] as $field) {
        if (!is_string($manifest[$field] ?? null) || $manifest[$field] === '') {
            throw new LightemSetupException('The release manifest is missing ' . $field . '.');
        }
    }
    $marker = [
        'installerId' => LIGHTEM_INSTALLER_ID, 'formatVersion' => 1,
        'version' => $manifest['version'], 'buildId' => $manifest['buildId'],
        'backendSha256' => $manifest['backendSha256'],
        'installedAt' => gmdate('c'), 'installationMode' => $mode,
    ];
    if (($manifest['runtimeKind'] ?? '') === 'standalone') {
        $marker['runtimeKind'] = 'standalone';
        foreach (['runtimeVersion', 'runtimeSha256'] as $field) {
            if (isset($manifest[$field])) $marker[$field] = $manifest[$field];
        }
    }
    $temporary = $root . '/.lightem-marker-' . bin2hex(random_bytes(8)) . '.tmp';
    lightemWriteFile($temporary, json_encode($marker, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n");
    if (!rename($temporary, $root . '/' . LIGHTEM_MARKER)) {
        @unlink($temporary);
        throw new LightemSetupException('Cannot finalize the managed-installation marker.');
    }
}

/** Optional services are an in-process test seam; CLI callers cannot override them. */
function lightemProvision(array $options, array $services = []): array
{
    $connect = $services['connect'] ?? 'lightemConnect';
    $runtimeGroup = (string)($options['runtime-group'] ?? 'daemon');
    $writeRuntimeSecret = $services['writeRuntimeSecret'] ?? static fn(string $path, string $contents) => lightemRuntimeSecret($path, $contents, $runtimeGroup);
    date_default_timezone_set('Asia/Manila');
    $root = lightemRoot((string)($options['root'] ?? ''));
    $payload = lightemRoot((string)($options['payload'] ?? ''));
    $manifest = lightemJson($payload . '/manifest.json');
    foreach (['version', 'buildId', 'backendSha256'] as $field) {
        if (!is_string($manifest[$field] ?? null) || $manifest[$field] === '') {
            throw new LightemSetupException('Release metadata is incomplete.');
        }
    }
    $schemas = lightemSchemaRequirements($payload);
    $marker = lightemMarker($root);
    if ($marker !== null || isset($options['adopt-existing'])) {
        if (!lightemIsLegacy($root)) throw new LightemSetupException('Existing Lightem files/configuration are incomplete; update stopped.');
        lightemVerifyInstallation($root, $payload, true, false, $connect);
        lightemProtectHttp($root, $runtimeGroup);
        lightemWriteMarker($root, $manifest, $marker === null ? 'adopted' : 'updated');
        return ['success' => true, 'mode' => $marker === null ? 'adopted' : 'updated', 'databasePreserved' => true, 'credentialsPreserved' => true];
    }
    if (is_file($root . '/.env') || is_file($root . '/api/config.php')) {
        throw new LightemSetupException('Existing database settings were found. Verify and adopt the existing installation instead of initializing it.');
    }
    lightemRuntime($root);
    $credentialsPath = lightemCredentialsPath($root, (string)($options['credentials'] ?? ''));
    $backupDirectory = isset($options['backup-dir']) ? lightemBackupDirectory($root, (string)$options['backup-dir']) : null;
    $bootstrapPassword = '';
    if (isset($options['bootstrap-password-file'])) {
        if (!is_readable((string)$options['bootstrap-password-file'])) throw new LightemSetupException('Cannot read the administrator credential file.');
        $bootstrapPassword = rtrim((string)file_get_contents((string)$options['bootstrap-password-file']), "\r\n");
    }
    $port = lightemDatabasePort($options['database-port'] ?? 3306);
    $admin = $connect(['host' => '127.0.0.1', 'port' => $port, 'user' => 'root', 'pass' => $bootstrapPassword], null);
    $databaseNames = ['primary' => 'db_cnc_pos', 'report' => 'reports_database'];
    $preexistingDatabases = [];
    foreach ($databaseNames as $database) {
        $stmt = $admin->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?');
        $stmt->execute([$database]);
        if ((int)$stmt->fetchColumn() > 0) {
            throw new LightemSetupException('An existing database contains tables. Fresh installation stopped without dropping or importing data; use update/adoption instead.');
        }
        $exists = $admin->prepare('SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
        $exists->execute([$database]);
        $preexistingDatabases[$database] = (int)$exists->fetchColumn() > 0;
    }
    $databaseUser = 'lightem_' . bin2hex(random_bytes(5));
    $databasePassword = bin2hex(random_bytes(24));
    $adminPassword = 'Lt!' . bin2hex(random_bytes(10));
    $signingKey = bin2hex(random_bytes(32));
    $credentials = "Lightem initial access and recovery\n\nPOS username: admin\nPOS password: {$adminPassword}\n\nDatabase host: 127.0.0.1\nDatabase port: {$port}\nDatabase user: {$databaseUser}\nDatabase password: {$databasePassword}\nPrimary database: db_cnc_pos\nReport database: reports_database\n\nStore this file securely. Change the initial POS password after signing in.\nComplete your business, receipt, product, and printer settings before trading.\n";
    lightemWriteFile($credentialsPath, $credentials, 0600, true);
    $loginPath = preg_replace('/\.[^\.\\\\\/]+$/', '', $credentialsPath) . '.login.txt';
    lightemWriteFile($loginPath, "Lightem POS initial sign-in\n\nUsername: admin\nPassword: {$adminPassword}\n\nChange this password after signing in, then securely remove this note.\nConfigure your store, receipt information, products and printers before trading.\n", 0600, true);
    $createdDatabases = [];
    $createdAccounts = [];
    try {
    lightemProtectHttp($root, $runtimeGroup);
    foreach ($databaseNames as $database) {
        $admin->exec('CREATE DATABASE IF NOT EXISTS ' . lightemIdentifier($database) . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci');
        if (!$preexistingDatabases[$database]) $createdDatabases[] = $database;
    }
    $accountHosts = isset($options['database-port']) ? ['localhost', '127.0.0.1'] : ['localhost'];
    foreach ($accountHosts as $host) {
        $account = $admin->quote($databaseUser) . '@' . $admin->quote($host);
        $admin->exec('CREATE USER ' . $account . ' IDENTIFIED BY ' . $admin->quote($databasePassword));
        $createdAccounts[] = $account;
        foreach ($databaseNames as $database) {
            $admin->exec('GRANT ALL PRIVILEGES ON ' . lightemIdentifier($database) . '.* TO ' . $account);
        }
    }
    $config = ['host' => '127.0.0.1', 'port' => $port, 'user' => $databaseUser, 'pass' => $databasePassword, 'db' => 'db_cnc_pos', 'report_db' => 'reports_database', 'charset' => 'utf8mb4'];
    if (isset($options['mysqldump-path'])) $config['mysqldump_path'] = (string)$options['mysqldump-path'];
    $schemaManifest = lightemJson($payload . '/database/schema-manifest.json');
    foreach ($databaseNames as $kind => $database) {
        $pdo = $connect($config, $database);
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        try {
            lightemImportSql($pdo, $payload . '/database/' . $kind . '.sql', $schemas[$kind]['sha256']);
        } finally {
            $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        }
        lightemSeedStore($pdo);
        lightemImportSql($pdo, $payload . '/database/bootstrap-discounts.sql', (string)($schemaManifest['bootstrap']['discounts']['sha256'] ?? ''), true);
        if ($kind === 'primary') {
            lightemImportSql($pdo, $payload . '/database/bootstrap-permissions.sql', (string)($schemaManifest['bootstrap']['permissions']['sha256'] ?? ''), true);
            lightemSeedAdmin($pdo, $adminPassword);
        }
    }
    $envValues = [
        'DB_HOST' => $config['host'], 'DB_PORT' => (string)$port, 'DB_NAME' => $config['db'], 'DB_USER' => $config['user'], 'DB_PASS' => $config['pass'],
        'WEB_SYNC_DB_HOST' => '', 'WEB_SYNC_DB_NAME' => '', 'WEB_SYNC_DB_USER' => '', 'WEB_SYNC_DB_PASS' => '',
        'PLAN_DURATION_DAYS' => '30', 'PLAN_REMINDER_DAYS' => '7', 'MASTER_API_ENDPOINT_PATH' => '', 'SECRET_KEY' => $signingKey,
    ];
    if (isset($options['mysqldump-path'])) $envValues['POS_MYSQLDUMP_PATH'] = (string)$options['mysqldump-path'];
    if ($backupDirectory !== null) $envValues['POS_DB_BACKUP_DIR'] = $backupDirectory;
    $envContents = lightemSerializeEnvironment($envValues);
    $writeRuntimeSecret($root . '/.env', $envContents);
    $writeRuntimeSecret($root . '/api/config.php', "<?php\nreturn " . var_export($config, true) . ";\n");
    lightemVerifyInstallation($root, $payload, false, true, $connect);
    $pdo = $connect($config, $config['db']);
    $savedHash = $pdo->query("SELECT password FROM tbl_users_global_assignment WHERE email = 'admin' LIMIT 1")->fetchColumn();
    if (!is_string($savedHash) || !password_verify($adminPassword, $savedHash)) {
        throw new LightemSetupException('The initial POS account could not be verified. Keep the protected recovery file.');
    }
    lightemWriteMarker($root, $manifest, 'fresh');
    return ['success' => true, 'mode' => 'fresh', 'credentialsFile' => $credentialsPath, 'loginFile' => $loginPath, 'storeSetupRequired' => true];
    } catch (Throwable $error) {
        // DDL is not transactional. Remove only resources proven absent before
        // this run. Never drop an existing database, even if it began empty.
        if (!in_array(true, $preexistingDatabases, true)) {
            try {
                foreach ($createdDatabases as $database) $admin->exec('DROP DATABASE ' . lightemIdentifier($database));
                foreach ($createdAccounts as $account) $admin->exec('DROP USER ' . $account);
                foreach (['.env', 'api/config.php'] as $file) {
                    if (is_file($root . '/' . $file)) unlink($root . '/' . $file);
                }
                @unlink($loginPath);
            } catch (Throwable $cleanupError) {
                throw new LightemSetupException('Fresh setup failed and its new resources could not be fully cleaned up. Keep the protected recovery file; no preexisting database was dropped.');
            }
        }
        throw $error;
    }
}

if (PHP_SAPI === 'cli' && realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    try {
        $options = getopt('', ['root:', 'payload:', 'credentials:', 'adopt-existing', 'bootstrap-password-file:', 'database-port:', 'mysqldump-path:', 'runtime-group:', 'backup-dir:']);
        echo json_encode(lightemProvision($options), JSON_THROW_ON_ERROR) . PHP_EOL;
    } catch (Throwable $error) {
        lightemFail($error);
    }
}
