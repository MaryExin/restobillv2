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

function respond(bool $success, string $message, int $status = 200): void {
    http_response_code($status);
    echo json_encode(["success" => $success, "message" => $message]);
    exit;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(false, "Method not allowed.", 405);
    }

    $body          = json_decode(file_get_contents("php://input"), true) ?: [];
    $transactionId = trim((string)($body["transaction_id"] ?? ""));
    $categoryCode  = trim((string)($body["Category_Code"] ?? ""));
    $unitCode      = trim((string)($body["Unit_Code"] ?? ""));

    if ($transactionId === "") {
        respond(false, "transaction_id is required.", 400);
    }

    $rawCharges = is_array($body["charges"] ?? null) ? $body["charges"] : [];
    $charges = array_values(array_filter(array_map(function ($c) {
        $particulars = trim((string)($c["particulars"] ?? ""));
        $amount      = (float)($c["amount"] ?? 0);
        return ($particulars !== "" && $amount > 0)
            ? ["particulars" => $particulars, "amount" => $amount]
            : null;
    }, $rawCharges)));

    // Delete existing AUTO-saved billing charges for this transaction
    $pdo->prepare("
        DELETE FROM tbl_pos_transactions_other_charges
        WHERE transaction_id = :tid
          AND Category_Code  = :cat
          AND Unit_Code      = :unit
          AND reference      = 'AUTO'
    ")->execute([":tid" => $transactionId, ":cat" => $categoryCode, ":unit" => $unitCode]);

    if (count($charges) > 0) {
        $ins = $pdo->prepare("
            INSERT INTO tbl_pos_transactions_other_charges
                (transaction_id, Category_Code, Unit_Code, Project_Code, transaction_date, particulars, amount, reference)
            VALUES
                (:tid, :cat, :unit, '', CURDATE(), :particulars, :amount, 'AUTO')
        ");
        foreach ($charges as $charge) {
            $ins->execute([
                ":tid"         => $transactionId,
                ":cat"         => $categoryCode,
                ":unit"        => $unitCode,
                ":particulars" => $charge["particulars"],
                ":amount"      => $charge["amount"],
            ]);
        }
    }

    respond(true, "Charges saved.");

} catch (Throwable $e) {
    respond(false, $e->getMessage(), 500);
}
