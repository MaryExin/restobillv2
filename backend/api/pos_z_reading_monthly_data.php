<?php

declare(strict_types=1);

require_once __DIR__ . "/pos_report_mirror.php";

function posZReadingMonthlyFetchShift(
    PDO $pdo,
    string $dateStart,
    string $dateEndExclusive,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    bool $latest
): ?array {
    $direction = $latest ? "DESC" : "ASC";
    $stmt = $pdo->prepare("
        SELECT
            Shift_ID,
            Opening_DateTime,
            Opening_Cash_Count,
            Closing_DateTime,
            Closing_Cash_Count,
            Beg_OR,
            End_OR,
            Beg_VoidNo,
            End_VoidNo,
            Beg_RefundNo,
            End_RefundNo,
            Z_Counter_No,
            Grand_Accum_Sales
        FROM tbl_pos_shifting_records
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND Opening_DateTime >= ?
          AND Opening_DateTime < ?
          AND IFNULL(Z_Counter_No, 0) <> 0
        ORDER BY Opening_DateTime {$direction}, Shift_ID {$direction}
        LIMIT 1
    ");
    $stmt->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateStart,
        $dateEndExclusive,
    ]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : null;
}

function posZReadingMonthlySameShift(?array $left, ?array $right): bool
{
    if ($left === null || $right === null) {
        return $left === $right;
    }

    return (string)($left["Shift_ID"] ?? "") === (string)($right["Shift_ID"] ?? "")
        && (string)($left["Opening_DateTime"] ?? "") ===
            (string)($right["Opening_DateTime"] ?? "");
}

function posZReadingMonthlyFetchClosedDates(
    PDO $pdo,
    string $dateStart,
    string $dateEndExclusive,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber
): array {
    $stmt = $pdo->prepare("
        SELECT DISTINCT DATE(Opening_DateTime) AS business_date
        FROM tbl_pos_shifting_records
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND Opening_DateTime >= ?
          AND Opening_DateTime < ?
          AND IFNULL(Z_Counter_No, 0) <> 0
        ORDER BY business_date
    ");
    $stmt->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateStart,
        $dateEndExclusive,
    ]);

    $dates = [];
    while (($value = $stmt->fetchColumn()) !== false) {
        $date = trim((string)$value);
        if ($date !== "") {
            $dates[] = $date;
        }
    }

    return array_values(array_unique($dates));
}

/**
 * Builds the report-first closed-shift plan for an authenticated Super Admin.
 * Transaction totals use map ownership separately; this plan chooses only the
 * shift snapshots/counters for each date and keeps open days out of the range.
 */
function posZReadingMonthlyPlanHybridRange(
    string $dateFrom,
    string $dateTo,
    array $primaryClosedDates,
    array $reportClosedDates,
    ?string $activationDate = null
): array {
    $timezone = new DateTimeZone("Asia/Manila");
    $parseDate = static function (string $value, string $label) use ($timezone): DateTimeImmutable {
        $value = trim($value);
        $date = DateTimeImmutable::createFromFormat("!Y-m-d", $value, $timezone);
        if (!$date || $date->format("Y-m-d") !== $value) {
            throw new InvalidArgumentException("Invalid {$label}.");
        }
        return $date;
    };

    $start = $parseDate($dateFrom, "Z-reading start date");
    $end = $parseDate($dateTo, "Z-reading end date");
    if ($end < $start) {
        throw new InvalidArgumentException(
            "Z-reading end date must not be before start date."
        );
    }

    $activation = null;
    if ($activationDate !== null && trim($activationDate) !== "") {
        $activation = $parseDate($activationDate, "report activation date");
    }

    $normalizeCoverage = static function (array $values) use ($start, $end): array {
        $coverage = [];
        foreach ($values as $value) {
            $date = trim((string)$value);
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) !== 1) {
                continue;
            }
            if ($date < $start->format("Y-m-d") || $date > $end->format("Y-m-d")) {
                continue;
            }
            $coverage[$date] = true;
        }
        return $coverage;
    };

    $primaryCoverage = $normalizeCoverage($primaryClosedDates);
    $reportCoverage = $normalizeCoverage($reportClosedDates);
    $plans = [];
    $activePlan = null;

    for ($date = $start; $date <= $end; $date = $date->modify("+1 day")) {
        $businessDate = $date->format("Y-m-d");
        $source = isset($reportCoverage[$businessDate])
            ? "report"
            : (isset($primaryCoverage[$businessDate]) ? "primary" : null);

        if ($source === null) {
            if ($activePlan !== null) {
                $plans[] = $activePlan;
                $activePlan = null;
            }
            continue;
        }

        $useActivationMembership = $source === "report"
            && $activation !== null
            && $date >= $activation;
        $endExclusive = $date->modify("+1 day")->format("Y-m-d");

        if (
            $activePlan !== null
            && $activePlan["source"] === $source
            && $activePlan["use_activation_membership"] === $useActivationMembership
            && $activePlan["end_exclusive"] === $businessDate
        ) {
            $activePlan["end_exclusive"] = $endExclusive;
            continue;
        }

        if ($activePlan !== null) {
            $plans[] = $activePlan;
        }
        $activePlan = [
            "source" => $source,
            "start" => $businessDate,
            "end_exclusive" => $endExclusive,
            "use_activation_membership" => $useActivationMembership,
        ];
    }

    if ($activePlan !== null) {
        $plans[] = $activePlan;
    }

    return $plans;
}

