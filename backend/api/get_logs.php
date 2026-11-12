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
        // Customer registry (tbl_pos_customers): guests from orders,
        // reservations and discount cards. A customer is listed when they were
        // registered, ordered or had a reservation inside the date range;
        // transaction count and amount are for the range, visits are all-time.
        // Discount customers saved before the registry existed are appended
        // from tbl_pos_transactions_discounts unless a registered customer
        // already carries that name.
        require_once __DIR__ . "/pos_customers.php";
        posEnsureCustomersTable($conn);
        posEnsureGuestColumns($conn);
        $hasReservations = $conn->query("SHOW TABLES LIKE 'tbl_pos_reservations'")->fetchColumn() !== false;
        $reservationClause = $hasReservations
            ? "OR EXISTS (
                            SELECT 1 FROM tbl_pos_reservations r
                            WHERE r.customer_code = c.customer_code
                              AND r.reservation_date BETWEEN :dateFromR AND :dateToR
                          )"
            : "";
        $sql = "(SELECT
                    c.customer_code AS 'Customer Code',
                    c.full_name AS 'Customer Name',
                    IF(c.contact_number = '', 'N/A', c.contact_number) AS 'Phone',
                    IF(c.address = '', 'N/A', c.address) AS 'Address',
                    IF(c.email = '', 'N/A', c.email) AS 'Email',
                    c.source AS 'Source',
                    DATE_FORMAT(c.date_recorded, '%Y-%m-%d') AS 'Registered',
                    DATE_FORMAT(c.last_visit, '%Y-%m-%d') AS 'Last Visit',
                    c.visit_count AS 'Visits',
                    c.notes AS 'Notes',
                    COUNT(t.transaction_id) AS 'Total Transactions',
                    IFNULL(SUM(CASE WHEN t.remarks = 'Paid' AND t.status = 'Active'
                                    THEN t.TotalAmountDue ELSE 0 END), 0) AS 'Total Spent'
                FROM tbl_pos_customers c
                LEFT JOIN tbl_pos_transactions t
                       ON t.guest_customer_code = c.customer_code
                      AND t.transaction_date BETWEEN :dateFromT AND :dateToT
                WHERE c.status = 'Active'
                  AND (t.transaction_id IS NOT NULL
                       OR DATE(c.date_recorded) BETWEEN :dateFromC AND :dateToC
                       {$reservationClause})
                GROUP BY c.ID, c.customer_code, c.full_name, c.contact_number, c.address, c.email,
                         c.source, c.date_recorded, c.last_visit, c.visit_count, c.notes)
                UNION ALL
                (SELECT
                    '' AS 'Customer Code',
                    d.customer_name AS 'Customer Name',
                    IFNULL(NULLIF(d.contact_no, ''), 'N/A') AS 'Phone',
                    'N/A' AS 'Address',
                    'N/A' AS 'Email',
                    'discount' AS 'Source',
                    DATE_FORMAT(MIN(d.created_at), '%Y-%m-%d') AS 'Registered',
                    DATE_FORMAT(MAX(d.created_at), '%Y-%m-%d') AS 'Last Visit',
                    COUNT(DISTINCT d.transaction_id) AS 'Visits',
                    '' AS 'Notes',
                    COUNT(DISTINCT d.transaction_id) AS 'Total Transactions',
                    0 AS 'Total Spent'
                FROM tbl_pos_transactions_discounts d
                WHERE d.customer_name IS NOT NULL
                  AND d.customer_name <> ''
                  AND DATE(d.created_at) BETWEEN :dateFromD AND :dateToD
                  AND NOT EXISTS (
                        SELECT 1 FROM tbl_pos_customers c2
                        WHERE c2.full_name = d.customer_name
                  )
                GROUP BY d.customer_name, d.contact_no)
                ORDER BY `Total Transactions` DESC, `Last Visit` DESC, `Customer Name` ASC";
        $params = [
            ':dateFromT' => $dateFrom,
            ':dateToT' => $dateTo,
            ':dateFromC' => $dateFrom,
            ':dateToC' => $dateTo,
            ':dateFromD' => $dateFrom,
            ':dateToD' => $dateTo,
        ];
        if ($hasReservations) {
            $params[':dateFromR'] = $dateFrom;
            $params[':dateToR'] = $dateTo;
        }
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
        $params = [':dateFrom' => $dateFrom, ':dateTo' => $dateTo];
    }

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    echo json_encode($stmt->fetchAll());

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>
