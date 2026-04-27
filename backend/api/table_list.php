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
    http_response_code(500);
    echo json_encode(["error" => "Connection failed"]);
    exit;
}

$date = isset($_GET["date"]) ? trim($_GET["date"]) : null;

$isDefaultTable = isset($_GET["isDefaultTable"]) &&
    filter_var($_GET["isDefaultTable"], FILTER_VALIDATE_BOOLEAN);

$onlyPending = isset($_GET["onlyPending"]) &&
    filter_var($_GET["onlyPending"], FILTER_VALIDATE_BOOLEAN);

$data = [];

if ($isDefaultTable) {
    // Return all pending transactions joined with tables, excluding Voided
    $sql = "
        SELECT
            tpt.id,
            tpt.transaction_id,
            tpt.table_number,
            tpt.transaction_date,
            tpt.remarks,
            tpt.table_number AS transaction_table_number,
            tt.table_name
        FROM tbl_pos_transactions tpt
        LEFT JOIN tbl_pos_tables tt
            ON tpt.table_number = tt.table_name
        WHERE tpt.remarks != 'Paid'
          AND tpt.status != 'Voided'
    ";

    $params = [];
    $types = "";

    if (!empty($date)) {
        $sql .= " AND tpt.transaction_date = ?";
        $params[] = $date;
        $types .= "s";
    }

    $sql .= " ORDER BY tpt.transaction_id DESC";

    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to prepare query"]);
        exit;
    }

    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    $stmt->close();
} else {
    // Grouped table status logic
    $sql = "
        SELECT
            table_number,
            transaction_id,
            MAX(
                CASE
                    WHEN remarks != 'Paid' AND status != 'Voided' THEN 'Pending'
                    ELSE 'Paid'
                END
            ) AS status_label
        FROM tbl_pos_transactions
    ";

    $params = [];
    $types = "";
    $conditions = [];

    // CRITICAL: Exclude Voided transactions from the grouping logic entirely
    $conditions[] = "status NOT LIKE '%Voided%'";

    if (!empty($date)) {
        $conditions[] = "transaction_date = ?";
        $params[] = $date;
        $types .= "s";
    }

    if ($onlyPending) {
        $conditions[] = "remarks LIKE '%Pending%'";
    }

    if (!empty($conditions)) {
        $sql .= " WHERE " . implode(" AND ", $conditions);
    }

    $sql .= " GROUP BY table_number, transaction_id";

    $stmt = $conn->prepare($sql);

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to prepare query"]);
        exit;
    }

    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    $stmt->close();
}

echo json_encode($data);
$conn->close();
?>