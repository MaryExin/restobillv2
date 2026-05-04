<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require __DIR__ . "/bootstrap.php";

date_default_timezone_set('Asia/Manila');

/**
 * Allocate and increment a named counter from tbl_pos_document_counters.
 * MySQL/MariaDB-safe when called inside beginTransaction().
 */
function allocateDocumentCounter(
    PDO $pdo,
    string $categoryCode,
    string $unitCode,
    string $counterColumn
): int {
    $allowed = [
        'next_transaction_id' => 1000000001,
        'next_order_slip_no'  => 2000000001,
        'next_billing_no'     => 3000000001,
        'next_invoice_no'     => 4000000001,
    ];

    if (!array_key_exists($counterColumn, $allowed)) {
        throw new Exception("Unsupported counter column: {$counterColumn}");
    }

    $defaultStart = $allowed[$counterColumn];

    $stmt = $pdo->prepare("
        SELECT Category_Code, Unit_Code, {$counterColumn}
        FROM tbl_pos_document_counters
        WHERE Category_Code = :cc
          AND Unit_Code = :uc
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute([
        ':cc' => $categoryCode,
        ':uc' => $unitCode
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        $insert = $pdo->prepare("
            INSERT INTO tbl_pos_document_counters (
                Category_Code,
                Unit_Code,
                next_transaction_id,
                next_order_slip_no,
                next_billing_no,
                next_invoice_no
            ) VALUES (
                :cc,
                :uc,
                :next_transaction_id,
                :next_order_slip_no,
                :next_billing_no,
                :next_invoice_no
            )
        ");

        try {
            $insert->execute([
                ':cc' => $categoryCode,
                ':uc' => $unitCode,
                ':next_transaction_id' => 1000000001,
                ':next_order_slip_no'  => 2000000001,
                ':next_billing_no'     => 3000000001,
                ':next_invoice_no'     => 4000000001,
            ]);
        } catch (Throwable $e) {
            // Another request may have inserted the row first.
        }

        $stmt->execute([
            ':cc' => $categoryCode,
            ':uc' => $unitCode
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    if (!$row) {
        throw new Exception("Failed to initialize document counter row.");
    }

    $allocatedNumber = isset($row[$counterColumn]) ? (int)$row[$counterColumn] : 0;
    if ($allocatedNumber <= 0) {
        $allocatedNumber = $defaultStart;
    }

    $update = $pdo->prepare("
        UPDATE tbl_pos_document_counters
        SET {$counterColumn} = :next_number
        WHERE Category_Code = :cc
          AND Unit_Code = :uc
    ");
    $update->execute([
        ':next_number' => $allocatedNumber + 1,
        ':cc' => $categoryCode,
        ':uc' => $unitCode
    ]);

    return $allocatedNumber;
}

$manualTransactionStarted = false;

try {
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);
    $data = is_array($json) ? $json : $_POST;

    $config = require __DIR__ . "/config.php";

    $database = new Database(
        $config["host"] ?? "localhost",
        $config["db"] ?? "",
        $config["user"] ?? "",
        $config["pass"] ?? "",
        $config["driver"] ?? "mysql",
        $config["sqlite_path"] ?? ""
    );

    $pdo = $database->getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $Category_Code = (string)($data["Category_Code"] ?? '');
    $Unit_Code = (string)($data["Unit_Code"] ?? '');
    $transaction_type = (string)($data["transaction_type"] ?? '');
    $transaction_date = (string)($data["transaction_date"] ?? '');
    $transaction_time = (string)($data["transaction_time"] ?? '');
    $terminal_number = (string)($data["terminal_number"] ?? '');
    $table_number = (string)($data["table_number"] ?? '');
    $order_type = (string)($data["order_type"] ?? '');
    $customer_head_count = (int)($data["customer_head_count"] ?? 0);
    $discount_type = 'No Discount';
    $payment_method = '';
    $special_instructions = (string)($data["special_instructions"] ?? '');
    $cashier = (string)($data["cashier"] ?? '');
    $remarks = (string)($data["remarks"] ?? '');
    $order_status = (string)($data["order_status"] ?? '');
    $status = (string)($data["status"] ?? '');
    $void_date = (string)($data["void_date"] ?? '');
    $refund_date = (string)($data["refund_date"] ?? '');
    $date_recorded = date("Y-m-d H:i:s");

    $user_id = (string)($data["user_id"] ?? '');
    $user_name = (string)($data["user_name"] ?? $cashier);

    $cart_items = $data["cart_items"] ?? [];
    if (is_string($cart_items)) {
        $decodedCart = json_decode($cart_items, true);
        $cart_items = is_array($decodedCart) ? $decodedCart : [];
    }

    if ($Category_Code === '' || $Unit_Code === '') {
        throw new Exception("Category_Code and Unit_Code are required.");
    }

    if (!is_array($cart_items) || empty($cart_items)) {
        echo json_encode([
            "status" => "error",
            "message" => "No cart items received"
        ]);
        exit;
    }

    $pdo->beginTransaction();
    $manualTransactionStarted = true;

    $transaction_id = allocateDocumentCounter(
        $pdo,
        $Category_Code,
        $Unit_Code,
        'next_transaction_id'
    );

    $order_slip_no = allocateDocumentCounter(
        $pdo,
        $Category_Code,
        $Unit_Code,
        'next_order_slip_no'
    );

    $sql = "INSERT INTO tbl_pos_transactions (
        transaction_id,
        Category_Code,
        Unit_Code,
        transaction_type,
        transaction_date,
        transaction_time,
        terminal_number,
        order_slip_no,
        table_number,
        order_type,
        customer_head_count,
        discount_type,
        payment_method,
        special_instructions,
        cashier,
        remarks,
        order_status,
        status,
        void_date,
        refund_date,
        date_recorded
    ) VALUES (
        :transaction_id,
        :Category_Code,
        :Unit_Code,
        :transaction_type,
        :transaction_date,
        :transaction_time,
        :terminal_number,
        :order_slip_no,
        :table_number,
        :order_type,
        :customer_head_count,
        :discount_type,
        :payment_method,
        :special_instructions,
        :cashier,
        :remarks,
        :order_status,
        :status,
        :void_date,
        :refund_date,
        :date_recorded
    )";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
        ":transaction_type" => $transaction_type,
        ":transaction_date" => $transaction_date,
        ":transaction_time" => $transaction_time,
        ":terminal_number" => $terminal_number,
        ":order_slip_no" => $order_slip_no,
        ":table_number" => $table_number,
        ":order_type" => $order_type,
        ":customer_head_count" => $customer_head_count,
        ":discount_type" => $discount_type,
        ":payment_method" => $payment_method,
        ":special_instructions" => $special_instructions,
        ":cashier" => $cashier,
        ":remarks" => $remarks,
        ":order_status" => $order_status,
        ":status" => $status,
        ":void_date" => $void_date,
        ":refund_date" => $refund_date,
        ":date_recorded" => $date_recorded
    ]);

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
    ) VALUES (
        :transaction_id,
        :Category_Code,
        :Unit_Code,
        :transaction_date,
        :product_id,
        :sku,
        :sales_quantity,
        :landing_cost,
        :unit_cost,
        :selling_price,
        :vatable,
        :isDiscountable,
        :order_status
    )";

    $stmtDetails = $pdo->prepare($sqlDetails);

    $totalAmount = 0.0;
    $itemSummary = [];

    foreach ($cart_items as $item) {
        $product_id = (string)($item["product_id"] ?? '');
        $sku = (string)($item["sku"] ?? '');
        $sales_quantity = round((float)($item["sales_quantity"] ?? 0), 4);
        $landing_cost = round((float)($item["landing_cost"] ?? 0), 4);
        $unit_cost = round((float)($item["unit_cost"] ?? 0), 4);
        $selling_price = round((float)($item["selling_price"] ?? 0), 4);
        $vatable = (string)($item["vatable"] ?? 'Yes');
        $isDiscountable = (string)($item["isDiscountable"] ?? '');
        $detail_status = (string)($item["order_status"] ?? '');

        $stmtDetails->execute([
            ":transaction_id" => $transaction_id,
            ":Category_Code" => $Category_Code,
            ":Unit_Code" => $Unit_Code,
            ":transaction_date" => $transaction_date,
            ":product_id" => $product_id,
            ":sku" => $sku,
            ":sales_quantity" => $sales_quantity,
            ":landing_cost" => $landing_cost,
            ":unit_cost" => $unit_cost,
            ":selling_price" => $selling_price,
            ":vatable" => $vatable,
            ":isDiscountable" => $isDiscountable,
            ":order_status" => $detail_status
        ]);

        $lineTotal = round($sales_quantity * $selling_price, 2);
        $totalAmount += $lineTotal;

        $itemSummary[] = [
            "product_id" => $product_id,
            "sku" => $sku,
            "qty" => $sales_quantity,
            "selling_price" => $selling_price,
            "line_total" => $lineTotal
        ];
    }

    $activity_date_time = date("Y-m-d H:i:s");
    $type_of_activity = "POS ORDER";
    $activity_performed = "SAVE ORDER";
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
        "cashier" => $cashier,
        "remarks" => $remarks,
        "order_status" => $order_status,
        "status" => $status,
        "total_amount" => round($totalAmount, 2),
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
    ) VALUES (
        :Category_Code,
        :Unit_Code,
        :activity_date_time,
        :user_id,
        :user_name,
        :type_of_activity,
        :activity_performed,
        :values_of_data
    )";

    $stmtActivityLog = $pdo->prepare($sqlActivityLog);
    $stmtActivityLog->execute([
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
        ":activity_date_time" => $activity_date_time,
        ":user_id" => $user_id,
        ":user_name" => $user_name,
        ":type_of_activity" => $type_of_activity,
        ":activity_performed" => $activity_performed,
        ":values_of_data" => $values_of_data
    ]);

    $Register = $terminal_number !== '' ? $terminal_number : 'POS';
    $Trans_Date = $transaction_date !== '' ? $transaction_date : date("Y-m-d");
    $Reference_No = (string)$order_slip_no;
    $Trans_Type = $transaction_type !== '' ? $transaction_type : 'ORDER';
    $User_ID = is_numeric($user_id) ? (int)$user_id : 0;
    $Amount = round((float)$totalAmount, 2);
    $Description = "POS Save Order | Transaction ID: {$transaction_id} | Slip No: {$order_slip_no} | Cashier: {$cashier} | Order Type: {$order_type}";
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
    ) VALUES (
        :Category_Code,
        :Unit_Code,
        :Register,
        :Trans_Date,
        :Reference_No,
        :Trans_Type,
        :User_ID,
        :Amount,
        :Description,
        :Log_Date,
        :Log_Time
    )";

    $stmtTransactionLog = $pdo->prepare($sqlTransactionLog);
    $stmtTransactionLog->execute([
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
        ":Register" => $Register,
        ":Trans_Date" => $Trans_Date,
        ":Reference_No" => $Reference_No,
        ":Trans_Type" => $Trans_Type,
        ":User_ID" => $User_ID,
        ":Amount" => $Amount,
        ":Description" => $Description,
        ":Log_Date" => $Log_Date,
        ":Log_Time" => $Log_Time
    ]);

    $pdo->commit();
    $manualTransactionStarted = false;

    echo json_encode([
        "status" => "success",
        "message" => "Transaction saved successfully",
        "transaction_id" => $transaction_id,
        "order_slip_no" => $order_slip_no,
        "total_amount" => round($totalAmount, 2)
    ]);
} catch (Throwable $e) {
    if (
        isset($pdo) &&
        $pdo instanceof PDO &&
        $manualTransactionStarted
    ) {
        try {
            $pdo->rollBack();
        } catch (Throwable $rollbackError) {
        }
    }

    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}