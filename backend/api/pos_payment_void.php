<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

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

if ($transactionId === "") {
    respond(false, "transaction_id is required.", 400);
}
if ($selectedAdminId === "" || $adminPassword === "") {
    respond(false, "Admin credentials are required.", 400);
}

try {
    // ── Validate admin password ────────────────────────────────────────────────
    $adminStmt = $pdo->prepare("
        SELECT uuid, password, password
        FROM tbl_users_global_assignment
        WHERE (uuid = :id OR email = :id2)
          AND deletestatus = 'Active'
        LIMIT 1
    ");
    $adminStmt->execute([":id" => $selectedAdminId, ":id2" => $selectedAdminId]);
    $admin = $adminStmt->fetch(PDO::FETCH_ASSOC);

    if (!$admin) {
        respond(false, "Admin account not found.", 401);
    }

    $stored = $admin["password"] ?? $admin["User_Password"] ?? "";
    $valid  = password_verify($adminPassword, $stored) || ($adminPassword === $stored);

    if (!$valid) {
        respond(false, "Invalid admin password.", 401);
    }

    // ── Get next void number and save ─────────────────────────────────────────
    $pdo->beginTransaction();

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
    $pdo->prepare("
        UPDATE tbl_pos_transactions
        SET void_id      = :vid,
            void_remarks = :vrm,
            void_date    = NOW(),
            status       = 'Voided',
            order_status = 'Voided'
        WHERE transaction_id = :tid
    ")->execute([
        ":vid" => $voidNumber,
        ":vrm" => $remarks,
        ":tid" => $transactionId,
    ]);

    // Increment counter
    $pdo->prepare("
        UPDATE tbl_pos_document_counters
        SET next_void_id = next_void_id + 1
        WHERE Category_Code = :cat AND Unit_Code = :unit
    ")->execute([":cat" => $categoryCode, ":unit" => $unitCode]);

    $pdo->commit();

    respond(true, "Transaction voided successfully.", 200, ["void_id" => $voidNumber]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(false, $e->getMessage(), 500);
}
