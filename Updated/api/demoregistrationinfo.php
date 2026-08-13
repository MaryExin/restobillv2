<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

date_default_timezone_set('Asia/Manila');

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);
    header("Allow: POST");
    exit;
}

$data = (array) json_decode(file_get_contents("php://input"), true);

// echo json_encode($data);

if (!array_key_exists("Name", $data) ||
    !array_key_exists("Email", $data) ||
    !array_key_exists("Demodate", $data) ||
    !array_key_exists("Contact", $data) ||
    !array_key_exists("Address", $data) ||
    !array_key_exists("CompanyInformation", $data)
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

    $sql = "INSERT INTO tbl_demo_registered_info(uudi, Name, Email, Demodate, Contact, Address, CompanyInformation, Date_Registered)
    VALUES(uuid(), :Name, :Email, :Demodate, :Contact, :Address, :CompanyInformation, now())";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":Name", $data["Name"], PDO::PARAM_STR);
    $stmt->bindValue(":Email", $data["Email"], PDO::PARAM_STR);
    $stmt->bindValue(":Demodate", $data["Demodate"], PDO::PARAM_STR);
    $stmt->bindValue(":Contact", $data["Contact"], PDO::PARAM_STR);
    $stmt->bindValue(":Address", $data["Address"], PDO::PARAM_STR);
    $stmt->bindValue(":CompanyInformation", $data["CompanyInformation"], PDO::PARAM_STR);

    $stmt->execute();

    echo json_encode(["message" => "Thank you for registering"]);
    exit;

} catch (Exception $e) {
    echo json_encode(["message" => "Registration error"]);
    exit;

}
