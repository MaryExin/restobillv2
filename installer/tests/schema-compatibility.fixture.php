<?php
declare(strict_types=1);

// No database connections: the fake PDO accepts only the verifier's metadata
// SELECT. Any additional SQL, including attempted DDL/DML, fails the fixture.
require_once __DIR__ . '/../common/verify.php';

final class SchemaMetadataStatement extends PDOStatement {
    public function __construct(private array $rows, private string $database) {}
    public function execute(?array $params = null): bool {
        if ($params !== [$this->database]) throw new RuntimeException('Incorrect schema lookup parameters.');
        return true;
    }
    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array { return $this->rows; }
}
final class SchemaMetadataConnection extends PDO {
    public array $queries = [];
    public function __construct(private array $rows, private string $database) {}
    public function prepare(string $query, array $options = []): PDOStatement|false {
        if ($query !== 'SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?') {
            throw new RuntimeException('Unexpected SQL; compatibility verification must only read metadata.');
        }
        $this->queries[] = $query;
        return new SchemaMetadataStatement($this->rows, $this->database);
    }
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false {
        throw new RuntimeException('Unexpected query.');
    }
    public function exec(string $statement): int|false { throw new RuntimeException('Unexpected database write.'); }
}
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$rows = [];
foreach ($input['present'] as $table => $columns) {
    foreach ($columns as $column) $rows[] = ['TABLE_NAME' => $table, 'COLUMN_NAME' => $column];
}
$connection = new SchemaMetadataConnection($rows, $input['database']);
try {
    $args = [$connection, $input['database'], $input['required'], $input['kind']];
    if (array_key_exists('allow', $input)) $args[] = $input['allow'];
    $unavailable = lightemVerifySchema(...$args);
    echo json_encode(['success' => true, 'unavailable' => $unavailable, 'reads' => count($connection->queries)], JSON_THROW_ON_ERROR);
} catch (LightemSetupException $error) {
    echo json_encode(['success' => false, 'message' => $error->getMessage(), 'reads' => count($connection->queries)], JSON_THROW_ON_ERROR);
}
