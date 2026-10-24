<?php
declare(strict_types=1);

require_once __DIR__ . '/provision.php';

function lightemPrivateOutput(string $path): string
{
    if ($path === '' || str_contains($path, "\0") || (!str_starts_with($path, '/') && !preg_match('~\A[A-Za-z]:[\\\\/]~', $path))) {
        throw new LightemSetupException('A private absolute installation path is required.');
    }
    $directory = realpath(dirname($path));
    if ($directory === false || is_link($path)) throw new LightemSetupException('The private installation directory is missing or unsafe.');
    for ($parent = dirname($path); dirname($parent) !== $parent; $parent = dirname($parent)) {
        if (is_link($parent)) throw new LightemSetupException('Private installation paths must not use symbolic links.');
    }
    if (PHP_OS_FAMILY !== 'Windows' && ((fileperms($directory) & 0022) !== 0 || fileowner($directory) !== posix_geteuid())) {
        throw new LightemSetupException('The private installation directory is not protected by the installer account.');
    }
    return $directory . DIRECTORY_SEPARATOR . basename($path);
}

function lightemReadRootPassword(string $path): string
{
    $path = lightemPrivateOutput($path);
    if (!is_file($path) || (PHP_OS_FAMILY !== 'Windows' && ((fileperms($path) & 0077) !== 0 || fileowner($path) !== posix_geteuid()))) {
        throw new LightemSetupException('The database administrator credential file is missing or not private.');
    }
    $password = trim((string)file_get_contents($path));
    if (!preg_match('/\A[a-f0-9]{64}\z/D', $password)) throw new LightemSetupException('The managed database administrator credential is invalid.');
    return $password;
}

function lightemNormalizedDataDir(string $path): string
{
    $value = rtrim(str_replace('\\', '/', $path), '/');
    return PHP_OS_FAMILY === 'Windows' ? strtolower($value) : $value;
}

function lightemVerifyPrivateDatabase(PDO $pdo, string $dataDir, int $port): void
{
    $actual = (string)$pdo->query('SELECT @@datadir')->fetchColumn();
    if (lightemNormalizedDataDir($actual) !== lightemNormalizedDataDir($dataDir)) {
        throw new LightemSetupException('The connected database is not the private Lightem data directory.');
    }
    if ((int)$pdo->query('SELECT @@port')->fetchColumn() !== $port) throw new LightemSetupException('The private database port does not match its service configuration.');
    if (!in_array(strtolower((string)$pdo->query('SELECT @@bind_address')->fetchColumn()), ['127.0.0.1', '::1', 'localhost'], true)) {
        throw new LightemSetupException('The private database must listen only on this computer.');
    }
    if ((int)$pdo->query("SELECT COUNT(*) FROM mysql.user WHERE User = '' OR (User = 'root' AND Host NOT IN ('localhost', '127.0.0.1'))")->fetchColumn() !== 0) {
        throw new LightemSetupException('The private database still contains anonymous or remote administrator accounts.');
    }
    if ((int)$pdo->query("SELECT COUNT(*) FROM mysql.user WHERE User='root' AND (Password='' OR plugin<>'mysql_native_password')")->fetchColumn() !== 0) {
        throw new LightemSetupException('Every private database administrator account must require its generated password.');
    }
}

/** Called only for the isolated, newly initialized standalone datadir. */
function lightemDatabaseAdmin(array $options): array
{
    $dataDir = lightemRoot((string)($options['data-dir'] ?? ''));
    $credentials = lightemPrivateOutput((string)($options['credentials'] ?? ''));
    if (isset($options['prepare-init-file'])) {
        $init = lightemPrivateOutput((string)$options['prepare-init-file']);
        $resume = isset($options['resume-init-file']);
        if ($init === $credentials || file_exists($init) || (!$resume && file_exists($credentials))) throw new LightemSetupException('Fresh database credentials and initialization files must not already exist.');
        $password = $resume ? lightemReadRootPassword($credentials) : bin2hex(random_bytes(32));
        if (!is_dir($dataDir . '/mysql')) throw new LightemSetupException('Initialize the fresh private MariaDB system tables first.');
        foreach (new DirectoryIterator($dataDir) as $entry) {
            if ($entry->isDot()) continue;
            if ($entry->isLink() || ($entry->isDir() && !in_array($entry->getFilename(), ['mysql', 'performance_schema', 'sys', 'test'], true))) {
                throw new LightemSetupException('Refusing administrator initialization for a data directory containing application data.');
            }
        }
        // The service reads this before it accepts TCP connections. Every
        // privileged statement is conditional on its exact private datadir.
        $quote = static fn(string $value): string => "'" . str_replace(["\\", "'"], ["\\\\", "''"], $value) . "'";
        $expected = lightemNormalizedDataDir($dataDir);
        $actual = "TRIM(TRAILING '/' FROM REPLACE(@@datadir, CHAR(92), '/'))";
        if (PHP_OS_FAMILY === 'Windows') $actual = 'LOWER(' . $actual . ')';
        $statements = [
            "DELETE FROM mysql.global_priv WHERE User = '' OR (User = 'root' AND Host <> 'localhost')",
            "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('" . $password . "')",
            "CREATE OR REPLACE USER 'root'@'127.0.0.1' IDENTIFIED BY '" . $password . "'",
            "GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION",
            'FLUSH PRIVILEGES',
        ];
        // An init-file executes each newline as a complete statement. One
        // MariaDB compound statement keeps the guard and account operations
        // together, without depending on session variables between lines.
        $sql = 'IF ' . $actual . ' = ' . $quote($expected) . ' THEN ' . implode('; ', $statements) . "; END IF;\n";
        if (!$resume) lightemWriteFile($credentials, $password . "\n", 0600, true);
        try {
            lightemWriteFile($init, $sql, 0600, true);
        } catch (Throwable $error) {
            if (!$resume) unlink($credentials);
            throw $error;
        }
        return ['success' => true, 'mode' => 'prepared'];
    }
    $port = lightemDatabasePort($options['database-port'] ?? 3307);
    $password = lightemReadRootPassword($credentials);
    $pdo = lightemConnect(['host' => '127.0.0.1', 'port' => $port, 'user' => 'root', 'pass' => $password]);
    lightemVerifyPrivateDatabase($pdo, $dataDir, $port);
    return ['success' => true, 'mode' => 'verified', 'databasePort' => $port];
}

if (PHP_SAPI === 'cli' && realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    try {
        echo json_encode(lightemDatabaseAdmin(getopt('', ['credentials:', 'data-dir:', 'database-port:', 'prepare-init-file:', 'resume-init-file'])), JSON_THROW_ON_ERROR) . PHP_EOL;
    } catch (Throwable $error) { lightemFail($error); }
}
