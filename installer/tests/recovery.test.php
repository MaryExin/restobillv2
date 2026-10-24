<?php
declare(strict_types=1);

// Filesystem-only fixtures. The in-process verifier never opens a database or
// loads application code; real database verification has separate integration coverage.
require_once __DIR__ . '/../common/recover.php';

$testCount = 0;
function recoveryCheck(bool $condition, string $name): void
{
    global $testCount;
    if (!$condition) throw new RuntimeException('FAIL: ' . $name);
    $testCount++;
    echo 'PASS ' . $name . PHP_EOL;
}
function recoveryReject(callable $callback, string $fragment, string $name): void
{
    try { $callback(); } catch (LightemSetupException $error) {
        recoveryCheck(str_contains($error->getMessage(), $fragment), $name);
        return;
    }
    throw new RuntimeException('FAIL: ' . $name . ' did not reject');
}
function recoveryFixtureFile(string $path, string $contents): void
{
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
    file_put_contents($path, $contents);
    chmod($path, 0600);
}
function recoveryFixtureMarker(): string
{
    return json_encode(['installerId' => LIGHTEM_INSTALLER_ID, 'formatVersion' => 1,
        'version' => '0.0.1', 'buildId' => '20260926073235', 'backendSha256' => str_repeat('a', 64)], JSON_THROW_ON_ERROR);
}
function recoveryFixtureCode(string $root): void
{
    foreach (['api/bootstrap.php', 'api/login.php', 'api/pos_lan_health.php', 'src/Database.php',
        'src/JWTCodec.php', 'src/UserGateway.php', 'vendor/autoload.php'] as $file) {
        recoveryFixtureFile($root . '/' . $file, '<?php // isolated fixture ' . $file . "\n");
    }
}
function recoveryFixturePair(string $label = 'original'): array
{
    return ['.env' => "DB_NAME=db_cnc_pos\nDB_PASS=private-{$label}-password\nSECRET_KEY=private-{$label}-signing-key\n",
        'api/config.php' => "<?php return ['db'=>'db_cnc_pos','pass'=>'private-{$label}-password','report_db'=>'reports_database'];\n"];
}
function recoveryFixtureBackup(array $args, string $id, ?array $pair = null): string
{
    $root = $args['backups'] . '/' . $id . '/backend';
    mkdir($root, 0700, true);
    chmod(dirname($root), 0700);
    recoveryFixtureCode($root);
    foreach ($pair ?? recoveryFixturePair() as $file => $contents) recoveryFixtureFile($root . '/' . $file, $contents);
    return $root;
}
function recoveryFixture(callable $test): void
{
    $temporary = realpath(sys_get_temp_dir());
    if ($temporary === false) throw new RuntimeException('No canonical temporary directory.');
    $base = $temporary . '/lightem-recovery-test-' . bin2hex(random_bytes(6));
    mkdir($base, 0700);
    $args = ['root' => $base . '/htdocs', 'payload' => $base . '/payload',
        'backups' => $base . '/backups', 'destination' => $base . '/recovery'];
    foreach (['root', 'payload', 'backups'] as $name) mkdir($args[$name], 0700);
    recoveryFixtureFile($args['root'] . '/' . LIGHTEM_MARKER, recoveryFixtureMarker());
    recoveryFixtureCode($args['payload'] . '/backend');
    try { $test($args, $base); } finally { lightemRecoveryRemove($base); }
}
function recoveryFixtureVerify(string $root, string $payload, bool $beforeUpdate): array
{
    if (!$beforeUpdate || !is_dir($payload) || !lightemIsLegacy($root)) {
        throw new RuntimeException('The private staged backend is incomplete.');
    }
    return ['success' => true];
}
function recoveryRootSnapshot(string $root): array
{
    $files = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)) as $entry) {
        $files[substr($entry->getPathname(), strlen($root) + 1)] = hash_file('sha256', $entry->getPathname());
    }
    ksort($files);
    return $files;
}

recoveryFixture(function (array $args): void {
    $backup = recoveryFixtureBackup($args, '20260926074351-95410');
    // Real legacy backups preserve source modes beneath private root-owned
    // ancestors. They do not need a managed marker of their own.
    chmod($backup, 0775);
    chmod($backup . '/api', 0775);
    chmod($backup . '/.env', 0664);
    $snapshot = recoveryRootSnapshot($args['root']);
    $result = lightemRecover($args, 'recoveryFixtureVerify');
    recoveryCheck($result === ['success' => true, 'source' => 'backup', 'backupId' => '20260926074351-95410'], 'marker-only backend recovers a protected markerless legacy backup');
    recoveryCheck(recoveryRootSnapshot($args['root']) === $snapshot, 'recovery does not change the live backend');
    recoveryCheck((fileperms($args['destination']) & 0777) === 0700
        && (fileperms($args['destination'] . '/.env') & 0777) === 0600, 'staged recovery root and settings are private');
    recoveryCheck(file_get_contents($args['destination'] . '/' . LIGHTEM_MARKER) === recoveryFixtureMarker(), 'recovery keeps the current managed marker');
    recoveryCheck(!str_contains(json_encode($result), 'private-original'), 'recovery JSON contains no configuration secrets');
});

