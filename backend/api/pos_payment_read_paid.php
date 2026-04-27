<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require __DIR__ . "/pdo.php";

try {
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
        WHERE (
                remarks = 'Paid' AND  status = 'Active'
                
              )
          AND COALESCE(void_remarks, '') <> 'Voided'
        ORDER BY ID DESC
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "message" => "Paid transactions fetched successfully.",
        "transactions" => $rows,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "transactions" => [],
    ]);
}