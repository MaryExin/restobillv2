<?php

class SalesTransactionsGateway
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
        // // Determine the query condition based on whether 'busunitcode' and/or 'transdate' are provided
        // if (empty($data["busunitcode"]) && empty($data["transdate"])) {
        //     // Both 'busunitcode' and 'transdate' are empty
        //     $query = null;
        // } elseif (empty($data["busunitcode"])) {
        //     // Only 'busunitcode' is empty
        //     $query = "T2.transdate = :transdate";
        // } elseif (empty($data["transdate"])) {
        //     // Only 'transdate' is empty
        //     $query = "T2.busunitcode = :busunitcode";
        // } else {
        //     // Neither 'busunitcode' nor 'transdate' are empty
        //     $query = "T2.transdate = :transdate AND T2.busunitcode = :busunitcode";
        // }
        // // CONCAT(T1.firstname, ' ', T1.middlename, ' ', T1.lastname) AS full_name,
        // // Construct the SQL query
        // $sql = "SELECT 
        //                SUM(T2.total_sales) AS total_sales,
        //                SUM(T2.total_vat) AS total_vat,
        //                SUM(T2.total_discounts) AS total_discount,
        //                SUM(T2.total_other_mop) AS total_other_mop,
        //                SUM(T2.net_sales - T2.total_vat - T2.total_discounts) AS total_net_sales,
        //                SUM(T2.cash_received) AS total_cash_received,
        //                SUM(T2.change) AS total_change,
        //                SUM(T2.net_cash) AS total_net_cash
             
        //         FROM tbl_sales_summary AS T2
        //      ";

        // // Add the WHERE clause if a query condition exists
        // if ($query) {
        //     $sql .= " WHERE $query";
        // }

        // // Add the GROUP BY clause
        // $sql .= " GROUP BY T1.uuid, T1.firstname, T1.middlename, T1.lastname";
         $sql = "SELECT * FROM tbl_zreading WHERE DATE(Opening_DateTime) = :transdate AND busunitcode = :busunitcode  ";
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
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        // Output the result as JSON
        echo json_encode($result);
    }

    public function modeOfPayment($user_id, $data)
    {
      
        $this->conn->exec("SET time_zone = 'Asia/Manila'");
    
        $dateNow = date('Y-m-d');
  

        $sql = "SELECT distinct T3.description, SUM(T2.amount) as total_amount FROM tbl_sales_summary AS T1
        JOIN tbl_mop_summary AS T2 ON T1.sales_id = T2.sales_id
        JOIN lkp_mop AS T3 ON T2.mop_id = T3.mop_id
        WHERE T1.transdate = :transdate AND T1.busunitcode = :busunitcode AND T3.description != 'CASH'
        AND T1.poscode = :poscode
        GROUP BY T2.mop_id
        ORDER BY T3.description ASC";
    
        $stmt = $this->conn->prepare($sql);
    
        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
        $stmt->bindValue(":transdate", $dateNow);
        $stmt->bindValue(":poscode", $data["poscode"]);
    
        $stmt->execute();
    
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
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

        $sql = "SELECT * FROM tbl_sales_summary WHERE
        deletestatus = 'Active'
        AND transdate = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))
        AND transdate BETWEEN :dateFrom AND :dateTo
        AND busunitcode = :busunitcode";

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

            //UPDATE CASH SUMMARY SALES SUMMARY ID

            $sql = "UPDATE  tbl_cash_sales_summary_tracker SET busunitcode = :busunit

             WHERE usertracker = :user_tracker AND transdate = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":busunit", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            //$stmt->execute();

            // TBL_SALES_SUMMARY

            $netCash = $data["transactionsummary"]["cash_received"] - $data["transactionsummary"]["change"];

            $sql = "INSERT INTO tbl_sales_summary ()



            VALUES (default, :sales_id, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :busunitcode, :poscode, :sales_trans_id,:cash_trans_id,

            :mop_trans_id, :sales_type_id, :discount_id, :total_sales, :total_vat,

            :total_discounts, :total_other_mop, :net_sales, :cash_received, :change, :net_cash, :gender, :age,

            :customerid, :attendantid, :particulars,

            :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);

            $stmt->bindValue(":poscode", $data["transactionsummary"]["poscode"], PDO::PARAM_STR);

            $stmt->bindValue(":sales_trans_id", "STS-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":cash_trans_id", $data["cashtrackingid"], PDO::PARAM_STR);

            $stmt->bindValue(":mop_trans_id", "MPS-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":sales_type_id", $data["transactionsummary"]["type"], PDO::PARAM_STR);

            $stmt->bindValue(":discount_id", "DCS-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":total_sales", number_format((float) $data["transactionsummary"]["total_sales"], 2, '.', ''), PDO::PARAM_STR);
            
            $stmt->bindValue(":total_vat", number_format((float) $data["transactionsummary"]["total_vat"], 2, '.', ''), PDO::PARAM_STR);
            
            $stmt->bindValue(":total_discounts", number_format((float) $data["transactionsummary"]["total_discounts"], 2, '.', ''), PDO::PARAM_STR);
            
            $stmt->bindValue(":total_other_mop", number_format((float) $data["transactionsummary"]["total_other_mop"], 2, '.', ''), PDO::PARAM_STR);
            
            $stmt->bindValue(":net_sales", number_format((float) $data["transactionsummary"]["net_sales"], 2, '.', ''), PDO::PARAM_STR);
            
            $stmt->bindValue(":cash_received", number_format((float) $data["transactionsummary"]["cash_received"], 2, '.', ''), PDO::PARAM_STR);
            
            $stmt->bindValue(":change", number_format((float) $data["transactionsummary"]["change"], 2, '.', ''), PDO::PARAM_STR);
            
            $stmt->bindValue(":net_cash", $netCash, PDO::PARAM_STR);

            $stmt->bindValue(":gender", $data["gender"], PDO::PARAM_STR);

            $stmt->bindValue(":age", $data["age"], PDO::PARAM_STR);

            $stmt->bindValue(":customerid", $data["customerid"], PDO::PARAM_STR);

            $stmt->bindValue(":attendantid", $data["attendantid"], PDO::PARAM_STR);

            $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            // TBL_SALES_TRANSACTIONS

            $sql = "INSERT INTO tbl_sales_transactions ()

            VALUES (default, :sales_trans_id, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:inv_code, :qty, :cost_per_uom,

            :uomval, :uom,:total_cost,:srp, :total_sales, :vat, :tax_type, :discount_type_id, :discount_amount,

            :sales_id, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Sales Transactions

            foreach ($data["salessummary"] as $sales) {

                $stmt->bindValue(":sales_trans_id", "STS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $sales["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $sales["qty"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $sales["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $sales["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $sales["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":total_cost", number_format(round((float) $sales["total_cost"], 2), 2, '.', ''), PDO::PARAM_STR);
                
                $stmt->bindValue(":srp", number_format(round((float) $sales["srp"], 2), 2, '.', ''), PDO::PARAM_STR);
                
                $stmt->bindValue(":total_sales", number_format(round((float) $sales["total_sales"], 2), 2, '.', ''), PDO::PARAM_STR);
                
                $stmt->bindValue(":vat", $sales["vat"], PDO::PARAM_STR);

                $stmt->bindValue(":tax_type", $sales["tax_type"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", 0, PDO::PARAM_STR);

                $stmt->bindValue(":discount_amount", 0, PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // Post Vat Exempt Discounts

            foreach ($data["discountsummary"] as $discountedSales) {

                $stmt->bindValue(":sales_trans_id", "STS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $discountedSales["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $discountedSales["qty"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $discountedSales["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $discountedSales["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $discountedSales["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":total_cost", number_format((float) $discountedSales["total_cost"], 2, '.', ''), PDO::PARAM_STR);

                $stmt->bindValue(":srp", $discountedSales["srp"], PDO::PARAM_STR);

                $stmt->bindValue(":total_sales", number_format((float) $discountedSales["total_sales"], 2, '.', ''), PDO::PARAM_STR);

                $stmt->bindValue(":vat", $discountedSales["vat"], PDO::PARAM_STR);

                $stmt->bindValue(":tax_type", $discountedSales["tax_type"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", $discountedSales["discount_id"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_amount", number_format(round((float) $discountedSales["discount_value"], 2), 2, '.', ''), PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_INVENTORY_TRANSACTIONS

            $sql = "INSERT INTO tbl_inventory_transactions ()



            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:inv_code, :qty, :cost_per_uom, :uom_val, :uom,



            :pr_queue_code, :busunitcode, :inv_class, '', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Components for Inventory Transactions

            foreach ($data["buildcomponentssummary"] as $component) {

                $stmt->bindValue(":inv_code", $component["component_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $component["qty"] * -1, PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $component["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uom_val", $component["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $component["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":pr_queue_code", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_class", "FG", PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_DISCOUNTS

            $sql = "INSERT INTO tbl_discounts ()

            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:discount_id, :discount_type_id, :amount, :discount_ref_no,

            :sales_id, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Discounts per product

            foreach ($data["discountsummary"] as $discount) {

                $stmt->bindValue(":discount_id", "DCS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", $discount["discount_id"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", number_format(round((float) $discount["discount_value"], 2), 2, '.', ''), PDO::PARAM_STR);

                $stmt->bindValue(":discount_ref_no", implode(",", $discount["discount_reference"]), PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // Post Other Discounts

            foreach ($data["otherdiscountsummary"] as $otherDiscount) {

                $stmt->bindValue(":discount_id", "DCS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", $otherDiscount["discount_id"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", number_format(round((float) $otherDiscount["discount_value"], 2), 2, '.', ''), PDO::PARAM_STR);

                $stmt->bindValue(":discount_ref_no", $otherDiscount["discount_reference"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_MOP

            $sql = "INSERT INTO tbl_mop_summary ()

            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:mop_trans_id, :mop_id, :amount, :payment_ref,

            :sales_id, :payment_status , :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Payments

            foreach ($data["paymentsummary"] as $payments) {

                $stmt->bindValue(":mop_trans_id", "MPS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":mop_id", $payments["mop_id"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", number_format(round((float) $payments["amount_tendered"], 2), 2, '.', ''), PDO::PARAM_STR);

                $stmt->bindValue(":payment_ref", $payments["payment_ref"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":payment_status", $payments["payment_status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_MOP

            $sql = "INSERT INTO tbl_accounting_transactions ()

            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) , DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) ,
            :glcodes, :slcodes, :amounts, 'SALES', :sales_id, 'AUTO', 'Posted', :customer_ids, '', '', '' , '', '', 'SALES',
            :transtype, '/salestracker', :busunits, '', '', '0', :dm_id, 'Active' , :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Payments

            foreach ($data["paymentsummary"] as $payments) {

                if($payments["mop_description"] === "CREDIT"){
                    $checkslcodesql = "SELECT slcode FROM tbl_customer_details WHERE customer_id = :customerids AND deletestatus = 'Active'";
                    $checkslcodestmt = $this->conn->prepare($checkslcodesql);
                    $checkslcodestmt->bindValue(":customerids", $data["customerid"], PDO::PARAM_STR);
                    $checkslcodestmt->execute();
                    $costumerslcode = $checkslcodestmt->fetchColumn();

                    $gl = substr($costumerslcode, 0, 3);

                    $stmt->bindValue(":glcodes", $gl, PDO::PARAM_STR);

                    $stmt->bindValue(":slcodes", $costumerslcode, PDO::PARAM_STR);

                    $stmt->bindValue(":amounts", number_format(round((float) $payments["amount_tendered"], 2), 2, '.', ''), PDO::PARAM_STR);
                }
                else if($payments["mop_description"] === "CASH"){
                    if($payments["mop_slcode"] === ""){
                    $gl = $payments["mop_slcode"];
                    }else{
                    $gl = substr($payments["mop_slcode"], 0, 3);
                    }

                    $stmt->bindValue(":glcodes", $gl, PDO::PARAM_STR);

                    $stmt->bindValue(":slcodes", $payments["mop_slcode"], PDO::PARAM_STR);

                    $lesschange = round($payments["amount_tendered"] - $data["transactionsummary"]["change"], 2);

                    $stmt->bindValue(":amounts", $lesschange, PDO::PARAM_STR);
                }
                else{
                    if($payments["mop_slcode"] === ""){
                    $gl = $payments["mop_slcode"];
                    }else{
                    $gl = substr($payments["mop_slcode"], 0, 3);
                    }

                    $stmt->bindValue(":glcodes", $gl, PDO::PARAM_STR);

                    $stmt->bindValue(":slcodes", $payments["mop_slcode"], PDO::PARAM_STR);

                    $stmt->bindValue(":amounts", number_format(round((float) $payments["amount_tendered"], 2), 2, '.', ''), PDO::PARAM_STR);
                }

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "PAYMENT", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            foreach ($data["discountsummary"] as $discount) {

                $checksldescsql = "SELECT tax_type, category FROM lkp_build_of_products WHERE build_code = :inv_codes AND deletestatus = 'Active'";
                    $checksldescstmt = $this->conn->prepare($checksldescsql);
                    $checksldescstmt->bindValue(":inv_codes", $discount["inv_code"], PDO::PARAM_STR);
                    $checksldescstmt->execute();
                    // Fetch the result as an associative array
                    $sldesc = $checksldescstmt->fetch(PDO::FETCH_ASSOC);

                    // Concatenate tax_type and category with a hyphen
                    $description = "SALE - " . $sldesc['tax_type'] . " - " . $sldesc['category'];

                    $checkslcodesql = "SELECT glcode, slcodes, sldescription FROM lkp_slcodes WHERE sldescription = :sldescriptions AND deletestatus = 'Active'";
                    $checkslcodestmt = $this->conn->prepare($checkslcodesql);
                    $checkslcodestmt->bindValue(":sldescriptions", $description , PDO::PARAM_STR);
                    $checkslcodestmt->execute();
                    $slcode = $checkslcodestmt->fetch(PDO::FETCH_ASSOC);

                    $negative_amount = round(-1 * $discount["total_sales"], 2);

                $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);

                $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);

                $stmt->bindValue(":amounts", $negative_amount, PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "SALES", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();
            }

            foreach ($data["discountsummary"] as $discount) {

                if($discount["slcode"] === ""){
                    $gl = $discount["slcode"];
                    }else{
                    $gl = substr($discount["slcode"], 0, 3);
                    }

                $stmt->bindValue(":glcodes", $gl, PDO::PARAM_STR);

                $stmt->bindValue(":slcodes", $discount["slcode"], PDO::PARAM_STR);

                $stmt->bindValue(":amounts", number_format(round((float) $discount["discount_value"], 2), 2, '.', ''), PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "DISCOUNT", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();
            }

            foreach ($data["otherdiscountsummary"] as $otherdiscount) {

                    $checkslcodesql = "SELECT slcode FROM lkp_discounts WHERE discount_type_id = :discount_ids AND deletestatus = 'Active'";
                    $checkslcodestmt = $this->conn->prepare($checkslcodesql);
                    $checkslcodestmt->bindValue(":discount_ids", $otherdiscount["discount_id"], PDO::PARAM_STR);
                    $checkslcodestmt->execute();
                    $discountslcode = $checkslcodestmt->fetchColumn();

                    if($discountslcode === ""){
                    $gl = $discountslcode;
                    }else{
                    $gl = substr($discountslcode, 0, 3);
                    }

                $stmt->bindValue(":glcodes", $gl, PDO::PARAM_STR);

                $stmt->bindValue(":slcodes", $discountslcode, PDO::PARAM_STR);

                $stmt->bindValue(":amounts", number_format(round((float) $otherdiscount["discount_value"], 2), 2, '.', ''), PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "OTHER DISCOUNT", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();
            }

                if($data["transactionsummary"]["total_vat"] !== 0){

                $negative_amount = -1 * (float) $data["transactionsummary"]["total_vat"];

                $stmt->bindValue(":glcodes", "450", PDO::PARAM_STR);

                $stmt->bindValue(":slcodes", "45001", PDO::PARAM_STR);

                $stmt->bindValue(":amounts", $negative_amount, PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "VAT", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();
                }

            foreach ($data["salessummary"] as $summary) {

                    $checksldescsql = "SELECT tax_type, category FROM lkp_build_of_products WHERE build_code = :inv_codes AND deletestatus = 'Active'";
                    $checksldescstmt = $this->conn->prepare($checksldescsql);
                    $checksldescstmt->bindValue(":inv_codes", $summary["inv_code"], PDO::PARAM_STR);
                    $checksldescstmt->execute();
                    // Fetch the result as an associative array
                    $sldesc = $checksldescstmt->fetch(PDO::FETCH_ASSOC);

                    // Concatenate tax_type and category with a hyphen
                    $description = "SALE - " . $sldesc['tax_type'] . " - " . $sldesc['category'];

                    $checkslcodesql = "SELECT glcode, slcodes, sldescription FROM lkp_slcodes WHERE sldescription = :sldescriptions AND deletestatus = 'Active'";
                    $checkslcodestmt = $this->conn->prepare($checkslcodesql);
                    $checkslcodestmt->bindValue(":sldescriptions", $description , PDO::PARAM_STR);
                    $checkslcodestmt->execute();
                    $slcode = $checkslcodestmt->fetch(PDO::FETCH_ASSOC);
                if($summary["vat"] != 0)
                {
                    $vat = $summary["total_sales"] / 1.12 * 0.12;
                    $negative_amount = -1 * $summary["total_sales"] + $vat;
                    


                }
                else
                {
                    $negative_amount = -1 * (float) $summary["total_sales"] + (float) $summary["vat"];

                }

                $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);

                $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);

                $stmt->bindValue(":amounts", $negative_amount, PDO::PARAM_STR);


                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "SALES", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();
            }

        // Step 1: Retrieve and group inv_code and total_cost_per_uom from tbl_sales_transactions
        $checksldescsql = "SELECT 
            inv_code, 
            SUM(qty * cost_per_uom) AS total_cost_per_uom
        FROM 
            tbl_inventory_transactions 
        WHERE 
            pr_queue_code = :sales_ids 
            AND deletestatus = 'Active' 
        GROUP BY 
            inv_code;
        ";
        $checksldescstmt = $this->conn->prepare($checksldescsql);
        $checksldescstmt->bindValue(":sales_ids", "SSM-" . $shortUuid, PDO::PARAM_STR);
        $checksldescstmt->execute();

        // Array to hold total cost per category
        $category_costs = [];

        while ($row = $checksldescstmt->fetch(PDO::FETCH_ASSOC)) {
            // Step 2: Retrieve the category for each inv_code
            $catsql = "SELECT category 
                       FROM lkp_build_of_products 
                       WHERE build_code = :inv_codes 
                       AND deletestatus = 'Active'";
            $catstmt = $this->conn->prepare($catsql);
            $catstmt->bindValue(":inv_codes", $row["inv_code"], PDO::PARAM_STR);
            $catstmt->execute();
            $sldesc = $catstmt->fetch(PDO::FETCH_ASSOC);
        
            if ($sldesc) {
                $category = $sldesc['category'];
                // Sum the total_cost_per_uom for each category
                if (!isset($category_costs[$category])) {
                    $category_costs[$category] = 0;
                }
                $category_costs[$category] += $row["total_cost_per_uom"];
            }
        }

        // Step 4: Fetch the glcode and slcodes based on the category and insert the data
        foreach ($category_costs as $category => $total_cost) {
            $description = "COST OF SALES - " . $category;

            $checkslcodesql = "SELECT glcode, slcodes, sldescription 
                               FROM lkp_slcodes 
                               WHERE sldescription = :sldescriptions 
                               AND deletestatus = 'Active'";
            $checkslcodestmt = $this->conn->prepare($checkslcodesql);
            $checkslcodestmt->bindValue(":sldescriptions", $description, PDO::PARAM_STR);
            $checkslcodestmt->execute();
            $slcode = $checkslcodestmt->fetch(PDO::FETCH_ASSOC);
        
            $categorycostofsale = $total_cost * -1;
        
            if ($slcode) {
                // Insert the aggregated data
                // $stmt = $this->conn->prepare("INSERT INTO your_table_name 
                //                               (glcodes, slcodes, amounts, sales_id, dm_id, transtype, customer_ids, busunits, user_tracker) 
                //                               VALUES (:glcodes, :slcodes, :amounts, :sales_id, :dm_id, :transtype, :customer_ids, :busunits, :user_tracker)");
                $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);
                $stmt->bindValue(":amounts", number_format(round((float) $categorycostofsale, 2), 2, '.', ''), PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "COST OF SALE", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }
        }

        // Step 1: Retrieve and group inv_code and total_cost_per_uom from tbl_sales_transactions
        $checksldescsql = "SELECT 
            inv_code, 
            SUM(qty * cost_per_uom) AS total_cost_per_uom
        FROM 
            tbl_inventory_transactions 
        WHERE 
            pr_queue_code = :sales_ids 
            AND deletestatus = 'Active' 
        GROUP BY 
            inv_code;
        ";
        $checksldescstmt = $this->conn->prepare($checksldescsql);
        $checksldescstmt->bindValue(":sales_ids", "SSM-" . $shortUuid, PDO::PARAM_STR);
        $checksldescstmt->execute();

        // Array to hold total cost per category
        $category_costs = [];

        while ($row = $checksldescstmt->fetch(PDO::FETCH_ASSOC)) {
            // Step 2: Retrieve the category for each inv_code
            $catsql = "SELECT category 
                       FROM lkp_build_of_products 
                       WHERE build_code = :inv_codes 
                       AND deletestatus = 'Active'";
            $catstmt = $this->conn->prepare($catsql);
            $catstmt->bindValue(":inv_codes", $row["inv_code"], PDO::PARAM_STR);
            $catstmt->execute();
            $sldesc = $catstmt->fetch(PDO::FETCH_ASSOC);
        
            if ($sldesc) {
                $category = $sldesc['category'];
                // Sum the total_cost_per_uom for each category
                if (!isset($category_costs[$category])) {
                    $category_costs[$category] = 0;
                }
                $category_costs[$category] += $row["total_cost_per_uom"];
            }
        }

        // Step 4: Fetch the glcode and slcodes based on the category and insert the data
        foreach ($category_costs as $category => $total_cost) {
            $description = "INVENTORY - " . $category;

            $checkslcodesql = "SELECT glcode, slcodes, sldescription 
                               FROM lkp_slcodes 
                               WHERE sldescription = :sldescriptions 
                               AND deletestatus = 'Active'";
            $checkslcodestmt = $this->conn->prepare($checkslcodesql);
            $checkslcodestmt->bindValue(":sldescriptions", $description , PDO::PARAM_STR);
            $checkslcodestmt->execute();
            $slcode = $checkslcodestmt->fetch(PDO::FETCH_ASSOC);
        
            if ($slcode) {
                // Insert the aggregated data
                // $stmt = $this->conn->prepare("INSERT INTO your_table_name 
                //                               (glcodes, slcodes, amounts, sales_id, dm_id, transtype, customer_ids, busunits, user_tracker) 
                //                               VALUES (:glcodes, :slcodes, :amounts, :sales_id, :dm_id, :transtype, :customer_ids, :busunits, :user_tracker)");
                $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);
                $stmt->bindValue(":amounts", round((float) $total_cost, 2), PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "INVENTORY", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }
        }
                    $log = "INSERT INTO tbl_logs ()
                    VALUES (default, 'LIGHTEM', :busunitcode, 'salestracker', 'Sales Transaction', :sales_id, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";
            
                    $logstmt = $this->conn->prepare($log);
            
                    $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);

                    $logstmt->bindValue(":busunitcode", $data["busunit"], PDO::PARAM_STR);

                    $logstmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
            
                    $logstmt->execute();

                    $this->conn->commit();

                    echo json_encode(["message" => "Success", "Transid" =>$shortUuid,  "Sample" =>$row]);

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







                    :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, '', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

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
