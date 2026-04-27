<?php







class BusUnitGateway



{







    private $conn;







    public function __construct(Database $database)



    {







        $this->conn = $database->getConnection();







    }







    public function getAllData()



    {







        $sql = "SELECT * FROM lkp_busunits Where deletestatus = 'Active' ORDER BY name ASC";







        $stmt = $this->conn->prepare($sql);







        $stmt->execute();







        $data = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $data[] = $row;







        }







        return $data;







    }







    public function getFilteredData()



    {







        $sql = "SELECT * FROM lkp_busunits WHERE class IN ('DEPARTMENT', 'COMMI', 'SPOILAGE')  AND deletestatus = 'Active'  ORDER BY class ASC, name ASC";







        $stmt = $this->conn->prepare($sql);







        $stmt->execute();







        $data = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $data[] = $row;







        }







        return $data;







    }







    public function getFilteredDataByStores()



    {







        $sql = "SELECT * FROM lkp_busunits WHERE class IN ('STORE', 'COMMI', 'DEPARTMENT')  AND deletestatus = 'Active'  ORDER BY class ASC, name ASC";







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







        $sql = "SELECT lkp_busunits.busunitcode,   lkp_busunits.class, lkp_busunits.name, lkp_busunits.address,







        lkp_busunits.brandcode, lkp_busunits.brandcode, lkp_busunits.corpcode, lkp_corporation.corp_name,







        lkp_busunits.areacode, lkp_area.area_name, lkp_busunits.opstarteddate,







        lkp_busunits.pricing_category, lkp_pricing_code.pricing_code, 

        

        lkp_busunits.purchase_price_category, purchase_pricing_code.pricing_code AS purchase_pricing_code

        

        , lkp_busunits.ownership_status





        FROM lkp_busunits







        LEFT OUTER JOIN lkp_pricing_code ON lkp_busunits.pricing_category = lkp_pricing_code.uuid



        

        LEFT OUTER JOIN lkp_pricing_code AS purchase_pricing_code ON lkp_busunits.purchase_price_category = purchase_pricing_code.uuid





        -- LEFT OUTER JOIN lkp_busunits ON lkp_busunits.brandcode = lkp_busunits.brand_code







        LEFT OUTER JOIN lkp_corporation ON lkp_busunits.corpcode = lkp_corporation.corp_code







        LEFT OUTER JOIN lkp_area ON lkp_busunits.areacode = lkp_area.area_code







        WHERE lkp_busunits.deletestatus = 'Active'







        ORDER BY lkp_busunits.name ASC







        LIMIT $pageIndex, $pageData";







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







    public function ExcelGetBusunits()



    {







        $sql = "SELECT







                    lkp_busunits.name,







                    lkp_busunits.busunitcode,







                    lkp_corporation.corp_name,







                    lkp_corporation.sec_id,







                    lkp_corporation.sec_reg_date,







                    lkp_corporation.operating_period_start,







                    lkp_corporation.tin,







                    lkp_corporation.taxtype,







                    lkp_corporation.address,







                    lkp_corporation.zipcode







                FROM







                    lkp_busunits







                        LEFT OUTER JOIN







                    lkp_corporation ON lkp_busunits.corpcode = lkp_corporation.corp_code







                WHERE







                    lkp_busunits.deletestatus = 'Active'







                ORDER BY lkp_busunits.name ASC";







        $stmt = $this->conn->prepare($sql);







        // $stmt->bindValue(":token", $token, PDO::PARAM_STR);







        $stmt->execute();







        $data = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $data[] = $row;







        }







        return $data;







    }







