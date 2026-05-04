<?php

class COAGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM lkp_chart_of_accounts Where deletestatus = 'Active' ORDER BY seq";

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

        $sql = "SELECT * FROM lkp_chart_of_accounts Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_chart_of_accounts WHERE chart_type_id = :chartids &&
    glcode = :glcodes &&
    slcode = :slcodes &&
    deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":chartids", $data["chartid"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":glcodes", $data["glcode"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":slcodes", $data["slcode"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "INSERT INTO lkp_chart_of_accounts ()

                VALUES (default ,:chart_type_id,:glcodes,:gl_description,:slcodes,:sl_description, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":chart_type_id", $data["chartid"], PDO::PARAM_STR);
        $stmt->bindValue(":glcodes", $data["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":gl_description", $data["gldesc"], PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $data["slcode"], PDO::PARAM_STR);
        $stmt->bindValue(":sl_description", $data["sldesc"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
    }
    }

    public function rejectcoas($user_id, $data)
    {

        $sql = "UPDATE lkp_chart_of_accounts

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      seq = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $data["seq"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
 echo json_encode(["message" => "Deleted"]);
    }

    public function editcoa($user_id, $id)
    {

        // $branchcode = $id["glcode"];

        // $branchid = join($branchcode);

        $sql = "UPDATE lkp_chart_of_accounts

                SET

                    chart_type_id = :chart_type_id,
                    glcode = :glcodes,
                    gl_description = :gl_description,
                    slcode = :slcodes,
                    sl_description = :sl_description,
                    normal_balance = :normal_balance,

                    usertracker  = :usertracker

                WHERE
                      seq = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":chart_type_id", $id["chartid"], PDO::PARAM_STR);
        $stmt->bindValue(":glcodes", $id["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":gl_description", $id["gldesc"], PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $id["slcode"], PDO::PARAM_STR);
        $stmt->bindValue(":sl_description", $id["sldesc"], PDO::PARAM_STR);
        $stmt->bindValue(":normal_balance", $id["normalbalance"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $id["seq"], PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_chart_of_accounts Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_chart_of_accounts Where deletestatus = 'Active' AND sl_description LIKE :search ORDER BY glcode LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_chart_of_accounts Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
