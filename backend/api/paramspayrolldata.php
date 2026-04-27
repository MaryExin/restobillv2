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



// $min = isset($_GET['min']) ? $_GET['min'] : "";



// $max = isset($_GET['max']) ? $_GET['max'] : "";



$busunitcode = isset($_GET['busunitcode']) ? $_GET['busunitcode'] : "";



$pageData = 5; // Adjust the page size as needed

$pageIndex = ($page - 1) * $pageData;



//  echo json_encode(["min" => $min, "max" => $max, "busunit" => $busunitcode]);



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



$gateway = new PayrollGateway($database);



//Initialize Task Controller to process API Requests



$controller = new PayrollController($gateway, $user_id);



$controller->processSumarry($_SERVER['REQUEST_METHOD'], $page, $pageIndex, $pageData, $search,  $busunitcode);

