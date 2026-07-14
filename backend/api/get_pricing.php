<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

$config = require 'config.php';

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    
    $pdo = new PDO($dsn, $config['user'], $config['pass'], $options);

    // Query na may WHERE clause para sa Active status
    $sql = "SELECT 
                i.product_id AS inv_code,
                i.item_name AS item_description,
                i.item_category, 
                p.cost_per_uom, 
                p.srp, 
                t.description AS service_type
            FROM tbl_pricing_details AS p
            INNER JOIN tbl_inventory_products_masterlist AS i 
                ON p.inv_code = i.product_id
            INNER JOIN tbl_pricing_by_sales_type AS s 
                ON p.pricing_code = s.pricing_category
            INNER JOIN lkp_sales_type AS t
                ON s.sales_type_id = t.sales_type_id
            WHERE p.deletestatus = 'Active'
            ORDER BY i.item_category ASC, i.item_name ASC";

    $stmt = $pdo->query($sql);
    $data = $stmt->fetchAll();

    echo json_encode($data);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>