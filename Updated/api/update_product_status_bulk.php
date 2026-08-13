<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

$config = include 'config.php';
$conn = new mysqli($config['host'], $config['user'], $config['pass'], $config['db']);

if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Database error"]);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

// 1. Double check kung may IDs, status, at category
if (
    !empty($data->product_ids) && 
    is_array($data->product_ids) && 
    isset($data->status) && 
    !empty($data->item_category) 
) {
    
    $dbStatus = ($data->status === "1") ? "Active" : "Inactive";
    $clean_category = $conn->real_escape_string($data->item_category);
    
    
    $clean_ids = array_map('intval', $data->product_ids);
    $ids_string = implode(',', $clean_ids);

    
    $query = "UPDATE tbl_inventory_products_masterlist 
              SET Status = '$dbStatus' 
              WHERE product_id IN ($ids_string) 
              AND item_category = '$clean_category'";
    
    if ($conn->query($query)) {
        $affected = $conn->affected_rows;
        echo json_encode([
            "status" => "success", 
            "message" => "$affected items updated in $clean_category."
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => $conn->error]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Missing parameters (IDs, Status, or Category)."]);
}

$conn->close();
?>