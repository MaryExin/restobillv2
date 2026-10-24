<?php
declare(strict_types=1);

/** Verify pristine phpMyAdmin code before copying it or generating local config. */
function lightemVerifyPhpMyAdmin(string $root, string $expectedDigest, ?string $expectedVersion = null): array
{
    if (is_link($root) || !is_dir($root)) throw new RuntimeException('phpMyAdmin directory is missing or linked.');
    $root = realpath($root);
    $manifestPath = $root . '/phpmyadmin-manifest.json';
    if (is_link($manifestPath) || !is_file($manifestPath)) throw new RuntimeException('phpMyAdmin manifest is missing or linked.');
    $manifest = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
    $version = $manifest['version'] ?? '';
    if (($manifest['schemaVersion'] ?? null) !== 1 || !is_string($version) || !preg_match('/^\d+\.\d+\.\d+$/D', $version)
        || ($manifest['id'] ?? null) !== 'phpmyadmin-' . $version
        || !is_array($manifest['files'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $expectedDigest)
        || !hash_equals($expectedDigest, (string)($manifest['sha256'] ?? ''))
        || ($expectedVersion !== null && $version !== $expectedVersion)) {
        throw new RuntimeException('phpMyAdmin manifest is incompatible.');
    }
    $encoded = json_encode($manifest['files'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    if (!hash_equals($expectedDigest, hash('sha256', $encoded))) throw new RuntimeException('phpMyAdmin inventory checksum failed.');
    foreach (['index.php', 'vendor/autoload.php', 'libraries/classes/Version.php', 'LICENSE'] as $required) {
        if (!isset($manifest['files'][$required])) throw new RuntimeException('phpMyAdmin distribution is incomplete.');
    }
    if (file_exists($root . '/config.inc.php') || is_link($root . '/config.inc.php')) throw new RuntimeException('phpMyAdmin payload contains local configuration.');
    $seen = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
    foreach ($iterator as $file) {
        if ($file->isLink()) throw new RuntimeException('phpMyAdmin contains an unexpected link.');
        if ($file->isDir()) continue;
        if (!$file->isFile()) throw new RuntimeException('phpMyAdmin contains an unsupported file type.');
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($root) + 1));
        if ($relative === 'phpmyadmin-manifest.json') continue;
        $expected = $manifest['files'][$relative] ?? null;
        if (!is_array($expected) || $file->getSize() !== ($expected['size'] ?? null)
            || !hash_equals((string)($expected['sha256'] ?? ''), hash_file('sha256', $file->getPathname()))) {
            throw new RuntimeException('phpMyAdmin file checksum failed: ' . $relative);
        }
        $seen[$relative] = true;
    }
    if (count($seen) !== count($manifest['files'])) throw new RuntimeException('phpMyAdmin files are missing.');
    return ['success' => true, 'phpMyAdminVersion' => $version, 'phpMyAdminSha256' => $expectedDigest];
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        $options = getopt('', ['root:', 'sha256:', 'version:']);
        if (!is_string($options['root'] ?? null) || !is_string($options['sha256'] ?? null)) throw new RuntimeException('Use --root and --sha256.');
        echo json_encode(lightemVerifyPhpMyAdmin($options['root'], $options['sha256'], $options['version'] ?? null), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    } catch (Throwable $error) {
        fwrite(STDERR, 'phpMyAdmin verification failed: ' . $error->getMessage() . PHP_EOL);
        exit(1);
    }
}
