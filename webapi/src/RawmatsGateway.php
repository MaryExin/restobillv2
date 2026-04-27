<?php

class RawmatsGateway
{


    private $conn;

    // ✅ change if your folder differs
    private string $imageDir;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();

        // Example: /var/www/html/images/pos/
        // Adjust to your real server structure.
        $this->imageDir = rtrim($_ENV["IMAGE_POS_DIR"] ?? (__DIR__ . "/../images/pos"), "/");
    }

    /* =========================
     * EXISTING READS (kept)
     * ========================= */

    public function getAllData()
    {
        $sql = "SELECT lkp_raw_mats.mat_code, lkp_raw_mats.desc, lkp_raw_mats.mat_qty, lkp_raw_mats.uomval,
            lkp_raw_mats.uom, tbl_pricing_details.pricing_code AS pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom,
            lkp_raw_mats.level, lkp_raw_mats.expiry_days, lkp_raw_mats.rawmats_parent, tbl_pricing_details.srp,
            tbl_pricing_details.deletestatus AS pricing_deletestatus
            FROM lkp_raw_mats
            LEFT OUTER JOIN tbl_pricing_details ON lkp_raw_mats.mat_code =  tbl_pricing_details.inv_code
            LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            WHERE lkp_raw_mats.deletestatus = 'Active'
            AND tbl_pricing_details.deletestatus = 'Active'
            ORDER BY lkp_raw_mats.desc ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $data[] = $row;

        return $data;
    }

     public function getDistictRawMats()
    {

        $sql = "SELECT * FROM lkp_raw_mats
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

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {
        $sql = "SELECT
            rm.seq,
            rm.mat_code,
            rm.`desc`,
            rm.mat_qty,
            rm.uomval,
            rm.uom,
            pd.pricing_code AS pricing_category,
            pc.pricing_code,
            pd.cost_per_uom,
            rm.level,
            rm.expiry_days,
            rm.rawmats_parent,
            rm.category,
            pd.srp,
            rm.brandcode,
            pb.brand_desc,
            rm.productcode,
            rm.deletestatus,
            pd.deletestatus AS pricing_deletestatus
        FROM lkp_raw_mats rm
        LEFT JOIN tbl_pricing_details pd
            ON rm.mat_code = pd.inv_code
           AND pd.deletestatus = 'Active'
        LEFT JOIN lkp_pricing_code pc
            ON pd.pricing_code = pc.uuid
        LEFT JOIN lkp_product_brand pb
            ON rm.brandcode = pb.brandcode
        WHERE rm.deletestatus = 'Active'
          AND (
                rm.`desc` LIKE :search
                OR rm.productcode LIKE :codesearch
              )
        ORDER BY rm.category ASC, rm.`desc` ASC
        LIMIT $pageIndex, $pageData";


        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
        $stmt->bindValue(":codesearch", '%' . $search . '%', PDO::PARAM_STR);
        $stmt->execute();

        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $data[] = $row;

        return [
            'items' => $data,
            'nextPage' => $page + 1,
        ];
    }

    /* =========================
     * SINGLE CREATE (refactored to accept image)
     * ========================= */

    public function createForUser($user_id, $data, $files = [])
    {
        // ✅ Normalize inputs (prevents case/space duplicates)
        $productcodeN = strtoupper(trim((string)($data["productcode"] ?? "")));
        $descN = strtoupper(trim((string)($data["rawmatsdesc"] ?? "")));

        if ($productcodeN === "" || $descN === "") {
            http_response_code(400);
            echo json_encode(["message" => "missingRequiredFields"]);
            return;
        }

        // Check duplicate productcode (Active) - normalized
        $checkSQL = "SELECT COUNT(*)
                    FROM lkp_raw_mats
                    WHERE UPPER(TRIM(productcode)) = :productcode
                      AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($checkSQL);
        $stmt->bindValue(":productcode", $productcodeN, PDO::PARAM_STR);
        $stmt->execute();

        if ((int)$stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "Duplicate Entry", "field" => "productcode"]);
            return;
        }

        // ✅ Generate RM-xxxx (kept)
        $randomString = substr(bin2hex(random_bytes(6)), 0, 12);
        $shortUuid = "RM-" . $randomString;

        // Check duplicate desc (Active) - normalized
        $checkforduplisql = "SELECT COUNT(*) as count
                            FROM lkp_raw_mats
                            WHERE UPPER(TRIM(`desc`)) = :rawmatsdescs
                              AND deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":rawmatsdescs", $descN, PDO::PARAM_STR);
        $checkforduplistmt->execute();

        if ((int)$checkforduplistmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "Duplicate Entry", "field" => "desc"]);
            return;
        }

        // ✅ Insert raw mat (kept structure)
        $sql = "INSERT INTO lkp_raw_mats ()
                VALUES (default, :shortUuid, :rawmatsdescs, :mat_qty, :uomval, :uom, :cost_per_uom,
                :level, :expiry, :parent, :category, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR),
                :brandcode, :productcode)";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":rawmatsdescs", $descN, PDO::PARAM_STR);
        $stmt->bindValue(":mat_qty", $data["mat_qty"], PDO::PARAM_STR);
        $stmt->bindValue(":uomval", $data["uomval"], PDO::PARAM_STR);
        $stmt->bindValue(":uom", strtoupper(trim((string)$data["uom"])), PDO::PARAM_STR);
        $stmt->bindValue(":cost_per_uom", $data["cost_per_uom"] ?? 0, PDO::PARAM_STR);
        $stmt->bindValue(":level", strtoupper(trim((string)$data["level"])), PDO::PARAM_STR);
        $stmt->bindValue(":expiry", $data["expiry"] ?? 0, PDO::PARAM_STR);
        $stmt->bindValue(":parent", "", PDO::PARAM_STR);
        $stmt->bindValue(":category", strtoupper(trim((string)$data["productcategory"])), PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":brandcode", $data["brandcode"], PDO::PARAM_STR);
        $stmt->bindValue(":productcode", $productcodeN, PDO::PARAM_STR);
        $stmt->execute();

        // ✅ Mirror into inventory transactions (kept)
        $sql = "SELECT busunitcode FROM lkp_busunits WHERE class = 'COMMI' AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $datas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $sql = "INSERT INTO tbl_inventory_transactions ()
                VALUES (default, DATE_ADD(NOW(), INTERVAL 8 HOUR), :shortUuid, '0', :cost_per_uom, :uomval,
                :uom, 'Manual', :busunitcode, 'FG', 0,'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        foreach ($datas as $busunits) {
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);
            $stmt->bindValue(":cost_per_uom", $data["cost_per_uom"] ?? 0, PDO::PARAM_STR);
            $stmt->bindValue(":uomval", $data["uomval"], PDO::PARAM_STR);
            $stmt->bindValue(":uom", strtoupper(trim((string)$data["uom"])), PDO::PARAM_STR);
            $stmt->bindValue(":busunitcode", $busunits['busunitcode'], PDO::PARAM_STR);
            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();
        }

        // ✅ Image save (Build-template style)
        // Single-create uses $_FILES['posimage'] (match your frontend)
        $this->saveSingleImageIfPresent($shortUuid, $files);

        echo json_encode(["message" => "Success", "mat_code" => $shortUuid]);
    }

    /* =========================
     * DELETE (kept)
     * ========================= */

    public function rejectrawmatss($user_id, string $id)
    {
        $sql = "UPDATE lkp_raw_mats
                SET deletestatus = 'Inactive',
                    usertracker  = :usertracker
                WHERE mat_code = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $id, PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        echo json_encode(["message" => "Deleted"]);
    }

    /* =========================
     * EDIT (refactored to accept image)
     * ========================= */

    public function editrawmats($user_id, $id, $files = [])
    {
        // ✅ Enforce mat_code exists (prevents false duplicates when frontend forgets it)
        $mat_code = trim((string)($id["mat_code"] ?? ""));
        if ($mat_code === "") {
            http_response_code(400);
            echo json_encode(["message" => "missingMatCode"]);
            return;
        }

        // ✅ Normalize inputs (prevents case/space duplicates)
        $productcodeN = strtoupper(trim((string)($id["productcode"] ?? "")));
        $descN = strtoupper(trim((string)($id["rawmatsdesc"] ?? "")));

        if ($productcodeN === "" || $descN === "") {
            http_response_code(400);
            echo json_encode(["message" => "missingRequiredFields"]);
            return;
        }

        // Duplicate productcode (excluding current mat_code) - normalized
        $checkSQL = "SELECT COUNT(*)
                    FROM lkp_raw_mats
                    WHERE UPPER(TRIM(productcode)) = :productcode
                      AND mat_code <> :mat_code
                      AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($checkSQL);
        $stmt->bindValue(":productcode", $productcodeN, PDO::PARAM_STR);
        $stmt->bindValue(":mat_code", $mat_code, PDO::PARAM_STR);
        $stmt->execute();

        if ((int)$stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "Duplicate Entry", "field" => "productcode"]);
            return;
        }

        // Duplicate desc (excluding current mat_code) - normalized
        $checkforduplisql = "SELECT COUNT(*)
                            FROM lkp_raw_mats
                            WHERE UPPER(TRIM(`desc`)) = :rawmatsdescs
                              AND mat_code <> :mat_code
                              AND deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":rawmatsdescs", $descN, PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":mat_code", $mat_code, PDO::PARAM_STR);
        $checkforduplistmt->execute();

        if ((int)$checkforduplistmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(["message" => "Duplicate Entry", "field" => "desc"]);
            return;
        }

        $sql = "UPDATE lkp_raw_mats
                SET
                    `desc` = :desc,
                    mat_qty = :mat_qty,
                    uomval = :uomval,
                    uom = :uom,
                    cost_per_uom = 0,
                    level = :level,
                    expiry_days = :expiry,
                    rawmats_parent = :parent,
                    category = :category,
                    usertracker = :usertracker,
                    productcode = :productcode,
                    brandcode = :brandcode
                WHERE mat_code = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":desc", $descN, PDO::PARAM_STR);
        $stmt->bindValue(":mat_qty", $id["mat_qty"], PDO::PARAM_STR);
        $stmt->bindValue(":uomval", $id["uomval"], PDO::PARAM_STR);
        $stmt->bindValue(":uom", strtoupper(trim((string)$id["uom"])), PDO::PARAM_STR);
        $stmt->bindValue(":level", strtoupper(trim((string)$id["level"])), PDO::PARAM_STR);
        $stmt->bindValue(":expiry", $id["expiry"] ?? 0, PDO::PARAM_STR);
        $stmt->bindValue(":parent", "", PDO::PARAM_STR);
        $stmt->bindValue(":category", strtoupper(trim((string)$id["productcategory"])), PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $mat_code, PDO::PARAM_STR);
        $stmt->bindValue(":productcode", $productcodeN, PDO::PARAM_STR);
        $stmt->bindValue(":brandcode", $id["brandcode"], PDO::PARAM_STR);
        $stmt->execute();

        // ✅ optional image update:
        // if posimage exists, overwrite mat_code.png
        $this->saveSingleImageIfPresent($mat_code, $files);

        echo json_encode(["message" => "Edited"]);
    }

    /* =========================
     * BATCH MULTIADD (Build-template style)
     * ========================= */

    public function createForMultiProduce($user_id, array $multiproduct, array $imageMap, array $files = [])
    {
        $results = [
            "created" => 0,
            "skipped" => 0,
            "errors" => [],
        ];

        // Build map: index => form field name (posimage_{idx})
        $indexToField = [];
        foreach ($imageMap as $row) {
            if (!is_array($row)) continue;
            $idx = $row["index"] ?? null;
            $field = $row["field"] ?? null;
            if ($idx === null || $field === null) continue;
            $indexToField[(string)$idx] = (string)$field;
        }

        foreach ($multiproduct as $idx => $row) {
            if (!is_array($row)) {
                $results["skipped"]++;
                continue;
            }

            // Normalize/keep field names used in frontend/template
            $rawmatsdesc = (string)($row["description"] ?? $row["rawmatsdesc"] ?? "");
            $mat_qty = (string)($row["qty"] ?? $row["mat_qty"] ?? "0");
            $uomval = (string)($row["valUom"] ?? $row["uomval"] ?? "0");
            $uom = (string)($row["uom"] ?? "");
            $level = (string)($row["productLevelCode"] ?? $row["level"] ?? "");
            $taxTypeCode = (string)($row["taxTypeCode"] ?? ""); // if needed later
            $expiry = (string)($row["expiryDay"] ?? $row["expiry"] ?? "0");
            $category = (string)($row["productCategoryDesc"] ?? $row["productcategory"] ?? "");
            $brandDesc = (string)($row["brandDesc"] ?? "");
            $brandcode = (string)($row["brandCode"] ?? $row["brandcode"] ?? "");
            $productcode = (string)($row["productcode"] ?? $row["productCode"] ?? "");

            // Minimal required checks (align to your frontend validation)
            if (trim($rawmatsdesc) === "" || trim($uom) === "" || trim($level) === "" || trim($category) === "" || trim($brandcode) === "" || trim($productcode) === "") {
                $results["skipped"]++;
                $results["errors"][] = ["index" => $idx, "message" => "missingRequiredFields"];
                continue;
            }

            // ✅ Normalize for duplicate checks/insert
            $productcodeN = strtoupper(trim($productcode));
            $descN = strtoupper(trim($rawmatsdesc));

            // Duplicate checks (desc + productcode)
            if ($this->existsActiveByProductCode($productcodeN)) {
                $results["skipped"]++;
                $results["errors"][] = ["index" => $idx, "message" => "Duplicate Entry", "field" => "productcode"];
                continue;
            }
            if ($this->existsActiveByDesc($descN)) {
                $results["skipped"]++;
                $results["errors"][] = ["index" => $idx, "message" => "Duplicate Entry", "field" => "desc"];
                continue;
            }

            // Generate mat_code like single create
            $randomString = substr(bin2hex(random_bytes(6)), 0, 12);
            $shortUuid = "RM-" . $randomString;

            // Insert
            $sql = "INSERT INTO lkp_raw_mats ()
                    VALUES (default, :shortUuid, :rawmatsdescs, :mat_qty, :uomval, :uom, :cost_per_uom,
                    :level, :expiry, :parent, :category, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    :brandcode, :productcode)";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);
            $stmt->bindValue(":rawmatsdescs", $descN, PDO::PARAM_STR);
            $stmt->bindValue(":mat_qty", $mat_qty, PDO::PARAM_STR);
            $stmt->bindValue(":uomval", $uomval, PDO::PARAM_STR);
            $stmt->bindValue(":uom", strtoupper(trim($uom)), PDO::PARAM_STR);
            $stmt->bindValue(":cost_per_uom", 0, PDO::PARAM_STR);
            $stmt->bindValue(":level", strtoupper(trim($level)), PDO::PARAM_STR);
            $stmt->bindValue(":expiry", $expiry, PDO::PARAM_STR);
            $stmt->bindValue(":parent", "", PDO::PARAM_STR);
            $stmt->bindValue(":category", strtoupper(trim($category)), PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":brandcode", $brandcode, PDO::PARAM_STR);
            $stmt->bindValue(":productcode", $productcodeN, PDO::PARAM_STR);
            $stmt->execute();

            // Save image if exists for this row index
            $field = $indexToField[(string)$idx] ?? ("posimage_" . $idx);
            $this->saveBatchImageIfPresent($shortUuid, $field, $files);

            $results["created"]++;
        }

        echo json_encode(["message" => "Success", "result" => $results]);
    }

    /* =========================
     * IMAGE HELPERS
     * ========================= */

    private function saveSingleImageIfPresent(string $mat_code, array $files): void
    {
        // In single create/edit, frontend should send posimage
        if (!isset($files["posimage"]) || !is_array($files["posimage"])) return;

        $file = $files["posimage"];
        $this->storePng($file, $mat_code);
    }

    private function saveBatchImageIfPresent(string $mat_code, string $fieldName, array $files): void
    {
        if (!isset($files[$fieldName]) || !is_array($files[$fieldName])) return;

        $file = $files[$fieldName];
        $this->storePng($file, $mat_code);
    }

    private function storePng(array $file, string $mat_code): void
    {
        // Basic upload checks
        $tmp = $file["tmp_name"] ?? "";
        $err = $file["error"] ?? UPLOAD_ERR_NO_FILE;

        if ($err !== UPLOAD_ERR_OK || !is_string($tmp) || $tmp === "" || !is_uploaded_file($tmp)) {
            return; // silently ignore (Build-template behavior)
        }

        // Ensure directory exists
        if (!is_dir($this->imageDir)) {
            @mkdir($this->imageDir, 0775, true);
        }

        // ✅ Filename is mat_code.png (RM-xxxx.png)
        $target = $this->imageDir . "/" . $mat_code . ".png";

        // For now we simply move and keep extension .png.
        @move_uploaded_file($tmp, $target);
    }

    /* =========================
     * DUPLICATE HELPERS
     * ========================= */

    private function existsActiveByProductCode(string $productcode): bool
    {
        $sql = "SELECT COUNT(*)
                FROM lkp_raw_mats
                WHERE UPPER(TRIM(productcode)) = :productcode
                  AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":productcode", strtoupper(trim($productcode)), PDO::PARAM_STR);
        $stmt->execute();
        return (int)$stmt->fetchColumn() > 0;
    }

    private function existsActiveByDesc(string $desc): bool
    {
        $sql = "SELECT COUNT(*)
                FROM lkp_raw_mats
                WHERE UPPER(TRIM(`desc`)) = :d
                  AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":d", strtoupper(trim($desc)), PDO::PARAM_STR);
        $stmt->execute();
        return (int)$stmt->fetchColumn() > 0;
    }
}
