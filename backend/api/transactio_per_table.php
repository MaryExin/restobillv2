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

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn = new mysqli(
        $config["host"],
        $config["user"],
        $config["pass"],
        $config["db"]
    );

    $date = $_GET['date'] ?? '';
    $table_number = $_GET['table_number'] ?? '';

    /*
    |--------------------------------------------------------------------------
    | Rebuild broken table_number from query string
    |--------------------------------------------------------------------------
    | Example incoming broken URL:
    | ?date=2026-03-16&table_number=Table 01&Table 03&Table 04
    |
    | PHP sees:
    | $_GET['table_number'] = 'Table 01'
    | $_GET['Table 03'] = ''
    | $_GET['Table 04'] = ''
    */
    $extraTables = [];

    foreach ($_GET as $key => $value) {
        if ($key === 'date' || $key === 'table_number') {
            continue;
        }

        if ($value === '' && trim($key) !== '') {
            $extraTables[] = trim($key);
        }
    }

    if (!empty($extraTables)) {
        $allTables = array_merge([trim($table_number)], $extraTables);
        $table_number = implode(' & ', $allTables);
    }

    $table_number = preg_replace('/\s+/', ' ', trim($table_number));

    if ($date === '' || $table_number === '') {
        echo json_encode([
            "status" => "error",
            "message" => "Missing required parameters",
            "debug" => [
                "date" => $date,
                "table_number" => $table_number,
                "_GET" => $_GET
            ]
        ]);
        exit;
    }

    $sql = "
        SELECT *
        FROM tbl_pos_transactions
        WHERE status != 'Voided'
          AND transaction_date = ?
          AND table_number = ?
    ";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ss", $date, $table_number);
    $stmt->execute();

    $result = $stmt->get_result();
    $data = [];

    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    echo json_encode([
        "status" => "success",
        "received_date" => $date,
        "received_table_number" => $table_number,
        "count" => count($data),
        "data" => $data
    ]);

    $stmt->close();
    $conn->close();

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
?>