<?php

$payload = [
    "sub" => $user["uuid"],
    "name" => $user["email"],
    "exp" => time() + 43200, //900 15 mins
];

$access_token = $codec->encode($payload);

$refresh_token_expiry = time() + 43200; //1800 30 mins

$refresh_token = $codec->encode([
    "sub" => $user["uuid"],
    "exp" => $refresh_token_expiry,
]);

