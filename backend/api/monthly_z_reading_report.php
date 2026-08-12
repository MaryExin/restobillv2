<?php

declare(strict_types=1);

final class MonthlyZReadingNoDataException extends RuntimeException
{
}

function monthlyZRequireIdentifier($value, string $label): string
{
    $identifier = trim((string)$value);
    if ($identifier === "" || !preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        throw new InvalidArgumentException("Invalid {$label} configured.");
    }

    return $identifier;
}

function monthlyZTable(string $databaseName, string $tableName): string
{
    return "`{$databaseName}`.`{$tableName}`";
}

function monthlyZDate($value, string $label): string
{
    $date = trim((string)$value);
    $parsed = DateTimeImmutable::createFromFormat("!Y-m-d", $date);
    $errors = DateTimeImmutable::getLastErrors();
    $hasErrors = is_array($errors) && (
        (int)($errors["warning_count"] ?? 0) > 0 ||
        (int)($errors["error_count"] ?? 0) > 0
    );

    if (!$parsed || $hasErrors || $parsed->format("Y-m-d") !== $date) {
        throw new InvalidArgumentException(
            "{$label} must use YYYY-MM-DD format."
        );
    }

    return $date;
}

function monthlyZBoolean(array $input, string $camelKey, string $snakeKey): bool
{
    $value = $input[$camelKey] ?? $input[$snakeKey] ?? false;
    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function monthlyZReadingEntry(
    string $scope,
    string $label,
    ?array $payload,
    array $coverage,
    string $error = ""
): array {
    return [
        "scope" => $scope,
        "sourceDatabaseLabel" => $label,
        "payload" => $payload,
        "coverage" => $coverage,
        "error" => $error,
    ];
}

function monthlyZTableExists(PDO $pdo, string $databaseName, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
    ");
    $stmt->execute([$databaseName, $tableName]);

    return (int)$stmt->fetchColumn() > 0;
}

function monthlyZFetchBusinessUnit(
    PDO $pdo,
    string $databaseName,
    string $categoryCode,
    string $unitCode
): ?array {
    $table = monthlyZTable($databaseName, "tbl_main_business_units");
    $stmt = $pdo->prepare("
        SELECT
            Corp_Code,
            Unit_Name,
            Unit_TIN,
            Unit_Address,
            VAT_Registration
        FROM {$table}
        WHERE Category_Code = ?
          AND Unit_Code = ?
        LIMIT 1
    ");
    $stmt->execute([$categoryCode, $unitCode]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : null;
}

function monthlyZFetchShifts(
    PDO $pdo,
    string $databaseName,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    string $dateFrom,
    string $dateTo
): array {
    $table = monthlyZTable($databaseName, "tbl_pos_shifting_records");
    $stmt = $pdo->prepare("
        SELECT
            Shift_ID,
            Category_Code,
            Unit_Code,
            terminal_number,
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
        FROM {$table}
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND CAST(terminal_number AS CHAR) = ?
          AND DATE(Opening_DateTime) BETWEEN ? AND ?
          AND IFNULL(Z_Counter_No, 0) <> 0
        ORDER BY Opening_DateTime ASC, Shift_ID ASC
    ");
    $stmt->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo,
    ]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function monthlyZFetchSourceAccumulatedSales(
    PDO $pdo,
    string $databaseName,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    array $shifts
): float {
    if ($shifts === []) {
        return 0.0;
    }

    $lastShift = $shifts[count($shifts) - 1];
    $cutoffDateTime = trim((string)(
        ($lastShift["Closing_DateTime"] ?? "")
            ?: ($lastShift["Opening_DateTime"] ?? "")
            ?: ""
    ));
    $cutoffDate = substr($cutoffDateTime, 0, 10);
    if ($cutoffDate === "") {
        return 0.0;
    }

    $table = monthlyZTable($databaseName, "tbl_pos_transactions");
    $transactionDateTime = "COALESCE(
        STR_TO_DATE(
            CONCAT(DATE(transaction_date), ' ', transaction_time),
            '%Y-%m-%d %h:%i:%s %p'
        ),
        STR_TO_DATE(
            CONCAT(DATE(transaction_date), ' ', transaction_time),
            '%Y-%m-%d %h:%i %p'
        ),
        STR_TO_DATE(
            CONCAT(DATE(transaction_date), ' ', transaction_time),
            '%Y-%m-%d %H:%i:%s'
        ),
        STR_TO_DATE(
            CONCAT(DATE(transaction_date), ' ', transaction_time),
            '%Y-%m-%d %H:%i'
        ),
        TIMESTAMP(DATE(transaction_date), '00:00:00')
    )";
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(TotalSales), 0)
        FROM {$table}
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND CAST(terminal_number AS CHAR) = ?
          AND Status = 'Active'
          AND (
                DATE(transaction_date) < ?
             OR (
                    DATE(transaction_date) = ?
                AND {$transactionDateTime} <= ?
             )
          )
    ");
    $stmt->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $cutoffDate,
        $cutoffDate,
        $cutoffDateTime,
    ]);

    return (float)($stmt->fetchColumn() ?: 0);
}

function monthlyZShiftKey(array $shift): string
{
    return implode("\0", [
        (string)($shift["Shift_ID"] ?? ""),
        (string)($shift["Category_Code"] ?? ""),
        (string)($shift["Unit_Code"] ?? ""),
        (string)($shift["terminal_number"] ?? ""),
        (string)($shift["Opening_DateTime"] ?? ""),
    ]);
}

function monthlyZReconcileShifts(array $mainShifts, array $reportShifts): array
{
    $reportByKey = [];
    foreach ($reportShifts as $shift) {
        $reportByKey[monthlyZShiftKey($shift)] = $shift;
    }

    $selected = [];
    $selectedKeys = [];
    $reportCount = 0;
    $fallbackCount = 0;
    $fallbackDates = [];

    foreach ($mainShifts as $mainShift) {
        $key = monthlyZShiftKey($mainShift);
        if (isset($reportByKey[$key])) {
            $selected[] = $reportByKey[$key];
            $selectedKeys[$key] = true;
            $reportCount += 1;
            continue;
        }

        $selected[] = $mainShift;
        $selectedKeys[$key] = true;
        $fallbackCount += 1;
        $date = substr((string)($mainShift["Opening_DateTime"] ?? ""), 0, 10);
        if ($date !== "") {
            $fallbackDates[$date] = true;
        }
    }

    // Archived report shifts can outlive the corresponding operational row.
    // Keep those report-only shifts instead of dropping valid historical data.
    foreach ($reportShifts as $reportShift) {
        $key = monthlyZShiftKey($reportShift);
        if (isset($selectedKeys[$key])) {
            continue;
        }

        $selected[] = $reportShift;
        $reportCount += 1;
    }

    usort($selected, static function (array $left, array $right): int {
        $dateComparison = strcmp(
            (string)($left["Opening_DateTime"] ?? ""),
            (string)($right["Opening_DateTime"] ?? "")
        );
        if ($dateComparison !== 0) {
            return $dateComparison;
        }

        return (float)($left["Shift_ID"] ?? 0) <=> (float)($right["Shift_ID"] ?? 0);
    });

    $fallbackDateList = array_keys($fallbackDates);
    sort($fallbackDateList);

    return [
        "shifts" => $selected,
        "reportShiftCount" => $reportCount,
        "mainFallbackShiftCount" => $fallbackCount,
        "fallbackShiftDates" => $fallbackDateList,
    ];
}

