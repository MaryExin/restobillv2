<?php

class PricingGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_pricing_code
        WHERE deletestatus = 'Active'
        ORDER BY pricing_code ASC";

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

        $sql = "SELECT tbl_pricing_details.seq, tbl_pricing_details.pricing_code,
            lkp_pricing_code.pricing_code as pricing_category, tbl_pricing_details.inv_code,
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as product_description,
            tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) as level
             FROM tbl_pricing_details
            LEFT OUTER JOIN lkp_pricing_code ON  tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            LEFT OUTER JOIN lkp_raw_mats ON  tbl_pricing_details.inv_code = lkp_raw_mats.mat_code
            LEFT OUTER JOIN lkp_build_of_products ON  tbl_pricing_details.inv_code = lkp_build_of_products.build_code
            WHERE tbl_pricing_details.deletestatus = 'Active'
            ORDER BY
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) ASC,
            lkp_pricing_code.pricing_code
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

    public function createForUser($user_id, $data)
    {
        $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_pricing_details WHERE `inv_code` = :products && `pricing_code` = :pricingcategorys && deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":products", $data["product"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":pricingcategorys", $data["pricingcategory"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = $checkforduplistmt->fetchColumn();
    
        if($rowCount > 0) {
            echo json_encode(["message" => "Duplicate Entry"]);
        } else {
            $sql = "INSERT INTO tbl_pricing_details () VALUES (default, :pricing_category, :inv_code,
            :cost_per_uom, :srp, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    
            $stmt = $this->conn->prepare($sql);
    
            $stmt->bindValue(":pricing_category", $data["pricingcategory"], PDO::PARAM_STR);
            $stmt->bindValue(":inv_code", $data["product"], PDO::PARAM_STR);
            $stmt->bindValue(":cost_per_uom", $data["cost"], PDO::PARAM_STR);
            $stmt->bindValue(":srp", $data["srp"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();
    
            echo json_encode(["message" => "Success"]);
            }
    }

    public function editpricing($user_id, $data)
    {
        $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_pricing_details WHERE `inv_code` = :products && `pricing_code` = :pricingcategorys && deletestatus = 'Active' && cost_per_uom = :cost";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":products", $data["product"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":pricingcategorys", $data["pricingCategory"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":cost", $data["cost"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = $checkforduplistmt->fetchColumn();
        
        if($rowCount > 0) {
            echo json_encode(["message" => "Duplicate Entry"]);
        } else {
            $sql = "UPDATE tbl_pricing_details SET inv_code = :product, pricing_code = :pricingCategory,
                cost_per_uom = :cost, srp = :srp, createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                usertracker = :user_tracker
                WHERE seq = :id";
    
            $stmt = $this->conn->prepare($sql);
        
            $stmt->bindValue(":pricingCategory", $data["pricingCategory"], PDO::PARAM_STR);
            $stmt->bindValue(":product", $data["product"], PDO::PARAM_STR);
            $stmt->bindValue(":cost", $data["cost"], PDO::PARAM_STR);
            $stmt->bindValue(":srp", $data["srp"], PDO::PARAM_STR);
            $stmt->bindValue(":id", $data["pricingId"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        
            $stmt->execute();
        
            echo json_encode(["message" => "Edited"]);
        }
    }

    public function rejectpricing($user_id, $data)
    {

        $sql = "UPDATE tbl_pricing_details SET deletestatus = 'Inactive',
            createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR), usertracker = :user_tracker
            WHERE seq = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $data["pricingId"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Deleted"]);

    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_pricing_details Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT tbl_pricing_details.seq, tbl_pricing_details.pricing_code,
            lkp_pricing_code.pricing_code as pricing_category, tbl_pricing_details.inv_code,
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as product_description,
            tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) as level
		         FROM tbl_pricing_details
            LEFT OUTER JOIN lkp_pricing_code ON  tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            LEFT OUTER JOIN lkp_raw_mats ON  tbl_pricing_details.inv_code = lkp_raw_mats.mat_code
            LEFT OUTER JOIN lkp_build_of_products ON  tbl_pricing_details.inv_code = lkp_build_of_products.build_code
            WHERE tbl_pricing_details.deletestatus = 'Active'
            AND IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) LIKE :search
            ORDER BY
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) ASC,
            lkp_pricing_code.pricing_code
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

        $sql = "SELECT tbl_pricing_details.seq, tbl_pricing_details.pricing_code,
            lkp_pricing_code.pricing_code as pricing_category, tbl_pricing_details.inv_code,
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as product_description,
            tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) as level
             FROM tbl_pricing_details
            LEFT OUTER JOIN lkp_pricing_code ON  tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            LEFT OUTER JOIN lkp_raw_mats ON  tbl_pricing_details.inv_code = lkp_raw_mats.mat_code
            LEFT OUTER JOIN lkp_build_of_products ON  tbl_pricing_details.inv_code = lkp_build_of_products.build_code
            WHERE tbl_pricing_details.deletestatus = 'Active' AND
            ORDER BY
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) ASC,
            lkp_pricing_code.pricing_code
            LIMIT $pageIndex, $pageData";
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
