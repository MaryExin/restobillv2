<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$config = require __DIR__ . "/config.php";

$conn = new mysqli(
    $config["host"],
    $config["user"],
    $config["pass"],
    $config["db"]
);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

    $sql = "SELECT DISTINCT item_category FROM tbl_inventory_products_masterlist ORDER BY item_category ASC";


$result = $conn->query($sql);

$data = array();

while($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);
$conn->close();
?>