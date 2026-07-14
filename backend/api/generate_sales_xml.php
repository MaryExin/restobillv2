<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: POST, OPTIONS");
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);
    exit;
}

$config = require __DIR__ . "/config.php";

function valueOrZero($value): string
{
    if ($value === null || $value === "") {
        return "0";
    }

    if (is_numeric($value)) {
        return number_format((float)$value, 2, ".", "");
    }

    return (string)$value;
}

function valueOrIntString($value): string
{
    if ($value === null || $value === "") {
        return "0";
    }

    return (string)((int)$value);
}

function safeDateString(?string $value, string $format, string $fallback = ""): string
{
    if (!$value) {
        return $fallback;
    }

    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return $fallback;
    }

    return date($format, $timestamp);
}

function xmlEscape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, "UTF-8");
}

function buildAffectedProductsXml(array $affectedProducts): string
{
    $xml = "<master>";

    foreach ($affectedProducts as $product) {
        $xml .= "<product>";
        $xml .= "<sku>" . xmlEscape((string)($product["sku"] ?? "")) . "</sku>";
        $xml .= "<name>" . xmlEscape((string)($product["name"] ?? "")) . "</name>";
        $xml .= "<inventory>" . xmlEscape((string)($product["inventory"] ?? "1")) . "</inventory>";
        $xml .= "<price>" . xmlEscape((string)($product["price"] ?? "0.00")) . "</price>";
        $xml .= "<category>" . xmlEscape((string)($product["category"] ?? "99")) . "</category>";
        $xml .= "</product>";
    }

    $xml .= "</master>";

    return $xml;
}

