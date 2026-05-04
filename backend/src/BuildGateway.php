<?php

class BuildGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT lkp_build_of_products.build_code, lkp_build_of_products.desc, lkp_build_of_products.build_qty,
            lkp_build_of_products.uomval, lkp_build_of_products.uom,
            tbl_pricing_details.pricing_code as pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,
            lkp_build_of_products.level, lkp_build_of_products.tax_type, lkp_build_of_products.category, lkp_build_of_products.expiry_days,
            lkp_build_of_products.portion_parent
            FROM lkp_build_of_products
            LEFT OUTER JOIN tbl_pricing_details ON lkp_build_of_products.build_code =  tbl_pricing_details.inv_code
            LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            WHERE lkp_build_of_products.deletestatus = 'Active'
            ORDER BY lkp_build_of_products.desc";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getBuildData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT lkp_build_of_products.build_code, lkp_build_of_products.desc, lkp_build_of_products.build_qty,
        lkp_build_of_products.uomval, lkp_build_of_products.uom,
        tbl_pricing_details.pricing_code as pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,
        lkp_build_of_products.level, lkp_build_of_products.tax_type, lkp_build_of_products.category, lkp_build_of_products.expiry_days,
        lkp_build_of_products.portion_parent
        FROM lkp_build_of_products
        LEFT OUTER JOIN tbl_pricing_details ON lkp_build_of_products.build_code =  tbl_pricing_details.inv_code
        LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
        WHERE lkp_build_of_products.desc LIKE :search
        AND lkp_build_of_products.deletestatus = 'Active'
        GROUP BY lkp_build_of_products.build_code
        LIMIT 
        :pageIndex, :pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
        $stmt->bindValue(":pageIndex", (int)$pageIndex, PDO::PARAM_INT);
        $stmt->bindValue(":pageData", (int)$pageData, PDO::PARAM_INT);
        $stmt->execute();

            $ProductItems = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $ProductItems[] = $row;
            }


            return [
                'items' => $ProductItems,
            
                'nextPage' => $page + 1, // Provide the next page number

            ];

    }

    public function getDistinctAllData()
    {

        $sql = "SELECT * FROM lkp_build_of_products
            WHERE deletestatus = 'Active'
            ORDER BY `desc` ASC;";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT lkp_build_of_products.build_code, lkp_build_of_products.desc, lkp_build_of_products.build_qty,
            lkp_build_of_products.uomval, lkp_build_of_products.uom,
            tbl_pricing_details.pricing_code as pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,
            lkp_build_of_products.level, lkp_build_of_products.tax_type, lkp_build_of_products.category, lkp_build_of_products.expiry_days,
            lkp_build_of_products.portion_parent
            FROM lkp_build_of_products
            LEFT OUTER JOIN tbl_pricing_details ON lkp_build_of_products.build_code =  tbl_pricing_details.inv_code
            LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            WHERE lkp_build_of_products.deletestatus = 'Active'
            ORDER BY lkp_build_of_products.desc LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getForUser($user_id, $id): array
    {

        $sql = "SELECT *



                FROM tbl_tasks



                WHERE id = :id



                AND user_id = :user_id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_INT);

        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

        $stmt->execute();

        $data = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($data !== false) {

            $data['is_completed'] = (bool) $data['is_completed'];

        }

        return $data;

    }

    public function createForUser($user_id, $data)
    {
        // Extract POST values
        $buildname = $_POST['buildname'] ?? '';
        $build_qty = $_POST['build_qty'] ?? '';
        $uomval = $_POST['uomval'] ?? '';
        $uom = $_POST['uom'] ?? '';
        $cost_per_uom = $_POST['cost_per_uom'] ?? 0;
        $srp = $_POST['srp'] ?? 0;
        $productlevel = $_POST['productlevel'] ?? '';
        $tax_type = $_POST['tax_type'] ?? '';
        $productcategory = $_POST['productcategory'] ?? '';
        $expiry = $_POST['expiry'] ?? '';
        $portionparent = $_POST['portionparent'] ?? '';

        $shortUuid = "BD-" . substr(bin2hex(random_bytes(6)), 0, 12);

        // Check for duplicate entry
        $checkSQL = "SELECT COUNT(*) FROM lkp_build_of_products WHERE `desc` = :buildname AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($checkSQL);
        $stmt->bindValue(":buildname", $buildname);
        $stmt->execute();

        if ($stmt->fetchColumn() > 0) {
            if ($imageFilename && file_exists($uploadDir . $imageFilename)) {
                unlink($uploadDir . $imageFilename);
            }
            echo json_encode(["message" => "DuplicateBuild"]);
            return;
        }

        try {
            $this->conn->beginTransaction();

            // Insert into lkp_build_of_products (no image filename)
            $insertSQL = "INSERT INTO lkp_build_of_products ()
                          VALUES (default, :shortUuid, :desc, :build_qty, :uomval, :uom, :cost_per_uom,
                          :srp, :productlevel, :tax_type, :productcategory, :expiry_days, :portion_parent,
                          'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($insertSQL);
            $stmt->bindValue(":shortUuid", $shortUuid);
            $stmt->bindValue(":desc", $buildname);
            $stmt->bindValue(":build_qty", $build_qty);
            $stmt->bindValue(":uomval", $uomval);
            $stmt->bindValue(":uom", $uom);
            $stmt->bindValue(":cost_per_uom", $cost_per_uom);
            $stmt->bindValue(":srp", $srp);
            $stmt->bindValue(":productlevel", $productlevel);
            $stmt->bindValue(":tax_type", $tax_type);
            $stmt->bindValue(":productcategory", $productcategory);
            $stmt->bindValue(":expiry_days", $expiry);
            $stmt->bindValue(":portion_parent", $portionparent);
            $stmt->bindValue(":user_tracker", $user_id);
            $stmt->execute();

            // Get busunitcodes
            $busunitSQL = "SELECT busunitcode FROM lkp_busunits 
                           WHERE (class = 'DEPARTMENT' OR class = 'STORE') AND deletestatus = 'Active'";
            $stmt = $this->conn->prepare($busunitSQL);
            $stmt->execute();
            $busunits = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Insert into tbl_inventory_transactions
            $inventorySQL = "INSERT INTO tbl_inventory_transactions ()
                             VALUES (default, DATE_ADD(NOW(), INTERVAL 8 HOUR), :shortUuid, '0', :cost_per_uom, :uomval,
                             :uom, 'Manual', :busunitcode, 'FG', '', 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            foreach ($busunits as $unit) {
                $stmt = $this->conn->prepare($inventorySQL);
                $stmt->bindValue(":shortUuid", $shortUuid);
                $stmt->bindValue(":cost_per_uom", $cost_per_uom);
                $stmt->bindValue(":uomval", $uomval);
                $stmt->bindValue(":uom", $uom);
                $stmt->bindValue(":busunitcode", $unit['busunitcode']);
                $stmt->bindValue(":usertracker", $user_id);
                $stmt->execute();
            }

            // Handle image upload
        $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/images/pos/';
        $imageFilename = null;

        if (isset($_FILES['posimage']) && $_FILES['posimage']['error'] === UPLOAD_ERR_OK) {
            $imageFilename = $shortUuid . '.png'; // Force .png extension
            $targetFile = $uploadDir . $imageFilename;

            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $imageTmpPath = $_FILES['posimage']['tmp_name'];
            $imageInfo = getimagesize($imageTmpPath);
            $mime = $imageInfo['mime'];

            switch ($mime) {
                case 'image/jpeg':
                    $image = imagecreatefromjpeg($imageTmpPath);
                    break;
                case 'image/png':
                    $image = imagecreatefrompng($imageTmpPath);
                    break;
                case 'image/gif':
                    $image = imagecreatefromgif($imageTmpPath);
                    break;
                case 'image/webp':
                    $image = imagecreatefromwebp($imageTmpPath);
                    break;
                default:
                    echo json_encode(["message" => "UnsupportedImageType"]);
                    return;
            }

            // Convert and save as PNG
            if (!imagepng($image, $targetFile)) {
                echo json_encode(["message" => "imageConversionError"]);
                return;
            }

            imagedestroy($image); 
        }

            $this->conn->commit();
            echo json_encode(["message" => "Created"]);
        } catch (PDOException $e) {
            $this->conn->rollBack();

            if ($imageFilename && file_exists($uploadDir . $imageFilename)) {
                unlink($uploadDir . $imageFilename);
            }

            error_log("DB error: " . $e->getMessage());
            echo json_encode(["message" => "Error", "details" => $e->getMessage()]);
        }
    }

    public function editData($user_id, $data)
    {
        // Get JSON input
        $jsonInput = file_get_contents("php://input");
        $formData = json_decode($jsonInput, true);

        // Debug logging
        error_log("Received data: " . print_r($formData, true));

        // Extract data with proper type casting
        $build_id = $formData['buildCode'] ?? '';
        $buildname = $formData['buildname'] ?? '';
        $build_qty = $formData['build_qty'] ?? '';
        $uomval = $formData['uomval'] ?? '';
        $uom = $formData['uom'] ?? '';
        $cost_per_uom = floatval($formData['cost_per_uom'] ?? 0);
        $srp = floatval($formData['srp'] ?? 0);
        $productlevel = $formData['productlevel'] ?? '';
        $tax_type = $formData['tax_type'] ?? '';
        $productcategory = $formData['productcategory'] ?? '';
        $expiry = $formData['expiry'] ?? '';
        $portionparent = $formData['portionparent'] ?? '';

        // Validate build_id
        if (empty($build_id)) {
            error_log("Empty build_id received");
            echo json_encode(["message" => "MissingBuildID"]);
            return;
        }

        error_log("Processing build_id: " . $build_id);

        try {
            $this->conn->beginTransaction();

            $updateSQL = "UPDATE lkp_build_of_products SET
                            `desc` = :buildname,
                            build_qty = :build_qty,
                            uomval = :uomval,
                            uom = :uom,
                            cost_per_uom = :cost_per_uom,
                            srp = :srp,
                            level = :productlevel,
                            tax_type = :tax_type,
                            category = :productcategory,
                            expiry_days = :expiry,
                            portion_parent = :portionparent,
                            usertracker = :user_tracker
                          WHERE build_code = :build_id";

            $stmt = $this->conn->prepare($updateSQL);

            // Bind values with explicit type casting where needed
            $stmt->bindValue(":buildname", $buildname, PDO::PARAM_STR);
            $stmt->bindValue(":build_qty", $build_qty, PDO::PARAM_STR);
            $stmt->bindValue(":uomval", $uomval, PDO::PARAM_STR);
            $stmt->bindValue(":uom", $uom, PDO::PARAM_STR);
            $stmt->bindValue(":cost_per_uom", $cost_per_uom, PDO::PARAM_STR);
            $stmt->bindValue(":srp", $srp, PDO::PARAM_STR);
            $stmt->bindValue(":productlevel", $productlevel, PDO::PARAM_STR);
            $stmt->bindValue(":tax_type", $tax_type, PDO::PARAM_STR);
            $stmt->bindValue(":productcategory", $productcategory, PDO::PARAM_STR);
            $stmt->bindValue(":expiry", $expiry, PDO::PARAM_STR);
            $stmt->bindValue(":portionparent", $portionparent, PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":build_id", $build_id, PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();
            echo json_encode(["message" => "Edited"]);

        } catch (PDOException $e) {
            $this->conn->rollBack();
            error_log("Database error: " . $e->getMessage());
            echo json_encode(["message" => "UpdateError", "details" => $e->getMessage()]);
        }
    }




    public function deleteData($user_id, $data)
    {

        $sql = "UPDATE lkp_build_of_products
                SET
                    deletestatus = 'Inactive',
                    usertracker  = :usertracker

                WHERE
                      seq  = :ids";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":ids", $data["buildCode"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_build_of_products Where deletestatus = 'Active'
         ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        $response = [
            'items' => $data,
            'nextPage' => $page + 1, // Provide the next page number
        ];

        return $response;

    }

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT lkp_build_of_products.build_code, lkp_build_of_products.desc, lkp_build_of_products.build_qty,
            lkp_build_of_products.uomval, lkp_build_of_products.uom, lkp_build_of_products.seq,
            tbl_pricing_details.pricing_code as pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,
            lkp_build_of_products.level, lkp_build_of_products.tax_type, lkp_build_of_products.category, lkp_build_of_products.expiry_days,
            lkp_build_of_products.portion_parent
            FROM lkp_build_of_products
            LEFT OUTER JOIN tbl_pricing_details ON lkp_build_of_products.build_code =  tbl_pricing_details.inv_code
            LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            WHERE lkp_build_of_products.deletestatus = 'Active'
            AND lkp_build_of_products.desc LIKE CONCAT('%', :search, '%')
            ORDER BY lkp_build_of_products.desc ASC
            LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        $response = [
            'items' => $data,
            'nextPage' => $page + 1, // Provide the next page number
        ];

        return $response;

    }

    public function getClearingData()
    {

        $sql = "SELECT * FROM lkp_build_of_products Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function updateForUser(int $user_id, string $id, array $data): int
    {

        $fields = [];

        if (!empty($data["name"])) {

            $fields["name"] = [

                $data["name"],

                PDO::PARAM_STR,

            ];

        }

        if (array_key_exists("priority", $data)) {

            $fields["priority"] = [

                $data["priority"],

                $data["priority"] === null ? PDO::PARAM_NULL : PDO::PARAM_INT,

            ];

        }

        if (array_key_exists("is_completed", $data)) {

            $fields["is_completed"] = [

                $data["is_completed"],

                PDO::PARAM_BOOL,

            ];

        }

        if (empty($fields)) {

            return 0;

        } else {

            $sets = array_map(function ($value) {

                return "$value = :$value";

            }, array_keys($fields));

            $sql = "UPDATE tbl_tasks"

            . " SET " . implode(", ", $sets)

                . " WHERE id = :id"

                . " AND user_id = :user_id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_INT);

            $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

            foreach ($fields as $name => $values) {

                $stmt->bindValue(":$name", $values[0], $values[1]);

            }

            $stmt->execute();

            return $stmt->rowCount();

        }

    }

    public function deletedataWithIds($ids)
    {

        foreach ($ids as $id) {

            $sql = "DELETE FROM tbl_sales



                WHERE uuid = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_STR);

            $stmt->execute();

        }

        return $stmt->rowCount();

    }

}
