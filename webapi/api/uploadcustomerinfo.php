<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: POST");
    echo json_encode(["message" => "Method Not Allowed"]);
    exit;
}

$customerName = strtoupper(trim((string) ($_POST["customername"] ?? "")));
$branchName = trim((string) ($_POST["branchname"] ?? ""));
$tin = trim((string) ($_POST["tin"] ?? ""));
$address = trim((string) ($_POST["address"] ?? ""));
$contactNo = trim((string) ($_POST["contactno"] ?? ""));
$email = trim((string) ($_POST["email"] ?? ""));
$otherInfo = trim((string) ($_POST["otherinfo"] ?? ""));
$charttypedatas = isset($_POST["charttypedata"])
    ? json_decode((string) $_POST["charttypedata"], true)
    : [];

if ($customerName === "") {
    http_response_code(400);
    echo json_encode(["message" => "Customer name is required"]);
    exit;
}

if (!is_array($charttypedatas)) {
    $charttypedatas = [];
}

$charttypedatas = array_values(array_unique(array_filter($charttypedatas, function ($v) {
    return $v !== null && $v !== "";
})));

$database = new Database(
    $_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]
);

$conn = $database->getConnection();

$imageCompressor = new ImageCompressor();
$otpController = new OTP();
$otp = $otpController->generateOTP();

