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

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

//Initialize Task Database CRUD

$gateway = new BusUnitGatewayNoToken($database);

//Initialize Task Controller to process API Requests

$controller = new BusUnitControllerNoToken($gateway);

$controller->processRequest($_SERVER['REQUEST_METHOD']);
