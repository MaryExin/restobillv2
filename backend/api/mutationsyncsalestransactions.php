<?php

//PHP to CRUD Sales

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

$data = (array) json_decode(file_get_contents("php://input"), true);

$salesTransId = null;

if (isset($data["salestransid"])) {

    $salesTransId = $data["salestransid"];

}

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);



$gateway = new SyncSalesTransactionsGateway($database);

//Initialize Task Controller to process API Requests

$controller = new SyncSalesTransactionsController($gateway);


$controller->processRequest($_SERVER['REQUEST_METHOD'], $data);

