<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$config = require_once('config.php');

$conn = new mysqli($config['host'], $config['user'], $config['pass'], $config['db']);
if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed"]));
}
$conn->set_charset($config['charset']);

$input = file_get_contents("php://input");
$data = json_decode($input);

if (isset($data->type) && isset($data->dateFrom) && isset($data->dateTo)) {
    $type = $data->type; 
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