function monthlyZNormalizeTransactionRow(
    array $row,
    string $prefix,
    string $source,
    string $fallbackReason = ""
): array {
    return [
        "source" => $source,
        "fallbackReason" => $fallbackReason,
        "archiveOnly" => false,
        "transactionId" => $row[$prefix . "transaction_id"] ?? null,
        "transactionKey" => (string)($row[$prefix . "transaction_key"] ?? ""),
        "transactionDate" => (string)($row[$prefix . "transaction_date"] ?? ""),
        "transactionTime" => (string)($row[$prefix . "transaction_time"] ?? ""),
        "status" => (string)($row[$prefix . "status"] ?? ""),
        "totalSales" => (float)($row[$prefix . "total_sales"] ?? 0),
        "vatableSales" => (float)($row[$prefix . "vatable_sales"] ?? 0),
        "vatAmount" => (float)($row[$prefix . "vat_amount"] ?? 0),
        "vatExemptSales" => (float)($row[$prefix . "vat_exempt_sales"] ?? 0),
        "vatExemptVat" => (float)($row[$prefix . "vat_exempt_vat"] ?? 0),
        "zeroRatedSales" => (float)($row[$prefix . "zero_rated_sales"] ?? 0),
        "totalAmountDue" => (float)($row[$prefix . "total_amount_due"] ?? 0),
        "discount" => (float)($row[$prefix . "discount"] ?? 0),
        "otherCharges" => (float)($row[$prefix . "other_charges"] ?? 0),
        "changeAmount" => (float)($row[$prefix . "change_amount"] ?? 0),
    ];
}

function monthlyZTransactionSelect(string $alias, string $prefix): string
{
    return "
        {$alias}.transaction_id AS {$prefix}transaction_id,
        CAST({$alias}.transaction_id AS CHAR) AS {$prefix}transaction_key,
        {$alias}.transaction_date AS {$prefix}transaction_date,
        {$alias}.transaction_time AS {$prefix}transaction_time,
        {$alias}.Status AS {$prefix}status,
        {$alias}.TotalSales AS {$prefix}total_sales,
        {$alias}.VATableSales AS {$prefix}vatable_sales,
        {$alias}.VATableSales_VAT AS {$prefix}vat_amount,
        {$alias}.VATExemptSales AS {$prefix}vat_exempt_sales,
        {$alias}.VATExemptSales_VAT AS {$prefix}vat_exempt_vat,
        {$alias}.VATZeroRatedSales AS {$prefix}zero_rated_sales,
        {$alias}.TotalAmountDue AS {$prefix}total_amount_due,
        {$alias}.Discount AS {$prefix}discount,
        {$alias}.OtherCharges AS {$prefix}other_charges,
        {$alias}.change_amount AS {$prefix}change_amount
    ";
}

function monthlyZFetchMainTransactions(
    PDO $pdo,
    string $mainDatabase,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    string $dateFrom,
    string $dateTo
): array {
    $table = monthlyZTable($mainDatabase, "tbl_pos_transactions");
    $select = monthlyZTransactionSelect("p", "main_");
    $stmt = $pdo->prepare("
        SELECT {$select}
        FROM {$table} p
        WHERE p.Category_Code = ?
          AND p.Unit_Code = ?
          AND CAST(p.terminal_number AS CHAR) = ?
          AND DATE(p.transaction_date) BETWEEN ? AND ?
        ORDER BY p.transaction_date ASC, p.transaction_time ASC, p.ID ASC
    ");
    $stmt->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo,
    ]);

    return array_map(
        static fn(array $row): array => monthlyZNormalizeTransactionRow(
            $row,
            "main_",
            "cnc"
        ),
        $stmt->fetchAll(PDO::FETCH_ASSOC)
    );
}

function monthlyZFetchReportTransactions(
    PDO $pdo,
    string $reportDatabase,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    string $dateFrom,
    string $dateTo,
    bool $requirePostedMap
): array {
    $reportTable = monthlyZTable($reportDatabase, "tbl_pos_transactions");
    $mapTable = monthlyZTable($reportDatabase, "tbl_pos_report_transaction_map");
    $select = monthlyZTransactionSelect("r", "report_");
    $mapJoin = $requirePostedMap
        ? "INNER JOIN {$mapTable} m
             ON m.report_transaction_id = r.transaction_id
            AND m.Category_Code = r.Category_Code
            AND m.Unit_Code = r.Unit_Code
            AND m.report_status = 0"
        : "";

    $stmt = $pdo->prepare("
        SELECT {$select}
        FROM {$reportTable} r
        {$mapJoin}
        WHERE r.Category_Code = ?
          AND r.Unit_Code = ?
          AND CAST(r.terminal_number AS CHAR) = ?
          AND DATE(r.transaction_date) BETWEEN ? AND ?
        ORDER BY r.transaction_date ASC, r.transaction_time ASC, r.ID ASC
    ");
    $stmt->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo,
    ]);

    return array_map(
        static fn(array $row): array => monthlyZNormalizeTransactionRow(
            $row,
            "report_",
            "report"
        ),
        $stmt->fetchAll(PDO::FETCH_ASSOC)
    );
}

