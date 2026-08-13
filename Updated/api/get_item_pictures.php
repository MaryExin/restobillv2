<?php
/**
 * Path: api/get_item_pictures.php
 * Description: Fetches POS settings to determine if product images are enabled.
 */

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Load the database configuration
$config = require_once 'config.php';

try {
    // Establish connection using PDO
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}",
        $config['user'],
        $config['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    // Query the specific setting for item pictures
    $stmt = $pdo->prepare("SELECT value FROM tbl_pos_settings WHERE description = 'Enable Item Pictures' LIMIT 1");
    $stmt->execute();
    $setting = $stmt->fetch();

    // Respond with the boolean status
    echo json_encode([
        "status" => "success",
        "enableItemPictures" => ($setting && $setting['value'] === 'True') ? true : false
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Connection failed: " . $e->getMessage()
    ]);
}
?>