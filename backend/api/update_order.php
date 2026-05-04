<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$config = require __DIR__ . "/config.php";

$conn = new mysqli(
    $config["host"],
    $config["user"],
    $config["pass"],
    $config["db"]
);

if ($conn->connect_error) {
    die(json_encode([
        "status" => "error",
        "message" => "Database connection failed: " . $conn->connect_error
    ]));
}

$conn->set_charset("utf8mb4");
date_default_timezone_set('Asia/Manila');

$transaction_id = isset($_POST["transaction_id"]) ? (int) $_POST["transaction_id"] : 0;

$Category_Code = $_POST["Category_Code"] ?? '';
$Unit_Code = $_POST["Unit_Code"] ?? '';
$transaction_type = $_POST["transaction_type"] ?? '';
$transaction_date = $_POST["transaction_date"] ?? '';
$transaction_time = $_POST["transaction_time"] ?? '';
$terminal_number = $_POST["terminal_number"] ?? '';
$table_number = $_POST["table_number"] ?? '';
$order_type = $_POST["order_type"] ?? '';
$customer_head_count = $_POST["customer_head_count"] ?? '';
$discount_type = 'No Discount';
$payment_method = $_POST["payment_method"] ?? '';
$special_instructions = $_POST["special_instructions"] ?? '';
$cashier = $_POST["cashier"] ?? '';
$remarks = $_POST["remarks"] ?? '';
$order_status = $_POST["order_status"] ?? '';
$status = $_POST["status"] ?? '';
$void_date = $_POST["void_date"] ?? '';
$refund_date = $_POST["refund_date"] ?? '';

/**
 * Added user info for logs
 */
$user_id = $_POST["user_id"] ?? '';
$user_name = $_POST["user_name"] ?? $cashier;

$cart_items = isset($_POST["cart_items"]) ? json_decode($_POST["cart_items"], true) : [];

if ($transaction_id <= 0) {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid transaction_id"
    ]);
    exit;
}

if (!is_array($cart_items) || count($cart_items) === 0) {
    echo json_encode([
        "status" => "error",
        "message" => "No cart items received"
    ]);
    exit;
}

$stmtUpdate = null;
$stmtDelete = null;
$stmtDetails = null;
$stmtActivityLog = null;
$stmtTransactionLog = null;
$lockTransaction = null;