function monthlyZFetchEffectiveTransactions(
    PDO $pdo,
    string $mainDatabase,
    string $reportDatabase,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    string $dateFrom,
    string $dateTo
): array {
    $mainTable = monthlyZTable($mainDatabase, "tbl_pos_transactions");
    $reportTable = monthlyZTable($reportDatabase, "tbl_pos_transactions");
    $mapTable = monthlyZTable($reportDatabase, "tbl_pos_report_transaction_map");
    $mainPaymentTable = monthlyZTable(
        $mainDatabase,
        "tbl_pos_transactions_payments"
    );
    $reportPaymentTable = monthlyZTable(
        $reportDatabase,
        "tbl_pos_transactions_payments"
    );
    $mainDiscountTable = monthlyZTable(
        $mainDatabase,
        "tbl_pos_transactions_discounts"
    );
    $reportDiscountTable = monthlyZTable(
        $reportDatabase,
        "tbl_pos_transactions_discounts"
    );
    $mainSelect = monthlyZTransactionSelect("p", "main_");
    $reportSelect = monthlyZTransactionSelect("r", "report_");
    $hasMap = monthlyZTableExists(
        $pdo,
        $reportDatabase,
        "tbl_pos_report_transaction_map"
    );

    if (!$hasMap) {
        $transactions = monthlyZFetchMainTransactions(
            $pdo,
            $mainDatabase,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            $dateFrom,
            $dateTo
        );

        foreach ($transactions as &$transaction) {
            $transaction["fallbackReason"] = "unmapped";
        }
        unset($transaction);
        $mainFallbackCount = count($transactions);

        // Older installations may predate the stable mapping table. Exact
        // transaction-level reconciliation is unsafe there, so main owns each
        // date on which it has data and report rows fill only otherwise-empty
        // dates. This preserves archived days without double-counting a day.
        $mainDates = array_fill_keys(
            monthlyZTransactionDates($transactions),
            true
        );
        $reportOnlyCount = 0;
        foreach (monthlyZFetchReportTransactions(
            $pdo,
            $reportDatabase,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            $dateFrom,
            $dateTo,
            false
        ) as $reportTransaction) {
            $reportDate = substr(
                (string)($reportTransaction["transactionDate"] ?? ""),
                0,
                10
            );
            if ($reportDate === "" || isset($mainDates[$reportDate])) {
                continue;
            }

            $reportTransaction["archiveOnly"] = true;
            $transactions[] = $reportTransaction;
            $reportOnlyCount += 1;
        }

        usort($transactions, static function (array $left, array $right): int {
            $dateComparison = strcmp(
                (string)($left["transactionDate"] ?? ""),
                (string)($right["transactionDate"] ?? "")
            );
            if ($dateComparison !== 0) {
                return $dateComparison;
            }

            return strcmp(
                (string)($left["transactionKey"] ?? ""),
                (string)($right["transactionKey"] ?? "")
            );
        });

        return [
            "transactions" => $transactions,
            "reportTransactionCount" => $reportOnlyCount,
            "reportOnlyTransactionCount" => $reportOnlyCount,
            "mainFallbackTransactionCount" => $mainFallbackCount,
            "fallbackReasons" => ["unmapped" => $mainFallbackCount],
            "fallbackDates" => array_keys($mainDates),
        ];
    }

    $stmt = $pdo->prepare("
        SELECT
            p.ID AS source_pos_id,
            m.id AS map_id,
            m.report_status,
            m.report_transaction_id,
            CAST(m.report_transaction_id AS CHAR) AS mapped_report_transaction_key,
            r.ID AS report_pos_id,
            (
                SELECT COUNT(*)
                FROM {$mainPaymentTable} main_payment
                WHERE main_payment.transaction_id = p.transaction_id
                  AND main_payment.Category_Code = p.Category_Code
                  AND main_payment.Unit_Code = p.Unit_Code
            ) AS main_payment_count,
            (
                SELECT COUNT(*)
                FROM {$reportPaymentTable} report_payment
                WHERE report_payment.transaction_id = r.transaction_id
                  AND report_payment.Category_Code = r.Category_Code
                  AND report_payment.Unit_Code = r.Unit_Code
            ) AS report_payment_count,
            (
                SELECT COUNT(*)
                FROM {$mainDiscountTable} main_discount
                WHERE main_discount.transaction_id = p.transaction_id
                  AND main_discount.Category_Code = p.Category_Code
                  AND main_discount.Unit_Code = p.Unit_Code
                  AND main_discount.Status = 'Active'
            ) AS main_discount_count,
            (
                SELECT COUNT(*)
                FROM {$reportDiscountTable} report_discount
                WHERE report_discount.transaction_id = r.transaction_id
                  AND report_discount.Category_Code = r.Category_Code
                  AND report_discount.Unit_Code = r.Unit_Code
                  AND report_discount.Status = 'Active'
            ) AS report_discount_count,
            {$mainSelect},
            {$reportSelect}
        FROM {$mainTable} p
        LEFT JOIN {$mapTable} m
          ON m.id = (
              SELECT candidate_map.id
              FROM {$mapTable} candidate_map
              WHERE (
                    candidate_map.source_pos_id = p.ID
                AND candidate_map.Category_Code = p.Category_Code
                AND candidate_map.Unit_Code = p.Unit_Code
              ) OR (
                    candidate_map.source_transaction_id = p.transaction_id
                AND candidate_map.Category_Code = p.Category_Code
                AND candidate_map.Unit_Code = p.Unit_Code
              )
              ORDER BY CASE
                  WHEN candidate_map.source_pos_id = p.ID THEN 0
                  ELSE 1
              END
              LIMIT 1
          )
        LEFT JOIN {$reportTable} r
          ON m.report_status = 0
         AND r.transaction_id = m.report_transaction_id
         AND r.Category_Code = p.Category_Code
         AND r.Unit_Code = p.Unit_Code
         AND CAST(r.terminal_number AS CHAR) = CAST(p.terminal_number AS CHAR)
         AND DATE(r.transaction_date) = DATE(p.transaction_date)
        WHERE p.Category_Code = ?
          AND p.Unit_Code = ?
          AND CAST(p.terminal_number AS CHAR) = ?
          AND DATE(p.transaction_date) BETWEEN ? AND ?
        ORDER BY p.transaction_date ASC, p.transaction_time ASC, p.ID ASC
    ");
    $stmt->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo,
    ]);

    $transactions = [];
    $reportCount = 0;
    $fallbackCount = 0;
    $fallbackReasons = [
        "skipped" => 0,
        "missingReportRow" => 0,
        "missingReportChildren" => 0,
        "unmapped" => 0,
    ];
    $fallbackDates = [];
    $mainDates = [];
    $selectedReportKeys = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $mainDate = substr(
            (string)($row["main_transaction_date"] ?? ""),
            0,
            10
        );
        if ($mainDate !== "") {
            $mainDates[$mainDate] = true;
        }

        $mappedReportKey = (string)(
            $row["mapped_report_transaction_key"] ?? ""
        );
        if (
            $row["map_id"] !== null &&
            (int)($row["report_status"] ?? 1) === 0 &&
            $row["report_pos_id"] !== null &&
            $mappedReportKey !== ""
        ) {
            // Exclude every report parent already associated with a selected
            // main source, even when incomplete children force main fallback.
            $selectedReportKeys[$mappedReportKey] = true;
        }

        $hasCompleteReportChildren =
            (int)($row["report_payment_count"] ?? 0)
                === (int)($row["main_payment_count"] ?? 0)
            && (int)($row["report_discount_count"] ?? 0)
                === (int)($row["main_discount_count"] ?? 0);
        $useReport = $row["map_id"] !== null
            && (int)($row["report_status"] ?? 1) === 0
            && $row["report_pos_id"] !== null
            && $hasCompleteReportChildren;

        if ($useReport) {
            $transaction = monthlyZNormalizeTransactionRow(
                $row,
                "report_",
                "report"
            );
            $transactions[] = $transaction;
            $reportCount += 1;
            continue;
        }

        if ($row["map_id"] === null) {
            $reason = "unmapped";
        } elseif ((int)($row["report_status"] ?? 1) === 1) {
            $reason = "skipped";
        } elseif ($row["report_pos_id"] === null) {
            $reason = "missingReportRow";
        } else {
            $reason = "missingReportChildren";
        }

        $transaction = monthlyZNormalizeTransactionRow(
            $row,
            "main_",
            "cnc",
            $reason
        );
        $transactions[] = $transaction;
        $fallbackCount += 1;
        $fallbackReasons[$reason] += 1;
        $date = substr($transaction["transactionDate"], 0, 10);
        if ($date !== "") {
            $fallbackDates[$date] = true;
        }
    }

    $reportOnlyCount = 0;
    foreach (monthlyZFetchReportTransactions(
        $pdo,
        $reportDatabase,
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo,
        true
    ) as $reportTransaction) {
        $transactionKey = $reportTransaction["transactionKey"];
        if ($transactionKey === "" || isset($selectedReportKeys[$transactionKey])) {
            continue;
        }

        // This is normally an archived row whose main source was removed by
        // an operational reset. It remains a valid posted report row.
        $reportTransaction["archiveOnly"] = true;
        $transactions[] = $reportTransaction;
        $selectedReportKeys[$transactionKey] = true;
        $reportCount += 1;
        $reportOnlyCount += 1;
    }

    // The mapping migration can only backfill report rows whose main source
    // still exists. Preserve older unmapped archive rows, but only on dates
    // with no main parents so transaction identity never has to be guessed.
    foreach (monthlyZFetchReportTransactions(
        $pdo,
        $reportDatabase,
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo,
        false
    ) as $reportTransaction) {
        $transactionKey = $reportTransaction["transactionKey"];
        $reportDate = substr(
            (string)($reportTransaction["transactionDate"] ?? ""),
            0,
            10
        );
        if (
            $transactionKey === "" ||
            $reportDate === "" ||
            isset($selectedReportKeys[$transactionKey]) ||
            isset($mainDates[$reportDate])
        ) {
            continue;
        }

        $reportTransaction["archiveOnly"] = true;
        $transactions[] = $reportTransaction;
        $selectedReportKeys[$transactionKey] = true;
        $reportCount += 1;
        $reportOnlyCount += 1;
    }

    usort($transactions, static function (array $left, array $right): int {
        $dateComparison = strcmp(
            (string)($left["transactionDate"] ?? ""),
            (string)($right["transactionDate"] ?? "")
        );
        if ($dateComparison !== 0) {
            return $dateComparison;
        }

        return strcmp(
            (string)($left["transactionKey"] ?? ""),
            (string)($right["transactionKey"] ?? "")
        );
    });

    $fallbackDateList = array_keys($fallbackDates);
    sort($fallbackDateList);

    return [
        "transactions" => $transactions,
        "reportTransactionCount" => $reportCount,
        "reportOnlyTransactionCount" => $reportOnlyCount,
        "mainFallbackTransactionCount" => $fallbackCount,
        "fallbackReasons" => $fallbackReasons,
        "fallbackDates" => $fallbackDateList,
    ];
}

