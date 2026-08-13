<?php
require_once __DIR__ . "/bootstrap.php";
require_once __DIR__ . "/pos_developer_auth.php";

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_report_mirror.php";

function respond(bool $success, string $message, int $status = 200, array $extra = []): void {
    http_response_code($status);
    echo json_encode(array_merge(["success" => $success, "message" => $message], $extra));
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Method not allowed.", 405);
}

$body              = json_decode(file_get_contents("php://input"), true) ?: [];
$transactionId     = trim((string)($body["transaction_id"]      ?? ""));
$categoryCode      = trim((string)($body["category_code"]       ?? ""));
$unitCode          = trim((string)($body["unit_code"]           ?? ""));
$remarks           = trim((string)($body["remarks"]             ?? "NO REMARKS"));
$selectedAdminId   = trim((string)($body["selected_admin_id"]   ?? ""));
$adminPassword     = trim((string)($body["admin_password"]      ?? ""));
$developerToken    = posDeveloperRequestTokenData();
$isDeveloperSession = is_array($developerToken) &&
    function_exists("posDeveloperFullAccessTokenIsValid") &&
    posDeveloperFullAccessTokenIsValid($developerToken);

if ($transactionId === "") {
    respond(false, "transaction_id is required.", 400);
}
if ($categoryCode === "" || $unitCode === "") {
    respond(false, "category_code and unit_code are required.", 400);
}
if (!$isDeveloperSession && ($selectedAdminId === "" || $adminPassword === "")) {
    respond(false, "Admin credentials are required.", 400);
}

try {
    if (!$isDeveloperSession) {
        // ── Validate admin password ────────────────────────────────────────────
        $adminStmt = $pdo->prepare("
            SELECT uuid, password, classification
            FROM tbl_users_global_assignment
            WHERE (uuid = :id OR email = :id2)
              AND UPPER(TRIM(status)) = 'ACTIVE'
              AND UPPER(TRIM(deletestatus)) = 'ACTIVE'
            LIMIT 1
        ");
        $adminStmt->execute([":id" => $selectedAdminId, ":id2" => $selectedAdminId]);
        $admin = $adminStmt->fetch(PDO::FETCH_ASSOC);

        if (!$admin) {
            respond(false, "Admin account not found.", 401);
        }

        $adminClassification = strtoupper(trim((string)(
            $admin["classification"] ?? ""
        )));
        if (!in_array($adminClassification, [
            "1",
            "2",
            "ADMIN",
            "MANAGER",
            "SUPERVISOR",
            "ADMIN / SUPERVISOR",
            "SUPER ADMIN",
            "SUPER_ADMIN",
            "SUPERADMIN",
        ], true)) {
            respond(false, "An Admin or Super Admin account is required.", 403);
        }

        $stored = $admin["password"] ?? "";
        $valid  = password_verify($adminPassword, $stored) || ($adminPassword === $stored);

        if (!$valid) {
            respond(false, "Invalid admin password.", 401);
        }
    }

    // ── Get next void number and save ─────────────────────────────────────────
    $pdo->beginTransaction();

    $transactionStmt = $pdo->prepare("
        SELECT status, order_status, void_id, refund_id
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
        respond(false, "Transaction is already voided.", 409);
    }

    if ((int)($transaction["refund_id"] ?? 0) > 0) {
        $pdo->rollBack();
        respond(false, "A refunded transaction cannot be voided.", 409);
    }

    $counterStmt = $pdo->prepare("
        SELECT next_void_id
        FROM tbl_pos_document_counters
        WHERE Category_Code = :cat AND Unit_Code = :unit
        LIMIT 1
        FOR UPDATE
    ");
    $counterStmt->execute([":cat" => $categoryCode, ":unit" => $unitCode]);
    $counter = $counterStmt->fetch(PDO::FETCH_ASSOC);

    if (!$counter) {
        $pdo->rollBack();
        respond(false, "Document counter not found for this branch.", 500);
    }

    $voidNumber = (int)$counter["next_void_id"];

    // Update transaction
    $updateStmt = $pdo->prepare("
        UPDATE tbl_pos_transactions
        SET void_id      = :vid,
            void_remarks = :vrm,
            void_date    = NOW(),
            status       = 'Voided',
            order_status = 'Voided'
        WHERE transaction_id = :tid
          AND Category_Code = :cat
          AND Unit_Code = :unit
    ");
    $updateStmt->execute([
        ":vid" => $voidNumber,
        ":vrm" => $remarks,
        ":tid" => $transactionId,
        ":cat" => $categoryCode,
        ":unit" => $unitCode,
    ]);

    if ($updateStmt->rowCount() !== 1) {
        throw new RuntimeException("Transaction update failed.");
    }

    // Increment counter
    $pdo->prepare("
        UPDATE tbl_pos_document_counters
        SET next_void_id = next_void_id + 1
        WHERE Category_Code = :cat AND Unit_Code = :unit
    ")->execute([":cat" => $categoryCode, ":unit" => $unitCode]);

    mirrorPosTransactionToReport($pdo, $config, $transactionId, $categoryCode, $unitCode);

    $pdo->commit();

    respond(true, "Transaction voided successfully.", 200, [
        "void_id" => $voidNumber,
        "authorized_by" => $isDeveloperSession
            ? posDeveloperDisplayName()
            : $selectedAdminId,
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("POS void failed: " . $e->getMessage());
    respond(false, "Unable to void the transaction.", 500);
}
