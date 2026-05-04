<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

// $corsPolicy = new CorsPolicy();

// $corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    header("Allow: GET");

    exit;

}

$excelToken = $_GET["exceltoken"];

$busunitCode = $_GET["busunitcode"];

$dateFrom = $_GET["datefrom"];

$dateTo = $_GET["dateto"];

$glCode = $_GET["glcode"];

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

$excelAuth = new ExcelAuth($database);

$isAuth = $excelAuth->authenticateExcelCreds($excelToken);

if (!$isAuth > 0) {

    echo json_encode(["message" => "Excel token required"]);

    exit;

}

//Initialize Task Database CRUD

$gateway = new AccountingDataGateway($database);

//Initialize Task Controller to process API Requests

$anonUser = "none";

$controller = new AccountingDataController($gateway, $anonUser);

$controller->processExcelReadLedgerList_DateRange($_SERVER['REQUEST_METHOD'], $busunitCode, $dateFrom, $dateTo, $glCode);
