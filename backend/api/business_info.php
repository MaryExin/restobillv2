<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    require __DIR__ . "/secure_guard.php";
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    posRoleAuthRequirePermission(
        $pdo,
        (string)($GLOBALS["pos_user_id"] ?? ""),
        "settings",
        "dataSecurity"
    );
}

const BUSINESS_INFO_CATEGORY = "BusinessInfo";

const BUSINESS_INFO_FIELDS = [
    "companyName",
    "storeName",
    "corpName",
    "address",
    "tin",
    "machineNumber",
    "serialNumber",
    "terminalId",
    "posProviderName",
    "posProviderAddress",
    "posProviderTin",
    "posProviderBirAccreNo",
    "posProviderAccreDateIssued",
    "posProviderPTUNo",
    "posProviderPTUDateIssued",
    "receiptFooter",
];

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit;
}

function readBusinessInfo(PDO $pdo): array
{
    $stmt = $pdo->prepare("
        SELECT description, `value` FROM tbl_pos_settings
        WHERE category = :category
        ORDER BY ID ASC
    ");
    $stmt->execute([":category" => BUSINESS_INFO_CATEGORY]);
    $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $result = [];
    foreach (BUSINESS_INFO_FIELDS as $field) {
        $result[$field] = (string)($rows[$field] ?? "");
    }

    return $result;
}

function saveBusinessInfoField(PDO $pdo, string $field, string $value): void
{
    $existingStmt = $pdo->prepare("
        SELECT ID FROM tbl_pos_settings
        WHERE category = :category AND description = :description
        ORDER BY ID DESC LIMIT 1
    ");
    $existingStmt->execute([":category" => BUSINESS_INFO_CATEGORY, ":description" => $field]);
    $existingId = $existingStmt->fetchColumn();

    if ($existingId) {
        $pdo->prepare("UPDATE tbl_pos_settings SET `value` = :v WHERE ID = :id")
            ->execute([":v" => $value, ":id" => (int)$existingId]);
    } else {
        $nextId = (int)$pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings")->fetchColumn();
        $pdo->prepare("INSERT INTO tbl_pos_settings (ID, category, description, `value`) VALUES (:id, :cat, :desc, :v)")
            ->execute([":id" => $nextId, ":cat" => BUSINESS_INFO_CATEGORY, ":desc" => $field, ":v" => $value]);
    }
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "Business info loaded.", readBusinessInfo($pdo));
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $body = json_decode(file_get_contents("php://input"), true) ?? [];

    if (!is_array($body) || empty($body)) {
        respond(false, "No business info provided.", null, 400);
    }

    if (array_key_exists("companyName", $body) && trim((string)$body["companyName"]) === "") {
        respond(false, "Company Name is required.", null, 422);
    }

    foreach (BUSINESS_INFO_FIELDS as $field) {
        if (array_key_exists($field, $body)) {
            saveBusinessInfoField($pdo, $field, trim((string)$body[$field]));
        }
    }

    respond(true, "Business info saved.", readBusinessInfo($pdo));
} catch (Throwable $e) {
    error_log("Business info settings error: " . $e->getMessage());
    respond(false, "Unable to process business info.", null, 500);
}
