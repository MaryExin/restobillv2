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

if (!array_key_exists("email", $data)) {

    http_response_code(400);

    echo json_encode(["message" => "arrayisempty"]);

    exit;

}

//  echo json_encode(["message" => $area . " " . $year . " " . $month]);

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

try {

    $conn = $database->getConnection();

    $sql = "UPDATE tbl_users_global_assignment SET password = :password WHERE uuid = :userid";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":password", $password_hash, PDO::PARAM_STR);

    $stmt->bindValue(":userid", $resetUserId, PDO::PARAM_STR);

    $stmt->execute();

    // Email

    $emailController = new EmailSendController();

    $emailController->sendEmail("mail.exinnovph.com", "admin@exinnovph.com",

        "ExinnovEmail@2025", "admin@exinnovph.com", $email, "Inquiry",

        "<html>

    <body>

        <center>

            <img src='https://jeremiahd61.sg-host.com/images/app/logo.png' alt='Logo' width='100'><br>

            <p style='font-size: 20px;'>Hello <br><br>New Inquiry:
            <br> <br> You can change your password into the user settings menu.

                <br> Thank you <br> </p>

        </center>

    </body>

    </html>");

    echo json_encode(["message" => "passwordResetSuccess"]);

} catch (Exception $e) {

    echo json_encode(["message" => $e->getmessage()]);

    exit;

}
