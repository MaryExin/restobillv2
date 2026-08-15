<?php

declare(strict_types=1);

require_once __DIR__ . "/../api/monthly_z_reading_report.php";

function monthlyZComparisonAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException("Failed: {$message}");
    }
}

monthlyZComparisonAssert(
    monthlyZDate("2026-08-12", "dateFrom") === "2026-08-12",
    "valid ISO dates must be accepted"
);

$invalidDateRejected = false;
try {
    monthlyZDate("2026-02-30", "dateFrom");
} catch (InvalidArgumentException $error) {
    $invalidDateRejected = str_contains(
        $error->getMessage(),
        "dateFrom must use YYYY-MM-DD format"
    );
}
monthlyZComparisonAssert(
    $invalidDateRejected,
    "invalid calendar dates must be rejected"
);

monthlyZComparisonAssert(
    monthlyZBoolean(["compareDatabaseScopes" => "true"], "compareDatabaseScopes", "compare_database_scopes"),
    "camel-case comparison flags must be parsed"
);
monthlyZComparisonAssert(
    monthlyZBoolean(["compare_database_scopes" => 1], "compareDatabaseScopes", "compare_database_scopes"),
    "snake-case comparison flags must be parsed"
);

$mainShiftOne = [
    "Shift_ID" => "1",
    "Category_Code" => "CAT",
    "Unit_Code" => "UNIT",
    "terminal_number" => "1",
    "Opening_DateTime" => "2026-08-11 08:00:00",
    "Closing_DateTime" => "2026-08-11 17:00:00",
];
$mainShiftTwo = [
    "Shift_ID" => "2",
    "Category_Code" => "CAT",
    "Unit_Code" => "UNIT",
    "terminal_number" => "1",
    "Opening_DateTime" => "2026-08-12 08:00:00",
    "Closing_DateTime" => "2026-08-12 17:00:00",
];
$reportShiftTwo = $mainShiftTwo;
$reportShiftTwo["Closing_Cash_Count"] = "2500.00";

$reconciled = monthlyZReconcileShifts(
    [$mainShiftOne, $mainShiftTwo],
    [$reportShiftTwo]
);
monthlyZComparisonAssert(
    count($reconciled["shifts"]) === 2 &&
    $reconciled["reportShiftCount"] === 1 &&
    $reconciled["mainFallbackShiftCount"] === 1 &&
    $reconciled["fallbackShiftDates"] === ["2026-08-11"],
    "shift reconciliation must prefer matching report shifts and retain main fallback shifts"
);

$dateFallbackShifts = monthlyZBuildDateFallbackShifts(
    [$mainShiftOne, $mainShiftTwo],
    [$reportShiftTwo]
);
monthlyZComparisonAssert(
    count($dateFallbackShifts["shifts"]) === 2 &&
    $dateFallbackShifts["reportShiftCount"] === 1 &&
    $dateFallbackShifts["mainFallbackShiftCount"] === 1 &&
    $dateFallbackShifts["fallbackShiftDates"] === ["2026-08-11"] &&
    $dateFallbackShifts["reportCoveredDates"] === ["2026-08-12"],
    "combined shifts must use Report DB by covered date and Main DB only on missing dates"
);

$dateFallbackTransactions = monthlyZSelectDateFallbackTransactions(
    [
        [
            "transactionKey" => "MAIN-11",
            "transactionDate" => "2026-08-11",
            "transactionTime" => "09:00 AM",
            "source" => "cnc",
        ],
        [
            "transactionKey" => "MAIN-12-SKIPPED",
            "transactionDate" => "2026-08-12",
            "transactionTime" => "09:00 AM",
            "source" => "cnc",
        ],
    ],
    [
        [
            "transactionKey" => "REPORT-12",
            "transactionDate" => "2026-08-12",
            "transactionTime" => "10:00 AM",
            "source" => "report",
        ],
    ],
    [$reportShiftTwo]
);
monthlyZComparisonAssert(
    array_column(
        $dateFallbackTransactions["transactions"],
        "transactionKey"
    ) === ["MAIN-11", "REPORT-12"] &&
    $dateFallbackTransactions["mainFallbackTransactionCount"] === 1 &&
    $dateFallbackTransactions["reportTransactionCount"] === 1 &&
    $dateFallbackTransactions["fallbackDates"] === ["2026-08-11"],
    "combined transactions must preserve Report DB skips on covered dates"
);

