<?php
/**
 * BILLING / TRANSACTION SAVING API (SAFE - NO DUPLICATES)
 * WITH DISCOUNT BREAKDOWN SYNC TO tbl_pos_transactions_discounts
 *
 * IMPROVEMENTS:
 * - Handles CORS preflight OPTIONS
 * - Uses tbl_pos_document_counters for fast, safe billing/invoice number allocation
 * - Do not overwrite billing_no/invoice_no if already assigned
 * - Re-sync tbl_pos_transactions_discounts on re-billing / editing
 * - Update existing discount rows by customer_id sequence
 * - Insert missing rows
 * - Inactivate extra old rows when count is reduced
 * - customer_name can be null
 * - customer_id is simple sequence: 1,2,3,4...
 * - logs to tbl_main_activity_logs
 * - logs to tbl_main_transaction_logs
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

date_default_timezone_set("Asia/Manila");

/* ------------------------------
    1. LOAD CONFIG & DB
------------------------------ */
$config = require __DIR__ . "/config.php";

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Connection failed: " . $e->getMessage()
    ]);
    exit;
}

/* ------------------------------
    2. GET INPUT DATA
------------------------------ */
$rawBody = file_get_contents("php://input");
$decoded = json_decode($rawBody, true);
$input = is_array($decoded) ? $decoded : $_POST;

$transaction_id  = isset($input['transaction_id']) ? (int)$input['transaction_id'] : 0;
$printTitle      = trim((string)($input['printTitle'] ?? ""));
$transStatus     = $input['transStatus'] ?? "Settled";
$category_code   = trim((string)($input['category_code'] ?? ""));
$unit_code       = trim((string)($input['unit_code'] ?? ""));

/* User Info */
$user_id         = trim((string)($input['user_id'] ?? ""));
$user_name       = trim((string)($input['user_name'] ?? ($input['cashier'] ?? "System")));

/* Financials */
$totalSales      = isset($input['TotalSales']) ? (float)$input['TotalSales'] : 0;
$discount        = isset($input['Discount']) ? (float)$input['Discount'] : 0;
$otherCharges    = isset($input['OtherCharges']) ? (float)$input['OtherCharges'] : 0;
$totalAmountDue  = isset($input['TotalAmountDue']) ? (float)$input['TotalAmountDue'] : 0;
$paymentAmount   = isset($input['payment_amount']) ? (float)$input['payment_amount'] : 0;
$changeAmount    = isset($input['change_amount']) ? (float)$input['change_amount'] : 0;

/* Cart Items */
$cartItems = isset($input['cart_items']) && is_array($input['cart_items'])
    ? $input['cart_items']
    : [];

/* Discount Breakdown */
$discountBreakdown = isset($input['discount_breakdown']) && is_array($input['discount_breakdown'])
    ? $input['discount_breakdown']
    : [];

$hasCustomerInfoPayload = isset($input['customer_info']) && is_array($input['customer_info']);
$customerInfo = $hasCustomerInfoPayload
    ? array_values($input['customer_info'])
    : [];

/* ------------------------------
    3. HELPERS
------------------------------ */
function normalizeDiscountType($value)
{
    $value = trim((string)$value);

    $map = [
        "senior" => "Senior Citizen Discount",
        "senior citizen" => "Senior Citizen Discount",
        "senior citizen discount" => "Senior Citizen Discount",
        "pwd" => "PWD Discount",
        "pwd discount" => "PWD Discount",
        "naac" => "NAAC Discount",
        "naac discount" => "NAAC Discount",
        "national athletes and coaches" => "NAAC Discount",
        "national athletes and coaches discount" => "NAAC Discount",
        "solo parent" => "Solo Parent Discount",
        "solo parent discount" => "Solo Parent Discount",
        "soloparent" => "Solo Parent Discount",
        "manual" => "Manual Discount",
        "manual discount" => "Manual Discount",
    ];

    $key = strtolower($value);
    return $map[$key] ?? $value;
}

function moneyRound($value)
{
    return round((float)$value, 2);
}

function normalizeNullable($value)
{
    $value = trim((string)$value);
    return $value === "" ? null : $value;
}

