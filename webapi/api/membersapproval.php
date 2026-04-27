<?php
// membersapproval.php ✅ PATCH approve/reject member + (on approve) reset password + email (+ companycode in email)
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "PATCH") {
    http_response_code(405);
    header("Allow: PATCH");
    echo json_encode(["message" => "methodNotAllowed"]);
    exit;
}

$data = (array) json_decode(file_get_contents("php://input"), true);

if (!array_key_exists("id", $data) || empty($data["id"])) {
    http_response_code(400);
    echo json_encode(["message" => "missingId"]);
    exit;
}

if (!array_key_exists("status", $data) || $data["status"] === null || $data["status"] === "") {
    http_response_code(400);
    echo json_encode(["message" => "missingStatus"]);
    exit;
}

// ✅ companycode comes from payload and will be included in email content
$companycode = array_key_exists("companycode", $data) ? (string) $data["companycode"] : "";

$memberId = (string) $data["id"];
$status   = (string) $data["status"];

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

// Auth
$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth  = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = (int) $auth->getUserID();

// Gateway + Controller
$members_approval_gateway = new MembersApprovalGateway($database);
$controller = new MembersApprovalController($members_approval_gateway, $user_id);

// ✅ pass companycode to controller
$controller->processRequest($_SERVER["REQUEST_METHOD"], $memberId, $status, $companycode);
