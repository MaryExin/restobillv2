<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once __DIR__ . "/../api/pos_report_mirror_activation.php";
require_once __DIR__ . "/../api/pos_z_reading_monthly_data.php";

function posReportActivationSplitAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException("Failed: {$message}");
    }
}

function posReportActivationSplitAssertSame(
    mixed $expected,
    mixed $actual,
    string $message
): void {
    if ($actual !== $expected) {
        throw new RuntimeException(
            "Failed: {$message}; expected " . var_export($expected, true) .
            ", got " . var_export($actual, true)
        );
    }
}

function posReportActivationSplitFunctionSource(string $functionName): string
{
    $reflection = new ReflectionFunction($functionName);
    $filename = $reflection->getFileName();
    if ($filename === false) {
        throw new RuntimeException("Failed: no source file for {$functionName}");
    }

    $lines = file($filename);
    if ($lines === false) {
        throw new RuntimeException("Failed: unable to read {$filename}");
    }

    return implode("", array_slice(
        $lines,
        $reflection->getStartLine() - 1,
        $reflection->getEndLine() - $reflection->getStartLine() + 1
    ));
}

function posReportActivationSplitRead(string $path): string
{
    $source = file_get_contents($path);
    if ($source === false) {
        throw new RuntimeException("Failed: unable to read {$path}");
    }

    return $source;
}

// The migration creates report-database state and map-membership schema. It
// must never select an active database implicitly or modify application rows.
$migration = posReportActivationSplitRead(
    __DIR__ . "/../../database/2026-08-10_create_pos_report_mirror_activation.sql"
);
foreach ([
    "USE `__REPORT_DATABASE__`;",
    "CREATE TABLE IF NOT EXISTS `__REPORT_DATABASE__`.`tbl_pos_report_mirror_activation`",
    "activation_key VARCHAR(191)",
    "source_database VARCHAR(64)",
    "report_database VARCHAR(64)",
    "activation_business_date DATE NOT NULL",
    "activated_at DATETIME NOT NULL",
    "activation_source_pos_id DECIMAL(20, 0) UNSIGNED NOT NULL",
    "activation_transaction_id VARCHAR(64)",
    "initial_skip_interval INT UNSIGNED NOT NULL",
    "last_sequence BIGINT UNSIGNED NOT NULL DEFAULT 0",
    "UNIQUE KEY ux_pos_report_mirror_activation_key (activation_key)",
    "ALTER TABLE `__REPORT_DATABASE__`.`tbl_pos_report_transaction_map`",
    "ADD COLUMN IF NOT EXISTS `activation_key`",
    "ADD COLUMN IF NOT EXISTS `activation_sequence`",
    "BIGINT UNSIGNED NULL DEFAULT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS `ux_pos_report_map_activation_sequence`",
    "(`activation_key`, `activation_sequence`)",
    "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
] as $requiredMigrationFragment) {
    posReportActivationSplitAssert(
        str_contains($migration, $requiredMigrationFragment),
        "activation migration is missing {$requiredMigrationFragment}"
    );
}
posReportActivationSplitAssert(
    preg_match(
        '/^\s*(?:INSERT(?:\s+IGNORE)?\s+INTO|UPDATE\s+|DELETE\s+FROM|REPLACE\s+INTO)\b/im',
        $migration
    ) !== 1,
    "activation migration must not mutate application data"
);
posReportActivationSplitAssert(
    preg_match('/\bUSE\s+`(?!__REPORT_DATABASE__`)/i', $migration) !== 1,
    "activation migration must not hard-code a deployed database"
);

