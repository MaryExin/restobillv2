<?php

declare(strict_types=1);

require __DIR__ . "/pdo.php";
require __DIR__ . "/bootstrap.php";

// Initialize CORS
$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

// Security / Auth
$database = new Database($config["host"], $config["db"], $config["user"], $config["pass"]);
$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit; 
}

$user_id = $auth->getUserID();
$method = $_SERVER["REQUEST_METHOD"];
$id = $_GET["id"] ?? null;

// Handle API Logic
try {
    if ($method === "GET") {
        $stmt = $pdo->query("SELECT * FROM tbl_pos_printers WHERE deletestatus = 'Active' ORDER BY sequence_order ASC");
        echo json_encode($stmt->fetchAll());
    } 
    
    elseif ($method === "POST") {
        $data = json_decode(file_get_contents("php://input"), true);
        
        $sql = "INSERT INTO tbl_pos_printers (
                    printer_name, printer_type, doc_type, sequence_order, usertracker
                ) VALUES (
                    :name, :type, :doc, :seq_order, :user
                )";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ":name"      => $data["printer_name"],
            ":type"      => $data["printer_type"],
            ":doc"       => $data["doc_type"],
            ":seq_order" => $data["sequence_order"] ?? 1,
            ":user"      => $user_id
        ]);
        
        echo json_encode(["message" => "Printer created", "id" => $pdo->lastInsertId()]);
    } 
    
    elseif ($method === "PATCH" && $id) {
        $data = json_decode(file_get_contents("php://input"), true);
        
        $sql = "UPDATE tbl_pos_printers 
                SET printer_name = :name, 
                    printer_type = :type, 
                    doc_type = :doc, 
                    sequence_order = :seq_order, 
                    usertracker = :user 
                WHERE seq = :id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ":name"      => $data["printer_name"],
            ":type"      => $data["printer_type"],
            ":doc"       => $data["doc_type"],
            ":seq_order" => $data["sequence_order"] ?? 1,
            ":user"      => $user_id,
            ":id"        => $id
        ]);
        
        echo json_encode(["message" => "Printer updated"]);
    } 
    
    elseif ($method === "DELETE" && $id) {
        $sql = "DELETE FROM tbl_pos_printers WHERE seq = :id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ":id"   => $id
        ]);
        
        echo json_encode(["message" => "Printer deleted"]);
    } 
    
    else {
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => $e->getMessage()]);
}