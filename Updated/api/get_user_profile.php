<?php

declare(strict_types=1);

require __DIR__ . "/secure_guard.php";

if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "POST"], true)) {
    http_response_code(405);
    header("Allow: GET, POST");
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

function posProfileRoleLabel($value): string
{
    $role = strtoupper(trim((string)($value ?? "")));
    if (in_array($role, ["0", "CASHIER"], true)) {
        return "Cashier";
    }
    if (in_array($role, ["1", "ADMIN", "MANAGER", "SUPERVISOR"], true)) {
        return "Admin";
    }
    if (in_array($role, ["2", "SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN"], true)) {
        return "Super Admin";
    }

    return trim((string)($value ?? ""));
}

try {
    $authenticatedUserId = (string)($GLOBALS["pos_user_id"] ?? "");
    posRoleAuthRequirePermission(
        $pdo,
        $authenticatedUserId,
        "settings",
        "myAccount"
    );

    if (posRoleAuthIsDeveloperSession()) {
        if ($_SERVER["REQUEST_METHOD"] === "POST") {
            http_response_code(403);
            echo json_encode([
                "success" => false,
                "message" => "Developer credentials are managed in the protected database record."
            ]);
            exit;
        }

        $uuid = trim((string)($_GET["user_id"] ?? ""));
        if ($uuid === "" || !hash_equals($authenticatedUserId, $uuid)) {
            http_response_code(403);
            echo json_encode(["error" => "You may only view your own profile."]);
            exit;
        }

        $developer = posDeveloperVirtualUser();
        $branchStmt = $pdo->query("SELECT Unit_Name FROM tbl_main_business_units LIMIT 1");
        $branch = $branchStmt->fetch();
        echo json_encode([
            "uuid" => $developer["uuid"],
            "firstname" => $developer["firstname"],
            "lastname" => $developer["lastname"],
            "email" => $developer["email"],
            "department" => $developer["department"],
            "classification" => "Developer",
            "classification_value" => "DEVELOPER",
            "branch_name" => $branch ? $branch["Unit_Name"] : "N/A",
            "profile_pic_url" => null,
            "is_developer_mode" => true,
        ]);
        exit;
    }

    // --- PASSWORD UPDATE LOGIC (POST) ---
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Invalid JSON body."]);
            exit;
        }
        $uuid = $data['user_id'] ?? null;
        $currentPass = $data['current_password'] ?? null;
        $newPass = $data['new_password'] ?? null;

        if (!$uuid || !$currentPass || !$newPass) {
            http_response_code(422);
            echo json_encode(["success" => false, "message" => "Incomplete data provided."]);
            exit;
        }
        if (!hash_equals($authenticatedUserId, (string)$uuid)) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "You may only update your own password."]);
            exit;
        }
        if (strlen((string)$newPass) < 8 || strlen((string)$newPass) > 72) {
            http_response_code(422);
            echo json_encode(["success" => false, "message" => "New password must be 8 to 72 characters."]);
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
            http_response_code(422);
            echo json_encode(["success" => false, "message" => "Incorrect current password."]);
        }
        exit;
    }

    // --- PROFILE FETCHING LOGIC (GET) ---
    $uuid = $_GET['user_id'] ?? null;
    if (!$uuid) {
        http_response_code(400);
        echo json_encode(["error" => "No UUID provided"]);
        exit;
    }
    if (!hash_equals($authenticatedUserId, (string)$uuid)) {
        http_response_code(403);
        echo json_encode(["error" => "You may only view your own profile."]);
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
            "classification" => posProfileRoleLabel($user['classification']),
            "classification_value" => $user['classification'],
            "branch_name" => $branch ? $branch['Unit_Name'] : "N/A",
            "profile_pic_url" => $finalImage 
        ]);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "User not found"]);
    }
} catch (Throwable $e) {
    error_log("POS user profile error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Unable to process the user profile request."]);
}
