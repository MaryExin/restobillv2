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

$payrollempid  = trim((string)($_POST['payrollempid'] ?? ""));
$firstname     = trim((string)($_POST['firstname'] ?? ""));
$middlename    = trim((string)($_POST['middlename'] ?? ""));
$lastname      = trim((string)($_POST['lastname'] ?? ""));
$position      = trim((string)($_POST['position'] ?? ""));
$department    = trim((string)($_POST['department'] ?? ""));
$birthdate     = trim((string)($_POST['birthdate'] ?? ""));
$sss           = trim((string)($_POST['sss'] ?? "0"));
$phic          = trim((string)($_POST['phic'] ?? "0"));
$mdf           = trim((string)($_POST['mdf'] ?? "0"));
$tin           = trim((string)($_POST['tin'] ?? "0"));
$contactno     = trim((string)($_POST['contactno'] ?? ""));
$email         = trim((string)($_POST['email'] ?? ""));
$address       = trim((string)($_POST['address'] ?? ""));
$salary        = trim((string)($_POST['salary'] ?? "0"));
$salary_type   = trim((string)($_POST['salarytype'] ?? ""));
$business_unit = trim((string)($_POST['businessunit'] ?? ""));
$tax_class     = trim((string)($_POST['taxclass'] ?? ""));
$spp_class     = trim((string)($_POST['sppclass'] ?? ""));
$day_factor    = trim((string)($_POST['dayfactor'] ?? ""));
$datestarted   = trim((string)($_POST['datestarted'] ?? ""));

if ($email === "") {
    echo json_encode(["message" => "EmailRequired"]);
    exit;
}

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
    // Check duplicate in tbl_employees by email
    $sql = "SELECT COUNT(*)
            FROM tbl_employees
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(:email))
              AND deletestatus = 'Active'";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->execute();

    $isExist = (int) $stmt->fetchColumn();

    if ($isExist > 0) {
        echo json_encode(["message" => "DuplicateInfo"]);
        exit;
    }

    // Check duplicate in tbl_users_global_assignment by email
    $sql = "SELECT COUNT(*)
            FROM tbl_users_global_assignment
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(:email))
              AND deletestatus = 'Active'";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->execute();

    $isExist = (int) $stmt->fetchColumn();

    if ($isExist > 0) {
        echo json_encode(["message" => "DuplicateUser"]);
        exit;
    }

    // Check duplicate payroll id
    $sql = "SELECT COUNT(*)
            FROM tbl_employees
            WHERE payroll_empid = :payroll_empid
              AND deletestatus = 'Active'";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":payroll_empid", $payrollempid, PDO::PARAM_STR);
    $stmt->execute();

    $isExist = (int) $stmt->fetchColumn();

    if ($isExist > 0) {
        echo json_encode(["message" => "DuplicatePayrollId"]);
        exit;
    }

    // Generate employee id
    $currentYear = date("Y");
    $currentMonth = date("m");
    $randomNumber = mt_rand(100000, 999999);
    $employeeId = $currentYear . $currentMonth . strval($randomNumber);

    // Insert employee
    $sql = "INSERT INTO tbl_employees VALUES
        (
            default,
            :payrollempid,
            :empid,
            :random_number,
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
            null,
            'Active',
            :usertracker,
            now()
        )";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":payrollempid", $payrollempid, PDO::PARAM_STR);
    $stmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
    $stmt->bindValue(":random_number", $randomNumber, PDO::PARAM_INT);
    $stmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);
    $stmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);
    $stmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);
    $stmt->bindValue(":position", $position, PDO::PARAM_STR);
    $stmt->bindValue(":department", $department, PDO::PARAM_STR);
    $stmt->bindValue(":birthdate", $birthdate, PDO::PARAM_STR);
    $stmt->bindValue(":sss", $sss, PDO::PARAM_STR);
    $stmt->bindValue(":phic", $phic, PDO::PARAM_STR);
    $stmt->bindValue(":mdf", $mdf, PDO::PARAM_STR);
    $stmt->bindValue(":tin", $tin, PDO::PARAM_STR);
    $stmt->bindValue(":contact_no", $contactno, PDO::PARAM_STR);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":address", $address, PDO::PARAM_STR);
    $stmt->bindValue(":salary", $salary, PDO::PARAM_STR);
    $stmt->bindValue(":salary_type", $salary_type, PDO::PARAM_STR);
    $stmt->bindValue(":date_started", $datestarted, PDO::PARAM_STR);
    $stmt->bindValue(":tax_class", $tax_class, PDO::PARAM_STR);
    $stmt->bindValue(":spp_class", $spp_class, PDO::PARAM_STR);
    $stmt->bindValue(":business_unit", $business_unit, PDO::PARAM_STR);
    $stmt->bindValue(":day_factor", $day_factor, PDO::PARAM_STR);
    $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
    $stmt->execute();

    // Handle image
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

            echo json_encode(['message' => 'imageUploadSuccess']);
        } else {
            $imagePath = dirname(__DIR__, 1) . '/images/employees/';
            $imageFilename = $employeeId;
            $targetPath = $imagePath . $imageFilename;

            $updateSql = "UPDATE tbl_employees
                          SET image_filename = :targetpath
                          WHERE empid = :empid";

            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);
            $updateStmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
            $updateStmt->execute();

            echo json_encode(['error' => 'imageUploadError']);
        }
    } else {
        $imagePath = dirname(__DIR__, 1) . '/images/employees/';
        $imageFilename = $employeeId;
        $targetPath = $imagePath . $imageFilename;

        $updateSql = "UPDATE tbl_employees
                      SET image_filename = :targetpath
                      WHERE empid = :empid";

        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);
        $updateStmt->bindValue(":empid", $employeeId, PDO::PARAM_STR);
        $updateStmt->execute();

        echo json_encode(['message' => 'infoOnlyUploadSuccess']);
    }

    $password_hash = password_hash("1234", PASSWORD_DEFAULT);
    $emails = strtolower($email);

    $usersql = "INSERT INTO tbl_users_global_assignment
        (
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
        )
        VALUES
        (
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
            now()
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

} catch (Exception $e) {
    echo json_encode([
        'error' => 'An error occurred: ' . $e->getMessage()
    ]);
}