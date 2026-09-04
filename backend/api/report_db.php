<?php
require_once __DIR__ . "/pos_report_mirror_activation.php";

// Picks which DB config a report endpoint should read from, based on the
// report date(s) being requested:
// - any requested date before today -> report_db (backup archive db)
// - dates that are all today (or no date given)  -> db (live db)

function reportDbShouldUseArchive(?string $dateFrom, ?string $dateTo = null): bool
{
    // Report viewing always reads the live POS database (config "db"), never
    // the archive/report_db. The archive mirror can lag or stall (its sync is
    // a separate write-side concern), which must never cause reports to show
    // stale or incomplete data for dates that already exist in the live db.
    return false;
}

function resolveReportDbConfig(array $config, ?string $dateFrom, ?string $dateTo = null): array
{
    $dbConfig = $config;

    if (reportDbShouldUseArchive($dateFrom, $dateTo)) {
        $dbConfig["db"] = $config["report_db"] ?? $config["db"];
    }

    return $dbConfig;
}

function reportDbConnectPdo(array $dbConfig): PDO
{
    $dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['db']};charset={$dbConfig['charset']}";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        return new PDO($dsn, $dbConfig["user"], $dbConfig["pass"], $options);
    } catch (PDOException $e) {
        error_log("Report database connection failed: " . $e->getMessage());
        throw new RuntimeException("Unable to connect to the report database.");
    }
}

function getReportPdo(?string $dateFrom, ?string $dateTo = null): PDO
{
    $config = require __DIR__ . "/config.php";
    return reportDbConnectPdo(resolveReportDbConfig($config, $dateFrom, $dateTo));
}

/** Opens the configured report database even when the requested date is today. */
function getConfiguredReportPdo(): PDO
{
    $config = require __DIR__ . "/config.php";
    $dbConfig = $config;
    $dbConfig["db"] = $config["report_db"] ?? $config["db"];

    return reportDbConnectPdo($dbConfig);
}

/**
 * A Z-reading exists when the selected database has a closed shift with a
 * non-zero Z counter for the exact business unit, terminal, and date range.
 * Transaction count is intentionally not used because a zero-sales shift is
 * still a valid Z-reading.
 */
function reportDbHasClosedZReading(
    PDO $pdo,
    string $dateFrom,
    ?string $dateTo,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber
): bool {
    $dateFrom = trim($dateFrom);
    $dateTo = trim((string)$dateTo);
    if ($dateTo === "") {
        $dateTo = $dateFrom;
    }

    $stmt = $pdo->prepare("
        SELECT 1
        FROM tbl_pos_shifting_records
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(Opening_DateTime) BETWEEN ? AND ?
          AND IFNULL(Z_Counter_No, 0) <> 0
        LIMIT 1
    ");
    $stmt->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $dateFrom,
        $dateTo,
    ]);

    return $stmt->fetchColumn() !== false;
}

function reportDbShouldFallbackToPrimary(
    bool $isSuperAdmin,
    bool $archiveRequested,
    bool $archiveHasClosedZReading
): bool {
    return $isSuperAdmin && $archiveRequested && !$archiveHasClosedZReading;
}

/**
 * Only an authenticated Super Admin may select reports_database for a
 * Z-reading. Every other role remains pinned to the already-open primary POS
 * connection, including historical and activation-boundary requests.
 */
function getZReadingReportPdo(
    PDO $primaryPdo,
    ?string $dateFrom,
    ?string $dateTo,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    bool $isSuperAdmin
): PDO {
    $dateFrom = trim((string)$dateFrom);
    $dateTo = trim((string)$dateTo);
    if ($dateFrom === "") {
        $dateFrom = $dateTo;
    }
    if ($dateTo === "") {
        $dateTo = $dateFrom;
    }

    if (!$isSuperAdmin) {
        return $primaryPdo;
    }

    // Once skipping is activated, a crossing range still belongs to the
    // monthly hybrid reader. A non-crossing Super Admin range prefers the
    // report database but may use primary data when the report database
    // genuinely has no closed Z-reading for that day.
    $config = require __DIR__ . "/config.php";
    $activation = posReportMirrorActivationReadState($primaryPdo, $config);
    if (($activation["active"] ?? false) === true) {
        $activationDate = (string)$activation["activation_business_date"];
        if ($dateFrom < $activationDate && $dateTo >= $activationDate) {
            throw new RuntimeException(
                "This Z-reading range crosses the report skipping activation date and requires the monthly split reader."
            );
        }
        $activationReportPdo = getConfiguredReportPdo();
        $reportHasClosedZReading = reportDbHasClosedZReading(
            $activationReportPdo,
            $dateFrom,
            $dateTo,
            $categoryCode,
            $unitCode,
            $terminalNumber
        );

        return $reportHasClosedZReading
            ? $activationReportPdo
            : $primaryPdo;
    }

    $archiveRequested = reportDbShouldUseArchive($dateFrom, $dateTo);
    if (!$archiveRequested) {
        return $primaryPdo;
    }

    $archivePdo = getReportPdo($dateFrom, $dateTo);
    $archiveHasClosedZReading = reportDbHasClosedZReading(
        $archivePdo,
        trim((string)$dateFrom),
        $dateTo,
        $categoryCode,
        $unitCode,
        $terminalNumber
    );

    return reportDbShouldFallbackToPrimary(
        $isSuperAdmin,
        $archiveRequested,
        $archiveHasClosedZReading
    ) ? $primaryPdo : $archivePdo;
}

function getReportMysqli(?string $dateFrom, ?string $dateTo = null): mysqli
{
    $config = require __DIR__ . "/config.php";
    $dbConfig = resolveReportDbConfig($config, $dateFrom, $dateTo);

    $conn = new mysqli($dbConfig["host"], $dbConfig["user"], $dbConfig["pass"], $dbConfig["db"]);
    if ($conn->connect_error) {
        http_response_code(500);
        header("Content-Type: application/json");
        echo json_encode(["error" => "DB connection failed", "details" => $conn->connect_error]);
        exit;
    }
    $conn->set_charset($dbConfig["charset"]);
    return $conn;
}
