<?php

class UserGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    // public function getByAPIKey($key): array

    // {

    //     $sql = "SELECT *

    //             FROM user

    //             WHERE api_key = :api_key";

    //     $stmt = $this->conn->prepare($sql);

    //     $stmt->bindValue(":api_key", $key, PDO::PARAM_STR);

    //     $stmt->execute();

    //     return $stmt->fetch(PDO::FETCH_ASSOC);

    // }

    public function getByUsername($username)
    {

        try {

            $sql = "SELECT tbl_users_global_assignment.* , tbl_employees.image_filename

                FROM tbl_users_global_assignment
                
                LEFT OUTER JOIN tbl_employees ON tbl_users_global_assignment.uuid =  tbl_employees.empid

                WHERE tbl_users_global_assignment.email = :username

                AND tbl_users_global_assignment.deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":username", $username, PDO::PARAM_STR);

            $stmt->execute();

            return $stmt->fetch(PDO::FETCH_ASSOC);

        } catch (Exception $e) {

            echo json_encode(["message" => $e->getMessage()]);

            exit;

        }

    }

    public function getRole($userId)
    {

        try {

            $sql = "SELECT rolename

                FROM tbl_user_roles

                WHERE userid = :userId

                AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":userId", $userId, PDO::PARAM_STR);

            $stmt->execute();

            // return $stmt->fetch(PDO::FETCH_ASSOC);

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => $e->getMessage()]);

            exit;

        }

    }

    public function getByID($id)
    {

        try {

            $sql = "SELECT *

                FROM tbl_users_global_assignment

                WHERE uuid = :id

                AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_INT);

            $stmt->execute();

            return $stmt->fetch(PDO::FETCH_ASSOC);

        } catch (Exception $e) {

            echo json_encode(["message" => "invalidCredentials"]);

            exit;

        }

    }

}
