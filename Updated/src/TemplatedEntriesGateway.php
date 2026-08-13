<?php

class TemplatedEntriesGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getTemplatedEntries($data)
    {

        try {

            $sql = "SELECT * FROM lkp_templated_entries
                        WHERE chart_type_id = :chartypeid
                        GROUP BY chart_type_id, template_name 
                        ORDER BY chart_type_id, template_id, template_name ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":chartypeid", $data["chartypeid"], PDO::PARAM_STR);

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
