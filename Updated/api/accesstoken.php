<?php

require_once __DIR__ . "/pos_developer_auth.php";

$isDeveloperSession = isset($isDeveloperSession) && $isDeveloperSession === true;
$accessTokenLifetime = $isDeveloperSession ? 28800 : 43200;
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

echo json_encode([
    "access_token" => $access_token,
    "username" => $user["firstname"],
    "message" => "loginsuccess",
    "userrole" => $userRole,
    "classification" => $user["classification"] ?? "",
    "userid" => $userId,
    "profile_pic" => $userProfilePic,
    "email" => $email,
    "is_developer_mode" => $isDeveloperSession,
]);
