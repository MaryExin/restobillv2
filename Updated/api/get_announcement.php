<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// 1. I-load ang config.php
$config = include('config.php');

// 2. I-establish ang connection gamit ang data mula sa config
$conn = new mysqli(
    $config['host'], 
    $config['user'], 
    $config['pass'], 
    $config['db']
);

// I-set ang charset para iwas sa error sa special characters
$conn->set_charset($config['charset']);

if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed: " . $conn->connect_error]));
}

// 3. Query sa table (Siguraduhing nagawa mo na yung table sa database)
$sql = "SELECT setting_value FROM pos_settings WHERE setting_key = 'announcement' LIMIT 1";
$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    $row = $result->fetch_assoc();
    echo json_encode(["message" => $row['setting_value']]);
} else {
    
    echo json_encode(["message" => "WELCOME TO OUR STORE! HAPPY TO SERVE YOU"]);
}

$conn->close();
?>