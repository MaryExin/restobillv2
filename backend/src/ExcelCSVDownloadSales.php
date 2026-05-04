<?php

class ExcelCSVDownloadSales
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function downloadCSV($data)
    {

        try {

            $query = "SELECT tbl_sales_transactions.transdate, tbl_sales_summary.busunitcode,

            lkp_busunits.name, lkp_busunits.areacode, lkp_area.area_name,

            tbl_sales_transactions.inv_code, lkp_build_of_products.desc, tbl_sales_transactions.total_sales,

            tbl_sales_transactions.srp, tbl_sales_transactions.uomval, tbl_sales_transactions.uom,

            tbl_sales_transactions.qty, tbl_sales_transactions.discount_amount, tbl_sales_transactions.sales_id,

            tbl_sales_transactions.sales_trans_id, tbl_sales_transactions.createdtime

            FROM tbl_sales_transactions

            LEFT OUTER JOIN lkp_build_of_products

            ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code

            LEFT OUTER JOIN tbl_sales_summary

            ON tbl_sales_transactions.sales_trans_id = tbl_sales_summary.sales_trans_id

            LEFT OUTER JOIN lkp_busunits

            ON  tbl_sales_summary.busunitcode = lkp_busunits.busunitcode

            LEFT OUTER JOIN lkp_area

            ON  lkp_busunits.areacode = lkp_area.area_code

            WHERE tbl_sales_transactions.deletestatus = 'Active'

            AND tbl_sales_transactions.transdate BETWEEN :dateFrom AND :dateTo

            ORDER BY tbl_sales_transactions.transdate ASC";

            // Prepare the query

            $stmt = $this->conn->prepare($query);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->execute();

            if ($stmt->rowCount() > 0) {

                // Set headers for CSV download

                header("Content-type: text/csv");

                header("Content-Disposition: attachment; filename=salestransactions.csv");

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
