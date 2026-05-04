<?php

$payload = [
    "sub" => $user["uuid"],
    "name" => $user["email"],
    "exp" => time() + 43200, //900 15mins
];

$access_token = $codec->encode($payload);

echo json_encode([
    "access_token" => $access_token,
    "username" => $user["firstname"],
    "message" => "loginsuccess",
    "userrole" => $userRole,
    "userid" => $userId,
    "profile_pic" => $userProfilePic,
    "email" => $email,
]);
