<?php

class SalesReturnGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($data)
    {

        $sql = "SELECT







                    tbl_products_queue.seq,tbl_products_queue.prd_queue_code,tbl_products_queue.inv_code,tbl_products_queue.cost_per_uom,







                    tbl_products_queue.uomval, tbl_products_queue.uom,tbl_products_queue.quantity,tbl_products_queue.total,







                    tbl_products_queue.transdate,tbl_products_queue.orderedby,tbl_products_queue.payee,tbl_products_queue.deletestatus,







                    tbl_products_queue.usertracker,tbl_products_queue.createdtime,orderedBy.name AS orderedbyname,payeeName.name AS payeename,







                    IF(LEFT(inv_code, 2) = 'RM',







                        lkp_raw_mats.desc,







                        lkp_build_of_products.desc) AS productname







                FROM







                    tbl_products_queue







                        LEFT OUTER JOIN







                    lkp_busunits AS orderedBy ON tbl_products_queue.orderedby = orderedBy.busunitcode







                        LEFT OUTER JOIN







                    lkp_busunits AS payeeName ON tbl_products_queue.payee = payeeName.busunitcode







                        LEFT OUTER JOIN







                    lkp_raw_mats ON tbl_products_queue.inv_code = lkp_raw_mats.mat_code







                        LEFT OUTER JOIN







                    lkp_build_of_products ON tbl_products_queue.inv_code = lkp_build_of_products.build_code







                WHERE







                    tbl_products_queue.deletestatus = 'Active'







                    AND tbl_products_queue.prd_queue_code = :prd_queue_code







                ORDER BY tbl_products_queue.createdtime DESC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":prd_queue_code", $data["prd_queue_code"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

public function getSalesReport($user_id, $data)
{
    // Determine the query condition based on whether 'busunitcode' and/or 'transdate' are provided
    if (empty($data["busunitcode"]) && empty($data["transdate"])) {
        // Both 'busunitcode' and 'transdate' are empty
        $query = null;
    } elseif (empty($data["busunitcode"])) {
        // Only 'busunitcode' is empty
        $query = "T2.transdate = :transdate";
    } elseif (empty($data["transdate"])) {
        // Only 'transdate' is empty
        $query = "T2.busunitcode = :busunitcode";
    } else {
        // Neither 'busunitcode' nor 'transdate' are empty
        $query = "T2.transdate = :transdate AND T2.busunitcode = :busunitcode";
    }

    // Construct the SQL query
    $sql = "SELECT CONCAT(T1.firstname, ' ', T1.middlename, ' ', T1.lastname) AS full_name,
                   SUM(T2.total_sales) AS total_sales,
                   SUM(T2.total_vat) AS total_vat,
                   SUM(T2.total_discounts) AS total_discount,
                   SUM(T2.total_other_mop) AS total_other_mop,
                   SUM(T2.net_sales - T2.total_vat - T2.total_discounts) AS total_net_sales,
                   SUM(T2.cash_received) AS total_cash_received,
                   SUM(T2.change) AS total_change,
                   SUM(T2.net_cash) AS total_net_cash
            FROM tbl_users_global_assignment AS T1
            JOIN tbl_sales_summary AS T2
            ON T1.uuid = T2.usertracker";

    // Add the WHERE clause if a query condition exists
    if ($query) {
        $sql .= " WHERE $query";
    }

    // Add the GROUP BY clause
    $sql .= " GROUP BY T1.uuid, T1.firstname, T1.middlename, T1.lastname";

    // Prepare the statement
    $stmt = $this->conn->prepare($sql);

    // Bind the appropriate value(s) based on the condition
    if (!empty($data["transdate"])) {
        $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);
    }
    if (!empty($data["busunitcode"])) {
        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
    }

    // Execute the statement
    $stmt->execute();

    // Fetch the result set
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Output the result as JSON
    echo json_encode($result);
}


    public function getAllDataBySummary($data)
    {

        if (isset($data["searchvalue"])) {

            $searchValue = $data["searchvalue"];

        } else {

            $searchValue = null;

        }

        // Convert the $data["busunits"] array into an array of role names

        $busunitRoles = array_map(function ($busunit) {

            return $busunit["rolename"];

        }, $data["busunits"]);

        // Convert the array of role names into a comma-separated string

        $busunitRolesString = implode("','", $busunitRoles);

        $pageIndex = $data["pageIndex"] * $data['pageItems'] - $data['pageItems'];

        $pageData = $data["pageItems"];

        if ($searchValue === null) {

            // Construct the SQL query

            $sql = "SELECT *, orderedBy.name AS orderedbyname, payeeName.name AS payeename







                                FROM tbl_products_queue_summary







                                LEFT OUTER JOIN lkp_busunits AS orderedBy







                                ON tbl_products_queue_summary.orderedby = orderedBy.busunitcode







                                LEFT OUTER JOIN lkp_busunits AS payeeName







                                ON tbl_products_queue_summary.payee = payeeName.busunitcode







                                WHERE tbl_products_queue_summary.deletestatus = 'Active'







                                AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))







                                ORDER BY tbl_products_queue_summary.createdtime DESC







                                LIMIT $pageIndex, $pageData";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } else {

            // Construct the SQL query

            $sql = "SELECT *, orderedBy.name AS orderedbyname, payeeName.name AS payeename







                                FROM tbl_products_queue_summary







                                LEFT OUTER JOIN lkp_busunits AS orderedBy







                                ON tbl_products_queue_summary.orderedby = orderedBy.busunitcode







                                LEFT OUTER JOIN lkp_busunits AS payeeName







                                ON tbl_products_queue_summary.payee = payeeName.busunitcode







                                WHERE tbl_products_queue_summary.deletestatus = 'Active'







                                AND prd_queue_code LIKE :searchvalue







                                AND (orderedby IN ('$busunitRolesString') OR payee IN ('$busunitRolesString'))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":searchvalue", '%' . $searchValue . '%', PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        }

    }

    public function getAllEditDataBySummary($data)
    {

        // Construct the SQL query

        $sql = "SELECT *, orderedBy.name AS orderedbyname, payeeName.name AS payeename







                                FROM tbl_products_queue_summary







                                LEFT OUTER JOIN lkp_busunits AS orderedBy







                                ON tbl_products_queue_summary.orderedby = orderedBy.busunitcode







                                LEFT OUTER JOIN lkp_busunits AS payeeName







                                ON tbl_products_queue_summary.payee = payeeName.busunitcode







                                WHERE tbl_products_queue_summary.deletestatus = 'Active'







                                AND prd_queue_code = :prd_queue_code







                                ORDER BY tbl_products_queue_summary.createdtime DESC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":prd_queue_code", $data["prd_queue_code"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT







                    buildcode,







                    lkp_build_of_products.desc,







                    componentname,







                    componentclass,







                    componentquantity







                FROM







                    (SELECT







                        tbl_build_components.build_code AS buildcode,







                            IF(LEFT(tbl_build_components.component_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS componentname,







                            tbl_build_components.component_class AS componentclass,







                            tbl_build_components.qty AS componentquantity







                    FROM







                        tbl_build_components







                    LEFT OUTER JOIN lkp_raw_mats ON tbl_build_components.component_code = lkp_raw_mats.mat_code







                    LEFT OUTER JOIN lkp_build_of_products ON tbl_build_components.component_code = lkp_build_of_products.build_code) tbl_build_summary







                        LEFT OUTER JOIN







                    lkp_build_of_products ON tbl_build_summary.buildcode = lkp_build_of_products.build_code







                ORDER BY lkp_build_of_products.desc ASC , componentname ASC







                LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getZReading($data)
    {

        $sql = "SELECT tbl_sales_transactions.transdate, tbl_sales_summary.busunitcode,



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

            AND tbl_sales_summary.busunitcode = :busunitcode


            ORDER BY tbl_sales_transactions.transdate ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

        $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getForUser($user_id, $id): array
    {

        $sql = "SELECT *















                FROM tbl_tasks















                WHERE id = :id















                AND user_id = :user_id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_INT);

        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

        $stmt->execute();

        $data = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($data !== false) {

            $data['is_completed'] = (bool) $data['is_completed'];

        }

        return $data;

    }

    public function createForUser($user_id, $data, $shortUuid)
    {

        try {

            $this->conn->beginTransaction();

            // TBL_INVENTORY_TRANSACTIONS

            if($data["returntype"] === "damaged"){
            $sql = "INSERT INTO tbl_accounting_transactions ()
            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) , DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) ,
            :glcodes, :slcodes, :amounts, 'SALES  RETURN', :sales_id, 'AUTO', 'Posted', :customer_ids, '', '', '' , '', '', 'SALES',
            :transtype, '/salestracker', :busunits, '', '', '0', :dm_id, 'Active' , :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Payments

            foreach ($data["salessummary"] as $salessummarys) {

                $glcodes = substr($data["clearingaccount"], 0, 3);

                $stmt->bindValue(":glcodes", "810", PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", "81001", PDO::PARAM_STR);
                $stmt->bindValue(":amounts", $salessummarys["total_sales"], PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "DAMAGED", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();

                $stmt->bindValue(":glcodes", $glcodes, PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", $data["clearingaccount"], PDO::PARAM_STR);
                $stmt->bindValue(":amounts", $salessummarys["total_sales"]  * -1, PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "CLEARING ACCOUNT", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }

            foreach ($data["buildcomponentssummary"] as $buildcomponentssummary) {
                $stmt->bindValue(":glcodes", "811", PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", "81101", PDO::PARAM_STR);
                $stmt->bindValue(":amounts", $buildcomponentssummary["cost_per_uom"] * $buildcomponentssummary["qty"], PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "SPOILAGE", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();

                $catsql = "SELECT category FROM lkp_build_of_products WHERE build_code = :inv_codes AND deletestatus = 'Active'";
                $catstmt = $this->conn->prepare($catsql);
                $catstmt->bindValue(":inv_codes", $buildcomponentssummary["component_code"], PDO::PARAM_STR);
                $catstmt->execute();

                $sldesc = $catstmt->fetch(PDO::FETCH_ASSOC);

                foreach ($sldesc as $category) {
    $description = "COST OF SALES - " . $category;
    
    $checkslcodesql = "SELECT glcode, slcodes, sldescription 
                       FROM lkp_slcodes 
                       WHERE sldescription LIKE :sldescriptions 
                       AND deletestatus = 'Active'";
    $checkslcodestmt = $this->conn->prepare($checkslcodesql);
    $checkslcodestmt->bindValue(":sldescriptions", '%' . $description . '%', PDO::PARAM_STR);
    $checkslcodestmt->execute();
    $slcode = $checkslcodestmt->fetch(PDO::FETCH_ASSOC);

    // $categorycostofsale = $total_cost * -1;

    if ($slcode) {

        $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);
        $stmt->bindValue(":amounts", $buildcomponentssummary["cost_per_uom"] * $buildcomponentssummary["qty"] * -1, PDO::PARAM_STR);
        $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":transtype", "COST OF SALE", PDO::PARAM_STR);
        $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
        $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }
            }

            }
            }else if($data["returntype"] === "returned"){ 
            $sql = "INSERT INTO tbl_inventory_transactions ()
            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:inv_code, :qty, :cost_per_uom, :uom_val, :uom,
            :pr_queue_code, :busunitcode, :inv_class, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Components for Inventory Transactions

            foreach ($data["buildcomponentssummary"] as $component) {

                $stmt->bindValue(":inv_code", $component["component_code"], PDO::PARAM_STR);
                $stmt->bindValue(":qty", $component["qty"], PDO::PARAM_STR);
                $stmt->bindValue(":cost_per_uom", $component["cost_per_uom"], PDO::PARAM_STR);
                $stmt->bindValue(":uom_val", $component["uomval"], PDO::PARAM_STR);
                $stmt->bindValue(":uom", $component["uom"], PDO::PARAM_STR);
                $stmt->bindValue(":pr_queue_code", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":inv_class", "FG", PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }

            $sql = "INSERT INTO tbl_accounting_transactions ()
            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) , DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) ,
            :glcodes, :slcodes, :amounts, 'SALES  RETURN', :sales_id, 'AUTO', 'Posted', :customer_ids, '', '', '' , '', '', 'SALES',
            :transtype, '/salestracker', :busunits, '', '', '0', :dm_id, 'Active' , :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Payments

            foreach ($data["salessummary"] as $salessummarys) {

                $glcodes = substr($data["clearingaccount"], 0, 3);

                $stmt->bindValue(":glcodes", "810", PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", "81001", PDO::PARAM_STR);
                $stmt->bindValue(":amounts", $salessummarys["total_sales"], PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "DAMAGED", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();

                $stmt->bindValue(":glcodes", $glcodes, PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", $data["clearingaccount"], PDO::PARAM_STR);
                $stmt->bindValue(":amounts", $salessummarys["total_sales"]  * -1, PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "CLEARING ACCOUNT", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }

            foreach ($data["buildcomponentssummary"] as $buildcomponentssummary) {
                $catsql = "SELECT category FROM lkp_build_of_products WHERE build_code = :inv_codes AND deletestatus = 'Active'";
                $catstmt = $this->conn->prepare($catsql);
                $catstmt->bindValue(":inv_codes", $buildcomponentssummary["component_code"], PDO::PARAM_STR);
                $catstmt->execute();

                $sldesc = $catstmt->fetch(PDO::FETCH_ASSOC);

                foreach ($sldesc as $category) {
    $description = "INVENTORY - " . $category;
    
    $checkslcodesql = "SELECT glcode, slcodes, sldescription 
                       FROM lkp_slcodes 
                       WHERE sldescription LIKE :sldescriptions 
                       AND deletestatus = 'Active'";
    $checkslcodestmt = $this->conn->prepare($checkslcodesql);
    $checkslcodestmt->bindValue(":sldescriptions", '%' . $description . '%', PDO::PARAM_STR);
    $checkslcodestmt->execute();
    $slcode = $checkslcodestmt->fetch(PDO::FETCH_ASSOC);

    if ($slcode) {

        $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);
        $stmt->bindValue(":amounts", $buildcomponentssummary["cost_per_uom"] * $buildcomponentssummary["qty"], PDO::PARAM_STR);
        $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":transtype", "INVENTORY", PDO::PARAM_STR);
        $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
        $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }
            }

            

                $catsql = "SELECT category FROM lkp_build_of_products WHERE build_code = :inv_codes AND deletestatus = 'Active'";
                $catstmt = $this->conn->prepare($catsql);
                $catstmt->bindValue(":inv_codes", $buildcomponentssummary["component_code"], PDO::PARAM_STR);
                $catstmt->execute();

                $sldesc = $catstmt->fetch(PDO::FETCH_ASSOC);

                foreach ($sldesc as $category) {
    $description = "COST OF SALES - " . $category;
    
    $checkslcodesql = "SELECT glcode, slcodes, sldescription 
                       FROM lkp_slcodes 
                       WHERE sldescription LIKE :sldescriptions 
                       AND deletestatus = 'Active'";
    $checkslcodestmt = $this->conn->prepare($checkslcodesql);
    $checkslcodestmt->bindValue(":sldescriptions", '%' . $description . '%', PDO::PARAM_STR);
    $checkslcodestmt->execute();
    $slcode = $checkslcodestmt->fetch(PDO::FETCH_ASSOC);

    // $categorycostofsale = $total_cost * -1;

    if ($slcode) {

        $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);
        $stmt->bindValue(":amounts", $buildcomponentssummary["cost_per_uom"] * $buildcomponentssummary["qty"] * -1, PDO::PARAM_STR);
        $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":transtype", "COST OF SALE", PDO::PARAM_STR);
        $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
        $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }
            }

            }
            
            }

            $this->conn->commit();

            echo json_encode(["message" => "Success", "Transid" =>$shortUuid]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function fetchSalesId($user_id, $data)
    {

        $sql = "SELECT * FROM tbl_sales_transactions WHERE usertracker = :usertracker ORDER BY createdtime DESC LIMIT 1";
        
        $stmt = $this->conn->prepare($sql);
        
        $stmt->bindValue(':usertracker', $user_id);
        
        $stmt->execute();
        
        $salesId = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode(['sales_trans_id' => $salesId['sales_trans_id']]);

    }

    public function patchForUser($user_id, $data, $queueid)
    {

        try {

            $this->conn->beginTransaction();

            //Delete Existing Products

            $deleteProductssql = "DELETE FROM tbl_products_queue WHERE prd_queue_code=:queueid";

            $deleteProductsstmt = $this->conn->prepare($deleteProductssql);

            $deleteProductsstmt->bindValue(":queueid", $queueid, PDO::PARAM_STR);

            $deleteProductsstmt->execute();

            //Delete Existing Product Summary

            $deleteProductSummarysql = "DELETE FROM tbl_products_queue_summary WHERE prd_queue_code=:queueid";

            $deleteProductSummarystmt = $this->conn->prepare($deleteProductSummarysql);

            $deleteProductSummarystmt->bindValue(":queueid", $queueid, PDO::PARAM_STR);

            $deleteProductSummarystmt->execute();

            // First SQL statement

            $sql = "INSERT INTO tbl_products_queue ()







            VALUES (default, :prd_queue_code, :inv_code, :cost_per_uom, :uomval,:uom,







            :quantity, :total, :transdate, :orderedby, :payee,







            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["queueitems"] as $queueitem) {

                $stmt->bindValue(":prd_queue_code", $queueid, PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $queueitem["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $queueitem["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $queueitem["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $queueitem["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":quantity", $queueitem["quantity"], PDO::PARAM_INT);

                $stmt->bindValue(":total", $queueitem["total"], PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $queueitem["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":orderedby", $queueitem["orderedby"], PDO::PARAM_STR);

                $stmt->bindValue(":payee", $queueitem["payee"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // Second SQL statement

            $summarysql = "INSERT INTO tbl_products_queue_summary ()







            VALUES (default, :prd_queue_code, :subtotal, :orderedby, :payee,:pr_status, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







            null, :po_status, null, null, :production_status, null, null, :billing_status,







            null, null, :delivery_status, null,  null, null, :notes,







            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $summarystmt = $this->conn->prepare($summarysql);

            foreach ($data["queuestatus"] as $queuestatus) {

                $summarystmt->bindValue(":prd_queue_code", $queueid, PDO::PARAM_STR);

                $summarystmt->bindValue(":subtotal", $queuestatus["subtotal"], PDO::PARAM_STR);

                $summarystmt->bindValue(":orderedby", $queuestatus["orderedby"], PDO::PARAM_STR);

                $summarystmt->bindValue(":payee", $queuestatus["payee"], PDO::PARAM_STR);

                $summarystmt->bindValue(":pr_status", $queuestatus["pr_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":po_status", $queuestatus["po_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":production_status", $queuestatus["production_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":billing_status", $queuestatus["billing_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":delivery_status", $queuestatus["delivery_status"], PDO::PARAM_STR);

                $summarystmt->bindValue(":notes", $data["notes"], PDO::PARAM_STR);

                $summarystmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $summarystmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollback();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function deleteForUser($user_id, $data)
    {

        try {

            //Update table summary

            $sql = "UPDATE tbl_products_queue_summary







                SET







                    deletestatus = 'Inactive',







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

            $stmt->execute();

            //Update table details

            $sql = "UPDATE tbl_products_queue







                SET







                    deletestatus = 'Inactive',







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

            $stmt->execute();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function updateForUser($user_id, $data)
    {

        //Update PR Status when approved

        if ($data["transactiontype"] === "PR") {

            try {

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    pr_status = :status,







                    pr_approved_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    po_created_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "PO") {

            try {

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    po_status = :status,







                    po_approved_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "Production" && $data["status"] === "In Progress") {

            try {

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    production_status = :status,







                    production_started = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "Production" && $data["status"] === "Completed") {

            $this->conn->beginTransaction();

            try {

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    production_status = :status,







                    production_completed = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                // Triggeres when completed

                if ($data["status"] === "Completed") {

                    //Insert components in inventory transactions

                    $sql = "INSERT INTO tbl_inventory_transactions () VALUES







                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,







                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    foreach ($data["buildcomponents"] as $component) {

                        $class = substr($component["component_code"], 0, 2);

                        if ($class === "RM") {

                            $stmt->bindValue(":inv_code", $component["component_code"], PDO::PARAM_STR);

                            $stmt->bindValue(":qty", $component["qty"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":cost_per_uom", $component["cost_per_uom"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":uom_val", $component["uomval"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":uom", $component["uom"], PDO::PARAM_STR);

                            $stmt->bindValue(":pr_queue_code", $data["id"], PDO::PARAM_STR);

                            $stmt->bindValue(":busunitcode", $data["productsbuilt"][0]["payee"], PDO::PARAM_STR);

                            $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                            $stmt->execute();

                        } else {

                            $stmt->bindValue(":inv_code", $component["component_code"], PDO::PARAM_STR);

                            $stmt->bindValue(":qty", $component["qty"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":cost_per_uom", $component["cost_per_uom"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":uom_val", $component["uomval"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":uom", $component["uom"], PDO::PARAM_STR);

                            $stmt->bindValue(":pr_queue_code", $data["id"], PDO::PARAM_STR);

                            $stmt->bindValue(":busunitcode", $data["productsbuilt"][0]["payee"], PDO::PARAM_STR);

                            $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                            $stmt->execute();

                        }

                    }

                    //Insert main component in statement transactions

                    $sql = "INSERT INTO tbl_inventory_transactions () VALUES







                    (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :inv_code, :qty, :cost_per_uom,







                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    foreach ($data["productsbuilt"] as $product) {

                        $class = substr($product["inv_code"], 0, 2);

                        if ($class === "RM") {

                            $class = "RM";

                            $stmt->bindValue(":inv_code", $product["inv_code"], PDO::PARAM_STR);

                            $stmt->bindValue(":qty", $product["quantity"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":cost_per_uom", $product["cost_per_uom"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":uom_val", $product["uomval"] * -1, PDO::PARAM_STR);

                            $stmt->bindValue(":uom", $product["uom"], PDO::PARAM_STR);

                            $stmt->bindValue(":pr_queue_code", $data["id"], PDO::PARAM_STR);

                            $stmt->bindValue(":busunitcode", $data["productsbuilt"][0]["payee"], PDO::PARAM_STR);

                            $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                            $stmt->execute();

                        } else {

                            $class = "FG";

                            $stmt->bindValue(":inv_code", $product["inv_code"], PDO::PARAM_STR);

                            $stmt->bindValue(":qty", $product["quantity"], PDO::PARAM_STR);

                            $stmt->bindValue(":cost_per_uom", $product["cost_per_uom"], PDO::PARAM_STR);

                            $stmt->bindValue(":uom_val", $product["uomval"], PDO::PARAM_STR);

                            $stmt->bindValue(":uom", $product["uom"], PDO::PARAM_STR);

                            $stmt->bindValue(":pr_queue_code", $data["id"], PDO::PARAM_STR);

                            $stmt->bindValue(":busunitcode", $data["productsbuilt"][0]["payee"], PDO::PARAM_STR);

                            $stmt->bindValue(":inv_class", $class, PDO::PARAM_STR);

                            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                            $stmt->execute();

                        }

                    }

                }

                $this->conn->commit();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                $this->conn->rollBack();

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "Billing" && $data["status"] === "Unpaid") {

            try {

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    billing_status = :status,







                    production_started = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

        if ($data["transactiontype"] === "Billing" && ($data["status"] === "Partial" || $data["status"] === "Paid")) {

            try {

                $this->conn->beginTransaction();

                $sql = "UPDATE tbl_products_queue_summary







                SET







                    billing_status = :status,







                    payment_code = :payment_code,







                    usertracker = :user_tracker















                WHERE







                    prd_queue_code = :id";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

                $stmt->bindValue(":payment_code", "PC-" . $data["id"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

                $stmt->execute();

                //Insert payment details in statement transactions

                $sql = "INSERT INTO tbl_internal_billing_payments () VALUES







                    (default, :prd_queue_code, :payments, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),







                    :payment_ref, :mop,'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":prd_queue_code", "PC-" . $data["id"], PDO::PARAM_STR);

                $stmt->bindValue(":payments", $data["paymentdata"]["payment_amount"], PDO::PARAM_STR);

                $stmt->bindValue(":payment_ref", $data["paymentdata"]["payment_ref"], PDO::PARAM_STR);

                $stmt->bindValue(":mop", $data["paymentdata"]["mop"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

                $this->conn->commit();

                echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

                $this->conn->rollBack();

                echo json_encode(["message" => "Error: " . $e->getMessage()]);

            }

        }

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

}
