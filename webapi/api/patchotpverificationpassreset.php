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

if (!array_key_exists("username", $data) || !array_key_exists("otp", $data) || !array_key_exists("newpassword", $data)) {

    http_response_code(400);

    echo json_encode(["message" => "arrayisempty"]);

    exit;

}

$username = $data["username"];
$otp = $data["otp"];
$newpassword = $data["newpassword"];

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

$otpVerification = new OTP();

$userIDToVerify = $otpVerification->verifyReadOTP($database, $username, $otp);

if (!$userIDToVerify) {
    echo json_encode(["message" => "invalidOTP"]);

    exit;
}

try {
    $conn = $database->getConnection();

    $password_hash = password_hash($newpassword, PASSWORD_DEFAULT);

    $sql = "UPDATE tbl_users_global_assignment SET password = :password WHERE email = :username";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":password", $password_hash, PDO::PARAM_STR);
    $stmt->bindValue(":username", $username, PDO::PARAM_STR);

    $stmt->execute();

    echo json_encode(["message" => "User Verified"]);

} catch (Exception $e) {
    echo json_encode(["message" => $e->getmessage()]);
    exit;
}
