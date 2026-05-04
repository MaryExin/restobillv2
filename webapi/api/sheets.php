<?php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json; charset=utf-8");
session_start();

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth  = new Auth($user_gateway, $codec);

// Method of auth checking if token is invalid signature or expired
if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

/**
 * 2) READ INPUT from React
 */
$raw = file_get_contents("php://input");
$req = json_decode($raw, true);

if (!is_array($req)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Invalid JSON"]);
    exit;
}

$action      = $req["action"] ?? null;
$payload     = $req["payload"] ?? [];
$gasEndpoint = $req["gasEndpoint"] ?? null;

if (!$action) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing action"]);
    exit;
}

/**
 * 3) GAS URL (Dynamic from React BUT validated)
 */
if (!is_string($gasEndpoint) || trim($gasEndpoint) === "") {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing gasEndpoint"]);
    exit;
}

$gasEndpoint = trim($gasEndpoint);

if (!filter_var($gasEndpoint, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Invalid gasEndpoint URL"]);
    exit;
}

$host = parse_url($gasEndpoint, PHP_URL_HOST);
if ($host !== "script.google.com") {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "gasEndpoint host not allowed"]);
    exit;
}

$GAS_URL = $gasEndpoint;

// Keep secret token in PHP
$GAS_TOKEN = "b8K2vQ7mR4pX8nT1aD6zH3wJ0cE5yB2gL7uS9dN1qV8kP4xM6rC2tA9hZ3jG5";

$postBody = json_encode([
    "token"   => $GAS_TOKEN,
    "action"  => $action,
    "payload" => $payload,
    "user"    => [
        "id"    => $user_id,
        "email" => $_SESSION["email"] ?? null
    ]
]);

$ch = curl_init($GAS_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => ["Content-Type: application/json", "Accept: application/json"],
    CURLOPT_POSTFIELDS     => $postBody,
    CURLOPT_TIMEOUT        => 20,

    // Follow redirects (useful for some environments)
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
]);

$response = curl_exec($ch);
$err      = curl_error($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(["ok" => false, "error" => "cURL error: " . $err]);
    exit;
}

// Return GAS response to React
http_response_code($httpcode ?: 200);
echo $response;
