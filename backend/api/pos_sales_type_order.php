<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

const SALES_TYPE_ORDER_CATEGORY = "SalesType";
const SALES_TYPE_ORDER_DESCRIPTION = "Sales Type Display Order";

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

function getSalesTypeOrderValue(PDO $pdo)
{
    $stmt = $pdo->prepare("
        SELECT `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":category" => SALES_TYPE_ORDER_CATEGORY,
        ":description" => SALES_TYPE_ORDER_DESCRIPTION,
    ]);

    $value = $stmt->fetchColumn();
    return $value === false ? null : $value;
}

function saveSalesTypeOrderValue(PDO $pdo, $value)
{
    $existingStmt = $pdo->prepare("
        SELECT ID
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $existingStmt->execute([
        ":category" => SALES_TYPE_ORDER_CATEGORY,
        ":description" => SALES_TYPE_ORDER_DESCRIPTION,
    ]);

    $existingId = $existingStmt->fetchColumn();

    if ($existingId) {
        $updateStmt = $pdo->prepare("
            UPDATE tbl_pos_settings
            SET `value` = :setting_value
            WHERE ID = :id
        ");
        $updateStmt->execute([
            ":setting_value" => $value,
            ":id" => (int)$existingId,
        ]);
        return;
    }

    $nextIdStmt = $pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings");
    $nextId = (int)$nextIdStmt->fetchColumn();

    $insertStmt = $pdo->prepare("
        INSERT INTO tbl_pos_settings (ID, category, description, `value`)
        VALUES (:id, :category, :description, :setting_value)
    ");
    $insertStmt->execute([
        ":id" => $nextId,
        ":category" => SALES_TYPE_ORDER_CATEGORY,
        ":description" => SALES_TYPE_ORDER_DESCRIPTION,
        ":setting_value" => $value,
    ]);
}

function fetchActiveSalesTypes(PDO $pdo)
{
    $stmt = $pdo->prepare("
        SELECT sales_type_id, description AS sales_type
        FROM lkp_sales_type
        WHERE deletestatus = 'Active'
        ORDER BY description ASC
    ");
    $stmt->execute();
    return $stmt->fetchAll();
}

function orderSalesTypes(array $salesTypes, array $savedOrder)
{
    $byId = [];
    foreach ($salesTypes as $row) {
        $byId[$row["sales_type_id"]] = $row;
    }

    $ordered = [];
    foreach ($savedOrder as $id) {
        if (isset($byId[$id])) {
            $ordered[] = $byId[$id];
            unset($byId[$id]);
        }
    }

    // Any active sales type not present in the saved order is appended
    // (keeps newly added sales types visible without needing re-configuration).
    foreach ($byId as $row) {
        $ordered[] = $row;
    }

    return $ordered;
}

try {
    $method = $_SERVER["REQUEST_METHOD"];
    $salesTypes = fetchActiveSalesTypes($pdo);

    $rawOrder = getSalesTypeOrderValue($pdo);
    $savedOrder = $rawOrder ? (json_decode($rawOrder, true) ?: []) : [];
    if (!is_array($savedOrder)) {
        $savedOrder = [];
    }

    if ($method === "GET") {
        respond(true, "Sales type order loaded.", [
            "sales_types" => orderSalesTypes($salesTypes, $savedOrder),
        ]);
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }

    $requestedOrder = isset($body["order"]) && is_array($body["order"])
        ? array_values(array_map("strval", $body["order"]))
        : [];

    // Only keep IDs that correspond to currently active sales types.
    $validIds = array_column($salesTypes, "sales_type_id");
    $newOrder = array_values(array_intersect($requestedOrder, $validIds));

    saveSalesTypeOrderValue($pdo, json_encode($newOrder));

    respond(true, "Sales type order saved.", [
        "sales_types" => orderSalesTypes($salesTypes, $newOrder),
    ]);
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
