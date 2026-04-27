<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

try {
    $config = require_once './config.php'; 

    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // --- PASSWORD UPDATE LOGIC (POST) ---
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        $uuid = $data['user_id'] ?? null;
        $currentPass = $data['current_password'] ?? null;
        $newPass = $data['new_password'] ?? null;

        if (!$uuid || !$currentPass || !$newPass) {
            echo json_encode(["success" => false, "message" => "Incomplete data provided."]);
            exit;
        }

        // Fetch current password hash from database
        $checkSql = "SELECT password FROM tbl_users_global_assignment WHERE uuid = :uuid LIMIT 1";
        $stmtCheck = $pdo->prepare($checkSql);
        $stmtCheck->execute(['uuid' => $uuid]);
        $dbUser = $stmtCheck->fetch();

        // Verify if the provided current password matches the one in DB
        if ($dbUser && password_verify($currentPass, $dbUser['password'])) {
            $hashedPass = password_hash($newPass, PASSWORD_BCRYPT);
            $updateSql = "UPDATE tbl_users_global_assignment SET password = :password WHERE uuid = :uuid";
            $stmtUpdate = $pdo->prepare($updateSql);
            
            if ($stmtUpdate->execute(['password' => $hashedPass, 'uuid' => $uuid])) {
                echo json_encode(["success" => true, "message" => "Password updated successfully!"]);
            } else {
                echo json_encode(["success" => false, "message" => "Database update failed."]);
            }
        } else {
            echo json_encode(["success" => false, "message" => "Incorrect current password."]);
        }
        exit;
    }

    // --- PROFILE FETCHING LOGIC (GET) ---
    $uuid = $_GET['user_id'] ?? null;
    if (!$uuid) {
        echo json_encode(["error" => "No UUID provided"]);
        exit;
    }

    $sql = "SELECT 
                u.uuid, u.firstname, u.lastname, u.email, 
                u.department, u.classification,
                e.image_filename 
            FROM tbl_users_global_assignment u
            LEFT JOIN tbl_employees e ON u.uuid = e.empid
            WHERE u.uuid = :uuid LIMIT 1";
            
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['uuid' => $uuid]);
    $user = $stmt->fetch();

    if ($user) {
        // Fetch Branch Name
        $branchQuery = "SELECT Unit_Name FROM tbl_main_business_units LIMIT 1";
        $stmtBranch = $pdo->query($branchQuery);
        $branch = $stmtBranch->fetch();

        $imageNameFromDb = $user['image_filename']; 
        $local_folder = "profile_pictures/";
        $full_server_path = "../" . $local_folder . $imageNameFromDb; 
        
        $finalImage = (!empty($imageNameFromDb) && file_exists($full_server_path)) 
                      ? $local_folder . $imageNameFromDb 
                      : null;

        echo json_encode([
            "uuid" => $user['uuid'],
            "firstname" => $user['firstname'],
            "lastname" => $user['lastname'],
            "email" => $user['email'],
            "department" => $user['department'],
            "classification" => $user['classification'],
            "branch_name" => $branch ? $branch['Unit_Name'] : "N/A",
            "profile_pic_url" => $finalImage 
        ]);
    } else {
        echo json_encode(["error" => "User not found"]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}