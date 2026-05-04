<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$config = require __DIR__ . "/config.php";

$conn = new mysqli(
    $config["host"],
    $config["user"],
    $config["pass"],
    $config["db"]
);

if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed"]));
}

$conn->set_charset("utf8mb4");

$sql = "
    SELECT 
        T1.ID,
        T1.table_name
    FROM tbl_pos_tables T1
    WHERE NOT EXISTS (
        SELECT 1
        FROM tbl_pos_transactions T2
        WHERE T2.status = 'Active'
          AND T2.remarks IN ('Pending for Payment', 'Billed')
          AND T2.table_number IS NOT NULL
          AND T2.table_number <> ''
          AND (
                T2.table_number = T1.table_name
                OR T2.table_number LIKE CONCAT(T1.table_name, ' & %')
                OR T2.table_number LIKE CONCAT('% & ', T1.table_name)
                OR T2.table_number LIKE CONCAT('% & ', T1.table_name, ' & %')
          )
    )
    ORDER BY T1.table_name ASC
";

$result = $conn->query($sql);

$data = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
}

echo json_encode($data);
$conn->close();
?>