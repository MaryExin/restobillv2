<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
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
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed: " . $conn->connect_error
    ]);
    exit;
}

$conn->set_charset("utf8mb4");
date_default_timezone_set("Asia/Manila");

$Category_Code = $_POST["Category_Code"] ?? "";
$Unit_Code = $_POST["Unit_Code"] ?? "";

$source_transaction_id = isset($_POST["source_transaction_id"])
    ? (int) $_POST["source_transaction_id"]
    : 0;

$destination_transaction_id = isset($_POST["destination_transaction_id"])
    ? (int) $_POST["destination_transaction_id"]
    : 0;

$source_table_number = trim($_POST["source_table_number"] ?? "");
$destination_table_number = trim($_POST["destination_table_number"] ?? "");

$transaction_date = trim($_POST["transaction_date"] ?? date("Y-m-d"));

$source_order_type = trim($_POST["source_order_type"] ?? "DINE IN");
$destination_order_type = trim($_POST["destination_order_type"] ?? "DINE IN");

$source_terminal_number = trim($_POST["source_terminal_number"] ?? "1");
$destination_terminal_number = trim($_POST["destination_terminal_number"] ?? "1");

$source_special_instructions = trim($_POST["source_special_instructions"] ?? "");
$destination_special_instructions = trim($_POST["destination_special_instructions"] ?? "");

$cashier = trim($_POST["cashier"] ?? "");
$user_id = trim($_POST["user_id"] ?? "");
$user_name = trim($_POST["user_name"] ?? $cashier);

$source_items = isset($_POST["source_items"])
    ? json_decode($_POST["source_items"], true)
    : [];

$destination_items = isset($_POST["destination_items"])
    ? json_decode($_POST["destination_items"], true)
    : [];

if ($source_transaction_id <= 0 || $destination_transaction_id <= 0) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Invalid source or destination transaction id."
    ]);
    exit;
}

if ($source_transaction_id === $destination_transaction_id) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Source and destination transactions must be different."
    ]);
    exit;
}

if (!is_array($source_items) || count($source_items) === 0) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Source transaction must keep at least one item."
    ]);
    exit;
}

if (!is_array($destination_items) || count($destination_items) === 0) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Destination items are required."
    ]);
    exit;
}

$lockSource = null;
$lockDestination = null;
$updateSource = null;
$updateDestination = null;
$deleteSourceDetails = null;
$deleteDestinationDetails = null;
$insertDetail = null;
$insertActivityLog = null;
$insertTransactionLog = null;

