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

echo "Monthly Z-reading comparison tests passed.\n";
