<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

const LAYOUT_CATEGORY    = "Layout";
const LAYOUT_DESCRIPTION = "Layout Mode";
const LAYOUT_FALLBACK_DESCRIPTION = "Screen Configuration";
const LAYOUT_DEFAULT_CONTEXT = "resto";
const LAYOUT_CONTEXT_TO_MODE = [
    "resto" => "Restaurant",
    "restaurant" => "Restaurant",
    "kiosk" => "Kiosk",
    "resto_v2" => "Restaurant Version 2",
    "restaurant_v2" => "Restaurant Version 2",
];

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit;
}

function normalizeLayoutContext(string $value): string
{
    $normalized = strtolower(trim($value));

    if ($normalized === "restaurant") {
        return "resto";
    }

    if ($normalized === "kiosk") {
        return "kiosk";
    }

    if ($normalized === "resto") {
        return "resto";
    }

    if ($normalized === "restaurant version 2" || $normalized === "restaurant_v2" || $normalized === "resto_v2") {
        return "resto_v2";
    }

    return "";
}

function contextToLayoutMode(string $context): string
{
    return LAYOUT_CONTEXT_TO_MODE[$context] ?? "Restaurant";
}

function readLayoutContext(PDO $pdo): string
{
    $stmt = $pdo->prepare("
        SELECT `value` FROM tbl_pos_settings
        WHERE description IN (:layout_description, :fallback_description)
        ORDER BY CASE WHEN description = :layout_description_sort THEN 0 ELSE 1 END, ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":layout_description" => LAYOUT_DESCRIPTION,
        ":fallback_description" => LAYOUT_FALLBACK_DESCRIPTION,
        ":layout_description_sort" => LAYOUT_DESCRIPTION,
    ]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $context = normalizeLayoutContext((string)($row["value"] ?? LAYOUT_DEFAULT_CONTEXT));
    return $context !== "" ? $context : LAYOUT_DEFAULT_CONTEXT;
}

function saveLayoutContext(PDO $pdo, string $context): void
{
    $existingStmt = $pdo->prepare("
        SELECT ID FROM tbl_pos_settings
        WHERE description IN (:layout_description, :fallback_description)
        ORDER BY CASE WHEN description = :layout_description_sort THEN 0 ELSE 1 END, ID DESC
        LIMIT 1
    ");
    $existingStmt->execute([
        ":layout_description" => LAYOUT_DESCRIPTION,
        ":fallback_description" => LAYOUT_FALLBACK_DESCRIPTION,
        ":layout_description_sort" => LAYOUT_DESCRIPTION,
    ]);
    $existingId = $existingStmt->fetchColumn();

    if ($existingId) {
        $pdo->prepare("
            UPDATE tbl_pos_settings
            SET `value` = :value
            WHERE description = 'Layout Mode' OR ID = :id
        ")->execute([":value" => $context, ":id" => (int)$existingId]);
    } else {
        $nextId = (int)$pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings")->fetchColumn();
        $pdo->prepare("INSERT INTO tbl_pos_settings (ID, category, description, `value`) VALUES (:id, :cat, :desc, :v)")
            ->execute([":id" => $nextId, ":cat" => LAYOUT_CATEGORY, ":desc" => LAYOUT_DESCRIPTION, ":v" => $context]);
    }
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        $context = readLayoutContext($pdo);
        respond(true, "Layout mode loaded.", [
            "layout_context" => $context,
            "layout_mode" => contextToLayoutMode($context),
            "value" => $context,
        ]);
    }

    if ($method === "POST") {
        $body = json_decode(file_get_contents("php://input"), true) ?? [];
        $context = normalizeLayoutContext((string)($body["layout_context"] ?? $body["layout_mode"] ?? ""));

        if ($context === "") {
            respond(false, "Invalid layout mode. Accepted: resto, kiosk, resto_v2, Restaurant, Kiosk, Restaurant Version 2.", null, 422);
        }

        saveLayoutContext($pdo, $context);
        respond(true, "Layout mode saved.", [
            "layout_context" => $context,
            "layout_mode" => contextToLayoutMode($context),
            "value" => $context,
        ]);
    }

    respond(false, "Method not allowed.", null, 405);

} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
