<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$config = include 'config.php';

$conn = new mysqli(
    $config['host'],
    $config['user'],
    $config['pass'],
    $config['db']
);

if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "DB connection failed."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (empty($data->product_id) || !isset($data->isDiscountable)) {
    echo json_encode(["status" => "error", "message" => "Missing required fields."]);
    $conn->close();
    exit;
}

$val  = ($data->isDiscountable === "Yes") ? "Yes" : "No";
$pid  = $data->product_id;

$stmt = $conn->prepare(
    "UPDATE tbl_inventory_products_masterlist SET isDiscountable = ? WHERE product_id = ?"
);
$stmt->bind_param("ss", $val, $pid);

if ($stmt->execute()) {
    echo json_encode(["status" => "success"]);
} else {
    echo json_encode(["status" => "error", "message" => $stmt->error]);
}

$stmt->close();
$conn->close();
exit;
?>
