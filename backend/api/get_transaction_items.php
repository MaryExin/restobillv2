<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");

// 1. Load configuration from config.php
$config = require 'config.php';

try {
    // 2. Set up PDO connection
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, $config['user'], $config['pass'], $options);

    // 3. Check if 'id' is provided
    if (isset($_GET['id'])) {
        $transaction_id = $_GET['id'];

        // SQL Query: 
        // - Joins td (detailed) and pm (masterlist) for item details
        // - Joins tp (payments) to get payment method and amount
        $sql = "SELECT 
                    td.product_id,
                    pm.item_name,
                    td.sales_quantity,
                    td.selling_price,
                    (td.sales_quantity * td.selling_price) AS subtotal,
                    tp.payment_method,
                    tp.payment_amount
                FROM tbl_pos_transactions_detailed td
                LEFT JOIN tbl_inventory_products_masterlist pm 
                    ON td.product_id = pm.product_id
                LEFT JOIN tbl_pos_transactions_payments tp
                    ON td.transaction_id = tp.transaction_id
                WHERE td.transaction_id = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $transaction_id]);
        $items = $stmt->fetchAll();

        if ($items) {
            echo json_encode([
                "success" => true,
                "data" => $items
            ]);
        } else {
            echo json_encode([
                "success" => false,
                "message" => "No records found for this transaction ID."
            ]);
        }
    } else {
        echo json_encode([
            "success" => false,
            "message" => "No Transaction ID provided."
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database Error: " . $e->getMessage()
    ]);
}
?>