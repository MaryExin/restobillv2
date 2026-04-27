<?php

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

class ImageCompressor {
    /**
     * Compress PNG images (quality: 0 - No compression, 9 - max compression)
     */
    public function compress(string $sourcePath, string $destinationPath, int $quality = 9): void {
        $image = imagecreatefrompng($sourcePath);
        if (!$image) {
            throw new Exception("Failed to load image for compression.");
        } 

        imagepng($image, $destinationPath, $quality);
        imagedestroy($image);
    }
}

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$buildcode = $_POST["buildCode"] ?? "";
$buildname = $_POST["buildname"] ?? "";
$buildqty = $_POST["build_qty"] ?? "";
$uomval = $_POST["uomval"] ?? "";
$uom = $_POST["uom"] ?? "";
$cost_per_uom = $_POST["cost_per_uom"] ?? 0;
$srp = $_POST["srp"] ?? 0;
$productlevel = $_POST["productlevel"] ?? "";
$tax_type = $_POST["tax_type"] ?? "";
$productcategory = $_POST["productcategory"] ?? "";
$expiry = $_POST["expiry"] ?? "";
$portionparent = $_POST["portionparent"] ?? null;
$brandcode = $_POST["brandcode"] ?? null;
$productcode = $_POST["productcode"] ?? null;
$isdiscountable = $_POST["isdiscountable"] ?? "No";
$seq = $_POST["seq"] ?? null;

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);
$conn = $database->getConnection();
$imageCompressor = new ImageCompressor();

try {
    $conn->beginTransaction();

    // Check for duplicate entry product desc
    $checkSQL = "SELECT COUNT(*) FROM lkp_build_of_products WHERE `desc` = :buildname 
                 AND seq <> :seq
                 AND deletestatus = 'Active'";
    $stmt = $conn->prepare($checkSQL);
    $stmt->bindValue(":buildname", $buildname);
    $stmt->bindValue(":seq", $seq);
    $stmt->execute();

    if ($stmt->fetchColumn() > 0) {
        echo json_encode(["message" => "DuplicateBuild"]);
        return;
    }

    // Check for duplicate entry for productcode
    $checkSQL = "SELECT COUNT(*) FROM lkp_build_of_products WHERE productcode = :productcode 
                 AND seq <> :seq
                 AND deletestatus = 'Active'";
    $stmt = $conn->prepare($checkSQL);
    $stmt->bindValue(":productcode", $productcode);
    $stmt->bindValue(":seq", $seq);
    $stmt->execute();

    if ($stmt->fetchColumn() > 0) {
        echo json_encode(["message" => "DuplicateBuild"]);
        return;
    }

    $sql = "UPDATE lkp_build_of_products SET
                    `desc` = :buildname,
                    build_qty = :build_qty,
                    uomval = :uomval,
                    uom = :uom,
                    cost_per_uom = :cost_per_uom,
                    level = :productlevel,
                    tax_type = :tax_type,
                    category = :productcategory,
                    expiry_days = :expiry,
                    brandcode = :brandcode,
                    productcode = :productcode,
                    isdiscountable = :isdiscountable
                WHERE build_code = :buildcode";

    $stmt = $conn->prepare($sql);
    $stmt->bindValue(":buildname", $buildname);
    $stmt->bindValue(":build_qty", $buildqty);
    $stmt->bindValue(":uomval", $uomval);
    $stmt->bindValue(":uom", $uom);
    $stmt->bindValue(":cost_per_uom", $cost_per_uom);
    $stmt->bindValue(":productlevel", $productlevel);
    $stmt->bindValue(":tax_type", $tax_type);
    $stmt->bindValue(":productcategory", $productcategory);
    $stmt->bindValue(":expiry", $expiry);
    $stmt->bindValue(":buildcode", $buildcode);
    $stmt->bindValue(":brandcode", $brandcode);
    $stmt->bindValue(":productcode", $productcode);
    $stmt->bindValue(":isdiscountable", $isdiscountable);
    $stmt->execute();

    // Handle image update
    if (isset($_FILES["posimage"]) && $_FILES["posimage"]["error"] === UPLOAD_ERR_OK) {
        $imagePath = dirname(__DIR__, 1) . "/images/pos/";
        $imageFilename = $buildcode . ".png";
        $targetPath = $imagePath . $imageFilename;

        foreach (glob($imagePath . $buildcode . '.*') as $existingFile) {
            unlink($existingFile);
        }

        $uploadedTempPath = $_FILES["posimage"]["tmp_name"];
        $imageInfo = getimagesize($uploadedTempPath);

        if (!$imageInfo) {
            throw new Exception("Invalid image file.");
        }

        $mime = $imageInfo['mime'];

        switch ($mime) {
            case 'image/jpeg':
                $image = imagecreatefromjpeg($uploadedTempPath);
                break;
            case 'image/png':
                $image = imagecreatefrompng($uploadedTempPath);
                break;
            case 'image/gif':
                $image = imagecreatefromgif($uploadedTempPath);
                break;
            default:
                throw new Exception("Unsupported image type.");
        }

        if (!imagepng($image, $targetPath)) {
            throw new Exception("Failed to save image as PNG.");
        }

        imagedestroy($image);

        $imageCompressor->compress($targetPath, $targetPath);
    }

    $conn->commit();
    echo json_encode(["message" => "Edited"]);
} catch (Exception $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    echo json_encode(["message" => "An error occurred: " . $e->getMessage()]);
}