$mapMigration = posReportActivationSplitRead(
    __DIR__ . "/../../database/2026-08-03_create_pos_report_transaction_map.sql"
);
foreach ([
    "CREATE TABLE IF NOT EXISTS `__REPORT_DATABASE__`.`tbl_pos_report_transaction_map`",
    "activation_key VARCHAR(191)",
    "activation_sequence BIGINT UNSIGNED NULL DEFAULT NULL",
    "UNIQUE KEY ux_pos_report_map_activation_sequence (activation_key, activation_sequence)",
] as $mapMigrationContract) {
    posReportActivationSplitAssert(
        str_contains($mapMigration, $mapMigrationContract),
        "fresh report-map migration is missing {$mapMigrationContract}"
    );
}

$readinessSource = posReportActivationSplitFunctionSource(
    "posReportMirrorMapActivationMembershipReady"
);
foreach ([
    "tbl_pos_report_transaction_map",
    "tbl_pos_report_mirror_activation",
    "information_schema.COLUMNS",
    "COLUMN_NAME IN ('activation_key', 'activation_sequence')",
    "information_schema.STATISTICS",
    "ux_pos_report_map_activation_sequence",
    "NON_UNIQUE = 0",
] as $readinessContract) {
    posReportActivationSplitAssert(
        str_contains($readinessSource, $readinessContract),
        "activation readiness is missing {$readinessContract}"
    );
}
$activationSchemaReadySource = posReportActivationSplitFunctionSource(
    "posReportMirrorActivationSchemaReady"
);
posReportActivationSplitAssert(
    str_contains(
        $activationSchemaReadySource,
        "posReportMirrorMapActivationMembershipReady("
    ),
    "activation claim/read must require map-membership schema readiness"
);

// The marker is immutable: concurrent first saves race through INSERT IGNORE,
// while subsequent saves update only the monotonic sequence.
$claimSource = posReportActivationSplitFunctionSource(
    "posReportMirrorActivationClaimAndNextSequence"
);
foreach ([
    'if (!$pdo->inTransaction())',
    "posReportMirrorActivationSchemaReady(",
    "INSERT IGNORE INTO",
    "`activation_source_pos_id`",
    "`activation_transaction_id`",
    "`initial_skip_interval`",
    '$businessDate->format("Y-m-d")',
    "SET `last_sequence` = `last_sequence` + 1",
] as $requiredClaimFragment) {
    posReportActivationSplitAssert(
        str_contains($claimSource, $requiredClaimFragment),
        "activation claim is missing {$requiredClaimFragment}"
    );
}
posReportActivationSplitAssert(
    !str_contains(strtoupper($claimSource), "ON DUPLICATE KEY UPDATE"),
    "activation claim must not rewrite an existing cutoff"
);
posReportActivationSplitAssert(
    preg_match('/\bSELECT\s+(?:COUNT|MAX)\s*\(/i', $claimSource) !== 1 &&
        stripos($claimSource, "OFFSET") === false &&
        stripos($claimSource, "tbl_pos_transactions") === false,
    "activation claim must remain constant-time and history-free"
);

final class PosReportActivationSplitStatementStub extends PDOStatement
{
    private PosReportActivationSplitPdoStub $owner;
    private string $kind;

    public function __construct(PosReportActivationSplitPdoStub $owner, string $kind)
    {
        $this->owner = $owner;
        $this->kind = $kind;
    }

    public function execute(?array $params = null): bool
    {
        $this->owner->executions[] = [
            "kind" => $this->kind,
            "params" => $params ?? [],
        ];
        return true;
    }

    public function fetch(
        int $mode = PDO::FETCH_DEFAULT,
        int $cursorOrientation = PDO::FETCH_ORI_NEXT,
        int $cursorOffset = 0
    ): mixed {
        if ($this->kind !== "activation_fetch") {
            return false;
        }

        return array_shift($this->owner->activationRows);
    }

    public function fetchColumn(int $column = 0): mixed
    {
        return $this->kind === "table_exists" ? 1 : false;
    }

    public function rowCount(): int
    {
        return $this->kind === "activation_insert"
            ? $this->owner->insertRowCount
            : 1;
    }
}