function monthlyZTransactionDates(array $transactions): array
{
    $dates = [];
    foreach ($transactions as $transaction) {
        $date = substr((string)($transaction["transactionDate"] ?? ""), 0, 10);
        if ($date !== "") {
            $dates[$date] = true;
        }
    }

    $dateList = array_keys($dates);
    sort($dateList);

    return $dateList;
}

function monthlyZClosedShiftDates(array $shifts): array
{
    $dates = [];
    foreach ($shifts as $shift) {
        $date = substr((string)($shift["Opening_DateTime"] ?? ""), 0, 10);
        if ($date !== "") {
            $dates[$date] = true;
        }
    }

    return $dates;
}

function monthlyZTransactionTimestamp(array $transaction): ?int
{
    $transactionDate = trim((string)(
        $transaction["transactionDate"] ?? ""
    ));
    $date = substr($transactionDate, 0, 10);
    if ($date === "") {
        return null;
    }

    $time = trim((string)($transaction["transactionTime"] ?? ""));
    $timestamp = strtotime($time !== "" ? "{$date} {$time}" : $transactionDate);

    return $timestamp === false ? null : $timestamp;
}

function monthlyZClosedShiftIntervals(array $shifts): array
{
    $intervals = [];
    foreach ($shifts as $shift) {
        $opening = strtotime((string)($shift["Opening_DateTime"] ?? ""));
        $closing = strtotime((string)(
            ($shift["Closing_DateTime"] ?? "")
                ?: ($shift["Opening_DateTime"] ?? "")
        ));
        if ($opening === false || $closing === false || $closing < $opening) {
            continue;
        }

        $intervals[] = ["opening" => $opening, "closing" => $closing];
    }

    return $intervals;
}

function monthlyZFilterTransactionsByShifts(
    array $transactions,
    array $shifts
): array {
    $closedDates = monthlyZClosedShiftDates($shifts);
    $closedIntervals = monthlyZClosedShiftIntervals($shifts);
    if ($closedDates === [] || $closedIntervals === []) {
        return [];
    }

    return array_values(array_filter(
        $transactions,
        static function (array $transaction) use (
            $closedDates,
            $closedIntervals
        ): bool {
            $date = substr(
                (string)($transaction["transactionDate"] ?? ""),
                0,
                10
            );
            $timestamp = monthlyZTransactionTimestamp($transaction);
            if ($timestamp === null) {
                return isset($closedDates[$date]);
            }

            foreach ($closedIntervals as $interval) {
                if (
                    $timestamp >= $interval["opening"] &&
                    $timestamp <= $interval["closing"]
                ) {
                    return true;
                }
            }

            return false;
        }
    ));
}

