<?php

class StocklevelGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM lkp_stock_levels Where deletestatus = 'Active' ORDER BY seq";

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

        // $sql = "SELECT * FROM lkp_stock_levels Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $sql = "SELECT t1.seq, t1.inv_code, t2.`desc`, t1.min_stock_level, t1.uom, t1.level, lkp_busunits.name



        FROM (SELECT seq, inv_code, min_stock_level, uom, level, deletestatus



              FROM lkp_stock_levels) AS t1



        LEFT JOIN (SELECT build_code, `desc` FROM lkp_build_of_products) AS t2



        ON t1.inv_code = t2.build_code



        LEFT OUTER JOIN lkp_busunits ON t1.level = lkp_busunits.busunitcode



        WHERE t1.deletestatus = 'Active'



        ORDER BY t1.seq



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
    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_stock_levels WHERE inv_code = :stock_desc && level = :levels && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":stock_desc", $data["Stock_desc"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":levels", $data["Level"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "INSERT INTO lkp_stock_levels ()
                VALUES (default ,:stock_desc ,:minstocks ,:uom ,:level , 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":stock_desc", $data["Stock_desc"], PDO::PARAM_STR);
        $stmt->bindValue(":minstocks", $data["Minstocks"], PDO::PARAM_STR);
        $stmt->bindValue(":uom", $data["Uom"], PDO::PARAM_STR);
        $stmt->bindValue(":level", $data["Level"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        echo json_encode(["message" => "Success"]);
    }
    }

    public function rejectstocklevels($user_id, $data)
    {
        $sql = "UPDATE lkp_stock_levels
                SET
                    deletestatus = 'Inactive',
                    usertracker  = :usertracker
                WHERE
                    seq  = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $data["Stock_code"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        // return $stmt->rowCount();

        echo json_encode(["message" => "Deleted"]);

    }

    public function editstocklevel($user_id, $id)
    {
    $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_stock_levels WHERE inv_code = :stock_desc && min_stock_level = :minstocks && uom = :uoms && level = :levels && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":stock_desc", $id["Stock_desc"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":minstocks", $id["Minstocks"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":uoms", $id["Uom"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":levels", $id["Level"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE lkp_stock_levels
                SET
                    inv_code  = :stock_desc,
                    min_stock_level  = :minstocks,
                    uom  = :uom,
                    level  = :levels,
                    usertracker  = :usertracker
                WHERE
                    seq  = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $id["Stock_code"], PDO::PARAM_STR);
        $stmt->bindValue(":stock_desc", $id["Stock_desc"], PDO::PARAM_STR);
        $stmt->bindValue(":minstocks", $id["Minstocks"], PDO::PARAM_STR);
        $stmt->bindValue(":uom", $id["Uom"], PDO::PARAM_STR);
        $stmt->bindValue(":levels", $id["Level"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_stock_levels Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT lkp_stock_levels.inv_code,
        IF(LEFT(lkp_stock_levels.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS `desc`,
        lkp_stock_levels.seq,
        lkp_busunits.name,
        lkp_stock_levels.min_stock_level,
        lkp_stock_levels.uom, 
        lkp_stock_levels.level
        FROM lkp_stock_levels
            LEFT OUTER JOIN lkp_raw_mats ON lkp_stock_levels.inv_code = lkp_raw_mats.mat_code
            LEFT OUTER JOIN lkp_build_of_products ON lkp_stock_levels.inv_code = lkp_build_of_products.build_code
            LEFT OUTER JOIN lkp_busunits ON lkp_stock_levels.level = lkp_busunits.busunitcode
        WHERE lkp_stock_levels.deletestatus = 'Active' 
            AND IF(LEFT(lkp_stock_levels.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) LIKE :search
        ORDER BY lkp_stock_levels.inv_code DESC, lkp_stock_levels.level DESC
        LIMIT $pageIndex, $pageData";


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

        $sql = "SELECT * FROM lkp_stock_levels Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
