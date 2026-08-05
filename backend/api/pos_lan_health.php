<?php
require_once __DIR__ . "/cors.php";

header("Content-Type: application/json; charset=UTF-8");
date_default_timezone_set("Asia/Manila");

try {
    $config = require __DIR__ . "/config.php";

    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config["user"], $config["pass"], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    $pdo->query("SELECT 1");

    $unit = null;
    try {
        $stmt = $pdo->query("
            SELECT Unit_Name, Unit_Code, Category_Code
            FROM tbl_main_business_units
            ORDER BY id DESC
            LIMIT 1
        ");
        $unit = $stmt ? $stmt->fetch() : null;
    } catch (Throwable $ignored) {
        $unit = null;
    }

    echo json_encode([
        "success" => true,
        "status" => "ok",
        "message" => "LAN API and database are reachable.",
        "server_time" => date("c"),
        "client_ip" => $_SERVER["REMOTE_ADDR"] ?? "",
        "database" => $config["db"] ?? "",
        "unit_name" => $unit["Unit_Name"] ?? null,
        "unit_code" => $unit["Unit_Code"] ?? null,
        "category_code" => $unit["Category_Code"] ?? null,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "status" => "error",
        "message" => "LAN API reached Apache, but the database check failed.",
        "details" => $e->getMessage(),
    ]);
}
