<?php

class SyncGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($unit_code)
    {

        try {

            $sql = "SELECT DISTINCT
                            t1.build_code as product_id ,t5.brand_name as category_code,t4.busunitcode as unit_code,'PRODUCT' as inventory_type ,t1.category as item_category,t1.desc as item_name, t1.uom,t2.cost_per_uom, t2.srp,t1.tax_type as vatable ,t1.deletestatus as status
                        FROM
                            lkp_build_of_products AS t1
                                LEFT JOIN
                            tbl_pricing_details AS t2 ON t1.build_code = t2.inv_code
                        		LEFT JOIN
                        	tbl_pricing_by_sales_type AS t3 ON t2.pricing_code = t3.pricing_category 
                        		LEFT JOIN
                        	lkp_busunits AS t4 ON t3.busunitcode = t4.busunitcode
                            	LEFT JOIN
                        	lkp_brands AS t5 ON t4.brandcode = t5.brand_code
                            WHERE t4.busunitcode = :unitcode";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindParam(':unitcode', $unit_code, PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

   


}
