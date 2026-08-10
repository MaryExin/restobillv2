<?php

declare(strict_types=1);

require_once __DIR__ . "/../api/pos_report_mirror.php";

function posReportHeaderUpsertAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException("Failed: {$message}");
    }
}

function posReportHeaderUpsertAssertSame(
    mixed $expected,
    mixed $actual,
    string $message
): void {
    if ($expected !== $actual) {
        throw new RuntimeException(
            "Failed: {$message}; expected " .
            var_export($expected, true) .
            ", got " .
            var_export($actual, true)
        );
    }
}

function posReportHeaderUpsertFunctionSource(string $functionName): string
{
    $reflection = new ReflectionFunction($functionName);
    $fileName = $reflection->getFileName();
    if ($fileName === false) {
        throw new RuntimeException("Unable to locate {$functionName}");
    }

    $lines = file($fileName);
    if ($lines === false) {
        throw new RuntimeException("Unable to read {$fileName}");
    }

    return implode("", array_slice(
        $lines,
        $reflection->getStartLine() - 1,
        $reflection->getEndLine() - $reflection->getStartLine() + 1
    ));
}

final class PosReportHeaderWriteStatementStub extends PDOStatement
{
    public function __construct(
        private PosReportHeaderWritePdoStub $owner,
        private string $sql,
        private mixed $fetchValue = false
    ) {
    }

    public function execute(?array $params = null): bool
    {
        $this->owner->executions[] = [
            "sql" => $this->sql,
            "params" => $params ?? [],
        ];
        return true;
    }

    public function fetchColumn(int $column = 0): mixed
    {
        return $this->fetchValue;
    }

    public function rowCount(): int
    {
        // An unchanged existing row can legitimately report zero affected rows.
        return 0;
    }
}

final class PosReportHeaderWritePdoStub extends PDO
{
    public array $preparedSql = [];
    public array $executions = [];

    public function __construct(private bool $targetExists)
    {
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $this->preparedSql[] = $query;
        $isExistenceRead = preg_match('/^\s*SELECT\s+1\b/i', $query) === 1;

        return new PosReportHeaderWriteStatementStub(
            $this,
            $query,
            $isExistenceRead && $this->targetExists ? 1 : false
        );
    }
}

$columns = [
    "transaction_id",
    "Category_Code",
    "Unit_Code",
    "order_slip_no",
    "invoice_no",
];
$overrides = [
    "transaction_id" => "8001",
    "order_slip_no" => "9001",
    "invoice_no" => "10001",
];
[$sourceWhere, $sourceParams] = posReportMirrorScopedWhere("7001", "CAT", "UNIT");
[$targetWhere, $targetParams] = posReportMirrorScopedWhere(
    "8001",
    "CAT",
    "UNIT",
    "transaction_id",
    "Category_Code",
    "Unit_Code",
    "mirror_target"
);

$existingPdo = new PosReportHeaderWritePdoStub(true);
posReportMirrorUpdateThenInsertRows(
    $existingPdo,
    "`source_db`.`tbl_pos_transactions`",
    "`report_db`.`tbl_pos_transactions`",
    $columns,
    $sourceWhere,
    $sourceParams,
    $targetWhere,
    $targetParams,
    $overrides
);

posReportHeaderUpsertAssertSame(
    2,
    count($existingPdo->executions),
    "existing header must execute only update and existence read"
);
posReportHeaderUpsertAssert(
    str_contains($existingPdo->executions[0]["sql"], "UPDATE") &&
        str_contains($existingPdo->executions[0]["sql"], "INNER JOIN") &&
        str_contains($existingPdo->executions[0]["sql"], "SET"),
    "existing header must be updated from the source row"
);
posReportHeaderUpsertAssert(
    str_contains($existingPdo->executions[1]["sql"], "SELECT 1") &&
        str_contains($existingPdo->executions[1]["sql"], "LIMIT 1"),
    "zero-row update must use an existence read"
);
foreach ($existingPdo->preparedSql as $sql) {
    posReportHeaderUpsertAssert(
        !str_contains($sql, "INSERT INTO") &&
            !str_contains(strtoupper($sql), "ON DUPLICATE KEY UPDATE"),
        "existing header must not execute an insert/upsert"
    );
}
posReportHeaderUpsertAssertSame(
    ["8001", "9001", "10001", "7001", "CAT", "UNIT", "8001", "CAT", "UNIT"],
    $existingPdo->executions[0]["params"],
    "update parameters must preserve mapped and source scopes"
);
posReportHeaderUpsertAssertSame(
    ["8001", "CAT", "UNIT"],
    $existingPdo->executions[1]["params"],
    "existence parameters must use the mapped report scope"
);

