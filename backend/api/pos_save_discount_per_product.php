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

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond(false, "Method not allowed.", 405);
}

$body = json_decode(file_get_contents("php://input"), true) ?: [];

$transactionId   = trim((string)($body["transaction_id"]    ?? ""));
$transactionDate = trim((string)($body["transaction_date"]  ?? date("Y-m-d")));
$categoryCode    = trim((string)($body["category_code"]     ?? ""));
$unitCode        = trim((string)($body["unit_code"]         ?? ""));
$rows            = $body["rows"] ?? [];

if ($transactionId === "") {
    respond(false, "transaction_id is required.", 400);
}

try {
    $pdo->beginTransaction();

    $pdo->prepare("
        DELETE FROM tbl_pos_transactions_discounts_per_product
        WHERE transaction_id = :tid
    ")->execute([":tid" => $transactionId]);

    if (!empty($rows)) {
        $stmt = $pdo->prepare("
            INSERT INTO tbl_pos_transactions_discounts_per_product
                (transaction_id, transaction_date, category_code, unit_code,
                 product_id, item_name, customer_id, discount_type,
                 discount_sharing, total_customers, qualified_customers,
                 vat_exempt_amount, discount_amount, status)
            VALUES
                (:tid, :tdate, :cat, :unit,
                 :product_id, :item_name, :customer_id, :discount_type,
                 :sharing, :total_cust, :qual_cust,
                 :vat_exempt, :discount_amt, 'Active')
        ");

        foreach ($rows as $row) {
            $stmt->execute([
                ":tid"          => $transactionId,
                ":tdate"        => $transactionDate,
                ":cat"          => $categoryCode,
                ":unit"         => $unitCode,
                ":product_id"   => trim((string)($row["product_id"]           ?? "")),
                ":item_name"    => trim((string)($row["item_name"]             ?? "")),
                ":customer_id"  => trim((string)($row["customer_id"]          ?? "")),
                ":discount_type"=> trim((string)($row["discount_type"]        ?? "")),
                ":sharing"      => trim((string)($row["discount_sharing"]     ?? "shared")),
                ":total_cust"   => max((int)($row["total_customers"]          ?? 1), 1),
                ":qual_cust"    => max((int)($row["qualified_customers"]      ?? 0), 0),
                ":vat_exempt"   => round((float)($row["vat_exempt_amount"]    ?? 0), 4),
                ":discount_amt" => round((float)($row["discount_amount"]      ?? 0), 4),
            ]);
        }
    }

    $pdo->commit();
    respond(true, "Per-product discount data saved.");

} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(false, $e->getMessage(), 500);
}
