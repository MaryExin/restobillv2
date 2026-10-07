<?php
declare(strict_types=1);

require_once __DIR__ . '/verify.php';

/** Reject links before resolving paths, including links in existing parents. */
function lightemRecoveryPath(string $path): string
{
    if ($path === '' || $path[0] !== '/' || str_contains($path, "\0")) {
        throw new LightemSetupException('Recovery requires absolute local paths.');
    }
    $parts = explode('/', trim($path, '/'));
    $current = '';
    foreach ($parts as $index => $part) {
        if ($part === '' || $part === '.' || $part === '..') {
            throw new LightemSetupException('Recovery paths must not contain relative components.');
        }
        $current .= '/' . $part;
        clearstatcache(true, $current);
        $stat = @lstat($current);
        if ($stat !== false && ($stat['mode'] & 0170000) === 0120000) {
            throw new LightemSetupException('Recovery stopped because an installation path is a symbolic link.');
        }
        if ($stat !== false && $index !== count($parts) - 1 && ($stat['mode'] & 0170000) !== 0040000) {
            throw new LightemSetupException('A recovery path parent is not a directory.');
        }
    }
    return $current;
}

function lightemRecoveryNode(string $path, bool $directory): array
{
    lightemRecoveryPath($path);
    $stat = @lstat($path);
    if ($stat === false || ($stat['mode'] & 0170000) !== ($directory ? 0040000 : 0100000)) {
        throw new LightemSetupException('Recovery requires regular files and directories.');
    }
    return $stat;
}

function lightemRecoveryTrustedDirectory(string $path, bool $private = false): void
{
    $stat = lightemRecoveryNode($path, true);
    if (!function_exists('posix_geteuid') || $stat['uid'] !== posix_geteuid()
        || ($stat['mode'] & ($private ? 0077 : 0022)) !== 0) {
        throw new LightemSetupException('The recovery directory is not protected by the current installer account.');
    }
}

function lightemRecoveryRead(string $path): string
{
    $stat = lightemRecoveryNode($path, false);
    if ($stat['size'] > 1048576) {
        throw new LightemSetupException('A recovery configuration file is unexpectedly large.');
    }
    $contents = @file_get_contents($path);
    if ($contents === false || $contents === '') {
        throw new LightemSetupException('A required recovery configuration file is empty or unreadable.');
    }
    return $contents;
}

function lightemRecoveryMarker(string $root): array
{
    lightemRecoveryNode($root . '/' . LIGHTEM_MARKER, false);
    $marker = lightemMarker($root);
    if ($marker === null || ($marker['formatVersion'] ?? null) !== 1
        || !is_string($marker['version'] ?? null) || $marker['version'] === ''
        || !is_string($marker['buildId'] ?? null) || !preg_match('/\A[0-9]{1,20}\z/D', $marker['buildId'])
        || !is_string($marker['backendSha256'] ?? null) || !preg_match('/\A[a-fA-F0-9]{64}\z/D', $marker['backendSha256'])) {
        throw new LightemSetupException('A valid managed-installation marker is required for recovery.');
    }
    return $marker;
}

function lightemRecoveryCompleteBackup(string $root): bool
{
    lightemRecoveryNode($root, true);
    foreach (['api', 'src', 'vendor'] as $part) {
        lightemRecoveryPath($root . '/' . $part);
        if (!file_exists($root . '/' . $part)) return false;
        lightemRecoveryNode($root . '/' . $part, true);
    }
    foreach (['api/bootstrap.php', 'api/login.php', 'api/pos_lan_health.php', 'api/config.php',
        'src/Database.php', 'src/JWTCodec.php', 'src/UserGateway.php', 'vendor/autoload.php', '.env'] as $file) {
        lightemRecoveryPath($root . '/' . $file);
        if (!file_exists($root . '/' . $file)) return false;
        lightemRecoveryNode($root . '/' . $file, false);
    }
    return true;
}

function lightemRecoveryWrite(string $path, string $contents): void
{
    $stream = @fopen($path, 'xb');
    if ($stream === false) throw new LightemSetupException('Cannot create the private recovery files.');
    try {
        if (!chmod($path, 0600) || fwrite($stream, $contents) !== strlen($contents) || !fflush($stream)) {
            throw new LightemSetupException('Cannot write the private recovery files.');
        }
    } finally {
        fclose($stream);
    }
}

function lightemRecoveryCopyTree(string $source, string $destination): void
{
    lightemRecoveryNode($source, true);
    if (!mkdir($destination, 0700) || !chmod($destination, 0700)) {
        throw new LightemSetupException('Cannot create the private recovery backend.');
    }
    foreach (new DirectoryIterator($source) as $entry) {
        if ($entry->isDot()) continue;
        $from = $source . '/' . $entry->getFilename();
        $to = $destination . '/' . $entry->getFilename();
        lightemRecoveryPath($from);
        if ($entry->isDir()) {
            lightemRecoveryCopyTree($from, $to);
        } else {
            lightemRecoveryNode($from, false);
            $input = @fopen($from, 'rb');
            $output = @fopen($to, 'xb');
            if ($input === false || $output === false) {
                if (is_resource($input)) fclose($input);
                if (is_resource($output)) fclose($output);
                throw new LightemSetupException('Cannot copy the packaged recovery backend.');
            }
            try {
                if (!chmod($to, 0600) || stream_copy_to_stream($input, $output) === false || !fflush($output)) {
                    throw new LightemSetupException('Cannot copy the packaged recovery backend.');
                }
            } finally {
                fclose($input);
                fclose($output);
            }
        }
    }
}

