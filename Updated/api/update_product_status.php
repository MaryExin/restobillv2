<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

$config = include 'config.php';

$conn = new mysqli(
    $config['host'], 
    $config['user'], 
    $config['pass'], 
    $config['db']
);

if ($conn->connect_error) {
    echo json_encode(["status" => "error"]);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->product_id) && isset($data->status)) {
    $dbStatus = ($data->status === "1") ? "Active" : "Inactive";
    $stmt = $conn->prepare("UPDATE tbl_inventory_products_masterlist SET Status = ? WHERE product_id = ?");
    $stmt->bind_param("ss", $dbStatus, $data->product_id);
    
    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error"]);
    }
    $stmt->close();
}

$conn->close();
exit();
?>