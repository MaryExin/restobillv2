<?php

declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

class ImageCompressor {
    /**
     * Compress PNG images (quality: 0 - no compression, 9 - max compression)
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

$buildcode = $_POST["buildCode"];
$buildname = $_POST["buildname"];
$buildqty = $_POST["build_qty"];
$uomval = $_POST["uomval"];
$uom = $_POST["uom"];
$cost_per_uom = $_POST["cost_per_uom"];
$srp = $_POST["srp"];
$productlevel = $_POST["productlevel"];
$tax_type = $_POST["tax_type"];
$productcategory = $_POST["productcategory"];
$expiry = $_POST["expiry"];
$portionparent = $_POST["portionparent"] ?? null;

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);
$conn = $database->getConnection();
$imageCompressor = new ImageCompressor();

try {
    $conn->beginTransaction();

    // Update build data
    $sql = "UPDATE lkp_build_of_products SET
                        `desc` = :buildname,
                        build_qty = :build_qty,
                        uomval = :uomval,
                        uom = :uom,
                        cost_per_uom = :cost_per_uom,
                        level = :productlevel,
                        tax_type = :tax_type,
                        category = :productcategory,
                        expiry_days = :expiry
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
    $stmt->execute();

    // Handle image update
    if (isset($_FILES["posimage"]) && $_FILES["posimage"]["error"] === UPLOAD_ERR_OK) {
        $imagePath = dirname(__DIR__, 1) . "/images/pos/";
        $imageFilename = $buildcode . ".png";
        $targetPath = $imagePath . $imageFilename;

        // Delete any existing image for this buildcode
        foreach (glob($imagePath . $buildcode . '.*') as $existingFile) {
            unlink($existingFile);
        }

        // Convert uploaded image to PNG format
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

        // Save image as PNG
        if (!imagepng($image, $targetPath)) {
            throw new Exception("Failed to save image as PNG.");
        }

        imagedestroy($image);

        // Compress the PNG
        $imageCompressor->compress($targetPath, $targetPath);
    }

    $conn->commit();
    echo json_encode(["message" => "Success"]);
} catch (Exception $e) {
    $conn->rollBack();
    echo json_encode(["message" => "An error occurred: " . $e->getMessage()]);
}
