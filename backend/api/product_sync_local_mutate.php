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

if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$raw = file_get_contents('php://input');
$decoded = json_decode($raw, true);
$data = is_array($decoded) ? $decoded : [];

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

$gateway = new ProductSyncLocalMutateGateway($database);
$controller = new ProductSyncLocalMutateController($gateway, $user_id);
$controller->processRequest($method, $data);