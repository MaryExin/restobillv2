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

// $data = (array) json_decode(file_get_contents("php://input"), true);

// if (!array_key_exists("pageIndex", $data)) {

//     http_response_code(400);

//     echo json_encode(["message" => "pagenumberempty"]);

//     exit;

// }

$search = "";

$page = isset($_GET['page']) ? intval($_GET['page']) : 1;

$search = isset($_GET['search']) ? $_GET['search'] : "";
$pageData = isset($_GET['pageData']) ? $_GET['pageData'] : 5;
// $pageData = 5; // Adjust the page size as needed

$pageIndex = ($page - 1) * $pageData;

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

$gateway = new PcfsetupGateway($database);

//Initialize Task Controller to process API Requests

$controller = new PcfsetupController($gateway, $user_id);

$controller->processReadinfiniteRequest($_SERVER['REQUEST_METHOD'],$page, $pageIndex, $pageData, $search);
