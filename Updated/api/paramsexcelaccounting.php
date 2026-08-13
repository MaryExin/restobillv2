<?php

//PHP to CRUD Sales

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    header("Allow: GET");

    exit;

}
$menutransacted = $_GET['menutransacted'];
$dateFrom = $_GET['dateFrom'];
$dateTo = $_GET['dateTo'];
$busunit = $_GET['busunit'];
 
if ($menutransacted == '' || $dateFrom == '' || $dateTo == '' || $busunit == '') {   

     http_response_code(400);

    echo json_encode(["message" => "Please provide all required fields"]);

    exit;

}

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

// Initialize connection var $conn, methods: getByUsername, getById

$user_gateway = new UserGateway($database);

//Initialize JWT Token with methods: encode, decode

$codec = new JWTCodec($_ENV["SECRET_KEY"]);

//Initialize Auth, methods: authenticateAccessToken, getUserID

$auth = new Auth($user_gateway, $codec);

//Method of auth checking if token is invalid signature or expired

if (!$auth->authenticateAccessToken()) {

    exit;

}

$user_id = $auth->getUserID();

//Initialize Task Database CRUD

$gateway = new ExcelCSVAccountingGateway($database);

//Initialize Task Controller to process API Requests

$controller = new ExcelCSVAccountingController($gateway, $user_id);

if($menutransacted === "/pettycashtransaction"){
    $controller->processRequest($_SERVER['REQUEST_METHOD'], $menutransacted,$busunit,$custodian,$dateFrom,$dateTo);
}else{
    $controller->processRequest($_SERVER['REQUEST_METHOD'], $menutransacted,$busunit,$dateFrom,$dateTo);
}


