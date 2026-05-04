<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set('Asia/Manila');

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$config = require __DIR__ . "/config.php";

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

function valueOrDefault($input, $key, $default = "")
{
    if (!isset($input[$key])) return $default;

    $value = trim((string)$input[$key]);
    return $value !== "" ? $value : $default;
}

function nullableValue($input, $key)
{
    if (!isset($input[$key])) return null;

    $value = trim((string)$input[$key]);
    return $value;
}

function normalizeThemeRow($row)
{
    return [
        "ID" => isset($row["ID"]) ? (int)$row["ID"] : null,
        "Setting_Key" => $row["Setting_Key"] ?? "default",
        "Theme_Name" => $row["Theme_Name"] ?? "default",

        "Light_Primary" => $row["Light_Primary"] ?? "#38bdf8",
        "Light_Secondary" => $row["Light_Secondary"] ?? "#0ea5e9",
        "Light_Background" => $row["Light_Background"] ?? "#f8fafc",
        "Light_Surface" => $row["Light_Surface"] ?? "#ffffff",
        "Light_Text" => $row["Light_Text"] ?? "#0f172a",

        "Dark_Primary" => $row["Dark_Primary"] ?? "#2563eb",
        "Dark_Secondary" => $row["Dark_Secondary"] ?? "#1d4ed8",
        "Dark_Background" => $row["Dark_Background"] ?? "#0f172a",
        "Dark_Surface" => $row["Dark_Surface"] ?? "#111827",
        "Dark_Text" => $row["Dark_Text"] ?? "#ffffff",

        "Logo_Url" => $row["Logo_Url"] ?? null,
        "Login_Background_Url" => $row["Login_Background_Url"] ?? null,
        "Dashboard_Background_Url" => $row["Dashboard_Background_Url"] ?? null,

        "Status" => $row["Status"] ?? "Active",
        "Created_At" => $row["Created_At"] ?? null,
        "Updated_At" => $row["Updated_At"] ?? null,
    ];
}

function saveUploadedImage($file, $folderName = "theme")
{
    if (!isset($file) || !is_array($file)) {
        return null;
    }

    $errorCode = $file["error"] ?? UPLOAD_ERR_NO_FILE;

    if ($errorCode === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if ($errorCode !== UPLOAD_ERR_OK) {
        throw new Exception("Image upload failed.");
    }

    $tmpPath = $file["tmp_name"] ?? "";
    $fileSize = (int)($file["size"] ?? 0);

    if (!$tmpPath || !is_uploaded_file($tmpPath)) {
        throw new Exception("Invalid uploaded file.");
    }

    if ($fileSize > 5 * 1024 * 1024) {
        throw new Exception("Image must not exceed 5MB.");
    }

    $allowedMimeTypes = [
        "image/jpeg" => "jpg",
        "image/png"  => "png",
        "image/webp" => "webp",
        "image/gif"  => "gif",
    ];

    $mimeType = function_exists("mime_content_type")
        ? mime_content_type($tmpPath)
        : null;

    if (!$mimeType || !isset($allowedMimeTypes[$mimeType])) {
        throw new Exception("Only JPG, PNG, WEBP, and GIF files are allowed.");
    }

    $extension = $allowedMimeTypes[$mimeType];

    $uploadDir = dirname(__DIR__) . "/uploads/" . $folderName . "/";
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
            throw new Exception("Failed to create upload folder.");
        }
    }

    $fileName = uniqid("theme_", true) . "." . $extension;
    $destination = $uploadDir . $fileName;

    if (!move_uploaded_file($tmpPath, $destination)) {
        throw new Exception("Failed to save uploaded image.");
    }

    return "/uploads/" . $folderName . "/" . $fileName;
}

