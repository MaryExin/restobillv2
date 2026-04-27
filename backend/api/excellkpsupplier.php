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
// Initialize connection var $conn, methods: getByUsername, getById

$busunitcode = $_GET['busunitcode'] ?? null;

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


// if (!$busunitcode || !$datecurrentmodate) {
//     http_response_code(400);
//     die("Missing required parameters.");
// }

// Define the file name
$fileName = "lkp_supplier.csv";
// $datecurrentmodate = date('Y-m-d', strtotime($datecurrentmodate));
// Fetch data
$sql = "SELECT * FROM lkp_supplier";
$stmt = $pdo->prepare($sql);
$stmt->bindParam(':userid',$user_id);

$stmt->execute();
$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($data)) {
    die("No data found for the given parameters.");
}

// Set headers to force download
header('Content-Type: text/csv');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Pragma: no-cache');
header('Expires: 0');

// Open output stream
$output = fopen('php://output', 'w');

// Add column headers
if (!empty($data)) {
    fputcsv($output, array_keys($data[0]));
}

// Add rows
foreach ($data as $row) {
    fputcsv($output, $row);
}

fclose($output);
exit;
