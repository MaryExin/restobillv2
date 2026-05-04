<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET" && $_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: GET, POST, OPTIONS");
    exit;
}

header("Content-Type: application/json; charset=utf-8");

try {
    $database = new Database(
        $_ENV["DB_HOST"],
        $_ENV["DB_NAME"],
        $_ENV["DB_USER"],
        $_ENV["DB_PASS"]
    );

    $pdo = $database->getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = "
        SELECT
            ID,
            transaction_id,
            Category_Code,
            Unit_Code,
            Project_Code,
            transaction_type,
            transaction_date,
            transaction_time,
            terminal_number,
            purchase_order_no,
            order_slip_no,
            billing_no,
            invoice_no,
            table_number,
            order_type,
            customer_exclusive_id,
            customer_head_count,
            customer_count_for_discount,
            discount_type,
            TotalSales,
            Discount,
            OtherCharges,
            TotalAmountDue,
            VATableSales,
            VATableSales_VAT,
            VATExemptSales,
            VATExemptSales_VAT,
            VATZeroRatedSales,
            payment_amount,
            payment_method,
            change_amount,
            short_over,
            special_instructions,
            cashier,
            remarks,
            order_status,
            status,
            void_id,
            void_remarks,
            void_date,
            refund_id,
            refund_remarks,
            refund_date,
            date_recorded
        FROM tbl_pos_transactions
        WHERE
            status IN ('Refunded')
            
            
        ORDER BY ID DESC
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "message" => "Refunded transactions fetched successfully.",
        "transactions" => $rows,
    ]);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "System Error: " . $e->getMessage(),
        "transactions" => [],
    ]);
    exit;
}