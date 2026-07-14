<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Load Configuration
$config = require 'config.php';

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        
        try {
            // Disable Foreign Key Checks to allow truncation of linked tables
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");

            $tables = [
                'tbl_main_activity_logs',
                'tbl_main_transaction_logs',
                'tbl_pos_ledger',
                'tbl_pos_shifting_records',
                'tbl_pos_transactions',
                'tbl_pos_transactions_customers',
                'tbl_pos_transactions_detailed',
                'tbl_pos_transactions_discounts',
                'tbl_pos_transactions_discounts_per_product',
                'tbl_pos_transactions_other_charges',
                'tbl_pos_transactions_payments',
                'tbl_pos_document_counters' // Eto yung nate-truncate kaya nawawalan ng laman
            ];

            foreach ($tables as $table) {
                $pdo->exec("TRUNCATE TABLE `$table`;");
            }

            // --- INSERT NEW COUNTER VALUES WITH CODES FROM BUSINESS UNITS ---
            // Gumamit ng SELECT para makuha ang Category_Code at Unit_Code
            $sql = "INSERT INTO tbl_pos_document_counters (
                        Category_Code,
                        Unit_Code,
                        next_billing_no, 
                        next_invoice_no, 
                        next_transaction_id, 
                        next_order_slip_no,
                        next_refund_id,
                        next_void_id
                    ) 
                    SELECT 
                        Category_Code, 
                        Unit_Code, 
                        :billing, 
                        :invoice, 
                        :trans_id, 
                        :order_slip, 
                        :refund_id, 
                        :void_id 
                    FROM tbl_main_business_units 
                    LIMIT 1"; // LIMIT 1 kung isang row lang ang laman o kailangan mo
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':billing'    => 3000000001,
                ':invoice'    => 4000000001,
                ':trans_id'   => 1000000001,
                ':order_slip' => 2000000001,
                ':refund_id'  => 9000000001,
                ':void_id'    => 8000000001
            ]);
            
            echo json_encode([
                "status" => "success", 
                "message" => "All tables truncated. Document counters reset with Category and Unit codes."
            ]);

        } catch (Exception $inner) {
            echo json_encode([
                "status" => "error", 
                "message" => "Process failed: " . $inner->getMessage()
            ]);
        } finally {
            // Siguradong magra-run ito kahit mag-error ang nasa itaas
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
        }

    } else {
        http_response_code(405);
        echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    }
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database Connection Error: " . $e->getMessage()]);
}
?>