try {
    $conn->beginTransaction();

    // Check duplicate customer details
    $sql = "SELECT COUNT(*)
            FROM tbl_customer_details
            WHERE (LOWER(email) = LOWER(:email)
               OR LOWER(customername) = LOWER(:customername))
              AND deletestatus = 'Active'";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":customername", $customerName, PDO::PARAM_STR);
    $stmt->execute();

    if ((int) $stmt->fetchColumn() > 0) {
        $conn->rollBack();
        echo json_encode(["message" => "Duplicate"]);
        exit;
    }

    // Check duplicate user account email
    $sql = "SELECT COUNT(*)
            FROM tbl_users_global_assignment
            WHERE LOWER(email) = LOWER(:email)
              AND deletestatus = 'Active'";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":email", strtolower($email), PDO::PARAM_STR);
    $stmt->execute();

    if ((int) $stmt->fetchColumn() > 0) {
        $conn->rollBack();
        echo json_encode(["message" => "DuplicateUser"]);
        exit;
    }

    // Generate safe AR slcode
    $glcode = "120";
    $gldescription = "ACCOUNTS RECEIVABLE";
    $sldescs = $gldescription . " - " . $customerName;

    $generateidsql = "
        SELECT MAX(CAST(SUBSTRING(slcodes, 4) AS UNSIGNED)) AS last_seq
        FROM lkp_slcodes
        WHERE glcode = :glcode
          AND deletestatus = 'Active'
        FOR UPDATE
    ";
    $generateidstmt = $conn->prepare($generateidsql);
    $generateidstmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
    $generateidstmt->execute();

    $lastSeq = (int) $generateidstmt->fetchColumn();
    $nextSeq = $lastSeq + 1;
    $slcode = $glcode . sprintf("%03d", $nextSeq);

    // Double-check generated slcode
    $checkSlSql = "SELECT COUNT(*)
                   FROM lkp_slcodes
                   WHERE glcode = :glcode
                     AND slcodes = :slcodes
                     AND deletestatus = 'Active'";
    $checkSlStmt = $conn->prepare($checkSlSql);
    $checkSlStmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
    $checkSlStmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
    $checkSlStmt->execute();

    if ((int) $checkSlStmt->fetchColumn() > 0) {
        throw new Exception("Generated SL code already exists: " . $slcode);
    }

    // Insert lkp_slcodes
    $sql = "INSERT INTO lkp_slcodes
            (uuid, glcode, slcodes, sldescription, deletestatus, usertracker, createtime)
            VALUES
            (CONCAT('SL-', ShortUUID()), :glcode, :slcode, :sldescription, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
    $stmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
    $stmt->bindValue(":sldescription", $sldescs, PDO::PARAM_STR);
    $stmt->bindValue(":usertracker", $customerName, PDO::PARAM_STR);
    $stmt->execute();

    // Insert lkp_chart_of_accounts
    if (!empty($charttypedatas)) {
        $acctgaccountsql = "INSERT INTO lkp_chart_of_accounts
                            (seq, chart_type_id, glcode, gl_description, slcode, sl_description, deletestatus, usertracker, createdtime)
                            VALUES
                            (default, :charttype, :glcode, :gldescription, :slcode, :sldescription, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $acctgaccountstmt = $conn->prepare($acctgaccountsql);

        foreach ($charttypedatas as $charttype) {
            $acctgaccountstmt->bindValue(":charttype", (string) $charttype, PDO::PARAM_STR);
            $acctgaccountstmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
            $acctgaccountstmt->bindValue(":gldescription", $gldescription, PDO::PARAM_STR);
            $acctgaccountstmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
            $acctgaccountstmt->bindValue(":sldescription", $sldescs, PDO::PARAM_STR);
            $acctgaccountstmt->bindValue(":usertracker", $customerName, PDO::PARAM_STR);
            $acctgaccountstmt->execute();
        }
    }

    // Generate safer customer ID
    do {
        $customerId = "C-" . date("Ym") . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));

        $checkCustomerIdSql = "SELECT COUNT(*) FROM tbl_customer_details WHERE customer_id = :customer_id";
        $checkCustomerIdStmt = $conn->prepare($checkCustomerIdSql);
        $checkCustomerIdStmt->bindValue(":customer_id", $customerId, PDO::PARAM_STR);
        $checkCustomerIdStmt->execute();
        $customerIdExists = (int) $checkCustomerIdStmt->fetchColumn() > 0;
    } while ($customerIdExists);

    // Insert customer information using ACTUAL DB columns
    $sql = "INSERT INTO tbl_customer_details
            (seq, customer_id, customername, branchname, tin, address, contact_no, email, otherinfo, image_filename, slcode, deletestatus, createdtime)
            VALUES
            (default, :customerId, :customername, :branchname, :tin, :address, :contact_no, :email, :otherinfo, null, :slcode, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":customerId", $customerId, PDO::PARAM_STR);
    $stmt->bindValue(":customername", $customerName, PDO::PARAM_STR);
    $stmt->bindValue(":branchname", $branchName, PDO::PARAM_STR);
    $stmt->bindValue(":tin", $tin, PDO::PARAM_STR);
    $stmt->bindValue(":address", $address, PDO::PARAM_STR);
    $stmt->bindValue(":contact_no", $contactNo, PDO::PARAM_STR);
    $stmt->bindValue(":email", strtoupper($email), PDO::PARAM_STR);
    $stmt->bindValue(":otherinfo", $otherInfo, PDO::PARAM_STR);
    $stmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
    $stmt->execute();

    // Handle image upload/default image path
    $imagePath = dirname(__DIR__, 1) . "/images/customers/";
    if (!is_dir($imagePath)) {
        mkdir($imagePath, 0777, true);
    }

    $imageFilename = $customerId . ".png";
    $targetPath = $imagePath . $imageFilename;
    $finalImageValue = $targetPath;

    if (isset($_FILES["customerimage"]) && $_FILES["customerimage"]["error"] === UPLOAD_ERR_OK) {
        if (move_uploaded_file($_FILES["customerimage"]["tmp_name"], $targetPath)) {
            $jpegQuality = 10;
            $imageCompressor->compressToJpeg($targetPath, $targetPath, $jpegQuality);
        }
    }

    $updateSql = "UPDATE tbl_customer_details
                  SET image_filename = :targetpath
                  WHERE customer_id = :customer_id";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->bindValue(":targetpath", $finalImageValue, PDO::PARAM_STR);
    $updateStmt->bindValue(":customer_id", $customerId, PDO::PARAM_STR);
    $updateStmt->execute();

    // Create user account
    $password_hash = password_hash("1234", PASSWORD_DEFAULT);
    $emails = strtolower($email);

    $usersql = "INSERT INTO tbl_users_global_assignment
                (uuid, email, classification, password, firstname, middlename, lastname, company, department, contactnumber, status, verified, passlock, otp, otplock, usertracker, deletestatus, createtime)
                VALUES
                (:uuid, :email, :classification, :password, :firstname, :middlename, :lastname, 'Current', :department, :contactnumber, 'Inactive', 'Verified', 0, :otp, 0, :usertracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $userstmt = $conn->prepare($usersql);
    $userstmt->bindValue(":uuid", $customerId, PDO::PARAM_STR);
    $userstmt->bindValue(":email", $emails, PDO::PARAM_STR);
    $userstmt->bindValue(":classification", "Customer", PDO::PARAM_STR);
    $userstmt->bindValue(":password", $password_hash, PDO::PARAM_STR);
    $userstmt->bindValue(":firstname", $customerName, PDO::PARAM_STR);
    $userstmt->bindValue(":middlename", "NA", PDO::PARAM_STR);
    $userstmt->bindValue(":lastname", "NA", PDO::PARAM_STR);
    $userstmt->bindValue(":department", "Customer", PDO::PARAM_STR);
    $userstmt->bindValue(":contactnumber", $contactNo, PDO::PARAM_STR);
    $userstmt->bindValue(":otp", $otp, PDO::PARAM_INT);
    $userstmt->bindValue(":usertracker", "CustomerReg", PDO::PARAM_STR);
    $userstmt->execute();

    $conn->commit();

    if (isset($_FILES["customerimage"]) && $_FILES["customerimage"]["error"] === UPLOAD_ERR_OK) {
        echo json_encode([
            "message" => "imageUploadSuccess",
            "customer_id" => $customerId,
            "slcode" => $slcode,
        ]);
    } else {
        echo json_encode([
            "message" => "infoOnlyUploadSuccess",
            "customer_id" => $customerId,
            "slcode" => $slcode,
        ]);
    }
} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        "code" => $e->getCode(),
        "message" => $e->getMessage(),
        "file" => $e->getFile(),
        "line" => $e->getLine(),
    ]);
}