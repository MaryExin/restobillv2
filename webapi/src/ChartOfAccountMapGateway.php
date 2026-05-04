<?php

class ChartOfAccountMapGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM tbl_chart_of_accounts_map Where deletestatus = 'Active' ORDER BY seq";

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

        //$sql = "SELECT * FROM tbl_chart_of_accounts_map Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $sql = "SELECT t1.chart_code, t1.chart_id, t1.busunituuid, t2.chart_type_name, t3.name, createtime FROM
        (SELECT seq, chart_code, chart_id, busunituuid, deletestatus, createtime from tbl_chart_of_accounts_map) As t1 
        LEFT JOIN(SELECT chart_type_code , chart_type_name from lkp_chart_type) As t2 ON t1.chart_id = t2.chart_type_code
        LEFT JOIN(SELECT busunitcode , name from lkp_busunits) As t3 ON t1.busunituuid = t3.busunitcode
        Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
    $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_chart_of_accounts_map WHERE chart_id = :charttypes && busunituuid = :busiunitnames && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":charttypes", $data["charttype"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":busiunitnames", $data["busiunitname"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "INSERT INTO tbl_chart_of_accounts_map ()

                VALUES (default, CONCAT('CH-',ShortUUID()),:charttypes,:busiunitname, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":charttypes", $data["charttype"], PDO::PARAM_STR);
        $stmt->bindValue(":busiunitname", $data["busiunitname"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
    }
    }

    public function rejectchart($user_id, string $id)
    {

        $sql = "UPDATE tbl_chart_of_accounts_map

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      chart_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);

    }

    public function editchart($user_id, $id)
    {
$checkforduplisql = "SELECT COUNT(*) as count FROM tbl_chart_of_accounts_map WHERE chart_id = :charttypes && busunituuid = :busiunitnames && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":charttypes", $id["charttype"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":busiunitnames", $id["busiunitname"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE tbl_chart_of_accounts_map

                SET

                    chart_id  = :chart_id,
                    busunituuid  = :busiunitname,
                    usertracker  = :usertracker

                WHERE

                      chart_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":chart_id", $id["charttype"], PDO::PARAM_STR);
        $stmt->bindValue(":busiunitname", $id["busiunitname"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $id["chartcode"], PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
         echo json_encode(["message" => "Edited"]);
    }
    }

     public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_chart_of_accounts_map Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        //$sql = "SELECT * FROM tbl_chart_of_accounts_map Where deletestatus = 'Active' AND chart_id LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

        $sql = "SELECT t1.chart_code, t1.chart_id, t1.busunituuid, t2.chart_type_name, t3.name, createtime FROM
        (SELECT seq, chart_code, chart_id, busunituuid, deletestatus, createtime from tbl_chart_of_accounts_map) As t1 
        LEFT JOIN(SELECT chart_type_code , chart_type_name from lkp_chart_type) As t2 ON t1.chart_id = t2.chart_type_code
        LEFT JOIN(SELECT busunitcode , name from lkp_busunits) As t3 ON t1.busunituuid = t3.busunitcode
        Where deletestatus = 'Active' AND t3.name LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM tbl_chart_of_accounts_map Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
