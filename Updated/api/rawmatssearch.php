<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: POST");
    exit;
}
$data = (array) json_decode(file_get_contents("php://input"), true);

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);

try {
    $conn = $database->getConnection();
    
    if ($data["rawmatsname"] !== "") {

    $sql = "SELECT desc, uomval, uom, cost_per_uom  FROM lkp_raw_mats WHERE desc LIKE :rawmatsname";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":rawmatsname", '%' . $data["rawmatsname"] . '%', PDO::PARAM_STR);
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($data);

    }
} catch (Exception $e) {
    echo json_encode(["message" => "Error fetching data"]);
    exit;
}

