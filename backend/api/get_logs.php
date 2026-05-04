<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') exit;

$cfg = require_once 'config.php'; 

try {
    $dsn = "mysql:host={$cfg['host']};dbname={$cfg['db']};charset={$cfg['charset']}";
    $conn = new PDO($dsn, $cfg['user'], $cfg['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $data = json_decode(file_get_contents("php://input"), true);
    $type = $data['type'] ?? 'activity'; 
    $dateFrom = $data['dateFrom'] ?? date('Y-m-d');
    $dateTo = $data['dateTo'] ?? date('Y-m-d');

    if ($type === 'customers') {
        // SQL para sa Customers base sa tbl_pos_transactions_discounts
        $sql = "SELECT 
                    customer_name AS 'Customer Name',
                    IFNULL(contact_no, 'N/A') AS 'Phone',
                    'N/A' AS 'Address',
                    'N/A' AS 'Email',
                    COUNT(transaction_id) AS 'Total Transactions'
                FROM tbl_pos_transactions_discounts
                WHERE customer_name IS NOT NULL 
                AND DATE(created_at) BETWEEN :dateFrom AND :dateTo
                GROUP BY customer_name, contact_no
                ORDER BY COUNT(transaction_id) DESC";
    } else {
        // Default Activity Logs
        $sql = "SELECT 
                    activity_date_time AS 'Date & Time',
                    user_id AS 'User ID',
                    user_name AS 'User Name',
                    activity_performed AS 'Activity',
                    values_of_data AS 'Details'
                FROM tbl_main_activity_logs 
                WHERE DATE(activity_date_time) BETWEEN :dateFrom AND :dateTo 
                ORDER BY activity_date_time DESC";
    }

    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':dateFrom', $dateFrom);
    $stmt->bindParam(':dateTo', $dateTo);
    $stmt->execute();
    
    echo json_encode($stmt->fetchAll());

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>