public function createForUser($user_id, $data)
{
    $checkforduplisql = "SELECT COUNT(*) as count 
                         FROM lkp_busunits 
                         WHERE name = :businessunitname 
                         && deletestatus = 'Active'";

    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":businessunitname", $data["businessunitname"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = (int) $checkforduplistmt->fetchColumn();

    if ($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
        return;
    }

    // ✅ INSERT SL CODES (same statement reused for AR/AP)
    $sql = "INSERT INTO lkp_slcodes () 
            VALUES (CONCAT('SL-', ShortUUID()), :glcodes, :slcodes, :sldescs, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $stmt = $this->conn->prepare($sql);

    // ✅ INSERT CHART OF ACCOUNTS
    $acctgaccountsql = "INSERT INTO lkp_chart_of_accounts () 
                        VALUES (default, :charttype, :acctgglcodes, :acctggldecs, :acctgslcodes, :acctgsldescs, 'Active', :acctguser_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $acctgaccountstmt = $this->conn->prepare($acctgaccountsql);

    /* =========================================================
       ✅ FIXED: Generate SL Code from HIGHEST slcode per glcode
       - AR: glcode = 120
       - AP: glcode = 400
       - Uses MAX numeric suffix from slcode, NOT COUNT(*)
    ========================================================= */

    // ---------- AR (GL 120) ----------
$generateidsql = "
  SELECT COALESCE(MAX(CAST(SUBSTRING(slcodes, 4) AS UNSIGNED)), 0) AS maxnum
  FROM lkp_slcodes
  WHERE glcode = :glcodes
    AND slcodes REGEXP '^120[0-9]{3}$'
";
    $generateidstmt = $this->conn->prepare($generateidsql);
    $generateidstmt->bindValue(":glcodes", "120", PDO::PARAM_STR);
    $generateidstmt->execute();

    $maxNum120 = (int) $generateidstmt->fetchColumn();
    $nextNum120 = $maxNum120 + 1;

    $slcode = "120" . sprintf("%03d", $nextNum120);
    $sldescription = "ACCOUNTS RECEIVABLE - " . $data["businessunitname"];

    $stmt->bindValue(":glcodes", "120", PDO::PARAM_STR);
    $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
    $stmt->bindValue(":sldescs", $sldescription, PDO::PARAM_STR);
    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
    $stmt->execute();

    $charttypedatas = json_decode($data['charttypedata'], true) ?: [];
    foreach ($charttypedatas as $charttype) {
        $acctgaccountstmt->bindValue(":charttype", $charttype, PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctgglcodes", "120", PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctggldecs", "ACCOUNTS RECEIVABLE", PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctgslcodes", $slcode, PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctgsldescs", $sldescription, PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctguser_tracker", $user_id, PDO::PARAM_STR);
        $acctgaccountstmt->execute();
    }

    // ---------- AP (GL 400) ----------
$generateidsqls = "
  SELECT COALESCE(MAX(CAST(SUBSTRING(slcodes, 4) AS UNSIGNED)), 0) AS maxnum
  FROM lkp_slcodes
  WHERE glcode = :glcodes
    AND slcodes REGEXP '^400[0-9]{3}$'
";
    $generateidstmts = $this->conn->prepare($generateidsqls);
    $generateidstmts->bindValue(":glcodes", "400", PDO::PARAM_STR);
    $generateidstmts->execute();

    $maxNum400 = (int) $generateidstmts->fetchColumn();
    $nextNum400 = $maxNum400 + 1;

    $slcodes = "400" . sprintf("%03d", $nextNum400);
    $sldescriptions = "ACCOUNTS PAYABLE - " . $data["businessunitname"];

    $stmt->bindValue(":glcodes", "400", PDO::PARAM_STR);
    $stmt->bindValue(":slcodes", $slcodes, PDO::PARAM_STR);
    $stmt->bindValue(":sldescs", $sldescriptions, PDO::PARAM_STR);
    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
    $stmt->execute();

    $charttypedatass = json_decode($data['charttypedata'], true) ?: [];
    foreach ($charttypedatass as $charttypes) {
        $acctgaccountstmt->bindValue(":charttype", $charttypes, PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctgglcodes", "400", PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctggldecs", "ACCOUNTS PAYABLE", PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctgslcodes", $slcodes, PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctgsldescs", $sldescriptions, PDO::PARAM_STR);
        $acctgaccountstmt->bindValue(":acctguser_tracker", $user_id, PDO::PARAM_STR);
        $acctgaccountstmt->execute();
    }

    try {
        $this->conn->beginTransaction();

        // Generate unique ID for busunit and filename prefix
        $shortUuid = 'BU-' . substr(bin2hex(random_bytes(6)), 0, 12);

        // Insert into lkp_busunits
        $sql = "INSERT INTO lkp_busunits () VALUES (
                    default, :shortUuid, :class, :busunitname, :address,
                    :brandcode, :corpcode, :areacode, :startdate, :pricing_category, :purchase_price_category,
                    :arslcode, :apslcode, :ownership_status, :price_selection,
                    'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";
        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(':shortUuid', $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(':class', $data['classification'], PDO::PARAM_STR);
        $stmt->bindValue(':busunitname', $data['businessunitname'], PDO::PARAM_STR);
        $stmt->bindValue(':address', $data['address'], PDO::PARAM_STR);
        $stmt->bindValue(':brandcode', $data['brand'], PDO::PARAM_STR);
        $stmt->bindValue(':corpcode', $data['corporation'], PDO::PARAM_STR);
        $stmt->bindValue(':areacode', $data['area'], PDO::PARAM_STR);

        $stmt->bindValue(':pricing_category', $data['pricingcategory'], PDO::PARAM_STR);
        $stmt->bindValue(':purchase_price_category', $data['purchasepricingcategory'], PDO::PARAM_STR);

        $stmt->bindValue(':ownership_status', $data['ownershiptype'], PDO::PARAM_STR);
        $stmt->bindValue(':price_selection', $data['priceselection'], PDO::PARAM_STR);

        $stmt->bindValue(':startdate', $data['starteddate'], PDO::PARAM_STR);

        $stmt->bindValue(':arslcode', $slcode, PDO::PARAM_STR);
        $stmt->bindValue(':apslcode', $slcodes, PDO::PARAM_STR);

        $stmt->bindValue(':user_tracker', $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // Map Chart Type per Busunit
        $charttypedatas_map = json_decode($data['charttypedata'] ?? '[]', true) ?: [];
        if (!empty($charttypedatas_map)) {
            $checkMapSql = "SELECT COUNT(*)
                            FROM tbl_chart_of_accounts_map
                            WHERE chart_id = :chart_id
                              AND busunituuid = :busunituuid
                              AND deletestatus = 'Active'";
            $checkMapStmt = $this->conn->prepare($checkMapSql);

            $insertMapSql = "INSERT INTO tbl_chart_of_accounts_map ()
                             VALUES (
                                default,
                                CONCAT('CH-', ShortUUID()),
                                :chart_id,
                                :busunituuid,
                                'Active',
                                :usertracker,
                                DATE_ADD(NOW(), INTERVAL 8 HOUR)
                             )";
            $insertMapStmt = $this->conn->prepare($insertMapSql);

            foreach ($charttypedatas_map as $chartTypeCode) {
                if (empty($chartTypeCode)) continue;

                $checkMapStmt->bindValue(":chart_id", $chartTypeCode, PDO::PARAM_STR);
                $checkMapStmt->bindValue(":busunituuid", $shortUuid, PDO::PARAM_STR);
                $checkMapStmt->execute();

                $exists = (int) $checkMapStmt->fetchColumn();
                if ($exists > 0) continue;

                $insertMapStmt->bindValue(":chart_id", $chartTypeCode, PDO::PARAM_STR);
                $insertMapStmt->bindValue(":busunituuid", $shortUuid, PDO::PARAM_STR);
                $insertMapStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $insertMapStmt->execute();
            }
        }

        // Handle image upload
        $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/images/busunitslogo/';
        $imageFilename = null;

        if (!empty($_FILES['logoimage']) && $_FILES['logoimage']['error'] === UPLOAD_ERR_OK) {
            $imageFilename = $shortUuid . '.png';
            $targetFile = $uploadDir . $imageFilename;

            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $tmpPath = $_FILES['logoimage']['tmp_name'];
            $info = getimagesize($tmpPath);
            $mime = $info['mime'];

            switch ($mime) {
                case 'image/jpeg':
                    $img = imagecreatefromjpeg($tmpPath);
                    break;

                case 'image/png':
                    $img = imagecreatefrompng($tmpPath);
                    imagealphablending($img, false);
                    imagesavealpha($img, true);
                    break;

                case 'image/gif':
                    $img = imagecreatefromgif($tmpPath);
                    break;

                case 'image/webp':
                    $img = imagecreatefromwebp($tmpPath);
                    imagealphablending($img, false);
                    imagesavealpha($img, true);
                    break;

                default:
                    echo json_encode(['message' => 'UnsupportedImageType']);
                    $this->conn->rollBack();
                    return;
            }

            if (!imagepng($img, $targetFile)) {
                echo json_encode(['message' => 'ImageConversionError']);
                imagedestroy($img);
                $this->conn->rollBack();
                return;
            }

            imagedestroy($img);
        }

        $this->conn->commit();
        echo json_encode(['message' => 'Created']);

    } catch (PDOException $e) {
        $this->conn->rollBack();

        if (isset($imageFilename) && file_exists($uploadDir . $imageFilename)) {
            unlink($uploadDir . $imageFilename);
        }

        error_log('DB error: ' . $e->getMessage());
        echo json_encode(['message' => 'Error', 'details' => $e->getMessage()]);
    }
}







    public function rejectbusunits($user_id, string $id)



    {







        $sql = "UPDATE lkp_busunits







                SET







                    deletestatus = 'Inactive',







                    usertracker  = :usertracker







                WHERE







                    busunitcode  = :id";







        $stmt = $this->conn->prepare($sql);







        $stmt->bindValue(":id", $id, PDO::PARAM_STR);







        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);







        $stmt->execute();







        // return $stmt->rowCount();







        echo json_encode(["message" => "Deleted"]);







    }







    public function editbusunit($user_id, $id)



    {







        // $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_busunits WHERE name = :businessunitname &&







        //             class  = :class &&







        //             address  = :address &&







        //             brandcode  = :brandcode &&







        //             corpcode  = :corpcode &&







        //             areacode  = :areacode &&







        //             pricing_category  = :pricingcategory &&







        //             opstarteddate  = :opstarteddate &&







        //             deletestatus = 'Active'";







        // $checkforduplistmt = $this->conn->prepare($checkforduplisql);







        // $checkforduplistmt->bindValue(":businessunitname", $id["businessunitname"], PDO::PARAM_STR);







        // $checkforduplistmt->bindValue(":class", $id["classification"], PDO::PARAM_STR);







        // $checkforduplistmt->bindValue(":address", $id["address"], PDO::PARAM_STR);







        // $checkforduplistmt->bindValue(":brandcode", $id["brand"], PDO::PARAM_STR);







        // $checkforduplistmt->bindValue(":corpcode", $id["corporation"], PDO::PARAM_STR);







        // $checkforduplistmt->bindValue(":areacode", $id["area"], PDO::PARAM_STR);







        // $checkforduplistmt->bindValue(":pricingcategory", $id["pricingcategory"], PDO::PARAM_STR);







        // $checkforduplistmt->bindValue(":opstarteddate", $id["starteddate"], PDO::PARAM_STR);







        // $checkforduplistmt->execute();







        // $rowCount = $checkforduplistmt->fetchColumn();







        // if ($rowCount > 0) {







        $sql = "UPDATE lkp_busunits







                SET







                    class  = :class,







                    name   = :name ,







                    address  = :address,







                    brandcode  = :brandcode,







                    corpcode  = :corpcode,







                    areacode  = :areacode,







                    pricing_category  = :pricingcategory,



                    

                    purchase_price_category  = :purchasepricingcategory,



                

                    ownership_status  = :ownershiptype,


                    pricing_selection  = :price_selection,


                    opstarteddate  = :opstarteddate,







                    usertracker  = :usertracker







                WHERE







                      busunitcode  = :id";







        $stmt = $this->conn->prepare($sql);







        $stmt->bindValue(":class", $id["classification"], PDO::PARAM_STR);







        $stmt->bindValue(":name", $id["businessunitname"], PDO::PARAM_STR);







        $stmt->bindValue(":address", $id["address"], PDO::PARAM_STR);







        $stmt->bindValue(":brandcode", $id["brand"], PDO::PARAM_STR);







        $stmt->bindValue(":corpcode", $id["corporation"], PDO::PARAM_STR);







        $stmt->bindValue(":areacode", $id["area"], PDO::PARAM_STR);







        $stmt->bindValue(":pricingcategory", $id["pricingcategory"], PDO::PARAM_STR);





        

        $stmt->bindValue(":purchasepricingcategory", $id["purchasepricingcategory"], PDO::PARAM_STR);





        

        $stmt->bindValue(":ownershiptype", $id["ownershiptype"], PDO::PARAM_STR);



        $stmt->bindValue(":price_selection", $id["priceselection"], PDO::PARAM_STR);



        $stmt->bindValue(":opstarteddate", $id["starteddate"], PDO::PARAM_STR);







        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);







        $stmt->bindValue(":id", $id["busunitcode"], PDO::PARAM_STR);







        $stmt->execute();







        try {







            $this->conn->beginTransaction();







            // Handle image upload







            $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/images/busunitslogo/';







            // Delete previous image if it exists







            $oldFile = $uploadDir . $id['busunitcode'] . '.png';







            if (file_exists($oldFile)) {







                unlink($oldFile);







            }







            $imageFilename = null;







            if (! empty($_FILES['logoimage']) && $_FILES['logoimage']['error'] === UPLOAD_ERR_OK) {







                $imageFilename = $id['busunitcode'] . '.png';







                $targetFile = $uploadDir . $imageFilename;







                if (! file_exists($uploadDir)) {







                    mkdir($uploadDir, 0777, true);







                }







                $tmpPath = $_FILES['logoimage']['tmp_name'];







                $info = getimagesize($tmpPath);







                $mime = $info['mime'];







                switch ($mime) {



                    case 'image/jpeg':



                        $img = imagecreatefromjpeg($tmpPath);



                        break;



                    case 'image/png':



                        $img = imagecreatefrompng($tmpPath);



                        // preserve transparency:



                        imagealphablending($img, false);



                        imagesavealpha($img, true);



                        break;



                    case 'image/gif':



                        $img = imagecreatefromgif($tmpPath);



                        // GIF has palette-based transparency; if you need to preserve it,



                        // you might have to allocate the transparent index color again.



                        break;



                    case 'image/webp':



                        $img = imagecreatefromwebp($tmpPath);



                        imagealphablending($img, false);



                        imagesavealpha($img, true);



                        break;



                    default:



                        echo json_encode(['message' => 'UnsupportedImageType']);



                        $this->conn->rollBack();



                        return;



                }







                if (! imagepng($img, $targetFile)) {







                    echo json_encode(['message' => 'ImageConversionError']);







                    imagedestroy($img);







                    $this->conn->rollBack();







                    return;







                }







                imagedestroy($img);







            }







            $this->conn->commit();







            // echo json_encode(['message' => 'Success']);







        } catch (PDOException $e) {







            $this->conn->rollBack();







            // Clean up uploaded file on error







            if (isset($imageFilename) && file_exists($uploadDir . $imageFilename)) {







                unlink($uploadDir . $imageFilename);







            }







            error_log('DB error: ' . $e->getMessage());







            echo json_encode(['message' => 'Error', 'details' => $e->getMessage()]);







        }







        // return $stmt->rowCount();







        echo json_encode(["message" => "Edited"]);







    }







    public function getInfiniteData($page, $pageIndex, $pageData, $search)



    {







        $sql = "SELECT * FROM lkp_busunits Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";







        $stmt = $this->conn->prepare($sql);







        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);







        $stmt->execute();







        $data = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $data[] = $row;







        }







        $response = [







            'items'    => $data,







            'nextPage' => $page + 1, // Provide the next page number







        ];







        return $response;







    }







    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)



    {







        $sql = "SELECT lkp_busunits.busunitcode, lkp_busunits.class, lkp_busunits.name, lkp_busunits.address,







        lkp_busunits.brandcode, lkp_brands.brand_name, lkp_busunits.corpcode, lkp_corporation.corp_name,







        lkp_busunits.areacode, lkp_area.area_name, lkp_busunits.opstarteddate,







        lkp_busunits.pricing_category, lkp_pricing_code.pricing_code,  



        

        lkp_busunits.purchase_price_category,

        

        

        purchase_pricing_code.pricing_code AS purchase_pricing_code,

  

        

        lkp_busunits.ownership_status,

        lkp_busunits.pricing_selection



        FROM lkp_busunits







        LEFT OUTER JOIN lkp_pricing_code ON lkp_busunits.pricing_category = lkp_pricing_code.uuid





        -- purchase‐price lookup (aliased)

        LEFT OUTER JOIN lkp_pricing_code AS purchase_pricing_code

        ON lkp_busunits.purchase_price_category = purchase_pricing_code.uuid





        LEFT OUTER JOIN lkp_brands ON lkp_busunits.brandcode = lkp_brands.brand_code







        LEFT OUTER JOIN lkp_corporation ON lkp_busunits.corpcode = lkp_corporation.corp_code







        LEFT OUTER JOIN lkp_area ON lkp_busunits.areacode = lkp_area.area_code







        WHERE lkp_busunits.deletestatus = 'Active' AND name LIKE :search







        ORDER BY lkp_busunits.name ASC







        LIMIT $pageIndex, $pageData";







        //$sql = "SELECT * FROM lkp_busunits Where deletestatus = 'Active' AND name LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";







        $stmt = $this->conn->prepare($sql);







        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);







        $stmt->execute();







        $data = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $data[] = $row;







        }







        $response = [







            'items'    => $data,







            'nextPage' => $page + 1, // Provide the next page number







        ];







        return $response;







    }







    public function getClearingData()



    {







        $sql = "SELECT * FROM lkp_busunits Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";







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







        if (! empty($data["name"])) {







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



