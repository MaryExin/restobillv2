<?php

class EmplocationGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM tbl_employee_location Where deletestatus = 'Active' ORDER BY seq";

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

        //$sql = "SELECT * FROM tbl_employee_location Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $sql = "SELECT

                tbl_employee_location.emplocation_code ,

                emplocation_user,

                latitude,

                longitude,

                createdtime,

                tbl_users_global_assignment.firstname AS firstname,

                tbl_users_global_assignment.lastname AS lastname,

                tbl_users_global_assignment.department AS department

                    FROM

                tbl_employee_location

                    LEFT OUTER JOIN

                tbl_users_global_assignment ON tbl_employee_location.emplocation_user = tbl_users_global_assignment.uuid

                ORDER BY firstname

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
        try {
            $this->conn->beginTransaction();

            $dupSql = "SELECT * FROM tbl_employee_location
            WHERE emplocation_user = :userid
            AND deletestatus = 'Active'";

            $dupStmt = $this->conn->prepare($dupSql);

            $dupStmt->bindValue(":userid", $data["emplocationuser"], PDO::PARAM_STR);

            $dupStmt->execute();

            $rowCount = $dupStmt->rowCount();

            if ($rowCount > 0) {
                echo json_encode(["message" => "Duplicate Entry"]);
                exit;
            }

            $sql = "INSERT INTO tbl_employee_location ()
                    VALUES
                    (default, CONCAT('EL-',ShortUUID()), :emplocation_user, :latitude,
                    :longitude, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":emplocation_user", $data["emplocationuser"], PDO::PARAM_STR);
            $stmt->bindValue(":latitude", $data["emplocationlati"], PDO::PARAM_STR);
            $stmt->bindValue(":longitude", $data["emplocationlong"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            // Commit the transaction
            $this->conn->commit();

            echo json_encode(["message" => "Success"]);
        } catch (PDOException $e) {
            // Rollback the transaction on error
            $this->conn->rollBack();

            // Handle the error
            echo json_encode(["error" => $e->getMessage()]);
        }

    }

    public function rejectsaletype($user_id, string $id)
    {

        $sql = "DELETE FROM tbl_employee_location
                WHERE
                    emplocation_code   = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
echo json_encode(["message" => "Deleted"]);
    }

    public function editemplocation($user_id, $id)
    {

        $emplocationcode = $id["emplocation_code"];

        $emplocationid = join($emplocationcode);

        $sql = "UPDATE tbl_employee_location
                SET
                    emplocation_user   = :emplocation_user ,
                    latitude   = :latitude ,
                    longitude   = :longitude ,
                    usertracker  = :usertracker
                WHERE
                      brand_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":emplocation_user ", $id["emplocationuser"], PDO::PARAM_STR);

        $stmt->bindValue(":latitude ", $id["emplocationlati"], PDO::PARAM_STR);

        $stmt->bindValue(":longitude ", $id["emplocationlong"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $emplocationid, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_employee_location Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

         $sql = "SELECT

                tbl_employee_location.emplocation_code ,

                emplocation_user,

                latitude,

                longitude,

                createdtime,

                tbl_users_global_assignment.firstname AS firstname,

                tbl_users_global_assignment.lastname AS lastname,

                tbl_users_global_assignment.department AS department

                    FROM

                tbl_employee_location

                    LEFT OUTER JOIN

                tbl_users_global_assignment ON tbl_employee_location.emplocation_user = tbl_users_global_assignment.uuid

                ORDER BY firstname

                    LIMIT $pageIndex, $pageData";

        //$sql = "SELECT * FROM tbl_employee_location Where deletestatus = 'Active' AND emplocation_user LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM tbl_employee_location Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
