<?php

declare(strict_types=1);

/**
 * Authentication guard used only by the POS role-access endpoint.
 *
 * Ordinary signed access tokens may read the matrix so the POS can enforce
 * navigation permissions. The private Developer access token may also pass
 * this guard and is the only identity allowed to mutate the matrix.
 */

require_once __DIR__ . "/bootstrap.php";
require_once __DIR__ . "/pos_developer_auth.php";

(new CorsPolicy())->cors();

$roleAccessAuthorization = trim((string)(
    $_SERVER["HTTP_AUTHORIZATION"] ??
    $_SERVER["REDIRECT_HTTP_AUTHORIZATION"] ??
    ""
));

if ($roleAccessAuthorization === "" && function_exists("getallheaders")) {
    foreach ((array)getallheaders() as $headerName => $headerValue) {
        if (strcasecmp((string)$headerName, "Authorization") === 0) {
            $roleAccessAuthorization = trim((string)$headerValue);
            break;
        }
    }
}

if ($roleAccessAuthorization === "") {
    http_response_code(400);
    echo json_encode(["message" => "incomplete authorization header"]);
    exit;
}

$_SERVER["HTTP_AUTHORIZATION"] = $roleAccessAuthorization;

$roleAccessSecret = (string)(
    $_ENV["SECRET_KEY"] ??
    (getenv("SECRET_KEY") !== false ? getenv("SECRET_KEY") : "")
);
$roleAccessCodec = new JWTCodec($roleAccessSecret);
$roleAccessCandidate = null;

if (preg_match('/^Bearer\s+(.+)$/i', $roleAccessAuthorization, $matches)) {
    try {
        $roleAccessCandidate = $roleAccessCodec->decode($matches[1]);
    } catch (Throwable $error) {
        $roleAccessCandidate = null;
    }
}

$roleAccessDeveloperToken =
    is_array($roleAccessCandidate) &&
    (
        ($roleAccessCandidate["pos_developer_mode"] ?? false) === true ||
        ($roleAccessCandidate["pos_developer_full_access"] ?? false) === true ||
        ($roleAccessCandidate["pos_developer_read_only"] ?? false) === true
    );

if ($roleAccessDeveloperToken) {
    $roleAccessDeveloperData = posDeveloperRequestTokenData();
    if (!is_array($roleAccessDeveloperData)) {
        http_response_code(401);
        echo json_encode(["message" => "invalid developer session"]);
        exit;
    }

    $pos_user_id = trim((string)($roleAccessDeveloperData["sub"] ?? ""));
    $pos_developer_mode = true;
    $GLOBALS["pos_user_id"] = $pos_user_id;
    $GLOBALS["pos_developer_mode"] = true;
    return;
}

$roleAccessAuth = new Auth(null, $roleAccessCodec);
if (!$roleAccessAuth->authenticateAccessToken()) {
    exit;
}

$pos_user_id = (string)$roleAccessAuth->getUserID();
$pos_developer_mode = false;
$GLOBALS["pos_user_id"] = $pos_user_id;
$GLOBALS["pos_developer_mode"] = false;
