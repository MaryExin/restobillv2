<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    $data = [];
}

$localDatabase = new Database(
    $_ENV['DB_HOST'],
    $_ENV['DB_NAME'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS']
);

$user_gateway = new UserGateway($localDatabase);
$codec = new JWTCodec($_ENV['SECRET_KEY']);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

$webDatabase = new Database(
    $_ENV['WEB_SYNC_DB_HOST'],
    $_ENV['WEB_SYNC_DB_NAME'],
    $_ENV['WEB_SYNC_DB_USER'],
    $_ENV['WEB_SYNC_DB_PASS']
);

$gateway = new RolesSyncMutateGateway($localDatabase, $webDatabase);
$controller = new RolesSyncMutateController($gateway, $user_id);
$controller->processRequest($method, $data);