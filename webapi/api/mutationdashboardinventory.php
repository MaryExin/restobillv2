<?php
// dashboardinventory.php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json");

if (($_SERVER["REQUEST_METHOD"] ?? "GET") !== "POST") {
    http_response_code(405);
    header("Allow: POST");
    echo json_encode(["message" => "methodNotAllowed"]);
    exit;
}

// ✅ Read JSON body safely
$raw = file_get_contents("php://input");
$decoded = null;

if (is_string($raw) && trim($raw) !== "") {
    $decoded = json_decode($raw, true);
}

$data = is_array($decoded) ? $decoded : [];

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

// ✅ Auth
$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

// ✅ Gateway + Controller
$gateway = new DashboardInventoryGateway($database);
$controller = new DashboardInventoryController($gateway, $user_id);

$controller->processRequest("POST", $data);
