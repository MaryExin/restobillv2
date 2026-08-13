<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require __DIR__ . "/secure_guard.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: POST, OPTIONS");
    echo json_encode(["error" => "Method not allowed."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$data = is_array($data) ? $data : [];
$type = trim((string)($data['type'] ?? ''));
$permissionByType = [
    "customers" => "customers",
    "all" => "logs",
];

if (!isset($permissionByType[$type])) {
    http_response_code(422);
    echo json_encode(["error" => "A valid report type is required."]);
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";
posRoleAuthRequirePermission(
    $pdo,
    (string)($GLOBALS["pos_user_id"] ?? ""),
    "reports",
    $permissionByType[$type]
);

require_once __DIR__ . '/report_db.php';

try {
    $dateFrom = $data['dateFrom'] ?? date('Y-m-d');
    $dateTo = $data['dateTo'] ?? date('Y-m-d');
    $conn = getReportPdo($dateFrom, $dateTo);

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