final class PosReportActivationSplitPdoStub extends PDO
{
    public bool $insideTransaction;
    public array $activationRows;
    public int $insertRowCount;
    public array $preparedSql = [];
    public array $executions = [];

    public function __construct(
        bool $insideTransaction,
        array $activationRows = [],
        int $insertRowCount = 1
    ) {
        $this->insideTransaction = $insideTransaction;
        $this->activationRows = $activationRows;
        $this->insertRowCount = $insertRowCount;
    }

    public function inTransaction(): bool
    {
        return $this->insideTransaction;
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $this->preparedSql[] = $query;

        if (str_contains($query, "information_schema.TABLES")) {
            return new PosReportActivationSplitStatementStub($this, "table_exists");
        }
        if (str_contains($query, "INSERT IGNORE INTO")) {
            return new PosReportActivationSplitStatementStub($this, "activation_insert");
        }
        if (
            str_contains($query, "UPDATE") &&
            str_contains($query, "`last_sequence` = `last_sequence` + 1")
        ) {
            return new PosReportActivationSplitStatementStub($this, "sequence_update");
        }
        if (
            str_contains($query, "SELECT") &&
            str_contains($query, POS_REPORT_MIRROR_ACTIVATION_TABLE)
        ) {
            return new PosReportActivationSplitStatementStub($this, "activation_fetch");
        }

        throw new RuntimeException("Unexpected SQL in activation stub: {$query}");
    }
}

$config = ["db" => "pos_test", "report_db" => "report_test"];
$outsideTransaction = new PosReportActivationSplitPdoStub(false);
$transactionRequired = false;
try {
    posReportMirrorActivationClaimAndNextSequence(
        $outsideTransaction,
        $config,
        "42",
        "1001",
        "2026-08-10",
        3
    );
} catch (RuntimeException $error) {
    $transactionRequired = str_contains($error->getMessage(), "sale transaction");
}
posReportActivationSplitAssert(
    $transactionRequired && $outsideTransaction->preparedSql === [],
    "activation must reject work outside the sale transaction before SQL"
);

$invalidDatePdo = new PosReportActivationSplitPdoStub(true);
$invalidDateRejected = false;
try {
    posReportMirrorActivationClaimAndNextSequence(
        $invalidDatePdo,
        $config,
        "42",
        "1001",
        "2026-02-30",
        3
    );
} catch (InvalidArgumentException $error) {
    $invalidDateRejected = str_contains(
        $error->getMessage(),
        "source transaction date"
    );
}
posReportActivationSplitAssert(
    $invalidDateRejected && $invalidDatePdo->preparedSql === [],
    "activation must reject an invalid source business date before SQL"
);

$markerRow = [
    "id" => "1",
    "activation_key" => posReportMirrorActivationKey("pos_test", "report_test"),
    "source_database" => "pos_test",
    "report_database" => "report_test",
    "activation_business_date" => "2026-08-10",
    "activated_at" => "2026-08-10 12:00:00",
    "activation_source_pos_id" => "42",
    "activation_transaction_id" => "1001",
    "initial_skip_interval" => "3",
    "last_sequence" => "0",
    "created_at" => "2026-08-10 12:00:00",
    "updated_at" => "2026-08-10 12:00:00",
];
$firstSavePdo = new PosReportActivationSplitPdoStub(true, [false, $markerRow]);
$firstState = posReportMirrorActivationClaimAndNextSequence(
    $firstSavePdo,
    $config,
    "42",
    "1001",
    "2026-08-10",
    3
);
posReportActivationSplitAssertSame(true, $firstState["claimed"], "first save claims marker");
posReportActivationSplitAssertSame(1, $firstState["source_sequence"], "first save gets sequence 1");
posReportActivationSplitAssertSame("1", $firstState["last_sequence"], "marker advances last_sequence");

