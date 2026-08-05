<?php
// Picks which DB config a report endpoint should read from, based on the
// report date(s) being requested:
// - any requested date before today -> report_db (backup archive db)
// - dates that are all today (or no date given)  -> db (live db)

function reportDbShouldUseArchive(?string $dateFrom, ?string $dateTo = null): bool
{
    $today = date("Y-m-d");
    $dateFrom = trim((string)$dateFrom);
    $dateTo = trim((string)$dateTo);

    if ($dateFrom === "" && $dateTo === "") {
        return false;
    }
    if ($dateFrom === "") {
        $dateFrom = $dateTo;
    }
    if ($dateTo === "") {
        $dateTo = $dateFrom;
    }

    return $dateFrom < $today || $dateTo < $today;
}

function resolveReportDbConfig(array $config, ?string $dateFrom, ?string $dateTo = null): array
{
    $dbConfig = $config;

    if (reportDbShouldUseArchive($dateFrom, $dateTo)) {
        $dbConfig["db"] = $config["report_db"] ?? $config["db"];
    }

    return $dbConfig;
}

function getReportPdo(?string $dateFrom, ?string $dateTo = null): PDO
{
    $config = require __DIR__ . "/config.php";
    $dbConfig = resolveReportDbConfig($config, $dateFrom, $dateTo);

    $dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['db']};charset={$dbConfig['charset']}";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        return new PDO($dsn, $dbConfig["user"], $dbConfig["pass"], $options);
    } catch (PDOException $e) {
        http_response_code(500);
        header("Content-Type: application/json");
        echo json_encode(["error" => "DB connection failed", "details" => $e->getMessage()]);
        exit;
    }
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
