<?php
// userplanexpiry.php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

// ✅ Read JSON body safely (POST/PATCH/PUT usually)
// GET normally has no body.
$raw = file_get_contents("php://input");
$decoded = null;

if (is_string($raw) && trim($raw) !== "") {
    $decoded = json_decode($raw, true);
}

// ✅ If JSON decode fails, fallback to empty array (avoid warnings)
$data = is_array($decoded) ? $decoded : [];

// ✅ Optional: include query params for GET (or for any method)
if (!empty($_GET) && is_array($_GET)) {
    // do not overwrite body keys; GET fills only missing keys
    foreach ($_GET as $k => $v) {
        if (!array_key_exists($k, $data)) $data[$k] = $v;
    }
}

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth  = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = (string)$auth->getUserID();

$gateway = new UserPlanExpiryGateway($database);
$controller = new UserPlanExpiryController($gateway, $user_id);

$controller->processRequest($method, $data);
