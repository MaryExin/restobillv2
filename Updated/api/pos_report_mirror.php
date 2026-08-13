<?php

declare(strict_types=1);

const POS_REPORT_MIRROR_SETTINGS_CATEGORY = "Report";
const POS_REPORT_MIRROR_SKIP_INTERVAL_DESCRIPTION = "Report DB Skip Transaction Interval";
const POS_REPORT_MIRROR_DEFAULT_SKIP_INTERVAL = 3;

function posReportMirrorIdentifier($value, string $label): string
{
    $identifier = trim((string)$value);

    if ($identifier === "" || !preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        throw new InvalidArgumentException("Invalid {$label} configured.");
    }

    return $identifier;
}

function posReportMirrorQuote(string $identifier): string
{
    return "`" . str_replace("`", "``", $identifier) . "`";
}

function posReportMirrorTable(string $databaseName, string $tableName): string
{
    return posReportMirrorQuote($databaseName) . "." . posReportMirrorQuote($tableName);
}

function posReportMirrorNormalizeSkipInterval($value): int
{
    $value = trim((string)($value ?? ""));

    if ($value === "" || !preg_match('/^-?\d+$/', $value)) {
        return POS_REPORT_MIRROR_DEFAULT_SKIP_INTERVAL;
    }

    $skipInterval = (int)$value;

    if ($skipInterval <= 0) {
        return 0;
    }

    return max(2, min($skipInterval, 1000000));
}

