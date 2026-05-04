<?php

//PHP to Change Password

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "PATCH") {

    http_response_code(405);

    header("Allow: PATCH");

    exit;

}

$data = (array) json_decode(file_get_contents("php://input"), true);

if (!array_key_exists("username", $data)
    || !array_key_exists("password", $data)
    || !array_key_exists("otp", $data)) {

    http_response_code(400);

    echo json_encode(["message" => "arrayisempty"]);

    exit;

}

$username = $data["username"];
$newPassword = $data["password"];
$otp = $data["otp"];

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

/// Initialize connection var $conn, methods: getByUsername, getById

$user_gateway = new UserGateway($database);

$user = $user_gateway->getByUsername($data["username"]);

if ($user === false) {

    http_response_code(401);
    echo json_encode(["message" => "invalidAuthentication"]);
    exit;
}

// if ($user["status"] !== "Active") {

//     http_response_code(401);
//     echo json_encode(["message" => "userNotActivated"]);
//     exit;
// }

$userId = $user["uuid"];

// Verify OTP
// if ($user["otp"] !== $otp) {
//     http_response_code(401);
//     echo json_encode(["message" => "invalidOTP"]);
//     exit;
// }

// Check if OTP has expired (optional - if you have OTP expiration logic)
// if (isset($user["otp_expiry"]) && strtotime($user["otp_expiry"]) < time()) {
//     http_response_code(401);
//     echo json_encode(["message" => "otpExpired"]);
//     exit;
// }

// Validate new password length
if (strlen($newPassword) < 4) {
    http_response_code(400);
    echo json_encode(["message" => "passwordTooShort"]);
    exit;
}

// Hash the new password
$hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

// Get database connection
$conn = $database->getConnection();

// Update password and clear OTP directly
$sql = "UPDATE tbl_users_global_assignment 
        SET password = :password,
            otp = '',
            status = 'Active'
        WHERE uuid = :userId";

$stmt = $conn->prepare($sql);

$stmt->bindValue(":password", $hashedPassword, PDO::PARAM_STR);
$stmt->bindValue(":userId", $userId, PDO::PARAM_STR);

$result = $stmt->execute();

if ($result === false) {
    http_response_code(500);
    echo json_encode(["message" => "passwordUpdateFailed"]);
    exit;
}

echo json_encode(["message" => "Password changed successfully"]);