<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

$data = (array) json_decode(file_get_contents("php://input"), true);

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

$gateway = new AccountingFileLinksGateway($database);
$controller = new AccountingFileLinksController($gateway, $user_id);

/**
 * Suggested usage:
 *
 * GET
 * - read all active links
 *
 * POST
 * - save/update file link
 * payload:
 *   {
 *     "reference": "DV-123",
 *     "link": "https://...."
 *   }
 *
 * POST with action=read in payload
 * - read one reference or many references
 * payload:
 *   {
 *     "action": "read",
 *     "reference": "DV-123"
 *   }
 *
 * or:
 *   {
 *     "action": "read",
 *     "references": ["DV-123", "DV-124"]
 *   }
 */

$controller->processRequest($_SERVER["REQUEST_METHOD"], $data);