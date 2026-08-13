<?php

if (!defined("RESTOBILL_CORS_HEADERS")) {
    define("RESTOBILL_CORS_HEADERS", true);

    $origin = $_SERVER["HTTP_ORIGIN"] ?? "";
    $allowedOrigin = "*";

    if (is_string($origin) && preg_match('/^https?:\/\/[A-Za-z0-9.\-:]+$/', $origin)) {
        $allowedOrigin = $origin;
        header("Vary: Origin");
    }

    header("Access-Control-Allow-Origin: {$allowedOrigin}");
    header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: " . ($_SERVER["HTTP_ACCESS_CONTROL_REQUEST_HEADERS"] ?? "Content-Type, Authorization, X-Requested-With, Accept, Origin"));
    header("Access-Control-Allow-Private-Network: true");
    header("Access-Control-Max-Age: 86400");
}

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
    http_response_code(204);
    exit;
}
