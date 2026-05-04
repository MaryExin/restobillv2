<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

$config = require __DIR__ . "/config.php";

$conn = new mysqli(
    $config["host"],
    $config["user"],
    $config["pass"],
    $config["db"]
);

if ($conn->connect_error) {
    echo json_encode(["status"=>"error"]);
    exit;
}

$sql = "SELECT MAX(updated_at) as last_update FROM tbl_pos_transactions";

$result = $conn->query($sql);
$row = $result->fetch_assoc();

echo json_encode([
    "last_update" => $row["last_update"]
]);

$conn->close();