/** Only used on the new, private destination owned by this invocation. */
function lightemRecoveryRemove(string $path): void
{
    if (is_link($path) || !is_dir($path)) {
        @unlink($path);
        return;
    }
    foreach (new DirectoryIterator($path) as $entry) {
        if (!$entry->isDot()) lightemRecoveryRemove($path . '/' . $entry->getFilename());
    }
    @rmdir($path);
}

/** The verifier seam is in-process only; CLI callers cannot replace it. */
function lightemRecover(array $options, ?callable $verify = null): array
{
    $verify ??= static fn(string $root, string $payload, bool $beforeUpdate): array =>
        lightemVerifyInstallation($root, $payload, $beforeUpdate);
    $root = lightemRecoveryPath((string)($options['root'] ?? ''));
    $payload = lightemRecoveryPath((string)($options['payload'] ?? ''));
    $backups = lightemRecoveryPath((string)($options['backups'] ?? ''));
    $destination = lightemRecoveryPath((string)($options['destination'] ?? ''));
    lightemRecoveryNode($root, true);
    lightemRecoveryNode($payload, true);
    lightemRecoveryMarker($root);
    lightemRecoveryTrustedDirectory(dirname($destination));
    if (file_exists($destination) || is_link($destination)) {
        throw new LightemSetupException('Recovery requires a new private staging destination.');
    }
    foreach ([$root, $payload, $backups] as $protected) {
        if ($destination === $protected || str_starts_with($destination, $protected . '/')) {
            throw new LightemSetupException('Recovery staging must be outside the installation, payload and backups.');
        }
    }
    if (file_exists($payload . '/backend/.env') || file_exists($payload . '/backend/api/config.php')) {
        throw new LightemSetupException('The packaged recovery backend unexpectedly contains local settings.');
    }
    $settings = [];
    foreach (['.env', 'api/config.php'] as $file) {
        lightemRecoveryPath($root . '/' . $file);
        if (file_exists($root . '/' . $file)) $settings[$file] = lightemRecoveryRead($root . '/' . $file);
    }
    $source = 'existing-settings';
    $backupId = null;
    if (count($settings) !== 2) {
        lightemRecoveryTrustedDirectory(dirname($backups));
        lightemRecoveryTrustedDirectory($backups, true);
        $candidates = [];
        foreach (new DirectoryIterator($backups) as $entry) {
            $id = $entry->getFilename();
            if (!preg_match('/\A[0-9]{14}-[0-9]+\z/D', $id)) continue;
            $run = $backups . '/' . $id;
            lightemRecoveryTrustedDirectory($run, true);
            $candidate = $run . '/backend';
            lightemRecoveryPath($candidate);
            if (!file_exists($candidate) || !lightemRecoveryCompleteBackup($candidate)) continue;
            if (file_exists($candidate . '/' . LIGHTEM_MARKER) || is_link($candidate . '/' . LIGHTEM_MARKER)) lightemRecoveryMarker($candidate);
            // ditto preserves original ownership and modes. The root-owned,
            // private backups/run ancestors prevent other users reaching these
            // files, including legacy files that retain their previous owner.
            $pair = ['.env' => lightemRecoveryRead($candidate . '/.env'),
                'api/config.php' => lightemRecoveryRead($candidate . '/api/config.php')];
            $matches = true;
            foreach ($settings as $file => $contents) {
                if (!hash_equals($contents, $pair[$file])) $matches = false;
            }
            if (!$matches) continue;
            $key = hash('sha256', strlen($pair['.env']) . ':' . $pair['.env'] . $pair['api/config.php']);
            $candidates[$key][$id] = $pair;
        }
        if (count($candidates) === 0) {
            throw new LightemSetupException('The managed backend is incomplete and no matching protected backup can restore its settings. Existing databases were left unchanged.');
        }
        if (count($candidates) !== 1) {
            throw new LightemSetupException('Protected backups contain different database settings. Automatic recovery cannot choose safely; existing databases were left unchanged.');
        }
        $matching = reset($candidates);
        krsort($matching, SORT_STRING);
        $backupId = array_key_first($matching);
        $settings = $matching[$backupId];
        $source = 'backup';
    }
    $created = false;
    try {
        if (!mkdir($destination, 0700)) throw new LightemSetupException('Cannot create the private recovery destination.');
        $created = true;
        if (!chmod($destination, 0700)) throw new LightemSetupException('Cannot protect the private recovery destination.');
        foreach (['api', 'src', 'vendor'] as $part) {
            lightemRecoveryCopyTree($payload . '/backend/' . $part, $destination . '/' . $part);
        }
        foreach ($settings as $file => $contents) lightemRecoveryWrite($destination . '/' . $file, $contents);
        lightemRecoveryWrite($destination . '/' . LIGHTEM_MARKER, lightemRecoveryRead($root . '/' . LIGHTEM_MARKER));
        $result = $verify($destination, $payload, true);
        if (!is_array($result) || ($result['success'] ?? false) !== true) {
            throw new LightemSetupException('The recovered configuration did not pass read-only database verification.');
        }
        return ['success' => true, 'source' => $source, 'backupId' => $backupId];
    } catch (Throwable $error) {
        if ($created) lightemRecoveryRemove($destination);
        throw $error;
    }
}

if (PHP_SAPI === 'cli' && realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    try {
        $options = getopt('', ['root:', 'payload:', 'backups:', 'destination:']);
        echo json_encode(lightemRecover($options), JSON_THROW_ON_ERROR) . PHP_EOL;
    } catch (Throwable $error) {
        lightemFail($error);
    }
}
