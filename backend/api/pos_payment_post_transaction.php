<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

date_default_timezone_set("Asia/Manila");

require __DIR__ . "/pdo.php";

function normalizeDiscountType($value)
{
    $value = trim((string)$value);

    $map = [
        "senior" => "Senior Citizen",
        "senior citizen" => "Senior Citizen",
        "senior citizen discount" => "Senior Citizen",
        "pwd" => "PWD",
        "pwd discount" => "PWD",
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

function normalizeNullable($value)
{
    $value = trim((string)($value ?? ""));
    return $value === "" ? null : $value;
}

/**
 * Allocate next document number from tbl_pos_document_counters.
 * Locks the counter row with FOR UPDATE and increments it immediately
 * inside the same outer DB transaction.
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
        ':uc' => $unitCode,
    ]);

    $counterRow = $stmtCounter->fetch(PDO::FETCH_ASSOC);

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
                ':cc' => $categoryCode,
                ':uc' => $unitCode,
                ':next_billing_no' => 3000000001,
                ':next_invoice_no' => 4000000001,
            ]);
        } catch (Throwable $e) {
            // Another request may have inserted first; re-lock below.
        }

        $stmtCounter->execute([
            ':cc' => $categoryCode,
            ':uc' => $unitCode,
        ]);

        $counterRow = $stmtCounter->fetch(PDO::FETCH_ASSOC);
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
        ':cc' => $categoryCode,
        ':uc' => $unitCode,
    ]);

    return $allocatedNumber;
}

try {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true) ?: [];

    $transaction_id = trim((string)($body["transaction_id"] ?? ""));
    if ($transaction_id === "") {
        throw new Exception("transaction_id is required");
    }

    $categoryCodeInput = trim((string)($body["category_code"] ?? $body["Category_Code"] ?? ""));
    $unitCodeInput = trim((string)($body["unit_code"] ?? $body["Unit_Code"] ?? ""));
    $terminalNumberInput = trim((string)($body["terminal_number"] ?? ""));

    $discount_type = trim((string)($body["discount_type"] ?? "No Discount"));
    $customer_exclusive_id = trim((string)($body["customer_exclusive_id"] ?? ""));
    $customer_head_count = (int)($body["customer_head_count"] ?? 1);
    $customer_count_for_discount = (int)($body["customer_count_for_discount"] ?? 0);

    $customer_info = $body["customer_info"] ?? [];
    if (!is_array($customer_info)) {
        $customer_info = [];
    }

    $discount_breakdown = $body["discount_breakdown"] ?? [];
    if (!is_array($discount_breakdown)) {
        $discount_breakdown = [];
    }

    $cashier = trim((string)($body["cashier"] ?? "Store Crew"));

    $TotalSales = (float)($body["TotalSales"] ?? 0);
    $Discount = (float)($body["Discount"] ?? 0);
    $OtherCharges = (float)($body["OtherCharges"] ?? 0);
    $TotalAmountDue = (float)($body["TotalAmountDue"] ?? 0);
    $VATableSales = (float)($body["VATableSales"] ?? 0);
    $VATableSales_VAT = (float)($body["VATableSales_VAT"] ?? 0);
    $VATExemptSales = (float)($body["VATExemptSales"] ?? 0);
    $VATExemptSales_VAT = (float)($body["VATExemptSales_VAT"] ?? 0);
    $VATZeroRatedSales = (float)($body["VATZeroRatedSales"] ?? 0);
    $payment_amount = (float)($body["payment_amount"] ?? 0);
    $payment_method = trim((string)($body["payment_method"] ?? ""));
    $change_amount = (float)($body["change_amount"] ?? 0);
    $short_over = (float)($body["short_over"] ?? 0);

    $payments = is_array($body["payments"] ?? null) ? $body["payments"] : [];
    $other_charges = is_array($body["other_charges"] ?? null) ? $body["other_charges"] : [];

    if ($payment_amount < $TotalAmountDue) {
        throw new Exception("Total payment amount is less than total amount due.");
    }

    $pdo->beginTransaction();

    $readWhere = "transaction_id = :transaction_id";
    $readParams = [
        ":transaction_id" => $transaction_id,
    ];

    if ($categoryCodeInput !== "") {
        $readWhere .= " AND Category_Code = :category_code";
        $readParams[":category_code"] = $categoryCodeInput;
    }

    if ($unitCodeInput !== "") {
        $readWhere .= " AND Unit_Code = :unit_code";
        $readParams[":unit_code"] = $unitCodeInput;
    }

    if ($terminalNumberInput !== "") {
        $readWhere .= " AND terminal_number = :terminal_number";
        $readParams[":terminal_number"] = $terminalNumberInput;
    }

    $readSql = "
        SELECT
            ID,
            transaction_id,
            Category_Code,
            Unit_Code,
            Project_Code,
            transaction_date,
            billing_no,
            invoice_no,
            remarks,
            status
        FROM tbl_pos_transactions
        WHERE {$readWhere}
        LIMIT 1
        FOR UPDATE
    ";
    $readStmt = $pdo->prepare($readSql);
    $readStmt->execute($readParams);

    $existing = $readStmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing) {
        throw new Exception("Transaction not found.");
    }

    $Category_Code = trim((string)($existing["Category_Code"] ?? ""));
    $Unit_Code = trim((string)($existing["Unit_Code"] ?? ""));
    $Project_Code = $existing["Project_Code"] ?? 0;
    $transaction_date = $existing["transaction_date"] ?? date("n/j/Y");
    $currentBillingNo = (int)($existing["billing_no"] ?? 0);
    $currentInvoiceNo = (int)($existing["invoice_no"] ?? 0);
    $currentRemarks = trim((string)($existing["remarks"] ?? ""));
    $currentStatus = trim((string)($existing["status"] ?? ""));

    if ($Category_Code === "" || $Unit_Code === "") {
        throw new Exception("Category_Code and Unit_Code are required on the transaction row.");
    }

    $postedCheckStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM tbl_pos_transactions_payments
        WHERE transaction_id = :transaction_id
          AND Category_Code = :Category_Code
          AND Unit_Code = :Unit_Code
    ");
    $postedCheckStmt->execute([
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
    ]);
    $existingPaymentRows = (int)$postedCheckStmt->fetchColumn();

    if (
        ($currentInvoiceNo > 0) ||
        strcasecmp($currentRemarks, 'Paid') === 0 ||
        strcasecmp($currentStatus, 'Paid') === 0 ||
        $existingPaymentRows > 0
    ) {
        throw new Exception("This transaction is already posted/paid. Duplicate payment posting was blocked.");
    }

    /**
     * Use existing invoice_no if already present.
     * Otherwise allocate from tbl_pos_document_counters.
     */
    $finalInvoiceNo = $currentInvoiceNo;

    if ($finalInvoiceNo <= 0) {
        $finalInvoiceNo = allocateDocumentNumber($pdo, $Category_Code, $Unit_Code, 'RECEIPT');

        $checkDupInvoiceStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM tbl_pos_transactions
            WHERE invoice_no = :invoice_no
              AND Category_Code = :cc
              AND Unit_Code = :uc
              AND transaction_id <> :tid
        ");
        $checkDupInvoiceStmt->execute([
            ':invoice_no' => $finalInvoiceNo,
            ':cc' => $Category_Code,
            ':uc' => $Unit_Code,
            ':tid' => $transaction_id,
        ]);

        if ((int)$checkDupInvoiceStmt->fetchColumn() > 0) {
            throw new Exception("Duplicate invoice number detected. Please retry.");
        }
    }

    /* ----------------------------------------
       derive first usable customer_exclusive_id
    ---------------------------------------- */
    $derivedCustomerExclusiveId = $customer_exclusive_id;

    if ($derivedCustomerExclusiveId === "" && !empty($customer_info)) {
        foreach ($customer_info as $row) {
            if (!is_array($row)) {
                continue;
            }
            $candidateId = trim((string)($row["customer_exclusive_id"] ?? ""));
            if ($candidateId !== "") {
                $derivedCustomerExclusiveId = $candidateId;
                break;
            }
        }
    }

    $updateSql = "
        UPDATE tbl_pos_transactions
        SET
            invoice_no = CASE
                WHEN COALESCE(invoice_no, 0) > 0 THEN invoice_no
                ELSE :invoice_no
            END,
            customer_exclusive_id = :customer_exclusive_id,
            customer_head_count = :customer_head_count,
            customer_count_for_discount = :customer_count_for_discount,
            discount_type = :discount_type,
            TotalSales = :TotalSales,
            Discount = :Discount,
            OtherCharges = :OtherCharges,
            TotalAmountDue = :TotalAmountDue,
            VATableSales = :VATableSales,
            VATableSales_VAT = :VATableSales_VAT,
            VATExemptSales = :VATExemptSales,
            VATExemptSales_VAT = :VATExemptSales_VAT,
            VATZeroRatedSales = :VATZeroRatedSales,
            payment_amount = :payment_amount,
            payment_method = :payment_method,
            change_amount = :change_amount,
            short_over = :short_over,
            remarks = 'Paid',
            status = 'Active',
            date_recorded = NOW()
        WHERE transaction_id = :transaction_id
          AND Category_Code = :Category_Code
          AND Unit_Code = :Unit_Code
    ";

    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        ":invoice_no" => $finalInvoiceNo,
        ":customer_exclusive_id" => $derivedCustomerExclusiveId,
        ":customer_head_count" => $customer_head_count,
        ":customer_count_for_discount" => $customer_count_for_discount,
        ":discount_type" => $discount_type,
        ":TotalSales" => $TotalSales,
        ":Discount" => $Discount,
        ":OtherCharges" => $OtherCharges,
        ":TotalAmountDue" => $TotalAmountDue,
        ":VATableSales" => $VATableSales,
        ":VATableSales_VAT" => $VATableSales_VAT,
        ":VATExemptSales" => $VATExemptSales,
        ":VATExemptSales_VAT" => $VATExemptSales_VAT,
        ":VATZeroRatedSales" => $VATZeroRatedSales,
        ":payment_amount" => $payment_amount,
        ":payment_method" => $payment_method,
        ":change_amount" => $change_amount,
        ":short_over" => $short_over,
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
    ]);

    /* ----------------------------------------
       reset child rows
    ---------------------------------------- */
    $deletePayments = $pdo->prepare("
        DELETE FROM tbl_pos_transactions_payments
        WHERE transaction_id = :transaction_id
          AND Category_Code = :Category_Code
          AND Unit_Code = :Unit_Code
    ");
    $deletePayments->execute([
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
    ]);

    $deleteCharges = $pdo->prepare("
        DELETE FROM tbl_pos_transactions_other_charges
        WHERE transaction_id = :transaction_id
          AND Category_Code = :Category_Code
          AND Unit_Code = :Unit_Code
    ");
    $deleteCharges->execute([
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
    ]);

    $deleteCustomer = $pdo->prepare("
        DELETE FROM tbl_pos_transactions_customers
        WHERE transaction_id = :transaction_id
          AND Category_Code = :Category_Code
          AND Unit_Code = :Unit_Code
    ");
    $deleteCustomer->execute([
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
    ]);

    /* ----------------------------------------
       insert payments
    ---------------------------------------- */
    if (!empty($payments)) {
        $insertPaymentSql = "
            INSERT INTO tbl_pos_transactions_payments (
                transaction_id,
                Category_Code,
                Unit_Code,
                Project_Code,
                transaction_date,
                payment_method,
                payment_amount,
                payment_reference
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :Project_Code,
                :transaction_date,
                :payment_method,
                :payment_amount,
                :payment_reference
            )
        ";

        $insertPaymentStmt = $pdo->prepare($insertPaymentSql);

        foreach ($payments as $payment) {
            $rowMethod = trim((string)($payment["payment_method"] ?? ""));
            $rowAmount = (float)($payment["payment_amount"] ?? 0);
            $rowReference = trim((string)($payment["payment_reference"] ?? ""));

            if ($rowMethod === "" || $rowAmount <= 0) {
                continue;
            }

            $insertPaymentStmt->execute([
                ":transaction_id" => $transaction_id,
                ":Category_Code" => $Category_Code,
                ":Unit_Code" => $Unit_Code,
                ":Project_Code" => $Project_Code,
                ":transaction_date" => $transaction_date,
                ":payment_method" => $rowMethod,
                ":payment_amount" => $rowAmount,
                ":payment_reference" => $rowReference,
            ]);
        }
    }

    /* ----------------------------------------
       insert other charges
    ---------------------------------------- */
    if (!empty($other_charges)) {
        $insertChargeSql = "
            INSERT INTO tbl_pos_transactions_other_charges (
                transaction_id,
                Category_Code,
                Unit_Code,
                Project_Code,
                transaction_date,
                particulars,
                amount,
                reference
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :Project_Code,
                :transaction_date,
                :particulars,
                :amount,
                :reference
            )
        ";

        $insertChargeStmt = $pdo->prepare($insertChargeSql);

        foreach ($other_charges as $charge) {
            $particulars = trim((string)($charge["particulars"] ?? ""));
            $amount = (float)($charge["amount"] ?? 0);
            $reference = trim((string)($charge["reference"] ?? ""));

            if ($particulars === "" || $amount <= 0) {
                continue;
            }

            $insertChargeStmt->execute([
                ":transaction_id" => $transaction_id,
                ":Category_Code" => $Category_Code,
                ":Unit_Code" => $Unit_Code,
                ":Project_Code" => $Project_Code,
                ":transaction_date" => $transaction_date,
                ":particulars" => $particulars,
                ":amount" => $amount,
                ":reference" => $reference,
            ]);
        }
    }

    /* ----------------------------------------
       insert customers
    ---------------------------------------- */
    $customerIds = [];

    if (!empty($customer_info)) {
        $isAssoc = array_keys($customer_info) !== range(0, count($customer_info) - 1);

        if ($isAssoc) {
            $singleCustomerId = trim((string)($customer_info["customer_exclusive_id"] ?? $derivedCustomerExclusiveId));
            if ($singleCustomerId !== "") {
                $customerIds[] = $singleCustomerId;
            }
        } else {
            foreach ($customer_info as $customerRow) {
                if (!is_array($customerRow)) {
                    continue;
                }
                $customerId = trim((string)($customerRow["customer_exclusive_id"] ?? ""));
                if ($customerId !== "") {
                    $customerIds[] = $customerId;
                }
            }
        }
    }

    if (empty($customerIds) && $derivedCustomerExclusiveId !== "") {
        $customerIds[] = $derivedCustomerExclusiveId;
    }

    $customerIds = array_values(array_unique(array_filter($customerIds)));

    if (!empty($customerIds)) {
        $insertCustomerSql = "
            INSERT INTO tbl_pos_transactions_customers (
                transaction_id,
                Category_Code,
                Unit_Code,
                Project_Code,
                transaction_date,
                customer_id
            ) VALUES (
                :transaction_id,
                :Category_Code,
                :Unit_Code,
                :Project_Code,
                :transaction_date,
                :customer_id
            )
        ";

        $insertCustomerStmt = $pdo->prepare($insertCustomerSql);

        foreach ($customerIds as $customerId) {
            $insertCustomerStmt->execute([
                ":transaction_id" => $transaction_id,
                ":Category_Code" => $Category_Code,
                ":Unit_Code" => $Unit_Code,
                ":Project_Code" => $Project_Code,
                ":transaction_date" => $transaction_date,
                ":customer_id" => $customerId,
            ]);
        }
    }

    /* ----------------------------------------
       UPSERT tbl_pos_transactions_discounts
       - override customer_id with typed customer_exclusive_id when provided
       - keep blank fields unchanged for other columns
       - update by existing row position/id, not by customer_id value
       - inactivate extra rows not present anymore
    ---------------------------------------- */
    $readDiscountRowsStmt = $pdo->prepare("
        SELECT id, customer_id
        FROM tbl_pos_transactions_discounts
        WHERE transaction_id = :transaction_id
          AND Category_Code = :Category_Code
          AND Unit_Code = :Unit_Code
        ORDER BY id ASC
    ");
    $readDiscountRowsStmt->execute([
        ":transaction_id" => $transaction_id,
        ":Category_Code" => $Category_Code,
        ":Unit_Code" => $Unit_Code,
    ]);
    $existingDiscountRows = $readDiscountRowsStmt->fetchAll(PDO::FETCH_ASSOC);

    $insertDiscountStmt = $pdo->prepare("
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
            :Category_Code,
            :Unit_Code,
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

    $updateDiscountStmt = $pdo->prepare("
        UPDATE tbl_pos_transactions_discounts
        SET
            customer_id = :new_customer_id,
            Category_Code = :Category_Code,
            Unit_Code = :Unit_Code,
            discount_type = :discount_type,
            discount_amount = :discount_amount,
            customer_name = CASE
                WHEN :customer_name_is_blank = 1 THEN customer_name
                ELSE :customer_name
            END,
            date_of_birth = CASE
                WHEN :date_of_birth_is_blank = 1 THEN date_of_birth
                ELSE :date_of_birth
            END,
            gender = CASE
                WHEN :gender_is_blank = 1 THEN gender
                ELSE :gender
            END,
            tin = CASE
                WHEN :tin_is_blank = 1 THEN tin
                ELSE :tin
            END,
            contact_no = CASE
                WHEN :contact_no_is_blank = 1 THEN contact_no
                ELSE :contact_no
            END,
            status = 'Active',
            usertracker = :usertracker
        WHERE id = :id
    ");

    $usedRowIds = [];
    $rowIndex = 0;

    foreach ($discount_breakdown as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $discountTypeRow = normalizeDiscountType($entry["discount_type"] ?? "");
        $qualifiedCount = (int)($entry["qualified_count"] ?? 0);
        $discountAmount = (float)($entry["discount_amount"] ?? 0);

        if ($qualifiedCount <= 0 || $discountAmount <= 0) {
            continue;
        }

        $splitAmounts = splitAmountAcrossCount($discountAmount, $qualifiedCount);
        if (empty($splitAmounts)) {
            continue;
        }

        foreach ($splitAmounts as $rowAmount) {
            $card = $customer_info[$rowIndex] ?? [];
            if (!is_array($card)) {
                $card = [];
            }

            $typedCustomerId = trim((string)($card["customer_exclusive_id"] ?? ""));
            $finalDiscountCustomerId = $typedCustomerId !== "" ? $typedCustomerId : (string)($rowIndex + 1);

            $customerName = trim((string)($card["customer_name"] ?? ""));
            $dateOfBirth = trim((string)($card["date_of_birth"] ?? ""));
            $gender = trim((string)($card["gender"] ?? ""));
            $tin = trim((string)($card["tin"] ?? ""));
            $contactNo = trim((string)($card["contact_no"] ?? ""));

            if (isset($existingDiscountRows[$rowIndex])) {
                $existingRowId = (int)$existingDiscountRows[$rowIndex]["id"];

                $updateDiscountStmt->execute([
                    ":id" => $existingRowId,
                    ":new_customer_id" => $finalDiscountCustomerId,
                    ":Category_Code" => $Category_Code,
                    ":Unit_Code" => $Unit_Code,
                    ":discount_type" => $discountTypeRow,
                    ":discount_amount" => moneyRound($rowAmount),
                    ":customer_name" => normalizeNullable($customerName),
                    ":date_of_birth" => normalizeNullable($dateOfBirth),
                    ":gender" => normalizeNullable($gender),
                    ":tin" => normalizeNullable($tin),
                    ":contact_no" => normalizeNullable($contactNo),
                    ":usertracker" => $cashier,
                    ":customer_name_is_blank" => $customerName === "" ? 1 : 0,
                    ":date_of_birth_is_blank" => $dateOfBirth === "" ? 1 : 0,
                    ":gender_is_blank" => $gender === "" ? 1 : 0,
                    ":tin_is_blank" => $tin === "" ? 1 : 0,
                    ":contact_no_is_blank" => $contactNo === "" ? 1 : 0,
                ]);

                $usedRowIds[] = $existingRowId;
            } else {
                $insertDiscountStmt->execute([
                    ":transaction_id" => $transaction_id,
                    ":Category_Code" => $Category_Code,
                    ":Unit_Code" => $Unit_Code,
                    ":customer_id" => $finalDiscountCustomerId,
                    ":discount_type" => $discountTypeRow,
                    ":discount_amount" => moneyRound($rowAmount),
                    ":customer_name" => normalizeNullable($customerName),
                    ":date_of_birth" => normalizeNullable($dateOfBirth),
                    ":gender" => normalizeNullable($gender),
                    ":tin" => normalizeNullable($tin),
                    ":contact_no" => normalizeNullable($contactNo),
                    ":usertracker" => $cashier,
                ]);

                $usedRowIds[] = (int)$pdo->lastInsertId();
            }

            $rowIndex++;
        }
    }

    if (!empty($existingDiscountRows)) {
        $allExistingRowIds = array_map(
            fn($row) => (int)$row["id"],
            $existingDiscountRows
        );

        $unusedRowIds = array_values(array_diff($allExistingRowIds, $usedRowIds));

        if (!empty($unusedRowIds)) {
            $placeholders = implode(",", array_fill(0, count($unusedRowIds), "?"));
            $sqlInactive = "
                UPDATE tbl_pos_transactions_discounts
                SET status = 'Inactive',
                    usertracker = ?
                WHERE id IN ($placeholders)
            ";

            $params = array_merge([$cashier], $unusedRowIds);
            $stmtInactive = $pdo->prepare($sqlInactive);
            $stmtInactive->execute($params);
        }
    }

    $stmtFinal = $pdo->prepare("
        SELECT invoice_no
        FROM tbl_pos_transactions
        WHERE transaction_id = :transaction_id
          AND Category_Code = :cc
          AND Unit_Code = :uc
        LIMIT 1
    ");
    $stmtFinal->execute([
        ':transaction_id' => $transaction_id,
        ':cc' => $Category_Code,
        ':uc' => $Unit_Code,
    ]);
    $finalTxn = $stmtFinal->fetch(PDO::FETCH_ASSOC);

    $savedInvoiceNo = (int)($finalTxn['invoice_no'] ?? 0);

    $pdo->commit();

    echo json_encode([
        "success" => true,
        "message" => "POS payment saved successfully.",
        "transaction_id" => $transaction_id,
        "invoice_no" => $savedInvoiceNo,
        "discount_rows_used" => count($usedRowIds),
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
    ]);
}
