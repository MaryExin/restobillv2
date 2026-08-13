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


$search = "";


$page = isset($_GET['page']) ? intval($_GET['page']) : 1;


$search = isset($_GET['search']) ? $_GET['search'] : "";


$busunitcode = isset($_GET['busunitcode']) ? $_GET['busunitcode'] : "";


$pageData = isset($_GET['pageData']) ? $_GET['pageData'] : 5;


$pageIndex = ($page - 1) * $pageData;


$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],


    $_ENV["DB_PASS"]);


$user_gateway = new UserGateway($database);


$codec = new JWTCodec($_ENV["SECRET_KEY"]);


$auth = new Auth($user_gateway, $codec);


if (!$auth->authenticateAccessToken()) {

    exit;

}


$user_id = $auth->getUserID();



$gateway = new POGateway($database);


$controller = new POController($gateway, $user_id);


$controller->processReadInfiniteClearingItems($_SERVER['REQUEST_METHOD'], $page, $pageIndex, $pageData, $search,  $busunitcode);