recoveryFixture(function (array $args): void {
    foreach (recoveryFixturePair('surviving') as $file => $contents) recoveryFixtureFile($args['root'] . '/' . $file, $contents);
    // Complete surviving settings take precedence; no backup search is needed.
    chmod($args['backups'], 0777);
    $result = lightemRecover($args, 'recoveryFixtureVerify');
    recoveryCheck($result['source'] === 'existing-settings' && $result['backupId'] === null, 'both surviving settings recover without using old backups');
    foreach (recoveryFixturePair('surviving') as $file => $contents) {
        recoveryCheck(file_get_contents($args['destination'] . '/' . $file) === $contents, 'surviving ' . $file . ' is preserved byte for byte');
    }
});

recoveryFixture(function (array $args): void {
    recoveryFixtureFile($args['root'] . '/.env', recoveryFixturePair()['.env']);
    recoveryFixtureBackup($args, '20260926074351-95410');
    recoveryFixtureBackup($args, '20260926080000-10000', recoveryFixturePair('different'));
    $result = lightemRecover($args, 'recoveryFixtureVerify');
    recoveryCheck($result['backupId'] === '20260926074351-95410', 'surviving settings reject a contradictory newer backup');
});

recoveryFixture(function (array $args): void {
    recoveryFixtureBackup($args, '20260926074351-95410');
    recoveryFixtureBackup($args, '20260926080000-10000');
    $result = lightemRecover($args, 'recoveryFixtureVerify');
    recoveryCheck($result['backupId'] === '20260926080000-10000', 'identical settings select the newest protected backup');
});

recoveryFixture(function (array $args): void {
    recoveryFixtureBackup($args, '20260926074351-95410');
    recoveryFixtureBackup($args, '20260926080000-10000', recoveryFixturePair('different'));
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'different database settings', 'different backup settings are rejected as ambiguous');
    recoveryCheck(!file_exists($args['destination']), 'ambiguous recovery makes no staging files');
});

recoveryFixture(function (array $args): void {
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'no matching protected backup', 'missing protected backups stop before writes');
});

recoveryFixture(function (array $args): void {
    $backup = recoveryFixtureBackup($args, '20260926074351-95410');
    unlink($backup . '/src/UserGateway.php');
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'no matching protected backup', 'incomplete backups cannot supply settings');
});

recoveryFixture(function (array $args): void {
    $backup = recoveryFixtureBackup($args, '20260926074351-95410');
    unlink($backup . '/.env');
    symlink($backup . '/api/config.php', $backup . '/.env');
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'symbolic link', 'backup settings symlinks are rejected');
});

recoveryFixture(function (array $args, string $base): void {
    $backup = recoveryFixtureBackup($args, '20260926074351-95410');
    rename(dirname($backup), $base . '/moved-backup');
    symlink($base . '/moved-backup', dirname($backup));
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'symbolic link', 'backup run directory symlinks are rejected');
});

recoveryFixture(function (array $args): void {
    recoveryFixtureBackup($args, '20260926074351-95410');
    chmod($args['backups'], 0755);
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'not protected', 'publicly traversable backup roots are rejected');
});

recoveryFixture(function (array $args): void {
    $backup = recoveryFixtureBackup($args, '20260926074351-95410');
    chmod(dirname($backup), 0770);
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'not protected', 'group-accessible backup runs are rejected');
});

recoveryFixture(function (array $args): void {
    recoveryFixtureBackup($args, '20260926074351-95410');
    $marker = json_decode(recoveryFixtureMarker(), true);
    $marker['installerId'] = 'another.installer';
    recoveryFixtureFile($args['root'] . '/' . LIGHTEM_MARKER, json_encode($marker));
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'different installer', 'foreign managed markers cannot authorize recovery');
});

recoveryFixture(function (array $args): void {
    recoveryFixtureBackup($args, '20260926074351-95410');
    $marker = json_decode(recoveryFixtureMarker(), true);
    unset($marker['buildId']);
    recoveryFixtureFile($args['root'] . '/' . LIGHTEM_MARKER, json_encode($marker));
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'valid managed-installation marker', 'incomplete managed marker metadata is rejected');
});

recoveryFixture(function (array $args): void {
    recoveryFixtureBackup($args, '20260926074351-95410');
    $snapshot = recoveryRootSnapshot($args['root']);
    recoveryReject(fn() => lightemRecover($args, static function (): never {
        throw new LightemSetupException('Read-only database verification failed.');
    }), 'verification failed', 'database verification failures prevent recovery approval');
    recoveryCheck(!file_exists($args['destination']) && recoveryRootSnapshot($args['root']) === $snapshot, 'verification failure removes only the private stage and preserves live files');
});

recoveryFixture(function (array $args): void {
    recoveryFixtureBackup($args, '20260926074351-95410');
    mkdir($args['destination'], 0700);
    recoveryFixtureFile($args['destination'] . '/keep', 'untouched');
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'new private staging destination', 'existing staging directories are never overwritten');
    recoveryCheck(file_get_contents($args['destination'] . '/keep') === 'untouched', 'recovery failure does not delete a pre-existing destination');
});

recoveryFixture(function (array $args): void {
    recoveryFixtureBackup($args, '20260926074351-95410');
    $args['destination'] = $args['root'] . '/recovery';
    recoveryReject(fn() => lightemRecover($args, 'recoveryFixtureVerify'), 'outside the installation', 'recovery cannot stage inside the live backend');
});

echo "Completed {$testCount} isolated recovery checks.\n";
