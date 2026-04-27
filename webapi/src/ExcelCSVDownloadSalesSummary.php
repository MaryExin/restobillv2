<?php

class ExcelCSVDownloadSalesSummary
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function downloadCSV($data)
    {

        try {

            $query = "SELECT tbl_sales_summary.sales_id,  tbl_sales_summary.transdate, tbl_sales_summary.busunitcode,
                lkp_busunits.name, tbl_sales_summary.sales_trans_id, tbl_sales_summary.cash_trans_id,
                tbl_sales_summary.mop_trans_id, tbl_sales_summary.sales_type_id,
                lkp_sales_type.description, tbl_sales_summary.discount_id,
                tbl_sales_summary.total_sales, tbl_sales_summary.total_vat, tbl_sales_summary.total_discounts,
                tbl_sales_summary.total_other_mop, tbl_sales_summary.net_sales, tbl_sales_summary.cash_received,
                tbl_sales_summary.change, tbl_sales_summary.net_cash, tbl_sales_summary.gender, tbl_sales_summary.age_bracket,
                tbl_sales_summary.usertracker, tbl_sales_summary.deletestatus, tbl_sales_summary.createdtime
                FROM tbl_sales_summary
                LEFT OUTER JOIN lkp_busunits ON tbl_sales_summary.busunitcode = lkp_busunits.busunitcode
                LEFT OUTER JOIN lkp_sales_type ON tbl_sales_summary.sales_type_id = lkp_sales_type.sales_type_id
                WHERE tbl_sales_summary.deletestatus = 'Active'
                AND tbl_sales_summary.transdate BETWEEN :dateFrom AND :dateTo
                ORDER BY tbl_sales_summary.transdate ASC";

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
