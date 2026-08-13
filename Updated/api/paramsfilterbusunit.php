<?php 
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    header("Allow: GET");
    exit;
}

// Initialize the Database connection
$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);
$pdo = $database->getConnection();

// Initialize UserGateway and Auth
$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

// Authenticate the access token
if (!$auth->authenticateAccessToken()) {
    http_response_code(401); // Unauthorized
    echo json_encode(["error" => "Unauthorized access"]);
    exit;
}

$user_id = $auth->getUserID();

$sql = "SELECT DISTINCT 
    t2.brandcode ,
    t5.brand_name ,
    t2.corpcode ,
    t3.corp_name ,
    t2.areacode ,
    t4.area_name ,
    t2.busunitcode ,
    t2.name 
FROM lkp_busunits AS t2
LEFT JOIN lkp_corporation AS t3 ON t2.corpcode = t3.corp_code
LEFT JOIN lkp_area AS t4 ON t2.areacode = t4.area_code
LEFT JOIN lkp_brands AS t5 ON t2.brandcode = t5.brand_code
WHERE t2.deletestatus = 'Active'";



$stmt = $pdo->prepare($sql);

// Bind parameters if necessary

$stmt->execute();
$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Send JSON response
header("Content-Type: application/json");
echo json_encode($data);
exit;
