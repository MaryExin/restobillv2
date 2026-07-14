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

const DISCOUNT_MODE_CATEGORY    = "Discount";
const DISCOUNT_MODE_DESCRIPTION = "Discount Mode";
const DISCOUNT_MODE_DEFAULT     = "PerCustomer";

function upsertSetting(PDO $pdo, string $category, string $description, string $value): void
{
    $stmt = $pdo->prepare("
        SELECT ID FROM tbl_pos_settings
        WHERE category = :cat AND description = :desc
        ORDER BY ID DESC LIMIT 1
    ");
    $stmt->execute([":cat" => $category, ":desc" => $description]);
    $existingId = $stmt->fetchColumn();

    if ($existingId) {
        $pdo->prepare("UPDATE tbl_pos_settings SET `value` = :v WHERE ID = :id")
            ->execute([":v" => $value, ":id" => (int)$existingId]);
    } else {
        $nextId = (int)$pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings")->fetchColumn();
        $pdo->prepare("INSERT INTO tbl_pos_settings (ID, category, description, `value`) VALUES (:id, :cat, :desc, :v)")
            ->execute([":id" => $nextId, ":cat" => $category, ":desc" => $description, ":v" => $value]);
    }
}

function readDiscountMode(PDO $pdo): string
{
    $stmt = $pdo->prepare("
        SELECT `value` FROM tbl_pos_settings
        WHERE category = :cat AND description = :desc
        ORDER BY ID DESC LIMIT 1
    ");
    $stmt->execute([":cat" => DISCOUNT_MODE_CATEGORY, ":desc" => DISCOUNT_MODE_DESCRIPTION]);
    $val = trim((string)($stmt->fetchColumn() ?: ""));
    return in_array($val, ["PerCustomer", "PerProduct"]) ? $val : DISCOUNT_MODE_DEFAULT;
}

function respond(bool $success, string $message, ?array $data = null, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit;
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "OK", ["discount_mode" => readDiscountMode($pdo)]);
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $body = json_decode(file_get_contents("php://input"), true) ?: [];
    $mode = trim((string)($body["discount_mode"] ?? ""));

    if (!in_array($mode, ["PerCustomer", "PerProduct"])) {
        respond(false, "Invalid discount_mode. Must be PerCustomer or PerProduct.", null, 400);
    }

    upsertSetting($pdo, DISCOUNT_MODE_CATEGORY, DISCOUNT_MODE_DESCRIPTION, $mode);
    respond(true, "Discount mode saved.", ["discount_mode" => $mode]);

} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
