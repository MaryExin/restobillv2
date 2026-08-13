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

if (!array_key_exists("username", $data) || !array_key_exists("otp", $data)) {

    http_response_code(400);

    echo json_encode(["message" => "arrayisempty"]);

    exit;

}

$username = $data["username"];
$otp = $data["otp"];

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

$otpVerification = new OTP();

$userIDToVerify = $otpVerification->verifyReadOTP($database, $username, $otp);

if (!$userIDToVerify) {
    echo json_encode(["message" => "invalidOTP"]);

    exit;
}

// echo json_encode(["message" => $userIDToVerify["uuid"]]);




// Initialize connection var $conn, methods: getByUsername, getById

$user_gateway = new UserGateway($database);

//Initialize Database CRUD

$gateway = new OTPGateway($database);

//Initialize Controller to process API Requests

$controller = new OTPPatchController($gateway);

$controller->processRequest($_SERVER['REQUEST_METHOD'], $userIDToVerify["uuid"]);
