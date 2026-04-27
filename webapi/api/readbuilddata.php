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

$gateway = new BuildGateway($database);
$controller = new BuildController($gateway, $user_id);

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    header("Allow: GET");
    exit;
}

$page = isset($_GET['page']) ? intval($_GET['page']) : 1;
$search = isset($_GET['search']) ? trim((string)$_GET['search']) : "";
$pageData = isset($_GET['pageData']) ? intval($_GET['pageData']) : 5;
$pageIndex = ($page - 1) * $pageData;

$pricingFilter = isset($_GET['pricingFilter']) ? trim((string)$_GET['pricingFilter']) : "ALL";
$export = isset($_GET['export']) ? trim((string)$_GET['export']) : "";

if (strtolower($export) === "excel") {
    $controller->processExportExcelRequest($_SERVER['REQUEST_METHOD'], $search, $pricingFilter);
    exit;
}

$controller->processInfiniteReadRequest($_SERVER['REQUEST_METHOD'], $page, $pageIndex, $pageData, $search);