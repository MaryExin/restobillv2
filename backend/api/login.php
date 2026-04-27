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

header("Content-Type: application/json; charset=utf-8");

$raw = file_get_contents("php://input");
$json = json_decode($raw, true);
$data = is_array($json) ? $json : $_POST;

if (
    !array_key_exists("username", $data) ||
    !array_key_exists("password", $data)
) {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Please input username and password!"
    ]);
    exit;
}

$username = trim((string)($data["username"] ?? ""));
$password = trim((string)($data["password"] ?? ""));

if ($username === "" || $password === "") {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "Please input username and password!"
    ]);
    exit;
}

try {
    $database = new Database(
        $_ENV["DB_HOST"],
        $_ENV["DB_NAME"],
        $_ENV["DB_USER"],
        $_ENV["DB_PASS"]
    );

    $pdo = $database->getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $user_gateway = new UserGateway($database);
    $user = $user_gateway->getByUsername($username);

    if ($user === false) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "User not found!"
        ]);
        exit;
    }

    if (
        array_key_exists("status", $user) &&
        trim((string)$user["status"]) !== "" &&
        trim((string)$user["status"]) !== "Active"
    ) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "userNotActivated"
        ]);
        exit;
    }

    $storedPassword =
        $user["password"] ??
        $user["User_Password"] ??
        "";

    if ($storedPassword === "") {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid password!"
        ]);
        exit;
    }

    $isPasswordValid = false;

    if (password_verify($password, $storedPassword)) {
        $isPasswordValid = true;
    } elseif ($password === $storedPassword) {
        $isPasswordValid = true;
    }

    if (!$isPasswordValid) {
        http_response_code(401);
        echo json_encode([
            "status" => "error",
            "message" => "Invalid password!"
        ]);
        exit;
    }

    $userId =
        $user["uuid"] ??
        $user["id"] ??
        $user["ID"] ??
        $user["userid"] ??
        $user["user_id"] ??
        $user["User_ID"] ??
        $user["Employee_ID"] ??
        $user["employee_id"] ??
        "";

    $userProfilePic =
        $user["image_filename"] ??
        $user["Profile_Pic"] ??
        "";

    $userEmail =
        $user["email"] ??
        $user["Email"] ??
        $username;

    $resolvedUsername =
        $user["User_Name"] ??
        $user["username"] ??
        $user["name"] ??
        $user["Name"] ??
        $username;

    /**
     * Get role
     */
    $userRole = "";
    if (method_exists($user_gateway, "getRole") && $userId !== "") {
        $userRole = $user_gateway->getRole($userId);
    } else {
        $userRole = $user["User_Role"] ?? $user["user_role"] ?? "";
    }

    /**
     * Normalize role shape for frontend:
     * frontend expects:
     * [
     *   [
     *     { "rolename": "/pricesyncing" }
     *   ]
     * ]
     */
    $formattedUserRole = [[]];

    if (is_string($userRole)) {
        $roleName = trim($userRole);
        if ($roleName !== "") {
            $formattedUserRole = [[
                ["rolename" => $roleName]
            ]];
        }
    } elseif (is_array($userRole)) {
        // Case 1: already [["rolename" => "/pricesyncing"], ...]
        if (
            isset($userRole[0]) &&
            is_array($userRole[0]) &&
            array_key_exists("rolename", $userRole[0]) &&
            !is_array($userRole[0]["rolename"])
        ) {
            $formattedUserRole = [$userRole];
        }
        // Case 2: already [[["rolename" => "/pricesyncing"]]]
        elseif (
            isset($userRole[0]) &&
            is_array($userRole[0]) &&
            isset($userRole[0][0]) &&
            is_array($userRole[0][0]) &&
            array_key_exists("rolename", $userRole[0][0]) &&
            !is_array($userRole[0][0]["rolename"])
        ) {
            $formattedUserRole = $userRole;
        }
        // Case 3: array of plain strings ["/pricesyncing", "/dashboard"]
        elseif (
            isset($userRole[0]) &&
            is_string($userRole[0])
        ) {
            $mappedRoles = [];
            foreach ($userRole as $roleItem) {
                $roleName = trim((string)$roleItem);
                if ($roleName !== "") {
                    $mappedRoles[] = ["rolename" => $roleName];
                }
            }
            $formattedUserRole = [$mappedRoles];
        }
    }

    $codec = new JWTCodec($_ENV["SECRET_KEY"]);

    require __DIR__ . "/tokens.php";

    if (isset($accessToken) && !isset($access_token)) {
        $access_token = $accessToken;
    }

    if (isset($refreshToken) && !isset($refresh_token)) {
        $refresh_token = $refreshToken;
    }

    if (isset($refreshTokenRaw) && !isset($refresh_token)) {
        $refresh_token = $refreshTokenRaw;
    }

    if (isset($refreshTokenExpiry) && !isset($refresh_token_expiry)) {
        $refresh_token_expiry = $refreshTokenExpiry;
    }

    if (!isset($access_token) || !$access_token) {
        $access_token = bin2hex(random_bytes(16));
    }

    if (!isset($refresh_token) || !$refresh_token) {
        $refresh_token = bin2hex(random_bytes(16));
    }

    $refresh_token_gateway = new RefreshTokenGateway($database, $_ENV["SECRET_KEY"]);

    if (isset($refresh_token_expiry) && $refresh_token_expiry) {
        $refresh_token_gateway->create($refresh_token, $refresh_token_expiry);
    }

    /**
     * Insert activity log
     */
    try {
        $categoryCode = "LOGIN";
        $unitCode = 0;

        if (isset($user["Unit_Code"]) && $user["Unit_Code"] !== "" && $user["Unit_Code"] !== null) {
            $unitCode = (int)$user["Unit_Code"];
        } elseif (isset($user["unit_code"]) && $user["unit_code"] !== "" && $user["unit_code"] !== null) {
            $unitCode = (int)$user["unit_code"];
        }

        $activityDateTime = date("Y-m-d H:i:s");
        $typeOfActivity = "Authentication";
        $activityPerformed = "User Login";
        $valuesOfData = json_encode([
            "userid"   => $userId,
            "username" => $resolvedUsername,
            "email"    => $userEmail,
            "role"     => $formattedUserRole,
            "ip"       => $_SERVER["REMOTE_ADDR"] ?? "",
            "browser"  => $_SERVER["HTTP_USER_AGENT"] ?? ""
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $logSql = "
            INSERT INTO tbl_main_activity_logs (
                Category_Code,
                Unit_Code,
                activity_date_time,
                user_id,
                user_name,
                type_of_activity,
                activity_performed,
                values_of_data
            ) VALUES (
                :Category_Code,
                :Unit_Code,
                :activity_date_time,
                :user_id,
                :user_name,
                :type_of_activity,
                :activity_performed,
                :values_of_data
            )
        ";

        $logStmt = $pdo->prepare($logSql);
        $logStmt->bindValue(":Category_Code", $categoryCode, PDO::PARAM_STR);
        $logStmt->bindValue(":Unit_Code", $unitCode, PDO::PARAM_INT);
        $logStmt->bindValue(":activity_date_time", $activityDateTime, PDO::PARAM_STR);
        $logStmt->bindValue(":user_id", (string)$userId, PDO::PARAM_STR);
        $logStmt->bindValue(":user_name", (string)$resolvedUsername, PDO::PARAM_STR);
        $logStmt->bindValue(":type_of_activity", $typeOfActivity, PDO::PARAM_STR);
        $logStmt->bindValue(":activity_performed", $activityPerformed, PDO::PARAM_STR);
        $logStmt->bindValue(":values_of_data", $valuesOfData, PDO::PARAM_STR);
        $logStmt->execute();
    } catch (Throwable $logError) {
        error_log("Activity log insert failed: " . $logError->getMessage());
    }

    echo json_encode([
        "status" => "success",
        "message" => "loginsuccess",
        "userid" => $userId,
        "username" => $resolvedUsername,
        "userrole" => $formattedUserRole,
        "email" => $userEmail,
        "profile_pic" => $userProfilePic,
        "access_token" => $access_token,
        "refresh_token" => $refresh_token
    ]);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "System Error: " . $e->getMessage()
    ]);
}