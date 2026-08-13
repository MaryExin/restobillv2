<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";
require_once __DIR__ . "/pos_developer_auth.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);
    header("Allow: POST");
    exit;
}

$data = (array) json_decode(file_get_contents("php://input"), true);

if (!array_key_exists("token", $data)) {

    http_response_code(400);
    echo json_encode(["message" => "missing token"]);
    exit;
}

$codec = new JWTCodec($_ENV["SECRET_KEY"]);

try {
    $payload = $codec->decode($data["token"]);

} catch (Exception $e) {

    http_response_code(400);
    echo json_encode(["message" => "invalid token"]);
    exit;
}

$user_id = trim((string)($payload["sub"] ?? ""));
$requestedDeveloperSession =
    ($payload["pos_developer_mode"] ?? false) === true;
$isDeveloperSession = posDeveloperFullAccessTokenIsValid($payload);

if (
    $user_id === "" ||
    (isset($payload["token_type"]) && $payload["token_type"] !== "refresh") ||
    ($requestedDeveloperSession && !$isDeveloperSession)
) {
    http_response_code(401);
    echo json_encode(["message" => "invalid refresh token"]);
    exit;
}

$database = new Database($_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]);

$refresh_token_gateway = new RefreshTokenGateway($database, $_ENV["SECRET_KEY"]);

$refresh_token = $refresh_token_gateway->getByToken($data["token"]);

if ($refresh_token === false) {

    http_response_code(400);
    echo json_encode(["message" => "invalid token (not on whitelist)"]);
    exit;
}

$user_gateway = new UserGateway($database);

$user = $isDeveloperSession
    ? posDeveloperVirtualUser()
    : $user_gateway->getByID($user_id);

if ($user === false) {

    http_response_code(401);
    echo json_encode(["message" => "invalid authentication"]);
    exit;
}

require __DIR__ . "/tokens.php";

$refresh_token_gateway->delete($data["token"]);

$refresh_token_gateway->create($refresh_token, $refresh_token_expiry);

echo json_encode([
    "access_token" => $access_token,
    "refresh_token" => $refresh_token,
    "is_developer_mode" => $isDeveloperSession,
]);