function splitAmountAcrossCount($totalAmount, $count)
{
    $count = (int)$count;
    $totalAmount = moneyRound($totalAmount);

    if ($count <= 0 || $totalAmount <= 0) {
        return [];
    }

    $base = floor(($totalAmount / $count) * 100) / 100;
    $rows = array_fill(0, $count, $base);

    $assigned = moneyRound($base * $count);
    $difference = moneyRound($totalAmount - $assigned);

    if ($count > 0) {
        $rows[$count - 1] = moneyRound($rows[$count - 1] + $difference);
    }

    return $rows;
}

function getDiscountCeiling(PDO $pdo): float
{
    $stmt = $pdo->prepare("
        SELECT `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":category" => "Discount",
        ":description" => "Discount Ceiling Amount",
    ]);

    $amount = (float)($stmt->fetchColumn() ?: 0);
    return $amount > 0 ? moneyRound($amount) : 0.0;
}

function applyDiscountCeilingToBreakdown(array $breakdown, float $ceilingAmount): array
{
    $rawTotal = 0.0;
    foreach ($breakdown as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $rawTotal += (float)($entry["discount_amount"] ?? 0);
    }

    $rawTotal = moneyRound($rawTotal);
    $ceilingAmount = moneyRound($ceilingAmount);

    if ($ceilingAmount <= 0 || $rawTotal <= $ceilingAmount || $rawTotal <= 0) {
        return $breakdown;
    }

    $discountIndexes = [];
    foreach ($breakdown as $index => $entry) {
        if (is_array($entry) && (float)($entry["discount_amount"] ?? 0) > 0) {
            $discountIndexes[] = $index;
        }
    }

    $lastDiscountIndex = end($discountIndexes);
    $assigned = 0.0;

    foreach ($breakdown as $index => $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $rowAmount = (float)($entry["discount_amount"] ?? 0);
        if ($rowAmount <= 0) {
            continue;
        }

        if ($index === $lastDiscountIndex) {
            $cappedAmount = moneyRound($ceilingAmount - $assigned);
        } else {
            $cappedAmount = moneyRound(($rowAmount / $rawTotal) * $ceilingAmount);
        }

        $breakdown[$index]["original_discount_amount"] = moneyRound($rowAmount);
        $breakdown[$index]["discount_amount"] = max($cappedAmount, 0);
        $assigned = moneyRound($assigned + $cappedAmount);
    }

    return $breakdown;
}

/**
 * Lock the counter row and return the next billing/invoice number.
 * Also increments the counter immediately inside the same transaction.
 */
function allocateDocumentNumber(PDO $pdo, string $categoryCode, string $unitCode, string $documentType): int
{
    $documentType = strtoupper(trim($documentType));

    $counterColumn = match ($documentType) {
        'BILLING' => 'next_billing_no',
        'RECEIPT' => 'next_invoice_no',
        default => throw new Exception("Unsupported document type for counter allocation."),
    };

    $defaultStart = $documentType === 'BILLING' ? 3000000001 : 4000000001;

    $stmtCounter = $pdo->prepare("
        SELECT Category_Code, Unit_Code, next_billing_no, next_invoice_no
        FROM tbl_pos_document_counters
        WHERE Category_Code = :cc
          AND Unit_Code = :uc
        LIMIT 1
        FOR UPDATE
    ");
    $stmtCounter->execute([
        ':cc' => $categoryCode,
        ':uc' => $unitCode
    ]);

    $counterRow = $stmtCounter->fetch();

    if (!$counterRow) {
        $stmtInsertCounter = $pdo->prepare("
            INSERT INTO tbl_pos_document_counters (
                Category_Code,
                Unit_Code,
                next_billing_no,
                next_invoice_no
            ) VALUES (
                :cc,
                :uc,
                :next_billing_no,
                :next_invoice_no
            )
        ");

        try {
            $stmtInsertCounter->execute([
                ':cc'              => $categoryCode,
                ':uc'              => $unitCode,
                ':next_billing_no' => 3000000001,
                ':next_invoice_no' => 4000000001
            ]);
        } catch (Throwable $e) {
            // If another request inserted it first, continue and re-lock below.
        }

        $stmtCounter->execute([
            ':cc' => $categoryCode,
            ':uc' => $unitCode
        ]);

        $counterRow = $stmtCounter->fetch();
    }

    if (!$counterRow) {
        throw new Exception("Failed to initialize or lock document counter row.");
    }

    $allocatedNumber = isset($counterRow[$counterColumn]) ? (int)$counterRow[$counterColumn] : 0;
    if ($allocatedNumber <= 0) {
        $allocatedNumber = $defaultStart;
    }

    $stmtUpdateCounter = $pdo->prepare("
        UPDATE tbl_pos_document_counters
        SET {$counterColumn} = :next_number
        WHERE Category_Code = :cc
          AND Unit_Code = :uc
    ");
    $stmtUpdateCounter->execute([
        ':next_number' => $allocatedNumber + 1,
        ':cc'          => $categoryCode,
        ':uc'          => $unitCode
    ]);

    return $allocatedNumber;
}

/* ------------------------------
    4. DATABASE TRANSACTION START
------------------------------ */
try {
    if ($transaction_id <= 0) {
        throw new Exception("Invalid transaction_id.");
    }

    if ($category_code === "" || $unit_code === "") {
        throw new Exception("category_code and unit_code are required.");
    }

    $discountCeiling = getDiscountCeiling($pdo);
    if ($discountCeiling > 0 && $discount > $discountCeiling) {
        $discountBreakdown = applyDiscountCeilingToBreakdown($discountBreakdown, $discountCeiling);
        $discount = $discountCeiling;
        $vatExemptSalesVat = isset($input['VATExemptSales_VAT']) ? (float)$input['VATExemptSales_VAT'] : 0;
        $totalAmountDue = max($totalSales - $discount - $vatExemptSalesVat + $otherCharges, 0);
        $input['Discount'] = $discount;
        $input['TotalAmountDue'] = $totalAmountDue;
    }

    $pdo->beginTransaction();

    /* ------------------------------
        5. LOCK AND READ MAIN ROW FIRST
    ------------------------------ */
    $stmtCurrent = $pdo->prepare("
        SELECT transaction_id, billing_no, invoice_no, remarks, cashier
        FROM tbl_pos_transactions
        WHERE transaction_id = :tid
          AND Category_Code = :cc
          AND Unit_Code = :uc
        LIMIT 1
        FOR UPDATE
    ");
    $stmtCurrent->execute([
        ':tid' => $transaction_id,
        ':cc'  => $category_code,
        ':uc'  => $unit_code
    ]);

    $currentTxn = $stmtCurrent->fetch();

    if (!$currentTxn) {
        throw new Exception("Main transaction not found.");
    }

    $existingBillingNo = isset($currentTxn['billing_no']) ? (int)$currentTxn['billing_no'] : 0;
    $existingInvoiceNo = isset($currentTxn['invoice_no']) ? (int)$currentTxn['invoice_no'] : 0;

    /* ------------------------------
        6. DECIDE FINAL BILLING / INVOICE NO
        USING tbl_pos_document_counters
    ------------------------------ */
    $billing_no = $existingBillingNo;
    $invoice_no = $existingInvoiceNo;

    if (strtoupper($printTitle) === "BILLING" && $billing_no <= 0) {
        $billing_no = allocateDocumentNumber($pdo, $category_code, $unit_code, 'BILLING');

        $check = $pdo->prepare("
            SELECT COUNT(*)
            FROM tbl_pos_transactions
            WHERE billing_no = :billing_no
              AND Category_Code = :cc
              AND Unit_Code = :uc
              AND transaction_id <> :tid
        ");
        $check->execute([
            ':billing_no' => $billing_no,
            ':cc'         => $category_code,
            ':uc'         => $unit_code,
            ':tid'        => $transaction_id
        ]);

        if ((int)$check->fetchColumn() > 0) {
            throw new Exception("Duplicate billing number detected. Please retry.");
        }
    }

    if (strtoupper($printTitle) === "RECEIPT" && $invoice_no <= 0) {
        $invoice_no = allocateDocumentNumber($pdo, $category_code, $unit_code, 'RECEIPT');

        $check = $pdo->prepare("
            SELECT COUNT(*)
            FROM tbl_pos_transactions
            WHERE invoice_no = :invoice_no
              AND Category_Code = :cc
              AND Unit_Code = :uc
              AND transaction_id <> :tid
        ");
        $check->execute([
            ':invoice_no' => $invoice_no,
            ':cc'         => $category_code,
            ':uc'         => $unit_code,
            ':tid'        => $transaction_id
        ]);

        if ((int)$check->fetchColumn() > 0) {
            throw new Exception("Duplicate invoice number detected. Please retry.");
        }
    }

    /* ------------------------------
        7. UPDATE MAIN TRANSACTION
    ------------------------------ */
    $sqlMain = "UPDATE tbl_pos_transactions SET
                billing_no = CASE
                    WHEN COALESCE(billing_no, 0) > 0 THEN billing_no
                    ELSE :billing_no
                END,
                invoice_no = CASE
                    WHEN COALESCE(invoice_no, 0) > 0 THEN invoice_no
                    ELSE :invoice_no
                END,
                customer_exclusive_id = :cust_id,
                customer_head_count = :head_count,
                customer_count_for_discount = :disc_count,
                discount_type = :disc_type,
                TotalSales = :totalSales,
                Discount = :discount,
                OtherCharges = :otherCharges,
                TotalAmountDue = :totalDue,
                VATableSales = :vatsales,
                VATableSales_VAT = :vatsales_vat,
                VATExemptSales = :vatexempt,
                VATExemptSales_VAT = :vatexempt_vat,
                VATZeroRatedSales = :vatzero,
                payment_amount = :pay_amt,
                payment_method = :pay_method,
                change_amount = :change_amt,
                cashier = :cashier,
                remarks = :remarks,
                date_recorded = NOW()
                WHERE transaction_id = :tid
                  AND Category_Code = :cc
                  AND Unit_Code = :uc";

    $stmtMain = $pdo->prepare($sqlMain);
    $stmtMain->execute([
        ':billing_no'    => $billing_no,
        ':invoice_no'    => $invoice_no,
        ':cust_id'       => $input['customer_exclusive_id'] ?? '',
        ':head_count'    => isset($input['customer_head_count']) ? (int)$input['customer_head_count'] : 0,
        ':disc_count'    => isset($input['customer_count_for_discount']) ? (int)$input['customer_count_for_discount'] : 0,
        ':disc_type'     => $input['discount_type'] ?? '',
        ':totalSales'    => $totalSales,
        ':discount'      => $discount,
        ':otherCharges'  => $otherCharges,
        ':totalDue'      => $totalAmountDue,
        ':vatsales'      => isset($input['VATableSales']) ? (float)$input['VATableSales'] : 0,
        ':vatsales_vat'  => isset($input['VATableSales_VAT']) ? (float)$input['VATableSales_VAT'] : 0,
        ':vatexempt'     => isset($input['VATExemptSales']) ? (float)$input['VATExemptSales'] : 0,
        ':vatexempt_vat' => isset($input['VATExemptSales_VAT']) ? (float)$input['VATExemptSales_VAT'] : 0,
        ':vatzero'       => isset($input['VATZeroRatedSales']) ? (float)$input['VATZeroRatedSales'] : 0,
        ':pay_amt'       => $paymentAmount,
        ':pay_method'    => $input['payment_method'] ?? 'Cash',
        ':change_amt'    => $changeAmount,
        ':cashier'       => $input['cashier'] ?? 'System',
        ':remarks'       => $transStatus,
        ':tid'           => $transaction_id,
        ':cc'            => $category_code,
        ':uc'            => $unit_code
    ]);

    /* ------------------------------
        8. UPDATE DETAIL ITEMS
    ------------------------------ */
    if (!empty($cartItems)) {
        $sqlDetail = "UPDATE tbl_pos_transactions_detailed
                      SET selling_price = :price
                      WHERE ID = :id";
        $stmtDetail = $pdo->prepare($sqlDetail);

        foreach ($cartItems as $item) {
            $detailId = isset($item['databaseID']) ? (int)$item['databaseID'] : 0;
            $sellingPrice = isset($item['selling_price']) ? (float)$item['selling_price'] : 0;

            if ($detailId <= 0) {
                continue;
            }

            $stmtDetail->execute([
                ':price' => $sellingPrice,
                ':id'    => $detailId
            ]);
        }
    }

    /* ------------------------------
        9. DISCOUNT BREAKDOWN
        - update existing rows by sequence
        - insert missing rows
        - inactive extra old rows
    ------------------------------ */
    $insertedDiscountRows = 0;
    $updatedDiscountRows = 0;
    $inactivatedDiscountRows = 0;
    $skippedDiscountRows = 0;
    $discountInsertReason = "";

    $usedRowIds = [];

    $stmtReadExistingDiscounts = $pdo->prepare("
        SELECT
            id,
            customer_id,
            customer_name,
            date_of_birth,
            gender,
            tin,
            contact_no,
            status
        FROM tbl_pos_transactions_discounts
        WHERE transaction_id = :transaction_id
          AND Category_Code = :category_code
          AND Unit_Code = :unit_code
        ORDER BY id ASC
    ");
    $stmtReadExistingDiscounts->execute([
        ':transaction_id' => $transaction_id,
        ':category_code' => $category_code,
        ':unit_code' => $unit_code
    ]);

    $existingRows = $stmtReadExistingDiscounts->fetchAll();

    if (empty($discountBreakdown)) {
        $discountInsertReason = "discount_breakdown_empty";

        $stmtInactiveAll = $pdo->prepare("
            UPDATE tbl_pos_transactions_discounts
            SET status = 'Inactive',
                usertracker = :usertracker
            WHERE transaction_id = :transaction_id
              AND Category_Code = :category_code
              AND Unit_Code = :unit_code
              AND status = 'Active'
        ");
        $stmtInactiveAll->execute([
            ':transaction_id' => $transaction_id,
            ':category_code' => $category_code,
            ':unit_code' => $unit_code,
            ':usertracker' => $input['cashier'] ?? 'Store Crew'
        ]);

        $inactivatedDiscountRows = $stmtInactiveAll->rowCount();
    } else {
        $stmtInsertDiscount = $pdo->prepare("
            INSERT INTO tbl_pos_transactions_discounts (
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
            ) VALUES (
                :transaction_id,
                :category_code,
                :unit_code,
                :customer_id,
                :discount_type,
                :discount_amount,
                :customer_name,
                :date_of_birth,
                :gender,
                :tin,
                :contact_no,
                'Active',
                :usertracker,
                NOW()
            )
        ");

        $stmtUpdateDiscount = $pdo->prepare("
            UPDATE tbl_pos_transactions_discounts
            SET
                customer_id = :new_customer_id,
                discount_type = :discount_type,
                discount_amount = :discount_amount,
                customer_name = :customer_name,
                date_of_birth = :date_of_birth,
                gender = :gender,
                tin = :tin,
                contact_no = :contact_no,
                status = 'Active',
                usertracker = :usertracker
            WHERE id = :id
        ");

        $rowIndex = 0;

        foreach ($discountBreakdown as $entry) {
            $discountType   = normalizeDiscountType($entry['discount_type'] ?? '');
            $qualifiedCount = isset($entry['qualified_count']) ? (int)$entry['qualified_count'] : 0;
            $discountAmount = isset($entry['discount_amount']) ? (float)$entry['discount_amount'] : 0;

            if ($qualifiedCount <= 0 || $discountAmount <= 0) {
                $skippedDiscountRows++;
                continue;
            }

            $splitAmounts = splitAmountAcrossCount($discountAmount, $qualifiedCount);

            if (empty($splitAmounts)) {
                $skippedDiscountRows++;
                continue;
            }

            foreach ($splitAmounts as $rowAmount) {
                $existingRow = $existingRows[$rowIndex] ?? [];
                $card = $customerInfo[$rowIndex] ?? [];
                if (!is_array($card)) {
                    $card = [];
                }

                $typedCustomerId = $hasCustomerInfoPayload
                    ? trim((string)($card['customer_exclusive_id'] ?? ''))
                    : "";
                $generatedCustomerId = $typedCustomerId !== ""
                    ? $typedCustomerId
                    : (string)($existingRow['customer_id'] ?? ($rowIndex + 1));
                $customerName = $hasCustomerInfoPayload
                    ? trim((string)($card['customer_name'] ?? ''))
                    : trim((string)($existingRow['customer_name'] ?? ''));
                $dateOfBirth = $hasCustomerInfoPayload
                    ? trim((string)($card['date_of_birth'] ?? ''))
                    : trim((string)($existingRow['date_of_birth'] ?? ''));
                $gender = $hasCustomerInfoPayload
                    ? trim((string)($card['gender'] ?? ''))
                    : trim((string)($existingRow['gender'] ?? ''));
                $tin = $hasCustomerInfoPayload
                    ? trim((string)($card['tin'] ?? ''))
                    : trim((string)($existingRow['tin'] ?? ''));
                $contactNo = $hasCustomerInfoPayload
                    ? trim((string)($card['contact_no'] ?? ''))
                    : trim((string)($existingRow['contact_no'] ?? ''));

                if (isset($existingRows[$rowIndex])) {
                    $existingRowId = (int)$existingRows[$rowIndex]['id'];
                    $stmtUpdateDiscount->execute([
                        ':id'              => $existingRowId,
                        ':new_customer_id' => $generatedCustomerId,
                        ':discount_type'   => $discountType,
                        ':discount_amount' => moneyRound($rowAmount),
                        ':customer_name'   => normalizeNullable($customerName),
                        ':date_of_birth'   => normalizeNullable($dateOfBirth),
                        ':gender'          => normalizeNullable($gender),
                        ':tin'             => normalizeNullable($tin),
                        ':contact_no'      => normalizeNullable($contactNo),
                        ':usertracker'     => $input['cashier'] ?? 'Store Crew'
                    ]);

                    $usedRowIds[] = $existingRowId;
                    $updatedDiscountRows++;
                } else {
                    $stmtInsertDiscount->execute([
                        ':transaction_id'  => $transaction_id,
                        ':category_code'   => $category_code,
                        ':unit_code'       => $unit_code,
                        ':customer_id'     => $generatedCustomerId,
                        ':discount_type'   => $discountType,
                        ':discount_amount' => moneyRound($rowAmount),
                        ':customer_name'   => normalizeNullable($customerName),
                        ':date_of_birth'   => normalizeNullable($dateOfBirth),
                        ':gender'          => normalizeNullable($gender),
                        ':tin'             => normalizeNullable($tin),
                        ':contact_no'      => normalizeNullable($contactNo),
                        ':usertracker'     => $input['cashier'] ?? 'Store Crew'
                    ]);

                    $usedRowIds[] = (int)$pdo->lastInsertId();
                    $insertedDiscountRows++;
                }

                $rowIndex++;
            }
        }

        $existingRowIds = array_map(
            fn($row) => (int)$row['id'],
            $existingRows
        );

        $unusedRowIds = array_values(array_diff($existingRowIds, $usedRowIds));

        if (!empty($unusedRowIds)) {
            $placeholders = implode(',', array_fill(0, count($unusedRowIds), '?'));

            $sqlInactiveExtra = "
                UPDATE tbl_pos_transactions_discounts
                SET status = 'Inactive',
                    usertracker = ?
                WHERE transaction_id = ?
                  AND Category_Code = ?
                  AND Unit_Code = ?
                  AND id IN ($placeholders)
                  AND status = 'Active'
            ";

            $params = array_merge(
                [$input['cashier'] ?? 'Store Crew', $transaction_id, $category_code, $unit_code],
                $unusedRowIds
            );

            $stmtInactiveExtra = $pdo->prepare($sqlInactiveExtra);
            $stmtInactiveExtra->execute($params);
            $inactivatedDiscountRows = $stmtInactiveExtra->rowCount();
        }

        if ($insertedDiscountRows > 0 || $updatedDiscountRows > 0 || $inactivatedDiscountRows > 0) {
            $discountInsertReason = "synced";
        } elseif ($skippedDiscountRows > 0) {
            $discountInsertReason = "all_discount_rows_skipped_due_to_zero_or_invalid_values";
        } else {
            $discountInsertReason = "no_discount_changes";
        }
    }

    /* ------------------------------
        10. GET FINAL SAVED NOS
    ------------------------------ */
    $stmtFinal = $pdo->prepare("
        SELECT billing_no, invoice_no, cashier
        FROM tbl_pos_transactions
        WHERE transaction_id = :tid
          AND Category_Code = :cc
          AND Unit_Code = :uc
        LIMIT 1
    ");
    $stmtFinal->execute([
        ':tid' => $transaction_id,
        ':cc'  => $category_code,
        ':uc'  => $unit_code
    ]);
    $finalTxn = $stmtFinal->fetch();

    $finalBillingNo = isset($finalTxn['billing_no']) ? (int)$finalTxn['billing_no'] : 0;
    $finalInvoiceNo = isset($finalTxn['invoice_no']) ? (int)$finalTxn['invoice_no'] : 0;
    $finalCashier   = $finalTxn['cashier'] ?? ($input['cashier'] ?? 'System');

    /* ------------------------------
        11. INSERT ACTIVITY LOG
    ------------------------------ */
    $activityPerformed = strtoupper($printTitle) === "RECEIPT"
        ? "GENERATE RECEIPT"
        : "GENERATE BILLING";

    $activityValues = json_encode([
        "transaction_id" => $transaction_id,
        "billing_no" => $finalBillingNo,
        "invoice_no" => $finalInvoiceNo,
        "printTitle" => $printTitle,
        "transStatus" => $transStatus,
        "totalSales" => moneyRound($totalSales),
        "discount" => moneyRound($discount),
        "otherCharges" => moneyRound($otherCharges),
        "totalAmountDue" => moneyRound($totalAmountDue),
        "paymentAmount" => moneyRound($paymentAmount),
        "changeAmount" => moneyRound($changeAmount),
        "payment_method" => $input['payment_method'] ?? 'Cash',
        "cashier" => $finalCashier,
        "discount_breakdown_received_count" => is_array($discountBreakdown) ? count($discountBreakdown) : 0,
        "discount_rows_inserted" => $insertedDiscountRows,
        "discount_rows_updated" => $updatedDiscountRows,
        "discount_rows_inactivated" => $inactivatedDiscountRows,
        "discount_rows_skipped" => $skippedDiscountRows,
        "discount_insert_reason" => $discountInsertReason
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $stmtActivityLog = $pdo->prepare("
        INSERT INTO tbl_main_activity_logs (
            Category_Code,
            Unit_Code,
            activity_date_time,
            user_id,
            user_name,
            type_of_activity,
            activity_performed,
            values_of_data
        ) VALUES (
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
        ':Category_Code'      => $category_code,
        ':Unit_Code'          => $unit_code,
        ':activity_date_time' => date("Y-m-d H:i:s"),
        ':user_id'            => $user_id,
        ':user_name'          => $user_name,
        ':type_of_activity'   => "POS BILLING",
        ':activity_performed' => $activityPerformed,
        ':values_of_data'     => $activityValues
    ]);

    /* ------------------------------
        12. INSERT TRANSACTION LOG
    ------------------------------ */
    $referenceNo = $finalBillingNo > 0 ? (string)$finalBillingNo : (string)$finalInvoiceNo;
    $transType = strtoupper($printTitle) === "RECEIPT" ? "RECEIPT" : "BILLING";
    $numericUserId = is_numeric($user_id) ? $user_id : "0";

    $transactionDescription = "POS {$transType} | TXN: {$transaction_id} | REF: {$referenceNo} | Cashier: {$finalCashier} | Status: {$transStatus}";

    $stmtTransactionLog = $pdo->prepare("
        INSERT INTO tbl_main_transaction_logs (
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
        ) VALUES (
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
        ':Category_Code' => $category_code,
        ':Unit_Code'     => $unit_code,
        ':Register'      => 'POS',
        ':Trans_Date'    => date("Y-m-d"),
        ':Reference_No'  => $referenceNo,
        ':Trans_Type'    => $transType,
        ':User_ID'       => $numericUserId,
        ':Amount'        => moneyRound($totalAmountDue),
        ':Description'   => $transactionDescription,
        ':Log_Date'      => date("Y-m-d"),
        ':Log_Time'      => date("H:i:s")
    ]);

    /* ------------------------------
        13. COMMIT
    ------------------------------ */
    $pdo->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Transaction saved successfully.",
        "billing_no" => $finalBillingNo,
        "invoice_no" => $finalInvoiceNo,
        "discount_breakdown_received_count" => is_array($discountBreakdown) ? count($discountBreakdown) : 0,
        "discount_rows_inserted" => $insertedDiscountRows,
        "discount_rows_updated" => $updatedDiscountRows,
        "discount_rows_inactivated" => $inactivatedDiscountRows,
        "discount_rows_skipped" => $skippedDiscountRows,
        "discount_insert_reason" => $discountInsertReason
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
