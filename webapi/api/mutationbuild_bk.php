<?php
declare(strict_types=1);
require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json");

// 1) Try JSON body (works for application/json)
$raw = file_get_contents("php://input");
$decoded = null;

if (is_string($raw) && trim($raw) !== "") {
    $decoded = json_decode($raw, true);
}
$data = is_array($decoded) ? $decoded : [];

// 2) Merge multipart/form-data fields (works for FormData)
if (!empty($_POST)) {
    // $_POST should override JSON if same keys exist
    $data = array_merge($data, $_POST);
}

// Optional: include files in a known key if your controller/gateway needs it
// (or just use $_FILES directly inside controller/gateway)
$data["_files"] = $_FILES ?? [];

// ✅ Safe action getter (supports Action / action)
$action = $data["Action"] ?? $data["action"] ?? null;

if (!$action) {
    http_response_code(400);
    echo json_encode([
        "message" => "missingAction",
        "hint" => "Send Action in JSON body or FormData. For FormData, it is in \$_POST['Action']."
    ]);
    exit;
}

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) exit;

$user_id = $auth->getUserID();

$gateway = new BuildGateway($database);
$controller = new BuildController($gateway, $user_id);

// ✅ Route by action (now safe)
if ($action === "multiadd") {
    $controller->multiprocessRequest($_SERVER["REQUEST_METHOD"], $data);
} else {
    $controller->processRequest($_SERVER["REQUEST_METHOD"], $data);
}
