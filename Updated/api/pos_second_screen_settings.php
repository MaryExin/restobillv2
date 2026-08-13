<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$method = $_SERVER["REQUEST_METHOD"];
$requiresMutationAuthorization = $method === "POST";
if ($requiresMutationAuthorization) {
    require __DIR__ . "/secure_guard.php";
}

require __DIR__ . "/pdo.php";
if ($requiresMutationAuthorization) {
    require_once __DIR__ . "/pos_role_authorization.php";
}

const SS_SETTING_KEY = "announcement";
const SS_DEFAULT     = "Welcome to our store! Happy to serve you.";

function respond($success, $message, $data = null, $code = 200)
{
    http_response_code($code);
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit;
}

function readAnnouncement(PDO $pdo): string
{
    $stmt = $pdo->prepare("
        SELECT setting_value FROM pos_settings
        WHERE setting_key = :setting_key
        ORDER BY id DESC LIMIT 1
    ");
    $stmt->execute([":setting_key" => SS_SETTING_KEY]);
    return $stmt->fetchColumn() ?: SS_DEFAULT;
}

function saveAnnouncement(PDO $pdo, string $text): void
{
    $update = $pdo->prepare("
        UPDATE pos_settings
        SET setting_value = ?
        WHERE setting_key = 'announcement'
    ");
    $update->execute([$text]);

    if ($update->rowCount() < 1) {
        $insert = $pdo->prepare("
            INSERT INTO pos_settings (setting_key, setting_value)
            VALUES ('announcement', ?)
        ");
        $insert->execute([$text]);
    }
}

try {
    // ── GET: read announcement ────────────────────────────────────────────────
    if ($method === "GET") {
        respond(true, "OK.", ["announcement" => readAnnouncement($pdo)]);
    }

    if ($method === "POST") {

        // ── QR code upload (multipart with qr_image + mop_name) ─────────────
        if (!empty($_FILES["qr_image"])) {
            posRoleAuthRequirePermission(
                $pdo,
                (string)($GLOBALS["pos_user_id"] ?? ""),
                "settings",
                "modeOfPayment"
            );

            $file    = $_FILES["qr_image"];
            $mopName = trim((string)($_POST["mop_name"] ?? ""));

            if ($file["error"] !== UPLOAD_ERR_OK) {
                respond(false, "Upload error code: " . $file["error"], null, 422);
            }
            if ($mopName === "") {
                respond(false, "mop_name is required.", null, 422);
            }

            $safeName = preg_replace('/[^A-Z0-9_]/', '', strtoupper(str_replace(' ', '_', $mopName)));
            if ($safeName === "") {
                respond(false, "Invalid mop_name after sanitization.", null, 422);
            }

            $targetDir = rtrim($_SERVER["DOCUMENT_ROOT"], "/\\") . "/pos_second_screen/";
            if (!is_dir($targetDir)) {
                mkdir($targetDir, 0755, true);
            }

            $targetPath = $targetDir . $safeName . "_QR.png";

            if (!move_uploaded_file($file["tmp_name"], $targetPath)) {
                respond(false, "Failed to save QR image to server.", null, 500);
            }

            respond(true, "QR code saved as {$safeName}_QR.png.", ["filename" => $safeName . "_QR.png"]);
        }

        // ── Display image upload (multipart with display_image) ───────────
        if (!empty($_FILES["display_image"])) {
            posRoleAuthRequirePermission(
                $pdo,
                (string)($GLOBALS["pos_user_id"] ?? ""),
                "settings",
                "secondScreen"
            );

            $file = $_FILES["display_image"];

            if ($file["error"] !== UPLOAD_ERR_OK) {
                respond(false, "Upload error code: " . $file["error"], null, 422);
            }

            $maxBytes = 10 * 1024 * 1024; // 10 MB
            if ($file["size"] > $maxBytes) {
                respond(false, "Image must be under 10 MB.", null, 422);
            }

            $targetDir = rtrim($_SERVER["DOCUMENT_ROOT"], "/\\") . "/pos_second_screen/";
            if (!is_dir($targetDir)) {
                mkdir($targetDir, 0755, true);
            }

            $targetPath = $targetDir . "display.jpg";

            if (!move_uploaded_file($file["tmp_name"], $targetPath)) {
                respond(false, "Failed to save image to server.", null, 500);
            }

            respond(true, "Display image updated successfully.", ["filename" => "display.jpg"]);
        }

        // ── Announcement save (JSON) ──────────────────────────────────────────
        $body = json_decode(file_get_contents("php://input"), true) ?? [];
        if (isset($body["announcement"])) {
            posRoleAuthRequirePermission(
                $pdo,
                (string)($GLOBALS["pos_user_id"] ?? ""),
                "settings",
                "secondScreen"
            );

            $text = trim((string)$body["announcement"]);
            if (mb_strlen($text) > 500) {
                respond(false, "Announcement must be 500 characters or less.", null, 422);
            }
            saveAnnouncement($pdo, $text);
            respond(true, "Announcement saved.", ["announcement" => $text]);
        }

        respond(false, "No recognized action in POST body.", null, 400);
    }

    respond(false, "Method not allowed.", null, 405);

} catch (Throwable $e) {
    error_log("POS second screen settings error: " . $e->getMessage());
    respond(false, "Unable to process second screen settings.", null, 500);
}