function monthlyZFilterEffectiveTransactionsByShifts(
    array $transactionResult,
    array $shifts
): array {
    $transactions = monthlyZFilterTransactionsByShifts(
        $transactionResult["transactions"] ?? [],
        $shifts
    );
    $reportCount = 0;
    $reportOnlyCount = 0;
    $fallbackCount = 0;
    $fallbackReasons = [];
    $fallbackDates = [];

    foreach ($transactions as $transaction) {
        if (($transaction["source"] ?? "") === "report") {
            $reportCount += 1;
            if (($transaction["archiveOnly"] ?? false) === true) {
                $reportOnlyCount += 1;
            }
            continue;
        }

        $fallbackCount += 1;
        $reason = (string)($transaction["fallbackReason"] ?? "unmapped");
        if ($reason === "") {
            $reason = "unmapped";
        }
        $fallbackReasons[$reason] = ($fallbackReasons[$reason] ?? 0) + 1;
        $date = substr((string)($transaction["transactionDate"] ?? ""), 0, 10);
        if ($date !== "") {
            $fallbackDates[$date] = true;
        }
    }

    $fallbackDateList = array_keys($fallbackDates);
    sort($fallbackDateList);

    return [
        "transactions" => $transactions,
        "reportTransactionCount" => $reportCount,
        "reportOnlyTransactionCount" => $reportOnlyCount,
        "mainFallbackTransactionCount" => $fallbackCount,
        "fallbackReasons" => $fallbackReasons,
        "fallbackDates" => $fallbackDateList,
    ];
}

function monthlyZTransactionIdsBySource(array $transactions): array
{
    $ids = ["cnc" => [], "report" => []];
    foreach ($transactions as $transaction) {
        $source = ($transaction["source"] ?? "") === "report"
            ? "report"
            : "cnc";
        $key = (string)($transaction["transactionKey"] ?? "");
        if ($key === "") {
            continue;
        }
        $ids[$source][$key] = $transaction["transactionId"];
    }

    return $ids;
}

function monthlyZFetchDiscountRows(
    PDO $pdo,
    string $databaseName,
    string $source,
    array $transactionIds,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber
): array {
    if ($transactionIds === []) {
        return [];
    }

    $table = monthlyZTable($databaseName, "tbl_pos_transactions_discounts");
    $transactionTable = monthlyZTable($databaseName, "tbl_pos_transactions");
    $rows = [];

    foreach (array_chunk(array_values($transactionIds), 400) as $chunk) {
        $placeholders = implode(", ", array_fill(0, count($chunk), "?"));
        $stmt = $pdo->prepare("
            SELECT
                CAST(d.transaction_id AS CHAR) AS transaction_key,
                d.discount_type,
                d.discount_amount,
                d.Status AS discount_status
            FROM {$table} d
            INNER JOIN {$transactionTable} t
              ON t.transaction_id = d.transaction_id
             AND t.Category_Code = d.Category_Code
             AND t.Unit_Code = d.Unit_Code
            WHERE d.Category_Code = ?
              AND d.Unit_Code = ?
              AND CAST(t.terminal_number AS CHAR) = ?
              AND d.transaction_id IN ({$placeholders})
        ");
        $stmt->execute(array_merge(
            [$categoryCode, $unitCode, $terminalNumber],
            $chunk
        ));

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $row["source"] = $source;
            $rows[] = $row;
        }
    }

    return $rows;
}

function monthlyZFetchPaymentRows(
    PDO $pdo,
    string $databaseName,
    string $source,
    array $transactionIds,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber
): array {
    if ($transactionIds === []) {
        return [];
    }

    $table = monthlyZTable($databaseName, "tbl_pos_transactions_payments");
    $transactionTable = monthlyZTable($databaseName, "tbl_pos_transactions");
    $rows = [];

    foreach (array_chunk(array_values($transactionIds), 400) as $chunk) {
        $placeholders = implode(", ", array_fill(0, count($chunk), "?"));
        $stmt = $pdo->prepare("
            SELECT
                CAST(p.transaction_id AS CHAR) AS transaction_key,
                p.payment_method,
                p.payment_amount
            FROM {$table} p
            INNER JOIN {$transactionTable} t
              ON t.transaction_id = p.transaction_id
             AND t.Category_Code = p.Category_Code
             AND t.Unit_Code = p.Unit_Code
            WHERE p.Category_Code = ?
              AND p.Unit_Code = ?
              AND CAST(t.terminal_number AS CHAR) = ?
              AND p.transaction_id IN ({$placeholders})
        ");
        $stmt->execute(array_merge(
            [$categoryCode, $unitCode, $terminalNumber],
            $chunk
        ));

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $row["source"] = $source;
            $rows[] = $row;
        }
    }

    return $rows;
}

function monthlyZFetchChildRows(
    PDO $pdo,
    string $mainDatabase,
    string $reportDatabase,
    array $transactions,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber
): array {
    $ids = monthlyZTransactionIdsBySource($transactions);
    $discounts = array_merge(
        monthlyZFetchDiscountRows(
            $pdo,
            $mainDatabase,
            "cnc",
            $ids["cnc"],
            $categoryCode,
            $unitCode,
            $terminalNumber
        ),
        monthlyZFetchDiscountRows(
            $pdo,
            $reportDatabase,
            "report",
            $ids["report"],
            $categoryCode,
            $unitCode,
            $terminalNumber
        )
    );
    $payments = array_merge(
        monthlyZFetchPaymentRows(
            $pdo,
            $mainDatabase,
            "cnc",
            $ids["cnc"],
            $categoryCode,
            $unitCode,
            $terminalNumber
        ),
        monthlyZFetchPaymentRows(
            $pdo,
            $reportDatabase,
            "report",
            $ids["report"],
            $categoryCode,
            $unitCode,
            $terminalNumber
        )
    );

    return ["discounts" => $discounts, "payments" => $payments];
}

function monthlyZStatusIs($value, string $expected): bool
{
    return strcasecmp(trim((string)$value), $expected) === 0;
}

function monthlyZSourceTransactionKey(string $source, $transactionKey): string
{
    return $source . "\0" . (string)$transactionKey;
}

function monthlyZCoverageForMain(array $transactions, array $shifts): array
{
    return [
        "databaseScope" => "cnc",
        "totalTransactions" => count($transactions),
        "mainTransactions" => count($transactions),
        "reportTransactions" => 0,
        "mainFallbackTransactions" => 0,
        "fallbackDates" => [],
        "totalClosedShifts" => count($shifts),
        "reportShifts" => 0,
        "mainFallbackShifts" => 0,
        "fallbackShiftDates" => [],
        "accumulatedSalesBasis" =>
            "Active Main DB transactions through the last closed shift",
    ];
}

function monthlyZCoverageForReport(
    array $transactions,
    array $shifts,
    int $skippedSourceTransactions
): array {
    return [
        "databaseScope" => "report",
        "computationMode" =>
            "Raw Report DB; configured skipped transactions remain excluded",
        "totalTransactions" => count($transactions),
        "reportTransactions" => count($transactions),
        "skippedSourceTransactions" => max(0, $skippedSourceTransactions),
        "mainFallbackTransactions" => 0,
        "fallbackDates" => [],
        "totalClosedShifts" => count($shifts),
        "reportShifts" => count($shifts),
        "mainFallbackShifts" => 0,
        "fallbackShiftDates" => [],
        "accumulatedSalesBasis" =>
            "Active Report DB transactions through the last closed shift",
    ];
}

