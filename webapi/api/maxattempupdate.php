<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

date_default_timezone_set('Asia/Manila');

if ($_SERVER["REQUEST_METHOD"] !== "PATCH") {

    http_response_code(405);
    header("Allow: POST");
    exit;
}

$data = (array) json_decode(file_get_contents("php://input"), true);

// echo json_encode($data);

if (!array_key_exists("username", $data) ||
    !array_key_exists("status", $data)
) {

    http_response_code(400);
    echo json_encode(["message" => "fill in blanks"]);
    exit;
}

// echo json_encode(["message" => $data]);

$database = new Database($_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]);

// Initialize connection var $conn, methods: getByUsername, getById
try {
    $conn = $database->getConnection();

    $sql = "UPDATE tbl_users_global_assignment SET `status` = :status WHERE email = :username";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);
    $stmt->bindValue(":username", $data["username"], PDO::PARAM_STR);

    $stmt->execute();

    echo json_encode(["message" => "Updated Member Status Is Inactive"]);
    exit;

} catch (Exception $e) {
    echo json_encode(["message" => "Registration error"]);
    exit;

}