$firstInsert = null;
foreach ($firstSavePdo->executions as $execution) {
    if ($execution["kind"] === "activation_insert") {
        $firstInsert = $execution["params"];
        break;
    }
}
posReportActivationSplitAssert(is_array($firstInsert), "first save inserts activation marker");
posReportActivationSplitAssertSame("2026-08-10", $firstInsert[3] ?? null, "marker uses source transaction date");
posReportActivationSplitAssertSame("42", $firstInsert[5] ?? null, "marker stores exact physical source ID");
posReportActivationSplitAssertSame("1001", $firstInsert[6] ?? null, "marker stores exact transaction ID");
posReportActivationSplitAssertSame(3, $firstInsert[7] ?? null, "marker freezes initial skip interval");

$existingLockedRow = $markerRow;
$existingLockedRow["last_sequence"] = "1";
$laterSavePdo = new PosReportActivationSplitPdoStub(
    true,
    [$existingLockedRow, $existingLockedRow]
);
$laterState = posReportMirrorActivationClaimAndNextSequence(
    $laterSavePdo,
    $config,
    "99",
    "2002",
    "2026-08-11",
    5
);
posReportActivationSplitAssertSame(false, $laterState["claimed"], "later save does not reclaim marker");
posReportActivationSplitAssertSame(2, $laterState["source_sequence"], "later save increments sequence");
posReportActivationSplitAssertSame("42", $laterState["activation_source_pos_id"], "cutoff source ID stays immutable");
posReportActivationSplitAssertSame("1001", $laterState["activation_transaction_id"], "cutoff transaction stays immutable");
posReportActivationSplitAssertSame(3, $laterState["initial_skip_interval"], "initial skip stays immutable");
posReportActivationSplitAssert(
    count(array_filter(
        $laterSavePdo->executions,
        static fn(array $execution): bool => $execution["kind"] === "activation_insert"
    )) === 0,
    "later saves must not insert or rewrite activation marker"
);

// Date routing is half-open, so August 10 belongs only to the report segment.
$activationDate = "2026-08-10";
$rangeCases = [
    "before activation" => ["2026-08-01", "2026-08-09", [
        ["source" => "primary", "start" => "2026-08-01", "end_exclusive" => "2026-08-10"],
    ]],
    "activation day" => ["2026-08-10", "2026-08-10", [
        ["source" => "report", "start" => "2026-08-10", "end_exclusive" => "2026-08-11"],
    ]],
    "after activation" => ["2026-08-11", "2026-08-31", [
        ["source" => "report", "start" => "2026-08-11", "end_exclusive" => "2026-09-01"],
    ]],
    "spanning activation" => ["2026-08-01", "2026-08-31", [
        ["source" => "primary", "start" => "2026-08-01", "end_exclusive" => "2026-08-10"],
        ["source" => "report", "start" => "2026-08-10", "end_exclusive" => "2026-09-01"],
    ]],
    "two-day boundary" => ["2026-08-09", "2026-08-10", [
        ["source" => "primary", "start" => "2026-08-09", "end_exclusive" => "2026-08-10"],
        ["source" => "report", "start" => "2026-08-10", "end_exclusive" => "2026-08-11"],
    ]],
];
foreach ($rangeCases as $label => [$dateFrom, $dateTo, $expectedPlan]) {
    posReportActivationSplitAssertSame(
        $expectedPlan,
        posReportMirrorActivationPlanRange($dateFrom, $dateTo, $activationDate),
        "half-open plan for {$label}"
    );
}
$spanningPlan = posReportMirrorActivationPlanRange(
    "2026-08-01",
    "2026-08-31",
    $activationDate
);
posReportActivationSplitAssertSame(
    $spanningPlan[0]["end_exclusive"],
    $spanningPlan[1]["start"],
    "split has no date gap or overlap"
);
posReportActivationSplitAssertSame(
    "report",
    $spanningPlan[1]["source"],
    "activation date is owned by report segment"
);

