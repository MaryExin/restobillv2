<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    header("Allow: POST");

    exit;

}

$data = (array) json_decode(file_get_contents("php://input"), true);

if (!array_key_exists("username", $data) ||

    !array_key_exists("password", $data)) {

    http_response_code(400);

    echo json_encode(["message" => "missingLoginCredentials"]);

    exit;

}

$database = new Database($_ENV["DB_HOST"],

    $_ENV["DB_NAME"],

    $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

// Initialize connection var $conn, methods: getByUsername, getById

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

if (!password_verify($data["password"], $user["password"])) {

    http_response_code(401);

    echo json_encode(["message" => "invalidAuthentication"]);

    exit;

}

//Get User Role

$userId = $user["uuid"];
$recipientName = trim((string) ($user["firstname"] ?? "")) !== ""
    ? (string) $user["firstname"]
    : (string) $userId;

$userProfilePic = $user["image_filename"];

$userRole = $user_gateway->getRole($userId);

//Initialize JWT Token with methods: encode, decode

$codec = new JWTCodec($_ENV["SECRET_KEY"]);

//Set OTP

$otpController = new OTP();

$otp = $otpController->generateOTP();

$otpVerification = new OTP();

$confirmaTionOTP = $otpVerification->setOTP($database, $userId, $otp);

if (!$confirmaTionOTP) {

    echo json_encode(["message" => "invalidOTP"]);

    exit;

}

//Send Email Verification

// Email

$emailController = new EmailSendController();

$emailController->sendEmail("mail.exinnovph.com", "admin@exinnovph.com",

    "ExinnovEmail@2025", "admin@exinnovph.com", $data["username"], "Your OTP",

    AuthOtpEmailTemplate::render([
        "recipientName" => $recipientName,
        "otp" => $otp,
        "title" => "Your Login OTP",
        "eyebrow" => "Account security",
        "intro" => "A sign-in attempt was approved for verification. Enter the code below to continue logging in securely.",
        "helperText" => "We prepared a one-time password for your Exinnov login request.",
        "actionText" => "Use this code to complete your login. For your protection, please do not share it with anyone.",
        "supportText" => "If this login was not requested by you, no further action is needed and your password remains unchanged.",
        "footerBrand" => "Exinnov Team",
        "logoUrl" => "https://exinnovph.com/images/app/logo.png",
    ])

);

// Initialize payload and refresh token, echo out jwt tokens in local storage

require __DIR__ . "/tokens.php";

// Initialize refresh token with methods: crud for refresh token

$refresh_token_gateway = new RefreshTokenGateway($database, $_ENV["SECRET_KEY"]);

// Create refresh token in refresh_token table

$refresh_token_gateway->create($refresh_token, $refresh_token_expiry);
