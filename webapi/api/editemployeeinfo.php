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

$payrollMode   = strtoupper(post_str("payrollmode", "MANUAL"));
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
$empid         = post_str("empid");
$datestarted   = post_str("datestarted");
$previousimage = post_str("previousimage");

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

try {
    $conn->beginTransaction();

    if ($empid === "") {
        throw new Exception("Employee ID is required.");
    }

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

    // Load current employee
    $sql = "SELECT payroll_empid, image_filename
            FROM tbl_employees
            WHERE empid = :empid
              AND deletestatus = 'Active'
            LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":empid", $empid, PDO::PARAM_STR);
    $stmt->execute();
    $currentRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$currentRow) {
        throw new Exception("Employee not found.");
    }

    // Check duplicate email in employees excluding current employee
    $sql = "SELECT 1
            FROM tbl_employees
            WHERE LOWER(email) = LOWER(:email)
              AND empid <> :empid
              AND deletestatus = 'Active'
            LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":empid", $empid, PDO::PARAM_STR);
    $stmt->execute();

    if ($stmt->fetchColumn()) {
        echo json_encode(["message" => "DuplicateInfo"]);
        $conn->rollBack();
        exit;
    }

    // Check duplicate email in users excluding current uuid
    $sql = "SELECT 1
            FROM tbl_users_global_assignment
            WHERE LOWER(email) = LOWER(:email)
              AND uuid <> :empid
              AND deletestatus = 'Active'
            LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":empid", $empid, PDO::PARAM_STR);
    $stmt->execute();

    if ($stmt->fetchColumn()) {
        echo json_encode(["message" => "DuplicateUser"]);
        $conn->rollBack();
        exit;
    }

    // Resolve payroll id for edit
    $resolvedPayrollId = (string)$currentRow["payroll_empid"];

    if ($payrollMode === "MANUAL") {
        if ($manualPayroll === "") {
            echo json_encode(["message" => "ManualPayrollIdRequired"]);
            $conn->rollBack();
            exit;
        }

        $sql = "SELECT 1
                FROM tbl_employees
                WHERE payroll_empid = :payrollempid
                  AND empid <> :empid
                  AND deletestatus = 'Active'
                LIMIT 1";
        $stmt = $conn->prepare($sql);
        $stmt->bindValue(":payrollempid", $manualPayroll, PDO::PARAM_STR);
        $stmt->bindValue(":empid", $empid, PDO::PARAM_STR);
        $stmt->execute();

        if ($stmt->fetchColumn()) {
            echo json_encode(["message" => "DuplicatePayrollId"]);
            $conn->rollBack();
            exit;
        }

        $resolvedPayrollId = $manualPayroll;
    }

    // Update employee
    $sql = "UPDATE tbl_employees
            SET payroll_empid = :payrollempid,
                firstname = :firstname,
                middlename = :middlename,
                lastname = :lastname,
                position = :position,
                department = :department,
                birthdate = :birthdate,
                sss = :sss,
                phic = :phic,
                mdf = :mdf,
                tin = :tin,
                contact_no = :contact_no,
                email = :email,
                address = :address,
                salary = :salary,
                salary_type = :salary_type,
                status = 'Active',
                tax_class = :tax_class,
                spp_class = :spp_class,
                busunit_code = :business_unit,
                factordays = :day_factor,
                date_started = :date_started,
                usertracker = :usertracker,
                createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
            WHERE empid = :empid";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":payrollempid", $resolvedPayrollId, PDO::PARAM_STR);
    $stmt->bindValue(":empid", $empid, PDO::PARAM_STR);
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

    // Handle image
    if (isset($_FILES['employeeimage']) && $_FILES['employeeimage']['error'] === UPLOAD_ERR_OK) {
        $imagePath = dirname(__DIR__, 1) . '/images/employees/';
        $previousImagePath = $previousimage;

        if ($previousImagePath !== "" && file_exists($previousImagePath)) {
            @unlink($previousImagePath);
        }

        $imageFilename = $empid . '_' . basename($_FILES['employeeimage']['name']);
        $targetPath = $imagePath . $imageFilename;

        if (move_uploaded_file($_FILES['employeeimage']['tmp_name'], $targetPath)) {
            $jpegQuality = 10;
            $imageCompressor->compressToJpeg($targetPath, $targetPath, $jpegQuality);

            $updateSql = "UPDATE tbl_employees
                          SET image_filename = :targetpath
                          WHERE empid = :empid";
            $updateStmt = $conn->prepare($updateSql);
            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);
            $updateStmt->bindValue(":empid", $empid, PDO::PARAM_STR);
            $updateStmt->execute();
        }
    }

    // Update user assignment
    $usersql = "UPDATE tbl_users_global_assignment
                SET email = :email,
                    classification = :position,
                    firstname = :firstname,
                    middlename = :middlename,
                    lastname = :lastname,
                    department = :department,
                    contactnumber = :contactnumber,
                    usertracker = :user_tracker,
                    createtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
                WHERE uuid = :empid";

    $userstmt = $conn->prepare($usersql);
    $userstmt->bindValue(":email", strtolower($email), PDO::PARAM_STR);
    $userstmt->bindValue(":position", $position, PDO::PARAM_STR);
    $userstmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);
    $userstmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);
    $userstmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);
    $userstmt->bindValue(":department", $department, PDO::PARAM_STR);
    $userstmt->bindValue(":contactnumber", $contactno, PDO::PARAM_STR);
    $userstmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
    $userstmt->bindValue(":empid", $empid, PDO::PARAM_STR);
    $userstmt->execute();

    $conn->commit();

    echo json_encode([
        "message" => "Success",
        "payroll_empid" => $resolvedPayrollId,
        "empid" => $empid
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