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

$gateway = new SalesQueueGateway($database);

//Initialize Task Controller to process API Requests

$controller = new SalesQueueController($gateway, $user_id);


if($data['action'] === "editQuotation"){
    $controller->processEditQuotation($_SERVER['REQUEST_METHOD'], $data);
}


if($data['action'] === "deleteQuotation"){
    $controller->processDeleteQuotation($_SERVER['REQUEST_METHOD'], $data);
}

if($data['action'] === "sendQuotation"){
    $controller->processSendQuotation($_SERVER['REQUEST_METHOD'], $data);
}


if($data['action'] === "addProductsInQuotation"){
    $controller->processaddProductsInQuotation($_SERVER['REQUEST_METHOD'], $data);
}

if($data['action'] === "acceptQuotation"){
    $controller->processAcceptQuotation($_SERVER['REQUEST_METHOD'], $data);
}


if($data['action'] === "rejectQuotation"){
    $controller->processRejectQuotation($_SERVER['REQUEST_METHOD'], $data);
}

if($data['action'] === "editSalesOrder"){
    $controller->processEditSalesOrder($_SERVER['REQUEST_METHOD'], $data);
}

if($data['action'] === "addProductsInSalesOrder"){
    $controller->processaddProductsInSalesOrder($_SERVER['REQUEST_METHOD'], $data);
}

if($data['action'] === "deleteSalesOrder"){
    $controller->processDeleteSalesOrder($_SERVER['REQUEST_METHOD'], $data);
}


if($data['action'] === "approveSalesOrder"){
    $controller->processApproveSalesOrder($_SERVER['REQUEST_METHOD'], $data);
}

if($data['action'] === "cancelSalesOrder"){
    $controller->processCancelSalesOrder($_SERVER['REQUEST_METHOD'], $data);
}

if($data['action'] === "allocateStocks"){
    $controller->processAllocateStocks($_SERVER['REQUEST_METHOD'], $data);
}





    
    
    

