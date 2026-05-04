<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

date_default_timezone_set('Asia/Manila');

$configPath = __DIR__ . "/config.php";
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "config.php not found"
    ]);
    exit;
}

$config = require $configPath;

$conn = new mysqli(
    $config["host"],
    $config["user"],
    $config["pass"],
    $config["db"]
);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed: " . $conn->connect_error
    ]);
    exit;
}

$conn->set_charset("utf8mb4");

$Category_Code    = trim($_POST["Category_Code"] ?? '');
$Unit_Code        = trim($_POST["Unit_Code"] ?? '');
$transaction_id   = isset($_POST["transaction_id"]) ? (int)$_POST["transaction_id"] : 0;
$old_table_number = trim($_POST["old_table_number"] ?? '');
$new_table_number = trim($_POST["new_table_number"] ?? '');
$remarks          = trim($_POST["remarks"] ?? '');
$cashier          = trim($_POST["cashier"] ?? '');
$transaction_date = trim($_POST["transaction_date"] ?? date("Y-m-d"));
$terminal_number  = trim($_POST["terminal_number"] ?? 'POS');
$order_slip_no    = trim($_POST["order_slip_no"] ?? '');
$transaction_type = trim($_POST["transaction_type"] ?? 'TRANSFER TABLE');
$user_id          = trim($_POST["user_id"] ?? '');
$user_name        = trim($_POST["user_name"] ?? $cashier);

if ($transaction_id <= 0) {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid transaction_id"
    ]);
    exit;
}

if ($new_table_number === '') {
    echo json_encode([
        "status" => "error",
        "message" => "New table number is required"
    ]);
    exit;
}

if ($remarks === '') {
    $remarks = "Transferred from table {$old_table_number} to {$new_table_number}";
}

$lockName = 'pos_transfer_table_lock_' . $transaction_id;

$lockStmt = null;
$unlockStmt = null;
$stmtUpdate = null;
$stmtActivityLog = null;
$stmtTransactionLog = null;

