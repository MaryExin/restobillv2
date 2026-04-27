<?php

//PHP to CRUD Sales

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

if (!array_key_exists("username", $data) || !array_key_exists("oldpassword", $data)
    || !array_key_exists("newpassword", $data)) {

    http_response_code(400);

    echo json_encode(["message" => "arrayisempty"]);

    exit;

}

$username = $data["username"];
$oldpassword = $data["oldpassword"];
$newpassword = $data["newpassword"];

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

if ($user["status"] !== "Active") {

    http_response_code(401);
    echo json_encode(["message" => "userNotActivated"]);
    exit;
}

if (!password_verify($data["oldpassword"], $user["password"])) {

    http_response_code(401);
    echo json_encode(["message" => "invalidAuthentication"]);
    exit;
}

$userId = $user["uuid"];

//Set OTP

$otpController = new OTP();
$otp = $otpController->generateOTP();

$otpVerification = new OTP();

$confirmaTionOTP = $otpVerification->setOTP($database, $userId, $otp); //Set OTP using update statement to user

if (!$confirmaTionOTP) {
    echo json_encode(["message" => "invalidOTP"]);

    exit;
}

// Email

$emailController = new EmailSendController();

$emailController->sendEmail("mail.lightemsupport.com", "accounts@lightemsupport.com",
    "LightemAccounts@2025", "accounts@lightemsupport.com", $username, "OTP Confirmation", "Your OTP: $otp");

echo json_encode(["message" => "validationSuccess"]);
