<?php

class AcctgTransMapGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_acctg_transactions_map Where deletestatus = 'Active'  ORDER BY seq";

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

        $sql = "SELECT * FROM lkp_acctg_transactions_map Where deletestatus = 'Active'  ORDER BY seq LIMIT $pageIndex, $pageData";

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
    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_acctg_transactions_map WHERE transactionid = :transactionids && glsl = :glsls && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":transactionids", $data["transactionid"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":glsls", $data["glsl"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "INSERT INTO lkp_acctg_transactions_map ()
                VALUES (default, CONCAT('ATM-',ShortUUID()), :transactionids, :glsls, :modules, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":transactionids", $data["transactionid"], PDO::PARAM_STR);
        $stmt->bindValue(":glsls", $data["glsl"], PDO::PARAM_STR);
        $stmt->bindValue(":modules", $data["modules"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
    }
    }

    public function rejectacctgtransmap($user_id, $id)
    {

        $sql = "UPDATE lkp_acctg_transactions_map

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      uuid  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id["acctgtransmapid"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
echo json_encode(["message" => "Deleted"]);
    }

    public function editacctgtransmap($user_id, $id)
    {
    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_acctg_transactions_map WHERE transactionid = :transactionids && glsl = :glsls && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":transactionids", $id["transactionid"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":glsls", $id["glsl"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE lkp_acctg_transactions_map
                SET
                    transactionid  = :transactionids,
                    glsl  = :glsls,
                    module  = :moduless,
                    usertracker  = :usertracker
                WHERE
                      uuid  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":transactionids", $id["transactionid"], PDO::PARAM_STR);
        $stmt->bindValue(":glsls", $id["glsl"], PDO::PARAM_STR);
        $stmt->bindValue(":moduless", $id["modules"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["acctgtransmapid"], PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_acctg_transactions_map Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        //$sql = "SELECT * FROM lkp_acctg_transactions_map Where deletestatus = 'Active' AND transactionid LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

       $sql = "SELECT 
            t1.*, 
            t2.description AS discount_description,
            t3.description AS mop_description
        FROM 
            (SELECT * 
             FROM lkp_acctg_transactions_map) AS t1 
        LEFT JOIN lkp_discounts AS t2 
            ON t1.transactionid = t2.discount_type_id 
        LEFT JOIN lkp_mop AS t3 
            ON t1.transactionid = t3.mop_id 
        WHERE t1.deletestatus = 'Active' 
            AND (t2.description LIKE :discsearch OR t3.description LIKE :mopsearch) 
        ORDER BY t1.seq 
        LIMIT $pageIndex,  $pageData";

$stmt = $this->conn->prepare($sql);

$stmt->bindValue(":discsearch", '%' . $search . '%', PDO::PARAM_STR);
$stmt->bindValue(":mopsearch", '%' . $search . '%', PDO::PARAM_STR);

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

        $sql = "SELECT * FROM lkp_acctg_transactions_map Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
