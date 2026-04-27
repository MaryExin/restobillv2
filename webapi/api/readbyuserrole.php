<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

// CORS
$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json; charset=utf-8");

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

// This endpoint is read-only; allow GET and POST for backwards compatibility.
if ($method !== "GET" && $method !== "POST") {
    http_response_code(405);
    header("Allow: GET, POST");
    exit;
}

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"],
);

// Initialize connection var $conn, methods: getByUsername, getById
$user_gateway = new UserGateway($database);

// Initialize JWT Token with methods: encode, decode
$codec = new JWTCodec($_ENV["SECRET_KEY"]);

// Initialize Auth, methods: authenticateAccessToken, getUserID
$auth = new Auth($user_gateway, $codec);

// Method of auth checking if token is invalid signature or expired
if (!$auth->authenticateAccessToken()) {
    // Auth class should set proper status codes; default to 401 if not.
    if (http_response_code() === 200) {
        http_response_code(401);
    }
    echo json_encode(["message" => "Unauthorized"]);
    exit;
}

$userId = $auth->getUserID();

// Initialize Task Database CRUD
$gateway = new UserRoleByUserGateway($database);

// Initialize Task Controller to process API Requests
$controller = new UserRoleByUserController($gateway, $userId);

$controller->processRequest($method);
