<?php

//PHP to CRUD Sales

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

if (!array_key_exists("userId", $data)) {

    http_response_code(400);

    echo json_encode(["message" => "arrayisempty"]);

    exit;

}

$resetUserId = $data["userId"];

$email = $data["email"];

//  echo json_encode(["message" => $area . " " . $year . " " . $month]);

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

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

$otpController = new OTP();

$otp = $otpController->generateOTP();

function generateRandomPassword($length = 10)
{

    // Define the character set for the password

    $charset = $_ENV["SECRET_KEY"];

    // Generate the password by shuffling the characters

    $password = '';

    $charsetLength = strlen($charset);

    for ($i = 0; $i < $length; $i++) {

        $randomIndex = rand(0, $charsetLength - 1);

        $password .= $charset[$randomIndex];

    }

    return $password;

}

// Call the function to generate a 10-character random password

$randomPassword = generateRandomPassword(10);

// Initialize connection var $conn, methods: getByUsername, getById

try {

    $conn = $database->getConnection();

    $password_hash = password_hash($randomPassword, PASSWORD_DEFAULT);

    $sql = "UPDATE tbl_users_global_assignment SET password = :password WHERE uuid = :userid";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":password", $password_hash, PDO::PARAM_STR);

    $stmt->bindValue(":userid", $resetUserId, PDO::PARAM_STR);

    $stmt->execute();

    // Email

    $emailController = new EmailSendController();

    $emailController->sendEmail("mail.exinnovph.com", "admin@exinnovph.com",

        "ExinnovEmail@2025", "admin@exinnovph.com", $email, "Password Reset",

        "<html>

    <body>

        <center>

            <img src='https://exinnovph.com/images/app/logo.png' alt='Logo' width='100'><br>

            <p style='font-size: 20px;'>Hello $resetUserId<br><br>Your New Password is:

                <span style='font-weight: bold; font-size: 20px;

                background-color: rgb(30, 84, 29); color: white; padding: 2px 8px; border-radius: 10px;'>

                $randomPassword

                </span><br> <br> You can change your password into the user settings menu.

                <br> Thank you <br> </p>

        </center>

    </body>

    </html>");

    echo json_encode(["message" => "passwordResetSuccess"]);

} catch (Exception $e) {

    echo json_encode(["message" => $e->getmessage()]);

    exit;

}
