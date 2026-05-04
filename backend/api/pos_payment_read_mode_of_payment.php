<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require __DIR__ . "/pdo.php";

try {
    $sql = "
        SELECT
            seq,
            mop_id,
            mop,
            sl_code
        FROM tbl_mode_of_payment
        ORDER BY seq ASC
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "message" => "Mode of payment fetched successfully.",
        "modes" => $rows,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "modes" => [],
    ]);
}