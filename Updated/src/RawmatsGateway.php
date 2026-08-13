<?php

class RawmatsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT lkp_raw_mats.mat_code, lkp_raw_mats.desc, lkp_raw_mats.mat_qty, lkp_raw_mats.uomval,
            lkp_raw_mats.uom, tbl_pricing_details.pricing_code AS pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom,
            lkp_raw_mats.level, lkp_raw_mats.expiry_days, lkp_raw_mats.rawmats_parent, tbl_pricing_details.srp
            FROM lkp_raw_mats
            LEFT OUTER JOIN tbl_pricing_details ON lkp_raw_mats.mat_code =  tbl_pricing_details.inv_code
            LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            WHERE lkp_raw_mats.deletestatus = 'Active'
            ORDER BY lkp_raw_mats.desc ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getRawmatsData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT lkp_raw_mats.mat_code, lkp_raw_mats.desc, lkp_raw_mats.mat_qty, lkp_raw_mats.uomval,
        lkp_raw_mats.uom, tbl_pricing_details.pricing_code AS pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom,
        lkp_raw_mats.level, lkp_raw_mats.expiry_days, lkp_raw_mats.rawmats_parent
        FROM lkp_raw_mats
        LEFT OUTER JOIN tbl_pricing_details ON lkp_raw_mats.mat_code =  tbl_pricing_details.inv_code
        LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
        WHERE lkp_raw_mats.desc LIKE :search
        AND lkp_raw_mats.deletestatus = 'Active'
        GROUP BY lkp_raw_mats.mat_code
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

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_raw_mats Where deletestatus = 'Active' ORDER BY `desc`
        ASC LIMIT $pageIndex, $pageData";

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
        // Generate unique short UUID
        $randomString = substr(bin2hex(random_bytes(6)), 0, 12);
        $shortUuid = "RM-" . $randomString;
    
        // Check for duplicate entries
        $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_raw_mats WHERE `desc` = :rawmatsdescs && deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":rawmatsdescs", $data["rawmatsdesc"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = $checkforduplistmt->fetchColumn();
    
        if ($rowCount > 0) {
            echo json_encode(["message" => "Duplicate Entry"]);
        } else {
            // Insert into lkp_raw_mats table
            $sql = "INSERT INTO lkp_raw_mats ()
                    VALUES (default, :shortUuid, :rawmatsdescs, :mat_qty, :uomval, :uom, :cost_per_uom,
                    :level, :expiry, :parent, :category, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);
            $stmt->bindValue(":rawmatsdescs", $data["rawmatsdesc"], PDO::PARAM_STR);
            $stmt->bindValue(":mat_qty", $data["mat_qty"], PDO::PARAM_STR);
            $stmt->bindValue(":uomval", $data["uomval"], PDO::PARAM_STR);
            $stmt->bindValue(":uom", $data["uom"], PDO::PARAM_STR);
            $stmt->bindValue(":cost_per_uom", $data["cost_per_uom"], PDO::PARAM_STR);
            $stmt->bindValue(":level", $data["level"], PDO::PARAM_STR);
            $stmt->bindValue(":expiry", $data["expiry"], PDO::PARAM_STR);
            $stmt->bindValue(":parent", "", PDO::PARAM_STR);
            $stmt->bindValue(":category", $data["productcategory"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();
    
            // Fetch busunitcode from lkp_busunits
            $sql = "SELECT busunitcode FROM lkp_busunits WHERE class = 'COMMI' AND deletestatus = 'Active'";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $datas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
            // Insert into tbl_inventory_transactions for each busunitcode
            $sql = "INSERT INTO tbl_inventory_transactions ()
                    VALUES (default, DATE_ADD(NOW(), INTERVAL 8 HOUR), :shortUuid, '0', :cost_per_uom, :uomval,
                    :uom, 'Manual', :busunitcode, 'FG', 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    
            foreach ($datas as $busunits) {
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":cost_per_uom", $data["cost_per_uom"], PDO::PARAM_STR);
                $stmt->bindValue(":uomval", $data["uomval"], PDO::PARAM_STR);
                $stmt->bindValue(":uom", $data["uom"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $busunits['busunitcode'], PDO::PARAM_STR);
                $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }
    
            echo json_encode(["message" => "Success"]);
        }
    }

    public function rejectrawmatss($user_id, string $id)
    {
        $sql = "UPDATE lkp_raw_mats
                SET
                    deletestatus = 'Inactive',
                    usertracker  = :usertracker
                WHERE

                      mat_code  = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $id, PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);
    }

    public function editrawmats($user_id, $id)
    {
    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_raw_mats WHERE `desc` = :rawmatsdescs &&
    `mat_qty` = :mat_qtys &&
    `uomval` = :uomvals &&
    `uom` = :uoms &&
    `level` = :levels &&
    `expiry_days` = :expirys &&
    `category` = :categorys &&
    deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":rawmatsdescs", $id["rawmatsdesc"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":mat_qtys", $id["mat_qty"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":uomvals", $id["uomval"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":uoms", $id["uom"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":levels", $id["level"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":expirys", $id["expiry"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":categorys", $id["productcategory"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
        exit;
    } else {
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
                    usertracker = :usertracker
                WHERE
                      mat_code = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":desc", $id["rawmatsdesc"], PDO::PARAM_STR);
        $stmt->bindValue(":mat_qty", $id["mat_qty"], PDO::PARAM_STR);
        $stmt->bindValue(":uomval", $id["uomval"], PDO::PARAM_STR);
        $stmt->bindValue(":uom", $id["uom"], PDO::PARAM_STR);
        $stmt->bindValue(":level", $id["level"], PDO::PARAM_STR);
        $stmt->bindValue(":expiry", $id["expiry"], PDO::PARAM_STR);
        $stmt->bindValue(":parent", "", PDO::PARAM_STR);
        $stmt->bindValue(":category", $id["productcategory"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["mat_code"], PDO::PARAM_STR);
        $stmt->execute();

        // return $stmt->rowCount();
         echo json_encode(["message" => "Edited"]);

    }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_raw_mats Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT lkp_raw_mats.mat_code, lkp_raw_mats.desc, lkp_raw_mats.mat_qty, lkp_raw_mats.uomval,
            lkp_raw_mats.uom, tbl_pricing_details.pricing_code AS pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom,
            lkp_raw_mats.level, lkp_raw_mats.expiry_days, lkp_raw_mats.rawmats_parent, lkp_raw_mats.category, tbl_pricing_details.srp
            FROM lkp_raw_mats
            LEFT OUTER JOIN tbl_pricing_details ON lkp_raw_mats.mat_code =  tbl_pricing_details.inv_code
            LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            WHERE lkp_raw_mats.deletestatus = 'Active'
            AND lkp_raw_mats.desc LIKE :search
             ORDER BY lkp_raw_mats.category ASC, lkp_raw_mats.desc ASC
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

        $sql = "SELECT * FROM lkp_raw_mats Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
