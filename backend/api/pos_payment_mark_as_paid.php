<?php
require_once __DIR__ . "/cors.php";

header("Content-Type: application/json");

date_default_timezone_set("Asia/Manila");

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_report_mirror.php";

function respond(bool $success, string $message, int $status = 200, array $extra = []): void {
    http_response_code($status);
    echo json_encode(array_merge(["success" => $success, "message" => $message], $extra));
    exit;
}

function allocateReceiptNumber(PDO $pdo, string $categoryCode, string $unitCode): int
{
    $stmtCounter = $pdo->prepare("
        SELECT Category_Code, Unit_Code, next_invoice_no
        FROM tbl_pos_document_counters
        WHERE Category_Code = :cc
          AND Unit_Code = :uc
        LIMIT 1
        FOR UPDATE
    ");
    $stmtCounter->execute([":cc" => $categoryCode, ":uc" => $unitCode]);
    $counterRow = $stmtCounter->fetch(PDO::FETCH_ASSOC);

    if (!$counterRow) {
        $stmtInsertCounter = $pdo->prepare("
            INSERT INTO tbl_pos_document_counters (
                Category_Code, Unit_Code, next_billing_no, next_invoice_no
            ) VALUES (:cc, :uc, :next_billing_no, :next_invoice_no)
        ");

        try {
            $stmtInsertCounter->execute([
                ":cc" => $categoryCode,
                ":uc" => $unitCode,
                ":next_billing_no" => 3000000001,
                ":next_invoice_no" => 4000000001,
            ]);
        } catch (Throwable $e) {
            // Another request may have inserted first; re-lock below.
        }

        $stmtCounter->execute([":cc" => $categoryCode, ":uc" => $unitCode]);
        $counterRow = $stmtCounter->fetch(PDO::FETCH_ASSOC);
    }

    if (!$counterRow) {
        throw new Exception("Failed to initialize or lock document counter row.");
    }

    $allocatedNumber = isset($counterRow["next_invoice_no"]) ? (int)$counterRow["next_invoice_no"] : 0;
    if ($allocatedNumber <= 0) {
        $allocatedNumber = 4000000001;
    }

    $pdo->prepare("
        UPDATE tbl_pos_document_counters
        SET next_invoice_no = :next_number
        WHERE Category_Code = :cc
          AND Unit_Code = :uc
    ")->execute([
        ":next_number" => $allocatedNumber + 1,
        ":cc" => $categoryCode,
        ":uc" => $unitCode,
    ]);

    return $allocatedNumber;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Method not allowed.", 405);
}

$body          = json_decode(file_get_contents("php://input"), true) ?: [];
$transactionId = trim((string)($body["transaction_id"] ?? ""));
$categoryCode  = trim((string)($body["category_code"] ?? ""));
$unitCode      = trim((string)($body["unit_code"] ?? ""));

if ($transactionId === "") {
    respond(false, "transaction_id is required.", 400);
}
if ($categoryCode === "" || $unitCode === "") {
    respond(false, "category_code and unit_code are required.", 400);
}

try {
    $pdo->beginTransaction();

    $transactionStmt = $pdo->prepare("
        SELECT invoice_no, remarks, status, void_id, refund_id
        FROM tbl_pos_transactions
        WHERE transaction_id = :transaction_id
          AND Category_Code = :category_code
          AND Unit_Code = :unit_code
        LIMIT 1
        FOR UPDATE
    ");
    $transactionStmt->execute([
        ":transaction_id" => $transactionId,
        ":category_code" => $categoryCode,
        ":unit_code" => $unitCode,
    ]);
    $transaction = $transactionStmt->fetch(PDO::FETCH_ASSOC);

    if (!is_array($transaction)) {
        $pdo->rollBack();
        respond(false, "Transaction was not found for this branch.", 404);
    }

    if ((int)($transaction["void_id"] ?? 0) > 0) {
        $pdo->rollBack();
        respond(false, "Transaction is voided and cannot be marked as paid.", 409);
    }

    if ((int)($transaction["refund_id"] ?? 0) > 0) {
        $pdo->rollBack();
        respond(false, "Transaction is refunded and cannot be marked as paid.", 409);
    }

    $currentRemarks = trim((string)($transaction["remarks"] ?? ""));
    if (strcasecmp($currentRemarks, "Paid") === 0) {
        $pdo->rollBack();
        respond(false, "Transaction is already marked as paid.", 409);
    }

    $paymentStmt = $pdo->prepare("
        SELECT COUNT(*) AS cnt, COALESCE(SUM(payment_amount), 0) AS total_amount
        FROM tbl_pos_transactions_payments
        WHERE transaction_id = :transaction_id
          AND Category_Code = :category_code
          AND Unit_Code = :unit_code
    ");
    $paymentStmt->execute([
        ":transaction_id" => $transactionId,
        ":category_code" => $categoryCode,
        ":unit_code" => $unitCode,
    ]);
    $paymentSummary = $paymentStmt->fetch(PDO::FETCH_ASSOC);

    if ((int)($paymentSummary["cnt"] ?? 0) === 0) {
        $pdo->rollBack();
        respond(false, "No existing payment record found for this transaction. Use Save Payment instead.", 409);
    }

    $paymentAmount = (float)($paymentSummary["total_amount"] ?? 0);

    $methodStmt = $pdo->prepare("
        SELECT DISTINCT payment_method
        FROM tbl_pos_transactions_payments
        WHERE transaction_id = :transaction_id
          AND Category_Code = :category_code
          AND Unit_Code = :unit_code
    ");
    $methodStmt->execute([
        ":transaction_id" => $transactionId,
        ":category_code" => $categoryCode,
        ":unit_code" => $unitCode,
    ]);
    $methods = array_values(array_filter($methodStmt->fetchAll(PDO::FETCH_COLUMN)));
    $paymentMethodLabel = count($methods) === 1 ? $methods[0] : "Multiple";

    $currentInvoiceNo = (int)($transaction["invoice_no"] ?? 0);
    $finalInvoiceNo = $currentInvoiceNo;

    if ($finalInvoiceNo <= 0) {
        $finalInvoiceNo = allocateReceiptNumber($pdo, $categoryCode, $unitCode);

        $checkDupInvoiceStmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM tbl_pos_transactions
            WHERE invoice_no = :invoice_no
              AND Category_Code = :cc
              AND Unit_Code = :uc
              AND transaction_id <> :tid
        ");
        $checkDupInvoiceStmt->execute([
            ":invoice_no" => $finalInvoiceNo,
            ":cc" => $categoryCode,
            ":uc" => $unitCode,
            ":tid" => $transactionId,
        ]);

        if ((int)$checkDupInvoiceStmt->fetchColumn() > 0) {
            $pdo->rollBack();
            respond(false, "Duplicate invoice number detected. Please retry.", 409);
        }
    }

    $updateStmt = $pdo->prepare("
        UPDATE tbl_pos_transactions
        SET invoice_no = CASE
                WHEN COALESCE(invoice_no, 0) > 0 THEN invoice_no
                ELSE :invoice_no
            END,
            payment_amount = :payment_amount,
            payment_method = :payment_method,
            remarks = 'Paid',
            status = 'Active',
            date_recorded = NOW()
        WHERE transaction_id = :transaction_id
          AND Category_Code = :category_code
          AND Unit_Code = :unit_code
    ");
    $updateStmt->execute([
        ":invoice_no" => $finalInvoiceNo,
        ":payment_amount" => $paymentAmount,
        ":payment_method" => $paymentMethodLabel,
        ":transaction_id" => $transactionId,
        ":category_code" => $categoryCode,
        ":unit_code" => $unitCode,
    ]);

    if ($updateStmt->rowCount() !== 1) {
        throw new RuntimeException("Transaction update failed.");
    }

    mirrorPosTransactionToReport($pdo, $config, $transactionId, $categoryCode, $unitCode);

    $pdo->commit();

    respond(true, "Transaction marked as paid.", 200, [
        "invoice_no" => $finalInvoiceNo,
        "payment_amount" => $paymentAmount,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("POS mark-as-paid failed: " . $e->getMessage());
    respond(false, "Unable to mark the transaction as paid.", 500);
}
