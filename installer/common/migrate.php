<?php
declare(strict_types=1);

require_once __DIR__ . '/database-admin.php';

/** Lex SQL without treating data strings or ordinary comments as identifiers. */
function lightemMigrationSqlTokens($input): Generator
{
    $buffer = ''; $offset = 0; $ended = false; $executable = false;
    $peek = static function (int $ahead = 0) use ($input, &$buffer, &$offset, &$ended): string {
        while (strlen($buffer) <= $offset + $ahead && !$ended) {
            $buffer = substr($buffer, $offset); $offset = 0;
            $part = fread($input, 65536);
            if ($part === false) throw new LightemSetupException('Cannot read the private migration SQL.');
            if ($part === '') $ended = true;
            $buffer .= $part;
        }
        return $buffer[$offset + $ahead] ?? '';
    };
    $take = static function () use ($peek, &$offset): string { $char = $peek(); if ($char !== '') $offset++; return $char; };
    while (($char = $peek()) !== '') {
        $raw = ''; $value = null; $type = 'symbol';
        if ($executable && $char === '*' && $peek(1) === '/') {
            $raw = $take() . $take(); $type = 'trivia'; $executable = false;
        } elseif ($char === '/' && $peek(1) === '*') {
            if ($executable) throw new LightemSetupException('Nested executable SQL comments require a reviewed migration.');
            $raw = $take() . $take(); $type = 'trivia';
            if ($peek() === '!' || ($peek() === 'M' && $peek(1) === '!')) {
                if ($peek() === 'M') $raw .= $take();
                $raw .= $take();
                while ($peek() !== '' && ctype_digit($peek())) $raw .= $take();
                $executable = true;
            } else {
                while ($peek() !== '' && !($peek() === '*' && $peek(1) === '/')) $raw .= $take();
                if ($peek() === '') throw new LightemSetupException('Unterminated SQL comment in migration backup.');
                $raw .= $take() . $take();
            }
        } elseif ($char === '#' || ($char === '-' && $peek(1) === '-' && ($peek(2) === '' || ord($peek(2)) <= 32))) {
            $type = 'trivia';
            while ($peek() !== '' && $peek() !== "\n") $raw .= $take();
        } elseif (ord($char) <= 32) {
            $type = 'trivia';
            while ($peek() !== '' && ord($peek()) <= 32) $raw .= $take();
        } elseif ($char === "'" || $char === '"' || $char === '`') {
            $quote = $take(); $raw = $quote; $value = ''; $type = $quote === '`' ? 'identifier' : 'string';
            while (true) {
                $next = $take();
                if ($next === '') throw new LightemSetupException('Unterminated SQL quoted value in migration backup.');
                $raw .= $next;
                if ($next === $quote) {
                    if ($peek() !== $quote) break;
                    $raw .= $take(); $value .= $quote;
                } elseif ($next === '\\' && $quote !== '`') {
                    $escaped = $take();
                    if ($escaped === '') throw new LightemSetupException('Unterminated SQL escape in migration backup.');
                    $raw .= $escaped; $value .= $next . $escaped;
                } else $value .= $next;
            }
        } elseif (ctype_alnum($char) || $char === '_' || $char === '$' || ord($char) >= 128) {
            $type = 'identifier';
            while (($next = $peek()) !== '' && (ctype_alnum($next) || $next === '_' || $next === '$' || ord($next) >= 128)) $raw .= $take();
            if (ctype_digit($raw)) $type = 'number';
            $value = $raw;
        } else $raw = $take();
        yield ['type' => $type, 'raw' => $raw, 'value' => $value ?? $raw];
    }
    if ($executable) throw new LightemSetupException('Unterminated executable SQL comment in migration backup.');
}

function lightemMigrationMap(array $source): array
{
    $map = [(string)$source['db'] => 'db_cnc_pos', (string)$source['report_db'] => 'reports_database'];
    if (count($map) !== 2 || strcasecmp((string)$source['db'], (string)$source['report_db']) === 0) {
        throw new LightemSetupException('Source primary and report databases must be distinct.');
    }
    foreach ($map as $name => $target) { lightemIdentifier((string)$name); lightemIdentifier($target); }
    return $map;
}

function lightemMigrationChangesNames(array $map): bool
{
    foreach ($map as $source => $target) if ((string)$source !== $target) return true;
    return false;
}

