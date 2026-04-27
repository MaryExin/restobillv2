<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    header("Allow: GET");

    exit;

}

$search = "";

$page = isset($_GET['page']) ? intval($_GET['page']) : 1;

$search = isset($_GET['search']) ? $_GET['search'] : "";

$pageData = 5; // Adjust the page size as needed

$pageIndex = ($page - 1) * $pageData;

$busunitcode = isset($_GET['busunitcode']) ? $_GET['busunitcode'] : "";

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

$_ENV["DB_PASS"]);

$user_gateway = new UserGateway($database);

$codec = new JWTCodec($_ENV["SECRET_KEY"]);

$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {

    exit;

}

$user_id = $auth->getUserID();

$gateway = new FixedAssetGateway($database);

$controller = new FixedAssetController($gateway, $user_id);

$controller->processFixedAssetsData($_SERVER['REQUEST_METHOD'],$page, $pageIndex, $pageData, $search, $busunitcode);