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

$gateway = new InventoryStockStatusGateway($database);
$controller = new InventoryStockStatusController($gateway, $user_id);

// ✅ Supports: GET (all), POST (read by BU), PATCH (upsert status)
$controller->processRequest($_SERVER["REQUEST_METHOD"], $data);
