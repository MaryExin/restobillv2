<?php
// api/get_open_shift_date.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

require __DIR__ . "/pdo.php";

try {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true) ?: [];

    $unit_code = $body["Unit_Code"] ?? $body["unit_code"] ?? null;
    $terminal_number = $body["terminal_number"] ?? null;
    $category_code = $body["Category_Code"] ?? $body["category_code"] ?? null;

    // Opening_DateTime is already in MySQL DATETIME format: 2026-03-13 07:49:00
    // so use it directly first, then keep the older text parsers as fallback.
    $openingDateExpr = "COALESCE(
        Opening_DateTime,
        STR_TO_DATE(Opening_DateTime, '%Y-%m-%d %H:%i:%s'),
        STR_TO_DATE(Opening_DateTime, '%Y-%m-%d %H:%i'),
        STR_TO_DATE(Opening_DateTime, '%c/%e/%Y %H:%i:%s'),
        STR_TO_DATE(Opening_DateTime, '%c/%e/%Y %H:%i'),
        STR_TO_DATE(Opening_DateTime, '%m/%d/%Y %H:%i:%s'),
        STR_TO_DATE(Opening_DateTime, '%m/%d/%Y %H:%i'),
        STR_TO_DATE(Opening_DateTime, '%c/%e/%Y %l:%i %p'),
        STR_TO_DATE(Opening_DateTime, '%m/%d/%Y %l:%i %p')
    )";

    $sql = "
        SELECT
            ID,
            Category_Code,
            Unit_Code,
            Shift_ID,
            terminal_number,
            Opening_User_ID,
            Opening_DateTime,
            DATE($openingDateExpr) AS selected_date,
            $openingDateExpr AS parsed_opening_datetime
        FROM tbl_pos_shifting_records
        WHERE Shift_Status = 'Open'
          AND Status = 'Active'
          " . ($unit_code ? " AND Unit_Code = :unit_code " : "") . "
          " . ($terminal_number !== null && $terminal_number !== "" ? " AND terminal_number = :terminal_number " : "") . "
          " . ($category_code ? " AND Category_Code = :category_code " : "") . "
        ORDER BY $openingDateExpr DESC
        LIMIT 1
    ";

    $stmt = $pdo->prepare($sql);

    $params = [];
    if ($unit_code) {
        $params[":unit_code"] = $unit_code;
    }
    if ($terminal_number !== null && $terminal_number !== "") {
        $params[":terminal_number"] = $terminal_number;
    }
    if ($category_code) {
        $params[":category_code"] = $category_code;
    }

    $stmt->execute($params);
    $shift = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$shift) {
        $today = date("Y-m-d");

        echo json_encode([
            "success" => true,
            "message" => "No open shift found. Fallback to current date.",
            "selectedDate" => $today,
            "shiftDate" => $today,
            "shift" => null,
        ]);
        exit;
    }

    $selectedDate = !empty($shift["selected_date"])
        ? $shift["selected_date"]
        : date("Y-m-d");

    echo json_encode([
        "success" => true,
        "message" => "Open shift date fetched successfully.",
        "selectedDate" => $selectedDate,
        "shiftDate" => $selectedDate,
        "shift" => [
            "ID" => $shift["ID"],
            "Category_Code" => $shift["Category_Code"],
            "Unit_Code" => $shift["Unit_Code"],
            "Shift_ID" => $shift["Shift_ID"],
            "terminal_number" => $shift["terminal_number"],
            "Opening_User_ID" => $shift["Opening_User_ID"],
            "Opening_DateTime" => $shift["Opening_DateTime"],
        ],
    ]);
} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "selectedDate" => date("Y-m-d"),
        "shiftDate" => date("Y-m-d"),
        "shift" => null,
    ]);
}