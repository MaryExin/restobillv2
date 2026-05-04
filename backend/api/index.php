<?php

//PHP to CRUD Tasks End Point

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

$parts = explode("/", $path);

$resource = $parts[2];

$id = $parts[3] ?? null;

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],
    $_ENV["DB_PASS"]);

if ($resource == "tasks") {

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
$task_gateway = new TaskGateway($database);

//Initialize Task Controller to process API Requests
$controller = new TaskController($task_gateway, $user_id);

$controller->processRequest($_SERVER['REQUEST_METHOD'], $id);

}elseif ($resource == "Productlist")
{
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
$ProductlistGateway = new ProductlistGateway($database);
//$logs_gateway = new LogsGateway($database);

//Initialize Task Controller to process API Requests
$controller = new ProductlistController($ProductlistGateway, $user_id);
//$logscontroller = new LogsController($logs_gateway, $user_id);

$controller->processRequest($_SERVER['REQUEST_METHOD'], $id);
//$logscontroller->LogRequest($_SERVER['REQUEST_METHOD'], $id);

}elseif ($resource == "createnewtransaction")
{
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

require __DIR__ ."/createnewtransaction.php";

}elseif($resource=="RawmatsQueue"){
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
require __DIR__ ."/rawmatssearch.php";

}elseif ($resource == "Rawmatslist")
{
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
$RawmatslistGateway = new RawmatslistGateway($database);
//$logs_gateway = new LogsGateway($database);

//Initialize Task Controller to process API Requests
$controller = new RawmatslistController($RawmatslistGateway, $user_id);
//$logscontroller = new LogsController($logs_gateway, $user_id);

$controller->processRequest($_SERVER['REQUEST_METHOD'], $id);
//$logscontroller->LogRequest($_SERVER['REQUEST_METHOD'], $id);

}else{
    http_response_code(404);
    exit;
}
