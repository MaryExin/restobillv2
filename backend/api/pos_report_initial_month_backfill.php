<?php

declare(strict_types=1);

require_once __DIR__ . "/pos_report_mirror.php";

const POS_REPORT_INITIAL_MONTH_BACKFILL_TABLE = "tbl_pos_report_backfill_jobs";
const POS_REPORT_INITIAL_MONTH_BACKFILL_JOB_VERSION = "initial_month_v1";
const POS_REPORT_INITIAL_MONTH_BACKFILL_DEFAULT_BATCH_SIZE = 25;
const POS_REPORT_INITIAL_MONTH_BACKFILL_MAX_BATCH_SIZE = 50;

function posReportInitialMonthBackfillDatabaseNames(array $config): array
{
    return [
        posReportMirrorIdentifier($config["db"] ?? "db_cnc_pos", "POS database name"),
        posReportMirrorIdentifier($config["report_db"] ?? "reports_database", "report database name"),
    ];
}

function posReportInitialMonthBackfillJobKey(string $posDbName, string $reportDbName): string
{
    return POS_REPORT_INITIAL_MONTH_BACKFILL_JOB_VERSION . "_" . hash(
        "sha256",
        strtolower($posDbName . "|" . $reportDbName)
    );
}

function posReportInitialMonthBackfillTable(string $reportDbName): string
{
    return posReportMirrorTable($reportDbName, POS_REPORT_INITIAL_MONTH_BACKFILL_TABLE);
}

function posReportInitialMonthBackfillPeriodBounds(): array
{
    $timezone = new DateTimeZone("Asia/Manila");
    $now = new DateTimeImmutable("now", $timezone);
    $periodStart = $now->modify("first day of this month")->setTime(0, 0, 0);
    $periodEndExclusive = $periodStart->modify("first day of next month");

    return [
        $periodStart->format("Y-m-d"),
        $periodEndExclusive->format("Y-m-d"),
        $now->format("Y-m-d H:i:s"),
    ];
}

function posReportInitialMonthBackfillTableExists(PDO $pdo, string $reportDbName): bool
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
    ");
    $stmt->execute([$reportDbName, POS_REPORT_INITIAL_MONTH_BACKFILL_TABLE]);

    return (int)$stmt->fetchColumn() > 0;
}

