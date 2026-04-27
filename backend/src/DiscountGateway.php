<?php

class DiscountGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' ORDER BY seq";

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

        $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
        $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_discounts WHERE description = :descriptions && deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":descriptions", $data["description"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = $checkforduplistmt->fetchColumn();

        if($rowCount > 0) {
            echo json_encode(["message" => "Duplicate Entry"]);
        } else {

    $sql = "INSERT INTO lkp_slcodes () VALUES (CONCAT('SL-', ShortUUID()), :glcodes, :slcodes, :sldescs, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    $stmt = $this->conn->prepare($sql);

    $generateidsql = "SELECT COUNT(*) as count FROM lkp_slcodes WHERE glcode = :glcodes";
    $generateidstmt = $this->conn->prepare($generateidsql);
    $generateidstmt->bindValue(":glcodes", "803", PDO::PARAM_STR);
    $generateidstmt->execute();
    $rowCount = $generateidstmt->fetchColumn();

    $uniqueNumber = $rowCount + 1;

    $slcode = "803" . sprintf("%02d", $uniqueNumber);

    $stmt->bindValue(":glcodes", "803", PDO::PARAM_STR);
    $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
    $stmt->bindValue(":sldescs", $data["description"], PDO::PARAM_STR);
    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
    $stmt->execute();

        $sql = "INSERT INTO lkp_discounts ()

                VALUES (default, CONCAT('DC-',ShortUUID()),:descriptions,:Amounts,:taxtypes,:discounttypess,:busiunits,:buildcodes, :slcode, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":discounttypess", $data["discounttypes"], PDO::PARAM_STR);
        $stmt->bindValue(":descriptions", $data["description"], PDO::PARAM_STR);
        $stmt->bindValue(":Amounts", $data["Amount"], PDO::PARAM_STR);
        $stmt->bindValue(":taxtypes", $data["taxtype"], PDO::PARAM_STR);
        $stmt->bindValue(":busiunits", $data["busiunit"], PDO::PARAM_STR);
        $stmt->bindValue(":buildcodes", $data["buildcode"], PDO::PARAM_STR);
        $stmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
        }
    }

    public function rejectdiscounts($user_id, string $id)
    {

        $sql = "UPDATE lkp_discounts

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      discount_type_id   = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);

    }

    public function editdiscount($user_id, $id)
    {
        $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_discounts WHERE description = :descriptions && 
                    type  = :type &&
                    value  = :value &&
                    tax_type  = :tax_type &&
                    busunitcode  = :busunitcode &&
                    build_code  = :buildcodes &&
                    slcode = :slcode &&
                    deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":descriptions", $id["description"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":type", $id["discounttypes"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":value", $id["Amount"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":tax_type", $id["taxtype"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":busunitcode", $id["busiunit"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":buildcodes", $id["buildcode"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":slcode", $id["slcode"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = $checkforduplistmt->fetchColumn();

        if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
        } else {

        $sql = "UPDATE lkp_discounts

                SET
                    type  = :type,
                    description  = :description,
                    value  = :value,
                    tax_type  = :tax_type,
                    busunitcode  = :busunitcode,
                    build_code  = :buildcodes,
                    slcode = :slcode,
                    usertracker  = :usertracker

                WHERE

                      discount_type_id   = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id["discount_code"], PDO::PARAM_STR);
        $stmt->bindValue(":type", $id["discounttypes"], PDO::PARAM_STR);
        $stmt->bindValue(":description", $id["description"], PDO::PARAM_STR);
        $stmt->bindValue(":value", $id["Amount"], PDO::PARAM_STR);
        $stmt->bindValue(":tax_type", $id["taxtype"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $id["busiunit"], PDO::PARAM_STR);
        $stmt->bindValue(":buildcodes", $id["buildcode"], PDO::PARAM_STR);
        $stmt->bindValue(":slcode", $id["slcode"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' AND description  LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
