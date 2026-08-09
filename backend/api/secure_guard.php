<?php

/**
 * Shared secured-endpoint guard (tablet migration).
 *
 * Include FIRST in a converted endpoint:
 *   require __DIR__ . '/secure_guard.php';
 *
 * Runs, in order:
 *   1. bootstrap.php  — Composer autoload + Dotenv (.env) + JSON content-type
 *   2. CorsPolicy     — reflective CORS; handles and exits on OPTIONS preflight
 *   3. Bearer JWT     — validates the Authorization: Bearer <access_token>
 *
 * On success, $pos_user_id holds the authenticated user id (the JWT `sub`).
 * On failure, Auth has already emitted a 400/401 JSON error and this script
 * exits before returning to the caller.
 *
 * IMPORTANT: JWT validation is signature-only and does not need a database
 * gateway. Endpoints load their own PDO/config after this guard, then perform
 * the account-status and permission checks appropriate to that operation.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/pos_developer_auth.php';

(new CorsPolicy())->cors();

$__guardEnv = static function (string $key, $default) {
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return $_ENV[$key];
    }
    $fromGetenv = getenv($key);
    if ($fromGetenv !== false && $fromGetenv !== '') {
        return $fromGetenv;
    }
    return $default;
};

$__guardAuthorization = trim((string)(
    $_SERVER['HTTP_AUTHORIZATION'] ??
    $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ??
    ''
));

if ($__guardAuthorization === '' && function_exists('getallheaders')) {
    foreach ((array)getallheaders() as $__guardHeaderName => $__guardHeaderValue) {
        if (strcasecmp((string)$__guardHeaderName, 'Authorization') === 0) {
            $__guardAuthorization = trim((string)$__guardHeaderValue);
            break;
        }
    }
}

if ($__guardAuthorization === '') {
    http_response_code(400);
    echo json_encode(["message" => "incomplete authorization header"]);
    exit;
}

$_SERVER['HTTP_AUTHORIZATION'] = $__guardAuthorization;

$__guardCodec = new JWTCodec($__guardEnv('SECRET_KEY', ''));

$__guardAuth = new Auth(null, $__guardCodec);

if (!$__guardAuth->authenticateAccessToken()) {
    exit;
}

$pos_user_id = $__guardAuth->getUserID();
$__guardTokenData = $__guardAuth->getTokenData();
$__guardRequestedDeveloperMode =
    ($__guardTokenData['pos_developer_mode'] ?? false) === true;
$pos_developer_mode = posDeveloperFullAccessTokenIsValid($__guardTokenData);

if ($__guardRequestedDeveloperMode && !$pos_developer_mode) {
    http_response_code(401);
    echo json_encode(["message" => "developer session is disabled"]);
    exit;
}
