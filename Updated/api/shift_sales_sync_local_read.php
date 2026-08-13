<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/pos_sync_account_guard.php';

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    header('Allow: GET, POST');
    exit;
}

$data = $method === 'POST'
    ? (array) json_decode(file_get_contents('php://input'), true)
    : $_GET;

$config = require __DIR__ . '/config.php';
$primaryDatabaseName = trim((string) ($config['db'] ?? ''));

if ($primaryDatabaseName === '' || !preg_match('/^[A-Za-z0-9_]+$/', $primaryDatabaseName)) {
    http_response_code(500);
    echo json_encode(['message' => 'InvalidDatabaseConfig']);
    exit;
}

$authDatabase = new Database(
    $_ENV['DB_HOST'],
    $_ENV['DB_NAME'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS']
);
$sourceDatabase = new Database(
    $config['host'],
    $primaryDatabaseName,
    $config['user'],
    $config['pass']
);

$user_gateway = new UserGateway($authDatabase);
$codec = new JWTCodec($_ENV['SECRET_KEY']);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

posSyncRequireDedicatedAccount($auth);

$user_id = $auth->getUserID();

$gateway = new ShiftSalesSyncLocalReadGateway($sourceDatabase);
$controller = new ShiftSalesSyncLocalReadController($gateway, $user_id);
$controller->processRequest($method, $data);
