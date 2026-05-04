<?php

class CorporationGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM lkp_corporation Where deletestatus = 'Active' ORDER BY seq";

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

        $sql = "SELECT * FROM lkp_corporation Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

        public function ExcelGetCorporations()
    {

        $sql = "SELECT
                *
                FROM
                    lkp_corporation
                WHERE
                    deletestatus = 'Active'
                ORDER BY corp_name ASC";

        $stmt = $this->conn->prepare($sql);

        // $stmt->bindValue(":token", $token, PDO::PARAM_STR);

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

        $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_corporation WHERE corp_name = :corp_names && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":corp_names", $data["corp_name"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "INSERT INTO lkp_corporation ()
                VALUES (default, CONCAT('CP-',ShortUUID()), :corp_name, :address,:zipcode, :sec_id, :sec_reg_date, :operating_period_start, :tin, :sss, :phic, :mdf, :vats,'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":corp_name", $data["corp_name"], PDO::PARAM_STR);

        $stmt->bindValue(":address", $data["address"], PDO::PARAM_STR);

        $stmt->bindValue(":sec_id", $data["sec_id"], PDO::PARAM_STR);

        $stmt->bindValue(":sec_reg_date", $data["sec_reg_date"], PDO::PARAM_STR);

        $stmt->bindValue(":operating_period_start", $data["operating_period_start"], PDO::PARAM_STR);
        
        $stmt->bindValue(":zipcode", $data["zipcode"], PDO::PARAM_STR);

        $stmt->bindValue(":tin", $data["tin"], PDO::PARAM_STR);

        $stmt->bindValue(":sss", $data["sss"], PDO::PARAM_STR);

        $stmt->bindValue(":phic", $data["phic"], PDO::PARAM_STR);

        $stmt->bindValue(":mdf", $data["mdf"], PDO::PARAM_STR);

        $stmt->bindValue(":vats", $data["vat"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
    }
    }

    public function rejectcorps($user_id, string $id)
    {

        $sql = "UPDATE lkp_corporation

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      corp_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);

    }

    public function editcorp($user_id, $id)
    {

    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_corporation WHERE corp_name = :corp_names &&
                    address  = :address &&
                    sec_id  = :sec_id &&
                    sec_reg_date  = :sec_reg_date &&
                    operating_period_start  = :operating_period_start &&
                    tin  = :tin &&
                    sss  = :sss &&
                    phic  = :phic &&
                    mdf  = :mdf &&
                    taxtype  = :vats &&
                    zipcode = :zipcode &&
                    deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":corp_names", $id["corp_name"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":address", $id["address"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":zipcode", $id["zipcode"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":sec_id", $id["sec_id"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":sec_reg_date", $id["sec_reg_date"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":operating_period_start", $id["operating_period_start"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":tin", $id["tin"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":sss", $id["sss"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":phic", $id["phic"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":mdf", $id["mdf"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":vats", $id["vat"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "UPDATE lkp_corporation

                SET

                    corp_name  = :corp_name ,
                    address  = :address ,
                    sec_id  = :sec_id ,
                    sec_reg_date  = :sec_reg_date ,
                    operating_period_start  = :operating_period_start ,
                    tin  = :tin ,
                    sss  = :sss ,
                    zipcode = :zipcode,
                    phic  = :phic ,
                    mdf  = :mdf ,
                    taxtype  = :vats ,
                    usertracker  = :usertracker
                WHERE
                      corp_code  = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":corp_name", $id["corp_name"], PDO::PARAM_STR);
        $stmt->bindValue(":address", $id["address"], PDO::PARAM_STR);
        $stmt->bindValue(":sec_id", $id["sec_id"], PDO::PARAM_STR);
        $stmt->bindValue(":sec_reg_date", $id["sec_reg_date"], PDO::PARAM_STR);
        $stmt->bindValue(":operating_period_start", $id["operating_period_start"], PDO::PARAM_STR);
        $stmt->bindValue(":tin", $id["tin"], PDO::PARAM_STR);
        $stmt->bindValue(":sss", $id["sss"], PDO::PARAM_STR);
        $stmt->bindValue(":zipcode", $id["zipcode"], PDO::PARAM_STR);
        $stmt->bindValue(":phic", $id["phic"], PDO::PARAM_STR);
        $stmt->bindValue(":mdf", $id["mdf"], PDO::PARAM_STR);
        $stmt->bindValue(":vats", $id["vat"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["corpcode"], PDO::PARAM_STR);
        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_corporation Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_corporation Where deletestatus = 'Active' AND corp_name LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_corporation Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
