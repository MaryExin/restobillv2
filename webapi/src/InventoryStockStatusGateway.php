<?php

class InventoryStockStatusGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getAllData()
    {
        try {
            $sql = "SELECT *
                    FROM tbl_inventory_stock_status
                    WHERE deletestatus = 'Active'
                    ORDER BY seq ASC";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute();

            $data = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $data[] = $row;
            }

            return $data;

        } catch (Exception $e) {
            echo json_encode(["message" => "Read error"]);
            exit;
        }
    }

    public function getByBusunit($busunitcode)
    {
        try {
            $sql = "SELECT inv_code, busunitcode, inv_status
                    FROM tbl_inventory_stock_status
                    WHERE deletestatus = 'Active'
                      AND busunitcode = :busunitcode
                    ORDER BY seq ASC";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
            $stmt->execute();

            $data = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $data[] = $row;
            }

            return $data;

        } catch (Exception $e) {
            echo json_encode(["message" => "Read error"]);
            exit;
        }
    }

    // ✅ PATCH upsert: if exists -> update inv_status; else -> insert new row
    public function upsertStatusForUser($user_id, $data)
    {
        $inv_code = $data["inv_code"];
        $busunitcode = $data["busunitcode"];
        $inv_status = strtoupper(trim($data["inv_status"] ?? "ON"));
        if ($inv_status !== "OFF") $inv_status = "ON";

        try {
            // check if active row exists
            $checkSql = "SELECT COUNT(*) as count
                         FROM tbl_inventory_stock_status
                         WHERE inv_code = :inv_code
                           AND busunitcode = :busunitcode
                           AND deletestatus = 'Active'";

            $checkStmt = $this->conn->prepare($checkSql);
            $checkStmt->bindValue(":inv_code", $inv_code, PDO::PARAM_STR);
            $checkStmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
            $checkStmt->execute();
            $rowCount = (int) $checkStmt->fetchColumn();

            if ($rowCount > 0) {
                // update
                $sql = "UPDATE tbl_inventory_stock_status
                        SET inv_status = :inv_status,
                            usertracker = :usertracker
                        WHERE inv_code = :inv_code
                          AND busunitcode = :busunitcode
                          AND deletestatus = 'Active'";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":inv_status", $inv_status, PDO::PARAM_STR);
                $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $stmt->bindValue(":inv_code", $inv_code, PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
                $stmt->execute();

                echo json_encode(["message" => "Edited"]);
                return $stmt->rowCount();
            } else {
                // insert
                $sql = "INSERT INTO tbl_inventory_stock_status
                        (seq, inv_code, busunitcode, inv_status, deletestatus, usertracker, createdtime)
                        VALUES
                        (default, :inv_code, :busunitcode, :inv_status, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":inv_code", $inv_code, PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
                $stmt->bindValue(":inv_status", $inv_status, PDO::PARAM_STR);
                $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();

                echo json_encode(["message" => "Success"]);
                return $stmt->rowCount();
            }

        } catch (Exception $e) {
            echo json_encode(["message" => "Mutation error"]);
            exit;
        }
    }
}
