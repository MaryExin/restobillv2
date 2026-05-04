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
    !array_key_exists("password", $data) ||
    !array_key_exists("firstname", $data) ||
    !array_key_exists("middlename", $data) ||
    !array_key_exists("lastname", $data) ||
    !array_key_exists("department", $data) ||
    !array_key_exists("company", $data) ||
    !array_key_exists("contactnumber", $data)) {

    http_response_code(400);
    echo json_encode(["message" => "incorrect_User_Info"]);
    exit;
}

$database = new Database($_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]);

$otpController = new OTP();
$otp = $otpController->generateOTP();

// Initialize connection var $conn, methods: getByUsername, getById
try {
    $conn = $database->getConnection();

    $password_hash = password_hash($data["password"], PASSWORD_DEFAULT);

    $sql = "INSERT INTO tbl_users_global_assignment (uuid,email,classification,password,
    firstname,middlename,lastname, company, department, contactnumber, status, verified, passlock, otp, otplock, usertracker, deletestatus, createtime)
    VALUES (shortUUID(),:username, :classification,:password, :firstname,:middlename,
    :lastname,:company, :department, :contactnumber ,'Inactive', 'Unverified', 0, :otp , 0, :usertracker,'Active',now())";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":username", $data["username"], PDO::PARAM_STR);
    $stmt->bindValue(":classification", "Admin", PDO::PARAM_STR); //Admin or Subuser
    $stmt->bindValue(":password", $password_hash, PDO::PARAM_STR);
    $stmt->bindValue(":firstname", $data["firstname"], PDO::PARAM_STR);
    $stmt->bindValue(":middlename", $data["middlename"], PDO::PARAM_STR);
    $stmt->bindValue(":lastname", $data["lastname"], PDO::PARAM_STR);
    $stmt->bindValue(":company", $data["company"], PDO::PARAM_STR);
    $stmt->bindValue(":department", $data["department"], PDO::PARAM_STR);
    $stmt->bindValue(":otp", $otp, PDO::PARAM_INT);
    $stmt->bindValue(":usertracker", "Admin", PDO::PARAM_STR); //Main user uuid for Subusers, Admin for admin
    $stmt->bindValue(":contactnumber", $data["contactnumber"], PDO::PARAM_STR);

    $stmt->execute();

    // Email

    $emailController = new EmailSendController();

    $emailController->sendEmail("mail.exinnovph.com", "admin@exinnovph.com",
        "ExinnovEmail@2025", "admin@exinnovph.com", $data["username"], "Your OTP", "Your otp code: $otp");

    echo json_encode(["message" => "registrationSuccessful"]);

} catch (Exception $e) {
    echo json_encode(["message" => $e->getmessage()]);
    exit;
}
