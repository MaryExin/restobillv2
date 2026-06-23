<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
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
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Connection failed"]);
    exit;
}

$conn->set_charset($config["charset"] ?? "utf8mb4");

$createTableSql = "
    CREATE TABLE IF NOT EXISTS tbl_pos_table_layout (
        ID INT NOT NULL AUTO_INCREMENT,
        category_code VARCHAR(100) NOT NULL,
        unit_code VARCHAR(100) NOT NULL,
        layout_key VARCHAR(100) NOT NULL DEFAULT 'ordering',
        positions_json LONGTEXT NULL,
        groups_json LONGTEXT NULL,
        date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (ID),
        UNIQUE KEY uq_pos_table_layout_scope (category_code, unit_code, layout_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
";

if (!$conn->query($createTableSql)) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Failed to prepare table layout storage",
    ]);
    $conn->close();
    exit;
}

$decodeJsonValue = function ($value, $fallback) {
    if ($value === null || $value === "") {
        return $fallback;
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : $fallback;
};

$normalizeScopeValue = function ($value) {
    $clean = trim((string)$value);
    return $clean === "" ? "default" : $clean;
};

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    $categoryCode = $normalizeScopeValue($_GET["category_code"] ?? $_GET["Category_Code"] ?? "");
    $unitCode = $normalizeScopeValue($_GET["unit_code"] ?? $_GET["Unit_Code"] ?? "");
    $layoutKey = $normalizeScopeValue($_GET["layout_key"] ?? "ordering");

    $stmt = $conn->prepare("
        SELECT positions_json, groups_json, date_updated
        FROM tbl_pos_table_layout
        WHERE category_code = ?
          AND unit_code = ?
          AND layout_key = ?
        LIMIT 1
    ");

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Failed to prepare query"]);
        $conn->close();
        exit;
    }

    $stmt->bind_param("sss", $categoryCode, $unitCode, $layoutKey);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    echo json_encode([
        "status" => "success",
        "layout" => [
            "positions" => (object)$decodeJsonValue($row["positions_json"] ?? null, []),
            "groups" => $decodeJsonValue($row["groups_json"] ?? null, []),
            "date_updated" => $row["date_updated"] ?? null,
        ],
    ]);
    $conn->close();
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
    $conn->close();
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid JSON body"]);
    $conn->close();
    exit;
}

$categoryCode = $normalizeScopeValue($input["category_code"] ?? $input["Category_Code"] ?? "");
$unitCode = $normalizeScopeValue($input["unit_code"] ?? $input["Unit_Code"] ?? "");
$layoutKey = $normalizeScopeValue($input["layout_key"] ?? "ordering");
$positions = is_array($input["positions"] ?? null) ? $input["positions"] : [];
$groups = is_array($input["groups"] ?? null) ? $input["groups"] : [];

$positionsJson = json_encode($positions, JSON_UNESCAPED_UNICODE);
$groupsJson = json_encode($groups, JSON_UNESCAPED_UNICODE);

if ($positionsJson === false || $groupsJson === false) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid layout data"]);
    $conn->close();
    exit;
}

$stmt = $conn->prepare("
    INSERT INTO tbl_pos_table_layout (
        category_code,
        unit_code,
        layout_key,
        positions_json,
        groups_json
    ) VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        positions_json = VALUES(positions_json),
        groups_json = VALUES(groups_json),
        date_updated = NOW()
");

if (!$stmt) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to prepare save"]);
    $conn->close();
    exit;
}

$stmt->bind_param(
    "sssss",
    $categoryCode,
    $unitCode,
    $layoutKey,
    $positionsJson,
    $groupsJson
);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to save layout"]);
    $stmt->close();
    $conn->close();
    exit;
}

$stmt->close();

echo json_encode([
    "status" => "success",
    "message" => "Table layout saved",
]);

$conn->close();
?>
