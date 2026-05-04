<?php

class ComponentsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function patchForUser($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $sql = "UPDATE tbl_build_components
                        SET qty = :qty,
                        usertracker = :usertracker,
                        createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    WHERE
                        seq = :seq";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":qty", $data["qty"], PDO::PARAM_STR);
            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":seq", $data["seq"], PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);
        } catch (PDOException $e) {
            $this->conn->rollBack();

            echo json_encode(["message" => "Database error: " . $e->getMessage()]);
        } catch (Exception $e) {
            $this->conn->rollBack();

            echo json_encode(["message" => "An error occurred: " . $e->getMessage()]);
        }
    }

}
