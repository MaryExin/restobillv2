<?php

class SupplierGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT busunitcode AS supplier_code, name AS supplier_name FROM lkp_busunits WHERE deletestatus = 'Active' AND class = 'COMMI'";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $busUnits = $stmt->fetchAll(PDO::FETCH_ASSOC); 

        $sql = "SELECT * FROM lkp_supplier WHERE deletestatus = 'Active' ORDER BY supplier_name";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC); 

        $data = array_merge($busUnits, $suppliers);

        return $data;

    }

       public function ExcelGetSuppliers()
    {

        $sql = "SELECT * FROM lkp_supplier WHERE deletestatus = 'Active' ORDER BY supplier_name ASC";

        $stmt = $this->conn->prepare($sql);

        // $stmt->bindValue(":token", $token, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function createForUser($user_id, $data)
    {
         $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_supplier WHERE supplier_name = :supplier_names && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":supplier_names", $data["supplier_name"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

    $sql = "INSERT INTO lkp_slcodes () VALUES (CONCAT('SL-', ShortUUID()), :glcodes, :slcodes, :sldescs, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $stmt = $this->conn->prepare($sql);

    $generateidsql = "SELECT COUNT(*) as count FROM lkp_slcodes WHERE glcode = :glcodes";
    $generateidstmt = $this->conn->prepare($generateidsql);
    $generateidstmt->bindValue(":glcodes", "400", PDO::PARAM_STR);
    $generateidstmt->execute();
    $rowCount = $generateidstmt->fetchColumn();

    $uniqueNumber = $rowCount;

    $slcode = "4000" . sprintf("%02d", $uniqueNumber);
    $sldescription = "ACCOUNTS PAYABLE - " . $data["supplier_name"];
    

    $stmt->bindValue(":glcodes", "400", PDO::PARAM_STR);
    $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
    $stmt->bindValue(":sldescs", $sldescription, PDO::PARAM_STR);
    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
    $stmt->execute();

        $sql = "INSERT INTO lkp_supplier ()
                VALUES (default, CONCAT('SP-',ShortUUID()), :supplier_name, :tin,
                :address,:zipcode, :atc, :whtx_rate, :product_type, :pricingcategory, :slcodes,'Active',
                :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":supplier_name", $data["supplier_name"], PDO::PARAM_STR);

        $stmt->bindValue(":tin", $data["tin"], PDO::PARAM_STR);

        $stmt->bindValue(":address", $data["address"], PDO::PARAM_STR);

        $stmt->bindValue(":atc", $data["atc"], PDO::PARAM_STR);

        $stmt->bindValue(":whtx_rate", $data["whtx_rate"], PDO::PARAM_STR);

        $stmt->bindValue(":product_type", $data["product_type"], PDO::PARAM_STR);

        $stmt->bindValue(":pricingcategory", $data["pricingcategory"], PDO::PARAM_STR);

        $stmt->bindValue(":zipcode", $data["zipcode"], PDO::PARAM_STR);

        $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
    }
    }

    public function rejectsuppliers($user_id, string $id)
    {

        $sql = "UPDATE lkp_supplier
                SET
                    deletestatus = 'Inactive',
                    usertracker  = :usertracker
                WHERE
                      supplier_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
echo json_encode(["message" => "Deleted"]);
    }

    public function editsupplier($user_id, $id)
    {

    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_supplier WHERE supplier_name = :supplier_names &&
                    tin  = :tin &&
                    address  = :address &&
                    atc  = :atc &&
                    whtx_rate  = :whtx_rate &&
                    product_type  = :product_type &&
                    pricing_category  = :pricingcategory &&
                    zipcode = :zipcode &&
                    deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":supplier_names", $id["supplier_name"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":tin", $id["tin"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":address", $id["address"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":atc", $id["atc"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":whtx_rate", $id["whtx_rate"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":product_type", $id["product_type"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":pricingcategory", $id["pricingcategory"], PDO::PARAM_STR);
     $checkforduplistmt->bindValue(":zipcode", $id["zipcode"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "UPDATE lkp_supplier
                SET
                    supplier_name  = :supplier_name,
                    tin  = :tin,
                    address  = :address,
                    atc  = :atc,
                    whtx_rate  = :whtx_rate,
                    product_type  = :product_type,
                    pricing_category  = :pricingcategory,
                    zipcode = :zipcode,
                    usertracker  = :usertracker
                WHERE
                      supplier_code  = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":supplier_name", $id["supplier_name"], PDO::PARAM_STR);
        $stmt->bindValue(":tin", $id["tin"], PDO::PARAM_STR);
        $stmt->bindValue(":address", $id["address"], PDO::PARAM_STR);
        $stmt->bindValue(":atc", $id["atc"], PDO::PARAM_STR);
        $stmt->bindValue(":whtx_rate", $id["whtx_rate"], PDO::PARAM_STR);
        $stmt->bindValue(":product_type", $id["product_type"], PDO::PARAM_STR);
        $stmt->bindValue(":pricingcategory", $id["pricingcategory"], PDO::PARAM_STR);
        $stmt->bindValue(":zipcode", $id["zipcode"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["supplier_code"], PDO::PARAM_STR);
        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' AND supplier_name  LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
