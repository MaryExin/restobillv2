<?php

require_once __DIR__ . "/pos_developer_auth.php";

$isDeveloperSession = isset($isDeveloperSession) && $isDeveloperSession === true;
$accessTokenLifetime = $isDeveloperSession ? 28800 : 43200;
$refreshTokenLifetime = $isDeveloperSession ? 28800 : 43200;
$issuedAt = time();

$payload = [
    "sub" => $user["uuid"],
    "name" => $user["email"],
    "iat" => $issuedAt,
    "token_type" => "access",
    "pos_developer_mode" => $isDeveloperSession,
    "pos_developer_full_access" => $isDeveloperSession,
    "pos_developer_read_only" => false,
    "pos_reading_scopes" => $isDeveloperSession
        ? posDeveloperReadingScopes()
        : [],
    "pos_developer_version" => $isDeveloperSession
        ? posDeveloperCredentialVersion()
        : "",
    "exp" => $issuedAt + $accessTokenLifetime,
];

$access_token = $codec->encode($payload);

$refresh_token_expiry = time() + $refreshTokenLifetime;

$refresh_token = $codec->encode([
    "sub" => $user["uuid"],
    "iat" => $issuedAt,
    "token_type" => "refresh",
    "pos_developer_mode" => $isDeveloperSession,
    "pos_developer_full_access" => $isDeveloperSession,
    "pos_developer_read_only" => false,
    "pos_reading_scopes" => $isDeveloperSession
        ? posDeveloperReadingScopes()
        : [],
    "pos_developer_version" => $isDeveloperSession
        ? posDeveloperCredentialVersion()
        : "",
    "exp" => $refresh_token_expiry,
]);
