<?php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: POST");
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

function post_str(string $key, string $default = ""): string
{
    return isset($_POST[$key]) ? trim((string) $_POST[$key]) : $default;
}

function digits_only(string $value): string
{
    return preg_replace('/\D+/', '', $value) ?? '';
}

$payrollMode   = strtoupper(post_str("payrollmode", "SERIES"));
$manualPayroll = digits_only(post_str("payrollempid"));

$firstname     = post_str("firstname");
$middlename    = post_str("middlename");
$lastname      = post_str("lastname");
$position      = post_str("position");
$department    = post_str("department");
$birthdate     = post_str("birthdate");
$sss           = digits_only(post_str("sss"));
$phic          = digits_only(post_str("phic"));
$mdf           = digits_only(post_str("mdf"));
$tin           = digits_only(post_str("tin"));
$contactno     = digits_only(post_str("contactno"));
$email         = post_str("email");
$address       = post_str("address");
$salary        = post_str("salary");
$salary_type   = post_str("salarytype");
$business_unit = post_str("businessunit");
$tax_class     = post_str("taxclass");
$spp_class     = post_str("sppclass");
$day_factor    = post_str("dayfactor");
$datestarted   = post_str("datestarted");

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

$conn = $database->getConnection();
$user_gateway = new UserGateway($database);
$codec = new JWTCodec($_ENV["SECRET_KEY"]);
$auth = new Auth($user_gateway, $codec);

if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

$imageCompressor = new ImageCompressor();
$otpController = new OTP();
$otp = $otpController->generateOTP();

