<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require __DIR__ . "/pdo.php";

$dateFrom     = isset($_GET["dateFrom"]) ? trim($_GET["dateFrom"]) : null;
$dateTo       = isset($_GET["dateTo"]) ? trim($_GET["dateTo"]) : null;
$search       = isset($_GET["search"]) ? trim($_GET["search"]) : "";
$cashier      = isset($_GET["cashier"]) ? trim($_GET["cashier"]) : "";
$recordStatus = isset($_GET["recordStatus"]) ? trim($_GET["recordStatus"]) : "";

$data = [];
$totalSales = 0;

$sql = "
    SELECT
        t1.ID,
        t1.transaction_id,
        t1.transaction_type,
        t1.transaction_date,
        t1.transaction_time,
        t1.table_number,
        t1.TotalSales,
        t1.Discount,
        t1.VATExemptSales_VAT,
        t1.OtherCharges,
        t1.TotalAmountDue,
        t1.payment_amount,
        t1.change_amount,
        t1.order_slip_no,
        t1.billing_no,
        t1.invoice_no,
        t1.void_id,
        t1.refund_id,
        t1.payment_method,
        t1.short_over,
        t1.cashier,
        t1.remarks,
        t1.status,
        t2.payment_reference
    FROM tbl_pos_transactions t1
    LEFT JOIN tbl_pos_transactions_payments t2
        ON t1.transaction_id = t2.transaction_id
";

$conditions = [];
$params = [];

/*
|--------------------------------------------------------------------------
| DATE RANGE
|--------------------------------------------------------------------------
*/
if (!empty($dateFrom) && !empty($dateTo)) {
    $conditions[] = "DATE(t1.transaction_date) BETWEEN :dateFrom AND :dateTo";
    $params[":dateFrom"] = $dateFrom;
    $params[":dateTo"] = $dateTo;
} elseif (!empty($dateFrom)) {
    $conditions[] = "DATE(t1.transaction_date) >= :dateFrom";
    $params[":dateFrom"] = $dateFrom;
} elseif (!empty($dateTo)) {
    $conditions[] = "DATE(t1.transaction_date) <= :dateTo";
    $params[":dateTo"] = $dateTo;
}

/*
|--------------------------------------------------------------------------
| SEARCH
|--------------------------------------------------------------------------
*/
if ($search !== "") {
    $conditions[] = "(
        t1.table_number LIKE :search1
        OR CAST(t1.transaction_id AS CHAR) LIKE :search2
        OR t1.order_slip_no LIKE :search3
        OR t1.billing_no LIKE :search4
        OR t1.invoice_no LIKE :search5
        OR CAST(t1.void_id AS CHAR) LIKE :search6
        OR CAST(t1.refund_id AS CHAR) LIKE :search7
        OR IFNULL(t2.payment_reference, '') LIKE :search8
        OR t1.cashier LIKE :search9
        OR t1.remarks LIKE :search10
        OR t1.status LIKE :search11
    )";

    $searchLike = "%" . $search . "%";
    $params[":search1"] = $searchLike;
    $params[":search2"] = $searchLike;
    $params[":search3"] = $searchLike;
    $params[":search4"] = $searchLike;
    $params[":search5"] = $searchLike;
    $params[":search6"] = $searchLike;
    $params[":search7"] = $searchLike;
    $params[":search8"] = $searchLike;
    $params[":search9"] = $searchLike;
    $params[":search10"] = $searchLike;
    $params[":search11"] = $searchLike;
}

/*
|--------------------------------------------------------------------------
| OPTIONAL FILTERS
|--------------------------------------------------------------------------
*/
if ($cashier !== "" && strcasecmp($cashier, "All") !== 0) {
    $conditions[] = "t1.cashier LIKE :cashier";
    $params[":cashier"] = $cashier . "%";
}

if ($recordStatus !== "" && strcasecmp($recordStatus, "All") !== 0) {
    $conditions[] = "t1.status LIKE :recordStatus";
    $params[":recordStatus"] = $recordStatus . "%";
}

if (!empty($conditions)) {
    $sql .= " WHERE " . implode(" AND ", $conditions);
}

$sql .= " ORDER BY t1.transaction_id DESC";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as $row) {
        $row["TotalSales"] = (float) ($row["TotalSales"] ?? 0);
        $row["Discount"] = (float) ($row["Discount"] ?? 0);
        $row["VATExemptSales_VAT"] = (float) ($row["VATExemptSales_VAT"] ?? 0);
        $row["OtherCharges"] = (float) ($row["OtherCharges"] ?? 0);
        $row["TotalAmountDue"] = (float) ($row["TotalAmountDue"] ?? 0);
        $row["payment_amount"] = (float) ($row["payment_amount"] ?? 0);
        $row["change_amount"] = (float) ($row["change_amount"] ?? 0);
        $row["short_over"] = (float) ($row["short_over"] ?? 0);

        $totalSales += $row["TotalAmountDue"];
        $data[] = $row;
    }

    echo json_encode([
        "success" => true,
        "totalTransactions" => count($data),
        "totalSales" => $totalSales,
        "data" => $data
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch transaction records",
        "error" => $e->getMessage()
    ]);
}