<?php
//PHP to CRUD Sales
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json");

// ✅ HYBRID BODY PARSER: supports JSON + multipart/form-data (FormData)
// $data = [];
// $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

// if (stripos($contentType, 'application/json') !== false) {
//     $decoded = json_decode(file_get_contents("php://input"), true);
//     $data = is_array($decoded) ? $decoded : [];
// } else {
//     // multipart/form-data or x-www-form-urlencoded
//     $data = $_POST ?? [];

//     // If multiproduct is JSON string, decode it
//     if (isset($data['multiproduct']) && is_string($data['multiproduct'])) {
//         $decoded = json_decode($data['multiproduct'], true);
//         if (is_array($decoded)) $data['multiproduct'] = $decoded;
//     }

//     if (isset($data['imageMap']) && is_string($data['imageMap'])) {
//         $decoded = json_decode($data['imageMap'], true);
//         if (is_array($decoded)) $data['imageMap'] = $decoded;
//     }
// }

// ✅ HYBRID BODY PARSER: supports JSON + multipart/form-data + DELETE bodies
$data = [];

$raw = file_get_contents("php://input");
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (is_string($raw) && trim($raw) !== '') {
    // Try JSON first (even if content-type is missing/wrong)
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $data = $decoded;
    }
}

// If still empty, fallback to POST fields (multipart/form-data / x-www-form-urlencoded)
if (!is_array($data) || count($data) === 0) {
    $data = $_POST ?? [];

    // If multiproduct is JSON string, decode it
    if (isset($data['multiproduct']) && is_string($data['multiproduct'])) {
        $decoded = json_decode($data['multiproduct'], true);
        if (is_array($decoded)) $data['multiproduct'] = $decoded;
    }

    if (isset($data['imageMap']) && is_string($data['imageMap'])) {
        $decoded = json_decode($data['imageMap'], true);
        if (is_array($decoded)) $data['imageMap'] = $decoded;
    }
}


// (Optional legacy variable you had)
$edit = null;
if (isset($_POST['buildname'])) {
    $edit = $_POST['buildname'];
}

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

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
$gateway = new BuildGateway($database);

//Initialize Task Controller to process API Requests
$controller = new BuildController($gateway, $user_id);

// ✅ Route multiadd separately (FormData or JSON)
$action = $data["Action"] ?? null;

if ($action === "multiadd") {
    $controller->multiprocessRequest($_SERVER['REQUEST_METHOD'], $data);
} else {
    $controller->processRequest($_SERVER['REQUEST_METHOD'], $data);
}
