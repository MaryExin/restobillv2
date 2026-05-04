<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    header('Allow: GET, POST');
    exit;
}

$raw = file_get_contents('php://input');
$decoded = json_decode($raw, true);

$data = $method === 'POST'
    ? (is_array($decoded) ? $decoded : $_POST)
    : $_GET;

$config = require __DIR__ . '/config.php';

$database = new Database(
    $config['host'] ?? 'localhost',
    $config['db'] ?? '',
    $config['user'] ?? '',
    $config['pass'] ?? '',
    $config['driver'] ?? 'sqlite',
    $config['sqlite_path'] ?? ''
);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($config['secret_key'] ?? ($_ENV['SECRET_KEY'] ?? 'SECRET'));
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

$gateway = new ProductSyncLocalReadGateway($database);
$controller = new ProductSyncLocalReadController($gateway, $user_id);
$controller->processRequest($method, $data);