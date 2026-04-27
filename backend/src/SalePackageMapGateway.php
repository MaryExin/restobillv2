<?php

class SalePackageMapGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM tbl_sales_package_map Where deletestatus = 'Active' ORDER BY seq";

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

        $sql = "SELECT * FROM tbl_sales_package_map Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
    $checkforduplisql = "Delete FROM tbl_sales_package_map WHERE packagename = :packagenames";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":packagenames", $data["Packagename"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    // if($rowCount > 0) {
    //     echo json_encode(["message" => "Duplicate Entry"]);
    // } else {
        $sql = "INSERT INTO tbl_sales_package_map () VALUES (default, CONCAT('PK-',ShortUUID()), :packagename, :product, :discountperc / 100, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":packagename", $data["Packagename"], PDO::PARAM_STR);
        $stmt->bindValue(":product", $data["Product"], PDO::PARAM_STR);
        $stmt->bindValue(":discountperc", $data["Discountperc"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        echo json_encode(["message" => "Success"]);
    // }
}

    public function rejectsalepackagemap($user_id, string $id)
    {

        $sql = "UPDATE tbl_sales_package_map

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      packageid  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();

        echo json_encode(["message" => "Deleted"]);

    }

    public function editsalepackagemap($user_id, $id)
    {

        // $productcatcode = $id["productcatcode"];

        // $productcatid = join($productcatcode);

$checkforduplisql = "SELECT COUNT(*) as count FROM tbl_sales_package_map WHERE packagename = :packagenames 
                    && buildcode = :products && discountpercentage = :discountpercs";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":packagenames", $id["Packagename"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":products", $id["Product"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":discountpercs", $id["Discountperc"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE tbl_sales_package_map
                SET
                    packagename  = :packagenames,
                    buildcode  = :buildcodes,
                    discountpercentage  = :discountpercentages/100,
                    usertracker  = :usertracker
                WHERE
                      packageid  = :packagecodes";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":packagenames", $id["Packagename"], PDO::PARAM_STR);
        $stmt->bindValue(":buildcodes", $id["Product"], PDO::PARAM_STR);
        $stmt->bindValue(":discountpercentages", $id["Discountperc"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":packagecodes", $id["Packagecode"], PDO::PARAM_STR);
        $stmt->execute();
        // return $stmt->rowCount();
         echo json_encode(["message" => "Edited"]);
        }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_sales_package_map Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT  t1.packageid, t1.buildcode, t1.packagename As package_code, lkp_package.package_name,t3.desc, t1.discountpercentage, t1.deletestatus, t1.createdtime FROM 
        (Select seq, packageid, packagename, buildcode, discountpercentage, deletestatus, createdtime from tbl_sales_package_map) as t1
        Left join (SELECT * FROM lkp_build_of_products) as t3 on t3.build_code = t1.buildcode 
		Left join lkp_package ON t1.packagename  = lkp_package.package_code
        Where t1.deletestatus = 'Active' AND t1.packagename LIKE :search ORDER BY t1.seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM tbl_sales_package_map Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