/** The source must use ordinary dump string quoting; ambiguous modes fail closed. */
function lightemMigrationSqlMode(string $mode): void
{
    if (preg_match('/(?:^|,)(?:ANSI_QUOTES|NO_BACKSLASH_ESCAPES)(?:,|$)/i', $mode)) {
        throw new LightemSetupException('ANSI_QUOTES or NO_BACKSLASH_ESCAPES SQL objects require a reviewed database-name migration.');
    }
}

/** Rewrite one token with a single lookup, including cyclic/overlapping maps. */
function lightemMigrationMappedToken(array $token, ?array $previous, ?array $next, array $map): string
{
    if ($token['type'] !== 'identifier') return $token['raw'];
    $before = $previous['value'] ?? '';
    $isUse = $previous !== null && $previous['type'] === 'identifier' && strcasecmp($previous['raw'], 'USE') === 0;
    $qualified = ($next['raw'] ?? '') === '.' && !in_array($before, ['.', '@'], true);
    if (!$isUse && !$qualified) return $token['raw'];
    if (!array_key_exists($token['value'], $map)) {
        foreach ($map as $source => $target) {
            if (strcasecmp((string)$source, $token['value']) === 0) throw new LightemSetupException('A source database reference uses different letter case; a reviewed database-name migration is required.');
        }
        return $token['raw'];
    }
    return lightemIdentifier($map[$token['value']]);
}

/** Streaming rewrite: strings can contain arbitrary old names without changes. */
function lightemMigrationRewriteStream($input, $output, array $map): void
{
    $pending = null; $trivia = ''; $previous = null; $previousPrevious = null;
    $write = static function (string $text) use ($output): void {
        $offset = 0;
        while ($offset < strlen($text)) {
            $count = fwrite($output, substr($text, $offset));
            if ($count === false || $count === 0) throw new LightemSetupException('Cannot write the private mapped migration SQL.');
            $offset += $count;
        }
    };
    foreach (lightemMigrationSqlTokens($input) as $token) {
        if ($token['type'] === 'trivia') {
            if ($pending === null) $write($token['raw']); else $trivia .= $token['raw'];
            continue;
        }
        if ($pending !== null) {
            if ($pending['type'] === 'string' && ($previous['raw'] ?? '') === '=' && strcasecmp((string)($previousPrevious['value'] ?? ''), 'SQL_MODE') === 0) lightemMigrationSqlMode($pending['value']);
            $write(lightemMigrationMappedToken($pending, $previous, $token, $map) . $trivia);
            $previousPrevious = $previous; $previous = $pending; $trivia = '';
        }
        $pending = $token;
    }
    if ($pending !== null) $write(lightemMigrationMappedToken($pending, $previous, null, $map) . $trivia);
}

