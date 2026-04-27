<?php
// planapprovals.php ✅ Admin approve plan requests (For Review -> Active)
// - GET: list For Review Plan rows
// - POST: approve selected ids
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json");

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

// Read JSON body safely
$raw = file_get_contents("php://input");
$decoded = null;
if (is_string($raw) && trim($raw) !== "") $decoded = json_decode($raw, true);
$data = is_array($decoded) ? $decoded : [];

// Allow query string (?q=)
if (!empty($_GET) && is_array($_GET)) {
    foreach ($_GET as $k => $v) {
        if (!array_key_exists($k, $data)) $data[$k] = $v;
    }
}

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);
$user_gateway = new UserGateway($database);

$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) exit;

$user_id = $auth->getUserID();

// ✅ NEW gateway + controller
$gateway = new PlanApprovalGateway($database);
$controller = new PlanApprovalController($gateway, (string)$user_id);

$controller->processRequest($method, $data);