function monthlyZCoverageForEffective(
    array $transactionResult,
    array $shiftResult
): array {
    return [
        "databaseScope" => "report",
        "totalTransactions" => count($transactionResult["transactions"] ?? []),
        "reportTransactions" => (int)($transactionResult["reportTransactionCount"] ?? 0),
        "reportOnlyTransactions" => (int)($transactionResult["reportOnlyTransactionCount"] ?? 0),
        "mainFallbackTransactions" => (int)($transactionResult["mainFallbackTransactionCount"] ?? 0),
        "fallbackReasons" => $transactionResult["fallbackReasons"] ?? [],
        "fallbackDates" => $transactionResult["fallbackDates"] ?? [],
        "totalClosedShifts" => count($shiftResult["shifts"] ?? []),
        "reportShifts" => (int)($shiftResult["reportShiftCount"] ?? 0),
        "mainFallbackShifts" => (int)($shiftResult["mainFallbackShiftCount"] ?? 0),
        "fallbackShiftDates" => $shiftResult["fallbackShiftDates"] ?? [],
        "archivePolicy" =>
            "Preserve closed Report DB history; use Main DB for missing report data",
        "accumulatedSalesBasis" =>
            "Official Grand_Accum_Sales from the selected closing shift",
    ];
}

function monthlyZComputePayload(
    array $transactions,
    array $discountRows,
    array $paymentRows,
    array $shifts,
    array $businessUnit,
    array $request,
    array $sourceMeta,
    array $coverage
): array {
    if ($shifts === []) {
        throw new MonthlyZReadingNoDataException(
            "No closed Z-reading shifts were found for the selected date range."
        );
    }

    $firstShift = $shifts[0];
    $lastShift = $shifts[count($shifts) - 1];

    $sales = [
        "salesForPeriod" => 0.0,
        "vatableSales" => 0.0,
        "vatAmount" => 0.0,
        "vatExemptSales" => 0.0,
        "vatExemptVat" => 0.0,
        "zeroRatedSales" => 0.0,
        "grossAmount" => 0.0,
        "discount" => 0.0,
        "otherCharges" => 0.0,
        "voidedSales" => 0.0,
        "refundedSales" => 0.0,
    ];
    $transactionByKey = [];

    foreach ($transactions as $transaction) {
        $source = ($transaction["source"] ?? "") === "report"
            ? "report"
            : "cnc";
        $transactionKey = (string)($transaction["transactionKey"] ?? "");
        if ($transactionKey !== "") {
            $transactionByKey[
                monthlyZSourceTransactionKey($source, $transactionKey)
            ] = $transaction;
        }

        if (monthlyZStatusIs($transaction["status"] ?? "", "Active")) {
            $sales["salesForPeriod"] += (float)$transaction["totalSales"];
            $sales["vatableSales"] += (float)$transaction["vatableSales"];
            $sales["vatAmount"] += (float)$transaction["vatAmount"];
            $sales["vatExemptSales"] += (float)$transaction["vatExemptSales"];
            $sales["vatExemptVat"] += (float)$transaction["vatExemptVat"];
            $sales["zeroRatedSales"] += (float)$transaction["zeroRatedSales"];
            $sales["grossAmount"] += (float)$transaction["totalSales"];
            $sales["discount"] += (float)$transaction["discount"];
            $sales["otherCharges"] += (float)$transaction["otherCharges"];
        } elseif (monthlyZStatusIs($transaction["status"] ?? "", "Voided")) {
            $sales["voidedSales"] += (float)$transaction["totalAmountDue"];
        } elseif (monthlyZStatusIs($transaction["status"] ?? "", "Refunded")) {
            $sales["refundedSales"] += (float)$transaction["totalAmountDue"];
        }
    }

    $discounts = [
        "Senior Citizen" => 0.0,
        "PWD" => 0.0,
        "NAAC" => 0.0,
        "Solo Parent" => 0.0,
        "Other" => 0.0,
    ];
    foreach ($discountRows as $discountRow) {
        $source = ($discountRow["source"] ?? "") === "report"
            ? "report"
            : "cnc";
        $transactionKey = monthlyZSourceTransactionKey(
            $source,
            $discountRow["transaction_key"] ?? ""
        );
        $parent = $transactionByKey[$transactionKey] ?? null;
        if (!is_array($parent) || !monthlyZStatusIs(
            $parent["status"] ?? "",
            "Active"
        )) {
            continue;
        }

        if (!monthlyZStatusIs(
            $discountRow["discount_status"] ?? "",
            "Active"
        )) {
            continue;
        }

        $discountType = trim((string)($discountRow["discount_type"] ?? ""));
        $amount = (float)($discountRow["discount_amount"] ?? 0);
        if (array_key_exists($discountType, $discounts) && $discountType !== "Other") {
            $discounts[$discountType] += $amount;
        } else {
            $discounts["Other"] += $amount;
        }
    }

    $payments = [
        "Cash" => 0.0,
        "Cheque" => 0.0,
        "Credit Card" => 0.0,
        "Other" => 0.0,
    ];
    $cashChangeApplied = [];
    foreach ($paymentRows as $paymentRow) {
        $source = ($paymentRow["source"] ?? "") === "report"
            ? "report"
            : "cnc";
        $transactionKey = monthlyZSourceTransactionKey(
            $source,
            $paymentRow["transaction_key"] ?? ""
        );
        $parent = $transactionByKey[$transactionKey] ?? null;
        if (!is_array($parent) || !monthlyZStatusIs($parent["status"] ?? "", "Active")) {
            continue;
        }

        $method = trim((string)($paymentRow["payment_method"] ?? ""));
        $amount = (float)($paymentRow["payment_amount"] ?? 0);
        if ($method === "Cash") {
            $payments["Cash"] += $amount;
            if (!isset($cashChangeApplied[$transactionKey])) {
                $payments["Cash"] -= (float)($parent["changeAmount"] ?? 0);
                $cashChangeApplied[$transactionKey] = true;
            }
        } elseif ($method === "Cheque") {
            $payments["Cheque"] += $amount;
        } elseif ($method === "Credit Card") {
            $payments["Credit Card"] += $amount;
        } else {
            $payments["Other"] += $amount;
        }
    }

    $presentAccumulatedSales = array_key_exists(
        "presentAccumulatedSales",
        $sourceMeta
    )
        ? (float)$sourceMeta["presentAccumulatedSales"]
        : (float)($lastShift["Grand_Accum_Sales"] ?? 0);
    $salesForPeriod = $sales["salesForPeriod"];
    $previousAccumulatedSales = $presentAccumulatedSales - $salesForPeriod;
    $lessVatExemption = $sales["vatExemptVat"];
    $lessVatAdjustment = 0.0;
    $netAmount = $sales["grossAmount"]
        - $sales["discount"]
        - $lessVatExemption
        - $sales["refundedSales"]
        - $sales["voidedSales"]
        - $lessVatAdjustment;

    $cashInDrawer = (float)($lastShift["Closing_Cash_Count"] ?? 0);
    $openingFund = (float)($firstShift["Opening_Cash_Count"] ?? 0);
    $withdrawal = 0.0;
    $paymentsReceived = array_sum($payments);
    $shortOver = $cashInDrawer
        + $payments["Cheque"]
        + $payments["Credit Card"]
        + $payments["Other"]
        - $openingFund
        - $paymentsReceived;

    $vatRegistration = (string)($businessUnit["VAT_Registration"] ?? "");
    $businessTin = (string)($businessUnit["Unit_TIN"] ?? "");
    $tinLabel = strcasecmp($vatRegistration, "Non-VAT Registered") === 0
        ? "NON-VAT REG TIN: " . $businessTin
        : "VAT REG TIN: " . $businessTin;

    $firstZCounter = (int)($firstShift["Z_Counter_No"] ?? 0);
    $lastZCounter = (int)($lastShift["Z_Counter_No"] ?? 0);
    $zCounterRange = $firstZCounter === $lastZCounter
        ? (string)$firstZCounter
        : $firstZCounter . " - " . $lastZCounter;

    $dateFrom = (string)$request["dateFrom"];
    $dateTo = (string)$request["dateTo"];
    $developerPreview = (bool)($sourceMeta["developerPreview"] ?? false);

    return [
        "dateFrom" => $dateFrom,
        "dateTo" => $dateTo,
        "reportDate" => date("M d, Y", strtotime($dateFrom))
            . " - " . date("M d, Y", strtotime($dateTo)),
        "reportTime" => date("h:i A"),
        "startDateTime" => date(
            "m/d/y g:i A",
            strtotime((string)$firstShift["Opening_DateTime"])
        ),
        "endDateTime" => date(
            "m/d/y g:i A",
            strtotime((string)(
                $lastShift["Closing_DateTime"]
                ?: $lastShift["Opening_DateTime"]
            ))
        ),
        "reprintDateTime" => date("m/d/y h:i A"),

        "begSI" => (float)($firstShift["Beg_OR"] ?? 0),
        "endSI" => (float)($lastShift["End_OR"] ?? 0),
        "begInv" => (float)($firstShift["Beg_OR"] ?? 0),
        "endInv" => (float)($lastShift["End_OR"] ?? 0),
        "begVoid" => (float)($firstShift["Beg_VoidNo"] ?? 0),
        "endVoid" => (float)($lastShift["End_VoidNo"] ?? 0),
        "begReturn" => (float)($firstShift["Beg_RefundNo"] ?? 0),
        "endReturn" => (float)($lastShift["End_RefundNo"] ?? 0),
        "begRefund" => (float)($firstShift["Beg_RefundNo"] ?? 0),
        "endRefund" => (float)($lastShift["End_RefundNo"] ?? 0),
        "resetCounterNo" => 0,
        "resetCounter" => 0,
        "zCounterNo" => $zCounterRange,
        "zCounter" => $zCounterRange,

        "presentAccumulatedSales" => $presentAccumulatedSales,
        "previousAccumulatedSales" => $previousAccumulatedSales,
        "salesForTheDay" => $salesForPeriod,
        "salesForThePeriod" => $salesForPeriod,
        "presentSales" => $presentAccumulatedSales,
        "previousSales" => $previousAccumulatedSales,
        "dailySales" => $salesForPeriod,
        "periodSales" => $salesForPeriod,

        "vatableSales" => $sales["vatableSales"],
        "vatAmount" => $sales["vatAmount"],
        "vatExemptSales" => $sales["vatExemptSales"],
        "vatExemptVat" => $sales["vatExemptVat"],
        "vatExemption" => $sales["vatExemptVat"],
        "zeroRatedSales" => $sales["zeroRatedSales"],
        "zeroRated" => $sales["zeroRatedSales"],
        "otherCharges" => $sales["otherCharges"],

        "grossAmount" => $sales["grossAmount"],
        "lessDiscount" => $sales["discount"],
        "lessVatExemption" => $lessVatExemption,
        "lessReturn" => $sales["refundedSales"],
        "lessVoid" => $sales["voidedSales"],
        "lessVatAdjustment" => $lessVatAdjustment,
        "netAmount" => $netAmount,
        "gross" => $sales["grossAmount"],
        "discount" => $sales["discount"],
        "refund" => $sales["refundedSales"],
        "void" => $sales["voidedSales"],
        "vatAdjustment" => $lessVatAdjustment,
        "net" => $netAmount,

        "scDisc" => $discounts["Senior Citizen"],
        "pwdDisc" => $discounts["PWD"],
        "naacDisc" => $discounts["NAAC"],
        "soloParentDisc" => $discounts["Solo Parent"],
        "soloDisc" => $discounts["Solo Parent"],
        "otherDisc" => $discounts["Other"],
        "salesAdjustmentVoid" => $sales["voidedSales"],
        "salesAdjustmentReturn" => $sales["refundedSales"],

        "scTransVatAdj" => 0.0,
        "pwdTransVatAdj" => 0.0,
        "regDiscTransVatAdj" => 0.0,
        "zeroRatedTransVatAdj" => 0.0,
        "vatOnReturn" => 0.0,
        "otherVatAdjustments" => 0.0,
        "scTrans" => 0.0,
        "pwdTrans" => 0.0,
        "regDisc" => 0.0,
        "zeroRatedTrans" => 0.0,
        "otherVatAdj" => 0.0,

        "cashInDrawer" => $cashInDrawer,
        "cash" => $cashInDrawer,
        "cheque" => $payments["Cheque"],
        "creditCard" => $payments["Credit Card"],
        "otherPayments" => $payments["Other"],
        "openingFund" => $openingFund,
        "lessWithdrawal" => $withdrawal,
        "withdrawal" => $withdrawal,
        "paymentsReceived" => $paymentsReceived,
        "shortOver" => $shortOver,

        "corpName" => (string)($businessUnit["Corp_Code"] ?? ""),
        "businessUnitName" => (string)($businessUnit["Unit_Name"] ?? ""),
        "businessUnitAddress" => (string)($businessUnit["Unit_Address"] ?? ""),
        "businessUnitTIN" => $businessTin,
        "businessUnitVATRegistration" => $vatRegistration,
        "tinLabel" => $tinLabel,
        "machineNumber" => (string)($request["machineNumber"] ?? ""),
        "serialNumber" => (string)($request["serialNumber"] ?? ""),
        "terminalNumber" => (string)$request["terminalNumber"],
        "ptuNumber" => (string)($request["ptuNumber"] ?? ""),
        "ptuDateIssued" => (string)($request["ptuDateIssued"] ?? ""),

        "readingDatabaseScope" => (string)$sourceMeta["scope"],
        "readingDatabase" => (string)$sourceMeta["databaseName"],
        "sourceDatabaseLabel" => (string)$sourceMeta["label"],
        "readingSourceLabel" => (string)$sourceMeta["label"],
        "developerPreview" => $developerPreview,
        "nonFiscalPreview" => $developerPreview,
        "readOnly" => true,
        "closeShift" => false,
        "monthlyReading" => true,
        "isMonthlyReading" => true,
        "coverage" => $coverage,
    ];
}

