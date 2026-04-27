<?php

//PHP to CRUD Sales

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    header("Allow: POST");

    exit;

}

$payrollempid = $_POST['payrollempid'];

$firstname = $_POST["firstname"];

$middlename = $_POST['middlename'];

$lastname = $_POST['lastname'];

$position = $_POST['position'];

$department = $_POST['department'];

$birthdate = $_POST['birthdate'];

$sss = $_POST['sss'];

$phic = $_POST['phic'];

$mdf = $_POST['mdf'];

$tin = $_POST['tin'];

$contactno = $_POST['contactno'];

$email = $_POST['email'];

$address = $_POST['address'];

$salary = $_POST['salary'];

$salary_type = $_POST['salarytype'];

$business_unit = $_POST['businessunit'];

$tax_class = $_POST['taxclass'];

$spp_class = $_POST['sppclass'];

$day_factor = $_POST['dayfactor'];

$empid = $_POST['empid'];

$datestarted = $_POST['datestarted'];

$previousimage = $_POST['previousimage'];

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

$conn = $database->getConnection();

// Initialize connection var $conn, methods: getByUsername, getById

$user_gateway = new UserGateway($database);

//Initialize JWT Token with methods: encode, decode

$codec = new JWTCodec($_ENV["SECRET_KEY"]);

//Initialize Auth, methods: authenticateAccessToken, getUserID

$auth = new Auth($user_gateway, $codec);

//Method of auth checking if token is invalid signature or expired

if (!$auth->authenticateAccessToken()) {

    exit;

}

$user_id = $auth->getUserID();

$imageCompressor = new ImageCompressor();

$otpController = new OTP();

$otp = $otpController->generateOTP();

