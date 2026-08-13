<?php

//PHP to CRUD Sales

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

$data = (array) json_decode(file_get_contents("php://input"), true);

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);


//Initialize Task Database CRUD

$gateway = new ZreadingGateway($database);

//Initialize Task Controller to process API Requests

$controller = new ZreadingController($gateway);

$controller->processRequest($_SERVER['REQUEST_METHOD'], $data);
