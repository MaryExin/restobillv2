<?php

class BrandsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM lkp_brands Where deletestatus = 'Active' ORDER BY seq";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_brands Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

    public function createForMultiProduce($user_id, $data)
    {

    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_build_of_products WHERE productcode = :invCodes AND desc = :descriptions AND deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":invCodes", $data["multiproduct"]["invCode"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":descriptions", $data["multiproduct"]["description"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "INSERT INTO lkp_build_of_products ()
                VALUES (default, CONCAT('BD-',ShortUUID()),:descriptions,:qtys,:valUoms,:uoms,'',''
                ,:productLevelCodes,:taxTypeCodes,:productCategoryCodes,:expiryDays
                , 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR)), :brandCodes, :invCodes";

        foreach ($data["multiproduct"] as $row) {
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":brandCodes", $data["multiproduct"]["brandCode"], PDO::PARAM_STR);
        $stmt->bindValue(":invCodes", $data["multiproduct"]["invCode"], PDO::PARAM_STR);
        $stmt->bindValue(":descriptions", $data["multiproduct"]["description"], PDO::PARAM_STR);
        $stmt->bindValue(":qtys", $data["multiproduct"]["qty"], PDO::PARAM_STR);
        $stmt->bindValue(":valUoms", $data["multiproduct"]["valUom"], PDO::PARAM_STR);
        $stmt->bindValue(":uoms", $data["multiproduct"]["uom"], PDO::PARAM_STR);
        $stmt->bindValue(":productLevelCodes", $data["multiproduct"]["productLevelCode"], PDO::PARAM_STR);
        $stmt->bindValue(":taxTypeCodes", $data["multiproduct"]["taxTypeCode"], PDO::PARAM_STR);
        $stmt->bindValue(":productCategoryCodes", $data["multiproduct"]["productCategoryCode"], PDO::PARAM_STR);
        $stmt->bindValue(":expiryDays", $data["multiproduct"]["expiryDay"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        }

        echo json_encode(["message" => "Success"]);
    }
    }

    public function createForUser($user_id, $data)
    {

         $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_brands WHERE brand_name = :brandnames && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":brandnames", $data["brandname"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "INSERT INTO lkp_brands ()

                VALUES (default, CONCAT('BN-',ShortUUID()),:brandname, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":brandname", $data["brandname"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
    }
    }

    public function rejectbranchs($user_id, string $id)
    {

        $sql = "UPDATE lkp_brands

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      brand_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
echo json_encode(["message" => "Deleted"]);
    }

    public function editbranch($user_id, $id)
    {

        // $branchcode = $id["brand_code"];

        // $branchid = join($branchcode);

         $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_brands WHERE brand_name = :brandnames && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":brandnames", $id["brandname"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "UPDATE lkp_brands

                SET

                    brand_name  = :brand_name,

                    usertracker  = :usertracker

                WHERE

                      brand_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":brand_name", $id["brandname"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $id["brand_code"], PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_brands Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_brands Where deletestatus = 'Active' AND brand_name  LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_brands Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
