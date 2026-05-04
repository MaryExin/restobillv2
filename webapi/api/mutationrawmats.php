<?php
// rawmats.php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json");

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

/**
 * ✅ HYBRID BODY PARSER (Build-template style)
 * - Supports JSON bodies
 * - Supports multipart/form-data (for image upload)
 * - Supports PATCH/DELETE bodies (where php://input works)
 */
$raw = file_get_contents("php://input");
$decoded = null;

if (is_string($raw) && trim($raw) !== "") {
    $decoded = json_decode($raw, true);
}

$data = is_array($decoded) ? $decoded : [];

// If multipart/form-data, merge $_POST into $data
if (!empty($_POST) && is_array($_POST)) {
    foreach ($_POST as $k => $v) {
        $data[$k] = $v;
    }
}

// Merge query params without overwriting existing keys
if (!empty($_GET) && is_array($_GET)) {
    foreach ($_GET as $k => $v) {
        if (!array_key_exists($k, $data)) $data[$k] = $v;
    }
}

// ✅ Normalize Action key (keep your pattern)
$action = isset($data["Action"]) ? (string)$data["Action"] : (isset($data["action"]) ? (string)$data["action"] : "");

// ✅ Decode multiadd payload if present (strings in multipart)
if (isset($data["multiproduct"]) && is_string($data["multiproduct"])) {
    $mp = json_decode($data["multiproduct"], true);
    if (is_array($mp)) $data["multiproduct"] = $mp;
}
if (isset($data["imageMap"]) && is_string($data["imageMap"])) {
    $im = json_decode($data["imageMap"], true);
    if (is_array($im)) $data["imageMap"] = $im;
}

/**
 * ⚠️ NOTE:
 * Your OLD code forced rawmatsdesc existence always (even GET).
 * That breaks reads and multipart actions.
 * So we only require rawmatsdesc on the relevant actions (single create/edit).
 */

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

$gateway = new RawmatsGateway($database);
$controller = new RawmatsController($gateway, $user_id);

// ✅ Route: multiadd (batch) goes to multiprocessRequest (Build-template style)
if (strtoupper($action) === "MULTIADD") {
    $controller->multiprocessRequest($method, $data, $_FILES);
    exit;
}

// ✅ Default route: processRequest (single CRUD)
$controller->processRequest($method, $data, $_FILES);
