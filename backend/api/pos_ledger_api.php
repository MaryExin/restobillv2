<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { exit; }

$db = require_once 'config.php'; 
$conn = new mysqli($db['host'], $db['user'], $db['pass'], $db['db']);
if (isset($db['charset'])) { $conn->set_charset($db['charset']); }

$action = $_GET['action'] ?? '';

function getShiftDate($conn) {
    $sql = "SELECT Opening_DateTime FROM tbl_pos_shifting_records WHERE Shift_Status = 'Open' ORDER BY id DESC LIMIT 1";
    $res = $conn->query($sql);
    return ($res && $res->num_rows > 0) ? date('Y-m-d', strtotime($res->fetch_assoc()['Opening_DateTime'])) : date('Y-m-d');
}

// --- ACTION: GET LEDGER ---
if ($action == 'get_ledger') {
    header("Content-Type: application/json");
    $sql = "SELECT l.*, u.firstname, u.lastname 
            FROM tbl_pos_ledger l
            LEFT JOIN tbl_users_global_assignment u ON l.recorded_by = u.email 
            ORDER BY l.id DESC";
            
    $result = $conn->query($sql);
    $data = [];
    while($row = $result->fetch_assoc()) { 
        $row['display_name'] = ($row['firstname']) ? $row['firstname'] . " " . $row['lastname'] : $row['recorded_by'];
        $data[] = $row; 
    }
    echo json_encode(["status" => "success", "data" => $data]);
    exit;
}

// --- ACTION: ADD ENTRY ---
if ($action == 'add_entry') {
    header("Content-Type: application/json");
    $req = json_decode(file_get_contents("php://input"), true);
    
    $email = $conn->real_escape_string($req['recorded_by'] ?? 'System');
    $type  = $conn->real_escape_string($req['type']); 
    $cat   = $conn->real_escape_string($req['category'] ?? 'General');
    $desc  = $conn->real_escape_string($req['description']);
    $amt   = abs((float)$req['amount']); 
    $date  = getShiftDate($conn);
    
    $sql = "INSERT INTO tbl_pos_ledger (entry_type, category, description, amount, recorded_by, entry_date, entry_time, status) 
            VALUES ('$type', '$cat', '$desc', $amt, '$email', '$date', CURTIME(), 'active')";
            
    echo json_encode($conn->query($sql) ? ["status" => "success"] : ["status" => "error"]);
    exit;
}
?>