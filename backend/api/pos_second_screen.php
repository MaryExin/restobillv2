<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$imageDir = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') . '/pos_second_screen';
$allowed   = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
$images    = [];

if (is_dir($imageDir)) {
    foreach (scandir($imageDir) as $file) {
        if ($file === '.' || $file === '..') continue;
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed, true)) continue;
        $images[] = $file;
    }
    sort($images);
}

echo json_encode([
    'status'   => 'success',
    'images'   => $images,
    'base_path' => '/pos_second_screen/',
]);
