<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require __DIR__ . "/pdo.php";

function normalizeDiscountTypeKey($value)
{
    $value = strtolower(trim((string)$value));

    if ($value === "senior" || $value === "senior citizen" || $value === "senior citizen discount") {
        return "senior";
    }

    if ($value === "pwd" || $value === "pwd discount") {
        return "pwd";
    }

    if ($value === "manual" || $value === "manual discount") {
        return "manual";
    }

    return "";
}

try {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true) ?: [];

    $transaction_id = $body["transaction_id"] ?? ($_GET["transaction_id"] ?? "");
    $categoryCodeInput = trim((string)($body["category_code"] ?? $body["Category_Code"] ?? ($_GET["category_code"] ?? "")));
    $unitCodeInput = trim((string)($body["unit_code"] ?? $body["Unit_Code"] ?? ($_GET["unit_code"] ?? "")));
    $terminalNumberInput = trim((string)($body["terminal_number"] ?? ($_GET["terminal_number"] ?? "")));

    if (!$transaction_id) {
        throw new Exception("transaction_id is required");
    }

    $txnWhere = "transaction_id = :transaction_id";
    $txnParams = [
        ":transaction_id" => $transaction_id,
    ];

    if ($categoryCodeInput !== "") {
        $txnWhere .= " AND Category_Code = :category_code";
        $txnParams[":category_code"] = $categoryCodeInput;
    }

    if ($unitCodeInput !== "") {
        $txnWhere .= " AND Unit_Code = :unit_code";
        $txnParams[":unit_code"] = $unitCodeInput;
    }

    if ($terminalNumberInput !== "") {
        $txnWhere .= " AND terminal_number = :terminal_number";
        $txnParams[":terminal_number"] = $terminalNumberInput;
    }

    $sqlTxn = "
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
        WHERE {$txnWhere}
        LIMIT 1
    ";

    $stmtTxn = $pdo->prepare($sqlTxn);
    $stmtTxn->execute($txnParams);
    $transactionSummary = $stmtTxn->fetch(PDO::FETCH_ASSOC);

    if (!$transactionSummary) {
        throw new Exception("Transaction not found.");
    }

    $categoryCode = trim((string)($transactionSummary["Category_Code"] ?? ""));
    $unitCode = trim((string)($transactionSummary["Unit_Code"] ?? ""));

    $sql = "
        SELECT
            d.ID,
            d.transaction_id,
            d.Category_Code,
            d.Unit_Code,
            d.transaction_date,
            d.product_id,
            d.sku,
            d.sales_quantity,
            d.landing_cost,
            d.unit_cost,
            d.selling_price,
            d.vatable,
            d.isDiscountable,
            d.order_status,
            COALESCE(m.item_name, d.product_id) AS item_name,
            COALESCE(m.unit_of_measure, d.product_id) AS unit_of_measure
        FROM tbl_pos_transactions_detailed d
        LEFT JOIN tbl_inventory_products_masterlist m
          ON m.product_id = d.product_id
        WHERE d.transaction_id = :transaction_id
          AND d.Category_Code = :Category_Code
          AND d.Unit_Code = :Unit_Code
        ORDER BY d.ID ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $categoryCode,
        ":Unit_Code" => $unitCode,
    ]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sqlDiscountRows = "
        SELECT
            id,
            transaction_id,
            Category_Code,
            Unit_Code,
            customer_id,
            discount_type,
            discount_amount,
            customer_name,
            date_of_birth,
            gender,
            tin,
            contact_no,
            status,
            usertracker,
            created_at
        FROM tbl_pos_transactions_discounts
        WHERE transaction_id = :transaction_id
          AND Category_Code = :Category_Code
          AND Unit_Code = :Unit_Code
          AND status = 'Active'
        ORDER BY customer_id ASC, id ASC
    ";

    $stmtDiscountRows = $pdo->prepare($sqlDiscountRows);
    $stmtDiscountRows->execute([
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $categoryCode,
        ":Unit_Code" => $unitCode,
    ]);
    $discountRows = $stmtDiscountRows->fetchAll(PDO::FETCH_ASSOC);

    $discountCounts = [
        "senior" => 0,
        "pwd" => 0,
        "manual" => 0,
    ];

    foreach ($discountRows as $row) {
        $key = normalizeDiscountTypeKey($row["discount_type"] ?? "");
        if ($key !== "") {
            $discountCounts[$key]++;
        }
    }

    echo json_encode([
        "success" => true,
        "message" => "Discount items fetched successfully.",
        "transaction_summary" => $transactionSummary,
        "discount_counts" => $discountCounts,
        "discount_rows" => $discountRows,
        "items" => $rows,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "transaction_summary" => null,
        "discount_counts" => [
            "senior" => 0,
            "pwd" => 0,
            "manual" => 0,
        ],
        "discount_rows" => [],
        "items" => [],
    ]);
}
