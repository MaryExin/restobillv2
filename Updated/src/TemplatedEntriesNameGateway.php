<?php

class TemplatedEntriesNameGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getTemplatedEntriesName($data)
    {

        try {

            // $sql = "SELECT * FROM lkp_templated_entries
            //             WHERE chart_type_id = :chartypeid
            //             AND template_id = :templateID
            //             GROUP BY chart_type_id, template_name 
            //             ORDER BY chart_type_id, template_id, template_name ASC";

            // $sql = "SELECT ent.chart_type_id, ent.template_id, ent.template_name, ent.glcode, ent.slcode, ent.debit_credit, 
            //             coa.gl_description, coa.sl_description 
            //             FROM lkp_templated_entries ent, lkp_chart_of_accounts coa
            //             WHERE ent.slcode = coa.slcode
            //             AND chart_type_id = :chartypeid
            //             AND template_id = :templateID
            //             GROUP BY chart_type_id, template_name 
            //             ORDER BY chart_type_id, template_id, template_name ASC";

            $sql = "SELECT ent.chart_type_id, ent.template_id, ent.template_name, ent.glcode, ent.slcode, ent.debit_credit, 
               coa.gl_description, coa.sl_description 
        FROM lkp_templated_entries ent
        JOIN lkp_chart_of_accounts coa
        ON ent.slcode = coa.slcode
        WHERE ent.chart_type_id = :chartypeid
          AND ent.template_id = :templateID
        GROUP BY ent.chart_type_id, ent.template_id, ent.template_name, ent.glcode, ent.slcode, ent.debit_credit, 
                 coa.gl_description, coa.sl_description
        ORDER BY ent.chart_type_id, ent.template_id, ent.template_name ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":chartypeid", $data["chartypeid"], PDO::PARAM_STR);
            $stmt->bindValue(":templateID", $data["templateID"], PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (PDOException $e) {

            // Handle database errors

            // For example, you can log the error or throw a custom exception

            // Log error

            error_log("Database error: " . $e->getMessage());

            // Or throw a custom exception

            throw new Exception("Database error occurred");

        } catch (Exception $e) {

            // Handle other types of errors

            // For example, you can log the error or re-throw it

            // Log error

            error_log("Error: " . $e->getMessage());

            // Re-throw the exception to let the caller handle it

            throw $e;

        }

    }

}
