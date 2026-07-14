<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Dagdag na settings para sa malalaking file
ini_set('memory_limit', '512M');
ini_set('max_execution_time', 300);

$host = "localhost";
$user = "root";
$pass = "";
$dbName = "db_pos"; 

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['sql_file'])) {
        echo json_encode(["success" => false, "message" => "Walang file na natanggap."]);
        exit;
    }

    $file = $_FILES['sql_file']['tmp_name'];
    $conn = new mysqli($host, $user, $pass);

    if ($conn->connect_error) {
        echo json_encode(["success" => false, "message" => "MySQL Connection Failed: " . $conn->connect_error]);
        exit;
    }

    // 1. RECREATE DATABASE
    $conn->query("DROP DATABASE IF EXISTS $dbName");
    $conn->query("CREATE DATABASE $dbName");
    $conn->select_db($dbName);

    // 2. READ AND EXECUTE SQL LINE BY LINE (Mas matibay ito)
    $templine = '';
    $lines = file($file);
    $errorCount = 0;

    foreach ($lines as $line) {
        // Laktawan ang comments
        if (substr($line, 0, 2) == '--' || $line == '') continue;

        $templine .= $line;

        // Kapag nakakita ng semicolon, ibig sabihin end of query na
        if (substr(trim($line), -1, 1) == ';') {
            if (!$conn->query($templine)) {
                $errorCount++;
            }
            $templine = '';
        }
    }

    if ($errorCount === 0) {
        echo json_encode(["success" => true, "message" => "Database 'db_pos' replaced successfully!"]);
    } else {
        echo json_encode(["success" => true, "message" => "Imported with $errorCount minor errors. Check your tables."]);
    }

    $conn->close();
    exit;
}
?>