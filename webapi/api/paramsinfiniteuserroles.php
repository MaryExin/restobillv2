<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

/**
 * Allow:
 * - OPTIONS (for CORS preflight)
 * - POST (preferred, matches useSecuredMutation)
 * - GET (optional fallback for old clients)
 */
$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

if ($method === "OPTIONS") {
    http_response_code(204);
    exit;
}

if (!in_array($method, ["POST", "GET"], true)) {
    http_response_code(405);
    header("Allow: POST, GET, OPTIONS");
    echo json_encode(["message" => "Method Not Allowed"]);
    exit;
}

/* -------------------------
 * Read incoming params
 * ------------------------- */
$search = "";

if ($method === "POST") {
    // Try JSON body first
    $raw = file_get_contents("php://input");
    $json = json_decode($raw ?: "{}", true);

    if (json_last_error() === JSON_ERROR_NONE && is_array($json)) {
        $search = isset($json["search"]) ? trim((string)$json["search"]) : "";
    } else {
        // Fallback if request is form-encoded multipart/x-www-form-urlencoded
        $search = isset($_POST["search"]) ? trim((string)$_POST["search"]) : "";
    }
} else {
    // GET fallback
    $search = isset($_GET["search"]) ? trim((string)$_GET["search"]) : "";
}

/* -------------------------
 * Init dependencies
 * ------------------------- */
$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

// if (!$auth->authenticateAccessToken()) {
//     exit;
// }

$user_id = $auth->getUserID() ?? 123;

$gateway = new UserRoleGateway($database);
$controller = new UserRoleController($gateway, $user_id);

/* -------------------------
 * Process request
 * Your controller should call getInfiniteData($search)
 * ------------------------- */
$controller->processInfiniteRequest($method, $search);