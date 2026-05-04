<?php

class EditCostsInOrderSummaryGateway
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

            $sql = "UPDATE tbl_products_queue
                    SET
                        cost_per_uom = :newcost,
                        total = :totalcost,
                        quantity = :newquantity,
                        createdtime = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                        usertracker = :usertracker
                    WHERE
                        prd_queue_code = :pr_code
                            AND inv_code = :inv_code";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":newcost", $data["newcost"], PDO::PARAM_STR);

            $stmt->bindValue(":totalcost", $data["total_cost"], PDO::PARAM_STR);

            $stmt->bindValue(":newquantity", $data["newquantity"], PDO::PARAM_STR);

            $stmt->bindValue(":pr_code", $data["prd_queue_code"], PDO::PARAM_STR);

            $stmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);

            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            // Update Prodcuts Queue Summary

            $sql = "UPDATE `tbl_products_queue_summary`
            SET
                subtotal = :newtotalcost,
                createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                usertracker = :usertracker
            WHERE
                prd_queue_code = :pr_code";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":newtotalcost", $data["newtotalcost"], PDO::PARAM_STR);

            $stmt->bindValue(":pr_code", $data["prd_queue_code"], PDO::PARAM_STR);

            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            // Save All if no Error

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollback();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

}
