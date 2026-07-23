<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

date_default_timezone_set('Asia/Manila');

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

try {
    $raw = file_get_contents("php://input");
    $input = json_decode($raw, true);

    if (!$input || !is_array($input)) {
        $input = $_POST;
    }

    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $input = array_merge($input ?: [], $_GET);
    }

    $dateFrom = isset($input["dateFrom"]) ? trim((string)$input["dateFrom"]) : "";
    $dateTo   = isset($input["dateTo"]) ? trim((string)$input["dateTo"]) : "";

    $transactionId = isset($input["transactionId"]) ? trim((string)$input["transactionId"]) : "";
    $invoiceNo     = isset($input["invoiceNo"]) ? trim((string)$input["invoiceNo"]) : "";
    $refundNo      = isset($input["refundNo"]) ? trim((string)$input["refundNo"]) : "";
    $voidNo        = isset($input["voidNo"]) ? trim((string)$input["voidNo"]) : "";

    $categoryCode = isset($input["categoryCode"]) ? trim((string)$input["categoryCode"]) : "";
    $unitCode     = isset($input["unitCode"]) ? trim((string)$input["unitCode"]) : "";
    $terminalNumber = isset($input["terminalNumber"]) ? trim((string)$input["terminalNumber"]) : "";

    if ($terminalNumber === "") {
        $terminalNumber = "1";
    }

    if ($categoryCode === "" || $unitCode === "") {
        throw new Exception("categoryCode and unitCode are required.");
    }

    $hasIdSearch = ($transactionId !== "" || $invoiceNo !== "" || $refundNo !== "" || $voidNo !== "");
    $hasDateRange = ($dateFrom !== "" && $dateTo !== "");

    if (!$hasIdSearch && !$hasDateRange) {
        throw new Exception("Provide a date range, or search by Transaction ID / Invoice Number / Refund Number / Void Number.");
    }

    if ($hasDateRange && strtotime($dateTo) < strtotime($dateFrom)) {
        throw new Exception("dateTo cannot be earlier than dateFrom.");
    }

    /*
    |--------------------------------------------------------------------------
    | TRANSACTION HEADERS
    | Chronological journal: every Paid, Voided, and Refunded transaction
    | matching the selected period and/or the searched identifier.
    |--------------------------------------------------------------------------
    */
    $conditions = [
        "Category_Code = :categoryCode",
        "Unit_Code = :unitCode",
        "terminal_number = :terminalNumber",
        "(
            (remarks = 'Paid' AND status = 'Active' AND COALESCE(void_remarks, '') <> 'Voided')
            OR status = 'Voided'
            OR status = 'Refunded'
        )",
    ];

    $params = [
        ":categoryCode" => $categoryCode,
        ":unitCode" => $unitCode,
        ":terminalNumber" => $terminalNumber,
    ];

    if ($hasDateRange) {
        $conditions[] = "DATE(transaction_date) BETWEEN :dateFrom AND :dateTo";
        $params[":dateFrom"] = $dateFrom;
        $params[":dateTo"] = $dateTo;
    }

    $idConditions = [];
    if ($transactionId !== "") {
        $idConditions[] = "CAST(transaction_id AS CHAR) LIKE :transactionId";
        $params[":transactionId"] = "%{$transactionId}%";
    }
    if ($invoiceNo !== "") {
        $idConditions[] = "invoice_no LIKE :invoiceNo";
        $params[":invoiceNo"] = "%{$invoiceNo}%";
    }
    if ($refundNo !== "") {
        $idConditions[] = "CAST(refund_id AS CHAR) LIKE :refundNo";
        $params[":refundNo"] = "%{$refundNo}%";
    }
    if ($voidNo !== "") {
        $idConditions[] = "CAST(void_id AS CHAR) LIKE :voidNo";
        $params[":voidNo"] = "%{$voidNo}%";
    }

    if (count($idConditions) > 0) {
        $conditions[] = "(" . implode(" OR ", $idConditions) . ")";
    }

    $sqlTxn = "
        SELECT
            ID,
            transaction_id,
            transaction_type,
            transaction_date,
            transaction_time,
            terminal_number,
            table_number,
            order_type,
            invoice_no,
            cashier,
            customer_head_count,
            customer_count_for_discount,
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
            remarks,
            status,
            void_id,
            void_remarks,
            void_date,
            refund_id,
            refund_remarks,
            refund_date
        FROM tbl_pos_transactions
        WHERE " . implode(" AND ", $conditions) . "
        ORDER BY transaction_date ASC, transaction_time ASC, ID ASC
    ";

    $stmtTxn = $pdo->prepare($sqlTxn);
    $stmtTxn->execute($params);
    $transactions = $stmtTxn->fetchAll(PDO::FETCH_ASSOC);

    $itemsByTransaction = [];
    $paymentsByTransaction = [];
    $chargesByTransaction = [];
    $discountsByTransaction = [];

    if (count($transactions) > 0) {
        $transactionIds = array_values(array_unique(array_map(
            fn($row) => $row["transaction_id"],
            $transactions
        )));

        $placeholders = implode(",", array_fill(0, count($transactionIds), "?"));

        /* ---------------- ITEMS ---------------- */
        $sqlItems = "
            SELECT
                d.transaction_id,
                d.product_id,
                d.sales_quantity,
                d.selling_price,
                d.vatable,
                d.isDiscountable,
                COALESCE(m.item_name, d.product_id) AS item_name,
                COALESCE(m.unit_of_measure, '') AS unit_of_measure
            FROM tbl_pos_transactions_detailed d
            LEFT JOIN tbl_inventory_products_masterlist m
                ON m.product_id = d.product_id
            WHERE d.transaction_id IN ($placeholders)
              AND d.Category_Code = ?
              AND d.Unit_Code = ?
            ORDER BY d.ID ASC
        ";
        $stmtItems = $pdo->prepare($sqlItems);
        $stmtItems->execute([...$transactionIds, $categoryCode, $unitCode]);
        foreach ($stmtItems->fetchAll(PDO::FETCH_ASSOC) as $item) {
            $itemsByTransaction[$item["transaction_id"]][] = $item;
        }

        /* ---------------- PAYMENTS ---------------- */
        $sqlPayments = "
            SELECT transaction_id, payment_method, payment_amount, payment_reference
            FROM tbl_pos_transactions_payments
            WHERE transaction_id IN ($placeholders)
              AND Category_Code = ?
              AND Unit_Code = ?
            ORDER BY ID ASC
        ";
        $stmtPayments = $pdo->prepare($sqlPayments);
        $stmtPayments->execute([...$transactionIds, $categoryCode, $unitCode]);
        foreach ($stmtPayments->fetchAll(PDO::FETCH_ASSOC) as $payment) {
            $paymentsByTransaction[$payment["transaction_id"]][] = $payment;
        }

        /* ---------------- OTHER CHARGES ---------------- */
        $sqlCharges = "
            SELECT transaction_id, particulars, amount, reference
            FROM tbl_pos_transactions_other_charges
            WHERE transaction_id IN ($placeholders)
              AND Category_Code = ?
              AND Unit_Code = ?
            ORDER BY ID ASC
        ";
        $stmtCharges = $pdo->prepare($sqlCharges);
        $stmtCharges->execute([...$transactionIds, $categoryCode, $unitCode]);
        foreach ($stmtCharges->fetchAll(PDO::FETCH_ASSOC) as $charge) {
            $chargesByTransaction[$charge["transaction_id"]][] = $charge;
        }

        /* ---------------- DISCOUNT BREAKDOWN ---------------- */
        $sqlDiscounts = "
            SELECT transaction_id, discount_type, COUNT(*) AS qualified_count, SUM(discount_amount) AS discount_amount
            FROM tbl_pos_transactions_discounts
            WHERE transaction_id IN ($placeholders)
              AND Category_Code = ?
              AND Unit_Code = ?
              AND status = 'Active'
            GROUP BY transaction_id, discount_type
        ";
        $stmtDiscounts = $pdo->prepare($sqlDiscounts);
        $stmtDiscounts->execute([...$transactionIds, $categoryCode, $unitCode]);
        foreach ($stmtDiscounts->fetchAll(PDO::FETCH_ASSOC) as $discount) {
            $discountsByTransaction[$discount["transaction_id"]][] = [
                "discount_type" => $discount["discount_type"],
                "qualified_count" => (int)$discount["qualified_count"],
                "discount_amount" => (float)$discount["discount_amount"],
            ];
        }
    }

    $journal = [];
    foreach ($transactions as $row) {
        $journalStatus = "PAID";
        if ($row["status"] === "Voided") {
            $journalStatus = "VOIDED";
        } elseif ($row["status"] === "Refunded") {
            $journalStatus = "REFUNDED";
        }

        $journal[] = [
            "transaction_id" => $row["transaction_id"],
            "invoice_no" => $row["invoice_no"],
            "transaction_date" => $row["transaction_date"],
            "transaction_time" => $row["transaction_time"],
            "terminal_number" => $row["terminal_number"],
            "table_number" => $row["table_number"],
            "order_type" => $row["order_type"],
            "cashier" => $row["cashier"],
            "journal_status" => $journalStatus,
            "customer_head_count" => (int)($row["customer_head_count"] ?? 0),
            "customer_count_for_discount" => (int)($row["customer_count_for_discount"] ?? 0),
            "TotalSales" => (float)($row["TotalSales"] ?? 0),
            "Discount" => (float)($row["Discount"] ?? 0),
            "OtherCharges" => (float)($row["OtherCharges"] ?? 0),
            "TotalAmountDue" => (float)($row["TotalAmountDue"] ?? 0),
            "VATableSales" => (float)($row["VATableSales"] ?? 0),
            "VATableSales_VAT" => (float)($row["VATableSales_VAT"] ?? 0),
            "VATExemptSales" => (float)($row["VATExemptSales"] ?? 0),
            "VATExemptSales_VAT" => (float)($row["VATExemptSales_VAT"] ?? 0),
            "VATZeroRatedSales" => (float)($row["VATZeroRatedSales"] ?? 0),
            "payment_amount" => (float)($row["payment_amount"] ?? 0),
            "payment_method" => $row["payment_method"],
            "change_amount" => (float)($row["change_amount"] ?? 0),
            "void_id" => $row["void_id"],
            "void_remarks" => $row["void_remarks"],
            "void_date" => $row["void_date"],
            "refund_id" => $row["refund_id"],
            "refund_remarks" => $row["refund_remarks"],
            "refund_date" => $row["refund_date"],
            "items" => array_map(function ($item) {
                return [
                    "product_id" => $item["product_id"],
                    "item_name" => $item["item_name"],
                    "unit_of_measure" => $item["unit_of_measure"],
                    "sales_quantity" => (float)($item["sales_quantity"] ?? 0),
                    "selling_price" => (float)($item["selling_price"] ?? 0),
                    "vatable" => $item["vatable"],
                    "isDiscountable" => $item["isDiscountable"],
                ];
            }, $itemsByTransaction[$row["transaction_id"]] ?? []),
            "payments" => array_map(function ($payment) {
                return [
                    "payment_method" => $payment["payment_method"],
                    "payment_amount" => (float)($payment["payment_amount"] ?? 0),
                    "payment_reference" => $payment["payment_reference"],
                ];
            }, $paymentsByTransaction[$row["transaction_id"]] ?? []),
            "other_charges" => array_map(function ($charge) {
                return [
                    "particulars" => $charge["particulars"],
                    "amount" => (float)($charge["amount"] ?? 0),
                ];
            }, $chargesByTransaction[$row["transaction_id"]] ?? []),
            "discount_breakdown" => $discountsByTransaction[$row["transaction_id"]] ?? [],
        ];
    }

    echo json_encode([
        "success" => true,
        "message" => "E-Journal report loaded successfully.",
        "dateFrom" => $dateFrom,
        "dateTo" => $dateTo,
        "totalInvoices" => count($journal),
        "data" => $journal,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "data" => [],
    ]);
}
