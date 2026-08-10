<?php

declare(strict_types=1);

require_once __DIR__ . "/pos_report_mirror.php";

const POS_REPORT_MIRROR_ACTIVATION_TABLE = "tbl_pos_report_mirror_activation";
const POS_REPORT_MIRROR_ACTIVATION_VERSION = "skip_activation_v1";

function posReportMirrorActivationDatabaseNames(array $config): array
{
    return [
        posReportMirrorIdentifier($config["db"] ?? "db_cnc_pos", "POS database name"),
        posReportMirrorIdentifier(
            $config["report_db"] ?? "reports_database",
            "report database name"
        ),
    ];
}

function posReportMirrorActivationKey(string $posDbName, string $reportDbName): string
{
    return POS_REPORT_MIRROR_ACTIVATION_VERSION . "_" . hash(
        "sha256",
        strtolower($posDbName . "|" . $reportDbName)
    );
}

function posReportMirrorActivationTable(string $reportDbName): string
{
    return posReportMirrorTable($reportDbName, POS_REPORT_MIRROR_ACTIVATION_TABLE);
}

function posReportMirrorActivationTableExists(PDO $pdo, string $reportDbName): bool
{
    try {
        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = ?
        ");
        $stmt->execute([$reportDbName, POS_REPORT_MIRROR_ACTIVATION_TABLE]);

        return (int)$stmt->fetchColumn() > 0;
    } catch (Throwable $error) {
        error_log(
            "Unable to verify POS report activation schema: " .
            $error->getMessage()
        );
        return false;
    }
}

function posReportMirrorActivationSchemaReady(PDO $pdo, string $reportDbName): bool
{
    return posReportMirrorMapActivationMembershipReady($pdo, $reportDbName);
}