try {
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['db']};charset=utf8mb4",
        $config["user"],
        $config["pass"],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $method = $_SERVER["REQUEST_METHOD"];
    $settingKey = "default";

    if ($method === "GET") {
        $stmt = $pdo->prepare("
            SELECT
                ID,
                Setting_Key,
                Theme_Name,
                Light_Primary,
                Light_Secondary,
                Light_Background,
                Light_Surface,
                Light_Text,
                Dark_Primary,
                Dark_Secondary,
                Dark_Background,
                Dark_Surface,
                Dark_Text,
                Logo_Url,
                Login_Background_Url,
                Dashboard_Background_Url,
                Status,
                Created_At,
                Updated_At
            FROM tbl_theme_settings
            WHERE Setting_Key = :setting_key
            LIMIT 1
        ");
        $stmt->bindValue(":setting_key", $settingKey, PDO::PARAM_STR);
        $stmt->execute();

        $row = $stmt->fetch();

        if (!$row) {
            respond(true, "No theme found. Returning defaults.", [
                "ID" => null,
                "Setting_Key" => "default",
                "Theme_Name" => "default",

                "Light_Primary" => "#38bdf8",
                "Light_Secondary" => "#0ea5e9",
                "Light_Background" => "#f8fafc",
                "Light_Surface" => "#ffffff",
                "Light_Text" => "#0f172a",

                "Dark_Primary" => "#2563eb",
                "Dark_Secondary" => "#1d4ed8",
                "Dark_Background" => "#0f172a",
                "Dark_Surface" => "#111827",
                "Dark_Text" => "#ffffff",

                "Logo_Url" => null,
                "Login_Background_Url" => null,
                "Dashboard_Background_Url" => null,

                "Status" => "Active",
                "Created_At" => null,
                "Updated_At" => null
            ]);
        }

        respond(true, "Theme loaded successfully.", normalizeThemeRow($row));
    }

    if ($method === "POST") {
        $contentType = $_SERVER["CONTENT_TYPE"] ?? "";
        $isMultipart = stripos($contentType, "multipart/form-data") !== false;

        $input = [];

        if ($isMultipart) {
            $input = $_POST;
        } else {
            $raw = file_get_contents("php://input");
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $input = $decoded;
            } else {
                $input = $_POST;
            }
        }

        $themeName = valueOrDefault($input, "Theme_Name", "default");

        $lightPrimary = valueOrDefault($input, "Light_Primary", "#38bdf8");
        $lightSecondary = valueOrDefault($input, "Light_Secondary", "#0ea5e9");
        $lightBackground = valueOrDefault($input, "Light_Background", "#f8fafc");
        $lightSurface = valueOrDefault($input, "Light_Surface", "#ffffff");
        $lightText = valueOrDefault($input, "Light_Text", "#0f172a");

        $darkPrimary = valueOrDefault($input, "Dark_Primary", "#2563eb");
        $darkSecondary = valueOrDefault($input, "Dark_Secondary", "#1d4ed8");
        $darkBackground = valueOrDefault($input, "Dark_Background", "#0f172a");
        $darkSurface = valueOrDefault($input, "Dark_Surface", "#111827");
        $darkText = valueOrDefault($input, "Dark_Text", "#ffffff");

        $inputLogoUrl = nullableValue($input, "Logo_Url");
        $inputLoginBackgroundUrl = nullableValue($input, "Login_Background_Url");
        $inputDashboardBackgroundUrl = nullableValue($input, "Dashboard_Background_Url");
        $status = valueOrDefault($input, "Status", "Active");

        $stmtCheck = $pdo->prepare("
            SELECT
                ID,
                Setting_Key,
                Theme_Name,
                Light_Primary,
                Light_Secondary,
                Light_Background,
                Light_Surface,
                Light_Text,
                Dark_Primary,
                Dark_Secondary,
                Dark_Background,
                Dark_Surface,
                Dark_Text,
                Logo_Url,
                Login_Background_Url,
                Dashboard_Background_Url,
                Status,
                Created_At,
                Updated_At
            FROM tbl_theme_settings
            WHERE Setting_Key = :setting_key
            LIMIT 1
        ");
        $stmtCheck->bindValue(":setting_key", $settingKey, PDO::PARAM_STR);
        $stmtCheck->execute();

        $existing = $stmtCheck->fetch();

        $currentLogoUrl = $existing["Logo_Url"] ?? null;
        $currentLoginBackgroundUrl = $existing["Login_Background_Url"] ?? null;
        $currentDashboardBackgroundUrl = $existing["Dashboard_Background_Url"] ?? null;

        $uploadedLogoPath = saveUploadedImage($_FILES["logo_file"] ?? null, "theme");
        $uploadedLoginBackgroundPath = saveUploadedImage($_FILES["login_background_file"] ?? null, "theme");
        $uploadedDashboardBackgroundPath = saveUploadedImage($_FILES["dashboard_background_file"] ?? null, "theme");

        $logoUrl = $uploadedLogoPath !== null
            ? $uploadedLogoPath
            : ($inputLogoUrl !== null ? $inputLogoUrl : $currentLogoUrl);

        $loginBackgroundUrl = $uploadedLoginBackgroundPath !== null
            ? $uploadedLoginBackgroundPath
            : ($inputLoginBackgroundUrl !== null ? $inputLoginBackgroundUrl : $currentLoginBackgroundUrl);

        $dashboardBackgroundUrl = $uploadedDashboardBackgroundPath !== null
            ? $uploadedDashboardBackgroundPath
            : ($inputDashboardBackgroundUrl !== null ? $inputDashboardBackgroundUrl : $currentDashboardBackgroundUrl);

        if ($existing) {
            $stmtUpdate = $pdo->prepare("
                UPDATE tbl_theme_settings SET
                    Theme_Name = :theme_name,
                    Light_Primary = :light_primary,
                    Light_Secondary = :light_secondary,
                    Light_Background = :light_background,
                    Light_Surface = :light_surface,
                    Light_Text = :light_text,
                    Dark_Primary = :dark_primary,
                    Dark_Secondary = :dark_secondary,
                    Dark_Background = :dark_background,
                    Dark_Surface = :dark_surface,
                    Dark_Text = :dark_text,
                    Logo_Url = :logo_url,
                    Login_Background_Url = :login_background_url,
                    Dashboard_Background_Url = :dashboard_background_url,
                    Status = :status,
                    Updated_At = NOW()
                WHERE Setting_Key = :setting_key
            ");
            $stmtUpdate->bindValue(":theme_name", $themeName, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":light_primary", $lightPrimary, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":light_secondary", $lightSecondary, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":light_background", $lightBackground, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":light_surface", $lightSurface, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":light_text", $lightText, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":dark_primary", $darkPrimary, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":dark_secondary", $darkSecondary, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":dark_background", $darkBackground, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":dark_surface", $darkSurface, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":dark_text", $darkText, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":logo_url", $logoUrl, $logoUrl !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
            $stmtUpdate->bindValue(":login_background_url", $loginBackgroundUrl, $loginBackgroundUrl !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
            $stmtUpdate->bindValue(":dashboard_background_url", $dashboardBackgroundUrl, $dashboardBackgroundUrl !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
            $stmtUpdate->bindValue(":status", $status, PDO::PARAM_STR);
            $stmtUpdate->bindValue(":setting_key", $settingKey, PDO::PARAM_STR);
            $stmtUpdate->execute();
        } else {
            $stmtInsert = $pdo->prepare("
                INSERT INTO tbl_theme_settings (
                    Setting_Key,
                    Theme_Name,
                    Light_Primary,
                    Light_Secondary,
                    Light_Background,
                    Light_Surface,
                    Light_Text,
                    Dark_Primary,
                    Dark_Secondary,
                    Dark_Background,
                    Dark_Surface,
                    Dark_Text,
                    Logo_Url,
                    Login_Background_Url,
                    Dashboard_Background_Url,
                    Status
                ) VALUES (
                    :setting_key,
                    :theme_name,
                    :light_primary,
                    :light_secondary,
                    :light_background,
                    :light_surface,
                    :light_text,
                    :dark_primary,
                    :dark_secondary,
                    :dark_background,
                    :dark_surface,
                    :dark_text,
                    :logo_url,
                    :login_background_url,
                    :dashboard_background_url,
                    :status
                )
            ");
            $stmtInsert->bindValue(":setting_key", $settingKey, PDO::PARAM_STR);
            $stmtInsert->bindValue(":theme_name", $themeName, PDO::PARAM_STR);
            $stmtInsert->bindValue(":light_primary", $lightPrimary, PDO::PARAM_STR);
            $stmtInsert->bindValue(":light_secondary", $lightSecondary, PDO::PARAM_STR);
            $stmtInsert->bindValue(":light_background", $lightBackground, PDO::PARAM_STR);
            $stmtInsert->bindValue(":light_surface", $lightSurface, PDO::PARAM_STR);
            $stmtInsert->bindValue(":light_text", $lightText, PDO::PARAM_STR);
            $stmtInsert->bindValue(":dark_primary", $darkPrimary, PDO::PARAM_STR);
            $stmtInsert->bindValue(":dark_secondary", $darkSecondary, PDO::PARAM_STR);
            $stmtInsert->bindValue(":dark_background", $darkBackground, PDO::PARAM_STR);
            $stmtInsert->bindValue(":dark_surface", $darkSurface, PDO::PARAM_STR);
            $stmtInsert->bindValue(":dark_text", $darkText, PDO::PARAM_STR);
            $stmtInsert->bindValue(":logo_url", $logoUrl, $logoUrl !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
            $stmtInsert->bindValue(":login_background_url", $loginBackgroundUrl, $loginBackgroundUrl !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
            $stmtInsert->bindValue(":dashboard_background_url", $dashboardBackgroundUrl, $dashboardBackgroundUrl !== null ? PDO::PARAM_STR : PDO::PARAM_NULL);
            $stmtInsert->bindValue(":status", $status, PDO::PARAM_STR);
            $stmtInsert->execute();
        }

        $stmtRead = $pdo->prepare("
            SELECT
                ID,
                Setting_Key,
                Theme_Name,
                Light_Primary,
                Light_Secondary,
                Light_Background,
                Light_Surface,
                Light_Text,
                Dark_Primary,
                Dark_Secondary,
                Dark_Background,
                Dark_Surface,
                Dark_Text,
                Logo_Url,
                Login_Background_Url,
                Dashboard_Background_Url,
                Status,
                Created_At,
                Updated_At
            FROM tbl_theme_settings
            WHERE Setting_Key = :setting_key
            LIMIT 1
        ");
        $stmtRead->bindValue(":setting_key", $settingKey, PDO::PARAM_STR);
        $stmtRead->execute();

        $row = $stmtRead->fetch();

        respond(
            true,
            $existing ? "Theme updated successfully." : "Theme saved successfully.",
            normalizeThemeRow($row)
        );
    }

    respond(false, "Method not allowed. Use GET or POST.", null, 405);

} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}