function posReportInitialMonthBackfillFetchJob(
    PDO $pdo,
    string $reportDbName,
    string $jobKey,
    bool $forUpdate = false
): array {
    $jobTable = posReportInitialMonthBackfillTable($reportDbName);
    $sql = "
        SELECT
            `id`,
            `job_key`,
            `source_database`,
            `period_start`,
            `period_end_exclusive`,
            `cutoff_at`,
            CAST(`cutoff_source_id` AS CHAR) AS cutoff_source_id,
            CAST(`cutoff_shift_id` AS CHAR) AS cutoff_shift_id,
            CAST(`source_cursor_id` AS CHAR) AS source_cursor_id,
            CAST(`shift_cursor_id` AS CHAR) AS shift_cursor_id,
            `skip_interval`,
            `phase`,
            `status`,
            `source_total_count`,
            `source_processed_count`,
            `shift_total_count`,
            `shift_processed_count`,
            `attempt_count`,
            `lease_token`,
            `lease_expires_at`,
            `last_error`,
            `started_at`,
            `heartbeat_at`,
            `completed_at`,
            `created_at`,
            `updated_at`
        FROM {$jobTable}
        WHERE `job_key` = ?
        LIMIT 1
    ";
    if ($forUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$jobKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : [];
}

function posReportInitialMonthBackfillPublicState(
    array $row,
    string $posDbName,
    string $reportDbName,
    array $overrides = []
): array {
    [$defaultPeriodStart, $defaultPeriodEndExclusive] = posReportInitialMonthBackfillPeriodBounds();
    $status = strtolower(trim((string)($row["status"] ?? "pending")));
    $phase = strtolower(trim((string)($row["phase"] ?? "shifts")));

    $state = [
        "status" => $status === "" ? "pending" : $status,
        "phase" => $phase === "" ? "shifts" : $phase,
        "period_start" => (string)($row["period_start"] ?? $defaultPeriodStart),
        "period_end_exclusive" => (string)($row["period_end_exclusive"] ?? $defaultPeriodEndExclusive),
        "cutoff_at" => $row["cutoff_at"] ?? null,
        "cutoff_source_id" => (string)($row["cutoff_source_id"] ?? "0"),
        "cutoff_shift_id" => (string)($row["cutoff_shift_id"] ?? "0"),
        "source_cursor_id" => (string)($row["source_cursor_id"] ?? "0"),
        "shift_cursor_id" => (string)($row["shift_cursor_id"] ?? "0"),
        "skip_interval" => (int)($row["skip_interval"] ?? 0),
        "processed_transactions" => (int)($row["source_processed_count"] ?? 0),
        "total_transactions" => (int)($row["source_total_count"] ?? 0),
        "processed_shifts" => (int)($row["shift_processed_count"] ?? 0),
        "total_shifts" => (int)($row["shift_total_count"] ?? 0),
        "attempt_count" => (int)($row["attempt_count"] ?? 0),
        "last_error" => isset($row["last_error"]) && trim((string)$row["last_error"]) !== ""
            ? (string)$row["last_error"]
            : null,
        "started_at" => $row["started_at"] ?? null,
        "heartbeat_at" => $row["heartbeat_at"] ?? null,
        "completed_at" => $row["completed_at"] ?? null,
        "source_database" => $posDbName,
        "report_database" => $reportDbName,
        "initialized" => count($row) > 0,
        "migration_required" => false,
        "busy" => false,
    ];
    $state["has_more"] = in_array($state["status"], ["pending", "running"], true);

    foreach ($overrides as $key => $value) {
        $state[$key] = $value;
    }

    return $state;
}

/**
 * Cheap report-DB-only state read. It never queries POS transaction or shift
 * history, so Settings GET and completed polling stay constant-time.
 */
function posReportInitialMonthBackfillReadState(PDO $pdo, array $config): array
{
    [$posDbName, $reportDbName] = posReportInitialMonthBackfillDatabaseNames($config);

    if (strcasecmp($posDbName, $reportDbName) === 0) {
        return posReportInitialMonthBackfillPublicState([], $posDbName, $reportDbName, [
            "status" => "completed",
            "phase" => "completed",
            "has_more" => false,
            "initialized" => true,
            "completed_at" => null,
        ]);
    }

    if (!posReportInitialMonthBackfillTableExists($pdo, $reportDbName)) {
        return posReportInitialMonthBackfillPublicState([], $posDbName, $reportDbName, [
            "status" => "migration_required",
            "has_more" => false,
            "migration_required" => true,
        ]);
    }

    $jobKey = posReportInitialMonthBackfillJobKey($posDbName, $reportDbName);
    $row = posReportInitialMonthBackfillFetchJob($pdo, $reportDbName, $jobKey);

    return posReportInitialMonthBackfillPublicState($row, $posDbName, $reportDbName);
}

function posReportInitialMonthBackfillNormalizeBatchSize(int $batchSize): int
{
    if ($batchSize <= 0) {
        return POS_REPORT_INITIAL_MONTH_BACKFILL_DEFAULT_BATCH_SIZE;
    }

    return min($batchSize, POS_REPORT_INITIAL_MONTH_BACKFILL_MAX_BATCH_SIZE);
}

function posReportInitialMonthBackfillLockName(string $jobKey): string
{
    return "pos_report_backfill_" . substr(hash("sha256", $jobKey), 0, 40);
}

function posReportInitialMonthBackfillAcquireJobLock(PDO $pdo, string $lockName): bool
{
    $stmt = $pdo->prepare("SELECT GET_LOCK(?, 0)");
    $stmt->execute([$lockName]);

    return (int)$stmt->fetchColumn() === 1;
}

function posReportInitialMonthBackfillReleaseJobLock(PDO $pdo, string $lockName): void
{
    try {
        $stmt = $pdo->prepare("SELECT RELEASE_LOCK(?)");
        $stmt->execute([$lockName]);
    } catch (Throwable $e) {
        // The database connection also releases advisory locks when it closes.
    }
}

function posReportInitialMonthBackfillScalar(PDO $pdo, string $sql, array $params = []): string
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $value = $stmt->fetchColumn();

    return $value === false || $value === null ? "0" : (string)$value;
}