$reversedRangeRejected = false;
try {
    posReportMirrorActivationPlanRange("2026-08-11", "2026-08-10", $activationDate);
} catch (InvalidArgumentException) {
    $reversedRangeRejected = true;
}
posReportActivationSplitAssert($reversedRangeRejected, "reversed report range is rejected");

// Additive report values sum across sources; missing keys act as zero.
$mergedTotals = posZReadingMonthlyMergeTotals([
    ["totals" => [
        "Sales_For_The_Range" => "100.50",
        "Discount" => 5,
        "Payment_Cash" => 80,
        "Primary_Only" => 7,
    ]],
    ["totals" => [
        "Sales_For_The_Range" => 40.25,
        "Discount" => "2.50",
        "Payment_Cash" => 30,
        "Report_Only" => 9,
    ]],
]);
posReportActivationSplitAssertSame(140.75, $mergedTotals["Sales_For_The_Range"], "monthly sales sum");
posReportActivationSplitAssertSame(7.5, $mergedTotals["Discount"], "monthly discount sum");
posReportActivationSplitAssertSame(110.0, $mergedTotals["Payment_Cash"], "monthly payment sum");
posReportActivationSplitAssertSame(7.0, $mergedTotals["Primary_Only"], "primary-only total preserved");
posReportActivationSplitAssertSame(9.0, $mergedTotals["Report_Only"], "report-only total preserved");

$totalsSource = posReportActivationSplitFunctionSource("posZReadingMonthlyFetchTotals");
foreach ([
    "t.transaction_date >= ?",
    "t.transaction_date < ?",
    "a.transaction_date >= ?",
    "a.transaction_date < ?",
    "AND NOT EXISTS (",
    'FROM {$mapTable} {$mapAlias}',
    '{$mapAlias}.source_pos_id = {$transactionAlias}.ID',
    '{$mapAlias}.activation_key = ?',
    '{$mapAlias}.report_transaction_id = {$transactionAlias}.transaction_id',
    '{$mapAlias}.report_status = 0',
] as $totalsBoundary) {
    posReportActivationSplitAssert(
        str_contains($totalsSource, $totalsBoundary),
        "monthly totals are missing boundary {$totalsBoundary}"
    );
}
final class PosReportActivationMembershipStatementStub extends PDOStatement
{
    private PosReportActivationMembershipPdoStub $owner;
    private string $sql;

    public function __construct(
        PosReportActivationMembershipPdoStub $owner,
        string $sql
    ) {
        $this->owner = $owner;
        $this->sql = $sql;
    }

    public function execute(?array $params = null): bool
    {
        $this->owner->executions[] = [
            "sql" => $this->sql,
            "params" => $params ?? [],
        ];
        return true;
    }

    public function fetch(
        int $mode = PDO::FETCH_DEFAULT,
        int $cursorOrientation = PDO::FETCH_ORI_NEXT,
        int $cursorOffset = 0
    ): mixed {
        return [];
    }
}

final class PosReportActivationMembershipPdoStub extends PDO
{
    public array $preparedSql = [];
    public array $executions = [];

    public function __construct()
    {
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $this->preparedSql[] = $query;
        return new PosReportActivationMembershipStatementStub($this, $query);
    }
}

$activationKey = posReportMirrorActivationKey("pos_test", "report_test");
$membershipParams = [
    "CAT",
    "UNIT",
    "1",
    "2026-08-10",
    "2026-08-11",
    $activationKey,
];

$primaryMembershipPdo = new PosReportActivationMembershipPdoStub();
posZReadingMonthlyFetchTotals(
    $primaryMembershipPdo,
    "2026-08-10",
    "2026-08-11",
    "CAT",
    "UNIT",
    "1",
    $activationKey,
    "report_test",
    false
);
posReportActivationSplitAssertSame(
    3,
    count($primaryMembershipPdo->executions),
    "primary membership applies to transaction, discount, and payment totals"
);
foreach ($primaryMembershipPdo->executions as $execution) {
    posReportActivationSplitAssert(
        str_contains($execution["sql"], "AND NOT EXISTS (") &&
            str_contains($execution["sql"], ".source_pos_id =") &&
            str_contains($execution["sql"], ".activation_key = ?") &&
            !str_contains($execution["sql"], ".report_status = 0"),
        "primary activation-day totals must exclude every activation member"
    );
    posReportActivationSplitAssertSame(
        $membershipParams,
        $execution["params"],
        "primary membership query parameters"
    );
}

