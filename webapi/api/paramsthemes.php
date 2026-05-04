<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    header("Allow: GET");

    exit;

}

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

// Initialize connection var $conn, methods: getByUsername, getById

$user_gateway = new UserGateway($database);

//Initialize JWT Token with methods: encode, decode

$codec = new JWTCodec($_ENV["SECRET_KEY"]);

//Initialize Auth, methods: authenticateAccessToken, getUserID

$auth = new Auth($user_gateway, $codec);

//Method of auth checking if token is invalid signature or expired

if (!$auth->authenticateAccessToken()) {

    exit;

}

$user_id = $auth->getUserID();

//Initialize Task Database CRUD

$gateway = new ThemeSettingsGateway($database);

//Initialize Task Controller to process API Requests

$controller = new ThemeSettingsController($gateway, $user_id);

$controller->processRequest($_SERVER['REQUEST_METHOD'], $user_id);
