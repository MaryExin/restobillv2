<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
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

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        if (isset($_GET['get_units'])) {
            $stmt = $pdo->query("SELECT Unit_Name FROM tbl_main_business_units ORDER BY Unit_Name ASC");
            echo json_encode($stmt->fetchAll());
        } else {
            $sql = "SELECT 
                        u.uuid, 
                        u.email as username, 
                        u.firstname, 
                        u.middlename, 
                        u.lastname, 
                        u.classification as position, 
                        u.company, 
                        e.image_filename as profile_pix 
                    FROM tbl_users_global_assignment u
                    LEFT JOIN tbl_employees e ON u.uuid = e.empid 
                    WHERE u.deletestatus = 'Active' 
                    ORDER BY u.createtime DESC";
            $stmt = $pdo->query($sql);
            echo json_encode($stmt->fetchAll());
        }
    } 

    else if ($method === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        
        // Generate UUID (empid)
        $newUuid = date("YmdHis") . rand(10, 99);
        $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);
        $fileNameForDb = ""; 
        $creator = $data['creatorUuid'] ?? "SYSTEM_ADMIN"; // Tracker kung sinong nag-create

        if (!empty($data['image'])) {
            $uploadDir = "../profile_pictures/"; 
            if (!is_dir($uploadDir)) { mkdir($uploadDir, 0777, true); }

            $imgData = str_replace(['data:image/jpeg;base64,', 'data:image/png;base64,', ' '], ['', '', '+'], $data['image']);
            $fileNameForDb = $newUuid . ".jpg";
            file_put_contents($uploadDir . $fileNameForDb, base64_decode($imgData));
        }

        $pdo->beginTransaction();

        try {
            // 1. Insert sa tbl_users_global_assignment
            $queryUser = "INSERT INTO tbl_users_global_assignment 
                          (uuid, email, classification, password, firstname, middlename, lastname, 
                           company, department, contactnumber, status, verified, passlock, deletestatus, createtime) 
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'Verified', 0, 'Active', NOW())";
            
            $stmtUser = $pdo->prepare($queryUser);
            $stmtUser->execute([
                $newUuid, $data['username'], $data['position'], $hashedPassword,
                $data['firstName'], $data['middleName'] ?? "", $data['lastName'],
                $data['company'], $data['position'], $data['contact']
            ]);

            // 2. Insert sa tbl_employees (Full Details base sa CSV headers)
            $queryEmp = "INSERT INTO tbl_employees 
                         (empid, user_id, firstname, middlename, lastname, position, department, 
                          contact_no, email, busunit_code, status, deletestatus, usertracker, createdtime, image_filename) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'Active', ?, NOW(), ?)";
            
            $stmtEmp = $pdo->prepare($queryEmp);
            $stmtEmp->execute([
                $newUuid, 
                $newUuid, // user_id is usually same as uuid or empid
                $data['firstName'], 
                $data['middleName'] ?? "", 
                $data['lastName'], 
                $data['position'], 
                $data['position'], // department set to position for now
                $data['contact'], 
                $data['username'], 
                $data['company'], // Assuming company name matches busunit link
                $creator,
                $fileNameForDb
            ]);

            $pdo->commit();
            echo json_encode(["success" => true, "uuid" => $newUuid]);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    else if ($method === 'DELETE') {
        $data = json_decode(file_get_contents("php://input"), true);
        if (isset($data['uuid'])) {
            // Update status sa parehong tables
            $stmt1 = $pdo->prepare("UPDATE tbl_users_global_assignment SET deletestatus = 'Inactive' WHERE uuid = ?");
            $stmt1->execute([$data['uuid']]);
            
            $stmt2 = $pdo->prepare("UPDATE tbl_employees SET deletestatus = 'Inactive', status = 'Inactive' WHERE empid = ?");
            $stmt2->execute([$data['uuid']]);
            
            echo json_encode(["success" => true]);
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}