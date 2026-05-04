<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

// CORS
$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

// Only allow POST
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: POST");
    exit;
}

// Read JSON input
$data = (array) json_decode(file_get_contents("php://input"), true);

// Validate username
if (!array_key_exists("username", $data)) {
    http_response_code(400);
    echo json_encode(["message" => "missingLoginCredentials"]);
    exit;
}

// Database
$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

// User gateway
$user_gateway = new UserGateway($database);

// Check user
$user = $user_gateway->getByUsername($data["username"]);

if ($user === false) {
    http_response_code(401);
    echo json_encode(["message" => "invalidAuthentication"]);
    exit;
}

// User data
$userId = $user["uuid"];
$userProfilePic = $user["image_filename"] ?? "";

// Get role (optional if needed later)
$userRole = $user_gateway->getRole($userId);

// JWT codec (used later if needed)
$codec = new JWTCodec($_ENV["SECRET_KEY"]);

// =====================
// OTP GENERATION
// =====================
$otpController = new OTP();
$otp = $otpController->generateOTP();

$otpVerification = new OTP();
$confirmationOTP = $otpVerification->setOTP($database, $userId, $otp);

if (!$confirmationOTP) {
    http_response_code(500);
    echo json_encode(["message" => "invalidOTP"]);
    exit;
}

// =====================
// SEND EMAIL
// =====================
$emailController = new EmailSendController();

$emailController->sendEmail(
    "mail.exinnovph.com", "admin@exinnovph.com",
"ExinnovEmail@2025", "admin@exinnovph.com"
,
    $data["username"],
    "Your OTP",
    "
    <html>
        <body style='margin:0; padding:0; background-color:#ffffff;'>
            <table align='center' width='100%' cellpadding='0' cellspacing='0'
                style='max-width:600px;margin:auto;background:#ffffff;font-family:Arial,sans-serif;color:#333;border-collapse:collapse;'>

                <tr>
                    <td style='padding:20px;text-align:center;background-color:#093FB4;'>
                        <img src='https://exinnovph.com/images/app/logo.png'
                             alt='Exinnov Logo'
                             width='120'
                             style='display:block;margin:auto;'>
                    </td>
                </tr>

                <tr>
                    <td style='padding:30px;'>
                        <p style='font-size:18px;'>Dear <strong>$userId</strong>,</p>

                        <p style='font-size:16px;'>
                            Your One-Time Password (OTP) for secure verification is:
                        </p>

                        <p style='text-align:center;'>
                            <span style='
                                display:inline-block;
                                font-size:24px;
                                font-weight:bold;
                                letter-spacing:2px;
                                padding:12px 24px;
                                background-color:#093FB4;
                                color:#ffffff;
                                border-radius:6px;'>
                                $otp
                            </span>
                        </p>

                        <p style='font-size:14px;'>
                            Please use this code to complete your password reset.
                            If you did not request this OTP, please ignore this email.
                        </p>

                        <p style='font-size:14px;'>
                            Thank you,<br>
                            <strong>Exinnov Team</strong>
                        </p>
                    </td>
                </tr>

                <tr>
                    <td style='padding:15px;text-align:center;font-size:12px;color:#888;'>
                        © 2025 Exinnov. All rights reserved.
                    </td>
                </tr>

            </table>
        </body>
    </html>
    "
);

// =====================
// SUCCESS RESPONSE
// =====================
echo json_encode([
    "message" => "OTP Sent Successfully"
]);

exit;