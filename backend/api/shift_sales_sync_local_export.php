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

$data = (array) json_decode(file_get_contents('php://input'), true);

$config = require __DIR__ . '/config.php';
$primaryDatabaseName = trim((string) ($config['db'] ?? ''));
$reportDatabaseName = trim((string) ($config['report_db'] ?? ''));

foreach ([$primaryDatabaseName, $reportDatabaseName] as $databaseName) {
    if ($databaseName === '' || !preg_match('/^[A-Za-z0-9_]+$/', $databaseName)) {
        http_response_code(500);
        echo json_encode(['message' => 'InvalidDatabaseConfig']);
        exit;
    }
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

$user_id = $auth->getUserID();

$gateway = new ShiftSalesSyncLocalExportGateway(
    $sourceDatabase,
    $primaryDatabaseName,
    $reportDatabaseName
);
$controller = new ShiftSalesSyncLocalExportController($gateway, $user_id);
$controller->processRequest($method, $data);
