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

    $selectedCashier = isset($input["selectedCashier"])
        ? trim((string)$input["selectedCashier"])
        : (isset($input["selected_cashier"]) ? trim((string)$input["selected_cashier"]) : "All Cashiers");

    $cashDrawerAmount = isset($input["cashDrawerAmount"])
        ? (float)$input["cashDrawerAmount"]
        : (isset($input["cash_drawer_amount"]) ? (float)$input["cash_drawer_amount"] : 0);

    $verifyAmount = isset($input["verifyAmount"])
        ? (float)$input["verifyAmount"]
        : (isset($input["verify_amount"]) ? (float)$input["verify_amount"] : 0);

    $closingUserId = null;
    if (isset($input["closingUserId"])) {
        $closingUserId = trim((string)$input["closingUserId"]);
    } elseif (isset($input["closing_user_id"])) {
        $closingUserId = trim((string)$input["closing_user_id"]);
    } elseif (isset($input["userId"])) {
        $closingUserId = trim((string)$input["userId"]);
    } elseif (isset($input["user_id"])) {
        $closingUserId = trim((string)$input["user_id"]);
    }

    $userId = isset($input["user_id"]) ? trim((string)$input["user_id"]) : (string)$closingUserId;
    $userName = isset($input["user_name"]) ? trim((string)$input["user_name"]) : "";
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

    if ($terminalNumber === "") {
        $terminalNumber = "1";
    }

    $corpNameInput = isset($input["corpName"])
        ? trim((string)$input["corpName"])
        : (isset($input["corp_name"]) ? trim((string)$input["corp_name"]) : "");

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

    if ($categoryCode === "" || $unitCode === "") {
        if ($unitCode !== "") {
            $stmtFallbackUnit = $pdo->prepare("
                SELECT Category_Code, Unit_Code, Corp_Code, Unit_Name, Unit_TIN, Unit_Address, VAT_Registration
                FROM tbl_main_business_units
                WHERE Unit_Code = ?
                LIMIT 1
            ");
            $stmtFallbackUnit->execute([$unitCode]);
        } else {
            $stmtFallbackUnit = $pdo->query("
                SELECT Category_Code, Unit_Code, Corp_Code, Unit_Name, Unit_TIN, Unit_Address, VAT_Registration
                FROM tbl_main_business_units
                ORDER BY ID ASC
                LIMIT 1
            ");
        }

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

    if ($categoryCode === "" || $unitCode === "" || $terminalNumber === "") {
        throw new Exception("categoryCode, unitCode, and terminalNumber are required.");
    }

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
    $stmtBusinessUnit->execute([$categoryCode, $unitCode]);
    $businessUnit = $stmtBusinessUnit->fetch();

    if (!$businessUnit) {
        throw new Exception("Business unit not found in tbl_main_business_units.");
    }

    $corpName = $corpNameInput !== "" ? $corpNameInput : (string)$businessUnit["Corp_Code"];
    $businessUnitName = (string)$businessUnit["Unit_Name"];
    $businessUnitAddress = (string)$businessUnit["Unit_Address"];
    $businessUnitTIN = (string)$businessUnit["Unit_TIN"];
    $businessUnitVATRegistration = (string)$businessUnit["VAT_Registration"];

    $sqlOpenShift = "
        SELECT
            Shift_ID,
            Opening_DateTime,
            Opening_Cash_Count
        FROM tbl_pos_shifting_records
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND Shift_Status = 'Open'
        ORDER BY Opening_DateTime DESC
        LIMIT 1
    ";
    $stmtOpenShift = $pdo->prepare($sqlOpenShift);
    $stmtOpenShift->execute([$categoryCode, $unitCode, $terminalNumber]);
    $openShift = $stmtOpenShift->fetch();

    if (!$openShift) {
        throw new Exception("No open shifting record found for this terminal.");
    }

    $shiftId = (string)$openShift["Shift_ID"];
    $openingDateTime = (string)$openShift["Opening_DateTime"];
    $reportDate = date("Y-m-d", strtotime($openingDateTime));
    $closingDateTime = date("Y-m-d H:i:s");

    $stmtBegOR = $pdo->prepare("
        SELECT invoice_no
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND invoice_no <> 0
        ORDER BY invoice_no ASC
        LIMIT 1
    ");
    $stmtBegOR->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
    $begOR = (float)($stmtBegOR->fetchColumn() ?: 0);

    $stmtEndOR = $pdo->prepare("
        SELECT invoice_no
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND invoice_no <> 0
        ORDER BY invoice_no DESC
        LIMIT 1
    ");
    $stmtEndOR->execute([$categoryCode, $unitCode, $terminalNumber]);
    $endOR = (float)($stmtEndOR->fetchColumn() ?: 0);

    $stmtBegVoid = $pdo->prepare("
        SELECT void_id
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND Status = 'Voided'
        ORDER BY void_id ASC
        LIMIT 1
    ");
    $stmtBegVoid->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
    $begVoidNo = (float)($stmtBegVoid->fetchColumn() ?: 0);

    $stmtEndVoid = $pdo->prepare("
        SELECT void_id
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND Status = 'Voided'
        ORDER BY void_id DESC
        LIMIT 1
    ");
    $stmtEndVoid->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
    $endVoidNo = (float)($stmtEndVoid->fetchColumn() ?: 0);

    $stmtBegRefund = $pdo->prepare("
        SELECT refund_id
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND Status = 'Refunded'
        ORDER BY refund_id ASC
        LIMIT 1
    ");
    $stmtBegRefund->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
    $begRefundNo = (float)($stmtBegRefund->fetchColumn() ?: 0);

    $stmtEndRefund = $pdo->prepare("
        SELECT refund_id
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND DATE(transaction_date) = ?
          AND Status = 'Refunded'
        ORDER BY refund_id DESC
        LIMIT 1
    ");
    $stmtEndRefund->execute([$categoryCode, $unitCode, $terminalNumber, $reportDate]);
    $endRefundNo = (float)($stmtEndRefund->fetchColumn() ?: 0);

    $stmtZCounter = $pdo->prepare("
        SELECT Z_Counter_No
        FROM tbl_pos_shifting_records
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
        ORDER BY Z_Counter_No DESC
        LIMIT 1
    ");
    $stmtZCounter->execute([$categoryCode, $unitCode, $terminalNumber]);
    $lastZCounterNo = (float)($stmtZCounter->fetchColumn() ?: 0);
    $zCounterNo = $lastZCounterNo + 1;

    $stmtGrandAccum = $pdo->prepare("
        SELECT SUM(TotalSales) AS Present_Accum_Sales
        FROM tbl_pos_transactions
        WHERE Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND Status = 'Active'
    ");
    $stmtGrandAccum->execute([$categoryCode, $unitCode, $terminalNumber]);
    $grandAccumSales = (float)($stmtGrandAccum->fetchColumn() ?: 0);

    $pdo->beginTransaction();

    $stmtUpdateShift = $pdo->prepare("
        UPDATE tbl_pos_shifting_records
        SET
            Closing_User_ID = ?,
            Closing_DateTime = ?,
            Closing_Cash_Count = ?,
            Beg_OR = ?,
            End_OR = ?,
            Beg_VoidNo = ?,
            End_VoidNo = ?,
            Beg_RefundNo = ?,
            End_RefundNo = ?,
            Z_Counter_No = ?,
            Grand_Accum_Sales = ?,
            Shift_Status = 'Closed'
        WHERE Shift_ID = ?
          AND Category_Code = ?
          AND Unit_Code = ?
          AND terminal_number = ?
          AND Shift_Status = 'Open'
    ");

    $stmtUpdateShift->execute([
        $closingUserId,
        $closingDateTime,
        $cashDrawerAmount,
        $begOR,
        $endOR,
        $begVoidNo,
        $endVoidNo,
        $begRefundNo,
        $endRefundNo,
        $zCounterNo,
        $grandAccumSales,
        $shiftId,
        $categoryCode,
        $unitCode,
        $terminalNumber,
    ]);

    if ($stmtUpdateShift->rowCount() <= 0) {
        $pdo->rollBack();
        throw new Exception("Failed to close the shifting record.");
    }

    $sql = "
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
            IFNULL(t3.Previous_Accum_Sales, 0) AS Previous_Accum_Sales,
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
            IFNULL(t15.Payment_Others, 0) AS Payment_Others
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
            SELECT SUM(TotalSales) AS Present_Accum_Sales
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
            SELECT SUM(TotalAmountDue) AS Voided_Sales
            FROM tbl_pos_transactions
            WHERE Category_Code = ?
              AND Unit_Code = ?
              AND terminal_number = ?
              AND DATE(transaction_date) = ?
              AND Status = 'Voided'
        ) AS t5,
        (
            SELECT SUM(TotalAmountDue) AS Refunded_Sales
            FROM tbl_pos_transactions
            WHERE Category_Code = ?
              AND Unit_Code = ?
              AND terminal_number = ?
              AND DATE(transaction_date) = ?
              AND Status = 'Refunded'
        ) AS t6,
        (
            SELECT SUM(discount_amount) AS Discount_SRC
            FROM tbl_pos_transactions_discounts
            LEFT JOIN tbl_pos_transactions
              ON tbl_pos_transactions_discounts.transaction_id = tbl_pos_transactions.transaction_id
             AND tbl_pos_transactions_discounts.Category_Code = tbl_pos_transactions.Category_Code
             AND tbl_pos_transactions_discounts.Unit_Code = tbl_pos_transactions.Unit_Code
            WHERE tbl_pos_transactions_discounts.discount_type = 'Senior Citizen'
              AND tbl_pos_transactions_discounts.Status = 'Active'
              AND DATE(tbl_pos_transactions.transaction_date) = ?
        ) AS t7,
        (
            SELECT SUM(discount_amount) AS Discount_PWD
            FROM tbl_pos_transactions_discounts
            LEFT JOIN tbl_pos_transactions
              ON tbl_pos_transactions_discounts.transaction_id = tbl_pos_transactions.transaction_id
             AND tbl_pos_transactions_discounts.Category_Code = tbl_pos_transactions.Category_Code
             AND tbl_pos_transactions_discounts.Unit_Code = tbl_pos_transactions.Unit_Code
            WHERE tbl_pos_transactions_discounts.discount_type = 'PWD'
              AND tbl_pos_transactions_discounts.Status = 'Active'
              AND DATE(tbl_pos_transactions.transaction_date) = ?
        ) AS t8,
        (
            SELECT SUM(discount_amount) AS Discount_NAAC
            FROM tbl_pos_transactions_discounts
            LEFT JOIN tbl_pos_transactions
              ON tbl_pos_transactions_discounts.transaction_id = tbl_pos_transactions.transaction_id
             AND tbl_pos_transactions_discounts.Category_Code = tbl_pos_transactions.Category_Code
             AND tbl_pos_transactions_discounts.Unit_Code = tbl_pos_transactions.Unit_Code
            WHERE tbl_pos_transactions_discounts.discount_type = 'NAAC'
              AND tbl_pos_transactions_discounts.Status = 'Active'
              AND DATE(tbl_pos_transactions.transaction_date) = ?
        ) AS t9,
        (
            SELECT SUM(discount_amount) AS Discount_SoloParent
            FROM tbl_pos_transactions_discounts
            LEFT JOIN tbl_pos_transactions
              ON tbl_pos_transactions_discounts.transaction_id = tbl_pos_transactions.transaction_id
             AND tbl_pos_transactions_discounts.Category_Code = tbl_pos_transactions.Category_Code
             AND tbl_pos_transactions_discounts.Unit_Code = tbl_pos_transactions.Unit_Code
            WHERE tbl_pos_transactions_discounts.discount_type = 'Solo Parent'
              AND tbl_pos_transactions_discounts.Status = 'Active'
              AND DATE(tbl_pos_transactions.transaction_date) = ?
        ) AS t10,
        (
            SELECT SUM(discount_amount) AS Discount_Others
            FROM tbl_pos_transactions_discounts
            LEFT JOIN tbl_pos_transactions
              ON tbl_pos_transactions_discounts.transaction_id = tbl_pos_transactions.transaction_id
             AND tbl_pos_transactions_discounts.Category_Code = tbl_pos_transactions.Category_Code
             AND tbl_pos_transactions_discounts.Unit_Code = tbl_pos_transactions.Unit_Code
            WHERE tbl_pos_transactions_discounts.discount_type <> 'Solo Parent'
              AND tbl_pos_transactions_discounts.discount_type <> 'PWD'
              AND tbl_pos_transactions_discounts.discount_type <> 'NAAC'
              AND tbl_pos_transactions_discounts.discount_type <> 'Senior Citizen'
              AND tbl_pos_transactions_discounts.Status = 'Active'
              AND DATE(tbl_pos_transactions.transaction_date) = ?
        ) AS t11,
        (
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
        ) AS t12,
        (
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
        ) AS t13,
        (
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
        ) AS t14,
        (
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
              AND b.payment_method <> 'Cash'
              AND b.payment_method <> 'Cheque'
              AND b.payment_method <> 'Credit Card'
              AND a.Status = 'Active'
        ) AS t15
    ";

    $params = [
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
    ];

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();

    if (!$row) {
        throw new Exception("No Z-reading data found.");
    }

    $parReportDate = date("F d, Y", strtotime($row["Opening_DateTime"]));
    $parReportTime = date("h:i A", strtotime($row["Closing_DateTime"] ?: $closingDateTime));
    $parStartDateTime = date("m/d/y g:i A", strtotime($row["Opening_DateTime"]));
    $parEndDateTime = date("m/d/y g:i A", strtotime($row["Closing_DateTime"] ?: $closingDateTime));

    $grossAmount = (float)$row["Gross_Amount"];
    $lessDiscount = (float)$row["Discount"];
    $lessVatExemption = (float)$row["VATExemptSales_VAT"];
    $lessReturn = (float)$row["Refunded_Sales"];
    $lessVoid = (float)$row["Voided_Sales"];
    $lessVatAdjustment = 0.00;

    $netAmount = $grossAmount
        - $lessDiscount
        - $lessVatExemption
        - $lessReturn
        - $lessVoid
        - $lessVatAdjustment;

    $cashAmount = (float)$row["Payment_Cash"];
    $chequeAmount = (float)$row["Payment_Cheque"];
    $creditCardAmount = (float)$row["Payment_CreditCard"];
    $otherPaymentsAmount = (float)$row["Payment_Others"];
    $openingFund = (float)$row["Opening_Cash_Count"];
    $withdrawal = 0.00;
    $paymentsReceived = $cashAmount + $chequeAmount + $creditCardAmount + $otherPaymentsAmount;
    $shortOver = $cashDrawerAmount + $chequeAmount + $creditCardAmount + $otherPaymentsAmount - $openingFund - $paymentsReceived;

    $tinLabel = $businessUnitVATRegistration === "Non-VAT Registered"
        ? "NON-VAT REG TIN: " . $businessUnitTIN
        : "VAT REG TIN: " . $businessUnitTIN;

    $logNow = date("Y-m-d H:i:s");
    $logDate = date("Y-m-d");
    $logTime = date("H:i:s");
    $resolvedUserName = $userName !== "" ? $userName : ($cashierName !== "" ? $cashierName : $selectedCashier);
    $presentAccumSales = (float)($row["Present_Accum_Sales"] ?? 0);
    $salesForTheDay = (float)($row["Sales_For_The_Day"] ?? 0);

    try {
        $valuesOfData = json_encode([
            "shift_id" => $shiftId,
            "selected_cashier" => $selectedCashier,
            "terminal_number" => $terminalNumber,
            "report_date" => $reportDate,
            "opening_datetime" => $openingDateTime,
            "closing_datetime" => $closingDateTime,
            "opening_fund" => $openingFund,
            "cash_drawer_amount" => $cashDrawerAmount,
            "verify_amount" => $verifyAmount,
            "beg_or" => (float)$row["Beg_OR"],
            "end_or" => (float)$row["End_OR"],
            "beg_void" => (float)$row["Beg_VoidNo"],
            "end_void" => (float)$row["End_VoidNo"],
            "beg_refund" => (float)$row["Beg_RefundNo"],
            "end_refund" => (float)$row["End_RefundNo"],
            "z_counter_no" => (float)$row["Z_Counter_No"],
            "present_accumulated_sales" => (float)$row["Present_Accum_Sales"],
            "previous_accumulated_sales" => $presentAccumSales - $salesForTheDay,
            "sales_for_the_day" => (float)$row["Sales_For_The_Day"],
            "gross_amount" => $grossAmount,
            "less_discount" => $lessDiscount,
            "less_vat_exemption" => $lessVatExemption,
            "less_return" => $lessReturn,
            "less_void" => $lessVoid,
            "net_amount" => $netAmount,
            "cash" => $cashAmount,
            "cheque" => $chequeAmount,
            "credit_card" => $creditCardAmount,
            "other_payments" => $otherPaymentsAmount,
            "payments_received" => $paymentsReceived,
            "short_over" => $shortOver,
            "machine_number" => $machineNumber,
            "serial_number" => $serialNumber,
            "ptu_number" => $ptuNumber,
            "ptu_date_issued" => $ptuDateIssued
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
            ":type_of_activity" => "POS Z-READING",
            ":activity_performed" => "CLOSE SHIFT AND GENERATE Z-READING",
            ":values_of_data" => $valuesOfData
        ]);
    } catch (Throwable $activityLogError) {
        // ignore logging failure
    }

    try {
        $referenceNo = $shiftId !== "" ? $shiftId : ($terminalNumber . "-" . $reportDate);

        $description = "POS Z-READING | SHIFT: {$referenceNo} | TERMINAL: {$terminalNumber} | CASHIER: {$selectedCashier} | NET AMOUNT: {$netAmount}";

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
            ":Trans_Type" => "Z-READING",
            ":User_ID" => is_numeric($userId) ? $userId : "0",
            ":Amount" => $netAmount,
            ":Description" => $description,
            ":Log_Date" => $logDate,
            ":Log_Time" => $logTime
        ]);
    } catch (Throwable $transactionLogError) {
        // ignore logging failure
    }

    $pdo->commit();

    echo json_encode([
        "success" => true,
        "message" => "Current shift has been closed and Z-Reading data loaded successfully.",
        "data" => [
            "shiftId" => $shiftId,
            "selectedCashier" => $selectedCashier,
            "reportDate" => $parReportDate,
            "reportTime" => $parReportTime,
            "startDateTime" => $parStartDateTime,
            "endDateTime" => $parEndDateTime,

            "begSI" => (float)$row["Beg_OR"],
            "endSI" => (float)$row["End_OR"],
            "begVoid" => (float)$row["Beg_VoidNo"],
            "endVoid" => (float)$row["End_VoidNo"],
            "begReturn" => (float)$row["Beg_RefundNo"],
            "endReturn" => (float)$row["End_RefundNo"],
            "resetCounterNo" => 0,
            "zCounterNo" => (float)$row["Z_Counter_No"],

            "presentAccumulatedSales" => (float)$row["Present_Accum_Sales"],
            "previousAccumulatedSales" => (float)$row["Present_Accum_Sales"] - (float)$row["Sales_For_The_Day"],
            "salesForTheDay" => (float)$row["Sales_For_The_Day"],

            "vatableSales" => (float)$row["VATableSales"],
            "vatAmount" => (float)$row["VATableSales_VAT"],
            "vatExemptSales" => (float)$row["VATExemptSales"],
            "vatExemptVat" => (float)$row["VATExemptSales_VAT"],
            "vatExemption" => (float)$row["VATExemptSales_VAT"],
            "zeroRatedSales" => (float)$row["VATZeroRatedSales"],
            "otherCharges" => (float)$row["OtherCharges"],

            "grossAmount" => $grossAmount,
            "lessDiscount" => $lessDiscount,
            "lessVatExemption" => $lessVatExemption,
            "lessReturn" => $lessReturn,
            "lessVoid" => $lessVoid,
            "lessVatAdjustment" => $lessVatAdjustment,
            "netAmount" => $netAmount,

            "scDisc" => (float)$row["Discount_SRC"],
            "pwdDisc" => (float)$row["Discount_PWD"],
            "naacDisc" => (float)$row["Discount_NAAC"],
            "soloParentDisc" => (float)$row["Discount_SoloParent"],
            "otherDisc" => (float)$row["Discount_Others"],

            "salesAdjustmentVoid" => $lessVoid,
            "salesAdjustmentReturn" => $lessReturn,

            "scTransVatAdj" => 0.00,
            "pwdTransVatAdj" => 0.00,
            "regDiscTransVatAdj" => 0.00,
            "zeroRatedTransVatAdj" => 0.00,
            "vatOnReturn" => 0.00,
            "otherVatAdjustments" => 0.00,

            "cashInDrawer" => $cashDrawerAmount,
            "cheque" => $chequeAmount,
            "creditCard" => $creditCardAmount,
            "otherPayments" => $otherPaymentsAmount,
            "openingFund" => $openingFund,
            "lessWithdrawal" => $withdrawal,
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
        ],
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ]);
}