function posZReadingMonthlyFetchTotals(
    PDO $pdo,
    string $dateStart,
    string $dateEndExclusive,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    ?string $activationKey = null,
    ?string $activationMapDatabase = null,
    ?bool $includeActivationMembers = null,
    ?string $ownershipMode = null
): array {
    $scopeParams = [
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateStart,
        $dateEndExclusive,
    ];
    $activationKey = trim((string)$activationKey);
    $activationMapDatabase = trim((string)$activationMapDatabase);
    $ownershipMode = trim((string)$ownershipMode);
    $mapTable = "";
    $reportMainTable = "";
    if ($ownershipMode !== "" && $includeActivationMembers !== null) {
        throw new InvalidArgumentException(
            "Activation membership and hybrid ownership cannot be combined."
        );
    }
    if ($ownershipMode !== "") {
        if (!in_array($ownershipMode, ["primary_fallback", "report_posted"], true)) {
            throw new InvalidArgumentException("Invalid Z-reading ownership mode.");
        }
        if ($activationMapDatabase === "") {
            throw new InvalidArgumentException(
                "Report database is required for hybrid Z-reading totals."
            );
        }
        $reportDatabase = posReportMirrorIdentifier(
            $activationMapDatabase,
            "report database name"
        );
        $mapTable = posReportMirrorMapTable($reportDatabase);
        $reportMainTable = posReportMirrorTable(
            $reportDatabase,
            "tbl_pos_transactions"
        );
    } elseif ($includeActivationMembers !== null) {
        if ($activationKey === "" || $activationMapDatabase === "") {
            throw new InvalidArgumentException(
                "Activation key and report database are required for split Z-reading totals."
            );
        }
        $mapTable = posReportMirrorMapTable(posReportMirrorIdentifier(
            $activationMapDatabase,
            "report database name"
        ));
    }

    $membershipSql = static function (
        string $transactionAlias,
        string $mapAlias
    ) use (
        $includeActivationMembers,
        $ownershipMode,
        $mapTable,
        $reportMainTable
    ): array {
        if ($ownershipMode === "report_posted") {
            return [
                "join" => "
                    INNER JOIN {$mapTable} {$mapAlias}
                        ON {$mapAlias}.report_transaction_id = {$transactionAlias}.transaction_id
                       AND {$mapAlias}.Category_Code = {$transactionAlias}.Category_Code
                       AND {$mapAlias}.Unit_Code = {$transactionAlias}.Unit_Code
                       AND {$mapAlias}.report_status = 0
                ",
                "where" => "",
            ];
        }

        if ($ownershipMode === "primary_fallback") {
            return [
                "join" => "",
                "where" => "
                    AND (
                        NOT EXISTS (
                            SELECT 1
                            FROM {$mapTable} {$mapAlias}
                            WHERE {$mapAlias}.source_pos_id = {$transactionAlias}.ID
                              AND {$mapAlias}.Category_Code = {$transactionAlias}.Category_Code
                              AND {$mapAlias}.Unit_Code = {$transactionAlias}.Unit_Code
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM {$mapTable} {$mapAlias}_fallback
                            WHERE {$mapAlias}_fallback.source_pos_id = {$transactionAlias}.ID
                              AND {$mapAlias}_fallback.Category_Code = {$transactionAlias}.Category_Code
                              AND {$mapAlias}_fallback.Unit_Code = {$transactionAlias}.Unit_Code
                              AND {$mapAlias}_fallback.report_status = 0
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM {$reportMainTable} report_header
                                  WHERE report_header.transaction_id =
                                        {$mapAlias}_fallback.report_transaction_id
                                    AND report_header.Category_Code =
                                        {$mapAlias}_fallback.Category_Code
                                    AND report_header.Unit_Code =
                                        {$mapAlias}_fallback.Unit_Code
                              )
                        )
                    )
                ",
            ];
        }

        if ($includeActivationMembers === null) {
            return ["join" => "", "where" => ""];
        }

        if ($includeActivationMembers) {
            return [
                "join" => "
                    INNER JOIN {$mapTable} {$mapAlias}
                        ON {$mapAlias}.report_transaction_id = {$transactionAlias}.transaction_id
                       AND {$mapAlias}.Category_Code = {$transactionAlias}.Category_Code
                       AND {$mapAlias}.Unit_Code = {$transactionAlias}.Unit_Code
                ",
                "where" => "
                    AND {$mapAlias}.activation_key = ?
                    AND {$mapAlias}.report_status = 0
                ",
            ];
        }

        return [
            "join" => "",
            "where" => "
                AND NOT EXISTS (
                    SELECT 1
                    FROM {$mapTable} {$mapAlias}
                    WHERE {$mapAlias}.source_pos_id = {$transactionAlias}.ID
                      AND {$mapAlias}.activation_key = ?
                )
            ",
        ];
    };
    $transactionMembership = $membershipSql("t", "mirror_map");
    $paymentMembership = $membershipSql("a", "mirror_map");
    $membershipParams = $includeActivationMembers === null ? [] : [$activationKey];

    $transactionStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN TotalSales ELSE 0 END), 0) AS Sales_For_The_Range,
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN VATableSales ELSE 0 END), 0) AS VATableSales,
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN VATableSales_VAT ELSE 0 END), 0) AS VATableSales_VAT,
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN VATExemptSales ELSE 0 END), 0) AS VATExemptSales,
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN VATExemptSales_VAT ELSE 0 END), 0) AS VATExemptSales_VAT,
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN VATZeroRatedSales ELSE 0 END), 0) AS VATZeroRatedSales,
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN TotalSales ELSE 0 END), 0) AS Gross_Amount,
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN Discount ELSE 0 END), 0) AS Discount,
            COALESCE(SUM(CASE WHEN Status = 'Active' THEN OtherCharges ELSE 0 END), 0) AS OtherCharges,
            COALESCE(SUM(CASE WHEN Status = 'Voided' THEN TotalAmountDue ELSE 0 END), 0) AS Voided_Sales,
            COALESCE(SUM(CASE WHEN Status = 'Refunded' THEN TotalAmountDue ELSE 0 END), 0) AS Refunded_Sales
        FROM tbl_pos_transactions t
        {$transactionMembership["join"]}
        WHERE t.Category_Code = ?
          AND t.Unit_Code = ?
          AND t.terminal_number = ?
          AND t.transaction_date >= ?
          AND t.transaction_date < ?
          {$transactionMembership["where"]}
    ");
    $transactionStmt->execute(array_merge($scopeParams, $membershipParams));
    $transactionTotals = $transactionStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $discountStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(CASE WHEN d.discount_type = 'Senior Citizen' THEN d.discount_amount ELSE 0 END), 0) AS Discount_SC,
            COALESCE(SUM(CASE WHEN d.discount_type = 'PWD' THEN d.discount_amount ELSE 0 END), 0) AS Discount_PWD,
            COALESCE(SUM(CASE WHEN d.discount_type = 'NAAC' THEN d.discount_amount ELSE 0 END), 0) AS Discount_NAAC,
            COALESCE(SUM(CASE WHEN d.discount_type = 'Solo Parent' THEN d.discount_amount ELSE 0 END), 0) AS Discount_Solo,
            COALESCE(SUM(CASE WHEN d.discount_type NOT IN ('Senior Citizen', 'PWD', 'NAAC', 'Solo Parent') THEN d.discount_amount ELSE 0 END), 0) AS Discount_Other
        FROM tbl_pos_transactions_discounts d
        INNER JOIN tbl_pos_transactions t
            ON d.transaction_id = t.transaction_id
           AND d.Category_Code = t.Category_Code
           AND d.Unit_Code = t.Unit_Code
        {$transactionMembership["join"]}
        WHERE t.Category_Code = ?
          AND t.Unit_Code = ?
          AND t.terminal_number = ?
          AND t.transaction_date >= ?
          AND t.transaction_date < ?
          AND d.Status = 'Active'
          {$transactionMembership["where"]}
    ");
    $discountStmt->execute(array_merge($scopeParams, $membershipParams));
    $discountTotals = $discountStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $paymentStmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(CASE WHEN b.payment_method = 'Cash' THEN b.payment_amount - a.change_amount ELSE 0 END), 0) AS Payment_Cash,
            COALESCE(SUM(CASE WHEN b.payment_method = 'Cheque' THEN b.payment_amount ELSE 0 END), 0) AS Payment_Cheque,
            COALESCE(SUM(CASE WHEN b.payment_method = 'Credit Card' THEN b.payment_amount ELSE 0 END), 0) AS Payment_CreditCard,
            COALESCE(SUM(CASE WHEN b.payment_method NOT IN ('Cash', 'Cheque', 'Credit Card') THEN b.payment_amount ELSE 0 END), 0) AS Payment_Others
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        {$paymentMembership["join"]}
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND a.transaction_date >= ?
          AND a.transaction_date < ?
          AND a.Status = 'Active'
          {$paymentMembership["where"]}
    ");
    $paymentStmt->execute(array_merge($scopeParams, $membershipParams));
    $paymentTotals = $paymentStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $totals = array_merge($transactionTotals, $discountTotals, $paymentTotals);
    foreach ($totals as $key => $value) {
        $totals[$key] = (float)($value ?: 0);
    }

    return $totals;
}

