<?php

class ThemeSettingsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM tbl_user_settings
            WHERE deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

   
    public function createForUser($user_id, $data)
    {

        try {
            $this->conn->beginTransaction();
        
            // Check if the userid already exists
            $checkSql = "SELECT COUNT(*) FROM tbl_user_settings WHERE userid = :userid AND deletestatus = 'Active'";
            $checkStmt = $this->conn->prepare($checkSql);
            $checkStmt->bindValue(":userid", $user_id, PDO::PARAM_STR);
            $checkStmt->execute();
            $exists = $checkStmt->fetchColumn() > 0;
        
            if ($exists) {
                // If exists, update the theme
                $updateSql = "UPDATE tbl_user_settings 
                              SET theme = :theme, 
                                  usertracker = :user_tracker, 
                                  createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
                              WHERE userid = :userid AND deletestatus = 'Active'";
                $stmt = $this->conn->prepare($updateSql);
            } else {
                // If not, insert a new record
                $insertSql = "INSERT INTO tbl_user_settings () 
                              VALUES (default, :userid, :theme, 'Active', :user_tracker, DATE_ADD(NOW(),INTERVAL 8 HOUR))";
                $stmt = $this->conn->prepare($insertSql);
            }
        
            $stmt->bindValue(":userid", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":theme", $data["theme"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();
        
            $this->conn->commit();
        
            echo json_encode(["message" => "Success"]);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            http_response_code(500);
            echo json_encode([
                "message" => "Failed to save user settings.",
                "error" => $e->getMessage()
            ]);
        }
        

    }

  
    public function editData($user_id, $data)
    {

        $id = $data["buildCode"];

        $sql = "UPDATE lkp_build_of_products SET `desc` = :buildName, build_qty = :quantity, uomval = :uomVal,

                uom = :uom, level = :productLevel, tax_type = :taxType,  category = :category,

                expiry_days = :expiry, portion_parent = :parentProduct

                    WHERE build_code = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":buildName", $data["buildName"], PDO::PARAM_STR);

        $stmt->bindValue(":quantity", $data["quantity"], PDO::PARAM_STR);

        $stmt->bindValue(":uomVal", $data["uomVal"], PDO::PARAM_STR);

        $stmt->bindValue(":uom", $data["uom"], PDO::PARAM_STR);

        $stmt->bindValue(":productLevel", $data["productLevel"], PDO::PARAM_STR);

        $stmt->bindValue(":taxType", $data["taxType"], PDO::PARAM_STR);

        $stmt->bindValue(":category", $data["category"], PDO::PARAM_STR);

        $stmt->bindValue(":expiry", $data["expiry"], PDO::PARAM_STR);

        $stmt->bindValue(":parentProduct", $data["parentProduct"], PDO::PARAM_STR);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function deleteData($user_id, $data)
    {

        $sql = "UPDATE lkp_build_of_products



                SET



                    deletestatus = 'Inactive',



                    usertracker  = :usertracker



                WHERE



                      build_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

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
