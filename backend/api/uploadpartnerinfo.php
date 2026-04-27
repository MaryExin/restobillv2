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
$data = (array) json_decode(file_get_contents("php://input"), true);
$address = $data["address"];
$branchName = $data["branchname"];
$contactNo = $data["contactno"];
$email = $data["email"];
$otherInfo = $data["otherinfo"];
$partnersinfo = $data["partnersInfo"];
$tin = $data["tin"];

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],

    $_ENV["DB_PASS"]);

$conn = $database->getConnection();



$imageCompressor = new ImageCompressor();

$otpController = new OTP();

$otp = $otpController->generateOTP();

try {
    $conn->beginTransaction();

    //Check if Exist

    $sql = "SELECT * FROM `tbl_partnership_details`
            WHERE LOWER(email) = LOWER(:email)
            OR LOWER(partnersinfo) = LOWER(:partnersinfo)
            AND delete_status = 'Active'";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":partnersinfo", $partnersinfo, PDO::PARAM_STR);

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

    $currentYear = date("Y");

    $currentMonth = date("m");

    $randomNumber = mt_rand(100000, 999999);

    $partnerId = "P-" . $currentYear . $currentMonth . strval($randomNumber);

    //Post Partner Information



    $sql = "INSERT INTO `tbl_partnership_details` () VALUES
         (default, :partnerId, :partnersinfo, :branchName, :tin, :address,
         :contactNo, :email, :otherinfo, null,
         'Active', DATE_ADD(NOW(),INTERVAL 8 HOUR))";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":partnerId", $partnerId, PDO::PARAM_STR);

    $stmt->bindValue(":partnersinfo", $partnersinfo, PDO::PARAM_STR);

    $stmt->bindValue(":branchName", $branchName, PDO::PARAM_STR);

    $stmt->bindValue(":tin", $tin, PDO::PARAM_STR);

    $stmt->bindValue(":address", $address, PDO::PARAM_STR);

    $stmt->bindValue(":contactNo", $contactNo, PDO::PARAM_STR);

    $stmt->bindValue(":email", $email, PDO::PARAM_INT);

    $stmt->bindValue(":otherinfo", $otherInfo, PDO::PARAM_INT);

    $stmt->execute();

    // Handle the uploaded image

    if (isset($_FILES['partnerimage']) && $_FILES['partnerimage']['error'] === UPLOAD_ERR_OK) {

        $imagePath = dirname(__DIR__, 1) . '/images/partners/';

        $imageFilename = $partnerId . '.png'; // Unique filename

        $targetPath = $imagePath . $imageFilename;

        // Move the uploaded image to the "images" folder

        if (move_uploaded_file($_FILES['partnerimage']['tmp_name'], $targetPath)) {

            // Compress the image to low-quality JPEG

            $jpegQuality = 10; // Adjust the quality as needed

            $imageCompressor->compressToJpeg($targetPath, $targetPath, $jpegQuality);

            // Update the image_path and image_filename in the database

            $updateSql = "UPDATE `tbl_partnership_details` SET image_filename = :targetpath WHERE partner_id = :partner_id";

            $updateStmt = $conn->prepare($updateSql);

            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

            $updateStmt->bindValue(":partner_id", $partnerId, PDO::PARAM_STR);

            $updateStmt->execute();

            echo json_encode(['message' => 'imageUploadSuccess']);

        } else {

            $imagePath = dirname(__DIR__, 1) . '/images/partners/';

            $imageFilename = $partnerId; // Unique filename

            $targetPath = $imagePath . $imageFilename;

            // Update the image_path and image_filename in the database

            $updateSql = "UPDATE `tbl_partner_details` SET image_filename = :targetpath WHERE partner_id = :partner_id";

            $updateStmt = $conn->prepare($updateSql);

            $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

            $updateStmt->bindValue(":partner_id", $partnerId, PDO::PARAM_STR);

            $updateStmt->execute();

            echo json_encode(['error' => 'imageUploadError']);

        }

    } else {

        $imagePath = dirname(__DIR__, 1) . '/images/partners/';

        $imageFilename = $partnerId; // Unique filename

        $targetPath = $imagePath . $imageFilename;

// Update the image_path and image_filename in the database

        $updateSql = "UPDATE `tbl_partnership_details` SET image_filename = :targetpath WHERE partner_id = :partner_id";

        $updateStmt = $conn->prepare($updateSql);

        $updateStmt->bindValue(":targetpath", $targetPath, PDO::PARAM_STR);

        $updateStmt->bindValue(":partner_id", $partnerId, PDO::PARAM_STR);

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

    $userstmt->bindValue(":uuid", $partnerId, PDO::PARAM_STR);

    $userstmt->bindValue(":email", $emails, PDO::PARAM_STR);

    $userstmt->bindValue(":classification", 'partner', PDO::PARAM_STR);

    $userstmt->bindValue(":password", $password_hash, PDO::PARAM_STR);

    $userstmt->bindValue(":firstname", $partnersinfo, PDO::PARAM_STR);

    $userstmt->bindValue(":middlename", 'NA', PDO::PARAM_STR);

    $userstmt->bindValue(":lastname", 'NA', PDO::PARAM_STR);

    $userstmt->bindValue(":department", 'partner', PDO::PARAM_STR);

    $userstmt->bindValue(":contactnumber", $contactNo, PDO::PARAM_INT);

    $userstmt->bindValue(":otp", $otp, PDO::PARAM_INT);

    $userstmt->bindValue(":usertracker", 'partnerReg', PDO::PARAM_STR);

    $userstmt->execute();

    $conn->commit();

} catch (Exception $e) {

    $conn->rollBack();

    echo json_encode(['error' => 'An error occurred: ' . $e->getMessage()]);

}