function posZReadingMonthlyFetchSuperAdminHybridTotals(
    PDO $primaryPdo,
    PDO $reportPdo,
    string $reportDatabase,
    string $dateStart,
    string $dateEndExclusive,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber
): array {
    $primaryTotals = posZReadingMonthlyFetchTotals(
        $primaryPdo,
        $dateStart,
        $dateEndExclusive,
        $categoryCode,
        $unitCode,
        $terminalNumber,
        null,
        $reportDatabase,
        null,
        "primary_fallback"
    );
    $reportTotals = posZReadingMonthlyFetchTotals(
        $reportPdo,
        $dateStart,
        $dateEndExclusive,
        $categoryCode,
        $unitCode,
        $terminalNumber,
        null,
        $reportDatabase,
        null,
        "report_posted"
    );

    return posZReadingMonthlyMergeTotals([
        ["totals" => $primaryTotals],
        ["totals" => $reportTotals],
    ]);
}

function posZReadingMonthlyLoadSegment(
    PDO $pdo,
    string $dateStart,
    string $dateEndExclusive,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    ?string $activationKey = null,
    ?string $activationMapDatabase = null,
    ?bool $includeActivationMembers = null
): array {
    return [
        "first_shift" => posZReadingMonthlyFetchShift(
            $pdo,
            $dateStart,
            $dateEndExclusive,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            false
        ),
        "last_shift" => posZReadingMonthlyFetchShift(
            $pdo,
            $dateStart,
            $dateEndExclusive,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            true
        ),
        "totals" => posZReadingMonthlyFetchTotals(
            $pdo,
            $dateStart,
            $dateEndExclusive,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            $activationKey,
            $activationMapDatabase,
            $includeActivationMembers
        ),
    ];
}

function posZReadingMonthlyMergeTotals(array $segments): array
{
    $result = [];
    foreach ($segments as $segment) {
        foreach (($segment["totals"] ?? []) as $key => $value) {
            $result[$key] = (float)($result[$key] ?? 0) + (float)$value;
        }
    }

    return $result;
}
