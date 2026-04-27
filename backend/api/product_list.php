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

$categorys = $_GET['category'];

    $sql = "SELECT product_id, item_name, item_category, unit_of_measure, selling_price, isDiscountable, vatable FROM tbl_inventory_products_masterlist WHERE item_category = '$categorys'";

$result = $conn->query($sql);

$data = array();

while($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);
$conn->close();
?>