$reportMembershipPdo = new PosReportActivationMembershipPdoStub();
posZReadingMonthlyFetchTotals(
    $reportMembershipPdo,
    "2026-08-10",
    "2026-08-11",
    "CAT",
    "UNIT",
    "1",
    $activationKey,
    "report_test",
    true
);
posReportActivationSplitAssertSame(
    3,
    count($reportMembershipPdo->executions),
    "report membership applies to transaction, discount, and payment totals"
);
foreach ($reportMembershipPdo->executions as $execution) {
    posReportActivationSplitAssert(
        str_contains($execution["sql"], "INNER JOIN `report_test`.`tbl_pos_report_transaction_map`") &&
            str_contains($execution["sql"], ".activation_key = ?") &&
            str_contains($execution["sql"], ".report_status = 0") &&
            !str_contains($execution["sql"], "AND NOT EXISTS ("),
        "report totals must include only posted members of this activation"
    );
    posReportActivationSplitAssertSame(
        $membershipParams,
        $execution["params"],
        "report membership query parameters"
    );
}

$shiftSource = posReportActivationSplitFunctionSource("posZReadingMonthlyFetchShift");
foreach ([
    "Opening_DateTime >= ?",
    "Opening_DateTime < ?",
    "IFNULL(Z_Counter_No, 0) <> 0",
    'ORDER BY Opening_DateTime {$direction}, Shift_ID {$direction}',
] as $shiftContract) {
    posReportActivationSplitAssert(
        str_contains($shiftSource, $shiftContract),
        "monthly shift query is missing {$shiftContract}"
    );
}
posReportActivationSplitAssert(
    posZReadingMonthlySameShift(null, null),
    "two missing shifts compare equal"
);
$shiftIdentity = [
    "Shift_ID" => "7",
    "Opening_DateTime" => "2026-08-10 08:00:00",
];
posReportActivationSplitAssert(
    posZReadingMonthlySameShift($shiftIdentity, $shiftIdentity),
    "matching shift identity compares equal"
);
posReportActivationSplitAssert(
    !posZReadingMonthlySameShift(null, $shiftIdentity),
    "missing report shift does not match primary shift"
);
posReportActivationSplitAssert(
    !posZReadingMonthlySameShift(
        $shiftIdentity,
        [
            "Shift_ID" => "8",
            "Opening_DateTime" => "2026-08-10 08:00:00",
        ]
    ),
    "different shift ID is detected"
);
posReportActivationSplitAssert(
    !posZReadingMonthlySameShift(
        $shiftIdentity,
        [
            "Shift_ID" => "7",
            "Opening_DateTime" => "2026-08-10 09:00:00",
        ]
    ),
    "different shift opening time is detected"
);