$missingPdo = new PosReportHeaderWritePdoStub(false);
posReportMirrorUpdateThenInsertRows(
    $missingPdo,
    "`source_db`.`tbl_pos_transactions`",
    "`report_db`.`tbl_pos_transactions`",
    $columns,
    $sourceWhere,
    $sourceParams,
    $targetWhere,
    $targetParams,
    $overrides
);

posReportHeaderUpsertAssertSame(
    3,
    count($missingPdo->executions),
    "missing header must execute update, existence read, and insert"
);
posReportHeaderUpsertAssert(
    str_contains($missingPdo->executions[2]["sql"], "INSERT INTO") &&
        str_contains($missingPdo->executions[2]["sql"], "SELECT") &&
        str_contains($missingPdo->executions[2]["sql"], "source_db") &&
        !str_contains(strtoupper($missingPdo->executions[2]["sql"]), "ON DUPLICATE KEY UPDATE"),
    "missing header must use a plain insert-select"
);
posReportHeaderUpsertAssertSame(
    ["8001", "9001", "10001", "7001", "CAT", "UNIT"],
    $missingPdo->executions[2]["params"],
    "insert parameters must preserve mapped values and source scope"
);

$writerSource = posReportHeaderUpsertFunctionSource(
    "posReportMirrorUpdateThenInsertRows"
);
foreach (["UPDATE", "SELECT 1", "fetchColumn() !== false", "INSERT INTO"] as $writerContract) {
    posReportHeaderUpsertAssert(
        str_contains($writerSource, $writerContract),
        "report header writer is missing {$writerContract}"
    );
}
posReportHeaderUpsertAssert(
    !str_contains(strtoupper($writerSource), "ON DUPLICATE KEY UPDATE"),
    "report header writer must not consume IDs through duplicate-key upserts"
);

$readinessSource = posReportHeaderUpsertFunctionSource(
    "posReportMirrorMapActivationMembershipReady"
);
foreach ([
    "ux_pos_transactions_report_txn_scope",
    "transaction_id",
    "Category_Code",
    "Unit_Code",
    "NON_UNIQUE = 0",
] as $readinessContract) {
    posReportHeaderUpsertAssert(
        str_contains($readinessSource, $readinessContract),
        "report mirror readiness is missing {$readinessContract}"
    );
}

$migrationPath = __DIR__ .
    "/../../database/2026-08-10_repair_pos_report_transaction_header_upsert.sql";
$migration = file_get_contents($migrationPath);
if ($migration === false) {
    throw new RuntimeException("Unable to read {$migrationPath}");
}

foreach ([
    "USE `__REPORT_DATABASE__`",
    "DELETE older",
    "newer.`ID` > older.`ID`",
    "CREATE UNIQUE INDEX IF NOT EXISTS `ux_pos_transactions_report_txn_scope`",
    "(`transaction_id`, `Category_Code`, `Unit_Code`)",
] as $migrationContract) {
    posReportHeaderUpsertAssert(
        str_contains($migration, $migrationContract),
        "repair migration is missing {$migrationContract}"
    );
}

$deletePosition = strpos($migration, "DELETE older");
$indexPosition = strpos(
    $migration,
    "CREATE UNIQUE INDEX IF NOT EXISTS `ux_pos_transactions_report_txn_scope`"
);
posReportHeaderUpsertAssert(
    $deletePosition !== false &&
        $indexPosition !== false &&
        $deletePosition < $indexPosition,
    "duplicate cleanup must run before the unique index is created"
);
posReportHeaderUpsertAssert(
    preg_match('/\bUSE\s+`(?!__REPORT_DATABASE__`)/i', $migration) !== 1,
    "repair migration must not hard-code a deployed report database"
);

echo "POS report transaction header upsert tests passed.\n";
