<?php

class ExcelCSVDownload
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function downloadCSV()
    {
        try {
            // Query to select all data from tbl_sales_history
            $query = "SELECT * FROM tbl_sales_history LIMIT 1000000";

            // Prepare the query
            $stmt = $this->conn->prepare($query);

            // Execute the query
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                // Set headers for CSV download
                header("Content-type: text/csv");
                header("Content-Disposition: attachment; filename=saleshistory.csv");
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
