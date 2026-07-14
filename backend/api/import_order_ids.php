<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$config = require __DIR__ . "/config.php";

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Connection failed: " . $e->getMessage()
    ]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$orderIds = isset($input['order_ids']) && is_array($input['order_ids']) ? $input['order_ids'] : [];

if (empty($orderIds)) {
    echo json_encode(["status" => "error", "message" => "No Order IDs found in the request."]);
    exit;
}

try {
    $pdo->beginTransaction();
    
    // Gumamit ng INSERT IGNORE para hindi mag-error kung may duplicate ID na sa database
    $stmt = $pdo->prepare("INSERT IGNORE INTO tbl_order_id (order_id) VALUES (:id)");
    
    foreach ($orderIds as $id) {
        $stmt->execute([':id' => $id]);
    }

    $pdo->commit();
    echo json_encode(["status" => "success", "message" => count($orderIds) . " Order IDs processed successfully."]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}