function lightemMigrationRewriteSql(string $sql, array $map, bool $storedObject = false): string
{
    if (!lightemMigrationChangesNames($map)) return $sql;
    $input = fopen('php://temp', 'w+'); $output = fopen('php://temp', 'w+');
    if ($input === false || $output === false) throw new LightemSetupException('Cannot prepare SQL definition verification.');
    try {
        fwrite($input, $sql); rewind($input);
        $tokens = array_values(array_filter(iterator_to_array(lightemMigrationSqlTokens($input)), static fn(array $token): bool => $token['type'] !== 'trivia'));
        $qualifiedNames = [];
        foreach ($tokens as $index => $token) {
            if ($storedObject && $token['type'] === 'identifier' && in_array(strtoupper($token['value']), ['PREPARE', 'EXECUTE'], true)) {
                throw new LightemSetupException('Dynamic SQL objects require a reviewed database-name migration.');
            }
            if ($token['type'] === 'identifier' && isset($map[$token['value']]) && ($tokens[$index + 1]['raw'] ?? '') === '.' && !in_array($tokens[$index - 1]['raw'] ?? '', ['.', '@'], true)) $qualifiedNames[$token['value']] = true;
        }
        // An alias/table named like a source database makes a two-part reference
        // ambiguous. Preserve the original instead of guessing its meaning.
        foreach ($tokens as $index => $token) {
            $collision = isset($qualifiedNames[$token['value']]);
            if (!$collision) foreach ($qualifiedNames as $name => $_) if (strcasecmp((string)$name, $token['value']) === 0) $collision = true;
            if (!$collision || !in_array($token['type'], ['identifier', 'string'], true)) continue;
            $before = $tokens[$index - 1] ?? null; $after = $tokens[$index + 1] ?? null;
            $keyword = strtoupper((string)($before['value'] ?? ''));
            $nextKeyword = strtoupper((string)($after['value'] ?? ''));
            $cte = $token['type'] === 'identifier' && $nextKeyword === 'AS' && ($tokens[$index + 2]['raw'] ?? '') === '(' && ($before['raw'] ?? '') === ',';
            $declaration = in_array($keyword, ['AS', 'FROM', 'JOIN', 'UPDATE', 'INTO', 'TABLE', 'WITH'], true)
                || $cte || ($before['raw'] ?? '') === ')';
            $implicitAlias = $before !== null && $before['type'] === 'identifier'
                && !in_array($keyword, ['SELECT', 'DISTINCT', 'ALL', 'WHERE', 'AND', 'OR', 'BY', 'ON', 'SET', 'THEN', 'ELSE', 'RETURN', 'CASE', 'WHEN', 'NEW', 'OLD', 'USE', 'REFERENCES'], true);
            $qualifiedTableContext = strtoupper((string)($tokens[$index - 3]['value'] ?? ''));
            if (($before['raw'] ?? '') === '.' && ($after['raw'] ?? '') !== '.'
                && in_array($qualifiedTableContext, ['FROM', 'JOIN', 'UPDATE', 'INTO', 'REFERENCES', 'TABLE', 'VIEW', ',', '('], true)) {
                throw new LightemSetupException('A qualified table name collides with a source database name; a reviewed migration is required.');
            }
            if (($declaration || $implicitAlias) && ($after['raw'] ?? '') !== '.' && ($after['raw'] ?? '') !== '@' && ($before['raw'] ?? '') !== '.') {
                throw new LightemSetupException('An SQL alias or object name collides with a source database name; a reviewed migration is required.');
            }
        }
        rewind($input); lightemMigrationRewriteStream($input, $output, $map); rewind($output);
        $mapped = stream_get_contents($output);
        if ($mapped === false) throw new LightemSetupException('Cannot read mapped SQL definition.');
        return $mapped;
    } finally { fclose($input); fclose($output); }
}

function lightemMigrationMappedInventory(array $inventory, array $map): array
{
    if (!lightemMigrationChangesNames($map)) return $inventory;
    foreach ($inventory['tables'] as &$table) $table['definition'] = lightemMigrationRewriteSql($table['definition'], $map);
    unset($table);
    foreach ($inventory['objects'] as $kind => &$objects) {
        foreach ($objects as &$object) {
            lightemMigrationSqlMode((string)($object['SQL_MODE'] ?? ''));
            $object['definition'] = lightemMigrationRewriteSql($object['definition'], $map, $kind !== 'views');
        }
        unset($object);
    }
    unset($objects);
    return $inventory;
}

function lightemMigrationClientOptions(array $config): string
{
    $quote = static fn(string $value): string => '"' . strtr($value, ["\\" => "\\\\", '"' => '\\"', "\n" => '\\n', "\r" => '\\r']) . '"';
    return "[client]\nprotocol=tcp\nhost=" . $quote((string)$config['host']) . "\nport=" . lightemDatabasePort($config['port'] ?? 3306) . "\nuser=" . $quote((string)$config['user']) . "\npassword=" . $quote((string)$config['pass']) . "\ndefault-character-set=utf8mb4\n";
}

function lightemMigrationProcess(array $command, string $diagnostics, ?string $input = null): void
{
    $descriptors = [0 => $input === null ? ['pipe', 'r'] : ['file', $input, 'r'], 1 => ['file', $diagnostics, 'a'], 2 => ['file', $diagnostics, 'a']];
    $process = proc_open($command, $descriptors, $pipes, null, null, ['bypass_shell' => true]);
    if (!is_resource($process)) throw new LightemSetupException('Cannot start the bundled database migration program.');
    if ($input === null) fclose($pipes[0]);
    if (proc_close($process) !== 0) throw new LightemSetupException('Database migration export/import failed. The original database was not changed; retain the protected migration diagnostics.');
}

