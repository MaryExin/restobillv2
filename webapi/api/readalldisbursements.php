<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

$gateway = new DisbursementsGateway($database);
$controller = new DisbursementsController($gateway, $user_id);

$page = isset($_GET["page"]) ? (int) $_GET["page"] : 1;
$pageData = $_GET["pageData"] ?? ""; // keep as string
$pageIndex = 0; // unused here
$search = $_GET["search"] ?? "";
$busunitcode = $_GET["busunitcode"] ?? "";

$controller->processAllDisbursementsRequest(
    $_SERVER["REQUEST_METHOD"],
    $page,
    $pageIndex,
    $pageData,
    $search,
    $busunitcode
);