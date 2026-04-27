<?php

class ClosingEntriesGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getClosingEntries($data)
    {

        try {

            // $sql = "SELECT glcode, slcode, SUM(amount) as newAmount  FROM tbl_accounting_transactions
            //             WHERE busunitcode = :busunitcode
            //             AND (document_date BETWEEN :datefrom AND :dateTo) 
            //             AND approvalstatus ='Posted'
            //             AND menutransacted <> '/closingentries'
            //             AND glcode >= '700'
            //             GROUP BY glcode, slcode
            //             ORDER BY glcode, slcode ASC";

            $sql = "SELECT glcode, slcode, SUM(amount)*-1 as newAmount from tbl_accounting_transactions
                    WHERE busunitcode = :busunitcode
                    AND approvalstatus ='Posted'
                    AND menutransacted <> '/closingentries'
                    AND document_date BETWEEN :datefrom AND :dateto 
                    AND glcode >= 700
                    GROUP BY glcode, slcode
                    ORDER BY glcode, slcode ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
            $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);
            $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);


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
