<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

require_once __DIR__ . "/../api/report_db.php";

$fallbackCases = [
    "Super Admin falls back when archive is empty" => [true, true, false, true],
    "archive data wins when it exists" => [true, true, true, false],
    "non-Super Admin bypasses the fallback policy" => [false, true, false, false],
    "current-date source never needs fallback" => [true, false, false, false],
];

foreach (
    $fallbackCases as
    $label => [$isSuperAdmin, $archiveRequested, $archiveHasData, $expected]
) {
    $actual = reportDbShouldFallbackToPrimary(
        $isSuperAdmin,
        $archiveRequested,
        $archiveHasData
    );
    if ($actual !== $expected) {
        throw new RuntimeException("Failed: {$label}");
    }
}

final class ZReadingFallbackStatementStub extends PDOStatement
{
    public array $params = [];
    private mixed $value;

    public function __construct(mixed $value)
    {
        $this->value = $value;
    }

    public function execute(?array $params = null): bool
    {
        $this->params = $params ?? [];
        return true;
    }

    public function fetchColumn(int $column = 0): mixed
    {
        return $this->value;
    }
}

final class ZReadingFallbackPdoStub extends PDO
{
    public string $preparedSql = "";
    public ?ZReadingFallbackStatementStub $statement = null;
    private mixed $value;

    public function __construct(mixed $value)
    {
        $this->value = $value;
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $this->preparedSql = $query;
        $this->statement = new ZReadingFallbackStatementStub($this->value);
        return $this->statement;
    }
}

$archiveWithShift = new ZReadingFallbackPdoStub("1");
$hasShift = reportDbHasClosedZReading(
    $archiveWithShift,
    "2026-07-01",
    "2026-07-31",
    "CAT",
    "UNIT",
    "1"
);

if (!$hasShift) {
    throw new RuntimeException("Failed: matching archived Z-reading was not found");
}

$expectedParams = ["CAT", "UNIT", "1", "2026-07-01", "2026-07-31"];
if ($archiveWithShift->statement?->params !== $expectedParams) {
    throw new RuntimeException("Failed: archive probe scope or date range changed");
}

if (
    !str_contains($archiveWithShift->preparedSql, "tbl_pos_shifting_records") ||
    !str_contains($archiveWithShift->preparedSql, "IFNULL(Z_Counter_No, 0) <> 0")
) {
    throw new RuntimeException("Failed: archive probe must use a closed Z shift");
}
if (str_contains($archiveWithShift->preparedSql, "tbl_pos_transactions")) {
    throw new RuntimeException("Failed: zero-sales Z-readings must remain valid");
}

$archiveWithoutShift = new ZReadingFallbackPdoStub(false);
if (
    reportDbHasClosedZReading(
        $archiveWithoutShift,
        "2026-07-15",
        null,
        "CAT",
        "UNIT",
        "2"
    )
) {
    throw new RuntimeException("Failed: empty archive must not report a Z-reading");
}

if (
    $archiveWithoutShift->statement?->params !==
    ["CAT", "UNIT", "2", "2026-07-15", "2026-07-15"]
) {
    throw new RuntimeException("Failed: single-day probe must reuse its date");
}

$primaryPdo = new ZReadingFallbackPdoStub(false);
$currentDatePdo = getZReadingReportPdo(
    $primaryPdo,
    date("Y-m-d"),
    date("Y-m-d"),
    "CAT",
    "UNIT",
    "1",
    true
);
if (
    $currentDatePdo !== $primaryPdo
    || str_contains($primaryPdo->preparedSql, "tbl_pos_shifting_records")
    || preg_match(
        '/FROM\s+(?:`[^`]+`\.)?`?tbl_pos_transactions`?\b/i',
        $primaryPdo->preparedSql
    ) === 1
) {
    throw new RuntimeException(
        "Failed: current-date Z-reading must not scan report data before activation"
    );
}

