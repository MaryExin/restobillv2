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
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );

    $raw = file_get_contents("php://input");
    $input = json_decode($raw, true);

    if (!$input || !is_array($input)) {
        $input = $_POST;
    }

    $selectedCashier = isset($input["selectedCashier"])
        ? trim((string)$input["selectedCashier"])
        : (isset($input["selected_cashier"]) ? trim((string)$input["selected_cashier"]) : "All Cashiers");

    $cashDrawerAmount = isset($input["cashDrawerAmount"])
        ? (float)$input["cashDrawerAmount"]
        : (isset($input["cash_drawer_amount"]) ? (float)$input["cash_drawer_amount"] : 0);

    $verifyAmount = isset($input["verifyAmount"])
        ? (float)$input["verifyAmount"]
        : (isset($input["verify_amount"]) ? (float)$input["verify_amount"] : 0);

    $userId = isset($input["user_id"])
        ? trim((string)$input["user_id"])
        : "";

    $userName = isset($input["user_name"])
        ? trim((string)$input["user_name"])
        : "";

    $cashierName = isset($input["cashier_name"])
        ? trim((string)$input["cashier_name"])
        : $userName;

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

    $reportDate = isset($input["reportDate"])
        ? trim((string)$input["reportDate"])
        : (isset($input["report_date"]) ? trim((string)$input["report_date"]) : date("Y-m-d"));

    $corpNameInput = isset($input["corpName"])
        ? trim((string)$input["corpName"])
        : (isset($input["corp_name"]) ? trim((string)$input["corp_name"]) : "");

    $machineNumber = isset($input["machineNumber"])
        ? trim((string)$input["machineNumber"])
        : (isset($input["machine_number"]) ? trim((string)$input["machine_number"]) : "");

    $serialNumber = isset($input["serialNumber"])
        ? trim((string)$input["serialNumber"])
        : (isset($input["serial_number"]) ? trim((string)$input["serial_number"]) : "");

    if ($categoryCode === "" || $unitCode === "") {
        $stmtFallbackUnit = $pdo->query("
            SELECT Category_Code, Unit_Code, Corp_Code, Unit_Name, Unit_TIN, Unit_Address, VAT_Registration
            FROM tbl_main_business_units
            ORDER BY ID ASC
            LIMIT 1
        ");
        $fallbackUnit = $stmtFallbackUnit->fetch();

        if ($fallbackUnit) {
            if ($categoryCode === "") {
                $categoryCode = (string)$fallbackUnit["Category_Code"];
            }
            if ($unitCode === "") {
                $unitCode = (string)$fallbackUnit["Unit_Code"];
            }
        }
    }

    $cashierLike = $selectedCashier === "All Cashiers" ? "%" : $selectedCashier . "%";

    $sqlBusinessUnit = "
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
    ";

    $stmtBusinessUnit = $pdo->prepare($sqlBusinessUnit);
    $stmtBusinessUnit->execute([
        $categoryCode,
        $unitCode
    ]);
    $businessUnit = $stmtBusinessUnit->fetch();

    if (!$businessUnit) {
        throw new Exception("Business unit not found in tbl_main_business_units.");
    }

    $corpName = $corpNameInput !== "" ? $corpNameInput : (string)$businessUnit["Corp_Code"];
    $businessUnitName = (string)$businessUnit["Unit_Name"];
    $businessUnitAddress = (string)$businessUnit["Unit_Address"];
    $businessUnitTIN = (string)$businessUnit["Unit_TIN"];
    $businessUnitVATRegistration = (string)$businessUnit["VAT_Registration"];

    $sqlShift = "
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
            Z_Counter_No,
            Shift_Status
        FROM tbl_pos_shifting_records
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND Shift_Status = 'Open'
        ORDER BY Opening_DateTime DESC
        LIMIT 1
    ";

    $stmtShift = $pdo->prepare($sqlShift);
    $stmtShift->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber
    ]);
    $shift = $stmtShift->fetch();

    if (!$shift) {
        throw new Exception("No open shifting record found for this terminal.");
    }

    $reportDate = date("Y-m-d", strtotime($shift["Opening_DateTime"]));

    $paymentBreakdown = [];

    $sqlPayments = "
        SELECT
            UPPER(REPLACE(REPLACE(TRIM(b.payment_method), ' ', ''), '-', '')) AS payment_method_key,
            MIN(TRIM(b.payment_method)) AS payment_method_label,
            COALESCE(SUM(b.payment_amount), 0) AS payment_amount
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) = ?
          AND UPPER(REPLACE(REPLACE(TRIM(b.payment_method), ' ', ''), '-', '')) NOT IN ('CASH', 'CHEQUE', 'CREDITCARD')
          AND a.cashier LIKE ?
          AND a.Status = 'Active'
        GROUP BY UPPER(REPLACE(REPLACE(TRIM(b.payment_method), ' ', ''), '-', ''))
        ORDER BY UPPER(REPLACE(REPLACE(TRIM(b.payment_method), ' ', ''), '-', '')) ASC
    ";

    $stmtPayments = $pdo->prepare($sqlPayments);
    $stmtPayments->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $rowsPayments = $stmtPayments->fetchAll();

    $paymentBreakdownTotal = 0;

    foreach ($rowsPayments as $row) {
        $paymentKey = strtoupper(trim((string)($row["payment_method_key"] ?? "")));
        $amount = (float)$row["payment_amount"];
        $paymentBreakdownTotal += $amount;

        switch ($paymentKey) {
            case "GCASH":
                $displayMethod = "GCash";
                break;
            case "MAYA":
                $displayMethod = "Maya";
                break;
            case "GRABPAY":
                $displayMethod = "GrabPay";
                break;
            case "BANKTRANSFER":
                $displayMethod = "Bank Transfer";
                break;
            default:
                $rawLabel = trim((string)($row["payment_method_label"] ?? $paymentKey));
                $displayMethod = ucwords(strtolower(preg_replace('/\s+/', ' ', $rawLabel)));
                break;
        }

        $paymentBreakdown[] = [
            "payment_method" => $displayMethod,
            "payment_amount" => $amount
        ];
    }

    $sqlBegOR = "
        SELECT invoice_no
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND cashier LIKE ?
          AND DATE(transaction_date) = ?
          AND invoice_no <> 0
        ORDER BY invoice_no ASC
        LIMIT 1
    ";

    $stmtBegOR = $pdo->prepare($sqlBegOR);
    $stmtBegOR->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $cashierLike,
        $reportDate
    ]);
    $begORRow = $stmtBegOR->fetch();
    $parBegOR = $begORRow ? $begORRow["invoice_no"] : "";

    $sqlEndOR = "
        SELECT invoice_no
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND cashier LIKE ?
          AND invoice_no <> 0
        ORDER BY invoice_no DESC
        LIMIT 1
    ";

    $stmtEndOR = $pdo->prepare($sqlEndOR);
    $stmtEndOR->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $cashierLike
    ]);
    $endORRow = $stmtEndOR->fetch();
    $parEndOR = $endORRow ? $endORRow["invoice_no"] : "";

    $sqlActive = "
        SELECT
            COALESCE(SUM(TotalSales), 0) AS Sales_For_The_Day,
            COALESCE(SUM(VATableSales), 0) AS VATableSales,
            COALESCE(SUM(VATableSales_VAT), 0) AS VATableSales_VAT,
            COALESCE(SUM(VATExemptSales), 0) AS VATExemptSales,
            COALESCE(SUM(VATExemptSales_VAT), 0) AS VATExemptSales_VAT,
            COALESCE(SUM(VATZeroRatedSales), 0) AS VATZeroRatedSales,
            COALESCE(SUM(TotalSales), 0) AS Gross_Amount,
            COALESCE(SUM(Discount), 0) AS Discount
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND cashier LIKE ?
          AND Status = 'Active'
    ";

    $stmtActive = $pdo->prepare($sqlActive);
    $stmtActive->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $active = $stmtActive->fetch();

    $sqlVoided = "
        SELECT COALESCE(SUM(TotalSales), 0) AS Voided_Sales
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND cashier LIKE ?
          AND Status = 'Voided'
    ";

    $stmtVoided = $pdo->prepare($sqlVoided);
    $stmtVoided->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $voided = $stmtVoided->fetch();

    $sqlRefunded = "
        SELECT COALESCE(SUM(TotalAmountDue), 0) AS Refunded_Sales
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND cashier LIKE ?
          AND Status = 'Refunded'
    ";

    $stmtRefunded = $pdo->prepare($sqlRefunded);
    $stmtRefunded->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $refunded = $stmtRefunded->fetch();

    $sqlSenior = "
        SELECT COALESCE(SUM(Discount), 0) AS Discount_SRC
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND discount_type = 'Senior Citizen'
          AND cashier LIKE ?
          AND Status = 'Active'
    ";

    $stmtSenior = $pdo->prepare($sqlSenior);
    $stmtSenior->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $senior = $stmtSenior->fetch();

    $sqlPwd = "
        SELECT COALESCE(SUM(Discount), 0) AS Discount_PWD
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND discount_type = 'PWD'
          AND cashier LIKE ?
          AND Status = 'Active'
    ";

    $stmtPwd = $pdo->prepare($sqlPwd);
    $stmtPwd->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $pwd = $stmtPwd->fetch();

    $sqlNaac = "
        SELECT COALESCE(SUM(Discount), 0) AS Discount_NAAC
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND discount_type = 'NAAC'
          AND cashier LIKE ?
          AND Status = 'Active'
    ";

    $stmtNaac = $pdo->prepare($sqlNaac);
    $stmtNaac->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $naac = $stmtNaac->fetch();

    $sqlSolo = "
        SELECT COALESCE(SUM(Discount), 0) AS Discount_SoloParent
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND discount_type = 'Solo Parent'
          AND cashier LIKE ?
          AND Status = 'Active'
    ";

    $stmtSolo = $pdo->prepare($sqlSolo);
    $stmtSolo->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $solo = $stmtSolo->fetch();

    $sqlOtherDiscounts = "
        SELECT COALESCE(SUM(Discount), 0) AS Discount_Others
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND discount_type <> 'Senior Citizen'
          AND discount_type <> 'PWD'
          AND discount_type <> 'NAAC'
          AND discount_type <> 'Solo Parent'
          AND cashier LIKE ?
          AND Status = 'Active'
    ";

    $stmtOtherDiscounts = $pdo->prepare($sqlOtherDiscounts);
    $stmtOtherDiscounts->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $otherDiscounts = $stmtOtherDiscounts->fetch();

    $sqlCash = "
        SELECT COALESCE(SUM(b.payment_amount - a.change_amount), 0) AS Payment_Cash
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) = ?
          AND UPPER(REPLACE(REPLACE(TRIM(b.payment_method), ' ', ''), '-', '')) = 'CASH'
          AND a.cashier LIKE ?
          AND a.Status = 'Active'
    ";

    $stmtCash = $pdo->prepare($sqlCash);
    $stmtCash->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $cash = $stmtCash->fetch();

    $sqlCheque = "
        SELECT COALESCE(SUM(b.payment_amount), 0) AS Payment_Cheque
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) = ?
          AND UPPER(REPLACE(REPLACE(TRIM(b.payment_method), ' ', ''), '-', '')) = 'CHEQUE'
          AND a.cashier LIKE ?
          AND a.Status = 'Active'
    ";

    $stmtCheque = $pdo->prepare($sqlCheque);
    $stmtCheque->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $cheque = $stmtCheque->fetch();

    $sqlCreditCard = "
        SELECT COALESCE(SUM(b.payment_amount), 0) AS Payment_CreditCard
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) = ?
          AND UPPER(REPLACE(REPLACE(TRIM(b.payment_method), ' ', ''), '-', '')) = 'CREDITCARD'
          AND a.cashier LIKE ?
          AND a.Status = 'Active'
    ";

    $stmtCreditCard = $pdo->prepare($sqlCreditCard);
    $stmtCreditCard->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $creditCard = $stmtCreditCard->fetch();

    $sqlOtherPayments = "
        SELECT COALESCE(SUM(b.payment_amount), 0) AS Payment_Others
        FROM tbl_pos_transactions a
        INNER JOIN tbl_pos_transactions_payments b
            ON a.transaction_id = b.transaction_id
           AND a.Category_Code = b.Category_Code
           AND a.Unit_Code = b.Unit_Code
        WHERE a.Category_Code = ?
          AND a.Unit_Code = ?
          AND a.terminal_number = ?
          AND DATE(a.transaction_date) = ?
          AND UPPER(REPLACE(REPLACE(TRIM(b.payment_method), ' ', ''), '-', '')) NOT IN ('CASH', 'CHEQUE', 'CREDITCARD')
          AND a.cashier LIKE ?
          AND a.Status = 'Active'
    ";

    $stmtOtherPayments = $pdo->prepare($sqlOtherPayments);
    $stmtOtherPayments->execute([
        $categoryCode,
        $unitCode,
        $terminalNumber,
        $reportDate,
        $cashierLike
    ]);
    $otherPayments = $stmtOtherPayments->fetch();

    $sqlExpenses = "
        SELECT COALESCE(SUM(expenses_amount), 0) AS expenses_amount
        FROM tbl_expenses
        WHERE DATE(datacreated) = ?
    ";

    $stmtExpenses = $pdo->prepare($sqlExpenses);
    $stmtExpenses->execute([$reportDate]);
    $expenses = $stmtExpenses->fetch();

    $parReportDate = date("m/d/y", strtotime($shift["Opening_DateTime"]));
    $parReportTime = date("h:i A");
    $parStartDateTime = date("m/d/y h:i A", strtotime($shift["Opening_DateTime"]));
    $parEndDateTime = date("m/d/y h:i A");

    $parOpeningFund = (float)$shift["Opening_Cash_Count"];
    $parCash = (float)$cash["Payment_Cash"];
    $parCheque = (float)$cheque["Payment_Cheque"];
    $parCreditCard = (float)$creditCard["Payment_CreditCard"];
    $parOtherPayments = (float)$otherPayments["Payment_Others"];

    if (round($parOtherPayments, 2) !== round($paymentBreakdownTotal, 2)) {
        $parOtherPayments = $paymentBreakdownTotal;
    }

    $parTotalPayments = $parCash + $parCheque + $parCreditCard + $parOtherPayments;
    $parVoid = (float)$voided["Voided_Sales"];
    $parRefund = (float)$refunded["Refunded_Sales"];
    $parWithdrawal = 0;

    $parSummaryCashInDrawer = $cashDrawerAmount;
    $parSummaryCheque = $parCheque;
    $parSummaryCreditCard = $parCreditCard;
    $parSummaryOtherPayments = $parOtherPayments;
    $parSummaryOpeningFund = $parOpeningFund;
    $parSummaryWithdrawal = 0;
    $parSummaryPaymentsReceived = $parCash + $parCheque + $parCreditCard + $parOtherPayments;
    $parSummaryShortOver =
        $parSummaryCashInDrawer +
        $parSummaryCheque +
        $parSummaryCreditCard +
        $parSummaryOtherPayments -
        $parSummaryOpeningFund -
        $parSummaryPaymentsReceived;

    $tinLabel = $businessUnitVATRegistration === "Non-VAT Registered"
        ? "NON-VAT REG TIN: " . $businessUnitTIN
        : "VAT REG TIN: " . $businessUnitTIN;

    $logNow = date("Y-m-d H:i:s");
    $logDate = date("Y-m-d");
    $logTime = date("H:i:s");
    $resolvedUserName = $userName !== "" ? $userName : ($cashierName !== "" ? $cashierName : $selectedCashier);

    try {
        $valuesOfData = json_encode([
            "selected_cashier" => $selectedCashier,
            "terminal_number" => $terminalNumber,
            "report_date" => $reportDate,
            "opening_fund" => $parOpeningFund,
            "cash_drawer_amount" => $cashDrawerAmount,
            "verify_amount" => $verifyAmount,
            "cash" => $parCash,
            "cheque" => $parCheque,
            "credit_card" => $parCreditCard,
            "other_payments" => $parOtherPayments,
            "other_payments_breakdown" => $paymentBreakdown,
            "total_payments" => $parTotalPayments,
            "void" => $parVoid,
            "refund" => $parRefund,
            "sales_for_the_day" => (float)$active["Sales_For_The_Day"],
            "gross_amount" => (float)$active["Gross_Amount"],
            "discount" => (float)$active["Discount"],
            "summary_short_over" => $parSummaryShortOver,
            "beg_or" => $parBegOR,
            "end_or" => $parEndOR,
            "machine_number" => $machineNumber,
            "serial_number" => $serialNumber
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $stmtActivityLog = $pdo->prepare("
            INSERT INTO tbl_main_activity_logs
            (
                Category_Code,
                Unit_Code,
                activity_date_time,
                user_id,
                user_name,
                type_of_activity,
                activity_performed,
                values_of_data
            )
            VALUES
            (
                :Category_Code,
                :Unit_Code,
                :activity_date_time,
                :user_id,
                :user_name,
                :type_of_activity,
                :activity_performed,
                :values_of_data
            )
        ");

        $stmtActivityLog->execute([
            ":Category_Code" => $categoryCode,
            ":Unit_Code" => $unitCode,
            ":activity_date_time" => $logNow,
            ":user_id" => $userId,
            ":user_name" => $resolvedUserName,
            ":type_of_activity" => "POS X-READING",
            ":activity_performed" => "GENERATE X-READING",
            ":values_of_data" => $valuesOfData
        ]);
    } catch (Throwable $activityLogError) {
        // ignore logging failure
    }

    try {
        $referenceNo = $parBegOR !== "" || $parEndOR !== ""
            ? trim((string)$parBegOR) . "-" . trim((string)$parEndOR)
            : $terminalNumber . "-" . $reportDate;

        $description = "POS X-READING | TERMINAL: {$terminalNumber} | CASHIER: {$selectedCashier} | REPORT DATE: {$reportDate} | TOTAL PAYMENTS: {$parTotalPayments}";

        $stmtTransactionLog = $pdo->prepare("
            INSERT INTO tbl_main_transaction_logs
            (
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
            )
            VALUES
            (
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
            )
        ");

        $stmtTransactionLog->execute([
            ":Category_Code" => $categoryCode,
            ":Unit_Code" => $unitCode,
            ":Register" => $terminalNumber !== "" ? $terminalNumber : "POS",
            ":Trans_Date" => $reportDate,
            ":Reference_No" => $referenceNo,
            ":Trans_Type" => "X-READING",
            ":User_ID" => is_numeric($userId) ? $userId : "0",
            ":Amount" => $parTotalPayments,
            ":Description" => $description,
            ":Log_Date" => $logDate,
            ":Log_Time" => $logTime
        ]);
    } catch (Throwable $transactionLogError) {
        // ignore logging failure
    }

    echo json_encode([
        "success" => true,
        "message" => "X-Reading data loaded successfully.",
        "data" => [
            "reportDate" => $parReportDate,
            "reportTime" => $parReportTime,
            "startDateTime" => $parStartDateTime,
            "endDateTime" => $parEndDateTime,
            "cashier" => $selectedCashier,
            "begOR" => $parBegOR,
            "endOR" => $parEndOR,

            "openingFund" => $parOpeningFund,
            "cash" => $parCash,
            "cheque" => $parCheque,
            "creditCard" => $parCreditCard,
            "otherPayments" => $parOtherPayments,
            "otherPaymentsTotal" => $parOtherPayments,
            "totalPayments" => $parTotalPayments,
            "void" => $parVoid,
            "refund" => $parRefund,
            "withdrawal" => $parWithdrawal,

            "summaryCashInDrawer" => $parSummaryCashInDrawer,
            "summaryCheque" => $parSummaryCheque,
            "summaryCreditCard" => $parSummaryCreditCard,
            "summaryOtherPayments" => $parSummaryOtherPayments,
            "summaryOpeningFund" => $parSummaryOpeningFund,
            "summaryWithdrawal" => $parSummaryWithdrawal,
            "summaryPaymentsReceived" => $parSummaryPaymentsReceived,
            "summaryShortOver" => $parSummaryShortOver,

            "salesForTheDay" => (float)$active["Sales_For_The_Day"],
            "vatableSales" => (float)$active["VATableSales"],
            "vatableSalesVAT" => (float)$active["VATableSales_VAT"],
            "vatExemptSales" => (float)$active["VATExemptSales"],
            "vatExemptSalesVAT" => (float)$active["VATExemptSales_VAT"],
            "vatZeroRatedSales" => (float)$active["VATZeroRatedSales"],
            "grossAmount" => (float)$active["Gross_Amount"],
            "discount" => (float)$active["Discount"],
            "seniorDiscount" => (float)$senior["Discount_SRC"],
            "pwdDiscount" => (float)$pwd["Discount_PWD"],
            "naacDiscount" => (float)$naac["Discount_NAAC"],
            "soloParentDiscount" => (float)$solo["Discount_SoloParent"],
            "otherDiscounts" => (float)$otherDiscounts["Discount_Others"],
            "expenses" => (float)$expenses["expenses_amount"],

            "corpName" => $corpName,
            "businessUnitName" => $businessUnitName,
            "businessUnitAddress" => $businessUnitAddress,
            "businessUnitTIN" => $businessUnitTIN,
            "businessUnitVATRegistration" => $businessUnitVATRegistration,
            "tinLabel" => $tinLabel,
            "machineNumber" => $machineNumber,
            "serialNumber" => $serialNumber,

            "paymentBreakdown" => $paymentBreakdown,
            "otherPaymentsBreakdown" => $paymentBreakdown
        ]
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}