function monthlyZBuildDatabaseComparison(
    PDO $pdo,
    array $config,
    string $dateFrom,
    string $dateTo,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    array $request
): array {
    $mainDatabase = monthlyZRequireIdentifier(
        $config["db"] ?? "db_cnc_pos",
        "main database name"
    );
    $reportDatabase = monthlyZRequireIdentifier(
        $config["report_db"] ?? $mainDatabase,
        "report database name"
    );

    $mainBusinessUnit = monthlyZFetchBusinessUnit(
        $pdo,
        $mainDatabase,
        $categoryCode,
        $unitCode
    );
    $reportBusinessUnit = monthlyZFetchBusinessUnit(
        $pdo,
        $reportDatabase,
        $categoryCode,
        $unitCode
    );
    $canonicalBusinessUnit = $reportBusinessUnit ?? $mainBusinessUnit;
    if (!is_array($canonicalBusinessUnit)) {
        throw new MonthlyZReadingNoDataException("Business unit not found.");
    }

    $mainShifts = monthlyZFetchShifts(
        $pdo,
        $mainDatabase,
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo
    );
    $reportShifts = monthlyZFetchShifts(
        $pdo,
        $reportDatabase,
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo
    );

    $effectiveShifts = monthlyZReconcileShifts($mainShifts, $reportShifts);
    $effectiveTransactions = monthlyZFetchEffectiveTransactions(
        $pdo,
        $mainDatabase,
        $reportDatabase,
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo
    );
    $effectiveTransactions = monthlyZFilterEffectiveTransactionsByShifts(
        $effectiveTransactions,
        $effectiveShifts["shifts"]
    );

    $reportClosedDates = monthlyZClosedShiftDates($reportShifts);
    $skippedSourceTransactions = 0;
    foreach ($effectiveTransactions["transactions"] as $transaction) {
        $transactionDate = substr(
            (string)($transaction["transactionDate"] ?? ""),
            0,
            10
        );
        if (
            ($transaction["fallbackReason"] ?? "") === "skipped" &&
            isset($reportClosedDates[$transactionDate])
        ) {
            $skippedSourceTransactions += 1;
        }
    }

    $mainLabel = "Main Database (Complete Computation)";
    $reportLabel = "Report Database (Skipped Transactions)";
    $mainCoverage = monthlyZCoverageForMain([], $mainShifts);
    $reportCoverage = monthlyZCoverageForReport(
        [],
        $reportShifts,
        $skippedSourceTransactions
    );
    $mainPayload = null;
    $reportPayload = null;
    $mainError = "";
    $reportError = "";

    try {
        $mainTransactions = monthlyZFetchMainTransactions(
            $pdo,
            $mainDatabase,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            $dateFrom,
            $dateTo
        );
        $mainTransactions = monthlyZFilterTransactionsByShifts(
            $mainTransactions,
            $mainShifts
        );
        $mainCoverage = monthlyZCoverageForMain(
            $mainTransactions,
            $mainShifts
        );
        $mainChildren = monthlyZFetchChildRows(
            $pdo,
            $mainDatabase,
            $reportDatabase,
            $mainTransactions,
            $categoryCode,
            $unitCode,
            $terminalNumber
        );
        $mainAccumulatedSales = monthlyZFetchSourceAccumulatedSales(
            $pdo,
            $mainDatabase,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            $mainShifts
        );
        $mainPayload = monthlyZComputePayload(
            $mainTransactions,
            $mainChildren["discounts"],
            $mainChildren["payments"],
            $mainShifts,
            $mainBusinessUnit ?? $canonicalBusinessUnit,
            $request,
            [
                "scope" => "cnc",
                "databaseName" => $mainDatabase,
                "label" => $mainLabel,
                "developerPreview" => true,
                "presentAccumulatedSales" => $mainAccumulatedSales,
            ],
            $mainCoverage
        );
    } catch (MonthlyZReadingNoDataException $exception) {
        $mainError = $exception->getMessage();
    }

    try {
        $reportTransactions = monthlyZFetchReportTransactions(
            $pdo,
            $reportDatabase,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            $dateFrom,
            $dateTo,
            false
        );
        $reportTransactions = monthlyZFilterTransactionsByShifts(
            $reportTransactions,
            $reportShifts
        );
        $reportCoverage = monthlyZCoverageForReport(
            $reportTransactions,
            $reportShifts,
            $skippedSourceTransactions
        );
        $reportChildren = monthlyZFetchChildRows(
            $pdo,
            $mainDatabase,
            $reportDatabase,
            $reportTransactions,
            $categoryCode,
            $unitCode,
            $terminalNumber
        );
        $reportAccumulatedSales = monthlyZFetchSourceAccumulatedSales(
            $pdo,
            $reportDatabase,
            $categoryCode,
            $unitCode,
            $terminalNumber,
            $reportShifts
        );
        $reportPayload = monthlyZComputePayload(
            $reportTransactions,
            $reportChildren["discounts"],
            $reportChildren["payments"],
            $reportShifts,
            $reportBusinessUnit ?? $canonicalBusinessUnit,
            $request,
            [
                "scope" => "report",
                "databaseName" => $reportDatabase,
                "label" => $reportLabel,
                "developerPreview" => true,
                "presentAccumulatedSales" => $reportAccumulatedSales,
            ],
            $reportCoverage
        );
    } catch (MonthlyZReadingNoDataException $exception) {
        $reportError = $exception->getMessage();
    }

    if ($mainPayload === null && $reportPayload === null) {
        throw new MonthlyZReadingNoDataException(
            $mainError ?: ($reportError ?: "No monthly Z-reading data found.")
        );
    }

    return [
        "developerPreview" => true,
        "nonFiscalPreview" => true,
        "readOnly" => true,
        "readings" => [
            monthlyZReadingEntry(
                "cnc",
                $mainLabel,
                $mainPayload,
                $mainCoverage,
                $mainError
            ),
            monthlyZReadingEntry(
                "report",
                $reportLabel,
                $reportPayload,
                $reportCoverage,
                $reportError
            ),
        ],
    ];
}
