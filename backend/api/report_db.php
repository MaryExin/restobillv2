<?php
// Picks which DB config a report endpoint should read from:
// - superadmin -> archive_db (db_mark)
// - everyone else (cashier, etc.) -> main_db (db_cnc_pos)

function resolveReportDbConfig(array $config, ?string $role): array
{
    $role = strtolower(trim((string)$role));
    return $role === "superadmin" ? $config["archive_db"] : $config["main_db"];
}

function getReportPdo(?string $role): PDO
{
    $config = require __DIR__ . "/config.php";
    $dbConfig = resolveReportDbConfig($config, $role);

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

function getReportMysqli(?string $role): mysqli
{
    $config = require __DIR__ . "/config.php";
    $dbConfig = resolveReportDbConfig($config, $role);

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
