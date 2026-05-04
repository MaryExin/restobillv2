<?php

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    http_response_code(405);
    header('Allow: GET, POST');
    exit;
}

$data = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = (array) json_decode(file_get_contents('php://input'), true);
} else {
    $data = $_GET;
}

$database = new Database(
    $_ENV['DB_HOST'],
    $_ENV['DB_NAME'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS']
);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV['SECRET_KEY']);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

$gateway = new PricingBySalesTypePerBUGateway($database);
$controller = new PricingBySalesTypePerBUController($gateway, $user_id);
$controller->processRequest($_SERVER['REQUEST_METHOD'], $data);