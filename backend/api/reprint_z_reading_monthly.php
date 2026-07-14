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

$config = require __DIR__ . "/config.php";

try {
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['db']};charset=utf8mb4",
        $config["user"],
        $config["pass"],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $raw = file_get_contents("php://input");
    $input = json_decode($raw, true);

    if (!$input || !is_array($input)) {
        $input = $_POST;
    }

    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $input = array_merge($input ?: [], $_GET);
    }

    $dateFrom = isset($input["dateFrom"])
        ? trim((string)$input["dateFrom"])
        : (isset($input["date_from"]) ? trim((string)$input["date_from"]) : "");

    $dateTo = isset($input["dateTo"])
        ? trim((string)$input["dateTo"])
        : (isset($input["date_to"]) ? trim((string)$input["date_to"]) : "");

    $categoryCode = "";
    if (isset($input["categoryCode"])) {
        $categoryCode = trim((string)$input["categoryCode"]);
    } elseif (isset($input["category_code"])) {
        $categoryCode = trim((string)$input["category_code"]);
    } elseif (isset($input["Category_Code"])) {
        $categoryCode = trim((string)$input["Category_Code"]);
    }

    $unitCode = "";
    if (isset($input["unitCode"])) {
        $unitCode = trim((string)$input["unitCode"]);
    } elseif (isset($input["unit_code"])) {
        $unitCode = trim((string)$input["unit_code"]);
    } elseif (isset($input["Unit_Code"])) {
        $unitCode = trim((string)$input["Unit_Code"]);
    }

    $terminalNumber = "";
    if (isset($input["terminalNumber"])) {
        $terminalNumber = trim((string)$input["terminalNumber"]);
    } elseif (isset($input["terminal_number"])) {
        $terminalNumber = trim((string)$input["terminal_number"]);
    } elseif (isset($input["Terminal_Number"])) {
        $terminalNumber = trim((string)$input["Terminal_Number"]);
    }

    if ($terminalNumber === "") {
        $terminalNumber = "1";
    }

    $machineNumber = isset($input["machineNumber"])
        ? trim((string)$input["machineNumber"])
        : (isset($input["machine_number"]) ? trim((string)$input["machine_number"]) : "10000000001");

    $serialNumber = isset($input["serialNumber"])
        ? trim((string)$input["serialNumber"])
        : (isset($input["serial_number"]) ? trim((string)$input["serial_number"]) : "20000000001");

    $ptuNumber = isset($input["ptuNumber"])
        ? trim((string)$input["ptuNumber"])
        : (isset($input["ptu_number"]) ? trim((string)$input["ptu_number"]) : "00000000-000-0000000-00000");

    $ptuDateIssued = isset($input["ptuDateIssued"])
        ? trim((string)$input["ptuDateIssued"])
        : (isset($input["ptu_date_issued"]) ? trim((string)$input["ptu_date_issued"]) : "01/01/2023");

    if ($dateFrom === "" || $dateTo === "") {
        throw new Exception("dateFrom and dateTo are required.");
    }

    if (strtotime($dateTo) < strtotime($dateFrom)) {
        throw new Exception("dateTo cannot be earlier than dateFrom.");
    }

    if ($categoryCode === "" || $unitCode === "") {
        throw new Exception("categoryCode and unitCode are required.");
    }

    $stmtBusinessUnit = $pdo->prepare("
        SELECT
            Corp_Code,
            Unit_Name,
            Unit_TIN,
            Unit_Address,
            VAT_Registration
        FROM tbl_main_business_units
        WHERE Category_Code = ?
          AND Unit_Code = ?
        LIMIT 1
    ");
    $stmtBusinessUnit->execute([$categoryCode, $unitCode]);
    $businessUnit = $stmtBusinessUnit->fetch();

    if (!$businessUnit) {
        throw new Exception("Business unit not found.");
    }

    $corpName = (string)$businessUnit["Corp_Code"];
    $businessUnitName = (string)$businessUnit["Unit_Name"];
    $businessUnitAddress = (string)$businessUnit["Unit_Address"];
    $businessUnitTIN = (string)$businessUnit["Unit_TIN"];
    $businessUnitVATRegistration = (string)$businessUnit["VAT_Registration"];

    // Earliest closed shift in range gives the "Beg." counters and the
    // starting point of the period; latest closed shift gives the "End"
    // counters, the period's Grand_Accum_Sales snapshot, and closing cash.
    $stmtFirstShift = $pdo->prepare("
        SELECT
            Shift_ID,
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
            Z_Counter_No,
            Grand_Accum_Sales
        FROM tbl_pos_shifting_records
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(Opening_DateTime) BETWEEN ? AND ?
          AND IFNULL(Z_Counter_No, 0) <> 0
        ORDER BY Shift_ID ASC
        LIMIT 1
    ");
    $stmtFirstShift->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $firstShift = $stmtFirstShift->fetch();

    if (!$firstShift) {
        throw new Exception("No Z-reading reprint record found for the selected date range. Only closed shifts with Z_Counter_No not equal to 0 can be reprinted.");
    }

    $stmtLastShift = $pdo->prepare("
        SELECT
            Shift_ID,
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
            Z_Counter_No,
            Grand_Accum_Sales
        FROM tbl_pos_shifting_records
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(Opening_DateTime) BETWEEN ? AND ?
          AND IFNULL(Z_Counter_No, 0) <> 0
        ORDER BY Shift_ID DESC
        LIMIT 1
    ");
    $stmtLastShift->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $lastShift = $stmtLastShift->fetch() ?: $firstShift;

    $stmtSalesForRange = $pdo->prepare("
        SELECT
            SUM(TotalSales) AS Sales_For_The_Range,
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
          AND DATE(transaction_date) BETWEEN ? AND ?
          AND Status = 'Active'
    ");
    $stmtSalesForRange->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $sales = $stmtSalesForRange->fetch() ?: [];

    $stmtVoid = $pdo->prepare("
        SELECT SUM(TotalAmountDue) AS Voided_Sales
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) BETWEEN ? AND ?
          AND Status = 'Voided'
    ");
    $stmtVoid->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $voidedSales = (float)($stmtVoid->fetchColumn() ?: 0);

    $stmtRefund = $pdo->prepare("
        SELECT SUM(TotalAmountDue) AS Refunded_Sales
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) BETWEEN ? AND ?
          AND Status = 'Refunded'
    ");
    $stmtRefund->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $refundedSales = (float)($stmtRefund->fetchColumn() ?: 0);

    $stmtDiscSC = $pdo->prepare("
        SELECT SUM(d.discount_amount) AS total_discount
        FROM tbl_pos_transactions_discounts d
        INNER JOIN tbl_pos_transactions t
            ON d.transaction_id = t.transaction_id
           AND d.Category_Code = t.Category_Code
           AND d.Unit_Code = t.Unit_Code
        WHERE t.Category_Code = ?
          AND t.Unit_Code = ?
          AND t.terminal_number = ?
          AND DATE(t.transaction_date) BETWEEN ? AND ?
          AND d.discount_type = 'Senior Citizen'
          AND d.Status = 'Active'
    ");
    $stmtDiscSC->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $discountSC = (float)($stmtDiscSC->fetchColumn() ?: 0);

    $stmtDiscPWD = $pdo->prepare("
        SELECT SUM(d.discount_amount) AS total_discount
        FROM tbl_pos_transactions_discounts d
        INNER JOIN tbl_pos_transactions t
            ON d.transaction_id = t.transaction_id
           AND d.Category_Code = t.Category_Code
           AND d.Unit_Code = t.Unit_Code
        WHERE t.Category_Code = ?
          AND t.Unit_Code = ?
          AND t.terminal_number = ?
          AND DATE(t.transaction_date) BETWEEN ? AND ?
          AND d.discount_type = 'PWD'
          AND d.Status = 'Active'
    ");
    $stmtDiscPWD->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $discountPWD = (float)($stmtDiscPWD->fetchColumn() ?: 0);

    $stmtDiscNAAC = $pdo->prepare("
        SELECT SUM(d.discount_amount) AS total_discount
        FROM tbl_pos_transactions_discounts d
        INNER JOIN tbl_pos_transactions t
            ON d.transaction_id = t.transaction_id
           AND d.Category_Code = t.Category_Code
           AND d.Unit_Code = t.Unit_Code
        WHERE t.Category_Code = ?
          AND t.Unit_Code = ?
          AND t.terminal_number = ?
          AND DATE(t.transaction_date) BETWEEN ? AND ?
          AND d.discount_type = 'NAAC'
          AND d.Status = 'Active'
    ");
    $stmtDiscNAAC->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $discountNAAC = (float)($stmtDiscNAAC->fetchColumn() ?: 0);

    $stmtDiscSolo = $pdo->prepare("
        SELECT SUM(d.discount_amount) AS total_discount
        FROM tbl_pos_transactions_discounts d
        INNER JOIN tbl_pos_transactions t
            ON d.transaction_id = t.transaction_id
           AND d.Category_Code = t.Category_Code
           AND d.Unit_Code = t.Unit_Code
        WHERE t.Category_Code = ?
          AND t.Unit_Code = ?
          AND t.terminal_number = ?
          AND DATE(t.transaction_date) BETWEEN ? AND ?
          AND d.discount_type = 'Solo Parent'
          AND d.Status = 'Active'
    ");
    $stmtDiscSolo->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $discountSolo = (float)($stmtDiscSolo->fetchColumn() ?: 0);

    $stmtDiscOther = $pdo->prepare("
        SELECT SUM(d.discount_amount) AS total_discount
        FROM tbl_pos_transactions_discounts d
        INNER JOIN tbl_pos_transactions t
            ON d.transaction_id = t.transaction_id
           AND d.Category_Code = t.Category_Code
           AND d.Unit_Code = t.Unit_Code
        WHERE t.Category_Code = ?
          AND t.Unit_Code = ?
          AND t.terminal_number = ?
          AND DATE(t.transaction_date) BETWEEN ? AND ?
          AND d.discount_type NOT IN ('Senior Citizen', 'PWD', 'NAAC', 'Solo Parent')
          AND d.Status = 'Active'
    ");
    $stmtDiscOther->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $discountOther = (float)($stmtDiscOther->fetchColumn() ?: 0);

    $stmtCash = $pdo->prepare("
        SELECT SUM(b.payment_amount - a.change_amount) AS Payment_Cash
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) BETWEEN ? AND ?
          AND b.payment_method = 'Cash'
          AND a.Status = 'Active'
    ");
    $stmtCash->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $paymentCash = (float)($stmtCash->fetchColumn() ?: 0);

    $stmtCheque = $pdo->prepare("
        SELECT SUM(b.payment_amount) AS Payment_Cheque
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) BETWEEN ? AND ?
          AND b.payment_method = 'Cheque'
          AND a.Status = 'Active'
    ");
    $stmtCheque->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $paymentCheque = (float)($stmtCheque->fetchColumn() ?: 0);

    $stmtCredit = $pdo->prepare("
        SELECT SUM(b.payment_amount) AS Payment_CreditCard
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) BETWEEN ? AND ?
          AND b.payment_method = 'Credit Card'
          AND a.Status = 'Active'
    ");
    $stmtCredit->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $paymentCreditCard = (float)($stmtCredit->fetchColumn() ?: 0);

    $stmtOtherPayments = $pdo->prepare("
        SELECT SUM(b.payment_amount) AS Payment_Others
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) BETWEEN ? AND ?
          AND b.payment_method NOT IN ('Cash', 'Cheque', 'Credit Card')
          AND a.Status = 'Active'
    ");
    $stmtOtherPayments->execute([$categoryCode, $unitCode, $terminalNumber, $dateFrom, $dateTo]);
    $paymentOthers = (float)($stmtOtherPayments->fetchColumn() ?: 0);

    // "Present Accum. Sales" reflects the accumulated total as of the end of
    // the period (the last shift's running total), same convention as the
    // single-day reprint, just anchored to the last shift in the range
    // instead of the only shift for that one day.
    $presentAccumulatedSales = (float)($lastShift["Grand_Accum_Sales"] ?: 0);
    $salesForTheRange = (float)($sales["Sales_For_The_Range"] ?: 0);
    $previousAccumulatedSales = $presentAccumulatedSales - $salesForTheRange;

    $grossAmount = (float)($sales["Gross_Amount"] ?: 0);
    $lessDiscount = (float)($sales["Discount"] ?: 0);
    $lessVatExemption = (float)($sales["VATExemptSales_VAT"] ?: 0);
    $lessReturn = $refundedSales;
    $lessVoid = $voidedSales;
    $lessVatAdjustment = 0.00;

    $netAmount = $grossAmount
        - $lessDiscount
        - $lessVatExemption
        - $lessReturn
        - $lessVoid
        - $lessVatAdjustment;

    // Opening Fund / Cash in Drawer are point-in-time cash-count snapshots,
    // not something that sums meaningfully across shifts -- report the
    // period's first opening count and last closing count, mirroring how
    // Beg./End counters use the first/last shift.
    $cashInDrawer = (float)($lastShift["Closing_Cash_Count"] ?: 0);
    $openingFund = (float)($firstShift["Opening_Cash_Count"] ?: 0);
    $withdrawal = 0.00;
    $paymentsReceived = $paymentCash + $paymentCheque + $paymentCreditCard + $paymentOthers;
    $shortOver = $cashInDrawer + $paymentCheque + $paymentCreditCard + $paymentOthers - $openingFund - $paymentsReceived;

    $tinLabel = $businessUnitVATRegistration === "Non-VAT Registered"
        ? "NON-VAT REG TIN: " . $businessUnitTIN
        : "VAT REG TIN: " . $businessUnitTIN;

    $firstZCounter = (int)($firstShift["Z_Counter_No"] ?: 0);
    $lastZCounter = (int)($lastShift["Z_Counter_No"] ?: 0);
    $zCounterRange = $firstZCounter === $lastZCounter
        ? (string)$firstZCounter
        : $firstZCounter . " - " . $lastZCounter;

    echo json_encode([
        "success" => true,
        "message" => "Z-reading monthly reprint data loaded successfully.",
        "data" => [
            "dateFrom" => $dateFrom,
            "dateTo" => $dateTo,

            "reportDate" => date("M d, Y", strtotime($dateFrom)) . " - " . date("M d, Y", strtotime($dateTo)),
            "reportTime" => date("h:i A"),
            "startDateTime" => date("m/d/y g:i A", strtotime($firstShift["Opening_DateTime"])),
            "endDateTime" => date("m/d/y g:i A", strtotime($lastShift["Closing_DateTime"] ?: $lastShift["Opening_DateTime"])),
            "reprintDateTime" => date("m/d/y h:i A"),

            "begSI" => (float)($firstShift["Beg_OR"] ?: 0),
            "endSI" => (float)($lastShift["End_OR"] ?: 0),
            "begInv" => (float)($firstShift["Beg_OR"] ?: 0),
            "endInv" => (float)($lastShift["End_OR"] ?: 0),

            "begVoid" => (float)($firstShift["Beg_VoidNo"] ?: 0),
            "endVoid" => (float)($lastShift["End_VoidNo"] ?: 0),

            "begReturn" => (float)($firstShift["Beg_RefundNo"] ?: 0),
            "endReturn" => (float)($lastShift["End_RefundNo"] ?: 0),
            "begRefund" => (float)($firstShift["Beg_RefundNo"] ?: 0),
            "endRefund" => (float)($lastShift["End_RefundNo"] ?: 0),

            "resetCounterNo" => 0,
            "resetCounter" => 0,
            "zCounterNo" => $zCounterRange,
            "zCounter" => $zCounterRange,

            "presentAccumulatedSales" => $presentAccumulatedSales,
            "previousAccumulatedSales" => $previousAccumulatedSales,
            "salesForTheDay" => $salesForTheRange,

            "presentSales" => $presentAccumulatedSales,
            "previousSales" => $previousAccumulatedSales,
            "dailySales" => $salesForTheRange,

            "vatableSales" => (float)($sales["VATableSales"] ?: 0),
            "vatAmount" => (float)($sales["VATableSales_VAT"] ?: 0),
            "vatExemptSales" => (float)($sales["VATExemptSales"] ?: 0),
            "vatExemptVat" => (float)($sales["VATExemptSales_VAT"] ?: 0),
            "vatExemption" => (float)($sales["VATExemptSales_VAT"] ?: 0),
            "zeroRatedSales" => (float)($sales["VATZeroRatedSales"] ?: 0),
            "zeroRated" => (float)($sales["VATZeroRatedSales"] ?: 0),
            "otherCharges" => (float)($sales["OtherCharges"] ?: 0),

            "grossAmount" => $grossAmount,
            "lessDiscount" => $lessDiscount,
            "lessVatExemption" => $lessVatExemption,
            "lessReturn" => $lessReturn,
            "lessVoid" => $lessVoid,
            "lessVatAdjustment" => $lessVatAdjustment,
            "netAmount" => $netAmount,

            "gross" => $grossAmount,
            "discount" => $lessDiscount,
            "refund" => $lessReturn,
            "void" => $lessVoid,
            "vatAdjustment" => $lessVatAdjustment,
            "net" => $netAmount,

            "scDisc" => $discountSC,
            "pwdDisc" => $discountPWD,
            "naacDisc" => $discountNAAC,
            "soloParentDisc" => $discountSolo,
            "soloDisc" => $discountSolo,
            "otherDisc" => $discountOther,

            "salesAdjustmentVoid" => $lessVoid,
            "salesAdjustmentReturn" => $lessReturn,

            "scTransVatAdj" => 0.00,
            "pwdTransVatAdj" => 0.00,
            "regDiscTransVatAdj" => 0.00,
            "zeroRatedTransVatAdj" => 0.00,
            "vatOnReturn" => 0.00,
            "otherVatAdjustments" => 0.00,

            "scTrans" => 0.00,
            "pwdTrans" => 0.00,
            "regDisc" => 0.00,
            "zeroRatedTrans" => 0.00,
            "otherVatAdj" => 0.00,

            "cashInDrawer" => $cashInDrawer,
            "cash" => $cashInDrawer,
            "cheque" => $paymentCheque,
            "creditCard" => $paymentCreditCard,
            "otherPayments" => $paymentOthers,
            "openingFund" => $openingFund,
            "lessWithdrawal" => $withdrawal,
            "withdrawal" => $withdrawal,
            "paymentsReceived" => $paymentsReceived,
            "shortOver" => $shortOver,

            "corpName" => $corpName,
            "businessUnitName" => $businessUnitName,
            "businessUnitAddress" => $businessUnitAddress,
            "businessUnitTIN" => $businessUnitTIN,
            "businessUnitVATRegistration" => $businessUnitVATRegistration,
            "tinLabel" => $tinLabel,

            "machineNumber" => $machineNumber,
            "serialNumber" => $serialNumber,
            "terminalNumber" => $terminalNumber,
            "ptuNumber" => $ptuNumber,
            "ptuDateIssued" => $ptuDateIssued,
        ]
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ]);
}
