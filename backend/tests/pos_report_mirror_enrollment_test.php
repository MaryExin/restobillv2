<?php

declare(strict_types=1);

require_once __DIR__ . "/../api/pos_report_mirror.php";

$cases = [
    "legacy unmapped mutation is ignored" => [[], false, false],
    "new transaction may enroll" => [[], true, true],
    "mapped transaction mutation remains eligible" => [["id" => "1"], false, true],
    "mapped transaction creation remains eligible" => [["id" => "1"], true, true],
];

foreach ($cases as $label => [$mapRow, $allowNewEnrollment, $expected]) {
    $actual = posReportMirrorCanProcessSource($mapRow, $allowNewEnrollment);

    if ($actual !== $expected) {
        throw new RuntimeException("Failed: {$label}");
    }
}

$mirrorFunction = new ReflectionFunction("mirrorPosTransactionToReport");
$enrollmentParameter = null;
$skipOverrideParameter = null;

foreach ($mirrorFunction->getParameters() as $parameter) {
    if ($parameter->getName() === "allowNewEnrollment") {
        $enrollmentParameter = $parameter;
    }
    if ($parameter->getName() === "skipIntervalOverride") {
        $skipOverrideParameter = $parameter;
    }
}

if (!$enrollmentParameter instanceof ReflectionParameter) {
    throw new RuntimeException("Failed: mirror enrollment parameter is missing");
}

if (
    !$enrollmentParameter->isDefaultValueAvailable()
    || $enrollmentParameter->getDefaultValue() !== false
) {
    throw new RuntimeException("Failed: mirror enrollment must default to false");
}
if (
    !$skipOverrideParameter instanceof ReflectionParameter
    || !$skipOverrideParameter->isDefaultValueAvailable()
    || $skipOverrideParameter->getDefaultValue() !== null
) {
    throw new RuntimeException(
        "Failed: frozen skip override must remain optional for normal callers"
    );
}

final class PosReportMirrorEnrollmentStatementStub extends PDOStatement
{
    private mixed $row;

    public function __construct(mixed $row)
    {
        $this->row = $row;
    }

    public function execute(?array $params = null): bool
    {
        return true;
    }

    public function fetch(
        int $mode = PDO::FETCH_DEFAULT,
        int $cursorOrientation = PDO::FETCH_ORI_NEXT,
        int $cursorOffset = 0
    ): mixed {
        return $this->row;
    }

    public function fetchColumn(int $column = 0): mixed
    {
        return $this->row;
    }
}

final class PosReportMirrorEnrollmentPdoStub extends PDO
{
    public array $preparedSql = [];

    public function __construct()
    {
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $this->preparedSql[] = $query;

        if (
            str_contains($query, "information_schema.TABLES") &&
            str_contains($query, "activation_sequence")
        ) {
            return new PosReportMirrorEnrollmentStatementStub(1);
        }

        if (str_contains($query, "`pos_test`.`tbl_pos_transactions`")) {
            return new PosReportMirrorEnrollmentStatementStub([
                "ID" => "1",
                "transaction_id" => "1001",
                "order_slip_no" => "2001",
                "invoice_no" => "0",
                "Category_Code" => "CAT",
                "Unit_Code" => "UNIT",
            ]);
        }

        if (str_contains($query, "`report_test`.`tbl_pos_report_transaction_map`")) {
            return new PosReportMirrorEnrollmentStatementStub(false);
        }

        throw new RuntimeException("Unexpected prepared SQL after the enrollment gate.");
    }

    public function query(
        string $query,
        ?int $fetchMode = null,
        mixed ...$fetchModeArgs
    ): PDOStatement|false {
        throw new RuntimeException("Unexpected query SQL after the enrollment gate.");
    }

    public function exec(string $statement): int|false
    {
        throw new RuntimeException("Unexpected exec SQL after the enrollment gate.");
    }
}

$pdoStub = new PosReportMirrorEnrollmentPdoStub();

mirrorPosTransactionToReport(
    $pdoStub,
    ["db" => "pos_test", "report_db" => "report_test"],
    "1001",
    "CAT",
    "UNIT"
);

if (count($pdoStub->preparedSql) !== 3) {
    throw new RuntimeException(
        "Failed: an unmapped default call must stop after readiness, source, and map reads"
    );
}

/**
 * Splits a PHP call's source arguments without treating commas inside casts,
 * nested calls, arrays, or quoted strings as argument separators.
 */
function posReportMirrorTestSplitArguments(string $arguments): array
{
    $parts = [];
    $start = 0;
    $depth = 0;
    $quote = null;
    $escaped = false;
    $length = strlen($arguments);

    for ($index = 0; $index < $length; $index++) {
        $character = $arguments[$index];

        if ($quote !== null) {
            if ($escaped) {
                $escaped = false;
                continue;
            }
            if ($character === "\\") {
                $escaped = true;
                continue;
            }
            if ($character === $quote) {
                $quote = null;
            }
            continue;
        }

        if ($character === "'" || $character === '"') {
            $quote = $character;
            continue;
        }
        if ($character === "(" || $character === "[" || $character === "{") {
            $depth++;
            continue;
        }
        if ($character === ")" || $character === "]" || $character === "}") {
            $depth--;
            continue;
        }
        if ($character === "," && $depth === 0) {
            $parts[] = trim(substr($arguments, $start, $index - $start));
            $start = $index + 1;
        }
    }

    $parts[] = trim(substr($arguments, $start));
    return $parts;
}

$enrollingCallers = [];
$apiFiles = glob(__DIR__ . "/../api/*.php") ?: [];

foreach ($apiFiles as $apiFile) {
    if (basename($apiFile) === "pos_report_mirror.php") {
        continue;
    }

    $source = file_get_contents($apiFile);
    if ($source === false) {
        throw new RuntimeException("Unable to inspect " . basename($apiFile));
    }

    preg_match_all(
        '/mirrorPosTransactionToReport\s*\((.*?)\);/s',
        $source,
        $matches
    );

    foreach ($matches[1] ?? [] as $arguments) {
        $callArguments = posReportMirrorTestSplitArguments($arguments);

        // allowNewEnrollment is the sixth positional argument. Later skip and
        // source-rank overrides must not hide an unauthorized enrollment.
        if (strtolower(trim((string)($callArguments[5] ?? ""))) === "true") {
            $enrollingCallers[] = basename($apiFile);
        }
    }
}

sort($enrollingCallers);
if ($enrollingCallers !== ["save_order.php"]) {
    throw new RuntimeException(
        "Failed: only save_order.php may enroll report rows"
    );
}

echo "POS report mirror enrollment tests passed.\n";
