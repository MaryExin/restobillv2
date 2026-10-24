<?php
declare(strict_types=1);

/** The standalone installer provides this path; older XAMPP installs retain their default. */
function posDatabaseDumpBinary(array $config): string
{
    $configured = trim((string)($config['mysqldump_path'] ?? $_ENV['POS_MYSQLDUMP_PATH'] ?? getenv('POS_MYSQLDUMP_PATH') ?: ''));
    $path = $configured !== '' ? $configured : (PHP_OS_FAMILY === 'Windows'
        ? 'C:\\xampp\\mysql\\bin\\mysqldump.exe'
        : '/Applications/XAMPP/xamppfiles/bin/mysqldump');
    if (!is_file($path)) throw new RuntimeException('The configured database backup program is unavailable.');
    return $path;
}

function posDatabaseClientOptions(array $config): string
{
    $quote = static fn(string $value): string => '"' . strtr($value, ["\\" => "\\\\", '"' => '\\"', "\n" => '\\n', "\r" => '\\r']) . '"';
    $port = filter_var($config['port'] ?? 3306, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
    if ($port === false) throw new RuntimeException('Invalid database port.');
    return "[client]\nprotocol=tcp\nhost=" . $quote((string)$config['host']) . "\nport={$port}\nuser=" . $quote((string)$config['user']) . "\npassword=" . $quote((string)$config['pass']) . "\ndefault-character-set=utf8mb4\n";
}

/** Credentials stay in a private temporary file, never the process arguments. */
function posDatabaseExport(array $config, string $destination): void
{
    $binary = posDatabaseDumpBinary($config);
    if (!preg_match('/\A[A-Za-z0-9_]{1,64}\z/D', (string)$config['db'])) throw new RuntimeException('Invalid database name.');
    $options = tempnam(sys_get_temp_dir(), 'lightem-db-client-');
    $errors = tempnam(sys_get_temp_dir(), 'lightem-db-errors-');
    if ($options === false || $errors === false) {
        if ($options !== false) unlink($options);
        if ($errors !== false) unlink($errors);
        throw new RuntimeException('Unable to prepare the database backup.');
    }
    try {
        if (!chmod($options, 0600) || !chmod($errors, 0600) || file_put_contents($options, posDatabaseClientOptions($config)) === false) {
            throw new RuntimeException('Unable to protect database backup credentials.');
        }
        $process = proc_open([$binary, '--defaults-file=' . $options, '--single-transaction', '--hex-blob', '--skip-lock-tables', '--result-file=' . $destination, (string)$config['db']], [0 => ['pipe', 'r'], 1 => ['file', $errors, 'a'], 2 => ['file', $errors, 'a']], $pipes, null, null, ['bypass_shell' => true]);
        if (!is_resource($process)) throw new RuntimeException('Unable to start database backup.');
        fclose($pipes[0]);
        if (proc_close($process) !== 0 || !is_file($destination) || filesize($destination) === 0) throw new RuntimeException('The database backup did not complete.');
    } finally {
        unlink($options);
        unlink($errors);
    }
}