try {
    $conn->beginTransaction();

    // Required validation
    if (
        $firstname === "" ||
        $lastname === "" ||
        $position === "" ||
        $department === "" ||
        $birthdate === "" ||
        $contactno === "" ||
        $email === "" ||
        $address === "" ||
        $business_unit === "" ||
        $datestarted === ""
    ) {
        throw new Exception("Missing required fields.");
    }

    if ($payrollMode === "MANUAL" && $manualPayroll === "") {
        echo json_encode(["message" => "ManualPayrollIdRequired"]);
        $conn->rollBack();
        exit;
    }

    // Check employee email duplicate
    $sql = "SELECT 1
            FROM tbl_employees
            WHERE LOWER(email) = LOWER(:email)
              AND deletestatus = 'Active'
            LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->execute();

    if ($stmt->fetchColumn()) {
        echo json_encode(["message" => "DuplicateInfo"]);
        $conn->rollBack();
        exit;
    }

    // Check user email duplicate
    $sql = "SELECT 1
            FROM tbl_users_global_assignment
            WHERE LOWER(email) = LOWER(:email)
              AND deletestatus = 'Active'
            LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->execute();

    if ($stmt->fetchColumn()) {
        echo json_encode(["message" => "DuplicateUser"]);
        $conn->rollBack();
        exit;
    }

    // Resolve payroll id
    $resolvedPayrollId = "";

    if ($payrollMode === "MANUAL") {
        $sql = "SELECT 1
                FROM tbl_employees
                WHERE payroll_empid = :payroll_empid
                  AND deletestatus = 'Active'
                LIMIT 1";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(":payroll_empid", $manualPayroll, PDO::PARAM_STR);
        $stmt->execute();

        if ($stmt->fetchColumn()) {
            echo json_encode(["message" => "DuplicatePayrollId"]);
            $conn->rollBack();
            exit;
        }

        $resolvedPayrollId = $manualPayroll;
    } else {
        $sql = "SELECT COALESCE(MAX(CAST(payroll_empid AS UNSIGNED)), 100000) AS max_payroll_id
                FROM tbl_employees
                WHERE deletestatus = 'Active'";
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $maxPayrollId = isset($row["max_payroll_id"]) ? (int)$row["max_payroll_id"] : 100000;
        $resolvedPayrollId = (string)($maxPayrollId + 1);
    }

    // Employee ID
    $currentYear = date("Y");
    $currentMonth = date("m");
    $randomNumber = mt_rand(100000, 999999);
    $employeeId = $currentYear . $currentMonth . strval($randomNumber);

    // Insert employee
    $sql = "INSERT INTO tbl_employees (
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
                :payrollempid,
                :empid,
                ShortUUID(),
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
                'Active',
                :tax_class,
                :spp_class,
                :business_unit,
                :day_factor,
                NULL,
                'Active',
                :usertracker,
                NOW()
            )";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":payrollempid", $resolvedPayrollId, PDO::PARAM_STR);
    $stmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
    $stmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);
    $stmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);
    $stmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);
    $stmt->bindValue(":position", $position, PDO::PARAM_STR);
    $stmt->bindValue(":department", $department, PDO::PARAM_STR);
    $stmt->bindValue(":birthdate", $birthdate, PDO::PARAM_STR);
    $stmt->bindValue(":sss", $sss !== "" ? $sss : null, $sss !== "" ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(":phic", $phic !== "" ? $phic : null, $phic !== "" ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(":mdf", $mdf !== "" ? $mdf : null, $mdf !== "" ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(":tin", $tin !== "" ? $tin : null, $tin !== "" ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(":contact_no", $contactno, PDO::PARAM_STR);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":address", $address, PDO::PARAM_STR);
    $stmt->bindValue(":salary", $salary, PDO::PARAM_STR);
    $stmt->bindValue(":salary_type", $salary_type, PDO::PARAM_STR);
    $stmt->bindValue(":business_unit", $business_unit, PDO::PARAM_STR);
    $stmt->bindValue(":tax_class", $tax_class, PDO::PARAM_STR);
    $stmt->bindValue(":spp_class", $spp_class, PDO::PARAM_STR);
    $stmt->bindValue(":day_factor", $day_factor, PDO::PARAM_STR);
    $stmt->bindValue(":date_started", $datestarted, PDO::PARAM_STR);
    $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
    $stmt->execute();

    // Employee history
    $historysql = "INSERT INTO tbl_emp_history (
                        empid,
                        historical_date,
                        activity,
                        particulars,
                        deletestatus,
                        usertracker,
                        createdtime
                    ) VALUES (
                        :emp_id,
                        :historical_date,
                        :activity,
                        :particulars,
                        'Active',
                        :usertracker,
                        NOW()
                    )";

    $historystmt = $conn->prepare($historysql);
    $historystmt->bindValue(":emp_id", $employeeId, PDO::PARAM_STR);
    $historystmt->bindValue(":historical_date", $datestarted, PDO::PARAM_STR);
    $historystmt->bindValue(":activity", "On-boarded", PDO::PARAM_STR);
    $historystmt->bindValue(":particulars", "Employee started on this period", PDO::PARAM_STR);
    $historystmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
    $historystmt->execute();

    // Image handling
    $defaultTargetPath = dirname(__DIR__, 1) . '/images/employees/' . $employeeId;

    if (isset($_FILES['employeeimage']) && $_FILES['employeeimage']['error'] === UPLOAD_ERR_OK) {
        $imagePath = dirname(__DIR__, 1) . '/images/employees/';
        $imageFilename = $employeeId . '_' . basename($_FILES['employeeimage']['name']);
        $targetPath = $imagePath . $imageFilename;

        if (move_uploaded_file($_FILES['employeeimage']['tmp_name'], $targetPath)) {
            $jpegQuality = 10;
            $imageCompressor->compressToJpeg($targetPath, $targetPath, $jpegQuality);

            $updateSql = "UPDATE tbl_employees
                          SET image_filename = :targetpath
                          WHERE empid = :empid";
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);
            $updateStmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
            $updateStmt->execute();

            // Insert user account
            $password_hash = password_hash("1234", PASSWORD_DEFAULT);
            $emails = strtolower($email);

            $usersql = "INSERT INTO tbl_users_global_assignment (
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
                            'Current',
                            :department,
                            :contactnumber,
                            'Inactive',
                            'Verified',
                            0,
                            :otp,
                            0,
                            :usertracker,
                            'Active',
                            NOW()
                        )";

            $userstmt = $conn->prepare($usersql);
            $userstmt->bindValue(":uuid", $employeeId, PDO::PARAM_STR);
            $userstmt->bindValue(":email", $emails, PDO::PARAM_STR);
            $userstmt->bindValue(":classification", $position, PDO::PARAM_STR);
            $userstmt->bindValue(":password", $password_hash, PDO::PARAM_STR);
            $userstmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);
            $userstmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);
            $userstmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);
            $userstmt->bindValue(":department", $department, PDO::PARAM_STR);
            $userstmt->bindValue(":contactnumber", $contactno, PDO::PARAM_STR);
            $userstmt->bindValue(":otp", $otp, PDO::PARAM_INT);
            $userstmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $userstmt->execute();

            $conn->commit();
            echo json_encode([
                "message" => "imageUploadSuccess",
                "payroll_empid" => $resolvedPayrollId,
                "empid" => $employeeId
            ]);
            exit;
        }
    }

    $updateSql = "UPDATE tbl_employees
                  SET image_filename = :targetpath
                  WHERE empid = :empid";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->bindValue(":targetpath", $defaultTargetPath, PDO::PARAM_STR);
    $updateStmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
    $updateStmt->execute();

    // Insert user account
    $password_hash = password_hash("1234", PASSWORD_DEFAULT);
    $emails = strtolower($email);

    $usersql = "INSERT INTO tbl_users_global_assignment (
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
                    'Current',
                    :department,
                    :contactnumber,
                    'Inactive',
                    'Verified',
                    0,
                    :otp,
                    0,
                    :usertracker,
                    'Active',
                    NOW()
                )";

    $userstmt = $conn->prepare($usersql);
    $userstmt->bindValue(":uuid", $employeeId, PDO::PARAM_STR);
    $userstmt->bindValue(":email", $emails, PDO::PARAM_STR);
    $userstmt->bindValue(":classification", $position, PDO::PARAM_STR);
    $userstmt->bindValue(":password", $password_hash, PDO::PARAM_STR);
    $userstmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);
    $userstmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);
    $userstmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);
    $userstmt->bindValue(":department", $department, PDO::PARAM_STR);
    $userstmt->bindValue(":contactnumber", $contactno, PDO::PARAM_STR);
    $userstmt->bindValue(":otp", $otp, PDO::PARAM_INT);
    $userstmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
    $userstmt->execute();

    $conn->commit();

    echo json_encode([
        "message" => "infoOnlyUploadSuccess",
        "payroll_empid" => $resolvedPayrollId,
        "empid" => $employeeId
    ]);
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        "message" => "An error occurred: " . $e->getMessage()
    ]);
}