<?php

class OTPGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM tbl_sales_history ORDER BY createtime DESC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function patchUserVerified($userIDToVerify)
    {
        $this->conn->exec("SET time_zone = 'Asia/Manila'");

        $sql = "UPDATE tbl_users_global_assignment
                    SET verified = 'Verified', otp = 0
                    WHERE uuid = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $userIDToVerify, PDO::PARAM_STR);

        $stmt->execute();

        $log = "INSERT INTO tbl_logs ()
        VALUES (default, 'LIGHTEM', 'LOGIN', 'LOGIN', 'LOGIN', 'LOGIN', :id, 'Active', CURRENT_TIMESTAMP)";

        $logstmt = $this->conn->prepare($log);

        $logstmt->bindValue(":id", $userIDToVerify, PDO::PARAM_STR);

        $logstmt->execute();

        return $stmt->rowCount();

        



    }

    public function deletedataWithIds($ids)
    {

        foreach ($ids as $id) {

            $sql = "DELETE FROM tbl_sales_history



                WHERE uuid = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_STR);

            $stmt->execute();

        }

        return $stmt->rowCount();

    }

}
