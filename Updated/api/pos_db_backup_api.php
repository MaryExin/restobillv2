<?php

declare(strict_types=1);

require __DIR__ . "/secure_guard.php";

if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "POST"], true)) {
    http_response_code(405);
    header("Allow: GET, POST");
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

posRoleAuthRequirePermission(
    $pdo,
    (string)($GLOBALS["pos_user_id"] ?? ""),
    "settings",
    "dataSecurity"
);

$host = $config['host'];
$user = $config['user'];
$pass = $config['pass'];
$db   = $config['db'];

$action = $_GET['action'] ?? '';
$allowedMethods = [
    "get_settings" => "GET",
    "update_frequency" => "POST",
    "immediate_export" => "POST",
    "scheduled_export" => "POST",
];
if (!isset($allowedMethods[$action])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid backup action."]);
    exit;
}
if ($_SERVER["REQUEST_METHOD"] !== $allowedMethods[$action]) {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

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
    $freq = is_array($data) ? (string)($data['frequency'] ?? '') : '';
    if (!in_array($freq, ["1m", "30m", "1h", "2h"], true)) {
        http_response_code(422);
        echo json_encode(["status" => "error", "message" => "Invalid backup frequency."]);
        exit;
    }
    $stmt = $conn->prepare("INSERT INTO $tableName (setting_key, setting_value) VALUES ('backup_frequency', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
    $stmt->bind_param("ss", $freq, $freq);
    echo json_encode(["status" => $stmt->execute() ? "success" : "error"]);
} 

elseif ($action === 'immediate_export') {
    $full_path = tempnam(sys_get_temp_dir(), "restobill-pos-backup-");
    if ($full_path === false) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Unable to prepare the backup file."]);
        exit;
    }

    $mysqldump = PHP_OS_FAMILY === "Windows"
        ? "C:\\xampp\\mysql\\bin\\mysqldump.exe"
        : "/Applications/XAMPP/xamppfiles/bin/mysqldump";
    $command = escapeshellarg($mysqldump)
        . " --user=" . escapeshellarg($user)
        . " --password=" . escapeshellarg($pass)
        . " --host=" . escapeshellarg($host)
        . " " . escapeshellarg($db)
        . " > " . escapeshellarg($full_path) . " 2>&1";
    try {
        exec($command, $output, $return_var);
        if ($return_var !== 0 || !is_file($full_path) || filesize($full_path) === 0) {
            throw new RuntimeException("mysqldump did not create a valid backup file");
        }

        header_remove("Content-Type");
        header("Content-Type: application/sql");
        header("Content-Disposition: attachment; filename=\"B1T1_Backup_" . date("Ymd_His") . ".sql\"");
        header("Content-Length: " . (string)filesize($full_path));
        header("Cache-Control: no-store");
        readfile($full_path);
    } catch (Throwable $e) {
        error_log("POS database export error: " . $e->getMessage());
        http_response_code(500);
        header_remove("Content-Type");
        header("Content-Type: application/json");
        echo json_encode(["status" => "error", "message" => "Database export failed."]);
    } finally {
        if (is_file($full_path)) {
            unlink($full_path);
        }
    }
}

elseif ($action === 'scheduled_export') {
    $configuredBackupDir = trim((string)(
        $_ENV["POS_DB_BACKUP_DIR"] ?? getenv("POS_DB_BACKUP_DIR") ?: ""
    ));
    $backupDir = $configuredBackupDir !== ""
        ? $configuredBackupDir
        : sys_get_temp_dir() . DIRECTORY_SEPARATOR . "restobill-pos-backups";

    if (!is_dir($backupDir) && !mkdir($backupDir, 0700, true) && !is_dir($backupDir)) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Unable to prepare the backup directory."]);
        exit;
    }

    $stagedPath = tempnam($backupDir, "restobill-pos-backup-");
    if ($stagedPath === false) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Unable to prepare the backup file."]);
        exit;
    }

    $finalPath = rtrim($backupDir, DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . "B1T1_Latest_Backup.sql";
    $mysqldump = PHP_OS_FAMILY === "Windows"
        ? "C:\\xampp\\mysql\\bin\\mysqldump.exe"
        : "/Applications/XAMPP/xamppfiles/bin/mysqldump";
    $command = escapeshellarg($mysqldump)
        . " --user=" . escapeshellarg($user)
        . " --password=" . escapeshellarg($pass)
        . " --host=" . escapeshellarg($host)
        . " " . escapeshellarg($db)
        . " > " . escapeshellarg($stagedPath) . " 2>&1";

    try {
        exec($command, $output, $return_var);
        if ($return_var !== 0 || !is_file($stagedPath) || filesize($stagedPath) === 0) {
            throw new RuntimeException("mysqldump did not create a valid scheduled backup");
        }
        chmod($stagedPath, 0600);
        if (is_file($finalPath) && !unlink($finalPath)) {
            throw new RuntimeException("the previous scheduled backup could not be replaced");
        }
        if (!rename($stagedPath, $finalPath)) {
            throw new RuntimeException("the scheduled backup could not be finalized");
        }
        $stagedPath = "";

        echo json_encode([
            "status" => "success",
            "completed_at" => date(DATE_ATOM),
        ]);
    } catch (Throwable $e) {
        error_log("POS scheduled database export error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Scheduled database export failed."]);
    } finally {
        if ($stagedPath !== "" && is_file($stagedPath)) {
            unlink($stagedPath);
        }
    }
}
$conn->close();
