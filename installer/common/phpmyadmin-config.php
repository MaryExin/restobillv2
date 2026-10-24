<?php
declare(strict_types=1);

// Installer-only helper. No database connection, SQL, or stored login password.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function pmaSafePath(string $path): void
{
    if ($path === '' || str_contains($path, "\0")) {
        throw new RuntimeException('A phpMyAdmin configuration path is invalid.');
    }
    for ($current = $path; ; $current = dirname($current)) {
        if (is_link($current)) {
            throw new RuntimeException('A phpMyAdmin configuration path is a symbolic link.');
        }
        if (dirname($current) === $current) {
            break;
        }
    }
}

try {
    $args = getopt('', ['root:', 'temp-dir:', 'secret-file:']);
    foreach (['root', 'temp-dir', 'secret-file'] as $key) {
        if (!isset($args[$key]) || !is_string($args[$key])) {
            throw new RuntimeException('Missing phpMyAdmin configuration argument: ' . $key);
        }
        pmaSafePath($args[$key]);
    }
    $root = realpath($args['root']);
    $temp = realpath($args['temp-dir']);
    $secretFile = $args['secret-file'];
    if ($root === false || $temp === false || !is_dir($root) || !is_dir($temp)
        || !is_file($root . '/index.php') || !is_dir(dirname($secretFile))) {
        throw new RuntimeException('The phpMyAdmin installation directories are incomplete.');
    }
    if (!file_exists($secretFile)) {
        $secret = base64_encode(random_bytes(24));
        $handle = fopen($secretFile, 'xb');
        if ($handle === false) {
            throw new RuntimeException('Cannot create the private phpMyAdmin cookie key.');
        }
        try {
            if (!chmod($secretFile, 0600) || fwrite($handle, $secret . "\n") !== 33 || !fflush($handle)) {
                throw new RuntimeException('Cannot save the private phpMyAdmin cookie key.');
            }
        } finally {
            fclose($handle);
        }
    }
    if (!is_file($secretFile)) {
        throw new RuntimeException('The private phpMyAdmin cookie key is not a regular file.');
    }
    $secret = file_get_contents($secretFile);
    if ($secret === false || !preg_match('/\A[A-Za-z0-9+\/]{32}\n?\z/D', $secret)) {
        throw new RuntimeException('The private phpMyAdmin cookie key is invalid; it was preserved for recovery.');
    }
    $secret = rtrim($secret, "\n");
    $config = "<?php\n// Managed by Lightem standalone setup. Database credentials are entered at login.\n";
    $values = [
        'blowfish_secret' => $secret,
        'Servers' => [1 => [
            'auth_type' => 'cookie',
            'host' => '127.0.0.1',
            'port' => '3307',
            'verbose' => 'Lightem standalone',
            'AllowNoPassword' => false,
        ]],
        'ServerDefault' => 1,
        'AllowArbitraryServer' => false,
        'TempDir' => str_replace('\\', '/', $temp),
        'ZeroConf' => false,
        'PmaNoRelation_DisableWarning' => true,
        'AllowThirdPartyFraming' => false,
        'LoginCookieValidity' => 1440,
        'LoginCookieStore' => 0,
        'LoginCookieRecall' => false,
        'SendErrorReports' => 'never',
        'VersionCheck' => false,
    ];
    foreach ($values as $key => $value) {
        $config .= '$cfg[' . var_export($key, true) . '] = ' . var_export($value, true) . ";\n";
    }
    $destination = $root . '/config.inc.php';
    pmaSafePath($destination);
    $staged = $root . '/.lightem-config-' . bin2hex(random_bytes(8));
    try {
        if (file_put_contents($staged, $config, LOCK_EX) !== strlen($config)
            || !chmod($staged, 0600) || !rename($staged, $destination)) {
            throw new RuntimeException('Cannot save the phpMyAdmin configuration.');
        }
    } finally {
        if (is_file($staged)) {
            unlink($staged);
        }
    }
    echo "phpMyAdmin cookie login configured for the private database.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'phpMyAdmin setup: ' . $error->getMessage() . "\n");
    exit(1);
}