$combinedCoverage = monthlyZCoverageForCombined(
    $dateFallbackTransactions,
    $dateFallbackShifts
);
monthlyZComparisonAssert(
    $combinedCoverage["missingReportDates"] === ["2026-08-11"] &&
    $combinedCoverage["preservesReportSkips"] === true,
    "combined coverage must disclose fallback dates and preserved skips"
);

$filteredTransactions = monthlyZFilterTransactionsByShifts(
    [
        [
            "transactionDate" => "2026-08-12",
            "transactionTime" => "09:00 AM",
        ],
        [
            "transactionDate" => "2026-08-12",
            "transactionTime" => "06:00 PM",
        ],
    ],
    [$mainShiftTwo]
);
monthlyZComparisonAssert(
    count($filteredTransactions) === 1 &&
    $filteredTransactions[0]["transactionTime"] === "09:00 AM",
    "comparison transactions must remain inside a closed shift"
);

$malformedShift = $mainShiftOne;
$malformedShift["Closing_DateTime"] = "2026-08-11 07:59:00";
$malformedDateTransactions = monthlyZFilterTransactionsByShifts(
    [
        [
            "transactionDate" => "2026-08-11",
            "transactionTime" => "12:00 PM",
        ],
        [
            "transactionDate" => "2026-08-12",
            "transactionTime" => "12:00 PM",
        ],
    ],
    [$malformedShift]
);
monthlyZComparisonAssert(
    count($malformedDateTransactions) === 1 &&
    $malformedDateTransactions[0]["transactionDate"] === "2026-08-11",
    "a malformed closed shift must retain its business date instead of dropping the day"
);

$reportOnlyFallback = monthlyZSelectDateFallbackTransactions(
    [[
        "transactionKey" => "MAIN-COVERED",
        "transactionDate" => "2026-08-12",
        "transactionTime" => "09:00 AM",
    ]],
    [],
    [$reportShiftTwo]
);
monthlyZComparisonAssert(
    $reportOnlyFallback["transactions"] === [] &&
    $reportOnlyFallback["mainFallbackTransactionCount"] === 0,
    "a Report-covered date with zero transactions must stay empty"
);

$allMainFallback = monthlyZSelectDateFallbackTransactions(
    [[
        "transactionKey" => "MAIN-ONLY",
        "transactionDate" => "2026-08-11",
        "transactionTime" => "09:00 AM",
    ]],
    [],
    []
);
monthlyZComparisonAssert(
    array_column($allMainFallback["transactions"], "transactionKey") === [
        "MAIN-ONLY",
    ],
    "Main DB must own dates where Report DB has no closed shift"
);

$endpointSource = file_get_contents(
    __DIR__ . "/../api/reprint_z_reading_monthly.php"
);
monthlyZComparisonAssert(
    is_string($endpointSource),
    "monthly endpoint must be readable"
);
foreach ([
    '"compareDatabaseScopes"',
    "posRoleAuthIsDeveloperSession()",
    "monthlyZBuildDatabaseComparison(",
    '"Monthly database comparison requires a Developer session."',
] as $comparisonContract) {
    monthlyZComparisonAssert(
        str_contains($endpointSource, $comparisonContract),
        "monthly endpoint is missing comparison contract {$comparisonContract}"
    );
}

$helperSource = file_get_contents(
    __DIR__ . "/../api/monthly_z_reading_report.php"
);
monthlyZComparisonAssert(
    is_string($helperSource) &&
    str_contains($helperSource, '"combined"') &&
    str_contains($helperSource, '"hasMissingReportDates"'),
    "monthly comparison helper must expose the conditional combined result"
);

echo "Monthly Z-reading comparison tests passed.\n";