$monthlyEndpoint = posReportActivationSplitRead(
    __DIR__ . "/../api/reprint_z_reading_monthly.php"
);
foreach ([
    '$activationKey = ($activationState["active"] ?? false) === true',
    '$activationPrefixLoaded = false',
    '"totals" => posZReadingMonthlyFetchTotals(',
    '"first_shift" => null',
    '"last_shift" => null',
    '"membership" => "before_activation"',
    '$source === "report" ? $activationKey : null',
    '$source === "report" ? $reportDbName : null',
    '$source === "report" ? true : null',
    '$expectedFirstShift = posZReadingMonthlyFetchShift(',
    '$expectedLastShift = posZReadingMonthlyFetchShift(',
    '!posZReadingMonthlySameShift($expectedFirstShift, $loaded["first_shift"])',
    '!posZReadingMonthlySameShift($expectedLastShift, $loaded["last_shift"])',
    'if ($firstShift === null && $segment["first_shift"])',
    '$firstShift = $segment["first_shift"]',
    '$lastShift = $segment["last_shift"]',
    '$presentAccumulatedSales = (float)($lastShift["Grand_Accum_Sales"] ?: 0)',
    '$cashInDrawer = (float)($lastShift["Closing_Cash_Count"] ?: 0)',
    '$openingFund = (float)($firstShift["Opening_Cash_Count"] ?: 0)',
    '$firstZCounter = (int)($firstShift["Z_Counter_No"] ?: 0)',
    '$lastZCounter = (int)($lastShift["Z_Counter_No"] ?: 0)',
    '"begSI" => (float)($firstShift["Beg_OR"] ?: 0)',
    '"endSI" => (float)($lastShift["End_OR"] ?: 0)',
    '"begVoid" => (float)($firstShift["Beg_VoidNo"] ?: 0)',
    '"endVoid" => (float)($lastShift["End_VoidNo"] ?: 0)',
    '"begRefund" => (float)($firstShift["Beg_RefundNo"] ?: 0)',
    '"endRefund" => (float)($lastShift["End_RefundNo"] ?: 0)',
] as $monthlyContract) {
    posReportActivationSplitAssert(
        str_contains($monthlyEndpoint, $monthlyContract),
        "monthly endpoint is missing split/shift contract {$monthlyContract}"
    );
}
posReportActivationSplitAssert(
    preg_match(
        '/posZReadingMonthlyFetchTotals\s*\(\s*\$primaryPdo\s*,.*?\$activationKey\s*,\s*\$reportDbName\s*,\s*false\s*\)/s',
        $monthlyEndpoint
    ) === 1,
    "monthly activation day must add only non-member primary totals"
);

$dailyEndpoint = posReportActivationSplitRead(
    __DIR__ . "/../api/reprint_z_reading.php"
);
foreach ([
    '$activationKey = ($activationState["active"] ?? false) === true',
    '$dataSource = $selectedDate === $activationDate',
    '? "primary_and_report"',
    '$dailySegments = [[',
    '"totals" => posZReadingMonthlyFetchTotals(',
    '$activationKey,',
    '$reportDbName,',
    'true',
    'if ($selectedDate === $activationDate)',
    '$primaryPdo,',
    'false',
    '$sales = posZReadingMonthlyMergeTotals($dailySegments)',
    '$expectedShift = posZReadingMonthlyFetchShift(',
    'if (!posZReadingMonthlySameShift($expectedShift, $shift))',
    'http_response_code(409)',
] as $dailyContract) {
    posReportActivationSplitAssert(
        str_contains($dailyEndpoint, $dailyContract),
        "daily endpoint is missing activation split/shift contract {$dailyContract}"
    );
}
posReportActivationSplitAssert(
    preg_match(
        '/\$dailySegments\s*=\s*\[\[.*?\$activationKey\s*,\s*\$reportDbName\s*,\s*true\s*\).*?if\s*\(\$selectedDate\s*===\s*\$activationDate\).*?posZReadingMonthlyFetchTotals\s*\(\s*\$primaryPdo\s*,.*?\$activationKey\s*,\s*\$reportDbName\s*,\s*false\s*\)/s',
        $dailyEndpoint
    ) === 1,
    "daily activation date must merge report members with primary non-members"
);

