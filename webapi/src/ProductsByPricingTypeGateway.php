<?php

class ProductsByPricingTypeGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

   
    public function getProductsByPricingType($user_id, array $data)
    {
        try {

            $sql = "SELECT pricing_category FROM lkp_busunits
                        WHERE busunitcode = :busunitcode
                        AND deletestatus = 'Active';";

            $stmt = $this->conn->prepare($sql);
                        
            $stmt->bindValue(':busunitcode', $data["busunitcode"],     PDO::PARAM_STR);

            $stmt->execute();

            $pricingType = $stmt->fetchColumn();


            $sql = "SELECT 
                        t1.inv_code,
                        t2.desc,
                        t2.build_qty,
                        t2.uomval,
                        t2.uom,
                        t2.tax_type,
                        t2.category,
                        t1.cost_per_uom,
                        t1.srp
                    FROM
                        tbl_pricing_details AS t1
                            LEFT OUTER JOIN
                        lkp_build_of_products AS t2 ON t1.inv_code = t2.build_code
                            AND t2.deletestatus = 'Active'
                    WHERE
                        t1.pricing_code = :pricingtype
                            AND t1.deletestatus = 'Active'
                            AND LEFT(t1.inv_code,3) = 'BD-'
                    ORDER BY t2.desc ASC";
                  
            $stmt = $this->conn->prepare($sql);
            
            $stmt->bindValue(':pricingtype', $pricingType,     PDO::PARAM_STR);
           
            $stmt->execute();

       
          
            $result = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    
                $result[] = $row;
    
            }
    
            echo json_encode($result);

        } catch (PDOException $e) {
            throw new RuntimeException("DB Error: " . $e->getMessage());
        }
    }

    
    


}
