<?php
declare(strict_types=1);

require_once __DIR__ . '/../common/migrate.php';

/** A disconnected PDO fixture: every permitted operation is read-only. */
final class RoutineMetadataDatabase extends PDO
{
    public array $reads = [];

    public function __construct(
        public string $brokenKind = 'routines',
        public int $metadataError = 1558,
        public mixed $legacyCount = '0',
        public bool $denyLegacyRead = false,
        public string $eventScheduler = 'DISABLED',
        public array $additionalErrors = [],
    ) {}

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        if (!str_starts_with($query, 'SELECT ')) {
            throw new RuntimeException('The metadata fallback must never write to the source.');
        }
        return new RoutineMetadataStatement($this, $query);
    }

    public function exec(string $statement): int|false
    {
        throw new RuntimeException('The metadata fallback must never write to the source.');
    }

    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        $statement = $this->prepare($query);
        $statement->execute();
        return $statement;
    }
}

final class RoutineMetadataStatement extends PDOStatement
{
    public function __construct(private RoutineMetadataDatabase $database, private string $sql) {}

    public function execute(?array $params = null): bool
    {
        $this->database->reads[] = ['sql' => $this->sql, 'params' => $params];
        foreach ([$this->database->brokenKind => $this->database->metadataError] + $this->database->additionalErrors as $kind => $code) {
            if (str_contains($this->sql, 'information_schema.' . strtoupper($kind))) {
                $error = new PDOException('Synthetic incompatible metadata.');
                $error->errorInfo = ['HY000', $code, 'Synthetic metadata failure.'];
                throw $error;
            }
        }
        if ((str_contains($this->sql, 'mysql.proc') || str_contains($this->sql, 'mysql.event')) && $this->database->denyLegacyRead) {
            $error = new PDOException('Synthetic denied SELECT.');
            $error->errorInfo = ['42000', 1142, 'Synthetic denied SELECT.'];
            throw $error;
        }
        return true;
    }

    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array { return []; }
    public function fetchColumn(int $column = 0): mixed
    {
        return str_contains($this->sql, '@@event_scheduler') ? $this->database->eventScheduler : $this->database->legacyCount;
    }
}

$checks = 0;
function legacyCheck(bool $condition, string $label): void
{
    global $checks;
    if (!$condition) throw new RuntimeException('FAIL ' . $label);
    $checks++;
    echo 'PASS ' . $label . PHP_EOL;
}

function legacyRejected(RoutineMetadataDatabase $database, string $label): void
{
    $legacy = false;
    try {
        lightemMigrationInventory($database, 'festivalmall', [], $legacy);
        throw new RuntimeException('FAIL ' . $label);
    } catch (LightemSetupException $error) {
        legacyCheck(!$legacy && str_contains($error->getMessage(), 'Cannot prove'), $label);
    }
}

foreach (['0', 0] as $count) {
    $database = new RoutineMetadataDatabase(legacyCount: $count);
    $legacy = false;
    $inventory = lightemMigrationInventory($database, 'festivalmall', [], $legacy);
    $fallback = array_values(array_filter($database->reads, static fn(array $read): bool => str_contains($read['sql'], 'mysql.proc')));
    legacyCheck($legacy && $inventory['objects']['routines'] === [] && count($fallback) === 1
        && $fallback[0] === ['sql' => 'SELECT COUNT(*) FROM mysql.proc WHERE db = ?', 'params' => ['festivalmall']],
        'error 1558 accepts only a bound, read-only proof of zero routines (' . gettype($count) . ')');
}

legacyRejected(new RoutineMetadataDatabase(legacyCount: '1'), 'an existing legacy routine blocks migration');
legacyRejected(new RoutineMetadataDatabase(denyLegacyRead: true), 'denied SELECT on mysql.proc blocks migration');
legacyRejected(new RoutineMetadataDatabase(legacyCount: false), 'a missing count row cannot prove zero routines');
legacyRejected(new RoutineMetadataDatabase(legacyCount: null), 'a null count cannot prove zero routines');
legacyRejected(new RoutineMetadataDatabase(legacyCount: ''), 'an empty count cannot prove zero routines');

