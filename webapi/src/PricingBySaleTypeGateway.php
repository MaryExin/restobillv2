<?php

class PricingBySaleTypeGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM tbl_pricing_by_sales_type Where deletestatus = 'Active' ORDER BY seq";

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

        $sql = "SELECT * FROM tbl_pricing_by_sales_type Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
    $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_pricing_by_sales_type WHERE busunitcode = :businessunits AND sales_type_id = :saletypes AND pricing_category = :pricings AND deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":businessunits", $data["Businessunit"], PDO::PARAM_STR);
     $checkforduplistmt->bindValue(":saletypes", $data["Saletype"], PDO::PARAM_STR);
      $checkforduplistmt->bindValue(":pricings", $data["Pricing"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "INSERT INTO tbl_pricing_by_sales_type () VALUES (default, :businessunits, :saletypes, :pricings, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":businessunits", $data["Businessunit"], PDO::PARAM_STR);
        $stmt->bindValue(":saletypes", $data["Saletype"], PDO::PARAM_STR);
        $stmt->bindValue(":pricings", $data["Pricing"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        echo json_encode(["message" => "Success"]);
    }
}

    public function rejectpricingbysaletype($user_id, string $id)
    {

        $sql = "UPDATE tbl_pricing_by_sales_type

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      seq   = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();

        echo json_encode(["message" => "Deleted"]);

    }

    public function editpricingbysaletype($user_id, $id)
    {

        // $productcatcode = $id["productcatcode"];

        // $productcatid = join($productcatcode);

    $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_pricing_by_sales_type WHERE busunitcode = :businessunits AND sales_type_id = :saletypes AND pricing_category = :pricings";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":businessunits", $id["Businessunit"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":saletypes", $id["Saletype"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":pricings", $id["Pricing"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE tbl_pricing_by_sales_type
                SET
                    busunitcode  = :businessunits,
                    sales_type_id  = :saletypes,
                    pricing_category  = :pricings,
                    usertracker  = :usertracker
                WHERE
                      seq  = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":businessunits", $id["Businessunit"], PDO::PARAM_STR);
        $stmt->bindValue(":saletypes", $id["Saletype"], PDO::PARAM_STR);
        $stmt->bindValue(":pricings", $id["Pricing"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["Pricingbysaletypecode"], PDO::PARAM_STR);
        $stmt->execute();
        // return $stmt->rowCount();

        echo json_encode(["message" => "Edited"]);
        }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_pricing_by_sales_type Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        //$sql = "SELECT * FROM tbl_pricing_by_sales_type Where deletestatus = 'Active' AND busunitcode LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

        $sql = "SELECT t1.seq, t1.busunitcode, t1.sales_type_id, t1.pricing_category, t2.name AS business_unit, t3.description AS sales_type_description, t4.pricing_code
FROM tbl_pricing_by_sales_type AS t1
LEFT JOIN lkp_busunits AS t2 ON t1.busunitcode = t2.busunitcode
LEFT JOIN lkp_sales_type AS t3 ON t1.sales_type_id = t3.sales_type_id
LEFT JOIN lkp_pricing_code AS t4 ON t1.pricing_category = t4.uuid
WHERE t1.deletestatus = 'Active' AND t2.name LIKE :search
ORDER BY t1.seq
LIMIT $pageIndex, $pageData;
";

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

        $sql = "SELECT * FROM tbl_pricing_by_sales_type Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
