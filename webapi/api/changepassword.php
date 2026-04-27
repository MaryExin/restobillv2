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
$recipientName = trim((string) ($user["firstname"] ?? "")) !== ""
    ? (string) $user["firstname"]
    : (string) $userId;

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

$emailController->sendEmail("mail.exinnovph.com", "admin@exinnovph.com",
    "ExinnovEmail@2025", "admin@exinnovph.com", $username, "OTP Confirmation",
    AuthOtpEmailTemplate::render([
        "recipientName" => $recipientName,
        "otp" => $otp,
        "title" => "Password Change OTP",
        "eyebrow" => "Account security",
        "intro" => "We received a request to change your Exinnov password. Confirm the request with the code below.",
        "helperText" => "Use this one-time password to verify your password change before we update your account.",
        "actionText" => "Enter this code in the password change screen to continue. The request will only proceed after successful verification.",
        "supportText" => "If you did not start this password change, please ignore this email and keep your current password secure.",
        "footerBrand" => "Exinnov Team",
        "logoUrl" => "https://exinnovph.com/images/app/logo.png",
    ]));

echo json_encode(["message" => "validationSuccess"]);
