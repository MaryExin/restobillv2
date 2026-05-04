<?php

class ExcelCSVDownloadDiscounts
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function downloadCSV($data)
    {

        try {

            $query = "SELECT tbl_discounts.seq, tbl_discounts.transdate,  tbl_discounts.discount_id,
                tbl_discounts.discount_type_id, lkp_discounts.description,
                tbl_discounts.amount, tbl_discounts.discount_ref_no,
                tbl_discounts.sales_id, tbl_discounts.usertracker, tbl_discounts.deletestatus,
                tbl_discounts.createdtime
                FROM tbl_discounts
                LEFT OUTER JOIN lkp_discounts ON  tbl_discounts.discount_type_id = lkp_discounts.discount_type_id
                WHERE tbl_discounts.deletestatus = 'Active'
                AND tbl_discounts.transdate BETWEEN :dateFrom AND :dateTo
                ORDER BY tbl_discounts.seq ASC";

            // Prepare the query

            $stmt = $this->conn->prepare($query);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->execute();

            if ($stmt->rowCount() > 0) {

                // Set headers for CSV download

                header("Content-type: text/csv");

                header("Content-Disposition: attachment; filename=salesdiscount.csv");

                header("Pragma: no-cache");

                header("Expires: 0");

                // Create a file pointer

                $output = fopen("php://output", "w");

                // Fetch the column names dynamically

                $columnNames = array();

                for ($i = 0; $i < $stmt->columnCount(); $i++) {

                    $columnMeta = $stmt->getColumnMeta($i);

                    $columnNames[] = $columnMeta['name'];

                }

                // Write the header row to the CSV file

                fputcsv($output, $columnNames);

                // Loop through the database results and write to the CSV file

                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                    fputcsv($output, $row);

                }

                // Close the file pointer

                fclose($output);

                // echo json_encode(["message" => "CSVSuccess"]);

            } else {

                echo json_encode(["message" => "No data fetched"]);

            }

        } catch (PDOException $e) {

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

}