try {

    $conn->beginTransaction();
    $queryadded= [];
    $sql = "SELECT * FROM tbl_employees
                WHERE  payroll_empid = :payrollempid
                AND deletestatus = 'Active'";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":payrollempid", $payrollempid);

    $stmt->execute();

    $isExist = $stmt->rowCount();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($isExist > 0 &&  $row["empid"] === $empid) {
        $queryadded  = "payroll_empid = '" . $row["payroll_empid"] . "'";  
    }else{
        $sql = "SELECT MAX(payroll_empid) as total FROM tbl_employees";

        $stmt = $conn->prepare($sql);

        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        // Ensure payroll_empid is an integer before incrementing
        $nextPayrollEmpId = intval($row["total"]) + 1;
        $queryadded = "payroll_empid = '" . $nextPayrollEmpId . "'";
    }

    //Post Employee Information

    $sql = "UPDATE tbl_employees SET

          $queryadded ,firstname = :firstname, middlename = :middlename, lastname = :lastname, position = :position,

         department = :department,birthdate =  :birthdate, sss = :sss, phic = :phic, mdf = :mdf, tin = :tin,

         contact_no = :contact_no, email = :email, address = :address, salary = :salary, salary_type = :salary_type, status = 'Active' , tax_class = :tax_class , spp_class = :spp_class , busunit_code = :business_unit , factordays = :day_factor, date_started = :date_started,

        usertracker  = :usertracker, createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)

        WHERE empid = :empid";

    $stmt = $conn->prepare($sql);

    // $stmt->bindValue(":payrollempid", $payrollempid);

    $stmt->bindValue(":empid", $empid, PDO::PARAM_STR);

    $stmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);

    $stmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);

    $stmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);

    $stmt->bindValue(":position", $position, PDO::PARAM_STR);

    $stmt->bindValue(":department", $department, PDO::PARAM_STR);

    $stmt->bindValue(":birthdate", $birthdate, PDO::PARAM_STR);

    $stmt->bindValue(":sss", $sss, PDO::PARAM_INT);

    $stmt->bindValue(":phic", $phic, PDO::PARAM_INT);

    $stmt->bindValue(":mdf", $mdf, PDO::PARAM_INT);

    $stmt->bindValue(":tin", $tin, PDO::PARAM_INT);

    $stmt->bindValue(":contact_no", $contactno, PDO::PARAM_INT);

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

    // Handle the uploaded image

    if (isset($_FILES['employeeimage']) && $_FILES['employeeimage']['error'] === UPLOAD_ERR_OK) {

        $imagePath = dirname(__DIR__, 1) . '/images/employees/';

        // Get the previous image path
        $previousImagePath = $previousimage;

        // Check if the previous image exists before attempting to delete it
        if (file_exists($previousImagePath)) {
            unlink($previousImagePath); // Delete the previous image
        }

        $imageFilename = $empid . '_' . basename($_FILES['employeeimage']['name']); // Unique filename

        $targetPath = $imagePath . $imageFilename;

        // Move the uploaded image to the "images" folder

        if (move_uploaded_file($_FILES['employeeimage']['tmp_name'], $targetPath)) {

            // Compress the image to low-quality JPEG

            $jpegQuality = 10; // Adjust the quality as needed

            $imageCompressor->compressToJpeg($targetPath, $targetPath, $jpegQuality);

            // Update the image_path and image_filename in the database

            $updateSql = "UPDATE tbl_employees SET image_filename = :targetpath WHERE empid = :empid";

            $updateStmt = $conn->prepare($updateSql);

            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

            $updateStmt->bindValue(":empid", $empid, PDO::PARAM_STR);

            $updateStmt->execute();

            // echo json_encode(['message' => 'imageUploadSuccess']);

        } else {

            $imagePath = dirname(__DIR__, 1) . '/images/employees/';

            $imageFilename = $empid; // Unique filename

            $targetPath = $imagePath . $imageFilename;

            // Update the image_path and image_filename in the database

            $updateSql = "UPDATE tbl_employees SET image_filename = :targetpath WHERE empid = :empid";

            $updateStmt = $conn->prepare($updateSql);

            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

            $updateStmt->bindValue(":empid", $empid, PDO::PARAM_STR);

            $updateStmt->execute();

            // echo json_encode(['message' => 'imageUploadError']);

        }

    } else {

        $imagePath = dirname(__DIR__, 1) . '/images/employees/';

        $imageFilename = $empid; // Unique filename

        $targetPath = $imagePath . $imageFilename;

        // Update the image_path and image_filename in the database

        $updateSql = "UPDATE tbl_employees SET image_filename = :targetpath WHERE empid = :empid";

        $updateStmt = $conn->prepare($updateSql);

        $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

        $updateStmt->bindValue(":empid", $empid, PDO::PARAM_STR);

        $updateStmt->execute();

        // echo json_encode(['message' => 'infoOnlyUploadSuccess']);

    }

    //Update tbl_users

    $usersql = "UPDATE tbl_users_global_assignment  SET

    email = :email, classification = :position,

    firstname = :firstname, middlename = :middlename, lastname=:lastname, department=:department,

    contactnumber = :contactnumber, usertracker = :user_tracker, createtime = DATE_ADD(NOW(),INTERVAL 8 HOUR)

    WHERE uuid = :empid";

    $userstmt = $conn->prepare($usersql);

    $userstmt->bindValue(":email", $email, PDO::PARAM_STR);

    $userstmt->bindValue(":position", $position, PDO::PARAM_STR);

    $userstmt->bindValue(":firstname", $firstname, PDO::PARAM_STR);

    $userstmt->bindValue(":middlename", $middlename, PDO::PARAM_STR);

    $userstmt->bindValue(":lastname", $lastname, PDO::PARAM_STR);

    $userstmt->bindValue(":department", $department, PDO::PARAM_STR);

    $userstmt->bindValue(":contactnumber", $contactno, PDO::PARAM_INT);

    $userstmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

    $userstmt->bindValue(":empid", $empid, PDO::PARAM_STR);

    $userstmt->execute();

    $conn->commit();

    echo json_encode(["message" => "Success"]);

} catch (Exception $e) {
    $conn->rollBack();

    echo json_encode(['message' => 'An error occurred: ' . $e->getMessage()]);
}