try {
    $pdo = new PDO(
        "mysql:host={$config["host"]};dbname={$config["db"]};charset=utf8mb4",
        $config["user"],
        $config["pass"],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);
    $input = is_array($json) ? $json : $_POST;

    $categoryCode = trim((string)($input["categoryCode"] ?? $input["category_code"] ?? ""));
    $unitCode = trim((string)($input["unitCode"] ?? $input["unit_code"] ?? ""));
    $terminalNumber = trim((string)($input["terminalNumber"] ?? $input["terminal_number"] ?? "1"));
    $reportDate = trim((string)($input["reportDate"] ?? $input["report_date"] ?? date("Y-m-d")));
    $tenantId = trim((string)($input["tenantId"] ?? "19092784"));
    $tenantKey = trim((string)($input["tenantKey"] ?? "K9BRJGJS"));

    if ($categoryCode === "" || $unitCode === "") {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "categoryCode and unitCode are required."
        ]);
        exit;
    }

    $sqlSales = "
        SELECT
            t1.Opening_DateTime,
            t1.Opening_Cash_Count,
            t1.Closing_DateTime,
            t1.Closing_Cash_Count,
            t1.Beg_OR,
            t1.End_OR,
            t1.Beg_VoidNo,
            t1.End_VoidNo,
            t1.Beg_RefundNo,
            t1.End_RefundNo,
            t1.Z_Counter_No,
            IFNULL(t2.Present_Accum_Sales, 0) AS Present_Accum_Sales,
            (IFNULL(t2.Present_Accum_Sales, 0) - IFNULL(t4.Sales_For_The_Day, 0)) AS Previous_Accum_Sales,
            (IFNULL(t2.Present_VATableSales, 0) - IFNULL(t4.VATableSales, 0)) AS Previous_VATableSales,
            (IFNULL(t2.Present_Accum_VAT, 0) - IFNULL(t4.VATableSales_VAT, 0)) AS Previous_Accum_VAT,
            (IFNULL(t2.Present_VATExemptSales, 0) - IFNULL(t4.VATExemptSales, 0)) AS Previous_VATExemptSales,
            IFNULL(t4.Sales_For_The_Day, 0) AS Sales_For_The_Day,
            IFNULL(t4.VATableSales, 0) AS VATableSales,
            IFNULL(t4.VATableSales_VAT, 0) AS VATableSales_VAT,
            IFNULL(t4.VATExemptSales, 0) AS VATExemptSales,
            IFNULL(t4.VATExemptSales_VAT, 0) AS VATExemptSales_VAT,
            IFNULL(t4.VATZeroRatedSales, 0) AS VATZeroRatedSales,
            IFNULL(t4.OtherCharges, 0) AS OtherCharges,
            IFNULL(t4.Gross_Amount, 0) AS Gross_Amount,
            IFNULL(t4.Discount, 0) AS Discount,
            IFNULL(t5.Voided_Sales, 0) AS Voided_Sales,
            IFNULL(t6.Refunded_Sales, 0) AS Refunded_Sales,
            IFNULL(t7.Discount_SRC, 0) AS Discount_SRC,
            IFNULL(t8.Discount_PWD, 0) AS Discount_PWD,
            IFNULL(t9.Discount_NAAC, 0) AS Discount_NAAC,
            IFNULL(t10.Discount_SoloParent, 0) AS Discount_SoloParent,
            IFNULL(t11.Discount_Others, 0) AS Discount_Others,
            IFNULL(t12.Payment_Cash, 0) AS Payment_Cash,
            IFNULL(t13.Payment_Cheque, 0) AS Payment_Cheque,
            IFNULL(t14.Payment_CreditCard, 0) AS Payment_CreditCard,
            IFNULL(t15.Payment_Others, 0) AS Payment_Others,
            IFNULL(t16.Payment_GiftCert, 0) AS Payment_GiftCert,
            IFNULL(t17.Payment_Charge, 0) AS Payment_Charge
        FROM
            (
                SELECT
                    Opening_DateTime,
                    Opening_Cash_Count,
                    Closing_DateTime,
                    Closing_Cash_Count,
                    Beg_OR,
                    End_OR,
                    Beg_VoidNo,
                    End_VoidNo,
                    Beg_RefundNo,
                    End_RefundNo,
                    Z_Counter_No
                FROM tbl_pos_shifting_records
                WHERE Category_Code = ?
                  AND Unit_Code = ?
                  AND terminal_number = ?
                  AND DATE(Opening_DateTime) = ?
                LIMIT 1
            ) AS t1,
            (
                SELECT SUM(TotalSales) AS Present_Accum_Sales,
                       SUM(VATableSales) AS Present_VATableSales,
                       SUM(VATableSales_VAT) AS Present_Accum_VAT,
                       SUM(VATExemptSales) AS Present_VATExemptSales
                FROM tbl_pos_transactions
                WHERE Category_Code = ?
                  AND Unit_Code = ?
                  AND terminal_number = ?
                  AND Status = 'Active'
            ) AS t2,
            (
                SELECT SUM(TotalSales) AS Previous_Accum_Sales
                FROM tbl_pos_transactions
                WHERE Category_Code = ?
                  AND Unit_Code = ?
                  AND terminal_number = ? 
                  AND Status = 'Active'
            ) AS t3,
            (
                SELECT
                    SUM(TotalSales) AS Sales_For_The_Day,
                    SUM(VATableSales) AS VATableSales,
                    SUM(VATableSales_VAT) AS VATableSales_VAT,
                    SUM(VATExemptSales) AS VATExemptSales,
                    SUM(VATExemptSales_VAT) AS VATExemptSales_VAT,
                    SUM(VATZeroRatedSales) AS VATZeroRatedSales,
                    SUM(TotalSales) AS Gross_Amount,
                    SUM(Discount) AS Discount,
                    SUM(OtherCharges) AS OtherCharges
                FROM tbl_pos_transactions
                WHERE Category_Code = ?
                  AND Unit_Code = ?
                  AND terminal_number = ?
                  AND DATE(transaction_date) = ?
                  AND Status = 'Active'
            ) AS t4,
            (
                SELECT SUM(TotalSales) AS Voided_Sales
                FROM tbl_pos_transactions
                WHERE Category_Code = ?
                  AND Unit_Code = ?
                  AND terminal_number = ?
                  AND DATE(transaction_date) = ?
                  AND Status = 'Voided'
            ) AS t5,
            (
                SELECT SUM(TotalSales) AS Refunded_Sales
                FROM tbl_pos_transactions
                WHERE Category_Code = ?
                  AND Unit_Code = ?
                  AND terminal_number = ?
                  AND DATE(transaction_date) = ?
                  AND Status = 'Refunded'
            ) AS t6,
            (
                SELECT SUM(t2.discount_amount) AS Discount_SRC
                FROM tbl_pos_transactions AS t1
                LEFT JOIN tbl_pos_transactions_discounts AS t2
                    ON t1.transaction_id = t2.transaction_id
                WHERE DATE(t1.transaction_date) = ?
                  AND t2.discount_type = 'Senior Citizen'
                  AND t1.Status = 'Active'
            ) AS t7,
            (
                SELECT SUM(t2.discount_amount) AS Discount_PWD
                FROM tbl_pos_transactions AS t1
                LEFT JOIN tbl_pos_transactions_discounts AS t2
                    ON t1.transaction_id = t2.transaction_id
                WHERE DATE(t1.transaction_date) = ?
                  AND t2.discount_type = 'PWD'
                  AND t1.Status = 'Active'
            ) AS t8,
            (
                SELECT SUM(t2.discount_amount) AS Discount_NAAC
                FROM tbl_pos_transactions AS t1
                LEFT JOIN tbl_pos_transactions_discounts AS t2
                    ON t1.transaction_id = t2.transaction_id
                WHERE DATE(t1.transaction_date) = ?
                  AND t2.discount_type = 'NAAC'
                  AND t1.Status = 'Active'
            ) AS t9,
            (
                SELECT SUM(t2.discount_amount) AS Discount_SoloParent
                FROM tbl_pos_transactions AS t1
                LEFT JOIN tbl_pos_transactions_discounts AS t2
                    ON t1.transaction_id = t2.transaction_id
                WHERE DATE(t1.transaction_date) = ?
                  AND t2.discount_type = 'Solo Parent'
                  AND t1.Status = 'Active'
            ) AS t10,
            (
                SELECT SUM(Discount) AS Discount_Others
                FROM tbl_pos_transactions
                WHERE DATE(transaction_date) = ?
                  AND discount_type <> 'Senior Citizen'
                  AND discount_type <> 'PWD'
                  AND discount_type <> 'NAAC'
                  AND discount_type <> 'Solo Parent'
                  AND Status = 'Active'
            ) AS t11,
            (
                SELECT SUM(b.payment_amount - a.change_amount) AS Payment_Cash
                FROM tbl_pos_transactions a
                INNER JOIN tbl_pos_transactions_payments b
                    ON a.transaction_id = b.transaction_id
                   AND a.Unit_Code = b.Unit_Code
                WHERE a.Category_Code = ?
                  AND a.Unit_Code = ?
                  AND a.terminal_number = ?
                  AND DATE(a.transaction_date) = ?
                  AND b.payment_method = 'Cash'
                  AND a.status = 'Active'
            ) AS t12,
            (
                SELECT SUM(b.payment_amount) AS Payment_Cheque
                FROM tbl_pos_transactions a
                INNER JOIN tbl_pos_transactions_payments b
                    ON a.transaction_id = b.transaction_id
                   AND a.Unit_Code = b.Unit_Code
                WHERE a.Category_Code = ?
                  AND a.Unit_Code = ?
                  AND a.terminal_number = ?
                  AND DATE(a.transaction_date) = ?
                  AND b.payment_method = 'Cheque'
                  AND a.Status = 'Active'
            ) AS t13,
            (
                SELECT SUM(b.payment_amount) AS Payment_CreditCard
                FROM tbl_pos_transactions a
                INNER JOIN tbl_pos_transactions_payments b
                    ON a.transaction_id = b.transaction_id
                   AND a.Unit_Code = b.Unit_Code
                WHERE a.Category_Code = ?
                  AND a.Unit_Code = ?
                  AND a.terminal_number = ?
                  AND DATE(a.transaction_date) = ?
                  AND b.payment_method = 'Credit'
                  AND a.Status = 'Active'
            ) AS t14,
            (
                SELECT SUM(b.payment_amount) AS Payment_Others
                FROM tbl_pos_transactions a
                INNER JOIN tbl_pos_transactions_payments b
                    ON a.transaction_id = b.transaction_id
                   AND a.Unit_Code = b.Unit_Code
                WHERE a.Category_Code = ?
                  AND a.Unit_Code = ?
                  AND a.terminal_number = ?
                  AND DATE(a.transaction_date) = ?
                  AND b.payment_method NOT IN ('Cash','GiftCert','Credit','Charge','ChargeToOwner','ChargeToEmployees','ChargeToExpenses')
                  AND a.Status = 'Active'
            ) AS t15,
            (
                SELECT SUM(b.payment_amount) AS Payment_GiftCert
                FROM tbl_pos_transactions a
                INNER JOIN tbl_pos_transactions_payments b
                    ON a.transaction_id = b.transaction_id
                   AND a.Unit_Code = b.Unit_Code
                WHERE a.Category_Code = ?
                  AND a.Unit_Code = ?
                  AND a.terminal_number = ?
                  AND DATE(a.transaction_date) = ?
                  AND b.payment_method = 'GiftCert'
                  AND a.Status = 'Active'
            ) AS t16,
            (
                SELECT SUM(b.payment_amount) AS Payment_Charge
                FROM tbl_pos_transactions a
                INNER JOIN tbl_pos_transactions_payments b
                    ON a.transaction_id = b.transaction_id
                   AND a.Unit_Code = b.Unit_Code
                WHERE a.Category_Code = ?
                  AND a.Unit_Code = ?
                  AND a.terminal_number = ?
                  AND DATE(a.transaction_date) = ?
                  AND b.payment_method IN ('Charge', 'ChargeToOwner', 'ChargeToEmployees', 'ChargeToExpenses')
                  AND a.Status = 'Active'
            ) AS t17
    ";

    $salesParams = [
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $categoryCode, $unitCode, $terminalNumber,
        $categoryCode, $unitCode, $terminalNumber,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $reportDate,
        $reportDate,
        $reportDate,
        $reportDate,
        $reportDate,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
        $categoryCode, $unitCode, $terminalNumber, $reportDate,
    ];

    $stmtSales = $pdo->prepare($sqlSales);
    $stmtSales->execute($salesParams);
    $salesRow = $stmtSales->fetch();

    if (!$salesRow) {
        echo json_encode([
            "success" => false,
            "message" => "No sales data found."
        ]);
        exit;
    }

    $sqlCount = "
        SELECT
            COUNT(DISTINCT CASE WHEN t1.status = 'Voided' THEN t1.transaction_id END) AS voided_count,
            COUNT(DISTINCT CASE WHEN t1.status = 'Refunded' THEN t1.transaction_id END) AS refund_count,
            COUNT(DISTINCT CASE WHEN t2.discount_type = 'Senior Citizen' AND t1.Status = 'Active' THEN t1.transaction_id END) AS senior_count,
            COUNT(DISTINCT CASE WHEN t2.discount_type = 'PWD' AND t1.Status = 'Active' THEN t1.transaction_id END) AS pwd_count,
            COUNT(DISTINCT CASE WHEN t2.discount_type <> 'No Discount' THEN t1.transaction_id END) AS all_disc_count,
            COUNT(DISTINCT CASE WHEN t3.payment_method = 'Cash' AND t1.Status = 'Active' THEN t1.transaction_id END) AS cash_count,
            COUNT(DISTINCT CASE WHEN t3.payment_method = 'Credit' AND t1.Status = 'Active' THEN t1.transaction_id END) AS credit_count,
            COUNT(DISTINCT CASE WHEN t3.payment_method = 'GiftCert' AND t1.Status = 'Active' THEN t1.transaction_id END) AS giftcheck_count,
            COUNT(DISTINCT CASE WHEN t3.payment_method = 'Charge' AND t1.Status = 'Active' THEN t1.transaction_id END) AS charge_count,
            COUNT(DISTINCT CASE WHEN t3.payment_method IN ('ChargeToOwner', 'ChargeToEmployees', 'ChargeToExpenses') AND t1.Status = 'Active' THEN t1.transaction_id END) AS charge_to_count,
            COUNT(DISTINCT CASE WHEN t3.payment_method NOT IN ('Cash','GiftCert','Credit','Charge','ChargeToOwner','ChargeToEmployees','ChargeToExpenses') AND t1.Status = 'Active' THEN t1.transaction_id END) AS othertender_count,
            COUNT(DISTINCT t1.transaction_id) AS total_transaction
        FROM tbl_pos_transactions AS t1
        LEFT JOIN tbl_pos_transactions_discounts AS t2
            ON t1.transaction_id = t2.transaction_id
        LEFT JOIN tbl_pos_transactions_payments AS t3
            ON t1.transaction_id = t3.transaction_id
        WHERE t1.Unit_Code = ?
          AND t1.terminal_number = ?
          AND DATE(t1.transaction_date) = ?
    ";

    $stmtCount = $pdo->prepare($sqlCount);
    $stmtCount->execute([
        $unitCode,
        $terminalNumber,
        $reportDate
    ]);
    $countRow = $stmtCount->fetch() ?: [];

    $sqlTransactions = "
        SELECT
            t1.*,
            IFNULL(dtl.sales_quantity, 0) AS sales_quantity,

            IFNULL(pay.total_payment, 0) AS total_payment,
            IFNULL(pay.cash_payment, 0) AS cash_payment,
            IFNULL(pay.cheque_payment, 0) AS cheque_payment,
            IFNULL(pay.credit_payment, 0) AS credit_payment,
            IFNULL(pay.giftcert_payment, 0) AS giftcert_payment,
            IFNULL(pay.charge_payment, 0) AS charge_payment,
            IFNULL(pay.other_payment, 0) AS other_payment,

            IFNULL(disc.total_discount_amount, 0) AS total_discount_amount,
            IFNULL(disc.senior_discount, 0) AS senior_discount,
            IFNULL(disc.pwd_discount, 0) AS pwd_discount,
            IFNULL(disc.naac_discount, 0) AS naac_discount,
            IFNULL(disc.solo_parent_discount, 0) AS solo_parent_discount,
            IFNULL(disc.other_discount, 0) AS other_discount

        FROM tbl_pos_transactions AS t1

        LEFT JOIN (
            SELECT
                transaction_id,
                SUM(sales_quantity) AS sales_quantity
            FROM tbl_pos_transactions_detailed
            GROUP BY transaction_id
        ) AS dtl
            ON t1.transaction_id = dtl.transaction_id

        LEFT JOIN (
            SELECT
                transaction_id,
                Unit_Code,
                SUM(payment_amount) AS total_payment,
                SUM(CASE WHEN payment_method = 'Cash' THEN payment_amount ELSE 0 END) AS cash_payment,
                SUM(CASE WHEN payment_method = 'Cheque' THEN payment_amount ELSE 0 END) AS cheque_payment,
                SUM(CASE WHEN payment_method IN ('Credit', 'CreditCard') THEN payment_amount ELSE 0 END) AS credit_payment,
                SUM(CASE WHEN payment_method IN ('GiftCert', 'GiftCheck') THEN payment_amount ELSE 0 END) AS giftcert_payment,
                SUM(CASE WHEN payment_method IN ('Charge', 'ChargeToOwner', 'ChargeToEmployees', 'ChargeToExpenses') THEN payment_amount ELSE 0 END) AS charge_payment,
                SUM(
                    CASE
                        WHEN payment_method NOT IN (
                            'Cash',
                            'Cheque',
                            'Credit',
                            'CreditCard',
                            'GiftCert',
                            'GiftCheck',
                            'Charge',
                            'ChargeToOwner',
                            'ChargeToEmployees',
                            'ChargeToExpenses'
                        )
                        THEN payment_amount
                        ELSE 0
                    END
                ) AS other_payment
            FROM tbl_pos_transactions_payments
            GROUP BY transaction_id, Unit_Code
        ) AS pay
            ON t1.transaction_id = pay.transaction_id
           AND t1.Unit_Code = pay.Unit_Code

        LEFT JOIN (
            SELECT
                transaction_id,
                SUM(discount_amount) AS total_discount_amount,
                SUM(CASE WHEN discount_type = 'Senior Citizen' THEN discount_amount ELSE 0 END) AS senior_discount,
                SUM(CASE WHEN discount_type = 'PWD' THEN discount_amount ELSE 0 END) AS pwd_discount,
                SUM(CASE WHEN discount_type = 'NAAC' THEN discount_amount ELSE 0 END) AS naac_discount,
                SUM(CASE WHEN discount_type = 'Solo Parent' THEN discount_amount ELSE 0 END) AS solo_parent_discount,
                COUNT(CASE WHEN discount_type = 'Senior Citizen' THEN 0 END) AS senior_discount_count,
                COUNT(CASE WHEN discount_type = 'PWD' THEN 0 END) AS pwd_discount_count,
                COUNT(CASE WHEN discount_type = 'NAAC' THEN 0 END) AS naac_discount_count,
                COUNT(CASE WHEN discount_type = 'Solo Parent' THEN 0 END) AS solo_parent_discount_count,
                SUM(
                    CASE
                        WHEN discount_type NOT IN ('Senior Citizen', 'PWD', 'NAAC', 'Solo Parent', 'No Discount')
                        THEN discount_amount
                        ELSE 0
                    END
                ) AS other_discount,
                COUNT(
                    CASE
                        WHEN discount_type NOT IN ('Senior Citizen', 'PWD', 'NAAC', 'Solo Parent', 'No Discount')
                            AND discount_amount > 0
                        THEN 1
                    END
                ) AS other_discount_count
            FROM tbl_pos_transactions_discounts
            GROUP BY transaction_id
        ) AS disc
            ON t1.transaction_id = disc.transaction_id

        WHERE t1.Category_Code = ?
          AND t1.Unit_Code = ?
          AND t1.terminal_number = ?
          AND DATE(t1.transaction_date) = ?
          AND t1.Status = 'Active'
        ORDER BY t1.transaction_id ASC
    ";

    $stmtTransactions = $pdo->prepare($sqlTransactions);
    $stmtTransactions->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate
    ]);
    $transactionRows = $stmtTransactions->fetchAll();

    $sqlLines = "
        SELECT
            sku,
            product_id,
            sales_quantity,
            selling_price,
            landing_cost,
            unit_cost,
            vatable,
            isDiscountable,
            order_status
        FROM tbl_pos_transactions_detailed
        WHERE transaction_id = ?
    ";

    $stmtLines = $pdo->prepare($sqlLines);

    $transactions = [];

    foreach ($transactionRows as $trxRow) {
        $trxcash = valueOrZero($trxRow["cash_payment"] ?? 0);
        $trxcredit = valueOrZero($trxRow["credit_payment"] ?? 0);
        $trxcharge = valueOrZero($trxRow["charge_payment"] ?? 0);
        $trxgiftcheck = valueOrZero($trxRow["giftcert_payment"] ?? 0);
        $trxothertender = valueOrZero($trxRow["other_payment"] ?? 0);

        $disc = valueOrZero($trxRow["other_discount"] ?? 0);
        $senior = valueOrZero($trxRow["senior_discount"] ?? 0);
        $pwd = valueOrZero($trxRow["pwd_discount"] ?? 0);
        $diplomat = "0";
        $nac = valueOrZero($trxRow["naac_discount"] ?? 0);

        $discCnt = valueOrZero($trxRow["other_discount_count"] ?? 0);
        $seniorCnt = valueOrZero($trxRow["senior_discount_count"] ?? 0);
        $pwdCnt = valueOrZero($trxRow["pwd_discount_count"] ?? 0);
        $diplomatCnt = "0";
        $nacCnt = valueOrZero($trxRow["naac_discount_count"] ?? 0);

        $stmtLines->execute([
            $trxRow["transaction_id"]
        ]);
        $lineRows = $stmtLines->fetchAll();

        $lines = [];

        foreach ($lineRows as $lineRow) {
            $qty = $lineRow["sales_quantity"] === null ? 0 : (float)$lineRow["sales_quantity"];
            $unitPrice = $lineRow["selling_price"] === null ? 0 : (float)$lineRow["selling_price"];
            $total = $qty * $unitPrice;

            $vatable = strtolower((string)($lineRow["vatable"] ?? ""));
            $taxtype = ($vatable === "1" || $vatable === "yes" || $vatable === "true") ? "1" : "0";
            $tax = $taxtype === "1" ? round($total - ($total / 1.12), 2) : 0;

            $lines[] = [
                "sku" => (string)($lineRow["sku"] ?? ""),
                "qty" => number_format($qty, 2, ".", ""),
                "unitprice" => number_format($unitPrice, 2, ".", ""),
                "disc" => "0.00",
                "senior" => "0.00",
                "pwd" => "0.00",
                "diplomat" => "0.00",
                "nac" => "0.00",
                "taxtype" => $taxtype,
                "tax" => number_format($tax, 2, ".", ""),
                "memo" => (string)($lineRow["order_status"] ?? ""),
                "total" => number_format($total, 2, ".", ""),
                "choicetype" => ""
            ];
        }

        $transactions[] = [
            "receiptno" => (string)($trxRow["invoice_no"] ?? ""),
            "void" => (string)($trxRow["void_id"] ?? ""),
            "cash" => $trxcash,
            "credit" => $trxcredit,
            "charge" => $trxcharge,
            "giftcheck" => $trxgiftcheck,
            "othertender" => $trxothertender,
            "linedisc" => $discCnt,
            "linesenior" => $seniorCnt,
            "evat" => "0.00",
            "linepwd" => $pwdCnt,
            "linediplomat" => $diplomatCnt,
            "linenac" => $nacCnt,
            "subtotal" => valueOrZero($trxRow["(TotalAmountDue)"] ?? "0"),
            "disc" => $disc,
            "senior" => $senior,
            "pwd" => $pwd,
            "diplomat" => $diplomat,
            "nac" => $nac,
            "vat" => valueOrZero($trxRow["VATableSales_VAT"] ?? "0"),
            "exvat" => "0.00",
            "incvat" => valueOrZero($trxRow["VATableSales_VAT"] ?? "0"),
            "localtax" => "0.00",
            "amusement" => "0.00",
            "ewt" => "0.00",
            "service" => "0.00",
            "taxsale" => valueOrZero($trxRow["(TotalAmountDue)"] ?? "0"),
            "notaxsale" => "0.00",
            "taxexsale" => valueOrZero($trxRow["VATExemptSale"] ?? "0"),
            "taxincsale" => valueOrZero($trxRow["VATableSales"] ?? "0"),
            "zerosale" => valueOrZero($trxRow["VATZeroRatedSales"] ?? "0"),
            "vatexempt" => valueOrZero($trxRow["VATExemptSales_VAT"] ?? "0"),
            "customercount" => (string)($trxRow["customer_head_count"] ?? "0"),
            "gross" => valueOrZero($trxRow["TotalSales"] ?? "0"),
            "refund" => "0.00",
            "taxrate" => "12.00",
            "posted" => date("YmdHis"),
            "qty" => valueOrZero($trxRow["sales_quantity"] ?? "0"),
            "created" => "1",
            "memo" => "",
            "lines" => $lines
        ];
    }

    /*
     * AFFECTED PRODUCTS ONLY
     * Based on tbl_pos_transactions_detailed for the selected date / terminal / unit / category.
     *
     * NOTE:
     * - LEFT JOIN to tbl_inventory_products_masterlist is optional and only used to get product_name/category if available.
     * - If your actual product master fields are different, just adjust pm.product_name / pm.item_category / pm.category.
     */
    $sqlAffectedProducts = "
        SELECT
            d.product_id,
            d.sku,
            pm.item_name AS product_name,
            MAX(COALESCE(d.selling_price, 0)) AS unit_price,
            MAX(
                CASE
                    WHEN LOWER(COALESCE(pm.item_category, 'inventory')) LIKE '%non-inventory%' THEN 0
                    ELSE 1
                END
            ) AS inventory_flag,
            MAX(COALESCE(pm.item_category, pm.item_category, 99)) AS category
        FROM tbl_pos_transactions_detailed AS d
        INNER JOIN tbl_pos_transactions AS t
            ON t.transaction_id = d.transaction_id
           AND t.Category_Code = d.Category_Code
           AND t.Unit_Code = d.Unit_Code
        LEFT JOIN tbl_inventory_products_masterlist AS pm
            ON pm.product_id = d.product_id
        WHERE t.Category_Code = ?
          AND t.Unit_Code = ?
          AND t.terminal_number = ?
          AND DATE(t.transaction_date) = ?
          AND t.Status = 'Active'
        GROUP BY d.product_id, d.sku
        ORDER BY product_name ASC
    ";

    $stmtAffectedProducts = $pdo->prepare($sqlAffectedProducts);
    $stmtAffectedProducts->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate
    ]);
    $affectedProductRows = $stmtAffectedProducts->fetchAll();

    $affectedProducts = [];

    foreach ($affectedProductRows as $productRow) {
        $sku = (string)($productRow["sku"] ?? $productRow["product_id"] ?? "");
        $productId = (string)($productRow["product_id"] ?? "");
        $name = trim((string)($productRow["product_name"] ?? ""));
        $inventory = (string)((int)($productRow["inventory_flag"] ?? 1));
        $price = number_format((float)($productRow["unit_price"] ?? 0), 2, ".", "");
        $category = (string)($productRow["category"] ?? "99");

        if ($name === "") {
            $name = $sku !== "" ? $sku : $productId;
        }

        $affectedProducts[] = [
            "sku" => $sku,
            "product_id" => $productId,
            "name" => $name,
            "inventory" => $inventory,
            "price" => $price,
            "category" => $category
        ];
    }

    $affectedProductsXml = buildAffectedProductsXml($affectedProducts);

    echo json_encode([
        "success" => true,
        "message" => "Sales XML data loaded successfully.",
        "data" => [
            "tenantId" => $tenantId,
            "tenantKey" => $tenantKey,
            "terminalNumber" => $terminalNumber,
            "reportDate" => $reportDate,
            "reportDateXml" => safeDateString($reportDate, "Ymd", ""),
            "affectedProducts" => $affectedProducts,
            "affectedProductsXml" => $affectedProductsXml,
            "sales" => [
                "date" => safeDateString($reportDate, "Ymd", ""),
                "zcounter" => (string)($salesRow["Z_Counter_No"] ?? "0"),
                "previousnrgt" => (string)($salesRow["Previous_Accum_Sales"] ?? "0"),
                "nrgt" => (string)($salesRow["Present_Accum_Sales"] ?? "0"),
                "previoustax" => (string)($salesRow["Previous_Accum_VAT"] ?? "0"),
                "newtax" => (string)($salesRow["VATableSales_VAT"] ?? "0"),
                "previoustaxsale" => (string)($salesRow["Previous_VATableSales"] ?? "0"),
                "newtaxsale" => (string)($salesRow["VATableSales"] ?? "0"),
                "previousnotaxsale" => (string)($salesRow["Previous_VATExemptSales"] ?? "0"),
                "newnotaxsale" => (string)($salesRow["VATExemptSales"] ?? "0"),
                "opentime" => safeDateString((string)($salesRow["Opening_DateTime"] ?? ""), "YmdHis", ""),
                "closetime" => safeDateString((string)($salesRow["Closing_DateTime"] ?? ""), "YmdHis", ""),
                "gross" => (string)($salesRow["Gross_Amount"] ?? "0"),
                "vat" => number_format((float)($salesRow["VATableSales_VAT"] ?? 0) + (float)($salesRow["VATExemptSales_VAT"] ?? 0), 2,".",""),
                "localtax" => "0",
                "amusement" => "0",
                "ewt" => "0",
                "taxsale" => (string)($salesRow["VATableSales"] ?? "0"),
                "notaxsale" => (string)($salesRow["VATExemptSales"] ?? "0"),
                "zerosale" => (string)($salesRow["VATZeroRatedSales"] ?? "0"),
                "vatexempt" => (string)($salesRow["VATExemptSales"] ?? "0"),
                "void" => (string)($salesRow["Voided_Sales"] ?? "0"),
                "voidcnt" => (string)($countRow["voided_count"] ?? "0"),
                "disc" => (string)($salesRow["Discount"] ?? "0"),
                "disccnt" => (string)($countRow["all_disc_count"] ?? "0"),
                "refund" => (string)($salesRow["Refunded_Sales"] ?? "0"),
                "refundcnt" => (string)($countRow["refund_count"] ?? "0"),
                "senior" => (string)($salesRow["Discount_SRC"] ?? "0"),
                "seniorcnt" => (string)($countRow["senior_count"] ?? "0"),
                "pwd" => (string)($salesRow["Discount_PWD"] ?? "0"),
                "pwdcnt" => (string)($countRow["pwd_count"] ?? "0"),
                "diplomat" => "0",
                "diplomatcnt" => "0",
                "nac" => "0",
                "naccnt" => "0",
                "service" => "0",
                "servicecnt" => "0",
                "receiptstart" => (string)($salesRow["Beg_OR"] ?? ""),
                "receiptend" => (string)($salesRow["End_OR"] ?? ""),
                "trxcnt" => (string)($countRow["total_transaction"] ?? "0"),
                "cash" => (string)($salesRow["Payment_Cash"] ?? "0"),
                "cashcnt" => (string)($countRow["cash_count"] ?? "0"),
                "credit" => (string)($salesRow["Payment_CreditCard"] ?? "0"),
                "creditcnt" => (string)($countRow["credit_count"] ?? "0"),
                "charge" => (string)($salesRow["Payment_Charge"] ?? "0"),
                "chargecnt" => (string)($countRow["charge_count"] ?? "0"),
                "giftcheck" => (string)($salesRow["Payment_GiftCert"] ?? "0"),
                "giftcheckcnt" => (string)($countRow["giftcheck_count"] ?? "0"),
                "othertender" => (string)($salesRow["Payment_Others"] ?? "0"),
                "othertendercnt" => (string)($countRow["othertender_count"] ?? "0")
            ],
            "transactions" => $transactions
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}