$database = new RoutineMetadataDatabase(brokenKind: 'events');
$legacy = false;
try {
    lightemMigrationInventory($database, 'festivalmall', [], $legacy);
    throw new RuntimeException('FAIL non-routine metadata 1558 must fail');
} catch (LightemSetupException $error) {
    legacyCheck(!$legacy && !array_filter($database->reads, static fn(array $read): bool => str_contains($read['sql'], 'mysql.proc')),
        'error 1558 on event metadata does not use the routine-only fallback');
}

$database = new RoutineMetadataDatabase(metadataError: 1142);
$legacy = false;
try {
    lightemMigrationInventory($database, 'festivalmall', [], $legacy);
    throw new RuntimeException('FAIL unrelated metadata failure must fail');
} catch (PDOException $error) {
    legacyCheck(!$legacy && ($error->errorInfo[1] ?? null) === 1142
        && !array_filter($database->reads, static fn(array $read): bool => str_contains($read['sql'], 'mysql.proc')),
        'metadata permission errors remain failures without a fallback');
}

foreach (['0', 0] as $count) {
    $database = new RoutineMetadataDatabase(brokenKind: 'events', metadataError: 1577, legacyCount: $count);
    $routines = false;
    $events = false;
    $inventory = lightemMigrationInventory($database, 'festivalmall_report', [], $routines, $events);
    $fallback = array_values(array_filter($database->reads, static fn(array $read): bool => str_contains($read['sql'], 'mysql.event')));
    legacyCheck(!$routines && $events && $inventory['objects']['events'] === [] && count($fallback) === 1
        && $fallback[0] === ['sql' => 'SELECT COUNT(*) FROM mysql.event WHERE db = ?', 'params' => ['festivalmall_report']],
        'error 1577 accepts only a bound, read-only proof of zero events (' . gettype($count) . ')');
}

foreach ([['1', false, 'existing event'], ['0', true, 'denied SELECT'], [false, false, 'missing result'], [null, false, 'null result'], ['', false, 'empty result']] as [$count, $denied, $label]) {
    $database = new RoutineMetadataDatabase(brokenKind: 'events', metadataError: 1577, legacyCount: $count, denyLegacyRead: $denied);
    $routines = false;
    $events = false;
    try {
        lightemMigrationInventory($database, 'festivalmall_report', [], $routines, $events);
        throw new RuntimeException('FAIL ' . $label . ' cannot prove zero events');
    } catch (LightemSetupException $error) {
        legacyCheck(!$routines && !$events && str_contains($error->getMessage(), 'Cannot prove'),
            $label . ' cannot prove zero events');
    }
}

$database = new RoutineMetadataDatabase(metadataError: 1577);
$routines = false;
$events = false;
try {
    lightemMigrationInventory($database, 'festivalmall', [], $routines, $events);
    throw new RuntimeException('FAIL error 1577 outside events must fail');
} catch (PDOException $error) {
    legacyCheck(!$routines && !$events && ($error->errorInfo[1] ?? null) === 1577
        && !array_filter($database->reads, static fn(array $read): bool => str_contains($read['sql'], 'mysql.')),
        'error 1577 outside event metadata does not activate a fallback');
}

$database = new RoutineMetadataDatabase(additionalErrors: ['events' => 1577]);
$routines = false;
$events = false;
$inventory = lightemMigrationInventory($database, 'festivalmall', [], $routines, $events);
legacyCheck($routines && $events && $inventory['objects']['routines'] === [] && $inventory['objects']['events'] === []
    && count(array_filter($database->reads, static fn(array $read): bool => str_contains($read['sql'], 'mysql.'))) === 2,
    'routine 1558 and event 1577 require independent zero-object proofs');

echo "Completed {$checks} isolated legacy metadata checks.\n";
