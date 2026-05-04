<?php
// pricing_endpoint.php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}
$user_id = $auth->getUserID();

$gateway = new PricingGateway($database);
$controller = new PricingController($gateway, $user_id);

/**
 * ✅ Hybrid body parser:
 * - JSON body for normal POST/PATCH
 * - multipart/form-data for batch upload (FormData)
 */
function parseHybridBody(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';

    if (stripos($contentType, 'multipart/form-data') !== false) {
        $data = $_POST ?? [];

        // decode JSON string fields safely
        foreach (["multiproduct", "imageMap"] as $k) {
            if (isset($data[$k]) && is_string($data[$k])) {
                $decoded = json_decode($data[$k], true);
                if (json_last_error() === JSON_ERROR_NONE) $data[$k] = $decoded;
            }
        }

        return $data;
    }

    // Default: JSON
    $raw = file_get_contents("php://input");
    $decoded = json_decode($raw ?: "{}", true);
    return is_array($decoded) ? $decoded : [];
}

$data = parseHybridBody();

$controller->processRequest($_SERVER['REQUEST_METHOD'], $data);
