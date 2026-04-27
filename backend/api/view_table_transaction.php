<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$config = require __DIR__ . "/config.php";

$conn = new mysqli(
    $config["host"],
    $config["user"],
    $config["pass"],
    $config["db"]
);

if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Database connection failed"]);
    exit;
}

date_default_timezone_set('Asia/Manila');

// Accept transaction_id from GET or POST
$transaction_id = isset($_GET["transaction_id"])
    ? (int)$_GET["transaction_id"]
    : (isset($_POST["transaction_id"]) ? (int)$_POST["transaction_id"] : 0);

if ($transaction_id <= 0) {
    echo json_encode(["status" => "error", "message" => "transaction_id is required"]);
    $conn->close();
    exit;
}

try {
    // 1) Read header
    $sqlHeader = "SELECT *
                  FROM tbl_pos_transactions
                  WHERE transaction_id = ?
                  LIMIT 1";
    $stmt = $conn->prepare($sqlHeader);
    $stmt->bind_param("i", $transaction_id);
    $stmt->execute();
    $headerRes = $stmt->get_result();
    $header = $headerRes->fetch_assoc();
    $stmt->close();

    if (!$header) {
        echo json_encode([
            "status" => "error",
            "message" => "Transaction not found",
            "transaction_id" => $transaction_id
        ]);
        $conn->close();
        exit;
    }

    // 2) Read order details
    $sqlDetails = "SELECT T1.*, item_name
                   FROM tbl_pos_transactions_detailed AS T1
                   LEFT JOIN tbl_inventory_products_masterlist AS T2
                   ON T1.product_id = T2.product_id
                   WHERE transaction_id = ?
                   ORDER BY id ASC";
    $stmt2 = $conn->prepare($sqlDetails);
    $stmt2->bind_param("i", $transaction_id);
    $stmt2->execute();
    $detailsRes = $stmt2->get_result();

    $order_details = [];

    // Totals
    $total_qty = 0;
    $subtotal = 0.0;
    $vatable_subtotal = 0.0;
    $nonvatable_subtotal = 0.0;

    while ($row = $detailsRes->fetch_assoc()) {
        // Basic line total: qty * selling_price
        $qty = (float)($row["sales_quantity"] ?? 0);
        $price = (float)($row["selling_price"] ?? 0);
        $line_total = $qty * $price;

        $total_qty += $qty;
        $subtotal += $line_total;

        // vatable could be 0/1 or "Yes"/"No" depending on your data
        $vatableVal = $row["vatable"] ?? 0;
        $isVatable = ($vatableVal === 1 || $vatableVal === "1" || strtolower((string)$vatableVal) === "yes" || strtolower((string)$vatableVal) === "true");

        if ($isVatable) $vatable_subtotal += $line_total;
        else $nonvatable_subtotal += $line_total;

        // Add computed line_total in output
        $row["line_total"] = $line_total;

        $order_details[] = $row;
    }

    $stmt2->close();

    // 3) Create summary (pick only important header fields + totals)
    $summary = [
        "transaction_id" => (int)$header["transaction_id"],
        "order_type" => $header["order_type"] ?? "DINE IN"

    ];

    echo json_encode([
        "summary" => $summary,
        "order_details" => $order_details
    ]);

} catch (Throwable $e) {
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}

$conn->close();
?>