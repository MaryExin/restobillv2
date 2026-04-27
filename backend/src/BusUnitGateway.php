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

        $sql = "SELECT * FROM tbl_main_business_units Where Status = 'Active' ORDER BY Unit_Name ASC";

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
        lkp_busunits.pricing_category, lkp_pricing_code.pricing_code
        FROM lkp_busunits
        LEFT OUTER JOIN lkp_pricing_code ON lkp_busunits.pricing_category = lkp_pricing_code.uuid
        LEFT OUTER JOIN lkp_busunits ON lkp_busunits.brandcode = lkp_busunits.brand_code
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
    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_busunits WHERE name = :businessunitname && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":businessunitname", $data["businessunitname"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "INSERT INTO lkp_busunits ()
                VALUES (default, CONCAT('BU-',ShortUUID()),:class, :busunitname, :address,
                :brandcode, :corpcode, :areacode, :startdate, :pricing_category, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":class", $data["classification"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitname", $data["businessunitname"], PDO::PARAM_STR);
        $stmt->bindValue(":address", $data["address"], PDO::PARAM_STR);
        $stmt->bindValue(":brandcode", $data["brand"], PDO::PARAM_STR);
        $stmt->bindValue(":corpcode", $data["corporation"], PDO::PARAM_STR);
        $stmt->bindValue(":areacode", $data["area"], PDO::PARAM_STR);
        $stmt->bindValue(":pricing_category", $data["pricingcategory"], PDO::PARAM_STR);
        $stmt->bindValue(":startdate", $data["starteddate"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        echo json_encode(["message" => "Success"]);
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

    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_busunits WHERE name = :businessunitname &&
                    class  = :class &&
                    address  = :address &&
                    brandcode  = :brandcode &&
                    corpcode  = :corpcode &&
                    areacode  = :areacode &&
                    pricing_category  = :pricingcategory &&
                    opstarteddate  = :opstarteddate &&
                    deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":businessunitname", $id["businessunitname"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":class", $id["classification"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":address", $id["address"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":brandcode", $id["brand"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":corpcode", $id["corporation"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":areacode", $id["area"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":pricingcategory", $id["pricingcategory"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":opstarteddate", $id["starteddate"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE lkp_busunits
                SET
                    class  = :class,
                    name   = :name ,
                    address  = :address,
                    brandcode  = :brandcode,
                    corpcode  = :corpcode,
                    areacode  = :areacode,
                    pricing_category  = :pricingcategory,
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
        $stmt->bindValue(":opstarteddate", $id["starteddate"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["busunitcode"], PDO::PARAM_STR);
        $stmt->execute();
        // return $stmt->rowCount();
echo json_encode(["message" => "Edited"]);}
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
            'items' => $data,
            'nextPage' => $page + 1, // Provide the next page number
        ];

        return $response;

    }

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {
        $sql = "SELECT lkp_busunits.busunitcode, lkp_busunits.class, lkp_busunits.name, lkp_busunits.address,
        lkp_busunits.brandcode, lkp_brands.brand_name, lkp_busunits.corpcode, lkp_corporation.corp_name,
        lkp_busunits.areacode, lkp_area.area_name, lkp_busunits.opstarteddate,
        lkp_busunits.pricing_category, lkp_pricing_code.pricing_code
        FROM lkp_busunits
        LEFT OUTER JOIN lkp_pricing_code ON lkp_busunits.pricing_category = lkp_pricing_code.uuid
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
            'items' => $data,
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
