<?php

class PaymentsInternalGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_busunits ORDER BY name ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getFilteredData($data)
    {

        try {

            $sql = "SELECT * FROM tbl_internal_billing_payments

            WHERE prd_queue_code = :prd_queue_code

            AND deletestatus = 'Active'

            ORDER BY payment_date ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":prd_queue_code", 'PC-' . $data["prd_queue_code"], PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (PDOException $e) {

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function getFilteredDataByStores()
    {

        $sql = "SELECT * FROM lkp_busunits WHERE class IN ('STORE') ORDER BY class ASC, name ASC";

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

        $sql = "SELECT * FROM lkp_busunits ORDER BY seq LIMIT $pageIndex, $pageData";

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

                :brandcode, :corpcode, :areacode, :startdate, 'Active', :user_tracker, DATE_ADD(DATE_ADD(NOW(), INTERVAL 8 HOUR), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":class", $data["classification"], PDO::PARAM_STR);

        $stmt->bindValue(":busunitname", $data["businessunitname"], PDO::PARAM_STR);

        $stmt->bindValue(":address", $data["address"], PDO::PARAM_STR);

        $stmt->bindValue(":brandcode", $data["brand"], PDO::PARAM_STR);

        $stmt->bindValue(":corpcode", $data["corporation"], PDO::PARAM_STR);

        $stmt->bindValue(":areacode", $data["area"], PDO::PARAM_STR);

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
