<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$config = include 'config.php';
$host = $config['host'];
$user = $config['user'];
$pass = $config['pass'];
$db   = $config['db'];

$action = $_GET['action'] ?? '';
$tableName = "tbl_system_settings_backup_db";

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Connection failed"]);
    exit;
}

// Ensure table exists
$conn->query("CREATE TABLE IF NOT EXISTS $tableName (setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(100))");

if ($action === 'get_settings') {
    $result = $conn->query("SELECT setting_value FROM $tableName WHERE setting_key = 'backup_frequency'");
    $row = $result->fetch_assoc();
    echo json_encode(["status" => "success", "frequency" => $row['setting_value'] ?? '1h']);
} 

elseif ($action === 'update_frequency') {
    $data = json_decode(file_get_contents("php://input"), true);
    $freq = $data['frequency'] ?? '1h';
    $stmt = $conn->prepare("INSERT INTO $tableName (setting_key, setting_value) VALUES ('backup_frequency', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
    $stmt->bind_param("ss", $freq, $freq);
    echo json_encode(["status" => $stmt->execute() ? "success" : "error"]);
} 

elseif ($action === 'immediate_export') {
    $target_dir = __DIR__ . "/../pos_db_backup/"; 
    if (!is_dir($target_dir)) mkdir($target_dir, 0777, true);
    $filename = "B1T1_Latest_Backup.sql";
    $full_path = $target_dir . $filename;
    $mysqldump = "C:\\xampp\\mysql\\bin\\mysqldump.exe"; 
    $command = "\"$mysqldump\" --user=$user --password=\"$pass\" --host=$host $db > \"$full_path\" 2>&1";
    exec($command, $output, $return_var);
    echo json_encode(["status" => $return_var === 0 ? "success" : "error", "download_url" => "pos_db_backup/" . $filename]);
}
$conn->close();