<?php

class TemplatedEntriesListGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT ent.chart_type_id, ent.template_id, ent.template_name, ent.trans_type, ent.glcode, ent.slcode, ent.debit_credit, 
                     coa.gl_description, coa.sl_description 
                FROM lkp_templated_entries ent
                JOIN lkp_chart_of_accounts coa
                ON ent.slcode = coa.slcode
                WHERE ent.deletestatus = 'Active'
                GROUP BY ent.chart_type_id, ent.template_id, ent.template_name, ent.trans_type, ent.glcode, ent.slcode, ent.debit_credit, 
                        coa.gl_description, coa.sl_description
                ORDER BY ent.chart_type_id, ent.template_id, ent.template_name ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

       public function deleteForUser($user_id, $data)
    {

        $sql = "DELETE FROM lkp_templated_entries WHERE template_id = :template_id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":template_id", $data["template_id"], PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);

    }

    public function createForUser($user_id, $data)
    {
        try {

            $sql = "SELECT * FROM lkp_templated_entries
            WHERE deletestatus = 'Active'
            AND chart_type_id = :chart_type_id
            AND template_name = :template_name";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["templates"] as $template) {
                $stmt->bindValue(":chart_type_id", $data["chart_type_id"], PDO::PARAM_STR);
                $stmt->bindValue(":template_name", $data["template_name"], PDO::PARAM_STR);
                $stmt->execute();

                $rowCount = $stmt->rowCount();
                    
                if ($rowCount > 0) {
                    echo json_encode(["message" => "Duplicate"]);
                    exit;
                }

            }

            $sql = "INSERT INTO lkp_templated_entries ()
                VALUES (default, :chart_type_id, :template_id, :template_name, :trans_type, :glcode, :slcode, :debit_credit,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $randomString = substr(bin2hex(random_bytes(6)), 0, 12);
            $shortUuid = "TE-" . $randomString;

            foreach ($data["templates"] as $template) {
                $stmt->bindValue(":chart_type_id", $data["chart_type_id"], PDO::PARAM_STR);
                $stmt->bindValue(":template_id", $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":template_name", $template["templateName"], PDO::PARAM_STR);
                $stmt->bindValue(":trans_type", $template["transType"], PDO::PARAM_STR);
                $stmt->bindValue(":glcode", $template["glCode"], PDO::PARAM_INT);
                $stmt->bindValue(":slcode", $template["slCode"], PDO::PARAM_INT);
                $stmt->bindValue(":debit_credit", $template["entryType"], PDO::PARAM_INT);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }

            echo json_encode(["message" => "Success"]);
        } catch (PDOException $e) {
            echo json_encode(["error" => "Database error: " . $e->getMessage()]);
        } catch (Exception $e) {
            echo json_encode(["error" => "An error occurred: " . $e->getMessage()]);
        }
    }

}