foreach ([
    "before activation" => ["2026-08-09", "2026-08-09"],
    "on activation" => ["2026-08-10", "2026-08-10"],
    "after activation" => ["2026-08-11", "2026-08-11"],
    "crossing activation" => ["2026-08-09", "2026-08-11"],
] as $label => [$dateFrom, $dateTo]) {
    $nonSuperAdminPrimary = new ZReadingFallbackPdoStub(false);
    $selected = getZReadingReportPdo(
        $nonSuperAdminPrimary,
        $dateFrom,
        $dateTo,
        "CAT",
        "UNIT",
        "1",
        false
    );
    if (
        $selected !== $nonSuperAdminPrimary
        || $nonSuperAdminPrimary->preparedSql !== ""
        || $nonSuperAdminPrimary->statement !== null
    ) {
        throw new RuntimeException(
            "Failed: non-Super-Admin {$label} Z-readings must remain on primary without probing the report database"
        );
    }
}

$reportDbSource = file_get_contents(__DIR__ . "/../api/report_db.php");
if ($reportDbSource === false) {
    throw new RuntimeException("Failed: unable to inspect report_db.php");
}
$selectorStart = strpos($reportDbSource, "function getZReadingReportPdo(");
$primaryOnlyPosition = strpos(
    $reportDbSource,
    'if (!$isSuperAdmin) {',
    (int)$selectorStart
);
$activationReadPosition = strpos(
    $reportDbSource,
    'posReportMirrorActivationReadState(',
    (int)$selectorStart
);
if (
    $selectorStart === false
    || $primaryOnlyPosition === false
    || $activationReadPosition === false
    || $primaryOnlyPosition > $activationReadPosition
) {
    throw new RuntimeException(
        "Failed: non-Super-Admin primary routing must happen before report activation access"
    );
}

final class ZReadingFailingPdoStub extends PDO
{
    public function __construct()
    {
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        throw new RuntimeException("archive probe failed");
    }
}

$probeErrorPropagated = false;
try {
    reportDbHasClosedZReading(
        new ZReadingFailingPdoStub(),
        "2026-07-01",
        "2026-07-31",
        "CAT",
        "UNIT",
        "1"
    );
} catch (RuntimeException $error) {
    $probeErrorPropagated = $error->getMessage() === "archive probe failed";
}
if (!$probeErrorPropagated) {
    throw new RuntimeException("Failed: archive query errors must not trigger fallback");
}

foreach (["reprint_z_reading.php", "reprint_z_reading_monthly.php"] as $endpoint) {
    $source = file_get_contents(__DIR__ . "/../api/{$endpoint}");
    if ($source === false) {
        throw new RuntimeException("Failed: unable to inspect {$endpoint}");
    }
    if (
        !str_contains($source, "posRoleAuthAccount(") ||
        !str_contains($source, "posRoleAuthCanonicalValue(")
    ) {
        throw new RuntimeException(
            "Failed: {$endpoint} must use authenticated Z-reading source selection"
        );
    }
    if (preg_match('/\\$input\\s*\\[\\s*["\\\']role["\\\']\\s*\\]/i', $source) === 1) {
        throw new RuntimeException(
            "Failed: {$endpoint} must not trust the request role for fallback"
        );
    }
    if (substr_count($source, "posReportMirrorActivationReadState(") !== 1) {
        throw new RuntimeException(
            "Failed: {$endpoint} activation state must have one Super-Admin-gated read"
        );
    }
}

$dailySource = file_get_contents(__DIR__ . "/../api/reprint_z_reading.php");
$monthlySource = file_get_contents(__DIR__ . "/../api/reprint_z_reading_monthly.php");
if (
    $dailySource === false
    || !str_contains($dailySource, "getZReadingReportPdo(")
    || $monthlySource === false
    || !str_contains($monthlySource, '"pdo" => $primaryPdo')
) {
    throw new RuntimeException(
        "Failed: daily/monthly Z-reading role source contracts are missing"
    );
}

echo "Z-reading report database fallback tests passed.\n";