/** Order-independent SHA-256 multiset sum, retaining duplicate multiplicity. */
function lightemMigrationRowDigest(PDO $pdo, string $table): array
{
    $sum = array_fill(0, 32, 0);
    $count = 0;
    $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
    try {
        $query = $pdo->query('SELECT * FROM ' . lightemIdentifier($table));
        while (($row = $query->fetch(PDO::FETCH_NUM)) !== false) {
            $hash = hash_init('sha256');
            foreach ($row as $value) {
                hash_update($hash, $value === null ? 'N;' : 'V' . strlen((string)$value) . ':' . (string)$value . ';');
            }
            $bytes = array_values(unpack('C*', hash_final($hash, true)));
            $carry = 0;
            for ($i = 31; $i >= 0; $i--) {
                $total = $sum[$i] + $bytes[$i] + $carry;
                $sum[$i] = $total & 255;
                $carry = $total >> 8;
            }
            $count++;
        }
        $query->closeCursor();
    } finally {
        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
    }
    return ['rows' => $count, 'sha256Sum' => bin2hex(pack('C*', ...$sum))];
}

function lightemMigrationInventory(PDO $pdo, string $database, array $allowedDefiners, ?bool &$legacyRoutineMetadata = null, ?bool &$legacyEventMetadata = null): array
{
    $statement = $pdo->prepare('SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME');
    $statement->execute([$database]);
    $tables = $statement->fetchAll();
    $result = ['tables' => [], 'objects' => []];
    foreach ($tables as $table) {
        $name = (string)$table['TABLE_NAME'];
        $definition = $pdo->query('SHOW CREATE TABLE ' . lightemIdentifier($name))->fetch(PDO::FETCH_NUM);
        $result['tables'][$name] = ['type' => $table['TABLE_TYPE'], 'definition' => (string)$definition[1]];
        if ($table['TABLE_TYPE'] === 'BASE TABLE') $result['tables'][$name] += lightemMigrationRowDigest($pdo, $name);
    }
    // Definitions and definers are checked explicitly so copying a view or
    // trigger cannot silently leave it dependent on a missing database user.
    $queries = [
        'views' => ['SELECT TABLE_NAME AS name, DEFINER AS definer, VIEW_DEFINITION AS definition, CHECK_OPTION, SECURITY_TYPE FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME'],
        'triggers' => ['SELECT TRIGGER_NAME AS name, DEFINER AS definer, ACTION_STATEMENT AS definition, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, SQL_MODE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME'],
        'routines' => ['SELECT ROUTINE_NAME AS name, DEFINER AS definer, ROUTINE_DEFINITION AS definition, ROUTINE_TYPE, DATA_TYPE, SQL_MODE, SECURITY_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_NAME'],
        'events' => ['SELECT EVENT_NAME AS name, DEFINER AS definer, EVENT_DEFINITION AS definition, EVENT_TYPE, EXECUTE_AT, INTERVAL_VALUE, INTERVAL_FIELD, STARTS, ENDS, STATUS, SQL_MODE FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ? ORDER BY EVENT_NAME'],
    ];
    foreach ($queries as $kind => [$sql]) {
        try {
            $query = $pdo->prepare($sql);
            $query->execute([$database]);
            $objects = $query->fetchAll();
        } catch (PDOException $error) {
            $code = (int)($error->errorInfo[1] ?? 0);
            if (($code === 1558 && $kind === 'routines') || ($code === 1577 && $kind === 'events')) {
                    $metadataTable = $kind === 'routines' ? 'mysql.proc' : 'mysql.event';
                    try {
                        $legacy = $pdo->prepare('SELECT COUNT(*) FROM ' . $metadataTable . ' WHERE db = ?');
                        $legacy->execute([$database]);
                        $count = $legacy->fetchColumn();
                        if ($count !== 0 && $count !== '0') throw new LightemSetupException('Cannot verify zero objects in legacy ' . $metadataTable . '; a reviewed compatibility migration is required.');
                        $objects = [];
                        if ($kind === 'routines') $legacyRoutineMetadata = true; else $legacyEventMetadata = true;
                    } catch (Throwable $inspectionError) {
                        throw new LightemSetupException('The original MariaDB metadata is unavailable (' . $metadataTable . ' error ' . $code . '). Cannot prove this database has zero ' . ($kind === 'routines' ? 'stored routines' : 'scheduled events') . '; the original database was not changed and a reviewed compatibility migration is required.', 0, $inspectionError);
                    }
            } elseif ($code === 1558) {
                    throw new LightemSetupException('The original MariaDB system tables are incompatible with its server (metadata error 1558). Database objects could not be verified; the original database was not changed. A reviewed compatibility migration is required.', 0, $error);
            } else {
                throw $error;
            }
        }
        foreach ($objects as $object) {
            if (!in_array($object['definer'], $allowedDefiners, true) || $object['definition'] === null) {
                throw new LightemSetupException('A database object needs a reviewed migration because its definer or definition cannot be safely preserved.');
            }
        }
        $result['objects'][$kind] = $objects;
    }
    return $result;
}

