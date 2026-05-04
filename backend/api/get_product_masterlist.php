<?php
error_reporting(0);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$config = include 'config.php';

$conn = new mysqli(
    $config['host'], 
    $config['user'], 
    $config['pass'], 
    $config['db']
);

if ($conn->connect_error) {
    echo json_encode([]);
    exit();
}

ob_clean();

$query = "SELECT product_id, item_category, item_name, unit_of_measure, selling_price, Status 
          FROM tbl_inventory_products_masterlist where status = 'Active' 
          ORDER BY item_category ASC, item_name ASC";

$result = $conn->query($query);
$products = [];

if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $row['status'] = (trim($row['Status']) === "Active") ? "1" : "0";
        $row['selling_price'] = (float)$row['selling_price'];
        $products[] = $row;
    }
}

echo json_encode($products);
$conn->close();
exit();
?>