$saveOrder = posReportActivationSplitRead(__DIR__ . "/../api/save_order.php");
$beginPosition = strpos($saveOrder, '$pdo->beginTransaction()');
$claimPosition = strpos($saveOrder, "posReportMirrorActivationClaimAndNextSequence(");
$mirrorPosition = strpos($saveOrder, "mirrorPosTransactionToReport(", (int)$claimPosition);
$commitPosition = strpos($saveOrder, '$pdo->commit()', (int)$claimPosition);
posReportActivationSplitAssert(
    $beginPosition !== false &&
        $claimPosition !== false &&
        $mirrorPosition !== false &&
        $commitPosition !== false &&
        $beginPosition < $claimPosition &&
        $claimPosition < $mirrorPosition &&
        $mirrorPosition < $commitPosition,
    "activation claim, mirror, and sequence must share the sale transaction"
);
foreach ([
    '$sourcePosId = trim((string)$pdo->lastInsertId())',
    "posReportMirrorActivationClaimAndNextSequence(",
    '$sourcePosId,',
    '$transaction_date,',
    '$sourceSequence > 0 ? $sourceSequence : max(1, (int)$sourcePosId)',
    '$activationKey !== "" ? $activationKey : null',
    '$sourceSequence > 0 ? $sourceSequence : null',
] as $saveContract) {
    posReportActivationSplitAssert(
        str_contains($saveOrder, $saveContract),
        "save_order is missing activation/source-rank contract {$saveContract}"
    );
}
posReportActivationSplitAssert(
    preg_match(
        '/mirrorPosTransactionToReport\s*\(.*?\btrue\s*,\s*\$reportSkipInterval\s*,\s*\$sourceSequence\s*>\s*0\s*\?\s*\$sourceSequence\s*:.*?,\s*\$activationKey\s*!==\s*""\s*\?\s*\$activationKey\s*:\s*null\s*,\s*\$sourceSequence\s*>\s*0\s*\?\s*\$sourceSequence\s*:\s*null\s*\)/s',
        $saveOrder
    ) === 1,
    "save_order must pass activation key/sequence with the source-rank override"
);
foreach ([
    "mirrorRecentPosTransactionsToReport(",
    "posReportMirrorGetSourceTransactionRank(",
    "Run" . "Batch(",
    "history" . " repair",
] as $forbiddenSaveCall) {
    posReportActivationSplitAssert(
        stripos($saveOrder, $forbiddenSaveCall) === false,
        "save_order must not run history work: {$forbiddenSaveCall}"
    );
}

$newTransactions = posReportActivationSplitRead(
    __DIR__ . "/../api/new_transactions.php"
);
foreach ([
    "posReportMirrorActivation",
    "mirrorRecentPosTransactionsToReport(",
    "mirrorPosTransactionToReport(",
    "Run" . "Batch(",
] as $forbiddenHotPathCall) {
    posReportActivationSplitAssert(
        stripos($newTransactions, $forbiddenHotPathCall) === false,
        "new_transactions must not run activation/history work: {$forbiddenHotPathCall}"
    );
}

// Old worker/job identifiers must not survive in runtime, frontend, env, or
// database migrations. Build the tokens in pieces so this contract test does
// not itself become a stale reference.
$obsoleteTokens = [
    "initial_month_" . "backfill",
    "run_initial_month_" . "backfill",
    "tbl_pos_report_" . "backfill_jobs",
    "pos_report_initial_month_" . "backfill",
];
$scanRoots = [
    __DIR__ . "/../api",
    __DIR__ . "/../../src",
    __DIR__ . "/../../database",
];
$scanFiles = [__DIR__ . "/../../.env"];
foreach ($scanRoots as $scanRoot) {
    if (!is_dir($scanRoot)) {
        continue;
    }
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($scanRoot, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $entry) {
        if ($entry->isFile()) {
            $scanFiles[] = $entry->getPathname();
        }
    }
}
foreach ($scanFiles as $scanFile) {
    $scannedSource = posReportActivationSplitRead($scanFile);
    foreach ($obsoleteTokens as $obsoleteToken) {
        posReportActivationSplitAssert(
            stripos($scannedSource, $obsoleteToken) === false,
            "obsolete initial mirror worker reference remains in {$scanFile}"
        );
    }
}

echo "POS report activation split tests passed.\n";