function lightemResumeMigration(string $root, string $sourceRoot, string $payload, string $dataDir, array $options, callable $connect): array
{
    $marker = lightemMarker($root);
    $proof = lightemJson($root . '/.lightem-migration.json');
    if (($marker['installationMode'] ?? '') !== 'migrated' || !in_array($proof['formatVersion'] ?? 0, [1, 2], true) || ($proof['sourceRoot'] ?? '') !== $sourceRoot) {
        throw new LightemSetupException('The destination already contains settings; a verified matching migration is required to resume.');
    }
    if (!hash_equals((string)($proof['sourceEnvSha256'] ?? ''), hash_file('sha256', $sourceRoot . '/.env')) || !hash_equals((string)($proof['sourceConfigSha256'] ?? ''), hash_file('sha256', $sourceRoot . '/api/config.php'))) {
        throw new LightemSetupException('The original database configuration changed after migration; review is required before resuming.');
    }
    lightemRuntime($root);
    [, $source] = lightemSettings($sourceRoot);
    [$targetEnv, $target] = lightemSettings($root);
    $map = lightemMigrationMap($source);
    $sourceNames = ['primary' => (string)$source['db'], 'report' => (string)$source['report_db']];
    if ($target['db'] !== 'db_cnc_pos' || $target['report_db'] !== 'reports_database'
        || (($proof['formatVersion'] ?? 0) === 1 && lightemMigrationChangesNames($map))
        || (($proof['formatVersion'] ?? 0) === 2 && (($proof['databaseMap'] ?? null) !== $map || ($proof['sourceDatabases'] ?? null) !== $sourceNames))) {
        throw new LightemSetupException('The pending migration database-name mapping no longer matches its verified source and destination.');
    }
    if (isset($options['backup-dir']) && ($targetEnv['POS_DB_BACKUP_DIR'] ?? '') !== lightemBackupDirectory($root, (string)$options['backup-dir'])) {
        throw new LightemSetupException('The pending migration backup directory does not match this installation.');
    }
    $port = lightemDatabasePort($options['database-port'] ?? 3307);
    if (!in_array(strtolower((string)$source['host']), ['localhost', '127.0.0.1'], true) || $target['host'] !== '127.0.0.1' || lightemDatabasePort($target['port'] ?? 3306) !== $port || lightemDatabasePort($source['port'] ?? 3306) === $port) {
        throw new LightemSetupException('The migration database connection no longer matches its verified private destination.');
    }
    $source['host'] = '127.0.0.1';
    $rootConfig = ['host' => '127.0.0.1', 'port' => $port, 'user' => 'root', 'pass' => lightemReadRootPassword((string)($options['bootstrap-password-file'] ?? ''))];
    $admin = $connect($rootConfig);
    lightemVerifyPrivateDatabase($admin, $dataDir, $port);
    $requirements = lightemSchemaRequirements($payload);
    foreach (['primary' => 'db_cnc_pos', 'report' => 'reports_database'] as $kind => $database) {
        $sourceDatabase = $sourceNames[$kind];
        $existing = $connect($source, $sourceDatabase);
        $migrated = $connect($rootConfig, $database);
        lightemVerifySchema($migrated, $database, $requirements[$kind]['tables'], $kind, true);
        $expected = $proof['databases'][$database] ?? null;
        $definers = ['root@localhost', 'root@127.0.0.1', $source['user'] . '@localhost', $source['user'] . '@127.0.0.1'];
        $expectedSource = ($proof['formatVersion'] ?? 0) === 1 ? $expected : ($proof['sourceInventory'][$database] ?? null);
        if ($expected === null || $expectedSource === null || lightemMigrationInventory($existing, $sourceDatabase, $definers) !== $expectedSource || lightemMigrationInventory($migrated, $database, $definers) !== $expected) {
            throw new LightemSetupException('Database content changed after migration. The original and private copies were preserved; review is required before resuming.');
        }
    }
    lightemVerifyInstallation($root, $payload, true, false, $connect);
    return ['success' => true, 'mode' => 'migrated-resumed', 'databasePreserved' => true, 'loginPreserved' => true, 'credentialsFile' => $proof['credentialsFile'], 'backupFile' => $proof['backupFile']];
}

