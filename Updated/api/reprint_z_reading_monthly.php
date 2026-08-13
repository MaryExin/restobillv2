<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

date_default_timezone_set('Asia/Manila');

require __DIR__ . "/secure_guard.php";

if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "POST"], true)) {
    http_response_code(405);
    header("Allow: GET, POST, OPTIONS");
    echo json_encode(["success" => false, "message" => "Method not allowed."]);
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";
$authenticatedUserId = (string)($GLOBALS["pos_user_id"] ?? "");
posRoleAuthRequirePermission(
    $pdo,
    $authenticatedUserId,
    "reports",
    "zReadingMonthly"
);
$primaryPdo = $pdo;
$authenticatedAccount = posRoleAuthAccount($primaryPdo, $authenticatedUserId);
$isSuperAdmin = posRoleAuthCanonicalValue(
    $authenticatedAccount["classification"] ?? ""
) === "2";

require_once __DIR__ . "/report_db.php";
require_once __DIR__ . "/pos_z_reading_monthly_data.php";

try {
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

    // Business identity is authoritative in the live database even when the
    // report figures are read from one or both data stores.
    $stmtBusinessUnit = $primaryPdo->prepare("
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

    $activationDate = null;
    $reportDbName = "";
    if ($isSuperAdmin) {
        $activationState = posReportMirrorActivationReadState($primaryPdo, $config);
        $activationDate = ($activationState["active"] ?? false) === true
            ? (string)$activationState["activation_business_date"]
            : null;
        [, $reportDbName] = posReportMirrorActivationDatabaseNames($config);
    }
    $dateEndExclusive = (new DateTimeImmutable($dateTo, new DateTimeZone("Asia/Manila")))
        ->modify("+1 day")
        ->format("Y-m-d");
    $segmentPlans = [];
    $dataSource = "primary";
    $reportPdo = null;

    if ($isSuperAdmin) {
        // Prefer report shift snapshots where they are closed and available;
        // primary shifts fill missing dates. Additive transaction figures are
        // combined later using row-level map ownership, not this shift plan.
        $reportPdo = getConfiguredReportPdo();
        $primaryClosedDates = posZReadingMonthlyFetchClosedDates(
            $primaryPdo,
            $dateFrom,
            $dateEndExclusive,
            $categoryCode,
            $unitCode,
            $terminalNumber
        );
        $reportClosedDates = posZReadingMonthlyFetchClosedDates(
            $reportPdo,
            $dateFrom,
            $dateEndExclusive,
            $categoryCode,
            $unitCode,
            $terminalNumber
        );
        $segmentPlans = posZReadingMonthlyPlanHybridRange(
            $dateFrom,
            $dateTo,
            $primaryClosedDates,
            $reportClosedDates,
            $activationDate
        );
        $selectedSources = array_values(array_unique(array_map(
            static fn(array $plan): string => (string)$plan["source"],
            $segmentPlans
        )));
        $dataSource = count($selectedSources) > 1
            ? "primary_and_report"
            : (string)($selectedSources[0] ?? "primary");
    } else {
        // Every non-Super-Admin role reads the complete requested range from
        // the primary POS database and never probes reports_database.
        $segmentPlans[] = [
            "source" => "primary",
            "start" => $dateFrom,
            "end_exclusive" => $dateEndExclusive,
            "pdo" => $primaryPdo,
        ];
    }

    $loadedSegments = [];
    $publicSegments = [];
    foreach ($segmentPlans as $plan) {
        $source = (string)$plan["source"];

        if (isset($plan["pdo"]) && $plan["pdo"] instanceof PDO) {
            $segmentPdo = $plan["pdo"];
        } elseif ($source === "primary") {
            $segmentPdo = $primaryPdo;
        } elseif (!$isSuperAdmin) {
            throw new RuntimeException(
                "Non-Super-Admin Z-reading segments must use the primary database."
            );
        } else {
            $reportPdo ??= getConfiguredReportPdo();
            $segmentPdo = $reportPdo;
        }

        if ($isSuperAdmin) {
            $loaded = [
                "first_shift" => posZReadingMonthlyFetchShift(
                    $segmentPdo,
                    (string)$plan["start"],
                    (string)$plan["end_exclusive"],
                    $categoryCode,
                    $unitCode,
                    $terminalNumber,
                    false
                ),
                "last_shift" => posZReadingMonthlyFetchShift(
                    $segmentPdo,
                    (string)$plan["start"],
                    (string)$plan["end_exclusive"],
                    $categoryCode,
                    $unitCode,
                    $terminalNumber,
                    true
                ),
                "totals" => [],
            ];
        } else {
            $loaded = posZReadingMonthlyLoadSegment(
                $segmentPdo,
                (string)$plan["start"],
                (string)$plan["end_exclusive"],
                $categoryCode,
                $unitCode,
                $terminalNumber,
                null,
                null,
                null
            );
        }
        $loadedSegments[] = $loaded;
        $publicSegments[] = [
            "source" => $source,
            "dateFrom" => (string)$plan["start"],
            "dateToExclusive" => (string)$plan["end_exclusive"],
        ];
    }

    $firstShift = null;
    $lastShift = null;
    foreach ($loadedSegments as $segment) {
        if ($firstShift === null && $segment["first_shift"]) {
            $firstShift = $segment["first_shift"];
        }
        if ($segment["last_shift"]) {
            $lastShift = $segment["last_shift"];
        }
    }
    if (!$firstShift || !$lastShift) {
        throw new Exception("No Z-reading reprint record found for the selected date range. Only closed shifts with Z_Counter_No not equal to 0 can be reprinted.");
    }

    if ($isSuperAdmin) {
        if (!$reportPdo instanceof PDO) {
            throw new RuntimeException(
                "Unable to open the report database for hybrid Z-reading totals."
            );
        }
        $hybridTotalSegments = [];
        foreach ($segmentPlans as $plan) {
            $hybridTotalSegments[] = [
                "totals" => posZReadingMonthlyFetchSuperAdminHybridTotals(
                    $primaryPdo,
                    $reportPdo,
                    $reportDbName,
                    (string)$plan["start"],
                    (string)$plan["end_exclusive"],
                    $categoryCode,
                    $unitCode,
                    $terminalNumber
                ),
            ];
        }
        $sales = posZReadingMonthlyMergeTotals($hybridTotalSegments);
    } else {
        $sales = posZReadingMonthlyMergeTotals($loadedSegments);
    }
    $calculationSource = $isSuperAdmin
        ? "primary_and_report"
        : $dataSource;
    $voidedSales = (float)($sales["Voided_Sales"] ?? 0);
    $refundedSales = (float)($sales["Refunded_Sales"] ?? 0);
    $discountSC = (float)($sales["Discount_SC"] ?? 0);
    $discountPWD = (float)($sales["Discount_PWD"] ?? 0);
    $discountNAAC = (float)($sales["Discount_NAAC"] ?? 0);
    $discountSolo = (float)($sales["Discount_Solo"] ?? 0);
    $discountOther = (float)($sales["Discount_Other"] ?? 0);
    $paymentCash = (float)($sales["Payment_Cash"] ?? 0);
    $paymentCheque = (float)($sales["Payment_Cheque"] ?? 0);
    $paymentCreditCard = (float)($sales["Payment_CreditCard"] ?? 0);
    $paymentOthers = (float)($sales["Payment_Others"] ?? 0);

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
            "dataSource" => $dataSource,
            "calculationSource" => $calculationSource,
            "activationDate" => $activationDate,
            "sourceSegments" => $publicSegments,

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
    if (http_response_code() < 400) {
        http_response_code(500);
    }
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ]);
}
