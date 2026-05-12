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

const DISCOUNT_CEILING_CATEGORY = "Discount";
const DISCOUNT_CEILING_DESCRIPTION = "Discount Ceiling Amount";

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

function normalizeMoney($value)
{
    $amount = (float)($value ?? 0);
    if (!is_finite($amount) || $amount < 0) {
        return 0.00;
    }

    return round($amount, 2);
}

function readDiscountCeiling(PDO $pdo)
{
    $stmt = $pdo->prepare("
        SELECT ID, category, description, `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":category" => DISCOUNT_CEILING_CATEGORY,
        ":description" => DISCOUNT_CEILING_DESCRIPTION,
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $amount = normalizeMoney($row["value"] ?? 0);

    return [
        "id" => isset($row["ID"]) ? (int)$row["ID"] : null,
        "category" => DISCOUNT_CEILING_CATEGORY,
        "description" => DISCOUNT_CEILING_DESCRIPTION,
        "discount_ceiling" => $amount,
    ];
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "Discount ceiling loaded.", readDiscountCeiling($pdo));
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }

    $discountCeiling = normalizeMoney($body["discount_ceiling"] ?? 0);

    $existingStmt = $pdo->prepare("
        SELECT ID
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $existingStmt->execute([
        ":category" => DISCOUNT_CEILING_CATEGORY,
        ":description" => DISCOUNT_CEILING_DESCRIPTION,
    ]);

    $existingId = $existingStmt->fetchColumn();

    if ($existingId) {
        $updateStmt = $pdo->prepare("
            UPDATE tbl_pos_settings
            SET `value` = :setting_value
            WHERE ID = :id
        ");
        $updateStmt->execute([
            ":setting_value" => number_format($discountCeiling, 2, ".", ""),
            ":id" => (int)$existingId,
        ]);
    } else {
        $nextIdStmt = $pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings");
        $nextId = (int)$nextIdStmt->fetchColumn();

        $insertStmt = $pdo->prepare("
            INSERT INTO tbl_pos_settings (ID, category, description, `value`)
            VALUES (:id, :category, :description, :setting_value)
        ");
        $insertStmt->execute([
            ":id" => $nextId,
            ":category" => DISCOUNT_CEILING_CATEGORY,
            ":description" => DISCOUNT_CEILING_DESCRIPTION,
            ":setting_value" => number_format($discountCeiling, 2, ".", ""),
        ]);
    }

    respond(true, "Discount ceiling saved.", readDiscountCeiling($pdo));
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
