<?php

declare(strict_types=1);

require __DIR__ . "/secure_guard.php";

if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "POST"], true)) {
    http_response_code(405);
    header("Allow: GET, POST");
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";
require_once __DIR__ . "/pos_report_mirror.php";
require_once __DIR__ . "/pos_report_initial_month_backfill.php";

function reportMirrorSettingsRespond(bool $success, string $message, $data = null, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data,
    ]);
    exit;
}

function reportMirrorSettingsParseSkipInterval($value): int
{
    $value = trim((string)($value ?? ""));

    if ($value === "" || !preg_match('/^\d+$/', $value)) {
        throw new InvalidArgumentException("Skip interval must be 0 or an integer of at least 2.");
    }

    $skipInterval = (int)$value;

    if ($skipInterval === 1 || $skipInterval > 1000000) {
        throw new InvalidArgumentException("Skip interval must be 0 or an integer from 2 to 1000000.");
    }

    return $skipInterval;
}

function reportMirrorSettingsSaveSkipInterval(PDO $pdo, string $databaseName, int $skipInterval): void
{
    $settingsTable = posReportMirrorTable($databaseName, "tbl_pos_settings");
    $existingStmt = $pdo->prepare("
        SELECT `ID`
        FROM {$settingsTable}
        WHERE `category` = ?
          AND `description` = ?
        ORDER BY `ID` DESC
        LIMIT 1
    ");
    $existingStmt->execute([
        POS_REPORT_MIRROR_SETTINGS_CATEGORY,
        POS_REPORT_MIRROR_SKIP_INTERVAL_DESCRIPTION,
    ]);
    $existingId = $existingStmt->fetchColumn();

    if ($existingId) {
        $updateStmt = $pdo->prepare("
            UPDATE {$settingsTable}
            SET `value` = ?
            WHERE `ID` = ?
        ");
        $updateStmt->execute([(string)$skipInterval, (int)$existingId]);
        return;
    }

    $nextIdStmt = $pdo->query("SELECT COALESCE(MAX(`ID`), 0) + 1 FROM {$settingsTable}");
    $nextId = (int)$nextIdStmt->fetchColumn();
    $insertStmt = $pdo->prepare("
        INSERT INTO {$settingsTable} (`ID`, `category`, `description`, `value`)
        VALUES (?, ?, ?, ?)
    ");
    $insertStmt->execute([
        $nextId,
        POS_REPORT_MIRROR_SETTINGS_CATEGORY,
        POS_REPORT_MIRROR_SKIP_INTERVAL_DESCRIPTION,
        (string)$skipInterval,
    ]);
}

function reportMirrorSettingsConfiguredDatabaseNames(array $config): array
{
    $posDbName = posReportMirrorIdentifier($config["db"] ?? "db_cnc_pos", "POS database name");
    $reportDbName = posReportMirrorIdentifier($config["report_db"] ?? "reports_database", "report database name");

    return [$posDbName, $reportDbName];
}

function reportMirrorSettingsRead(
    PDO $pdo,
    array $config,
    ?array $initialMonthBackfill = null
): array
{
    [$posDbName, $reportDbName] = reportMirrorSettingsConfiguredDatabaseNames($config);
    $posValue = posReportMirrorFetchSkipIntervalFromSettings($pdo, $posDbName);
    $reportValue = strcasecmp($posDbName, $reportDbName) === 0
        ? $posValue
        : posReportMirrorFetchSkipIntervalFromSettings($pdo, $reportDbName);
    $effectiveValue = $reportValue ?? $posValue ?? POS_REPORT_MIRROR_DEFAULT_SKIP_INTERVAL;

    return [
        "skip_interval" => $effectiveValue,
        "report_skip_interval" => $effectiveValue,
        "default_skip_interval" => POS_REPORT_MIRROR_DEFAULT_SKIP_INTERVAL,
        "setting_category" => POS_REPORT_MIRROR_SETTINGS_CATEGORY,
        "setting_description" => POS_REPORT_MIRROR_SKIP_INTERVAL_DESCRIPTION,
        "pos_database" => $posDbName,
        "report_database" => $reportDbName,
        "pos_database_value" => $posValue,
        "report_database_value" => $reportValue,
        "synced_to_report_database" => $reportValue !== null && $reportValue === $effectiveValue,
        "initial_month_backfill" => $initialMonthBackfill
            ?? posReportInitialMonthBackfillReadState($pdo, $config),
    ];
}

try {
    posRoleAuthRequirePermission(
        $pdo,
        (string)($GLOBALS["pos_user_id"] ?? ""),
        "settings",
        "reportDatabase"
    );
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        reportMirrorSettingsRespond(true, "Report mirror settings loaded.", reportMirrorSettingsRead($pdo, $config));
    }

    if ($method !== "POST") {
        reportMirrorSettingsRespond(false, "Method not allowed.", null, 405);
    }

    $body = json_decode(file_get_contents("php://input"), true);
    if (!is_array($body)) {
        $body = [];
    }

    $action = strtolower(trim((string)($body["action"] ?? "")));
    if ($action === "run_initial_month_backfill") {
        $rawBatchSize = $body["batch_size"] ?? POS_REPORT_INITIAL_MONTH_BACKFILL_DEFAULT_BATCH_SIZE;
        if (
            !is_int($rawBatchSize) &&
            !(is_string($rawBatchSize) && preg_match('/^\d+$/', trim($rawBatchSize)))
        ) {
            throw new InvalidArgumentException("batch_size must be a positive whole number.");
        }

        $batchSize = (int)$rawBatchSize;
        if ($batchSize <= 0) {
            throw new InvalidArgumentException("batch_size must be a positive whole number.");
        }

        $backfillState = posReportInitialMonthBackfillRunBatch($pdo, $config, $batchSize);
        $responseData = reportMirrorSettingsRead($pdo, $config, $backfillState);

        if (($backfillState["status"] ?? "") === "migration_required") {
            reportMirrorSettingsRespond(
                false,
                "Initial report backfill database migration is required.",
                $responseData,
                409
            );
        }

        if (($backfillState["busy"] ?? false) === true) {
            reportMirrorSettingsRespond(
                false,
                "Initial report backfill is already running.",
                $responseData,
                409
            );
        }

        if (($backfillState["status"] ?? "") === "failed") {
            reportMirrorSettingsRespond(
                false,
                "Initial report backfill stopped and can be resumed.",
                $responseData,
                500
            );
        }

        $message = ($backfillState["status"] ?? "") === "completed"
            ? "Initial current-month report backfill completed."
            : "Initial current-month report backfill batch processed.";
        reportMirrorSettingsRespond(true, $message, $responseData);
    }

    if ($action !== "") {
        throw new InvalidArgumentException("Unsupported report mirror settings action.");
    }

    $rawSkipInterval = $body["skip_interval"] ?? $body["report_skip_interval"] ?? null;
    $skipInterval = reportMirrorSettingsParseSkipInterval($rawSkipInterval);

    [, $reportDbName] = reportMirrorSettingsConfiguredDatabaseNames($config);
    reportMirrorSettingsSaveSkipInterval($pdo, $reportDbName, $skipInterval);

    reportMirrorSettingsRespond(true, "Report mirror settings saved.", reportMirrorSettingsRead($pdo, $config));
} catch (InvalidArgumentException $e) {
    reportMirrorSettingsRespond(false, $e->getMessage(), null, 422);
} catch (Throwable $e) {
    error_log("POS report mirror settings error: " . $e->getMessage());
    reportMirrorSettingsRespond(false, "Unable to process report database settings.", null, 500);
}