try {
    if (!$conn->begin_transaction()) {
        throw new Exception("Failed to start transaction: " . $conn->error);
    }

    $lockSourceSql = "
        SELECT
            transaction_id,
            order_slip_no,
            remarks,
            status,
            transaction_type,
            transaction_time,
            customer_head_count,
            discount_type,
            payment_method,
            order_status
        FROM tbl_pos_transactions
        WHERE transaction_id = ?
        LIMIT 1
        FOR UPDATE
    ";

    $lockSource = $conn->prepare($lockSourceSql);
    if (!$lockSource) {
        throw new Exception("Prepare source lock failed: " . $conn->error);
    }

    $lockSource->bind_param("i", $source_transaction_id);

    if (!$lockSource->execute()) {
        throw new Exception("Execute source lock failed: " . $lockSource->error);
    }

    $sourceResult = $lockSource->get_result();
    $sourceExisting = $sourceResult ? $sourceResult->fetch_assoc() : null;
    $lockSource->close();
    $lockSource = null;

    if (!$sourceExisting) {
        throw new Exception("Source transaction not found.");
    }

    $lockDestinationSql = "
        SELECT
            transaction_id,
            order_slip_no,
            remarks,
            status,
            transaction_type,
            transaction_time,
            customer_head_count,
            discount_type,
            payment_method,
            order_status
        FROM tbl_pos_transactions
        WHERE transaction_id = ?
        LIMIT 1
        FOR UPDATE
    ";

    $lockDestination = $conn->prepare($lockDestinationSql);
    if (!$lockDestination) {
        throw new Exception("Prepare destination lock failed: " . $conn->error);
    }

    $lockDestination->bind_param("i", $destination_transaction_id);

    if (!$lockDestination->execute()) {
        throw new Exception("Execute destination lock failed: " . $lockDestination->error);
    }

    $destinationResult = $lockDestination->get_result();
    $destinationExisting = $destinationResult ? $destinationResult->fetch_assoc() : null;
    $lockDestination->close();
    $lockDestination = null;

    if (!$destinationExisting) {
        throw new Exception("Destination transaction not found.");
    }

    if (
        strcasecmp((string)($sourceExisting["remarks"] ?? ""), "Paid") === 0 ||
        strcasecmp((string)($sourceExisting["status"] ?? ""), "Paid") === 0
    ) {
        throw new Exception("Source transaction is already paid.");
    }

    if (
        strcasecmp((string)($destinationExisting["remarks"] ?? ""), "Paid") === 0 ||
        strcasecmp((string)($destinationExisting["status"] ?? ""), "Paid") === 0
    ) {
        throw new Exception("Destination transaction is already paid.");
    }

    $sourceTransactionType = $sourceExisting["transaction_type"] ?? "PRODUCT";
    $destinationTransactionType = $destinationExisting["transaction_type"] ?? "PRODUCT";

    $sourceTransactionTime = $sourceExisting["transaction_time"] ?? date("h:i A");
    $destinationTransactionTime = $destinationExisting["transaction_time"] ?? date("h:i A");

    $sourceCustomerHeadCount = $sourceExisting["customer_head_count"] ?? 1;
    $destinationCustomerHeadCount = $destinationExisting["customer_head_count"] ?? 1;

    $sourceDiscountType = $sourceExisting["discount_type"] ?? "No Discount";
    $destinationDiscountType = $destinationExisting["discount_type"] ?? "No Discount";

    $sourcePaymentMethod = $sourceExisting["payment_method"] ?? "";
    $destinationPaymentMethod = $destinationExisting["payment_method"] ?? "";

    $sourceOrderStatus = $sourceExisting["order_status"] ?? "Pending";
    $destinationOrderStatus = $destinationExisting["order_status"] ?? "Pending";

    $updateSql = "
        UPDATE tbl_pos_transactions SET
            Category_Code = ?,
            Unit_Code = ?,
            transaction_type = ?,
            transaction_date = ?,
            transaction_time = ?,
            terminal_number = ?,
            table_number = ?,
            order_type = ?,
            customer_head_count = ?,
            discount_type = ?,
            payment_method = ?,
            special_instructions = ?,
            cashier = ?,
            order_status = ?,
            status = 'Active',
            void_date = '',
            refund_date = ''
        WHERE transaction_id = ?
    ";

    $updateSource = $conn->prepare($updateSql);
    if (!$updateSource) {
        throw new Exception("Prepare source update failed: " . $conn->error);
    }

    $updateSource->bind_param(
        "ssssssssssssssi",
        $Category_Code,
        $Unit_Code,
        $sourceTransactionType,
        $transaction_date,
        $sourceTransactionTime,
        $source_terminal_number,
        $source_table_number,
        $source_order_type,
        $sourceCustomerHeadCount,
        $sourceDiscountType,
        $sourcePaymentMethod,
        $source_special_instructions,
        $cashier,
        $sourceOrderStatus,
        $source_transaction_id
    );

    if (!$updateSource->execute()) {
        throw new Exception("Execute source update failed: " . $updateSource->error);
    }

    $updateSource->close();
    $updateSource = null;

    $updateDestination = $conn->prepare($updateSql);
    if (!$updateDestination) {
        throw new Exception("Prepare destination update failed: " . $conn->error);
    }

    $updateDestination->bind_param(
        "ssssssssssssssi",
        $Category_Code,
        $Unit_Code,
        $destinationTransactionType,
        $transaction_date,
        $destinationTransactionTime,
        $destination_terminal_number,
        $destination_table_number,
        $destination_order_type,
        $destinationCustomerHeadCount,
        $destinationDiscountType,
        $destinationPaymentMethod,
        $destination_special_instructions,
        $cashier,
        $destinationOrderStatus,
        $destination_transaction_id
    );

    if (!$updateDestination->execute()) {
        throw new Exception("Execute destination update failed: " . $updateDestination->error);
    }

    $updateDestination->close();
    $updateDestination = null;

    $deleteSourceDetails = $conn->prepare("DELETE FROM tbl_pos_transactions_detailed WHERE transaction_id = ?");
    if (!$deleteSourceDetails) {
        throw new Exception("Prepare delete source details failed: " . $conn->error);
    }

    $deleteSourceDetails->bind_param("i", $source_transaction_id);

    if (!$deleteSourceDetails->execute()) {
        throw new Exception("Execute delete source details failed: " . $deleteSourceDetails->error);
    }

    $deleteSourceDetails->close();
    $deleteSourceDetails = null;

    $deleteDestinationDetails = $conn->prepare("DELETE FROM tbl_pos_transactions_detailed WHERE transaction_id = ?");
    if (!$deleteDestinationDetails) {
        throw new Exception("Prepare delete destination details failed: " . $conn->error);
    }

    $deleteDestinationDetails->bind_param("i", $destination_transaction_id);

    if (!$deleteDestinationDetails->execute()) {
        throw new Exception("Execute delete destination details failed: " . $deleteDestinationDetails->error);
    }

    $deleteDestinationDetails->close();
    $deleteDestinationDetails = null;

    $detailSql = "
        INSERT INTO tbl_pos_transactions_detailed (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";

    $insertDetail = $conn->prepare($detailSql);
    if (!$insertDetail) {
        throw new Exception("Prepare insert detail failed: " . $conn->error);
    }

    $sourceTotal = 0;
    $sourceItemSummary = [];

    foreach ($source_items as $item) {
        $product_id = $item["product_id"] ?? "";
        $sku = $item["sku"] ?? "";
        $sales_quantity = isset($item["sales_quantity"]) ? (int)$item["sales_quantity"] : 0;
        $landing_cost = isset($item["landing_cost"]) ? (float)$item["landing_cost"] : 0;
        $unit_cost = isset($item["unit_cost"]) ? (float)$item["unit_cost"] : 0;
        $selling_price = isset($item["selling_price"]) ? (float)$item["selling_price"] : 0;
        $vatable = isset($item["vatable"]) ? (string)$item["vatable"] : "Yes";
        $isDiscountable = isset($item["isDiscountable"]) ? (string)$item["isDiscountable"] : "";
        $detailOrderStatus = $item["order_status"] ?? "ACTIVE";

        if ($sales_quantity <= 0) {
            continue;
        }

        $insertDetail->bind_param(
            "isssssidddsss",
            $source_transaction_id,
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
            $detailOrderStatus
        );

        if (!$insertDetail->execute()) {
            throw new Exception("Insert source detail failed: " . $insertDetail->error);
        }

        $lineTotal = $sales_quantity * $selling_price;
        $sourceTotal += $lineTotal;

        $sourceItemSummary[] = [
            "product_id" => $product_id,
            "sku" => $sku,
            "qty" => $sales_quantity,
            "selling_price" => $selling_price,
            "line_total" => $lineTotal
        ];
    }

    $destinationTotal = 0;
    $destinationItemSummary = [];

    foreach ($destination_items as $item) {
        $product_id = $item["product_id"] ?? "";
        $sku = $item["sku"] ?? "";
        $sales_quantity = isset($item["sales_quantity"]) ? (int)$item["sales_quantity"] : 0;
        $landing_cost = isset($item["landing_cost"]) ? (float)$item["landing_cost"] : 0;
        $unit_cost = isset($item["unit_cost"]) ? (float)$item["unit_cost"] : 0;
        $selling_price = isset($item["selling_price"]) ? (float)$item["selling_price"] : 0;
        $vatable = isset($item["vatable"]) ? (string)$item["vatable"] : "Yes";
        $isDiscountable = isset($item["isDiscountable"]) ? (string)$item["isDiscountable"] : "";
        $detailOrderStatus = $item["order_status"] ?? "ACTIVE";

        if ($sales_quantity <= 0) {
            continue;
        }

        $insertDetail->bind_param(
            "isssssidddsss",
            $destination_transaction_id,
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
            $detailOrderStatus
        );

        if (!$insertDetail->execute()) {
            throw new Exception("Insert destination detail failed: " . $insertDetail->error);
        }

        $lineTotal = $sales_quantity * $selling_price;
        $destinationTotal += $lineTotal;

        $destinationItemSummary[] = [
            "product_id" => $product_id,
            "sku" => $sku,
            "qty" => $sales_quantity,
            "selling_price" => $selling_price,
            "line_total" => $lineTotal
        ];
    }

    $insertDetail->close();
    $insertDetail = null;

    $activity_date_time = date("Y-m-d H:i:s");
    $type_of_activity = "POS ORDER";
    $activity_performed = "TRANSFER PRODUCT";

    $values_of_data = json_encode([
        "source_transaction_id" => $source_transaction_id,
        "source_order_slip_no" => $sourceExisting["order_slip_no"] ?? "",
        "source_table_number" => $source_table_number,
        "destination_transaction_id" => $destination_transaction_id,
        "destination_order_slip_no" => $destinationExisting["order_slip_no"] ?? "",
        "destination_table_number" => $destination_table_number,
        "source_total" => $sourceTotal,
        "destination_total" => $destinationTotal,
        "source_items" => $sourceItemSummary,
        "destination_items" => $destinationItemSummary
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $activitySql = "
        INSERT INTO tbl_main_activity_logs (
            Category_Code,
            Unit_Code,
            activity_date_time,
            user_id,
            user_name,
            type_of_activity,
            activity_performed,
            values_of_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ";

    $insertActivityLog = $conn->prepare($activitySql);
    if (!$insertActivityLog) {
        throw new Exception("Prepare activity log failed: " . $conn->error);
    }

    $insertActivityLog->bind_param(
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

    if (!$insertActivityLog->execute()) {
        throw new Exception("Insert activity log failed: " . $insertActivityLog->error);
    }

    $insertActivityLog->close();
    $insertActivityLog = null;

    $transactionLogSql = "
        INSERT INTO tbl_main_transaction_logs (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";

    $insertTransactionLog = $conn->prepare($transactionLogSql);
    if (!$insertTransactionLog) {
        throw new Exception("Prepare transaction log failed: " . $conn->error);
    }

    $register = $source_terminal_number !== "" ? $source_terminal_number : "POS";
    $transDate = $transaction_date !== "" ? $transaction_date : date("Y-m-d");
    $referenceNo = (string)($sourceExisting["order_slip_no"] ?? $source_transaction_id);
    $transType = "TRANSFER PRODUCT";
    $userIdInt = is_numeric($user_id) ? (int)$user_id : 0;
    $amount = (float)$destinationTotal;
    $description = "POS Transfer Product | Source TX: {$source_transaction_id} | Destination TX: {$destination_transaction_id} | From: {$source_table_number} | To: {$destination_table_number}";
    $logDate = date("Y-m-d");
    $logTime = date("H:i:s");

    $insertTransactionLog->bind_param(
        "ssssssidsss",
        $Category_Code,
        $Unit_Code,
        $register,
        $transDate,
        $referenceNo,
        $transType,
        $userIdInt,
        $amount,
        $description,
        $logDate,
        $logTime
    );

    if (!$insertTransactionLog->execute()) {
        throw new Exception("Insert transaction log failed: " . $insertTransactionLog->error);
    }

    $insertTransactionLog->close();
    $insertTransactionLog = null;

    if (!$conn->commit()) {
        throw new Exception("Commit failed: " . $conn->error);
    }

    echo json_encode([
        "status" => "success",
        "message" => "Products transferred successfully.",
        "source_transaction_id" => $source_transaction_id,
        "destination_transaction_id" => $destination_transaction_id,
        "source_table_number" => $source_table_number,
        "destination_table_number" => $destination_table_number,
        "source_total" => $sourceTotal,
        "destination_total" => $destinationTotal
    ]);
} catch (Throwable $e) {
    try {
        @$conn->rollback();
    } catch (Throwable $rollbackError) {
    }

    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage(),
        "line" => $e->getLine(),
        "file" => basename($e->getFile())
    ]);
} finally {
    if ($lockSource instanceof mysqli_stmt) {
        $lockSource->close();
    }
    if ($lockDestination instanceof mysqli_stmt) {
        $lockDestination->close();
    }
    if ($updateSource instanceof mysqli_stmt) {
        $updateSource->close();
    }
    if ($updateDestination instanceof mysqli_stmt) {
        $updateDestination->close();
    }
    if ($deleteSourceDetails instanceof mysqli_stmt) {
        $deleteSourceDetails->close();
    }
    if ($deleteDestinationDetails instanceof mysqli_stmt) {
        $deleteDestinationDetails->close();
    }
    if ($insertDetail instanceof mysqli_stmt) {
        $insertDetail->close();
    }
    if ($insertActivityLog instanceof mysqli_stmt) {
        $insertActivityLog->close();
    }
    if ($insertTransactionLog instanceof mysqli_stmt) {
        $insertTransactionLog->close();
    }

    $conn->close();
}
?>