try {
    if (!$conn->begin_transaction()) {
        throw new Exception("Failed to start transaction: " . $conn->error);
    }

    $lockTransaction = $conn->prepare("
        SELECT 
            transaction_id,
            order_slip_no,
            remarks,
            status
        FROM tbl_pos_transactions
        WHERE transaction_id = ?
        LIMIT 1
        FOR UPDATE
    ");
    if (!$lockTransaction) {
        throw new Exception("Lock prepare error: " . $conn->error);
    }

    $lockTransaction->bind_param("i", $transaction_id);
    if (!$lockTransaction->execute()) {
        throw new Exception("Lock execute error: " . $lockTransaction->error);
    }

    $lockResult = $lockTransaction->get_result();
    $existing = $lockResult ? $lockResult->fetch_assoc() : null;
    $lockTransaction->close();
    $lockTransaction = null;

    if (!$existing) {
        throw new Exception("Transaction not found.");
    }

    if (
        strcasecmp((string)($existing['remarks'] ?? ''), 'Paid') === 0 ||
        strcasecmp((string)($existing['status'] ?? ''), 'Paid') === 0
    ) {
        throw new Exception("Paid transaction can no longer be updated from this endpoint.");
    }

    $order_slip_no = $existing["order_slip_no"] ?? '';

    $sqlUpdate = "UPDATE tbl_pos_transactions SET
        Category_Code=?,
        Unit_Code=?,
        transaction_type=?,
        transaction_date=?,
        transaction_time=?,
        terminal_number=?,
        table_number=?,
        order_type=?,
        customer_head_count=?,
        discount_type=?,
        payment_method=?,
        special_instructions=?,
        cashier=?,
        remarks=?,
        order_status=?,
        status=?,
        void_date=?,
        refund_date=?
        WHERE transaction_id=?";

    $stmtUpdate = $conn->prepare($sqlUpdate);
    if (!$stmtUpdate) {
        throw new Exception("Update Prepare Error: " . $conn->error);
    }

    $stmtUpdate->bind_param(
        "ssssssssssssssssssi",
        $Category_Code,
        $Unit_Code,
        $transaction_type,
        $transaction_date,
        $transaction_time,
        $terminal_number,
        $table_number,
        $order_type,
        $customer_head_count,
        $discount_type,
        $payment_method,
        $special_instructions,
        $cashier,
        $remarks,
        $order_status,
        $status,
        $void_date,
        $refund_date,
        $transaction_id
    );

    if (!$stmtUpdate->execute()) {
        throw new Exception("Update Execute Error: " . $stmtUpdate->error);
    }
    $stmtUpdate->close();
    $stmtUpdate = null;

    $stmtDelete = $conn->prepare("DELETE FROM tbl_pos_transactions_detailed WHERE transaction_id=?");
    if (!$stmtDelete) {
        throw new Exception("Delete Prepare Error: " . $conn->error);
    }

    $stmtDelete->bind_param("i", $transaction_id);
    if (!$stmtDelete->execute()) {
        throw new Exception("Delete Execute Error: " . $stmtDelete->error);
    }
    $stmtDelete->close();
    $stmtDelete = null;

    $sqlDetails = "INSERT INTO tbl_pos_transactions_detailed (
        transaction_id,
        Category_Code,
        Unit_Code,
        transaction_date,
        product_id,
        sku,
        sales_quantity,
        landing_cost,
        unit_cost,
        selling_price,
        vatable,
        isDiscountable,
        order_status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";

    $stmtDetails = $conn->prepare($sqlDetails);
    if (!$stmtDetails) {
        throw new Exception("Details Prepare Error: " . $conn->error);
    }

    $totalAmount = 0;
    $itemSummary = [];

    foreach ($cart_items as $item) {
        $product_id = $item["product_id"] ?? '';
        $sku = $item["sku"] ?? '';
        $sales_quantity = isset($item["sales_quantity"]) ? (int) $item["sales_quantity"] : 0;
        $landing_cost = isset($item["landing_cost"]) ? (float) $item["landing_cost"] : 0;
        $unit_cost = isset($item["unit_cost"]) ? (float) $item["unit_cost"] : 0;
        $selling_price = isset($item["selling_price"]) ? (float) $item["selling_price"] : 0;
        $vatable = isset($item["vatable"]) ? (string) $item["vatable"] : 'Yes';
        $isDiscountable = isset($item["isDiscountable"]) ? (string) $item["isDiscountable"] : '';
        $detail_status = $item["order_status"] ?? '';

        $stmtDetails->bind_param(
            "isssssidddsss",
            $transaction_id,
            $Category_Code,
            $Unit_Code,
            $transaction_date,
            $product_id,
            $sku,
            $sales_quantity,
            $landing_cost,
            $unit_cost,
            $selling_price,
            $vatable,
            $isDiscountable,
            $detail_status
        );

        if (!$stmtDetails->execute()) {
            throw new Exception("Details Execute Error: " . $stmtDetails->error);
        }

        $lineTotal = $sales_quantity * $selling_price;
        $totalAmount += $lineTotal;

        $itemSummary[] = [
            "product_id" => $product_id,
            "sku" => $sku,
            "qty" => $sales_quantity,
            "selling_price" => $selling_price,
            "line_total" => $lineTotal
        ];
    }

    $stmtDetails->close();
    $stmtDetails = null;

    /**
     * INSERT INTO tbl_main_activity_logs
     */
    $activity_date_time = date("Y-m-d H:i:s");
    $type_of_activity = "POS ORDER";
    $activity_performed = "UPDATE ORDER";

    $values_of_data = json_encode([
        "transaction_id" => $transaction_id,
        "order_slip_no" => $order_slip_no,
        "transaction_type" => $transaction_type,
        "transaction_date" => $transaction_date,
        "transaction_time" => $transaction_time,
        "terminal_number" => $terminal_number,
        "table_number" => $table_number,
        "order_type" => $order_type,
        "customer_head_count" => $customer_head_count,
        "payment_method" => $payment_method,
        "cashier" => $cashier,
        "remarks" => $remarks,
        "order_status" => $order_status,
        "status" => $status,
        "total_amount" => $totalAmount,
        "cart_items" => $itemSummary
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
     * INSERT INTO tbl_main_transaction_logs
     */
    $Register = $terminal_number !== '' ? $terminal_number : 'POS';
    $Trans_Date = $transaction_date !== '' ? $transaction_date : date("Y-m-d");
    $Reference_No = (string)$order_slip_no;
    $Trans_Type = "UPDATE ORDER";
    $User_ID = is_numeric($user_id) ? (int)$user_id : 0;
    $Amount = (float)$totalAmount;
    $Description = "POS Update Order | Transaction ID: {$transaction_id} | Slip No: {$order_slip_no} | Cashier: {$cashier} | Order Type: {$order_type}";
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
        "message" => "Transaction updated successfully",
        "transaction_id" => $transaction_id,
        "order_slip_no" => $order_slip_no,
        "total_amount" => $totalAmount
    ]);
} catch (Throwable $e) {
    try {
        @$conn->rollback();
    } catch (Throwable $rollbackError) {
    }

    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
} finally {
    if ($lockTransaction instanceof mysqli_stmt) {
        $lockTransaction->close();
    }

    if ($stmtUpdate instanceof mysqli_stmt) {
        $stmtUpdate->close();
    }

    if ($stmtDelete instanceof mysqli_stmt) {
        $stmtDelete->close();
    }

    if ($stmtDetails instanceof mysqli_stmt) {
        $stmtDetails->close();
    }

    if ($stmtActivityLog instanceof mysqli_stmt) {
        $stmtActivityLog->close();
    }

    if ($stmtTransactionLog instanceof mysqli_stmt) {
        $stmtTransactionLog->close();
    }

    $conn->close();
}
?>