function posReportMirrorFetchSkipIntervalFromSettings(PDO $pdo, string $databaseName): ?int
{
    try {
        $settingsTable = posReportMirrorTable($databaseName, "tbl_pos_settings");
        $stmt = $pdo->prepare("
            SELECT `value`
            FROM {$settingsTable}
            WHERE `category` = ?
              AND `description` = ?
            ORDER BY `ID` DESC
            LIMIT 1
        ");
        $stmt->execute([
            POS_REPORT_MIRROR_SETTINGS_CATEGORY,
            POS_REPORT_MIRROR_SKIP_INTERVAL_DESCRIPTION,
        ]);
        $value = $stmt->fetchColumn();

        return $value === false || $value === null
            ? null
            : posReportMirrorNormalizeSkipInterval($value);
    } catch (Throwable $e) {
        return null;
    }
}

function posReportMirrorGetSkipInterval(PDO $pdo, string $posDbName, ?string $reportDbName = null): int
{
    $databaseNames = [];

    if ($reportDbName !== null && trim($reportDbName) !== "") {
        $databaseNames[] = $reportDbName;
    }

    $databaseNames[] = $posDbName;

    foreach (array_unique($databaseNames) as $databaseName) {
        $skipInterval = posReportMirrorFetchSkipIntervalFromSettings($pdo, $databaseName);

        if ($skipInterval !== null) {
            return $skipInterval;
        }
    }

    return POS_REPORT_MIRROR_DEFAULT_SKIP_INTERVAL;
}

function posReportMirrorShouldSkipSourceRank(int $sourceRank, int $skipInterval): bool
{
    return $sourceRank > 0 && $skipInterval > 0 && $sourceRank % $skipInterval === 0;
}

function posReportMirrorServiceTypeMustPost($serviceType): bool
{
    $normalizedServiceType = strtoupper(trim((string)($serviceType ?? "")));

    return in_array($normalizedServiceType, ["FOOD PANDA", "GRAB"], true);
}

function posReportMirrorShouldSkipTransaction(
    array $mapRow,
    int $sourceRank,
    int $skipInterval,
    $serviceType
): bool {
    // Food-delivery marketplace sales must always be represented in the report
    // database, even when their source rank lands on the configured interval or
    // an earlier mirror attempt stored them as skipped.
    if (posReportMirrorServiceTypeMustPost($serviceType)) {
        return false;
    }

    $existingReportStatus = trim((string)($mapRow["report_status"] ?? ""));

    return in_array($existingReportStatus, ["0", "1"], true)
        ? $existingReportStatus === "1"
        : posReportMirrorShouldSkipSourceRank($sourceRank, $skipInterval);
}

/**
 * Existing map rows are the enrollment marker for report mirroring. Normal
 * runtime enrollment comes only from transaction creation after the immutable
 * skipping activation boundary. Historical transactions remain unmapped.
 */
function posReportMirrorCanProcessSource(array $mapRow, bool $allowNewEnrollment): bool
{
    return $allowNewEnrollment || count($mapRow) > 0;
}

function posReportMirrorColumnList(array $columns): string
{
    return implode(", ", array_map("posReportMirrorQuote", $columns));
}

function posReportMirrorColumnReference(string $column, string $tableAlias = ""): string
{
    $quotedColumn = posReportMirrorQuote($column);
    $tableAlias = trim($tableAlias);

    if ($tableAlias === "") {
        return $quotedColumn;
    }

    return posReportMirrorQuote(
        posReportMirrorIdentifier($tableAlias, "SQL table alias")
    ) . "." . $quotedColumn;
}

function posReportMirrorSelectColumnList(array $columns, array $overrides = []): string
{
    $parts = [];

    foreach ($columns as $column) {
        $quotedColumn = posReportMirrorQuote($column);
        $parts[] = array_key_exists($column, $overrides)
            ? "? AS {$quotedColumn}"
            : $quotedColumn;
    }

    return implode(", ", $parts);
}

function posReportMirrorOverrideParams(array $columns, array $overrides = []): array
{
    $params = [];

    foreach ($columns as $column) {
        if (array_key_exists($column, $overrides)) {
            $params[] = $overrides[$column];
        }
    }

    return $params;
}

function posReportMirrorTargetChildTables(): array
{
    return [
        [
            "table" => "tbl_pos_transactions_detailed",
            "key_column" => "ID",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_payments",
            "key_column" => "ID",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_discounts",
            "key_column" => "id",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_other_charges",
            "key_column" => "ID",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_customers",
            "key_column" => "ID",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_discounts_per_product",
            "key_column" => "id",
            "category_column" => "category_code",
            "unit_column" => "unit_code",
        ],
        [
            "table" => "tbl_pos_loyalty_discounts",
            "key_column" => "id",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
    ];
}

function posReportMirrorScopedWhere(
    string $transactionId,
    string $categoryCode,
    string $unitCode,
    string $transactionColumn = "transaction_id",
    string $categoryColumn = "Category_Code",
    string $unitColumn = "Unit_Code",
    string $tableAlias = ""
): array {
    $clauses = [
        posReportMirrorColumnReference($transactionColumn, $tableAlias) . " = ?",
    ];
    $params = [$transactionId];

    if ($categoryCode !== "") {
        $clauses[] = posReportMirrorColumnReference($categoryColumn, $tableAlias) . " = ?";
        $params[] = $categoryCode;
    }

    if ($unitCode !== "") {
        $clauses[] = posReportMirrorColumnReference($unitColumn, $tableAlias) . " = ?";
        $params[] = $unitCode;
    }

    return [implode(" AND ", $clauses), $params];
}

function posReportMirrorReplaceRows(
    PDO $pdo,
    string $sourceTable,
    string $targetTable,
    array $columns,
    string $whereSql,
    array $whereParams,
    array $selectOverrides = []
): void {
    $columnList = posReportMirrorColumnList($columns);
    $selectColumnList = posReportMirrorSelectColumnList($columns, $selectOverrides);
    $params = array_merge(
        posReportMirrorOverrideParams($columns, $selectOverrides),
        $whereParams
    );

    $stmt = $pdo->prepare("
        REPLACE INTO {$targetTable} ({$columnList})
        SELECT {$selectColumnList}
        FROM {$sourceTable}
        WHERE {$whereSql}
    ");
    $stmt->execute($params);
}

function posReportMirrorUpdateThenInsertRows(
    PDO $pdo,
    string $sourceTable,
    string $targetTable,
    array $columns,
    string $sourceWhereSql,
    array $sourceWhereParams,
    string $targetWhereSql,
    array $targetWhereParams,
    array $selectOverrides = []
): void {
    $sourceAlias = "mirror_source";
    $targetAlias = "mirror_target";
    $quotedSourceAlias = posReportMirrorQuote($sourceAlias);
    $quotedTargetAlias = posReportMirrorQuote($targetAlias);
    $columnList = posReportMirrorColumnList($columns);
    $selectColumnList = posReportMirrorSelectColumnList($columns, $selectOverrides);
    $sourceParams = array_merge(
        posReportMirrorOverrideParams($columns, $selectOverrides),
        $sourceWhereParams
    );
    $updateAssignments = [];

    foreach ($columns as $column) {
        $updateAssignments[] =
            posReportMirrorColumnReference($column, $targetAlias) .
            " = " .
            posReportMirrorColumnReference($column, $sourceAlias);
    }

    $updateStmt = $pdo->prepare("
        UPDATE {$targetTable} AS {$quotedTargetAlias}
        INNER JOIN (
            SELECT {$selectColumnList}
            FROM {$sourceTable}
            WHERE {$sourceWhereSql}
        ) AS {$quotedSourceAlias}
        SET " . implode(", ", $updateAssignments) . "
        WHERE {$targetWhereSql}
    ");
    $updateStmt->execute(array_merge($sourceParams, $targetWhereParams));

    // Do not execute an INSERT at all for an existing report row. Even an
    // A duplicate-key upsert still reserves an AUTO_INCREMENT value and creates
    // the visible ID gaps this writer avoids.
    $existsStmt = $pdo->prepare("
        SELECT 1
        FROM {$targetTable} AS {$quotedTargetAlias}
        WHERE {$targetWhereSql}
        LIMIT 1
    ");
    $existsStmt->execute($targetWhereParams);

    if ($existsStmt->fetchColumn() !== false) {
        return;
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO {$targetTable} ({$columnList})
        SELECT {$selectColumnList}
        FROM {$sourceTable}
        WHERE {$sourceWhereSql}
    ");
    $insertStmt->execute($sourceParams);
}

function posReportMirrorDeleteRows(PDO $pdo, string $targetTable, string $whereSql, array $whereParams): void
{
    $stmt = $pdo->prepare("DELETE FROM {$targetTable} WHERE {$whereSql}");
    $stmt->execute($whereParams);
}

function posReportMirrorReplaceChildRows(
    PDO $pdo,
    string $sourceTable,
    string $targetTable,
    array $columns,
    string $targetWhereSql,
    array $targetWhereParams,
    string $sourceWhereSql,
    array $sourceWhereParams,
    array $selectOverrides = []
): void {
    posReportMirrorDeleteRows($pdo, $targetTable, $targetWhereSql, $targetWhereParams);

    posReportMirrorReplaceRows(
        $pdo,
        $sourceTable,
        $targetTable,
        $columns,
        $sourceWhereSql,
        $sourceWhereParams,
        $selectOverrides
    );
}

function posReportMirrorGetSourceTransactionRank(
    PDO $pdo,
    string $posDbName,
    string $sourceId
): int {
    $sourceMainTable = posReportMirrorTable($posDbName, "tbl_pos_transactions");

    if ($sourceId === "") {
        return 0;
    }

    $rankStmt = $pdo->prepare("SELECT COUNT(*) FROM {$sourceMainTable} WHERE `ID` <= ?");
    $rankStmt->execute([$sourceId]);

    return (int)$rankStmt->fetchColumn();
}

function posReportMirrorShouldPostTransactionToReport(
    PDO $pdo,
    string $posDbName,
    string $sourceId,
    ?string $reportDbName = null
): bool {
    $transactionRank = posReportMirrorGetSourceTransactionRank($pdo, $posDbName, $sourceId);
    $skipInterval = posReportMirrorGetSkipInterval($pdo, $posDbName, $reportDbName);

    return !posReportMirrorShouldSkipSourceRank($transactionRank, $skipInterval);
}

function posReportMirrorFetchSourceTransaction(
    PDO $pdo,
    string $posDbName,
    string $transactionId,
    string $categoryCode,
    string $unitCode
): array {
    $sourceMainTable = posReportMirrorTable($posDbName, "tbl_pos_transactions");
    [$whereSql, $whereParams] = posReportMirrorScopedWhere($transactionId, $categoryCode, $unitCode);

    $stmt = $pdo->prepare("
        SELECT
            CAST(`ID` AS CHAR) AS ID,
            CAST(`transaction_id` AS CHAR) AS transaction_id,
            CAST(`order_slip_no` AS CHAR) AS order_slip_no,
            CAST(`invoice_no` AS CHAR) AS invoice_no,
            CAST(`order_type` AS CHAR) AS order_type,
            CAST(`Category_Code` AS CHAR) AS Category_Code,
            CAST(`Unit_Code` AS CHAR) AS Unit_Code
        FROM {$sourceMainTable}
        WHERE {$whereSql}
        ORDER BY `ID`
        LIMIT 1
    ");
    $stmt->execute($whereParams);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        throw new RuntimeException("Source POS transaction not found for report mirror.");
    }

    return $row;
}

function posReportMirrorNextTransactionId($value): string
{
    $numericValue = trim((string)$value);

    if ($numericValue === "") {
        return "";
    }

    return (string)(((int)$numericValue) + 1);
}

function posReportMirrorGenerateToken(int $length = 24): string
{
    $alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    $token = "";
    $maxIndex = strlen($alphabet) - 1;

    for ($index = 0; $index < $length; $index++) {
        $token .= $alphabet[random_int(0, $maxIndex)];
    }

    return $token;
}

function posReportMirrorEnsureMapToken(
    PDO $pdo,
    string $reportDbName,
    string $sourceId,
    string $sourceTransactionId,
    string $categoryCode,
    string $unitCode
): string {
    $mapRow = posReportMirrorFetchReportMapBySource(
        $pdo,
        $reportDbName,
        $sourceId,
        $sourceTransactionId,
        $categoryCode,
        $unitCode
    );
    $existingToken = trim((string)($mapRow["token_report"] ?? ""));

    if ($existingToken !== "") {
        return $existingToken;
    }

    for ($attempt = 0; $attempt < 12; $attempt++) {
        $token = posReportMirrorGenerateToken();

        if (posReportMirrorMapTokenExists($pdo, $reportDbName, $token)) {
            continue;
        }

        return $token;
    }

    throw new RuntimeException("Unable to create report map token for POS transaction.");
}

function posReportMirrorMapTable(string $reportDbName): string
{
    return posReportMirrorTable($reportDbName, "tbl_pos_report_transaction_map");
}

/**
 * The activation columns and scoped report-header unique key are required by
 * every map read/write after the activation-boundary release. The scoped key
 * protects the update-then-insert writer from concurrent duplicate headers.
 * Cache the result for the current PHP request so save_order's activation
 * claim and mirror do not repeat this lookup.
 */
function posReportMirrorMapActivationMembershipReady(PDO $pdo, string $reportDbName): bool
{
    static $readiness = [];

    $cacheKey = spl_object_id($pdo) . "|" . strtolower($reportDbName);
    if (array_key_exists($cacheKey, $readiness)) {
        return $readiness[$cacheKey];
    }

    try {
        $stmt = $pdo->prepare("
            SELECT CASE
                WHEN (
                    SELECT COUNT(DISTINCT TABLE_NAME)
                    FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = ?
                      AND TABLE_NAME IN (
                          'tbl_pos_report_transaction_map',
                          'tbl_pos_report_mirror_activation'
                      )
                ) = 2
                AND (
                    SELECT COUNT(DISTINCT COLUMN_NAME)
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = ?
                      AND TABLE_NAME = 'tbl_pos_report_transaction_map'
                      AND COLUMN_NAME IN ('activation_key', 'activation_sequence')
                ) = 2
                AND (
                    SELECT COUNT(*)
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = ?
                      AND TABLE_NAME = 'tbl_pos_report_transaction_map'
                      AND INDEX_NAME = 'ux_pos_report_map_activation_sequence'
                      AND NON_UNIQUE = 0
                      AND (
                            (SEQ_IN_INDEX = 1 AND COLUMN_NAME = 'activation_key')
                         OR (SEQ_IN_INDEX = 2 AND COLUMN_NAME = 'activation_sequence')
                      )
                ) = 2
                AND (
                    SELECT CASE
                        WHEN COUNT(*) = 3
                         AND SUM(CASE
                            WHEN (SEQ_IN_INDEX = 1 AND COLUMN_NAME = 'transaction_id')
                              OR (SEQ_IN_INDEX = 2 AND COLUMN_NAME = 'Category_Code')
                              OR (SEQ_IN_INDEX = 3 AND COLUMN_NAME = 'Unit_Code')
                            THEN 1
                            ELSE 0
                         END) = 3
                        THEN 1
                        ELSE 0
                    END
                    FROM information_schema.STATISTICS
                    WHERE TABLE_SCHEMA = ?
                      AND TABLE_NAME = 'tbl_pos_transactions'
                      AND INDEX_NAME = 'ux_pos_transactions_report_txn_scope'
                      AND NON_UNIQUE = 0
                ) = 1
                THEN 1
                ELSE 0
            END
        ");
        $stmt->execute([
            $reportDbName,
            $reportDbName,
            $reportDbName,
            $reportDbName,
        ]);
        $readiness[$cacheKey] = (int)$stmt->fetchColumn() === 1;
    } catch (Throwable $error) {
        error_log(
            "Unable to verify POS report mirror schema: " .
            $error->getMessage()
        );
        $readiness[$cacheKey] = false;
    }

    return $readiness[$cacheKey];
}

function posReportMirrorMapTokenExists(PDO $pdo, string $reportDbName, string $token): bool
{
    $mapTable = posReportMirrorMapTable($reportDbName);
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM {$mapTable} WHERE `token_report` = ?");
    $stmt->execute([$token]);

    return (int)$stmt->fetchColumn() > 0;
}

function posReportMirrorFetchReportMapByToken(
    PDO $pdo,
    string $reportDbName,
    string $tokenReport
): array {
    if ($tokenReport === "") {
        return [];
    }

    $mapTable = posReportMirrorMapTable($reportDbName);
    $stmt = $pdo->prepare("
        SELECT
            CAST(`id` AS CHAR) AS id,
            CAST(`token_report` AS CHAR) AS token_report,
            CAST(`source_pos_id` AS CHAR) AS source_pos_id,
            CAST(`source_rank` AS CHAR) AS source_rank,
            CAST(`activation_key` AS CHAR) AS activation_key,
            CAST(`activation_sequence` AS CHAR) AS activation_sequence,
            CAST(`source_transaction_id` AS CHAR) AS source_transaction_id,
            CAST(`source_order_slip_no` AS CHAR) AS source_order_slip_no,
            CAST(`source_invoice_no` AS CHAR) AS source_invoice_no,
            CAST(`report_transaction_id` AS CHAR) AS report_transaction_id,
            CAST(`report_order_slip_no` AS CHAR) AS report_order_slip_no,
            CAST(`report_invoice_no` AS CHAR) AS report_invoice_no,
            CAST(`Category_Code` AS CHAR) AS Category_Code,
            CAST(`Unit_Code` AS CHAR) AS Unit_Code,
            CAST(`report_status` AS CHAR) AS report_status
        FROM {$mapTable}
        WHERE `token_report` = ?
        LIMIT 1
    ");
    $stmt->execute([$tokenReport]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: [];
}

function posReportMirrorFetchReportMapBySource(
    PDO $pdo,
    string $reportDbName,
    string $sourceId,
    string $sourceTransactionId,
    string $categoryCode,
    string $unitCode
): array {
    $mapTable = posReportMirrorMapTable($reportDbName);
    $stmt = $pdo->prepare("
        SELECT
            CAST(`id` AS CHAR) AS id,
            CAST(`token_report` AS CHAR) AS token_report,
            CAST(`source_pos_id` AS CHAR) AS source_pos_id,
            CAST(`source_rank` AS CHAR) AS source_rank,
            CAST(`activation_key` AS CHAR) AS activation_key,
            CAST(`activation_sequence` AS CHAR) AS activation_sequence,
            CAST(`source_transaction_id` AS CHAR) AS source_transaction_id,
            CAST(`source_order_slip_no` AS CHAR) AS source_order_slip_no,
            CAST(`source_invoice_no` AS CHAR) AS source_invoice_no,
            CAST(`report_transaction_id` AS CHAR) AS report_transaction_id,
            CAST(`report_order_slip_no` AS CHAR) AS report_order_slip_no,
            CAST(`report_invoice_no` AS CHAR) AS report_invoice_no,
            CAST(`Category_Code` AS CHAR) AS Category_Code,
            CAST(`Unit_Code` AS CHAR) AS Unit_Code,
            CAST(`report_status` AS CHAR) AS report_status
        FROM {$mapTable}
        WHERE `source_pos_id` = ?
           OR (
                `source_transaction_id` = ?
            AND `Category_Code` <=> ?
            AND `Unit_Code` <=> ?
           )
        ORDER BY CASE WHEN `source_pos_id` = ? THEN 0 ELSE 1 END
        LIMIT 1
    ");
    $stmt->execute([$sourceId, $sourceTransactionId, $categoryCode, $unitCode, $sourceId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: [];
}

function posReportMirrorMapValue(array $mapRow, string $columnName, bool $mustBePositive = false): string
{
    $value = trim((string)($mapRow[$columnName] ?? ""));

    if ($value === "") {
        return "";
    }

    if ($mustBePositive && (int)$value <= 0) {
        return "";
    }

    return $value;
}

function posReportMirrorFindReportTransactionIdByMap(
    PDO $pdo,
    string $reportDbName,
    string $tokenReport
): string {
    $mapRow = posReportMirrorFetchReportMapByToken($pdo, $reportDbName, $tokenReport);

    return posReportMirrorMapValue($mapRow, "report_transaction_id");
}

function posReportMirrorNextMappedReportValue(
    PDO $pdo,
    string $reportDbName,
    string $mapColumnName,
    string $reportColumnName,
    string $sourceValue
): string {
    $sourceValue = trim($sourceValue);

    if ($sourceValue === "") {
        return "";
    }

    $mapTable = posReportMirrorMapTable($reportDbName);
    $targetMainTable = posReportMirrorTable($reportDbName, "tbl_pos_transactions");
    $quotedMapColumn = posReportMirrorQuote(posReportMirrorIdentifier($mapColumnName, "report map column name"));
    $quotedReportColumn = posReportMirrorQuote(posReportMirrorIdentifier($reportColumnName, "report column name"));
    $stmt = $pdo->query("
        SELECT CAST(GREATEST(
            COALESCE((
                SELECT MAX(CAST({$quotedMapColumn} AS UNSIGNED))
                FROM {$mapTable}
                WHERE {$quotedMapColumn} > 0
            ), 0),
            COALESCE((
                SELECT MAX(CAST({$quotedReportColumn} AS UNSIGNED))
                FROM {$targetMainTable}
                WHERE {$quotedReportColumn} > 0
            ), 0)
        ) AS CHAR)
    ");
    $lastReportValue = $stmt->fetchColumn();
    $nextReportValue = posReportMirrorNextTransactionId($lastReportValue);

    return (int)$lastReportValue > 0 && $nextReportValue !== ""
        ? $nextReportValue
        : $sourceValue;
}

function posReportMirrorGetMappedReportNumber(
    PDO $pdo,
    string $reportDbName,
    array $mapRow,
    string $mapColumnName,
    string $reportColumnName,
    string $categoryCode,
    string $unitCode,
    $sourceValue,
    bool $sourceMustBePositive = false
): string {
    $sourceValue = trim((string)$sourceValue);

    if ($sourceValue === "") {
        return "";
    }

    if ($sourceMustBePositive && (int)$sourceValue <= 0) {
        return "0";
    }

    $mappedValue = posReportMirrorMapValue($mapRow, $mapColumnName, $sourceMustBePositive);

    if ($mappedValue !== "") {
        return $mappedValue;
    }

    $existingReportValue = "";
    $mappedReportTransactionId = posReportMirrorMapValue($mapRow, "report_transaction_id");

    if ($mapColumnName !== "report_transaction_id" && $mappedReportTransactionId !== "") {
        $existingReportValue = posReportMirrorFindReportColumnValueByTransaction(
            $pdo,
            $reportDbName,
            $reportColumnName,
            $mappedReportTransactionId,
            $categoryCode,
            $unitCode
        );
    }

    if ($existingReportValue !== "" && (!$sourceMustBePositive || (int)$existingReportValue > 0)) {
        return $existingReportValue;
    }

    return posReportMirrorNextMappedReportValue(
        $pdo,
        $reportDbName,
        $mapColumnName,
        $reportColumnName,
        $sourceValue
    );
}

function posReportMirrorSaveReportMap(
    PDO $pdo,
    string $reportDbName,
    string $tokenReport,
    string $sourceId,
    int $sourceRank,
    string $sourceTransactionId,
    string $sourceOrderSlipNo,
    string $sourceInvoiceNo,
    string $categoryCode,
    string $unitCode,
    int $reportStatus,
    ?string $reportTransactionId,
    ?string $reportOrderSlipNo,
    ?string $reportInvoiceNo,
    ?string $activationKey = null,
    ?int $activationSequence = null
): void {
    $mapTable = posReportMirrorMapTable($reportDbName);
    $sourceOrderSlipNo = trim($sourceOrderSlipNo) === "" ? "0" : trim($sourceOrderSlipNo);
    $sourceInvoiceNo = trim($sourceInvoiceNo) === "" ? "0" : trim($sourceInvoiceNo);
    $reportStatus = $reportStatus === 1 ? 1 : 0;

    $stmt = $pdo->prepare("
        INSERT INTO {$mapTable} (
            `token_report`,
            `source_pos_id`,
            `source_rank`,
            `activation_key`,
            `activation_sequence`,
            `source_transaction_id`,
            `source_order_slip_no`,
            `source_invoice_no`,
            `report_transaction_id`,
            `report_order_slip_no`,
            `report_invoice_no`,
            `Category_Code`,
            `Unit_Code`,
            `report_status`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            `token_report` = CASE
                WHEN `token_report` IS NULL OR `token_report` = ''
                    THEN VALUES(`token_report`)
                ELSE `token_report`
            END,
            `source_pos_id` = VALUES(`source_pos_id`),
            `source_rank` = VALUES(`source_rank`),
            `activation_key` = COALESCE(`activation_key`, VALUES(`activation_key`)),
            `activation_sequence` = COALESCE(
                `activation_sequence`,
                VALUES(`activation_sequence`)
            ),
            `source_transaction_id` = VALUES(`source_transaction_id`),
            `source_order_slip_no` = VALUES(`source_order_slip_no`),
            `source_invoice_no` = VALUES(`source_invoice_no`),
            `report_transaction_id` = VALUES(`report_transaction_id`),
            `report_order_slip_no` = VALUES(`report_order_slip_no`),
            `report_invoice_no` = VALUES(`report_invoice_no`),
            `Category_Code` = VALUES(`Category_Code`),
            `Unit_Code` = VALUES(`Unit_Code`),
            `report_status` = VALUES(`report_status`),
            `updated_at` = CURRENT_TIMESTAMP
    ");
    $stmt->execute([
        $tokenReport,
        $sourceId,
        $sourceRank,
        $activationKey,
        $activationSequence,
        $sourceTransactionId,
        $sourceOrderSlipNo,
        $sourceInvoiceNo,
        $reportTransactionId,
        $reportOrderSlipNo,
        $reportInvoiceNo,
        $categoryCode,
        $unitCode,
        $reportStatus,
    ]);
}

function posReportMirrorFindReportColumnValueByTransaction(
    PDO $pdo,
    string $reportDbName,
    string $columnName,
    string $reportTransactionId,
    string $categoryCode,
    string $unitCode
): string {
    if ($reportTransactionId === "") {
        return "";
    }

    $targetMainTable = posReportMirrorTable($reportDbName, "tbl_pos_transactions");
    $quotedColumn = posReportMirrorQuote(posReportMirrorIdentifier($columnName, "report column name"));
    [$whereSql, $whereParams] = posReportMirrorScopedWhere(
        $reportTransactionId,
        $categoryCode,
        $unitCode
    );
    $stmt = $pdo->prepare("
        SELECT CAST({$quotedColumn} AS CHAR)
        FROM {$targetMainTable}
        WHERE {$whereSql}
        LIMIT 1
    ");
    $stmt->execute($whereParams);
    $existingValue = $stmt->fetchColumn();

    return $existingValue === false || $existingValue === null
        ? ""
        : (string)$existingValue;
}

function posReportMirrorDeleteChildRowsBySourceIds(
    PDO $pdo,
    string $sourceTable,
    string $targetTable,
    string $keyColumn,
    string $sourceWhereSql,
    array $sourceWhereParams
): void {
    $quotedKeyColumn = posReportMirrorQuote($keyColumn);
    $stmt = $pdo->prepare("
        DELETE FROM {$targetTable}
        WHERE {$quotedKeyColumn} IN (
            SELECT {$quotedKeyColumn}
            FROM {$sourceTable}
            WHERE {$sourceWhereSql}
        )
    ");
    $stmt->execute($sourceWhereParams);
}

function posReportMirrorDeleteTransactionFromReport(
    PDO $pdo,
    string $posDbName,
    string $reportDbName,
    string $tokenReport,
    string $transactionId,
    string $categoryCode,
    string $unitCode,
    ?string $mappedReportTransactionId = null
): void {
    $reportTransactionId = trim((string)$mappedReportTransactionId);

    if ($reportTransactionId === "") {
        $reportTransactionId = posReportMirrorFindReportTransactionIdByMap($pdo, $reportDbName, $tokenReport);
    }

    foreach (posReportMirrorTargetChildTables() as $mapping) {
        if ($reportTransactionId !== "") {
            [$targetWhereSql, $targetWhereParams] = posReportMirrorScopedWhere(
                $reportTransactionId,
                $categoryCode,
                $unitCode,
                "transaction_id",
                $mapping["category_column"],
                $mapping["unit_column"]
            );

            posReportMirrorDeleteRows(
                $pdo,
                posReportMirrorTable($reportDbName, $mapping["table"]),
                $targetWhereSql,
                $targetWhereParams
            );
        }

        [$sourceWhereSql, $sourceWhereParams] = posReportMirrorScopedWhere(
            $transactionId,
            $categoryCode,
            $unitCode,
            "transaction_id",
            $mapping["category_column"],
            $mapping["unit_column"]
        );

        posReportMirrorDeleteChildRowsBySourceIds(
            $pdo,
            posReportMirrorTable($posDbName, $mapping["table"]),
            posReportMirrorTable($reportDbName, $mapping["table"]),
            $mapping["key_column"],
            $sourceWhereSql,
            $sourceWhereParams
        );
    }

    if ($reportTransactionId !== "") {
        [$targetMainWhereSql, $targetMainWhereParams] = posReportMirrorScopedWhere(
            $reportTransactionId,
            $categoryCode,
            $unitCode
        );

        posReportMirrorDeleteRows(
            $pdo,
            posReportMirrorTable($reportDbName, "tbl_pos_transactions"),
            $targetMainWhereSql,
            $targetMainWhereParams
        );
    }
}

function mirrorPosTransactionToReport(
    PDO $pdo,
    array $config,
    string $transactionId,
    string $categoryCode = "",
    string $unitCode = "",
    bool $allowNewEnrollment = false,
    ?int $skipIntervalOverride = null,
    ?int $sourceRankOverride = null,
    ?string $activationKey = null,
    ?int $activationSequence = null
): void {
    $transactionId = trim($transactionId);
    $categoryCode = trim($categoryCode);
    $unitCode = trim($unitCode);

    if ($transactionId === "") {
        throw new InvalidArgumentException("transaction_id is required for report mirror.");
    }

    $activationKey = $activationKey === null ? null : trim($activationKey);
    $hasActivationKey = $activationKey !== null && $activationKey !== "";
    $hasActivationSequence = $activationSequence !== null;
    if ($hasActivationKey !== $hasActivationSequence) {
        throw new InvalidArgumentException(
            "Report mirror activation key and sequence must be provided together."
        );
    }
    if ($hasActivationKey) {
        if (!$allowNewEnrollment) {
            throw new InvalidArgumentException(
                "Activation membership is allowed only during new transaction enrollment."
            );
        }
        if (strlen((string)$activationKey) > 191 || (int)$activationSequence <= 0) {
            throw new InvalidArgumentException("Invalid report mirror activation membership.");
        }
    } else {
        $activationKey = null;
        $activationSequence = null;
    }

    $posDbName = posReportMirrorIdentifier($config["db"] ?? "db_cnc_pos", "POS database name");
    $reportDbName = posReportMirrorIdentifier($config["report_db"] ?? "reports_database", "report database name");

    if (strcasecmp($posDbName, $reportDbName) === 0) {
        return;
    }

    // Until the activation membership migration is installed, mirroring is a
    // no-op. Primary transaction mutations must remain available and must not
    // create map rows whose activation ownership cannot be recorded.
    if (!posReportMirrorMapActivationMembershipReady($pdo, $reportDbName)) {
        return;
    }

    $sourceTransaction = posReportMirrorFetchSourceTransaction(
        $pdo,
        $posDbName,
        $transactionId,
        $categoryCode,
        $unitCode
    );
    $sourceId = (string)$sourceTransaction["ID"];
    $sourceTransactionId = (string)$sourceTransaction["transaction_id"];
    $sourceOrderSlipNo = (string)$sourceTransaction["order_slip_no"];
    $sourceInvoiceNo = (string)$sourceTransaction["invoice_no"];
    $sourceCategoryCode = (string)($sourceTransaction["Category_Code"] ?? $categoryCode);
    $sourceUnitCode = (string)($sourceTransaction["Unit_Code"] ?? $unitCode);
    $mapRow = posReportMirrorFetchReportMapBySource(
        $pdo,
        $reportDbName,
        $sourceId,
        $sourceTransactionId,
        $sourceCategoryCode,
        $sourceUnitCode
    );

    // Legacy transactions have no map row. Mutation endpoints must not enroll
    // them; only the new-transaction creation flow opts in to enrollment.
    if (!posReportMirrorCanProcessSource($mapRow, $allowNewEnrollment)) {
        return;
    }

    $tokenReport = posReportMirrorMapValue($mapRow, "token_report");
    if ($tokenReport === "") {
        $tokenReport = posReportMirrorEnsureMapToken(
            $pdo,
            $reportDbName,
            $sourceId,
            $sourceTransactionId,
            $sourceCategoryCode,
            $sourceUnitCode
        );
    }

    $mainColumns = [
        "ID",
        "transaction_id",
        "Category_Code",
        "Unit_Code",
        "Project_Code",
        "transaction_type",
        "transaction_date",
        "transaction_time",
        "terminal_number",
        "purchase_order_no",
        "order_slip_no",
        "billing_no",
        "invoice_no",
        "table_number",
        "order_type",
        "customer_exclusive_id",
        "customer_head_count",
        "customer_count_for_discount",
        "discount_type",
        "TotalSales",
        "Discount",
        "OtherCharges",
        "TotalAmountDue",
        "VATableSales",
        "VATableSales_VAT",
        "VATExemptSales",
        "VATExemptSales_VAT",
        "VATZeroRatedSales",
        "payment_amount",
        "payment_method",
        "change_amount",
        "short_over",
        "special_instructions",
        "cashier",
        "remarks",
        "order_status",
        "status",
        "void_id",
        "void_remarks",
        "void_date",
        "refund_id",
        "refund_remarks",
        "refund_date",
        "date_recorded",
    ];

    [$mainWhere, $mainParams] = posReportMirrorScopedWhere($transactionId, $categoryCode, $unitCode);
    $sourceMainTable = posReportMirrorTable($posDbName, "tbl_pos_transactions");
    $targetMainTable = posReportMirrorTable($reportDbName, "tbl_pos_transactions");
    $mappedSourceRank = (int)($mapRow["source_rank"] ?? 0);
    if ($mappedSourceRank > 0) {
        // Updates keep the original activation-relative rank and never recount
        // the growing source transaction table.
        $sourceRank = $mappedSourceRank;
    } elseif ($sourceRankOverride !== null) {
        if ($sourceRankOverride <= 0) {
            throw new InvalidArgumentException("Invalid report mirror source rank override.");
        }
        $sourceRank = $sourceRankOverride;
    } else {
        // Backward-compatible fallback for explicitly authorized callers that
        // have not yet adopted the constant-time activation sequence.
        $sourceRank = posReportMirrorGetSourceTransactionRank($pdo, $posDbName, $sourceId);
    }

    if ($skipIntervalOverride !== null) {
        if ($skipIntervalOverride < 0 || $skipIntervalOverride === 1 || $skipIntervalOverride > 1000000) {
            throw new InvalidArgumentException("Invalid report mirror skip interval override.");
        }
        $skipInterval = $skipIntervalOverride;
    } else {
        $skipInterval = posReportMirrorGetSkipInterval($pdo, $posDbName, $reportDbName);
    }
    $shouldSkipTransaction = posReportMirrorShouldSkipTransaction(
        $mapRow,
        $sourceRank,
        $skipInterval,
        $sourceTransaction["order_type"] ?? ""
    );

    if ($shouldSkipTransaction) {
        // A newly enrolled skipped transaction has never had report rows.
        // Avoid source-ID cleanup until a map proves this transaction was
        // previously enrolled, because report child IDs are not a safe global
        // identity across independent databases.
        if (count($mapRow) > 0) {
            posReportMirrorDeleteTransactionFromReport(
                $pdo,
                $posDbName,
                $reportDbName,
                $tokenReport,
                $transactionId,
                $categoryCode,
                $unitCode,
                posReportMirrorMapValue($mapRow, "report_transaction_id")
            );
        }
        posReportMirrorSaveReportMap(
            $pdo,
            $reportDbName,
            $tokenReport,
            $sourceId,
            $sourceRank,
            $sourceTransactionId,
            $sourceOrderSlipNo,
            $sourceInvoiceNo,
            $sourceTransaction["Category_Code"] ?? $categoryCode,
            $sourceTransaction["Unit_Code"] ?? $unitCode,
            1,
            null,
            null,
            null,
            $activationKey,
            $activationSequence
        );
        return;
    }

    $reportTransactionId = posReportMirrorGetMappedReportNumber(
        $pdo,
        $reportDbName,
        $mapRow,
        "report_transaction_id",
        "transaction_id",
        $sourceTransaction["Category_Code"] ?? $categoryCode,
        $sourceTransaction["Unit_Code"] ?? $unitCode,
        $sourceTransactionId
    );
    $reportOrderSlipNo = posReportMirrorGetMappedReportNumber(
        $pdo,
        $reportDbName,
        $mapRow,
        "report_order_slip_no",
        "order_slip_no",
        $sourceTransaction["Category_Code"] ?? $categoryCode,
        $sourceTransaction["Unit_Code"] ?? $unitCode,
        $sourceOrderSlipNo
    );
    $reportInvoiceNo = posReportMirrorGetMappedReportNumber(
        $pdo,
        $reportDbName,
        $mapRow,
        "report_invoice_no",
        "invoice_no",
        $sourceTransaction["Category_Code"] ?? $categoryCode,
        $sourceTransaction["Unit_Code"] ?? $unitCode,
        $sourceInvoiceNo,
        true
    );
    posReportMirrorSaveReportMap(
        $pdo,
        $reportDbName,
        $tokenReport,
        $sourceId,
        $sourceRank,
        $sourceTransactionId,
        $sourceOrderSlipNo,
        $sourceInvoiceNo,
        $sourceTransaction["Category_Code"] ?? $categoryCode,
        $sourceTransaction["Unit_Code"] ?? $unitCode,
        0,
        $reportTransactionId,
        $reportOrderSlipNo,
        $reportInvoiceNo,
        $activationKey,
        $activationSequence
    );
    $reportMainColumns = array_values(array_filter(
        $mainColumns,
        static fn($column) => $column !== "ID"
    ));

    $targetMainAlias = "mirror_target";
    [$targetMainWhere, $targetMainParams] = posReportMirrorScopedWhere(
        $reportTransactionId,
        $sourceCategoryCode,
        $sourceUnitCode,
        "transaction_id",
        "Category_Code",
        "Unit_Code",
        $targetMainAlias
    );

    posReportMirrorUpdateThenInsertRows(
        $pdo,
        $sourceMainTable,
        $targetMainTable,
        $reportMainColumns,
        $mainWhere,
        $mainParams,
        $targetMainWhere,
        $targetMainParams,
        [
            "transaction_id" => $reportTransactionId,
            "order_slip_no" => $reportOrderSlipNo,
            "invoice_no" => $reportInvoiceNo,
        ]
    );

    $tableMappings = [
        [
            "table" => "tbl_pos_transactions_detailed",
            "columns" => [
                "ID",
                "transaction_id",
                "Category_Code",
                "Unit_Code",
                "transaction_date",
                "product_id",
                "sku",
                "sales_quantity",
                "landing_cost",
                "unit_cost",
                "selling_price",
                "vatable",
                "isDiscountable",
                "order_status",
            ],
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_payments",
            "columns" => [
                "ID",
                "transaction_id",
                "Category_Code",
                "Unit_Code",
                "Project_Code",
                "transaction_date",
                "payment_method",
                "payment_amount",
                "payment_reference",
            ],
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_discounts",
            "columns" => [
                "id",
                "Category_Code",
                "Unit_Code",
                "transaction_id",
                "customer_id",
                "discount_type",
                "discount_amount",
                "customer_name",
                "date_of_birth",
                "gender",
                "tin",
                "contact_no",
                "status",
                "usertracker",
                "created_at",
            ],
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_other_charges",
            "columns" => [
                "ID",
                "transaction_id",
                "Category_Code",
                "Unit_Code",
                "Project_Code",
                "transaction_date",
                "particulars",
                "amount",
                "reference",
            ],
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_customers",
            "columns" => [
                "ID",
                "transaction_id",
                "Category_Code",
                "Unit_Code",
                "Project_Code",
                "transaction_date",
                "customer_id",
            ],
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_discounts_per_product",
            "columns" => [
                "id",
                "transaction_id",
                "transaction_date",
                "category_code",
                "unit_code",
                "product_id",
                "item_name",
                "customer_id",
                "discount_type",
                "discount_sharing",
                "total_customers",
                "qualified_customers",
                "vat_exempt_amount",
                "discount_amount",
                "status",
                "created_at",
            ],
            "category_column" => "category_code",
            "unit_column" => "unit_code",
        ],
        [
            "table" => "tbl_pos_loyalty_discounts",
            "columns" => [
                "id",
                "transaction_id",
                "Category_Code",
                "Unit_Code",
                "Project_Code",
                "transaction_date",
                "loyalty_member_id",
                "customer_name",
                "phone_number",
                "points_redeemed",
                "points_earned",
                "discount_amount",
                "status",
                "usertracker",
                "created_at",
            ],
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
    ];

    foreach ($tableMappings as $mapping) {
        [$sourceWhereSql, $sourceWhereParams] = posReportMirrorScopedWhere(
            $transactionId,
            $categoryCode,
            $unitCode,
            "transaction_id",
            $mapping["category_column"],
            $mapping["unit_column"]
        );
        [$targetWhereSql, $targetWhereParams] = posReportMirrorScopedWhere(
            $reportTransactionId,
            $categoryCode,
            $unitCode,
            "transaction_id",
            $mapping["category_column"],
            $mapping["unit_column"]
        );

        posReportMirrorReplaceChildRows(
            $pdo,
            posReportMirrorTable($posDbName, $mapping["table"]),
            posReportMirrorTable($reportDbName, $mapping["table"]),
            $mapping["columns"],
            $targetWhereSql,
            $targetWhereParams,
            $sourceWhereSql,
            $sourceWhereParams,
            ["transaction_id" => $reportTransactionId]
        );
    }
}

/**
 * Repairs already-enrolled report rows only. The INNER JOIN on the map table
 * prevents this maintenance helper from enrolling historical transactions.
 */
function mirrorRecentPosTransactionsToReport(PDO $pdo, array $config, int $limit = 200): int
{
    $posDbName = posReportMirrorIdentifier($config["db"] ?? "db_cnc_pos", "POS database name");
    $reportDbName = posReportMirrorIdentifier($config["report_db"] ?? "reports_database", "report database name");

    if (strcasecmp($posDbName, $reportDbName) === 0) {
        return 0;
    }

    $limit = max(1, min($limit, 1000));
    $sourceMainTable = posReportMirrorTable($posDbName, "tbl_pos_transactions");
    $targetMainTable = posReportMirrorTable($reportDbName, "tbl_pos_transactions");
    $mapTable = posReportMirrorMapTable($reportDbName);
    $skipInterval = posReportMirrorGetSkipInterval($pdo, $posDbName, $reportDbName);
    $skippedRankSql = $skipInterval > 0
        ? "MOD(p.source_rank, {$skipInterval}) = 0"
        : "0 = 1";
    $postedRankSql = $skipInterval > 0
        ? "MOD(p.source_rank, {$skipInterval}) <> 0"
        : "1 = 1";
    $childCountChecks = [];
    $childCountMappings = [
        [
            "table" => "tbl_pos_transactions_detailed",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_payments",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_discounts",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_other_charges",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_customers",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
        [
            "table" => "tbl_pos_transactions_discounts_per_product",
            "category_column" => "category_code",
            "unit_column" => "unit_code",
        ],
        [
            "table" => "tbl_pos_loyalty_discounts",
            "category_column" => "Category_Code",
            "unit_column" => "Unit_Code",
        ],
    ];

    foreach ($childCountMappings as $index => $mapping) {
        $sourceAlias = "ps{$index}";
        $targetAlias = "rs{$index}";
        $sourceChildTable = posReportMirrorTable($posDbName, $mapping["table"]);
        $targetChildTable = posReportMirrorTable($reportDbName, $mapping["table"]);
        $childTransactionColumn = posReportMirrorQuote("transaction_id");
        $childCategoryColumn = posReportMirrorQuote($mapping["category_column"]);
        $childUnitColumn = posReportMirrorQuote($mapping["unit_column"]);

        $childCountChecks[] = "
           OR (
                SELECT COUNT(*)
                FROM {$sourceChildTable} {$sourceAlias}
                WHERE {$sourceAlias}.{$childTransactionColumn} <=> p.`transaction_id`
                  AND {$sourceAlias}.{$childCategoryColumn} <=> p.`Category_Code`
                  AND {$sourceAlias}.{$childUnitColumn} <=> p.`Unit_Code`
           ) <> (
                SELECT COUNT(*)
                FROM {$targetChildTable} {$targetAlias}
                WHERE {$targetAlias}.{$childTransactionColumn} <=> COALESCE(r.`transaction_id`, m.`report_transaction_id`)
                  AND {$targetAlias}.{$childCategoryColumn} <=> p.`Category_Code`
                  AND {$targetAlias}.{$childUnitColumn} <=> p.`Unit_Code`
           )";
    }

    $childCountWhereSql = implode("", $childCountChecks);

    $stmt = $pdo->query("
        SELECT
            CAST(p.transaction_id AS CHAR) AS transaction_id,
            CAST(p.Category_Code AS CHAR) AS Category_Code,
            CAST(p.Unit_Code AS CHAR) AS Unit_Code
        FROM (
            SELECT
                source_row.*,
                (
                    SELECT COUNT(*)
                    FROM {$sourceMainTable} ranked
                    WHERE ranked.ID <= source_row.ID
                ) AS source_rank
            FROM {$sourceMainTable} source_row
        ) p
        INNER JOIN {$mapTable} m
            ON m.`source_pos_id` <=> p.`ID`
        LEFT JOIN {$targetMainTable} r
            ON r.`transaction_id` <=> m.`report_transaction_id`
           AND r.`Category_Code` <=> p.`Category_Code`
           AND r.`Unit_Code` <=> p.`Unit_Code`
        WHERE (
                (
                    (m.`id` IS NULL AND {$skippedRankSql})
                 OR (m.`id` IS NOT NULL AND COALESCE(m.`report_status`, -1) = 1)
                )
            AND (
                   m.`id` IS NULL
                OR COALESCE(m.`source_rank`, 0) <> COALESCE(p.source_rank, 0)
                OR COALESCE(m.`source_pos_id`, 0) <> COALESCE(p.ID, 0)
                OR COALESCE(m.`source_transaction_id`, 0) <> COALESCE(p.transaction_id, 0)
                OR COALESCE(m.`source_order_slip_no`, 0) <> COALESCE(p.order_slip_no, 0)
                OR COALESCE(m.`source_invoice_no`, 0) <> COALESCE(p.invoice_no, 0)
                OR COALESCE(m.`report_status`, -1) <> 1
                OR m.`report_transaction_id` IS NOT NULL
                OR m.`report_order_slip_no` IS NOT NULL
                OR m.`report_invoice_no` IS NOT NULL
                OR r.`ID` IS NOT NULL
            )
        )
        OR (
                (
                    (m.`id` IS NULL AND {$postedRankSql})
                 OR (m.`id` IS NOT NULL AND COALESCE(m.`report_status`, -1) = 0)
                )
            AND (
                   m.`id` IS NULL
                OR COALESCE(m.`source_rank`, 0) <> COALESCE(p.source_rank, 0)
                OR COALESCE(m.`source_pos_id`, 0) <> COALESCE(p.ID, 0)
                OR COALESCE(m.`source_transaction_id`, 0) <> COALESCE(p.transaction_id, 0)
                OR COALESCE(m.`source_order_slip_no`, 0) <> COALESCE(p.order_slip_no, 0)
                OR COALESCE(m.`source_invoice_no`, 0) <> COALESCE(p.invoice_no, 0)
                OR COALESCE(m.`report_status`, -1) <> 0
                OR m.`report_transaction_id` IS NULL
                OR m.`report_order_slip_no` IS NULL
                OR r.`ID` IS NULL
                OR CAST(COALESCE(r.`transaction_id`, 0) AS CHAR) <> CAST(COALESCE(m.`report_transaction_id`, 0) AS CHAR)
                OR CAST(COALESCE(r.`order_slip_no`, 0) AS CHAR) <> CAST(COALESCE(m.`report_order_slip_no`, 0) AS CHAR)
                OR (
                    COALESCE(p.`invoice_no`, 0) > 0
                    AND (
                           m.`report_invoice_no` IS NULL
                        OR COALESCE(m.`report_invoice_no`, 0) <= 0
                        OR COALESCE(r.`invoice_no`, 0) <= 0
                    )
                )
                OR COALESCE(r.billing_no, 0) <> COALESCE(p.billing_no, 0)
                OR COALESCE(r.payment_amount, 0) <> COALESCE(p.payment_amount, 0)
                OR COALESCE(r.payment_method, '') <> COALESCE(p.payment_method, '')
                OR COALESCE(r.remarks, '') <> COALESCE(p.remarks, '')
                OR COALESCE(r.status, '') <> COALESCE(p.status, '')
                OR COALESCE(r.order_status, '') <> COALESCE(p.order_status, '')
                OR COALESCE(r.void_id, 0) <> COALESCE(p.void_id, 0)
                OR COALESCE(r.refund_id, 0) <> COALESCE(p.refund_id, 0)
                OR COALESCE(r.void_remarks, '') <> COALESCE(p.void_remarks, '')
                OR COALESCE(CAST(r.void_date AS CHAR), '') <> COALESCE(CAST(p.void_date AS CHAR), '')
                OR COALESCE(r.refund_remarks, '') <> COALESCE(p.refund_remarks, '')
                OR COALESCE(CAST(r.refund_date AS CHAR), '') <> COALESCE(CAST(p.refund_date AS CHAR), '')
                {$childCountWhereSql}
            )
        )
        ORDER BY p.ID DESC
        LIMIT {$limit}
    ");

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as $row) {
        mirrorPosTransactionToReport(
            $pdo,
            $config,
            (string)$row["transaction_id"],
            (string)$row["Category_Code"],
            (string)$row["Unit_Code"]
        );
    }

    return count($rows);
}