try {
    $lockStmt = $conn->prepare("SELECT GET_LOCK(?, 10) AS lck");
    if (!$lockStmt) {
        throw new Exception("Failed to prepare lock statement: " . $conn->error);
    }

    $lockStmt->bind_param("s", $lockName);

    if (!$lockStmt->execute()) {
        throw new Exception("Failed to acquire transfer lock: " . $lockStmt->error);
    }

    $lockResult = $lockStmt->get_result();
    $lockRow = $lockResult ? $lockResult->fetch_assoc() : null;

    if (!$lockRow || (int)$lockRow["lck"] !== 1) {
        throw new Exception("Could not acquire transfer lock. Please retry.");
    }

    $lockStmt->close();
    $lockStmt = null;

    if (!$conn->begin_transaction()) {
        throw new Exception("Failed to start transaction: " . $conn->error);
    }

    /**
     * UPDATE ONLY table_number
     */
    $sqlUpdate = "UPDATE tbl_pos_transactions
                  SET table_number = ?
                  WHERE transaction_id = ?";

    $stmtUpdate = $conn->prepare($sqlUpdate);
    if (!$stmtUpdate) {
        throw new Exception("Update prepare failed: " . $conn->error);
    }

    $stmtUpdate->bind_param(
        "si",
        $new_table_number,
        $transaction_id
    );

    if (!$stmtUpdate->execute()) {
        throw new Exception("Update transaction failed: " . $stmtUpdate->error);
    }

    $stmtUpdate->close();
    $stmtUpdate = null;

    /**
     * INSERT tbl_main_activity_logs
     */
    $activity_date_time = date("Y-m-d H:i:s");
    $type_of_activity = "POS ORDER";
    $activity_performed = "TRANSFER TABLE";

    $values_of_data = json_encode([
        "transaction_id" => $transaction_id,
        "order_slip_no" => $order_slip_no,
        "transaction_type" => $transaction_type,
        "transaction_date" => $transaction_date,
        "terminal_number" => $terminal_number,
        "cashier" => $cashier,
        "old_table_number" => $old_table_number,
        "new_table_number" => $new_table_number,
        "remarks" => $remarks
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $sqlActivityLog = "INSERT INTO tbl_main_activity_logs (
        Category_Code,
        Unit_Code,
        activity_date_time,
        user_id,
        user_name,
        type_of_activity,
        activity_performed,
        values_of_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

    $stmtActivityLog = $conn->prepare($sqlActivityLog);
    if (!$stmtActivityLog) {
        throw new Exception("Activity log prepare failed: " . $conn->error);
    }

    $stmtActivityLog->bind_param(
        "ssssssss",
        $Category_Code,
        $Unit_Code,
        $activity_date_time,
        $user_id,
        $user_name,
        $type_of_activity,
        $activity_performed,
        $values_of_data
    );

    if (!$stmtActivityLog->execute()) {
        throw new Exception("Activity log insert failed: " . $stmtActivityLog->error);
    }

    $stmtActivityLog->close();
    $stmtActivityLog = null;

    /**
     * INSERT tbl_main_transaction_logs
     */
    $Register = $terminal_number !== '' ? $terminal_number : 'POS';
    $Trans_Date = $transaction_date !== '' ? $transaction_date : date("Y-m-d");
    $Reference_No = $order_slip_no !== '' ? $order_slip_no : (string)$transaction_id;
    $Trans_Type = $transaction_type !== '' ? $transaction_type : 'TRANSFER TABLE';
    $User_ID = is_numeric($user_id) ? (int)$user_id : 0;
    $Amount = 0.00;
    $Description = "POS Transfer Table | Transaction ID: {$transaction_id} | From Table: {$old_table_number} | To Table: {$new_table_number} | Cashier: {$cashier}";
    $Log_Date = date("Y-m-d");
    $Log_Time = date("H:i:s");

    $sqlTransactionLog = "INSERT INTO tbl_main_transaction_logs (
        Category_Code,
        Unit_Code,
        Register,
        Trans_Date,
        Reference_No,
        Trans_Type,
        User_ID,
        Amount,
        Description,
        Log_Date,
        Log_Time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    $stmtTransactionLog = $conn->prepare($sqlTransactionLog);
    if (!$stmtTransactionLog) {
        throw new Exception("Transaction log prepare failed: " . $conn->error);
    }

    $stmtTransactionLog->bind_param(
        "ssssssidsss",
        $Category_Code,
        $Unit_Code,
        $Register,
        $Trans_Date,
        $Reference_No,
        $Trans_Type,
        $User_ID,
        $Amount,
        $Description,
        $Log_Date,
        $Log_Time
    );

    if (!$stmtTransactionLog->execute()) {
        throw new Exception("Transaction log insert failed: " . $stmtTransactionLog->error);
    }

    $stmtTransactionLog->close();
    $stmtTransactionLog = null;

    if (!$conn->commit()) {
        throw new Exception("Commit failed: " . $conn->error);
    }

    echo json_encode([
        "status" => "success",
        "message" => "Table transferred successfully",
        "transaction_id" => $transaction_id,
        "old_table_number" => $old_table_number,
        "new_table_number" => $new_table_number
    ]);
} catch (Throwable $e) {
    try {
        if ($conn && $conn->ping()) {
            @$conn->rollback();
        }
    } catch (Throwable $rollbackError) {
    }

    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
} finally {
    if ($lockStmt instanceof mysqli_stmt) {
        $lockStmt->close();
    }

    if ($stmtUpdate instanceof mysqli_stmt) {
        $stmtUpdate->close();
    }

    if ($stmtActivityLog instanceof mysqli_stmt) {
        $stmtActivityLog->close();
    }

    if ($stmtTransactionLog instanceof mysqli_stmt) {
        $stmtTransactionLog->close();
    }

    if ($conn instanceof mysqli) {
        $unlockStmt = $conn->prepare("SELECT RELEASE_LOCK(?)");
        if ($unlockStmt) {
            $unlockStmt->bind_param("s", $lockName);
            $unlockStmt->execute();
            $unlockStmt->close();
        }

        $conn->close();
    }
}

?>