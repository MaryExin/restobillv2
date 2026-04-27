<?php

class PhysicalInventoryGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_supplier WHERE deletestatus = 'Active' ORDER BY supplier_name";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_supplier Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function createForUser($user_id, $data)
    {

        $sql = "INSERT INTO lkp_supplier ()

                VALUES (default, CONCAT('SP-',ShortUUID()), :supplier_name, :tin,

                :address, :atc, :whtx_rate, :product_type, :pricingcategory,'Active',

                :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":supplier_name", $data["supplier_name"], PDO::PARAM_STR);

        $stmt->bindValue(":tin", $data["tin"], PDO::PARAM_STR);

        $stmt->bindValue(":address", $data["address"], PDO::PARAM_STR);

        $stmt->bindValue(":atc", $data["atc"], PDO::PARAM_STR);

        $stmt->bindValue(":whtx_rate", $data["whtx_rate"], PDO::PARAM_STR);

        $stmt->bindValue(":product_type", $data["product_type"], PDO::PARAM_STR);

        $stmt->bindValue(":pricingcategory", $data["pricingcategory"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);

    }

    public function rejectsuppliers($user_id, string $id)
    {

        $sql = "UPDATE lkp_supplier

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      supplier_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function editsupplier($user_id, $id)
    {

        $suppliercode = $id["supplier_code"];

        // $supplierid = join($suppliercode);

        $sql = "UPDATE lkp_supplier

                SET

                    supplier_name  = :supplier_name,

                    tin  = :tin,

                    address  = :address,

                    atc  = :atc,

                    whtx_rate  = :whtx_rate,

                    product_type  = :product_type,

                    pricing_category  = :pricingcategory,

                    usertracker  = :usertracker

                WHERE

                      supplier_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":supplier_name", $id["supplier_name"], PDO::PARAM_STR);

        $stmt->bindValue(":tin", $id["tin"], PDO::PARAM_STR);

        $stmt->bindValue(":address", $id["address"], PDO::PARAM_STR);

        $stmt->bindValue(":atc", $id["atc"], PDO::PARAM_STR);

        $stmt->bindValue(":whtx_rate", $id["whtx_rate"], PDO::PARAM_STR);

        $stmt->bindValue(":product_type", $id["product_type"], PDO::PARAM_STR);

        $stmt->bindValue(":pricingcategory", $id["pricingcategory"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $suppliercode, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function updateForUser($user_id, $data)
    {

           

                    $this->conn->beginTransaction();


                    $sql = "SELECT * FROM tbl_accounting_period
                    WHERE busunitcode = :busunitcode 
                    AND accounting_period >= :transdate";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);

                    $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);


                    $stmt->execute();

                    $rowCount = $stmt->rowCount();

                    if($rowCount > 0)
                    {
                       echo json_encode(["message" => "Date Already Closed!"]);
                       exit;
                    }

                    // Check if the record exists

                    $entries = $this->getEntries($user_id, $data);

                    $slcode = $entries['slcode'];
                    $glcode = $entries['glcode']; 
                    $cost_per_uom = $entries['cost_per_uom'];
                    $particulars = $entries['particulars'];


                    $sql = "SELECT * FROM tbl_physical_count

                        WHERE deletestatus = 'Active'

                        AND transdate = :transdate

                        AND busunitcode = :busunitcode

                        AND inv_code = :inv_code";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);

                    $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);

                    $stmt->execute();

                    $rowCount = $stmt->rowCount();

                    if ($rowCount > 0) {

                        // Update existing record



                        $updateSql = "UPDATE tbl_physical_count

                                SET count = :count,

                                usertracker = :user_tracker

                                WHERE busunitcode = :busunitcode

                                AND inv_code = :inv_code

                                AND transdate = :transdate";

                        $updateStmt = $this->conn->prepare($updateSql);

                        $updateStmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);

                        $updateStmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                        $updateStmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);

                        $updateStmt->bindValue(":count", $data["count"], PDO::PARAM_STR);

                        $updateStmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                        $updateStmt->execute();

                    } else {

                        // Insert new record

                        $insertSql = "INSERT INTO tbl_physical_count ()

                                VALUES (default, :transdate, :busunitcode, :inv_code,

                                :count, 'Active', :user_tracker,

                                DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                        $insertStmt = $this->conn->prepare($insertSql);

                        $insertStmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);

                        $insertStmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                        $insertStmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);

                        $insertStmt->bindValue(":count", $data["count"], PDO::PARAM_STR);

                        $insertStmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                        $insertStmt->execute();

                    }

                    //Get First inventory details

                    $invUomVal = [];
                    $invCostPerUom = [];
                    $invClass = [];

                    if (substr($data["inv_code"], 0, 2) === "BD") {
                        $sql = "SELECT T2.cost_per_uom, T3.uomval FROM lkp_busunits AS T1
                        JOIN tbl_pricing_details AS T2 ON T1.pricing_category = T2.pricing_code
                        JOIN lkp_build_of_products AS T3 ON T2.inv_code = T3.build_code
                        WHERE T2.inv_code = :inv_code AND T1.busunitcode = :busunitcode";
    
                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                        $stmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);
                        $stmt->execute();
    
                        $invDetails = $stmt->fetch(PDO::FETCH_ASSOC);
    
                        if ($invDetails) {
                            $invUomVal = $invDetails["uomval"];
                            $invCostPerUom = $invDetails["cost_per_uom"];
                            $invClass = "FG";
                        } else {
                            $invUomVal = 0;
                            $invCostPerUom = 0;
                            $invClass = "FG";
                        }

                    } else {
                        $sql = "SELECT T2.cost_per_uom, T3.uomval FROM lkp_busunits AS T1
                        JOIN tbl_pricing_details AS T2 ON T1.pricing_category = T2.pricing_code
                        JOIN lkp_raw_mats AS T3 ON T2.inv_code = T3.mat_code
                        WHERE T2.inv_code = :inv_code AND T1.busunitcode = :busunitcode";
    
                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                        $stmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);
                        $stmt->execute();
    
                        $invDetails = $stmt->fetch(PDO::FETCH_ASSOC);
    
                        if ($invDetails) {
                            $invUomVal = $invDetails["uomval"];
                            $invCostPerUom = $invDetails["cost_per_uom"];
                            $invClass = "FG";
                        } else {
                            $invUomVal = 0;
                            $invCostPerUom = 0;
                            $invClass = "FG";
                        }

                    }                   




                    $transdate = new DateTime($data["transdate"]);
                    $transdate->modify('+1 day');
                    $formattedTransdate = $transdate->format('Y-m-d');

                    $sql = "SELECT * FROM tbl_inventory_transactions

                    WHERE deletestatus = 'Active'

                    AND trans_date = :transdate

                    AND busunitcode = :busunitcode

                    AND inv_code = :inv_code";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":transdate", $formattedTransdate);

                    $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);

                    $stmt->execute();

                    $rowCount = $stmt->rowCount();

                    if ($rowCount > 0) 
                    {
                    
                    // Update Transaction in Inventory
                    $updateSql = "UPDATE tbl_inventory_transactions SET 
                    
                    qty = :countvariance,
                    
                    usertracker = :user_tracker,
                    
                    createddate = DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    
                    WHERE busunitcode = :busunitcode

                    AND inv_code = :inv_code

                    AND trans_date = :transdate";

                    $updateStmt = $this->conn->prepare($updateSql);

                    // Add 1 day for the transdate
                    if (isset($data["transdate"])) {
                        $transdate = new DateTime($data["transdate"]);
                        $transdate->modify('+1 day');
                        $formattedTransdate = $transdate->format('Y-m-d');
                    }
                    
                    $updateStmt->bindValue(":transdate", $formattedTransdate, PDO::PARAM_STR);
                    $updateStmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);
                    $updateStmt->bindValue(":countvariance", $data["countvariance"], PDO::PARAM_STR);
                    $updateStmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                    $updateStmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $updateStmt->execute();

                    $amount = $data["countvariance"] * $cost_per_uom;


                    
                    if($data["countvariance"] > 0)
                    {
                        // update entries ==============================================================
                        $sql = "UPDATE tbl_accounting_transactions SET document_date = :document_date, amount = :amount
                        WHERE transdate = :transdate AND glcode = :glcode AND slcode = :slcode AND particulars = :particulars
                        AND busunitcode = :busunitcode";

                        $stmt = $this->conn->prepare($sql);

                        $stmt->bindValue(":document_date", $data["transdate"]);

                        $stmt->bindValue(":amount", $amount);

                        $stmt->bindValue(":transdate", $data["transdate"]);

                        $stmt->bindValue(":glcode", $glcode);

                        $stmt->bindValue(":slcode", $slcode);

                        $stmt->bindValue(":particulars", $particulars);

                        $stmt->bindValue(":busunitcode", $data["busunitcode"]);

                        $stmt->execute();

                        //debit entry
                        $sql = "UPDATE tbl_accounting_transactions SET document_date = :document_date, amount = :amount
                        WHERE transdate = :transdate AND glcode = :glcode AND slcode = :slcode AND particulars = :particulars
                        AND busunitcode = :busunitcode";

                        $stmt = $this->conn->prepare($sql);

                        $stmt->bindValue(":document_date", $data["transdate"]);

                        $stmt->bindValue(":amount", -1 * $amount);

                        $stmt->bindValue(":transdate", $data["transdate"]);

                        $stmt->bindValue(":glcode", 495);

                        $stmt->bindValue(":slcode", 49501);

                        $stmt->bindValue(":particulars", 'INVENTORY CLEARING - ' . $particulars);

                        $stmt->bindValue(":busunitcode", $data["busunitcode"]);

                        $stmt->execute();
                    }
                    else
                    {

                        
                        //debit entry
                        $sql = "UPDATE tbl_accounting_transactions SET document_date = :document_date, amount = :amount
                        WHERE transdate = :transdate AND glcode = :glcode AND slcode = :slcode AND particulars = :particulars
                        AND busunitcode = :busunitcode";

                        $stmt = $this->conn->prepare($sql);

                        $stmt->bindValue(":document_date", $data["transdate"]);

                        $stmt->bindValue(":amount", -1 * $amount);

                        $stmt->bindValue(":transdate", $data["transdate"]);

                        $stmt->bindValue(":glcode", 495);

                        $stmt->bindValue(":slcode", 49501);

                        $stmt->bindValue(":particulars", 'INVENTORY CLEARING - ' . $particulars);

                        $stmt->bindValue(":busunitcode", $data["busunitcode"]);

                        $stmt->execute();      

                        $rowsAffected = $stmt->rowCount();


                        
                        $sql = "UPDATE tbl_accounting_transactions SET document_date = :document_date, amount = :amount
                        WHERE transdate = :transdate AND glcode = :glcode AND slcode = :slcode AND particulars = :particulars
                        AND busunitcode = :busunitcode";
                        $stmt = $this->conn->prepare($sql);

                        $stmt->bindValue(":document_date", $data["transdate"]);

                        $stmt->bindValue(":amount", $amount);

                        $stmt->bindValue(":transdate", $data["transdate"]);

                        $stmt->bindValue(":glcode", $glcode);

                        $stmt->bindValue(":slcode", $slcode);

                        $stmt->bindValue(":particulars", $particulars);

                        $stmt->bindValue(":busunitcode", $data["busunitcode"]);

                        $stmt->execute();

                        $rowsAffected = $stmt->rowCount();


            
                    }
                    

                    }
                    else
                    {

                    // Add Transaction to Inventory
                    
                    $insertSql = "INSERT INTO tbl_inventory_transactions ()

                    VALUES (default, :transdate, :inv_code,

                    :countvariance, :cost_per_uom,  :uomval, :uom,  'Physical',

                    :busunitcode, :inv_class, '',

                    'Active', :user_tracker,

                    DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $insertStmt = $this->conn->prepare($insertSql);

                    //Add 1 day for the transdate
                    if (isset($data["transdate"])) {
                    $transdate = new DateTime($data["transdate"]);
                    $transdate->modify('+1 day');
                    $formattedTransdate = $transdate->format('Y-m-d');}

                    $insertStmt->bindValue(":transdate", $formattedTransdate, PDO::PARAM_STR);

                    $insertStmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);

                    $insertStmt->bindValue(":countvariance", $data["countvariance"], PDO::PARAM_STR);

                    $insertStmt->bindValue(":cost_per_uom", $invCostPerUom, PDO::PARAM_STR);

                    $insertStmt->bindValue(":uomval", $invUomVal, PDO::PARAM_STR);

                    $insertStmt->bindValue(":uom", $data["uom"], PDO::PARAM_STR);

                    $insertStmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                    $insertStmt->bindValue(":inv_class", $invClass, PDO::PARAM_STR);

                    $insertStmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $insertStmt->execute();

                    //accounting entries

                    if($data["countvariance"] > 0)
                    {
                            $sql = "INSERT INTO tbl_accounting_transactions ()
                            VALUES (default, :transdate, :document_date, :glcode, :slcode, :amount, :particulars,
                                    'Auto', 'Auto', 'Posted', '', '', '', '', '', '', 'Inventory', 'Inventory', '/inventoryusage',
                                    :busunitcode, '', '', '', '', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    $amount = $data["countvariance"] * $cost_per_uom;

                    $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);
                    $stmt->bindValue(":document_date", $data["transdate"], PDO::PARAM_STR);
                    $stmt->bindValue(":glcode", $glcode);
                    $stmt->bindValue(":slcode", $slcode);
                    $stmt->bindValue(":amount", $amount);
                    $stmt->bindValue(":particulars", $particulars);
                    $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                    $stmt->bindValue(":user_tracker", $user_id);

                    $stmt->execute();

                    //CREDIT ACCOUNT ===============================
                    $sql = "INSERT INTO tbl_accounting_transactions ()
                    VALUES (default, :transdate, :document_date, :glcode, :slcode, :amount, :particulars,
                            'Auto', 'Auto', 'Posted', '', '', '', '', '', '', 'Inventory', 'Inventory', '/inventoryusage',
                            :busunitcode, '', '', '', '', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    $amount = $data["countvariance"] * $cost_per_uom;

                    $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);
                    $stmt->bindValue(":document_date", $data["transdate"], PDO::PARAM_STR);
                    $stmt->bindValue(":glcode", '495');
                    $stmt->bindValue(":slcode", '49501');
                    $stmt->bindValue(":amount", $amount * -1);
                    $stmt->bindValue(":particulars", 'INVENTORY CLEARING - ' . $particulars);
                    $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                    $stmt->bindValue(":user_tracker", $user_id);

                    $stmt->execute();
                    }
                    else
                    {
                        
                            $sql = "INSERT INTO tbl_accounting_transactions ()
                            VALUES (default, :transdate, :document_date, :glcode, :slcode, :amount, :particulars,
                                    'Auto', 'Auto', 'Posted', '', '', '', '', '', '', 'Inventory', 'Inventory', '/inventoryusage',
                                    :busunitcode, '', '', '', '', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
            
                    $stmt = $this->conn->prepare($sql);
                            
                    $amount = $data["countvariance"] * $cost_per_uom;
                            
                    $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);
                    $stmt->bindValue(":document_date", $data["transdate"], PDO::PARAM_STR);
                    $stmt->bindValue(":glcode", $glcode);
                    $stmt->bindValue(":slcode", $slcode);
                    $stmt->bindValue(":amount", $amount);
                    $stmt->bindValue(":particulars", $particulars);
                    $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                    $stmt->bindValue(":user_tracker", $user_id);
                            
                    $stmt->execute();
                            
                    //CREDIT ACCOUNT ===============================
                    $sql = "INSERT INTO tbl_accounting_transactions ()
                    VALUES (default, :transdate, :document_date, :glcode, :slcode, :amount, :particulars,
                            'Auto', 'Auto', 'Posted', '', '', '', '', '', '', 'Inventory', 'Inventory', '/inventoryusage',
                            :busunitcode, '', '', '', '', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
            
                    $stmt = $this->conn->prepare($sql);
                            
                    $amount = $data["countvariance"] * $cost_per_uom;
                            
                    $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);
                    $stmt->bindValue(":document_date", $data["transdate"], PDO::PARAM_STR);
                    $stmt->bindValue(":glcode", '495');
                    $stmt->bindValue(":slcode", '49501');
                    $stmt->bindValue(":amount", -1  * $amount);
                    $stmt->bindValue(":particulars", 'INVENTORY CLEARING - ' . $particulars);
                    $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                    $stmt->bindValue(":user_tracker", $user_id);
                            
                    $stmt->execute();
                    }


                    }


                    $log = "INSERT INTO tbl_logs ()
                    VALUES (default, 'LIGHTEM', :busunitcode, 'Inventory', 'Physical', :inv_code, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";
            
                    $logstmt = $this->conn->prepare($log);
            
                    $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);

                    $logstmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                    $logstmt->bindValue(":inv_code", $data["inv_code"], PDO::PARAM_STR);
            
                    $logstmt->execute();

                    $this->conn->commit();

                    echo json_encode(["message" => "Success"]);



    }

    public function deletedataWithIds($ids)
    {

        foreach ($ids as $id) {

            $sql = "DELETE FROM tbl_sales















                WHERE uuid = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_STR);

            $stmt->execute();

        }

        return $stmt->rowCount();

    }

    private function getEntries($user_id, array $data)
    {
        $invCode = $data["inv_code"];

        // Check if the inv_code starts with "RM"
        if (strpos($invCode, 'RM') === 0) {
            // Query for lkp_raw_mats
            $sql = "SELECT T1.category, T1.desc, T2.cost_per_uom FROM lkp_raw_mats AS T1
                    LEFT OUTER JOIN tbl_pricing_details AS T2 ON T1.mat_code = T2.inv_code
                    LEFT OUTER JOIN lkp_pricing_code AS T3 ON T2.pricing_code = T3.uuid
                    WHERE T2.inv_code = :inv_code";
        } else {
            // Query for lkp_build_of_products
            $sql = "SELECT T1.category, T1.desc, T2.cost_per_uom FROM lkp_build_of_products AS T1
                    LEFT OUTER JOIN tbl_pricing_details AS T2 ON T1.build_code = T2.inv_code
                    LEFT OUTER JOIN lkp_pricing_code AS T3 ON T2.pricing_code = T3.uuid
                    WHERE T2.inv_code = :inv_code";
        }

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        // If no row is found, and inv_code does not start with "RM", try the second query for lkp_raw_mats
        if (!$row && strpos($invCode, 'RM') !== 0) {
            $sql = "SELECT T1.category, T1.desc, T2.cost_per_uom FROM lkp_raw_mats AS T1
                    LEFT OUTER JOIN tbl_pricing_details AS T2 ON T1.mat_code = T2.inv_code
                    LEFT OUTER JOIN lkp_pricing_code AS T3 ON T2.pricing_code = T3.uuid
                    WHERE T2.inv_code = :inv_code";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
            $stmt->execute();

            $row = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // Set the category only if a row was found
        $category = $row ? $row['category'] : null;



        //select GLSL
        $sql = "SELECT * FROM lkp_slcodes
        WHERE sldescription LIKE :category
        LIMIT 1";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":category", '%' . 'Inventory - ' . $category . '%');

        $stmt->execute();

        $GLSL= $stmt->fetch(PDO::FETCH_ASSOC);

        

        return 
        [
            'glcode' => $GLSL['glcode'],
            'slcode' => $GLSL['slcodes'],
            
            'category' => $category,
            'particulars' => $row['desc'],
            'cost_per_uom' => $row['cost_per_uom'],  
        ];


    }

}