function posReportInitialMonthBackfillInitializeJob(
    PDO $pdo,
    array $config,
    string $posDbName,
    string $reportDbName,
    string $jobKey
): array {
    $existing = posReportInitialMonthBackfillFetchJob($pdo, $reportDbName, $jobKey);
    if (count($existing) > 0) {
        if (strtolower((string)($existing["phase"] ?? "")) !== "initializing") {
            return $existing;
        }
    }

    $sourceTable = posReportMirrorTable($posDbName, "tbl_pos_transactions");
    $sourceShiftTable = posReportMirrorTable($posDbName, "tbl_pos_shifting_records");
    $jobTable = posReportInitialMonthBackfillTable($reportDbName);

    if ($pdo->inTransaction()) {
        throw new RuntimeException("Initial report backfill cannot initialize inside another transaction.");
    }

    if (count($existing) === 0) {
        [$periodStart, $periodEndExclusive, $initializingAt] =
            posReportInitialMonthBackfillPeriodBounds();
        $insertInitializingStmt = $pdo->prepare("
            INSERT INTO {$jobTable} (
                `job_key`,
                `source_database`,
                `period_start`,
                `period_end_exclusive`,
                `cutoff_at`,
                `phase`,
                `status`
            ) VALUES (?, ?, ?, ?, ?, 'initializing', 'pending')
        ");
        $insertInitializingStmt->execute([
            $jobKey,
            $posDbName,
            $periodStart,
            $periodEndExclusive,
            $initializingAt,
        ]);
        $existing = posReportInitialMonthBackfillFetchJob($pdo, $reportDbName, $jobKey);
    }

    $periodStart = (string)$existing["period_start"];
    $periodEndExclusive = (string)$existing["period_end_exclusive"];
    [, , $cutoffAt] = posReportInitialMonthBackfillPeriodBounds();

    $pdo->beginTransaction();
    try {
        $cutoffSourceId = posReportInitialMonthBackfillScalar(
            $pdo,
            "SELECT COALESCE(MAX(`ID`), 0) FROM {$sourceTable}"
        );
        $cutoffShiftId = posReportInitialMonthBackfillScalar(
            $pdo,
            "SELECT COALESCE(MAX(`ID`), 0) FROM {$sourceShiftTable}"
        );
        $sourceTotalCount = posReportInitialMonthBackfillScalar(
            $pdo,
            "SELECT COUNT(*)
             FROM {$sourceTable}
             WHERE `ID` <= ?
               AND `transaction_date` >= ?
               AND `transaction_date` < ?",
            [$cutoffSourceId, $periodStart, $periodEndExclusive]
        );
        $shiftTotalCount = posReportInitialMonthBackfillScalar(
            $pdo,
            "SELECT COUNT(*)
             FROM {$sourceShiftTable}
             WHERE `ID` <= ?
               AND `Opening_DateTime` >= ?
               AND `Opening_DateTime` < ?",
            [$cutoffShiftId, $periodStart, $periodEndExclusive]
        );
        $skipInterval = posReportMirrorGetSkipInterval($pdo, $posDbName, $reportDbName);

        $stmt = $pdo->prepare("
            UPDATE {$jobTable}
            SET `cutoff_at` = ?,
                `cutoff_source_id` = ?,
                `cutoff_shift_id` = ?,
                `source_cursor_id` = 0,
                `shift_cursor_id` = 0,
                `skip_interval` = ?,
                `phase` = 'shifts',
                `status` = 'pending',
                `source_total_count` = ?,
                `source_processed_count` = 0,
                `shift_total_count` = ?,
                `shift_processed_count` = 0,
                `last_error` = NULL,
                `heartbeat_at` = CURRENT_TIMESTAMP,
                `completed_at` = NULL
            WHERE `job_key` = ?
              AND `phase` = 'initializing'
        ");
        $stmt->execute([
            $cutoffAt,
            $cutoffSourceId,
            $cutoffShiftId,
            $skipInterval,
            $sourceTotalCount,
            $shiftTotalCount,
            $jobKey,
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return posReportInitialMonthBackfillFetchJob($pdo, $reportDbName, $jobKey);
}

function posReportInitialMonthBackfillMarkRunning(
    PDO $pdo,
    string $reportDbName,
    string $jobKey
): void {
    $jobTable = posReportInitialMonthBackfillTable($reportDbName);
    $stmt = $pdo->prepare("
        UPDATE {$jobTable}
        SET `status` = 'running',
            `attempt_count` = `attempt_count` + 1,
            `last_error` = NULL,
            `started_at` = COALESCE(`started_at`, CURRENT_TIMESTAMP),
            `heartbeat_at` = CURRENT_TIMESTAMP
        WHERE `job_key` = ?
          AND `status` <> 'completed'
    ");
    $stmt->execute([$jobKey]);
}

function posReportInitialMonthBackfillMarkFailed(
    PDO $pdo,
    string $reportDbName,
    string $jobKey,
    Throwable $error
): void {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $message = trim($error->getMessage());
    if ($message === "") {
        $message = "Initial report backfill failed.";
    }
    if (strlen($message) > 2000) {
        $message = substr($message, 0, 2000);
    }

    $jobTable = posReportInitialMonthBackfillTable($reportDbName);
    $stmt = $pdo->prepare("
        UPDATE {$jobTable}
        SET `status` = 'failed',
            `last_error` = ?,
            `heartbeat_at` = CURRENT_TIMESTAMP
        WHERE `job_key` = ?
          AND `status` <> 'completed'
    ");
    $stmt->execute([$message, $jobKey]);
}

function posReportInitialMonthBackfillFetchNextShift(
    PDO $pdo,
    string $posDbName,
    array $job
): array {
    $sourceShiftTable = posReportMirrorTable($posDbName, "tbl_pos_shifting_records");
    $stmt = $pdo->prepare("
        SELECT
            CAST(`ID` AS CHAR) AS ID,
            `Category_Code`,
            `Unit_Code`,
            `Shift_ID`,
            `terminal_number`,
            `Opening_User_ID`,
            `Opening_DateTime`,
            `Opening_Cash_Count`,
            `Closing_User_ID`,
            `Closing_DateTime`,
            `Closing_Cash_Count`,
            `Beg_OR`,
            `End_OR`,
            `Beg_VoidNo`,
            `End_VoidNo`,
            `Beg_RefundNo`,
            `End_RefundNo`,
            `Z_Counter_No`,
            `Grand_Accum_Sales`,
            `Shift_Status`,
            `Remarks`,
            `Status`,
            `Date_Recorded`
        FROM {$sourceShiftTable}
        WHERE `ID` > ?
          AND `ID` <= ?
          AND `Opening_DateTime` >= ?
          AND `Opening_DateTime` < ?
        ORDER BY `ID` ASC
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([
        (string)$job["shift_cursor_id"],
        (string)$job["cutoff_shift_id"],
        (string)$job["period_start"],
        (string)$job["period_end_exclusive"],
    ]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : [];
}

function posReportInitialMonthBackfillUpsertShift(
    PDO $pdo,
    string $reportDbName,
    array $shift
): void {
    $targetShiftTable = posReportMirrorTable($reportDbName, "tbl_pos_shifting_records");
    $existingStmt = $pdo->prepare("
        SELECT `ID`
        FROM {$targetShiftTable}
        WHERE `Category_Code` <=> ?
          AND `Unit_Code` <=> ?
          AND `terminal_number` <=> ?
          AND `Shift_ID` <=> ?
        LIMIT 1
        FOR UPDATE
    ");
    $existingStmt->execute([
        $shift["Category_Code"],
        $shift["Unit_Code"],
        $shift["terminal_number"],
        $shift["Shift_ID"],
    ]);

    $existingId = $existingStmt->fetchColumn();
    if ($existingId !== false) {
        $updateStmt = $pdo->prepare("
            UPDATE {$targetShiftTable}
            SET `Category_Code` = ?,
                `Unit_Code` = ?,
                `Shift_ID` = ?,
                `terminal_number` = ?,
                `Opening_User_ID` = ?,
                `Opening_DateTime` = ?,
                `Opening_Cash_Count` = ?,
                `Closing_User_ID` = ?,
                `Closing_DateTime` = ?,
                `Closing_Cash_Count` = ?,
                `Beg_OR` = ?,
                `End_OR` = ?,
                `Beg_VoidNo` = ?,
                `End_VoidNo` = ?,
                `Beg_RefundNo` = ?,
                `End_RefundNo` = ?,
                `Z_Counter_No` = ?,
                `Grand_Accum_Sales` = ?,
                `Shift_Status` = ?,
                `Remarks` = ?,
                `Status` = ?,
                `Date_Recorded` = ?
            WHERE `ID` = ?
        ");
        $updateStmt->execute([
            $shift["Category_Code"],
            $shift["Unit_Code"],
            $shift["Shift_ID"],
            $shift["terminal_number"],
            $shift["Opening_User_ID"],
            $shift["Opening_DateTime"],
            $shift["Opening_Cash_Count"],
            $shift["Closing_User_ID"],
            $shift["Closing_DateTime"],
            $shift["Closing_Cash_Count"],
            $shift["Beg_OR"],
            $shift["End_OR"],
            $shift["Beg_VoidNo"],
            $shift["End_VoidNo"],
            $shift["Beg_RefundNo"],
            $shift["End_RefundNo"],
            $shift["Z_Counter_No"],
            $shift["Grand_Accum_Sales"],
            $shift["Shift_Status"],
            $shift["Remarks"],
            $shift["Status"],
            $shift["Date_Recorded"],
            $existingId,
        ]);
        return;
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO {$targetShiftTable} (
            `Category_Code`,
            `Unit_Code`,
            `Shift_ID`,
            `terminal_number`,
            `Opening_User_ID`,
            `Opening_DateTime`,
            `Opening_Cash_Count`,
            `Closing_User_ID`,
            `Closing_DateTime`,
            `Closing_Cash_Count`,
            `Beg_OR`,
            `End_OR`,
            `Beg_VoidNo`,
            `End_VoidNo`,
            `Beg_RefundNo`,
            `End_RefundNo`,
            `Z_Counter_No`,
            `Grand_Accum_Sales`,
            `Shift_Status`,
            `Remarks`,
            `Status`,
            `Date_Recorded`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $insertStmt->execute([
        $shift["Category_Code"],
        $shift["Unit_Code"],
        $shift["Shift_ID"],
        $shift["terminal_number"],
        $shift["Opening_User_ID"],
        $shift["Opening_DateTime"],
        $shift["Opening_Cash_Count"],
        $shift["Closing_User_ID"],
        $shift["Closing_DateTime"],
        $shift["Closing_Cash_Count"],
        $shift["Beg_OR"],
        $shift["End_OR"],
        $shift["Beg_VoidNo"],
        $shift["End_VoidNo"],
        $shift["Beg_RefundNo"],
        $shift["End_RefundNo"],
        $shift["Z_Counter_No"],
        $shift["Grand_Accum_Sales"],
        $shift["Shift_Status"],
        $shift["Remarks"],
        $shift["Status"],
        $shift["Date_Recorded"],
    ]);
}

/** Returns true when one shift row was processed; false on phase transition. */
function posReportInitialMonthBackfillProcessNextShift(
    PDO $pdo,
    string $posDbName,
    string $reportDbName,
    string $jobKey
): bool {
    $jobTable = posReportInitialMonthBackfillTable($reportDbName);
    $pdo->beginTransaction();
    try {
        $job = posReportInitialMonthBackfillFetchJob($pdo, $reportDbName, $jobKey, true);
        if (strtolower((string)($job["phase"] ?? "")) !== "shifts") {
            $pdo->commit();
            return false;
        }

        $shift = posReportInitialMonthBackfillFetchNextShift($pdo, $posDbName, $job);
        if (count($shift) === 0) {
            if ((int)$job["shift_processed_count"] !== (int)$job["shift_total_count"]) {
                throw new RuntimeException(
                    "Shift backfill snapshot changed before all expected rows were processed."
                );
            }
            $stmt = $pdo->prepare("
                UPDATE {$jobTable}
                SET `phase` = 'transactions',
                    `shift_cursor_id` = `cutoff_shift_id`,
                    `heartbeat_at` = CURRENT_TIMESTAMP
                WHERE `job_key` = ?
            ");
            $stmt->execute([$jobKey]);
            $pdo->commit();
            return false;
        }

        posReportInitialMonthBackfillUpsertShift($pdo, $reportDbName, $shift);
        $stmt = $pdo->prepare("
            UPDATE {$jobTable}
            SET `shift_cursor_id` = ?,
                `shift_processed_count` = `shift_processed_count` + 1,
                `heartbeat_at` = CURRENT_TIMESTAMP
            WHERE `job_key` = ?
        ");
        $stmt->execute([(string)$shift["ID"], $jobKey]);
        $pdo->commit();

        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function posReportInitialMonthBackfillFetchNextTransaction(
    PDO $pdo,
    string $posDbName,
    array $job
): array {
    $sourceTable = posReportMirrorTable($posDbName, "tbl_pos_transactions");
    $stmt = $pdo->prepare("
        SELECT
            CAST(`ID` AS CHAR) AS ID,
            CAST(`transaction_id` AS CHAR) AS transaction_id,
            CAST(`Category_Code` AS CHAR) AS Category_Code,
            CAST(`Unit_Code` AS CHAR) AS Unit_Code
        FROM {$sourceTable}
        WHERE `ID` > ?
          AND `ID` <= ?
          AND `transaction_date` >= ?
          AND `transaction_date` < ?
        ORDER BY `ID` ASC
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([
        (string)$job["source_cursor_id"],
        (string)$job["cutoff_source_id"],
        (string)$job["period_start"],
        (string)$job["period_end_exclusive"],
    ]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : [];
}

function posReportInitialMonthBackfillLockDocumentCounter(
    PDO $pdo,
    string $posDbName,
    string $categoryCode,
    string $unitCode
): void {
    $counterTable = posReportMirrorTable($posDbName, "tbl_pos_document_counters");
    $stmt = $pdo->prepare("
        SELECT `Category_Code`
        FROM {$counterTable}
        WHERE `Category_Code` <=> ?
          AND `Unit_Code` <=> ?
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([$categoryCode, $unitCode]);

    if ($stmt->fetchColumn() === false) {
        throw new RuntimeException(
            "Document counter row is missing for the transaction business scope."
        );
    }
}

function posReportInitialMonthBackfillValidateCompletion(
    PDO $pdo,
    string $posDbName,
    string $reportDbName,
    array $job
): void {
    $sourceTable = posReportMirrorTable($posDbName, "tbl_pos_transactions");
    $mapTable = posReportMirrorMapTable($reportDbName);
    $missingMapStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM {$sourceTable} source_row
        LEFT JOIN {$mapTable} map_row
          ON map_row.`source_pos_id` <=> source_row.`ID`
        WHERE source_row.`ID` <= ?
          AND source_row.`transaction_date` >= ?
          AND source_row.`transaction_date` < ?
          AND map_row.`id` IS NULL
    ");
    $missingMapStmt->execute([
        (string)$job["cutoff_source_id"],
        (string)$job["period_start"],
        (string)$job["period_end_exclusive"],
    ]);
    if ((int)$missingMapStmt->fetchColumn() > 0) {
        throw new RuntimeException("Initial report backfill validation found unmapped transactions.");
    }

    $sourceShiftTable = posReportMirrorTable($posDbName, "tbl_pos_shifting_records");
    $targetShiftTable = posReportMirrorTable($reportDbName, "tbl_pos_shifting_records");
    $missingShiftStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM {$sourceShiftTable} source_shift
        LEFT JOIN {$targetShiftTable} target_shift
          ON target_shift.`Category_Code` <=> source_shift.`Category_Code`
         AND target_shift.`Unit_Code` <=> source_shift.`Unit_Code`
         AND target_shift.`terminal_number` <=> source_shift.`terminal_number`
         AND target_shift.`Shift_ID` <=> source_shift.`Shift_ID`
        WHERE source_shift.`ID` <= ?
          AND source_shift.`Opening_DateTime` >= ?
          AND source_shift.`Opening_DateTime` < ?
          AND target_shift.`ID` IS NULL
    ");
    $missingShiftStmt->execute([
        (string)$job["cutoff_shift_id"],
        (string)$job["period_start"],
        (string)$job["period_end_exclusive"],
    ]);
    if ((int)$missingShiftStmt->fetchColumn() > 0) {
        throw new RuntimeException("Initial report backfill validation found missing shift records.");
    }
}

/** Returns true when one transaction row was processed; false when completed. */
function posReportInitialMonthBackfillProcessNextTransaction(
    PDO $pdo,
    array $config,
    string $posDbName,
    string $reportDbName,
    string $jobKey
): bool {
    $jobTable = posReportInitialMonthBackfillTable($reportDbName);
    $pdo->beginTransaction();
    try {
        $job = posReportInitialMonthBackfillFetchJob($pdo, $reportDbName, $jobKey, true);
        if (strtolower((string)($job["phase"] ?? "")) !== "transactions") {
            $pdo->commit();
            return false;
        }

        $sourceTransaction = posReportInitialMonthBackfillFetchNextTransaction($pdo, $posDbName, $job);
        if (count($sourceTransaction) === 0) {
            if ((int)$job["source_processed_count"] !== (int)$job["source_total_count"]) {
                throw new RuntimeException(
                    "Transaction backfill snapshot changed before all expected rows were processed."
                );
            }
            posReportInitialMonthBackfillValidateCompletion(
                $pdo,
                $posDbName,
                $reportDbName,
                $job
            );
            $stmt = $pdo->prepare("
                UPDATE {$jobTable}
                SET `phase` = 'completed',
                    `status` = 'completed',
                    `source_cursor_id` = `cutoff_source_id`,
                    `heartbeat_at` = CURRENT_TIMESTAMP,
                    `completed_at` = CURRENT_TIMESTAMP,
                    `last_error` = NULL
                WHERE `job_key` = ?
            ");
            $stmt->execute([$jobKey]);
            $pdo->commit();
            return false;
        }

        $sourceId = (string)$sourceTransaction["ID"];
        $transactionId = (string)$sourceTransaction["transaction_id"];
        $categoryCode = (string)$sourceTransaction["Category_Code"];
        $unitCode = (string)$sourceTransaction["Unit_Code"];
        $mapRow = posReportMirrorFetchReportMapBySource(
            $pdo,
            $reportDbName,
            $sourceId,
            $transactionId,
            $categoryCode,
            $unitCode
        );
        $hasExactSourceMap = count($mapRow) > 0
            && (string)($mapRow["source_pos_id"] ?? "") !== ""
            && (int)$mapRow["source_pos_id"] === (int)$sourceId;

        if (!$hasExactSourceMap) {
            // The live save and payment endpoints lock this same source counter
            // row while allocating numbers, so report MAX+1 allocation cannot
            // race a current transaction in the same business scope.
            posReportInitialMonthBackfillLockDocumentCounter(
                $pdo,
                $posDbName,
                $categoryCode,
                $unitCode
            );
            mirrorPosTransactionToReport(
                $pdo,
                $config,
                $transactionId,
                $categoryCode,
                $unitCode,
                true,
                (int)$job["skip_interval"]
            );
        }

        $stmt = $pdo->prepare("
            UPDATE {$jobTable}
            SET `source_cursor_id` = ?,
                `source_processed_count` = `source_processed_count` + 1,
                `heartbeat_at` = CURRENT_TIMESTAMP
            WHERE `job_key` = ?
        ");
        $stmt->execute([$sourceId, $jobKey]);
        $pdo->commit();

        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/**
 * Runs at most one small resumable batch. This function is called only by the
 * explicit secured Settings action and is never used by new/save transaction
 * endpoints.
 */
function posReportInitialMonthBackfillRunBatch(
    PDO $pdo,
    array $config,
    int $batchSize = POS_REPORT_INITIAL_MONTH_BACKFILL_DEFAULT_BATCH_SIZE
): array {
    [$posDbName, $reportDbName] = posReportInitialMonthBackfillDatabaseNames($config);
    $initialState = posReportInitialMonthBackfillReadState($pdo, $config);

    if (in_array($initialState["status"], ["completed", "migration_required"], true)) {
        return $initialState;
    }

    $batchSize = posReportInitialMonthBackfillNormalizeBatchSize($batchSize);
    $jobKey = posReportInitialMonthBackfillJobKey($posDbName, $reportDbName);
    $lockName = posReportInitialMonthBackfillLockName($jobKey);

    if (!posReportInitialMonthBackfillAcquireJobLock($pdo, $lockName)) {
        $state = posReportInitialMonthBackfillReadState($pdo, $config);
        $state["busy"] = true;
        return $state;
    }

    $runError = null;
    try {
        $job = posReportInitialMonthBackfillInitializeJob(
            $pdo,
            $config,
            $posDbName,
            $reportDbName,
            $jobKey
        );
        if (strtolower((string)($job["status"] ?? "")) === "completed") {
            return posReportInitialMonthBackfillReadState($pdo, $config);
        }

        posReportInitialMonthBackfillMarkRunning($pdo, $reportDbName, $jobKey);
        $workCount = 0;

        while ($workCount < $batchSize) {
            $job = posReportInitialMonthBackfillFetchJob($pdo, $reportDbName, $jobKey);
            $phase = strtolower((string)($job["phase"] ?? ""));

            if ($phase === "shifts") {
                if (posReportInitialMonthBackfillProcessNextShift(
                    $pdo,
                    $posDbName,
                    $reportDbName,
                    $jobKey
                )) {
                    $workCount++;
                }
                continue;
            }

            if ($phase === "transactions") {
                if (posReportInitialMonthBackfillProcessNextTransaction(
                    $pdo,
                    $config,
                    $posDbName,
                    $reportDbName,
                    $jobKey
                )) {
                    $workCount++;
                    continue;
                }
                break;
            }

            if ($phase === "completed") {
                break;
            }

            throw new RuntimeException("Initial report backfill has an invalid saved phase.");
        }
    } catch (Throwable $e) {
        $runError = $e;
        try {
            posReportInitialMonthBackfillMarkFailed($pdo, $reportDbName, $jobKey, $e);
        } catch (Throwable $markError) {
            error_log("Unable to persist initial report backfill failure: " . $markError->getMessage());
        }
        error_log("Initial report backfill error: " . $e->getMessage());
    } finally {
        posReportInitialMonthBackfillReleaseJobLock($pdo, $lockName);
    }

    $state = posReportInitialMonthBackfillReadState($pdo, $config);
    if ($runError !== null && ($state["status"] ?? "") !== "failed") {
        $state["status"] = "failed";
        $state["last_error"] = $runError->getMessage() !== ""
            ? $runError->getMessage()
            : "Initial report backfill failed.";
        $state["has_more"] = false;
    }

    return $state;
}

function posReportInitialMonthBackfillParseDate(?string $value): ?DateTimeImmutable
{
    $value = trim((string)$value);
    if ($value === "") {
        return null;
    }

    $date = DateTimeImmutable::createFromFormat("!Y-m-d", $value, new DateTimeZone("Asia/Manila"));
    if (!$date || $date->format("Y-m-d") !== $value) {
        return null;
    }

    return $date;
}

/** Pure range helper used by Z-reading DB selection. */
function posReportInitialMonthBackfillRangeOverlaps(
    array $state,
    ?string $dateFrom,
    ?string $dateTo = null
): bool {
    $rangeStart = posReportInitialMonthBackfillParseDate($dateFrom);
    $rangeEnd = posReportInitialMonthBackfillParseDate($dateTo ?: $dateFrom);
    $periodStart = posReportInitialMonthBackfillParseDate(
        isset($state["period_start"]) ? (string)$state["period_start"] : null
    );
    $periodEndExclusive = posReportInitialMonthBackfillParseDate(
        isset($state["period_end_exclusive"]) ? (string)$state["period_end_exclusive"] : null
    );

    if (!$rangeStart || !$rangeEnd || !$periodStart || !$periodEndExclusive) {
        return false;
    }
    if ($rangeEnd < $rangeStart) {
        [$rangeStart, $rangeEnd] = [$rangeEnd, $rangeStart];
    }

    return $rangeStart < $periodEndExclusive && $rangeEnd >= $periodStart;
}

function posReportInitialMonthBackfillRequiresPrimaryForRange(
    array $state,
    ?string $dateFrom,
    ?string $dateTo = null
): bool {
    return strtolower((string)($state["status"] ?? "pending")) !== "completed"
        && posReportInitialMonthBackfillRangeOverlaps($state, $dateFrom, $dateTo);
}
