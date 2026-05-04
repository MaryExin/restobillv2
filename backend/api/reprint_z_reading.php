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

    $selectedDate = isset($input["selectedDate"])
        ? trim((string)$input["selectedDate"])
        : (isset($input["selected_date"]) ? trim((string)$input["selected_date"]) : "");

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

    if ($selectedDate === "") {
        throw new Exception("selectedDate is required.");
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

    $stmtShift = $pdo->prepare("
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
          AND DATE(Opening_DateTime) = ?
          AND IFNULL(Z_Counter_No, 0) <> 0
        ORDER BY Shift_ID DESC
        LIMIT 1
    ");
    $stmtShift->execute([$categoryCode, $unitCode, $terminalNumber, $selectedDate]);
    $shift = $stmtShift->fetch();

    if (!$shift) {
        throw new Exception("No Z-reading reprint record found for the selected date. Only closed shifts with Z_Counter_No not equal to 0 can be reprinted.");
    }

    $reportDate = date("Y-m-d", strtotime($shift["Opening_DateTime"]));

    $stmtSalesForDay = $pdo->prepare("
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
    ");
    $stmtSalesForDay->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
    $sales = $stmtSalesForDay->fetch() ?: [];

    $stmtVoid = $pdo->prepare("
        SELECT SUM(TotalAmountDue) AS Voided_Sales
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND Status = 'Voided'
    ");
    $stmtVoid->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
    $voidedSales = (float)($stmtVoid->fetchColumn() ?: 0);

    $stmtRefund = $pdo->prepare("
        SELECT SUM(TotalAmountDue) AS Refunded_Sales
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND Status = 'Refunded'
    ");
    $stmtRefund->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(t.transaction_date) = ?
          AND d.discount_type = 'Senior Citizen'
          AND d.Status = 'Active'
    ");
    $stmtDiscSC->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(t.transaction_date) = ?
          AND d.discount_type = 'PWD'
          AND d.Status = 'Active'
    ");
    $stmtDiscPWD->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(t.transaction_date) = ?
          AND d.discount_type = 'NAAC'
          AND d.Status = 'Active'
    ");
    $stmtDiscNAAC->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(t.transaction_date) = ?
          AND d.discount_type = 'Solo Parent'
          AND d.Status = 'Active'
    ");
    $stmtDiscSolo->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(t.transaction_date) = ?
          AND d.discount_type NOT IN ('Senior Citizen', 'PWD', 'NAAC', 'Solo Parent')
          AND d.Status = 'Active'
    ");
    $stmtDiscOther->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(a.transaction_date) = ?
          AND b.payment_method = 'Cash'
          AND a.Status = 'Active'
    ");
    $stmtCash->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(a.transaction_date) = ?
          AND b.payment_method = 'Cheque'
          AND a.Status = 'Active'
    ");
    $stmtCheque->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(a.transaction_date) = ?
          AND b.payment_method = 'Credit Card'
          AND a.Status = 'Active'
    ");
    $stmtCredit->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
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
          AND DATE(a.transaction_date) = ?
          AND b.payment_method NOT IN ('Cash', 'Cheque', 'Credit Card')
          AND a.Status = 'Active'
    ");
    $stmtOtherPayments->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
    $paymentOthers = (float)($stmtOtherPayments->fetchColumn() ?: 0);

    $presentAccumulatedSales = (float)($shift["Grand_Accum_Sales"] ?: 0);
    $salesForTheDay = (float)($sales["Sales_For_The_Day"] ?: 0);
    $previousAccumulatedSales = $presentAccumulatedSales - $salesForTheDay;

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

    $cashInDrawer = (float)($shift["Closing_Cash_Count"] ?: 0);
    $openingFund = (float)($shift["Opening_Cash_Count"] ?: 0);
    $withdrawal = 0.00;
    $paymentsReceived = $paymentCash + $paymentCheque + $paymentCreditCard + $paymentOthers;
    $shortOver = $cashInDrawer + $paymentCheque + $paymentCreditCard + $paymentOthers - $openingFund - $paymentsReceived;

    $tinLabel = $businessUnitVATRegistration === "Non-VAT Registered"
        ? "NON-VAT REG TIN: " . $businessUnitTIN
        : "VAT REG TIN: " . $businessUnitTIN;

    echo json_encode([
        "success" => true,
        "message" => "Z-reading reprint data loaded successfully.",
        "data" => [
            "shiftId" => (string)$shift["Shift_ID"],
            "reportDate" => date("F d, Y", strtotime($shift["Opening_DateTime"])),
            "reportTime" => date("h:i A", strtotime($shift["Closing_DateTime"])),
            "startDateTime" => date("m/d/y g:i A", strtotime($shift["Opening_DateTime"])),
            "endDateTime" => date("m/d/y g:i A", strtotime($shift["Closing_DateTime"])),
            "reprintDateTime" => date("m/d/y h:i A"),

            "begSI" => (float)($shift["Beg_OR"] ?: 0),
            "endSI" => (float)($shift["End_OR"] ?: 0),
            "begInv" => (float)($shift["Beg_OR"] ?: 0),
            "endInv" => (float)($shift["End_OR"] ?: 0),

            "begVoid" => (float)($shift["Beg_VoidNo"] ?: 0),
            "endVoid" => (float)($shift["End_VoidNo"] ?: 0),

            "begReturn" => (float)($shift["Beg_RefundNo"] ?: 0),
            "endReturn" => (float)($shift["End_RefundNo"] ?: 0),
            "begRefund" => (float)($shift["Beg_RefundNo"] ?: 0),
            "endRefund" => (float)($shift["End_RefundNo"] ?: 0),

            "resetCounterNo" => 0,
            "resetCounter" => 0,
            "zCounterNo" => (float)($shift["Z_Counter_No"] ?: 0),
            "zCounter" => (float)($shift["Z_Counter_No"] ?: 0),

            "presentAccumulatedSales" => $presentAccumulatedSales,
            "previousAccumulatedSales" => $previousAccumulatedSales,
            "salesForTheDay" => $salesForTheDay,

            "presentSales" => $presentAccumulatedSales,
            "previousSales" => $previousAccumulatedSales,
            "dailySales" => $salesForTheDay,

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
