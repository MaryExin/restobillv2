<?php

class ExcelCSVDownloadInventory
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function downloadCSV($data)
    {

        try {

            $query = "SELECT DISTINCT



                    trans_date, IF(parent_level = tbl_inventory_filtered.level AND parent_inv <> '', parent_inv, tbl_inventory_filtered.inv_code) AS inv_code,



                    IF(LEFT(tbl_inventory_filtered.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as description,



                    SUM(tbl_inventory_filtered.qty *  tbl_inventory_filtered.uom_val) AS running_uom_val,



                    tbl_inventory_filtered.uom, SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom) AS running_cost_per_uom,



                    tbl_inventory_filtered.pr_queue_code,



                    tbl_inventory_filtered.busunitcode, tbl_inventory_filtered.name, tbl_inventory_filtered.level, tbl_inventory_filtered.inv_class,



                    lkp_area.area_code, lkp_area.area_name, lkp_stock_levels.min_stock_level



                    FROM



                    (SELECT DISTINCT tbl_inventory_transactions.trans_date, tbl_inventory_transactions.inv_code,



IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as description,



IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.rawmats_parent, lkp_build_of_products.portion_parent) as parent_inv,



IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) as parent_level,



tbl_inventory_transactions.qty, tbl_inventory_transactions.cost_per_uom, tbl_inventory_transactions.uom_val,



tbl_inventory_transactions.uom, tbl_inventory_transactions.pr_queue_code, tbl_inventory_transactions.busunitcode,



lkp_busunits.name, lkp_busunits.pricing_category, lkp_busunits.class AS level, tbl_inventory_transactions.inv_class, lkp_busunits.areacode



FROM



tbl_inventory_transactions



LEFT OUTER JOIN lkp_raw_mats ON  tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code



LEFT OUTER JOIN lkp_build_of_products ON  tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code



LEFT OUTER JOIN lkp_busunits ON  tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode



LEFT OUTER JOIN tbl_pricing_details ON  lkp_busunits.pricing_category = tbl_pricing_details.pricing_code



AND tbl_pricing_details.inv_code = tbl_inventory_transactions.inv_code



WHERE tbl_inventory_transactions.deletestatus = 'Active'



AND lkp_busunits.name  IS NOT NULL) AS tbl_inventory_filtered



                        LEFT OUTER JOIN lkp_raw_mats ON  tbl_inventory_filtered.inv_code = lkp_raw_mats.mat_code



                        LEFT OUTER JOIN lkp_build_of_products ON  tbl_inventory_filtered.inv_code = lkp_build_of_products.build_code



                        LEFT OUTER JOIN lkp_area ON  tbl_inventory_filtered.areacode = lkp_area.area_code



					    LEFT OUTER JOIN lkp_stock_levels ON  tbl_inventory_filtered.inv_code = lkp_stock_levels.inv_code



                        AND tbl_inventory_filtered.busunitcode = lkp_stock_levels.level



					WHERE tbl_inventory_filtered.busunitcode LIKE :busunitcode



                    AND lkp_area.area_code LIKE :areacode



                    AND tbl_inventory_filtered.trans_date BETWEEN :dateFrom AND :dateTo



                    GROUP BY tbl_inventory_filtered.level, IF(parent_level = tbl_inventory_filtered.level AND parent_inv <> '', parent_inv, tbl_inventory_filtered.inv_code)



                    ORDER BY tbl_inventory_filtered.level, IF(LEFT(tbl_inventory_filtered.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) ASC";

            // Prepare the query

            $stmt = $this->conn->prepare($query);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->execute();

            if ($stmt->rowCount() > 0) {

                // Set headers for CSV download

                header("Content-type: text/csv");

                header("Content-Disposition: attachment; filename=inventory.csv");

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
