<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$config = require __DIR__ . "/config.php";

try {
    $conn = new PDO(
        "mysql:host={$config['host']};dbname={$config['db']};charset=utf8mb4",
        $config['user'],
        $config['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );

    $sql = "
        SELECT
            seq,
            TRIM(COALESCE(sales_type_id, '')) AS sales_type_id,
            TRIM(COALESCE(description, '')) AS description
        FROM lkp_sales_type
        WHERE TRIM(COALESCE(deletestatus, 'Active')) = 'Active'
          AND TRIM(COALESCE(sales_type_id, '')) <> ''
        ORDER BY TRIM(COALESCE(description, '')) ASC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute();

    echo json_encode([
        "status" => "success",
        "data" => $stmt->fetchAll()
    ]);
} catch (PDOException $e) {
    http_response_code(500);

    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage(),
        "data" => []
    ]);
}