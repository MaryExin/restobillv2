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

$input = file_get_contents("php://input");
$data = json_decode($input);
$type = is_object($data) ? trim((string)($data->type ?? "")) : "";
$permissionByType = [
    "voids" => "voids",
    "refunds" => "refunds",
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

$conn = getReportMysqli($data->dateFrom ?? null, $data->dateTo ?? null);

if (isset($data->type) && isset($data->dateFrom) && isset($data->dateTo)) {
    $dateFrom = $data->dateFrom;
    $dateTo = $data->dateTo;

    // Mapping columns
    if ($type === 'voids') {
        $idCol = 'void_id';
        $dateCol = 'void_date';
        $remCol = 'void_remarks';
    } else {
        // Double check mo sa DB kung refund_id o refund_by ang tawag
        $idCol = 'refund_id'; 
        $dateCol = 'refund_date';
        $remCol = 'refund_remarks';
    }

    // Ang fix: Sinigurado na hindi '0', hindi NULL, at hindi empty string
    $query = "SELECT 
                $dateCol as report_date, 
                invoice_no, 
                cashier, 
                TotalAmountDue, 
                $idCol as auth_id, 
                $remCol as remarks 
              FROM tbl_pos_transactions 
              WHERE $idCol IS NOT NULL 
              AND $idCol != '0' 
              AND $idCol != ''
              AND DATE($dateCol) BETWEEN ? AND ?
              ORDER BY $dateCol DESC";

    $stmt = $conn->prepare($query);
    $stmt->bind_param("ss", $dateFrom, $dateTo);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $rows = [];
    while($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    echo json_encode($rows);
} else {
    echo json_encode(["error" => "Missing parameters"]);
}
$conn->close();
?>