/** Source Apache must be stopped by the platform installer before this call. */
function lightemMigrate(array $options, array $services = []): array
{
    $connect = $services['connect'] ?? 'lightemConnect';
    $run = $services['process'] ?? 'lightemMigrationProcess';
    $group = (string)($options['runtime-group'] ?? 'daemon');
    $writeSecret = $services['writeRuntimeSecret'] ?? static fn(string $path, string $contents) => lightemRuntimeSecret($path, $contents, $group);
    $sourceRoot = lightemRoot((string)($options['source-root'] ?? ''));
    $root = lightemRoot((string)($options['root'] ?? ''));
    $payload = lightemRoot((string)($options['payload'] ?? ''));
    $dataDir = lightemRoot((string)($options['data-dir'] ?? ''));
    $backupDirectory = isset($options['backup-dir']) ? lightemBackupDirectory($root, (string)$options['backup-dir']) : null;
    if ($sourceRoot === $root) throw new LightemSetupException('Migration requires a separate private backend directory.');
    if (is_file($root . '/' . LIGHTEM_MARKER) && is_file($root . '/.lightem-migration.json')) {
        return lightemResumeMigration($root, $sourceRoot, $payload, $dataDir, $options, $connect);
    }
    foreach (['.env', 'api/config.php', LIGHTEM_MARKER] as $path) {
        if (file_exists($root . '/' . $path) || is_link($root . '/' . $path)) throw new LightemSetupException('The destination already contains settings or an installation marker; migration will not replace it.');
    }
    $manifest = lightemJson($payload . '/manifest.json');
    $requirements = lightemSchemaRequirements($payload);
    lightemRuntime($root); // Use the clean packaged dependencies for both roots.
    [$env, $source] = lightemSettings($sourceRoot);
    if (!in_array(strtolower((string)$source['host']), ['localhost', '127.0.0.1'], true)) throw new LightemSetupException('Automatic migration supports only the local XAMPP database on this computer.');
    $map = lightemMigrationMap($source);
    $sourceNames = ['primary' => (string)$source['db'], 'report' => (string)$source['report_db']];
    $source['host'] = '127.0.0.1'; // Never inherit the private runtime's Unix socket.
    $source['port'] = lightemDatabasePort($source['port'] ?? 3306);
    $port = lightemDatabasePort($options['database-port'] ?? 3307);
    if ($source['port'] === $port) throw new LightemSetupException('Source and destination databases must use separate local ports.');
    $rootPassword = lightemReadRootPassword((string)($options['bootstrap-password-file'] ?? ''));
    $adminConfig = ['host' => '127.0.0.1', 'port' => $port, 'user' => 'root', 'pass' => $rootPassword];
    $admin = $connect($adminConfig);
    lightemVerifyPrivateDatabase($admin, $dataDir, $port);
    if ((int)$admin->query("SELECT @@event_scheduler <> 'OFF'")->fetchColumn() !== 0) throw new LightemSetupException('Disable the private database event scheduler before migration.');
    $names = ['primary' => 'db_cnc_pos', 'report' => 'reports_database'];
    foreach ($names as $database) {
        $query = $admin->prepare('SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
        $query->execute([$database]);
        if ((int)$query->fetchColumn() !== 0) throw new LightemSetupException('The private destination database already exists; migration stopped without replacing it.');
    }
    $username = (string)$source['user'] === 'root' ? 'lightem_' . bin2hex(random_bytes(5)) : (string)$source['user'];
    if (!preg_match('/\A[A-Za-z0-9_]{1,80}\z/D', $username)) throw new LightemSetupException('The existing application database username requires a reviewed migration.');
    $password = bin2hex(random_bytes(24));
    $allowedDefiners = ['root@localhost', 'root@127.0.0.1', (string)$source['user'] . '@localhost', (string)$source['user'] . '@127.0.0.1'];
    $sourceConnections = [];
    $before = [];
    $mappedBefore = [];
    $collations = [];
    $skipLegacyRoutines = false;
    $skipLegacyEvents = false;
    foreach ($names as $kind => $database) {
        $sourceDatabase = $sourceNames[$kind];
        $connection = $connect($source, $sourceDatabase);
        if (lightemMigrationChangesNames($map)) lightemMigrationSqlMode((string)$connection->query('SELECT @@SESSION.sql_mode')->fetchColumn());
        lightemVerifySchema($connection, $sourceDatabase, $requirements[$kind]['tables'], $kind, true);
        $sourceConnections[$database] = $connection;
        $legacyRoutineMetadata = false;
        $legacyEventMetadata = false;
        $before[$database] = lightemMigrationInventory($connection, $sourceDatabase, $allowedDefiners, $legacyRoutineMetadata, $legacyEventMetadata);
        $skipLegacyRoutines = $skipLegacyRoutines || $legacyRoutineMetadata;
        $skipLegacyEvents = $skipLegacyEvents || $legacyEventMetadata;
        $mappedBefore[$database] = lightemMigrationMappedInventory($before[$database], $map);
        if ($before[$database]['objects']['events'] && (string)$connection->query('SELECT @@event_scheduler')->fetchColumn() !== 'OFF') {
            throw new LightemSetupException('The original database has active scheduled events. Stop its scheduled database writes before migration.');
        }
        $query = $connection->prepare('SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?');
        $query->execute([$sourceDatabase]);
        $collations[$database] = $query->fetch();
    }
    if ($skipLegacyRoutines) {
        foreach ($before as $inventory) if ($inventory['objects']['routines'] !== []) throw new LightemSetupException('Legacy routine metadata cannot be exported safely; a reviewed compatibility migration is required.');
    }
    if ($skipLegacyEvents) {
        foreach ($before as $inventory) if ($inventory['objects']['events'] !== []) throw new LightemSetupException('Legacy event metadata cannot be exported safely; a reviewed compatibility migration is required.');
    }
    foreach (['mysqldump-path', 'mysql-path'] as $name) {
        if (!is_file((string)($options[$name] ?? ''))) throw new LightemSetupException('The bundled database migration executable is missing.');
    }
    $credentials = lightemPrivateOutput(lightemCredentialsPath($root, (string)($options['credentials'] ?? '')));
    $dump = $credentials . '.migration.sql';
    $mappedDump = $credentials . '.mapped.sql';
    $diagnostics = $credentials . '.migration.log';
    $sourceOptions = $credentials . '.source.cnf';
    $targetOptions = $credentials . '.target.cnf';
    foreach ([$dump, $mappedDump, $diagnostics, $sourceOptions, $targetOptions] as $file) {
        if (file_exists($file) || is_link($file)) throw new LightemSetupException('Migration recovery outputs must not already exist.');
    }
    lightemWriteFile($credentials, "Lightem standalone migration recovery\n\nDatabase host: 127.0.0.1\nDatabase port: {$port}\nDatabase user: {$username}\nDatabase password: {$password}\nPrimary database: db_cnc_pos\nReport database: reports_database\n\nExisting POS usernames and passwords are unchanged. Store this file securely.\n", 0600, true);
    $created = [];
    $createdAccounts = [];
    try {
        foreach ([$dump, $diagnostics] as $file) lightemWriteFile($file, '', 0600, true);
        lightemWriteFile($sourceOptions, lightemMigrationClientOptions($source), 0600, true);
        lightemWriteFile($targetOptions, lightemMigrationClientOptions($adminConfig), 0600, true);
        $run([(string)$options['mysqldump-path'], '--defaults-file=' . $sourceOptions, '--single-transaction', '--skip-lock-tables', $skipLegacyRoutines ? '--skip-routines' : '--routines', $skipLegacyEvents ? '--skip-events' : '--events', '--triggers', '--hex-blob', '--no-create-db', '--result-file=' . $dump, '--databases', ...array_values($sourceNames)], $diagnostics);
        if (!is_file($dump) || filesize($dump) === 0) throw new LightemSetupException('The migration backup is empty.');
        $import = $dump;
        if (lightemMigrationChangesNames($map)) {
            lightemWriteFile($mappedDump, '', 0600, true);
            $input = fopen($dump, 'rb'); $output = fopen($mappedDump, 'wb');
            if ($input === false || $output === false) throw new LightemSetupException('Cannot open private database-name mapping files.');
            try { lightemMigrationRewriteStream($input, $output, $map); }
            finally { fclose($input); fclose($output); }
            $import = $mappedDump;
        }
        foreach ($names as $database) {
            $admin->exec('CREATE DATABASE ' . lightemIdentifier($database) . ' CHARACTER SET ' . lightemIdentifier((string)$collations[$database]['DEFAULT_CHARACTER_SET_NAME']) . ' COLLATE ' . lightemIdentifier((string)$collations[$database]['DEFAULT_COLLATION_NAME']));
            $created[] = $database;
        }
        foreach (['localhost', '127.0.0.1'] as $host) {
            $account = $admin->quote($username) . '@' . $admin->quote($host);
            $admin->exec('CREATE USER ' . $account . ' IDENTIFIED BY ' . $admin->quote($password));
            $createdAccounts[] = $account;
            foreach ($names as $database) $admin->exec('GRANT ALL PRIVILEGES ON ' . lightemIdentifier($database) . '.* TO ' . $account);
        }
        $run([(string)$options['mysql-path'], '--defaults-file=' . $targetOptions, '--binary-mode'], $diagnostics, $import);
        $config = $source;
        $config['host'] = '127.0.0.1';
        $config['port'] = $port;
        $config['user'] = $username;
        $config['pass'] = $password;
        $config['db'] = 'db_cnc_pos';
        $config['report_db'] = 'reports_database';
        $config['mysqldump_path'] = (string)$options['mysqldump-path'];
        foreach ($names as $kind => $database) {
            $destination = $connect($config, $database);
            lightemVerifySchema($destination, $database, $requirements[$kind]['tables'], $kind, true);
            $inspection = $connect($adminConfig, $database);
            if (lightemMigrationInventory($inspection, $database, $allowedDefiners) !== $mappedBefore[$database] || lightemMigrationInventory($sourceConnections[$database], $sourceNames[$kind], $allowedDefiners) !== $before[$database]) {
                throw new LightemSetupException('Migration verification found changed or mismatched database content. Original data was not changed; the private copy was not activated.');
            }
        }
        $env['DB_HOST'] = $config['host'];
        $env['DB_PORT'] = (string)$port;
        $env['DB_NAME'] = $config['db'];
        $env['DB_USER'] = $username;
        $env['DB_PASS'] = $password;
        $env['POS_MYSQLDUMP_PATH'] = (string)$options['mysqldump-path'];
        if ($backupDirectory !== null) $env['POS_DB_BACKUP_DIR'] = $backupDirectory;
        $envContents = lightemSerializeEnvironment($env);
        lightemProtectHttp($root, $group);
        $writeSecret($root . '/.env', $envContents);
        $writeSecret($root . '/api/config.php', "<?php\nreturn " . var_export($config, true) . ";\n");
        lightemVerifyInstallation($root, $payload, false, true, $connect, true);
        $proof = ['formatVersion' => 2, 'sourceRoot' => $sourceRoot, 'sourcePort' => $source['port'], 'targetPort' => $port, 'sourceDatabases' => $sourceNames, 'databaseMap' => $map, 'legacyRoutinesVerifiedEmpty' => $skipLegacyRoutines, 'legacyEventsVerifiedEmpty' => $skipLegacyEvents, 'sourceEnvSha256' => hash_file('sha256', $sourceRoot . '/.env'), 'sourceConfigSha256' => hash_file('sha256', $sourceRoot . '/api/config.php'), 'credentialsFile' => $credentials, 'backupFile' => $dump, 'sourceInventory' => $before, 'databases' => $mappedBefore];
        $proofJson = json_encode($proof, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
        lightemWriteFile($credentials . '.verification.json', $proofJson, 0600, true);
        lightemWriteFile($root . '/.lightem-migration.json', $proofJson, 0600, true);
        lightemWriteMarker($root, $manifest, 'migrated');
        return ['success' => true, 'mode' => 'migrated', 'databasePreserved' => true, 'loginPreserved' => true, 'credentialsFile' => $credentials, 'backupFile' => $dump];
    } catch (Throwable $error) {
        // Only resources proven absent at entry can be removed. The source
        // service, files and databases are never written by this helper.
        foreach ($created as $database) $admin->exec('DROP DATABASE ' . lightemIdentifier($database));
        foreach ($createdAccounts as $account) $admin->exec('DROP USER ' . $account);
        foreach (['.env', 'api/config.php', LIGHTEM_MARKER, '.lightem-migration.json'] as $file) if (is_file($root . '/' . $file)) unlink($root . '/' . $file);
        throw $error;
    } finally {
        foreach ([$sourceOptions, $targetOptions] as $file) if (is_file($file)) unlink($file);
    }
}

if (PHP_SAPI === 'cli' && realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    try {
        $options = getopt('', ['source-root:', 'root:', 'payload:', 'credentials:', 'bootstrap-password-file:', 'database-port:', 'mysqldump-path:', 'mysql-path:', 'data-dir:', 'runtime-group:', 'backup-dir:']);
        echo json_encode(lightemMigrate($options), JSON_THROW_ON_ERROR) . PHP_EOL;
    } catch (Throwable $error) { lightemFail($error); }
}
