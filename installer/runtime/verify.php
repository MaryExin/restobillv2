<?php
declare(strict_types=1);
/** Verify the private server runtime before setup executes any of its services. */
function lightemVerifyRuntime(string $runtime, string $expectedDigest, ?string $expectedPlatform = null): array
{
    if (is_link($runtime) || !is_dir($runtime)) throw new RuntimeException('Runtime directory is missing or is a link.');
    $runtime = realpath($runtime);
    $manifestPath = $runtime . '/runtime-manifest.json';
    if (is_link($manifestPath) || !is_file($manifestPath)) throw new RuntimeException('Runtime manifest is missing.');
    $manifest = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
    if (($manifest['schemaVersion'] ?? null) !== 1 || ($manifest['id'] ?? null) !== 'lightem-server-8.2.4-1' ||
        !is_array($manifest['files'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $expectedDigest) ||
        !hash_equals($expectedDigest, (string)($manifest['sha256'] ?? '')) ||
        ($expectedPlatform !== null && ($manifest['platform'] ?? null) !== $expectedPlatform)) {
        throw new RuntimeException('Runtime manifest is incompatible.');
    }
    $encoded = json_encode($manifest['files'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    if (!hash_equals($expectedDigest, hash('sha256', $encoded))) throw new RuntimeException('Runtime inventory checksum failed.');
    $seen = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($runtime, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
    foreach ($iterator as $file) {
        if ($file->isLink()) throw new RuntimeException('Runtime contains an unexpected link.');
        if ($file->isDir()) continue;
        if (!$file->isFile()) throw new RuntimeException('Runtime contains an unsupported file type.');
        $relative = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($runtime) + 1));
        if ($relative === 'runtime-manifest.json') continue;
        $expected = $manifest['files'][$relative] ?? null;
        if (!is_array($expected) || $file->getSize() !== ($expected['size'] ?? null) ||
            !hash_equals((string)($expected['sha256'] ?? ''), hash_file('sha256', $file->getPathname()))) {
            throw new RuntimeException('Runtime file checksum failed: ' . $relative);
        }
        $seen[$relative] = true;
    }
    if (count($seen) !== count($manifest['files'])) throw new RuntimeException('Runtime files are missing.');
    return ['success' => true, 'runtimeVersion' => $manifest['id'], 'runtimeSha256' => $expectedDigest];
}
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        $options = getopt('', ['root:', 'sha256:', 'platform:']);
        if (!is_string($options['root'] ?? null) || !is_string($options['sha256'] ?? null)) throw new RuntimeException('Use --root and --sha256.');
        echo json_encode(lightemVerifyRuntime($options['root'], $options['sha256'], $options['platform'] ?? null), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    } catch (Throwable $error) {
        fwrite(STDERR, 'Runtime verification failed: ' . $error->getMessage() . PHP_EOL);
        exit(1);
    }
}
