<?php

declare(strict_types=1);

require __DIR__ . "/secure_guard.php";

if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "POST", "PATCH", "DELETE"], true)) {
    http_response_code(405);
    header("Allow: GET, POST, PATCH, DELETE");
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

function respondPosManage($payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function posManageRequestBody(): array
{
    $data = json_decode(file_get_contents("php://input"), true);
    if (!is_array($data)) {
        respondPosManage(["success" => false, "error" => "Invalid JSON body."], 400);
    }

    return $data;
}

function posManageText($value, int $maxLength = 255): string
{
    return substr(trim((string)($value ?? "")), 0, $maxLength);
}

function normalizePosRegistrationRole($value): string
{
    $role = strtoupper(posManageText($value, 64));
    if ($role === "") {
        return "0";
    }

    $map = [
        "0" => "0",
        "CASHIER" => "0",
        "1" => "1",
        "ADMIN" => "1",
        "MANAGER" => "1",
        "SUPERVISOR" => "1",
        "2" => "2",
        "SUPER ADMIN" => "2",
        "SUPER_ADMIN" => "2",
        "SUPERADMIN" => "2",
    ];

    if (isset($map[$role])) {
        return $map[$role];
    }

    $safe = preg_replace("/[^A-Za-z0-9 _-]/", "", posManageText($value, 64));
    return substr($safe !== "" ? $safe : "0", 0, 45);
}

function posRegistrationRoleLabel($value): string
{
    $role = normalizePosRegistrationRole($value);
    if ($role === "2") {
        return "SUPER ADMIN";
    }
    if ($role === "1") {
        return "ADMIN";
    }
    if ($role === "0") {
        return "CASHIER";
    }

    return strtoupper($role);
}

function stagePosProfileImage(string $uuid, $image): ?array
{
    $encoded = trim((string)($image ?? ""));
    if ($encoded === "") {
        return null;
    }

    if (strlen($encoded) > 14000000) {
        throw new InvalidArgumentException("Profile image is too large.");
    }

    $encoded = preg_replace(
        "#^data:image/(?:jpe?g|png);base64,#i",
        "",
        $encoded
    );
    $encoded = str_replace(" ", "+", (string)$encoded);
    $binary = base64_decode($encoded, true);

    if ($binary === false || $binary === "") {
        throw new InvalidArgumentException("Invalid profile image.");
    }

    if (!preg_match("/^[A-Za-z0-9_-]+$/", $uuid)) {
        throw new InvalidArgumentException("Invalid user UUID.");
    }

    $uploadDir = dirname(__DIR__) . "/profile_pictures";
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
        throw new RuntimeException("Unable to create the profile picture directory.");
    }

    $temporaryPath = tempnam($uploadDir, ".pending-profile-");
    if ($temporaryPath === false) {
        throw new RuntimeException("Unable to stage the profile image.");
    }

    if (file_put_contents($temporaryPath, $binary, LOCK_EX) === false) {
        @unlink($temporaryPath);
        throw new RuntimeException("Unable to stage the profile image.");
    }

    $fileName = $uuid . "-" . bin2hex(random_bytes(6)) . ".jpg";
    return [
        "file_name" => $fileName,
        "temporary_path" => $temporaryPath,
        "final_path" => $uploadDir . "/" . $fileName,
    ];
}

function finalizePosProfileImage(?array $stagedImage): void
{
    if ($stagedImage === null) {
        return;
    }
    if (!rename($stagedImage["temporary_path"], $stagedImage["final_path"])) {
        throw new RuntimeException("Unable to finalize the profile image.");
    }
}

function discardPosProfileImage(?array $stagedImage, bool $includeFinal = false): void
{
    if ($stagedImage === null) {
        return;
    }
    if (is_file($stagedImage["temporary_path"])) {
        @unlink($stagedImage["temporary_path"]);
    }
    if ($includeFinal && is_file($stagedImage["final_path"])) {
        @unlink($stagedImage["final_path"]);
    }
}

function requirePosManageFields(array $data, array $fields): void
{
    foreach ($fields as $field) {
        if (posManageText($data[$field] ?? "") === "") {
            respondPosManage([
                "success" => false,
                "error" => "Missing required field: " . $field,
            ], 422);
        }
    }
}

function validatePosManagePayload(array $data, bool $requirePassword): void
{
    $required = ["username", "firstName", "lastName", "company"];
    if ($requirePassword) {
        $required[] = "password";
    }
    requirePosManageFields($data, $required);

    $limits = [
        "username" => 45,
        "firstName" => 45,
        "middleName" => 45,
        "lastName" => 45,
        "contact" => 45,
        "company" => 45,
        "position" => 45,
    ];
    foreach ($limits as $field => $limit) {
        if (strlen(trim((string)($data[$field] ?? ""))) > $limit) {
            respondPosManage([
                "success" => false,
                "error" => $field . " exceeds the " . $limit . " character limit.",
            ], 422);
        }
    }

    $contactDigits = preg_replace("/[^0-9]/", "", (string)($data["contact"] ?? ""));
    if (strlen((string)$contactDigits) > 19) {
        respondPosManage([
            "success" => false,
            "error" => "contact exceeds the supported numeric length.",
        ], 422);
    }

}

function requireUniquePosManageEmail(PDO $pdo, string $email, string $excludeUuid = ""): void
{
    $stmt = $pdo->prepare("
        SELECT uuid
        FROM tbl_users_global_assignment
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(:email))
          AND (:exclude_uuid = '' OR uuid <> :exclude_uuid_match)
        LIMIT 1
    ");
    $stmt->execute([
        ":email" => $email,
        ":exclude_uuid" => $excludeUuid,
        ":exclude_uuid_match" => $excludeUuid,
    ]);
    if ($stmt->fetchColumn() !== false) {
        respondPosManage([
            "success" => false,
            "error" => "That username is already registered.",
        ], 409);
    }
}

function insertMissingPosEmployee(PDO $pdo, array $values): void
{
    $stmt = $pdo->prepare("
        INSERT INTO tbl_employees (
            payroll_empid,
            empid,
            user_id,
            firstname,
            middlename,
            lastname,
            position,
            department,
            birthdate,
            sss,
            phic,
            mdf,
            tin,
            contact_no,
            email,
            address,
            salary,
            salary_type,
            date_started,
            status,
            tax_class,
            spp_class,
            busunit_code,
            factordays,
            image_filename,
            deletestatus,
            usertracker,
            createdtime
        ) VALUES (
            '',
            :empid,
            :user_id,
            :firstname,
            :middlename,
            :lastname,
            :position,
            :department,
            '0000-00-00',
            0,
            0,
            0,
            0,
            :contact_no,
            :email,
            '',
            0,
            '',
            '0000-00-00',
            'Active',
            '',
            '',
            :busunit_code,
            0,
            :image_filename,
            'Active',
            :usertracker,
            NOW()
        )
    ");
    $stmt->execute([
        ":empid" => $values["uuid"],
        ":user_id" => $values["uuid"],
        ":firstname" => $values["firstname"],
        ":middlename" => $values["middlename"],
        ":lastname" => $values["lastname"],
        ":position" => $values["role"],
        ":department" => $values["role"],
        ":contact_no" => $values["contact_no"],
        ":email" => $values["email"],
        ":busunit_code" => $values["company"],
        ":image_filename" => $values["image_filename"],
        ":usertracker" => $values["usertracker"],
    ]);
}

function removeReplacedPosProfileImage(string $oldFileName, string $newFileName): void
{
    $oldFileName = trim($oldFileName);
    if (
        $oldFileName === "" ||
        $oldFileName === $newFileName ||
        basename($oldFileName) !== $oldFileName
    ) {
        return;
    }

    $oldPath = dirname(__DIR__) . "/profile_pictures/" . $oldFileName;
    if (is_file($oldPath)) {
        @unlink($oldPath);
    }
}

try {
    $method = $_SERVER["REQUEST_METHOD"];
    $authenticatedUserId = (string)($GLOBALS["pos_user_id"] ?? "");
    posRoleAuthRequirePermission(
        $pdo,
        $authenticatedUserId,
        "settings",
        "userAccounts"
    );

    if ($method === "GET") {
        if (isset($_GET["get_units"])) {
            $stmt = $pdo->query("
                SELECT Unit_Code, Unit_Name
                FROM tbl_main_business_units
                ORDER BY Unit_Name ASC
            ");
            respondPosManage($stmt->fetchAll());
        }

        $stmt = $pdo->query("
            SELECT
                u.uuid,
                u.email AS username,
                u.firstname,
                u.middlename,
                u.lastname,
                u.classification AS position,
                u.company,
                u.contactnumber AS contact,
                e.image_filename AS profile_pix
            FROM tbl_users_global_assignment u
            LEFT JOIN tbl_employees e ON e.empid = u.uuid
            WHERE UPPER(TRIM(u.status)) = 'ACTIVE'
              AND UPPER(TRIM(u.deletestatus)) = 'ACTIVE'
            ORDER BY u.createtime DESC
        ");
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row["role_label"] = posRegistrationRoleLabel($row["position"] ?? "");
        }
        unset($row);

        respondPosManage($rows);
    }

    if ($method === "POST") {
        $data = posManageRequestBody();
        validatePosManagePayload($data, true);

        $newUuid = date("YmdHis") . random_int(10, 99);
        $roleValue = normalizePosRegistrationRole($data["position"] ?? $data["role"] ?? "0");
        if (posRoleAuthRoleRow($pdo, $roleValue) === null) {
            respondPosManage([
                "success" => false,
                "error" => "Select an active user role.",
            ], 422);
        }
        posRoleAuthRequireManageRoleValue($pdo, $authenticatedUserId, $roleValue);

        $email = posManageText($data["username"], 45);
        requireUniquePosManageEmail($pdo, $email);
        $creator = posManageText(
            $authenticatedUserId,
            255
        );
        $middleName = posManageText($data["middleName"] ?? "", 45);
        $contact = posManageText($data["contact"] ?? "", 45);
        $company = posManageText($data["company"], 45);
        $employeeContact = preg_replace("/[^0-9]/", "", $contact);
        $employeeContact = $employeeContact !== "" ? $employeeContact : "0";
        $stagedImage = stagePosProfileImage($newUuid, $data["image"] ?? null);
        $fileNameForDb = $stagedImage["file_name"] ?? "";
        $hashedPassword = password_hash((string)$data["password"], PASSWORD_BCRYPT);

        $pdo->beginTransaction();
        try {
            $stmtUser = $pdo->prepare("
                INSERT INTO tbl_users_global_assignment (
                    uuid,
                    email,
                    classification,
                    password,
                    firstname,
                    middlename,
                    lastname,
                    company,
                    department,
                    contactnumber,
                    status,
                    verified,
                    passlock,
                    otp,
                    otplock,
                    usertracker,
                    deletestatus,
                    createtime
                ) VALUES (
                    :uuid,
                    :email,
                    :classification,
                    :password,
                    :firstname,
                    :middlename,
                    :lastname,
                    :company,
                    :department,
                    :contactnumber,
                    :status,
                    :verified,
                    :passlock,
                    :otp,
                    :otplock,
                    :usertracker,
                    :deletestatus,
                    NOW()
                )
            ");
            $stmtUser->execute([
                ":uuid" => $newUuid,
                ":email" => $email,
                ":classification" => $roleValue,
                ":password" => $hashedPassword,
                ":firstname" => posManageText($data["firstName"], 45),
                ":middlename" => $middleName,
                ":lastname" => posManageText($data["lastName"], 45),
                ":company" => $company,
                ":department" => $roleValue,
                ":contactnumber" => $contact,
                ":status" => "Active",
                ":verified" => "Verified",
                ":passlock" => 0,
                ":otp" => 0,
                ":otplock" => 0,
                ":usertracker" => $creator,
                ":deletestatus" => "Active",
            ]);

            $stmtEmployee = $pdo->prepare("
                INSERT INTO tbl_employees (
                    payroll_empid,
                    empid,
                    user_id,
                    firstname,
                    middlename,
                    lastname,
                    position,
                    department,
                    birthdate,
                    sss,
                    phic,
                    mdf,
                    tin,
                    contact_no,
                    email,
                    address,
                    salary,
                    salary_type,
                    date_started,
                    status,
                    tax_class,
                    spp_class,
                    busunit_code,
                    factordays,
                    image_filename,
                    deletestatus,
                    usertracker,
                    createdtime
                ) VALUES (
                    :payroll_empid,
                    :empid,
                    :user_id,
                    :firstname,
                    :middlename,
                    :lastname,
                    :position,
                    :department,
                    :birthdate,
                    :sss,
                    :phic,
                    :mdf,
                    :tin,
                    :contact_no,
                    :email,
                    :address,
                    :salary,
                    :salary_type,
                    :date_started,
                    :status,
                    :tax_class,
                    :spp_class,
                    :busunit_code,
                    :factordays,
                    :image_filename,
                    :deletestatus,
                    :usertracker,
                    NOW()
                )
            ");
            $stmtEmployee->execute([
                ":payroll_empid" => "",
                ":empid" => $newUuid,
                ":user_id" => $newUuid,
                ":firstname" => posManageText($data["firstName"], 45),
                ":middlename" => $middleName,
                ":lastname" => posManageText($data["lastName"], 45),
                ":position" => $roleValue,
                ":department" => $roleValue,
                ":birthdate" => "0000-00-00",
                ":sss" => 0,
                ":phic" => 0,
                ":mdf" => 0,
                ":tin" => 0,
                ":contact_no" => $employeeContact,
                ":email" => $email,
                ":address" => "",
                ":salary" => 0,
                ":salary_type" => "",
                ":date_started" => "0000-00-00",
                ":status" => "Active",
                ":tax_class" => "",
                ":spp_class" => "",
                ":busunit_code" => $company,
                ":factordays" => 0,
                ":image_filename" => $fileNameForDb,
                ":deletestatus" => "Active",
                ":usertracker" => $creator,
            ]);

            finalizePosProfileImage($stagedImage);
            $pdo->commit();
            $stagedImage = null;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            discardPosProfileImage($stagedImage, true);
            throw $e;
        }

        respondPosManage([
            "success" => true,
            "uuid" => $newUuid,
            "classification" => $roleValue,
            "profile_pix" => $fileNameForDb,
        ]);
    }

    if ($method === "PATCH") {
        $data = posManageRequestBody();
        requirePosManageFields($data, ["uuid"]);
        validatePosManagePayload($data, false);

        $uuid = posManageText($data["uuid"], 255);
        if (!preg_match("/^[A-Za-z0-9_-]+$/", $uuid)) {
            respondPosManage(["success" => false, "error" => "Invalid user UUID."], 422);
        }

        $existingStmt = $pdo->prepare("
            SELECT
                u.classification,
                e.empid AS employee_uuid,
                e.image_filename
            FROM tbl_users_global_assignment u
            LEFT JOIN tbl_employees e ON e.empid = u.uuid
            WHERE u.uuid = :uuid
              AND UPPER(TRIM(u.status)) = 'ACTIVE'
              AND UPPER(TRIM(u.deletestatus)) = 'ACTIVE'
            LIMIT 1
        ");
        $existingStmt->execute([":uuid" => $uuid]);
        $existingUser = $existingStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($existingUser)) {
            respondPosManage(["success" => false, "error" => "User not found."], 404);
        }
        $employeeMissing = trim((string)($existingUser["employee_uuid"] ?? "")) === "";

        posRoleAuthRequireManageRoleValue(
            $pdo,
            $authenticatedUserId,
            $existingUser["classification"] ?? ""
        );
        $roleValue = normalizePosRegistrationRole($data["position"] ?? $data["role"] ?? "0");
        if (posRoleAuthRoleRow($pdo, $roleValue) === null) {
            respondPosManage([
                "success" => false,
                "error" => "Select an active user role.",
            ], 422);
        }
        posRoleAuthRequireManageRoleValue($pdo, $authenticatedUserId, $roleValue);

        if (
            hash_equals($authenticatedUserId, $uuid)
            && posRoleAuthCanonicalValue($existingUser["classification"] ?? "")
                !== posRoleAuthCanonicalValue($roleValue)
        ) {
            respondPosManage([
                "success" => false,
                "error" => "You cannot change the role of your own signed-in account.",
            ], 409);
        }

        $email = posManageText($data["username"], 45);
        requireUniquePosManageEmail($pdo, $email, $uuid);
        $middleName = posManageText($data["middleName"] ?? "", 45);
        $contact = posManageText($data["contact"] ?? "", 45);
        $company = posManageText($data["company"], 45);
        $employeeContact = preg_replace("/[^0-9]/", "", $contact);
        $employeeContact = $employeeContact !== "" ? $employeeContact : "0";
        $currentImage = (string)($existingUser["image_filename"] ?? "");
        $stagedImage = stagePosProfileImage($uuid, $data["image"] ?? null);
        $newImage = $stagedImage["file_name"] ?? null;
        $profileImage = $newImage ?? $currentImage;

        $pdo->beginTransaction();
        try {
            $stmtUser = $pdo->prepare("
                UPDATE tbl_users_global_assignment
                SET
                    email = :email,
                    classification = :classification,
                    firstname = :firstname,
                    middlename = :middlename,
                    lastname = :lastname,
                    company = :company,
                    department = :department,
                    contactnumber = :contactnumber
                WHERE uuid = :uuid
            ");
            $stmtUser->execute([
                ":email" => $email,
                ":classification" => $roleValue,
                ":firstname" => posManageText($data["firstName"], 45),
                ":middlename" => $middleName,
                ":lastname" => posManageText($data["lastName"], 45),
                ":company" => $company,
                ":department" => $roleValue,
                ":contactnumber" => $contact,
                ":uuid" => $uuid,
            ]);

            if (posManageText($data["password"] ?? "") !== "") {
                $stmtPassword = $pdo->prepare("
                    UPDATE tbl_users_global_assignment
                    SET password = :password
                    WHERE uuid = :uuid
                ");
                $stmtPassword->execute([
                    ":password" => password_hash((string)$data["password"], PASSWORD_BCRYPT),
                    ":uuid" => $uuid,
                ]);
            }

            if ($employeeMissing) {
                insertMissingPosEmployee($pdo, [
                    "uuid" => $uuid,
                    "firstname" => posManageText($data["firstName"], 45),
                    "middlename" => $middleName,
                    "lastname" => posManageText($data["lastName"], 45),
                    "role" => $roleValue,
                    "contact_no" => $employeeContact,
                    "email" => $email,
                    "company" => $company,
                    "image_filename" => $profileImage,
                    "usertracker" => $authenticatedUserId,
                ]);
            } else {
                $employeeSql = "
                    UPDATE tbl_employees
                    SET
                        firstname = :firstname,
                        middlename = :middlename,
                        lastname = :lastname,
                        position = :position,
                        department = :department,
                        contact_no = :contact_no,
                        email = :email,
                        busunit_code = :busunit_code
                ";
                if ($newImage !== null) {
                    $employeeSql .= ", image_filename = :image_filename";
                }
                $employeeSql .= " WHERE empid = :empid";

                $employeeParams = [
                    ":firstname" => posManageText($data["firstName"], 45),
                    ":middlename" => $middleName,
                    ":lastname" => posManageText($data["lastName"], 45),
                    ":position" => $roleValue,
                    ":department" => $roleValue,
                    ":contact_no" => $employeeContact,
                    ":email" => $email,
                    ":busunit_code" => $company,
                    ":empid" => $uuid,
                ];
                if ($newImage !== null) {
                    $employeeParams[":image_filename"] = $newImage;
                }

                $stmtEmployee = $pdo->prepare($employeeSql);
                $stmtEmployee->execute($employeeParams);
            }

            finalizePosProfileImage($stagedImage);
            $pdo->commit();
            $stagedImage = null;
            if ($newImage !== null) {
                removeReplacedPosProfileImage($currentImage, $newImage);
            }
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            discardPosProfileImage($stagedImage, true);
            throw $e;
        }

        respondPosManage([
            "success" => true,
            "uuid" => $uuid,
            "classification" => $roleValue,
            "profile_pix" => $profileImage,
        ]);
    }

    $data = posManageRequestBody();
    $uuid = posManageText($data["uuid"] ?? "", 255);
    if ($uuid === "") {
        respondPosManage(["success" => false, "error" => "Missing uuid"], 400);
    }
    if (!preg_match("/^[A-Za-z0-9_-]+$/", $uuid)) {
        respondPosManage(["success" => false, "error" => "Invalid user UUID."], 422);
    }
    if (hash_equals($authenticatedUserId, $uuid)) {
        respondPosManage([
            "success" => false,
            "error" => "You cannot deactivate your own signed-in account.",
        ], 409);
    }

    $deleteTargetStmt = $pdo->prepare("
        SELECT classification
        FROM tbl_users_global_assignment
        WHERE uuid = :uuid
          AND UPPER(TRIM(status)) = 'ACTIVE'
          AND UPPER(TRIM(deletestatus)) = 'ACTIVE'
        LIMIT 1
    ");
    $deleteTargetStmt->execute([":uuid" => $uuid]);
    $deleteTarget = $deleteTargetStmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($deleteTarget)) {
        respondPosManage(["success" => false, "error" => "User not found."], 404);
    }
    posRoleAuthRequireManageRoleValue(
        $pdo,
        $authenticatedUserId,
        $deleteTarget["classification"] ?? ""
    );

    $pdo->beginTransaction();
    try {
        $stmtUser = $pdo->prepare("
            UPDATE tbl_users_global_assignment
            SET deletestatus = :deletestatus, status = :status
            WHERE uuid = :uuid
        ");
        $stmtUser->execute([
            ":deletestatus" => "Inactive",
            ":status" => "Inactive",
            ":uuid" => $uuid,
        ]);

        $stmtEmployee = $pdo->prepare("
            UPDATE tbl_employees
            SET
                deletestatus = :deletestatus,
                status = :status
            WHERE empid = :empid
        ");
        $stmtEmployee->execute([
            ":deletestatus" => "Inactive",
            ":status" => "Inactive",
            ":empid" => $uuid,
        ]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    respondPosManage(["success" => true]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if (isset($stagedImage) && is_array($stagedImage)) {
        discardPosProfileImage($stagedImage, true);
    }

    error_log("POS user management error: " . $e->getMessage());

    respondPosManage([
        "success" => false,
        "error" => $e instanceof InvalidArgumentException
            ? $e->getMessage()
            : "Unable to process the user account request.",
    ], $e instanceof InvalidArgumentException ? 422 : 500);
}
