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

$customerName = $_POST["customername"];
$branchName = $_POST["branchname"];
$tin = $_POST["tin"];
$address = $_POST["address"];
$contactNo = $_POST["contactno"];
$email = $_POST["email"];
$otherInfo = $_POST["otherinfo"];
$charttypedatas = json_decode($_POST["charttypedata"], true);

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

$conn = $database->getConnection();

// // Initialize connection var $conn, methods: getByUsername, getById

// $user_gateway = new UserGateway($database);

// //Initialize JWT Token with methods: encode, decode

// $codec = new JWTCodec($_ENV["SECRET_KEY"]);

// //Initialize Auth, methods: authenticateAccessToken, getUserID

// $auth = new Auth($user_gateway, $codec);

// //Method of auth checking if token is invalid signature or expired

// if (!$auth->authenticateAccessToken()) {

//     exit;

// }

// $user_id = $auth->getUserID();

$imageCompressor = new ImageCompressor();

$otpController = new OTP();

$otp = $otpController->generateOTP();

try {
    $conn->beginTransaction();

    //Check if Exist

    $sql = "SELECT * FROM `tbl_customer_details`
            WHERE LOWER(email) = LOWER(:email)
            OR LOWER(customername) = LOWER(:customername)
            AND deletestatus = 'Active'";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":customername", $customerName, PDO::PARAM_STR);

    $stmt->execute();

    $isExist = $stmt->rowCount();

    if ($isExist > 0) {
        echo json_encode(["message" => "Duplicate"]);
        exit;
    }

    //Check if Exist

    $sql = "SELECT * FROM `tbl_users_global_assignment`
            WHERE LOWER(email) = LOWER(:email)
            AND deletestatus = 'Active'";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":email", $email, PDO::PARAM_STR);

    $stmt->execute();

    $isExist = $stmt->rowCount();

    if ($isExist > 0) {
        echo json_encode(["message" => "DuplicateUser"]);
        exit;
    }

    //Create Unique ID

    $sql = "INSERT INTO lkp_slcodes () VALUES (CONCAT('SL-', ShortUUID()), :glcodes, :slcodes, :sldescs, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $stmt = $conn->prepare($sql);

    $acctgaccountsql = "INSERT INTO lkp_chart_of_accounts () VALUES (default, :charttype, :acctgglcodes, :acctggldecs, :acctgslcodes, :acctgsldescs, 'Active', :acctguser_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $acctgaccountstmt = $conn->prepare($acctgaccountsql);

    $generateidsql = "SELECT COUNT(*) as count FROM lkp_slcodes WHERE glcode = :glcodes";
    $generateidstmt = $conn->prepare($generateidsql);
    $generateidstmt->bindValue(":glcodes", "120", PDO::PARAM_STR);
    $generateidstmt->execute();
    $rowCount = $generateidstmt->fetchColumn();

    $uniqueNumber = $rowCount + 1;

    $slcode = "120" . sprintf("%03d", $uniqueNumber);
    $sldescs = "ACCOUNTS RECEIVABLE - " . $customerName;

    $stmt->bindValue(":glcodes", "120", PDO::PARAM_STR);
    $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
    $stmt->bindValue(":sldescs", $sldescs, PDO::PARAM_STR);
    $stmt->bindValue(":user_tracker", $customerName, PDO::PARAM_STR);
    $stmt->execute();

    foreach ($charttypedatas as $charttype){
    $acctgaccountstmt->bindValue(":charttype", $charttype, PDO::PARAM_STR);
    $acctgaccountstmt->bindValue(":acctgglcodes", "120", PDO::PARAM_STR);
    $acctgaccountstmt->bindValue(":acctggldecs", "ACCOUNTS RECEIVABLE", PDO::PARAM_STR);
    $acctgaccountstmt->bindValue(":acctgslcodes", $slcode, PDO::PARAM_STR);
    $acctgaccountstmt->bindValue(":acctgsldescs", $sldescs, PDO::PARAM_STR);
    $acctgaccountstmt->bindValue(":acctguser_tracker", $customerName, PDO::PARAM_STR);
    $acctgaccountstmt->execute();
    }

    $currentYear = date("Y");

    $currentMonth = date("m");

    $randomNumber = mt_rand(100000, 999999);

    $customerId = "C-" . $currentYear . $currentMonth . strval($randomNumber);

    //Post Customer Information

    $sql = "INSERT INTO `tbl_customer_details` () VALUES
         (default, :customerId, :customername, :branchname, :tin, :address,
         :contactno, :email, :otherinfo, null, :slcodes,
         'Active', DATE_ADD(NOW(),INTERVAL 8 HOUR))";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":customerId", $customerId, PDO::PARAM_STR);

    $stmt->bindValue(":customername", $customerName, PDO::PARAM_STR);

    $stmt->bindValue(":branchname", $branchName, PDO::PARAM_STR);

    $stmt->bindValue(":tin", $tin, PDO::PARAM_STR);

    $stmt->bindValue(":address", $address, PDO::PARAM_STR);

    $stmt->bindValue(":contactno", $contactNo, PDO::PARAM_STR);

    $stmt->bindValue(":email", $email, PDO::PARAM_INT);

    $stmt->bindValue(":otherinfo", $otherInfo, PDO::PARAM_INT);

    $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_INT);


    $stmt->execute();

    // Handle the uploaded image

    if (isset($_FILES['customerimage']) && $_FILES['customerimage']['error'] === UPLOAD_ERR_OK) {

        $imagePath = dirname(__DIR__, 1) . '/images/customers/';

        $imageFilename = $customerId . '.png'; // Unique filename

        $targetPath = $imagePath . $imageFilename;

        // Move the uploaded image to the "images" folder

        if (move_uploaded_file($_FILES['customerimage']['tmp_name'], $targetPath)) {

            // Compress the image to low-quality JPEG

            $jpegQuality = 10; // Adjust the quality as needed

            $imageCompressor->compressToJpeg($targetPath, $targetPath, $jpegQuality);

            // Update the image_path and image_filename in the database

            $updateSql = "UPDATE `tbl_customer_details` SET image_filename = :targetpath WHERE customer_id = :customer_id";

            $updateStmt = $conn->prepare($updateSql);

            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

            $updateStmt->bindValue(":customer_id", $customerId, PDO::PARAM_STR);

            $updateStmt->execute();

            echo json_encode(['message' => 'imageUploadSuccess']);

        } else {

            $imagePath = dirname(__DIR__, 1) . '/images/customers/';

            $imageFilename = $customerId; // Unique filename

            $targetPath = $imagePath . $imageFilename;

            // Update the image_path and image_filename in the database

            $updateSql = "UPDATE `tbl_customer_details` SET image_filename = :targetpath WHERE customer_id = :customer_id";

            $updateStmt = $conn->prepare($updateSql);

            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

            $updateStmt->bindValue(":customer_id", $customerId, PDO::PARAM_STR);

            $updateStmt->execute();

            echo json_encode(['error' => 'imageUploadError']);

        }

    } else {

        $imagePath = dirname(__DIR__, 1) . '/images/customers/';

        $imageFilename = $customerId; // Unique filename

        $targetPath = $imagePath . $imageFilename;

// Update the image_path and image_filename in the database

        $updateSql = "UPDATE `tbl_customer_details` SET image_filename = :targetpath WHERE customer_id = :customer_id";

        $updateStmt = $conn->prepare($updateSql);

        $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

        $updateStmt->bindValue(":customer_id", $customerId, PDO::PARAM_STR);

        $updateStmt->execute();

        echo json_encode(['message' => 'infoOnlyUploadSuccess']);

    }

    $password_hash = password_hash("1234", PASSWORD_DEFAULT);

    $emails = strtolower($email);

    $usersql = "INSERT INTO tbl_users_global_assignment (uuid,email,classification,password,
    firstname,middlename,lastname, company, department, contactnumber, status, verified, passlock,
    otp, otplock, usertracker, deletestatus, createtime)
    VALUES (:uuid, :email, :classification, :password, :firstname,:middlename,
    :lastname,'Current', :department, :contactnumber ,'Inactive', 'Verified', 0, :otp , 0, :usertracker,'Active', DATE_ADD(NOW(),INTERVAL 8 HOUR))";

    $userstmt = $conn->prepare($usersql);

    $userstmt->bindValue(":uuid", $customerId, PDO::PARAM_STR);

    $userstmt->bindValue(":email", $emails, PDO::PARAM_STR);

    $userstmt->bindValue(":classification", 'Customer', PDO::PARAM_STR);

    $userstmt->bindValue(":password", $password_hash, PDO::PARAM_STR);

    $userstmt->bindValue(":firstname", $customerName, PDO::PARAM_STR);

    $userstmt->bindValue(":middlename", 'NA', PDO::PARAM_STR);

    $userstmt->bindValue(":lastname", 'NA', PDO::PARAM_STR);

    $userstmt->bindValue(":department", 'Customer', PDO::PARAM_STR);

    $userstmt->bindValue(":contactnumber", $contactNo, PDO::PARAM_INT);

    $userstmt->bindValue(":otp", $otp, PDO::PARAM_INT);

    $userstmt->bindValue(":usertracker", 'CustomerReg', PDO::PARAM_STR);

    $userstmt->execute();

    $conn->commit();

} catch (Exception $e) {

    $conn->rollBack();

    echo json_encode(['error' => 'An error occurred: ' . $e->getMessage()]);

}
