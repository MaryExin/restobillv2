<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require __DIR__ . "/secure_guard.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    header("Allow: GET, OPTIONS");
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed.",
    ]);
    exit;
}

// Authenticate and authorize against the original POS database before
// selecting the date-appropriate database for report data.
require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";
posRoleAuthRequirePermission(
    $pdo,
    (string)($GLOBALS["pos_user_id"] ?? ""),
    "reports",
    "transactions"
);

require_once __DIR__ . "/report_db.php";

try {
    $transactionId = trim((string)($_GET["id"] ?? ""));
    if ($transactionId === "") {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "No Transaction ID provided.",
        ]);
        exit;
    }

    $reportPdo = getReportPdo($_GET["date"] ?? null);
    $stmt = $reportPdo->prepare("
        SELECT
            td.product_id,
            pm.item_name,
            td.sales_quantity,
            td.selling_price,
            (td.sales_quantity * td.selling_price) AS subtotal,
            tp.payment_method,
            tp.payment_amount
        FROM tbl_pos_transactions_detailed td
        LEFT JOIN tbl_inventory_products_masterlist pm
            ON td.product_id = pm.product_id
        LEFT JOIN tbl_pos_transactions_payments tp
            ON td.transaction_id = tp.transaction_id
        WHERE td.transaction_id = :id
    ");
    $stmt->execute(["id" => $transactionId]);
    $items = $stmt->fetchAll();

    if (!$items) {
        echo json_encode([
            "success" => false,
            "message" => "No records found for this transaction ID.",
        ]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "data" => $items,
    ]);
} catch (PDOException $e) {
    error_log("Report transaction items error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to load transaction items.",
    ]);
}