function posReportMirrorActivationFetch(
    PDO $pdo,
    string $reportDbName,
    string $activationKey,
    bool $forUpdate = false
): array {
    $table = posReportMirrorActivationTable($reportDbName);
    $sql = "
        SELECT
            `id`,
            `activation_key`,
            `source_database`,
            `report_database`,
            `activation_business_date`,
            `activated_at`,
            CAST(`activation_source_pos_id` AS CHAR) AS activation_source_pos_id,
            `activation_transaction_id`,
            `initial_skip_interval`,
            CAST(`last_sequence` AS CHAR) AS last_sequence,
            `created_at`,
            `updated_at`
        FROM {$table}
        WHERE `activation_key` = ?
        LIMIT 1
    ";
    if ($forUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$activationKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return is_array($row) ? $row : [];
}

function posReportMirrorActivationPublicState(
    array $row,
    string $posDbName,
    string $reportDbName,
    array $overrides = []
): array {
    $active = count($row) > 0;
    $state = [
        "status" => $active ? "active" : "waiting_for_first_skipped_transaction",
        "active" => $active,
        "migration_required" => false,
        "source_database" => $posDbName,
        "report_database" => $reportDbName,
        "activation_key" => $row["activation_key"] ?? null,
        "activation_business_date" => $row["activation_business_date"] ?? null,
        "activated_at" => $row["activated_at"] ?? null,
        "activation_source_pos_id" => (string)($row["activation_source_pos_id"] ?? "0"),
        "activation_transaction_id" => $row["activation_transaction_id"] ?? null,
        "initial_skip_interval" => isset($row["initial_skip_interval"])
            ? (int)$row["initial_skip_interval"]
            : null,
        "last_sequence" => (string)($row["last_sequence"] ?? "0"),
        "source_sequence" => null,
        "claimed" => false,
    ];

    foreach ($overrides as $key => $value) {
        $state[$key] = $value;
    }

    return $state;
}

/** Constant-time state lookup; it never scans POS transaction history. */
function posReportMirrorActivationReadState(PDO $pdo, array $config): array
{
    [$posDbName, $reportDbName] = posReportMirrorActivationDatabaseNames($config);
    if (strcasecmp($posDbName, $reportDbName) === 0) {
        return posReportMirrorActivationPublicState([], $posDbName, $reportDbName, [
            "status" => "not_required",
        ]);
    }

    if (!posReportMirrorActivationSchemaReady($pdo, $reportDbName)) {
        return posReportMirrorActivationPublicState([], $posDbName, $reportDbName, [
            "status" => "migration_required",
            "migration_required" => true,
        ]);
    }

    $key = posReportMirrorActivationKey($posDbName, $reportDbName);
    $row = posReportMirrorActivationFetch($pdo, $reportDbName, $key);

    return posReportMirrorActivationPublicState($row, $posDbName, $reportDbName);
}

/**
 * Claims the immutable activation marker and allocates the next skip sequence.
 * It must run inside the same transaction as the new POS row and report mirror.
 * No transaction-history COUNT/MAX query is performed.
 */
function posReportMirrorActivationClaimAndNextSequence(
    PDO $pdo,
    array $config,
    string $sourcePosId,
    string $sourceTransactionId,
    string $sourceTransactionDate,
    int $skipInterval
): array {
    if (!$pdo->inTransaction()) {
        throw new RuntimeException("Report mirror activation must run inside the sale transaction.");
    }
    $sourcePosId = trim($sourcePosId);
    $sourceTransactionId = trim($sourceTransactionId);
    $sourceTransactionDate = trim($sourceTransactionDate);
    if ($sourcePosId === "" || preg_match('/^\d+$/', $sourcePosId) !== 1 || $sourcePosId === "0") {
        throw new InvalidArgumentException("A valid source POS row ID is required.");
    }
    if ($sourceTransactionId === "") {
        throw new InvalidArgumentException("A source transaction ID is required.");
    }
    $timezone = new DateTimeZone("Asia/Manila");
    $businessDate = DateTimeImmutable::createFromFormat(
        "!Y-m-d",
        $sourceTransactionDate,
        $timezone
    );
    if (!$businessDate || $businessDate->format("Y-m-d") !== $sourceTransactionDate) {
        throw new InvalidArgumentException("A valid source transaction date is required.");
    }
    if ($skipInterval < 0 || $skipInterval === 1 || $skipInterval > 1000000) {
        throw new InvalidArgumentException("Invalid report mirror skip interval.");
    }

    [$posDbName, $reportDbName] = posReportMirrorActivationDatabaseNames($config);
    if (strcasecmp($posDbName, $reportDbName) === 0) {
        return posReportMirrorActivationPublicState([], $posDbName, $reportDbName, [
            "status" => "not_required",
        ]);
    }
    if (!posReportMirrorActivationSchemaReady($pdo, $reportDbName)) {
        return posReportMirrorActivationPublicState([], $posDbName, $reportDbName, [
            "status" => "migration_required",
            "migration_required" => true,
        ]);
    }

    $key = posReportMirrorActivationKey($posDbName, $reportDbName);
    // Read without a gap lock first. Concurrent first saves then serialize on
    // INSERT IGNORE's unique key instead of deadlocking while both hold an
    // empty-range FOR UPDATE lock.
    $row = posReportMirrorActivationFetch($pdo, $reportDbName, $key);
    $claimed = false;

    // A disabled skip setting does not start the boundary. Full mirroring may
    // continue, and the first later save with N >= 2 creates sequence 1.
    if (count($row) === 0 && $skipInterval === 0) {
        return posReportMirrorActivationPublicState([], $posDbName, $reportDbName);
    }

    if (count($row) === 0) {
        $now = new DateTimeImmutable("now", $timezone);
        $table = posReportMirrorActivationTable($reportDbName);
        $insert = $pdo->prepare("
            INSERT IGNORE INTO {$table} (
                `activation_key`,
                `source_database`,
                `report_database`,
                `activation_business_date`,
                `activated_at`,
                `activation_source_pos_id`,
                `activation_transaction_id`,
                `initial_skip_interval`,
                `last_sequence`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ");
        $insert->execute([
            $key,
            $posDbName,
            $reportDbName,
            $businessDate->format("Y-m-d"),
            $now->format("Y-m-d H:i:s"),
            $sourcePosId,
            $sourceTransactionId,
            $skipInterval,
        ]);
        $claimed = $insert->rowCount() === 1;
    }

    $row = posReportMirrorActivationFetch($pdo, $reportDbName, $key, true);

    if (count($row) === 0) {
        throw new RuntimeException("Unable to claim the report mirror activation marker.");
    }

    $table = posReportMirrorActivationTable($reportDbName);
    $update = $pdo->prepare("
        UPDATE {$table}
        SET `last_sequence` = `last_sequence` + 1
        WHERE `activation_key` = ?
    ");
    $update->execute([$key]);
    $sequence = (int)($row["last_sequence"] ?? 0) + 1;
    $row["last_sequence"] = (string)$sequence;

    return posReportMirrorActivationPublicState($row, $posDbName, $reportDbName, [
        "claimed" => $claimed,
        "source_sequence" => $sequence,
    ]);
}

/** Pure half-open date plan used by monthly Z-reading and tests. */
function posReportMirrorActivationPlanRange(
    string $dateFrom,
    string $dateTo,
    string $activationDate
): array {
    $timezone = new DateTimeZone("Asia/Manila");
    $parse = static function (string $value) use ($timezone): DateTimeImmutable {
        $date = DateTimeImmutable::createFromFormat("!Y-m-d", trim($value), $timezone);
        if (!$date || $date->format("Y-m-d") !== trim($value)) {
            throw new InvalidArgumentException("Invalid report date.");
        }
        return $date;
    };

    $start = $parse($dateFrom);
    $endExclusive = $parse($dateTo)->modify("+1 day");
    $activation = $parse($activationDate);
    if ($endExclusive <= $start) {
        throw new InvalidArgumentException("Report end date must not be before start date.");
    }

    $segments = [];
    $primaryEnd = $endExclusive < $activation ? $endExclusive : $activation;
    if ($start < $primaryEnd) {
        $segments[] = [
            "source" => "primary",
            "start" => $start->format("Y-m-d"),
            "end_exclusive" => $primaryEnd->format("Y-m-d"),
        ];
    }

    $reportStart = $start > $activation ? $start : $activation;
    if ($reportStart < $endExclusive) {
        $segments[] = [
            "source" => "report",
            "start" => $reportStart->format("Y-m-d"),
            "end_exclusive" => $endExclusive->format("Y-m-d"),
        ];
    }

    return $segments;
}
