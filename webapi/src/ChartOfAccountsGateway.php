<?php

class ChartOfAccountsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM tbl_chart_of_accounts_map WHERE deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

     public function ExcelGetChartOfAccounts()
    {

        $sql = "SELECT 
                    lkp_slcodes.*, lkp_glcodes.gldescription
                FROM
                    lkp_slcodes
                    LEFT OUTER JOIN lkp_glcodes ON lkp_slcodes.glcode =  lkp_glcodes.glcode
                    WHERE lkp_slcodes.deletestatus = 'Active'
                    ORDER BY glcode ASC, slcodes ASC;";

        $stmt = $this->conn->prepare($sql);

        // $stmt->bindValue(":token", $token, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    
  

    public function getAllDistinctData()
    {

        $sql = "SELECT DISTINCT slcode, sl_description FROM lkp_chart_of_accounts
                WHERE deletestatus = 'Active'
                AND glcode = 110
                ORDER BY slcode;";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getFilteredDataByStore($data)
    {

        $sql = "SELECT * FROM lkp_chart_of_accounts WHERE chart_type_id = :charttype
            AND deletestatus = 'Active'
            ORDER BY glcode ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue("charttype", $data["charttype"], PDO::PARAM_STR);

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

        lkp_busunits.brandcode, lkp_brands.brand_name, lkp_busunits.corpcode, lkp_corporation.corp_name,

        lkp_busunits.areacode, lkp_area.area_name, lkp_busunits.opstarteddate,

        lkp_busunits.pricing_category, lkp_pricing_code.pricing_code

        FROM lkp_busunits

        LEFT OUTER JOIN lkp_pricing_code ON lkp_busunits.pricing_category = lkp_pricing_code.uuid

        LEFT OUTER JOIN lkp_brands ON lkp_busunits.brandcode = lkp_brands.brand_code

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

    public function createForUser($user_id, $data)
    {

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
