<?php

class SyncSalesTransactionsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function createForUser($data, $shortUuid)
    {

        try {

            $this->conn->beginTransaction();

            //UPDATE CASH SUMMARY SALES SUMMARY ID

            // $sql = "UPDATE  tbl_cash_sales_summary_tracker SET busunitcode = :busunit

            //  WHERE usertracker = :user_tracker AND transdate = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            // $stmt = $this->conn->prepare($sql);

            // $stmt->bindValue(":busunit", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);

            // $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

            //$stmt->execute();

            // TBL_SALES_SUMMARY

            $netCash = $data["transactionsummary"]["cash_received"] - $data["transactionsummary"]["change"];

            $sql = "INSERT INTO tbl_sales_summary ()



            VALUES (default, :sales_id, :transdate, :busunitcode, :poscode, :sales_trans_id,:cash_trans_id,

            :mop_trans_id, :sales_type_id, :discount_id, :total_sales, :total_vat,

            :total_discounts, :total_other_mop, :net_sales, :cash_received, :change, :net_cash, :gender, :age,

            :customerid, :attendantid, :particulars,

            :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);

            $stmt->bindValue(":poscode", $data["transactionsummary"]["poscode"], PDO::PARAM_STR);

            $stmt->bindValue(":sales_trans_id", "STS-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":cash_trans_id", $data["cashtrackingid"], PDO::PARAM_STR);

            $stmt->bindValue(":mop_trans_id", "MPS-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":sales_type_id", $data["transactionsummary"]["type"], PDO::PARAM_STR);

            $stmt->bindValue(":discount_id", "DCS-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":total_sales", $data["transactionsummary"]["total_sales"], PDO::PARAM_STR);

            $stmt->bindValue(":total_vat", $data["transactionsummary"]["total_vat"], PDO::PARAM_STR);

            $stmt->bindValue(":total_discounts", $data["transactionsummary"]["total_discounts"], PDO::PARAM_STR);

            $stmt->bindValue(":total_other_mop", $data["transactionsummary"]["total_other_mop"], PDO::PARAM_STR);

            $stmt->bindValue(":net_sales", $data["transactionsummary"]["net_sales"], PDO::PARAM_STR);

            $stmt->bindValue(":cash_received", $data["transactionsummary"]["cash_received"], PDO::PARAM_STR);

            $stmt->bindValue(":change", $data["transactionsummary"]["change"], PDO::PARAM_STR);

            $stmt->bindValue(":net_cash", $netCash, PDO::PARAM_STR);

            $stmt->bindValue(":gender", $data["gender"], PDO::PARAM_STR);

            $stmt->bindValue(":age", $data["age"], PDO::PARAM_STR);

            $stmt->bindValue(":customerid", $data["customerid"], PDO::PARAM_STR);

            $stmt->bindValue(":attendantid", $data["attendantid"], PDO::PARAM_STR);

            $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

            $stmt->execute();

            // TBL_SALES_TRANSACTIONS

            $sql = "INSERT INTO tbl_sales_transactions ()

            VALUES (default, :sales_trans_id, :transdate,:inv_code, :qty, :cost_per_uom,

            :uomval, :uom,:total_cost,:srp, :total_sales, :vat, :tax_type, :discount_type_id, :discount_amount,

            :sales_id, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Sales Transactions

            foreach ($data["salessummary"] as $sales) {

                $stmt->bindValue(":sales_trans_id", "STS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $sales["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $sales["qty"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $sales["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $sales["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $sales["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":total_cost", $sales["total_cost"], PDO::PARAM_STR);

                $stmt->bindValue(":srp", $sales["srp"], PDO::PARAM_STR);

                $stmt->bindValue(":total_sales", $sales["total_sales"], PDO::PARAM_STR);

                $stmt->bindValue(":vat", $sales["vat"], PDO::PARAM_STR);

                $stmt->bindValue(":tax_type", $sales["tax_type"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", 0, PDO::PARAM_STR);

                $stmt->bindValue(":discount_amount", 0, PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

                $stmt->execute();

            }

            // Post Vat Exempt Discounts

            foreach ($data["discountsummary"] as $discountedSales) {

                $stmt->bindValue(":sales_trans_id", "STS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $discountedSales["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $discountedSales["qty"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $discountedSales["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uomval", $discountedSales["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $discountedSales["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":total_cost", $discountedSales["total_cost"], PDO::PARAM_STR);

                $stmt->bindValue(":srp", $discountedSales["srp"], PDO::PARAM_STR);

                $stmt->bindValue(":total_sales", $discountedSales["total_sales"], PDO::PARAM_STR);

                $stmt->bindValue(":vat", $discountedSales["vat"], PDO::PARAM_STR);

                $stmt->bindValue(":tax_type", $discountedSales["tax_type"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", $discountedSales["discount_id"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_amount", $discountedSales["discount_value"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_INVENTORY_TRANSACTIONS

            $sql = "INSERT INTO tbl_inventory_transactions ()



            VALUES (default, :transdate,:inv_code, :qty, :cost_per_uom, :uom_val, :uom,



            :pr_queue_code, :busunitcode, :inv_class,'0000-00-00', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Components for Inventory Transactions

            foreach ($data["buildcomponentssummary"] as $component) {

                $stmt->bindValue(":inv_code", $component["component_code"], PDO::PARAM_STR);
                
                $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $component["qty"] * -1, PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $component["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":uom_val", $component["uomval"], PDO::PARAM_STR);

                $stmt->bindValue(":uom", $component["uom"], PDO::PARAM_STR);

                $stmt->bindValue(":pr_queue_code", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":inv_class", "FG", PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

                $stmt->execute();

                //select the raw mats qty

                $sql = "SELECT * FROM tbl_build_components as t1 LEFT JOIN lkp_raw_mats as t2 on t1.component_code = t2.mat_code where build_code = :build_code";

                $stmtSelectRaw = $this->conn->prepare($sql);

                $stmtSelectRaw->bindValue(":build_code", $component["component_code"], PDO::PARAM_STR);

                $stmtSelectRaw->execute();

                $SelectRawmats = $stmtSelectRaw->fetchAll(PDO::FETCH_ASSOC); 
                
                //insert the selected rawmats

                $sqlInsertRawmats = "INSERT INTO tbl_inventory_transactions ()

                    VALUES (default, :transdate,:inv_code, :qty, :cost_per_uom, :uom_val, :uom,

                    :pr_queue_code, :busunitcode, :inv_class,'0000-00-00', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sqlInsertRawmats);


                foreach ($SelectRawmats as $rawMats) {
                        // to get the uom
                    $sql= "SELECT 
                            t1.*
                        FROM
                            tbl_pricing_details AS t1
                                LEFT JOIN
                            tbl_pricing_by_sales_type AS t3 ON t1.pricing_code = t3.pricing_category AND t3.sales_type_id = :sales_type_id
                        WHERE
                            t3.busunitcode = :busunitcode AND inv_code = :inv_code";

                    $stmtSelectAmount = $this->conn->prepare($sql);

                    $stmtSelectAmount->bindValue(":inv_code", $rawMats["component_code"], PDO::PARAM_STR);
                    $stmtSelectAmount->bindValue(":busunitcode", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);
                    $stmtSelectAmount->bindValue(":sales_type_id",  $data["transactionsummary"]["type"], PDO::PARAM_STR);

                    $stmtSelectAmount->execute();

                    $SelectRawmatsAmounts = $stmtSelectAmount->fetch(PDO::FETCH_ASSOC);

                    $stmt->bindValue(":inv_code", $rawMats["component_code"], PDO::PARAM_STR);
                
                    $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

                    $stmt->bindValue(":qty", $rawMats["qty"] * -1, PDO::PARAM_STR);

                    $stmt->bindValue(":cost_per_uom", $SelectRawmatsAmounts["cost_per_uom"], PDO::PARAM_STR);

                    $stmt->bindValue(":uom_val", $rawMats["uomval"], PDO::PARAM_STR);

                    $stmt->bindValue(":uom", $rawMats["uom"], PDO::PARAM_STR);

                    $stmt->bindValue(":pr_queue_code", "SSM-" . $shortUuid, PDO::PARAM_STR);

                    $stmt->bindValue(":busunitcode", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);

                    $stmt->bindValue(":inv_class", "RM", PDO::PARAM_STR);

                    $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

                    $stmt->execute();


                }

            }

            // TBL_DISCOUNTS

            $sql = "INSERT INTO tbl_discounts ()

            VALUES (default, :transdate,:discount_id, :discount_type_id, :amount, :discount_ref_no,

            :sales_id, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Discounts per product

            foreach ($data["discountsummary"] as $discount) {

                $stmt->bindValue(":discount_id", "DCS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", $discount["discount_id"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", $discount["discount_value"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_ref_no", $discount["discount_reference"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

                $stmt->execute();

            }

            // Post Other Discounts

            foreach ($data["otherdiscountsummary"] as $otherDiscount) {

                $stmt->bindValue(":discount_id", "DCS-" . $shortUuid, PDO::PARAM_STR);
                
                $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", $otherDiscount["discount_id"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", $otherDiscount["discount_value"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_ref_no", $otherDiscount["discount_reference"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_MOP

            $sql = "INSERT INTO tbl_mop_summary ()

            VALUES (default, :transdate,:mop_trans_id, :mop_id, :amount, :payment_ref,

            :sales_id, :payment_status , :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Payments

            foreach ($data["paymentsummary"] as $payments) {

                $stmt->bindValue(":mop_trans_id", "MPS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

                $stmt->bindValue(":mop_id", $payments["mop_id"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", $payments["amount_tendered"], PDO::PARAM_STR);

                $stmt->bindValue(":payment_ref", $payments["payment_ref"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":payment_status", $payments["payment_status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_MOP

            $sql = "INSERT INTO tbl_accounting_transactions ()

            VALUES (default, :transdate , :document_date,
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

                    $stmt->bindValue(":amounts", $payments["amount_tendered"], PDO::PARAM_STR);
                }
                else if($payments["mop_description"] === "CASH"){
                    if($payments["mop_slcode"] === ""){
                    $gl = $payments["mop_slcode"];
                    }else{
                    $gl = substr($payments["mop_slcode"], 0, 3);
                    }

                    $stmt->bindValue(":glcodes", $gl, PDO::PARAM_STR);

                    $stmt->bindValue(":slcodes", $payments["mop_slcode"], PDO::PARAM_STR);

                    $lesschange = $payments["amount_tendered"] - $data["transactionsummary"]["change"];

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

                    $stmt->bindValue(":amounts", $payments["amount_tendered"], PDO::PARAM_STR);
                }

                $stmt->bindValue(":transdate", $data["transactionsdate"], PDO::PARAM_STR);

                $stmt->bindValue(":document_date", $data["transactionsdate"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "PAYMENT", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

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

                $negative_amount = -1 * $discount["total_sales"];

                $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);

                $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);

                $stmt->bindValue(":amounts", $negative_amount, PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "SALES", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

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

                $stmt->bindValue(":amounts", $discount["discount_value"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "DISCOUNT", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

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

                $stmt->bindValue(":amounts", $otherdiscount["discount_value"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "OTHER DISCOUNT", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

                $stmt->execute();
            }

                if($data["transactionsummary"]["total_vat"] !== 0){

                $negative_amount = -1 * $data["transactionsummary"]["total_vat"];

                $stmt->bindValue(":glcodes", "450", PDO::PARAM_STR);

                $stmt->bindValue(":slcodes", "45001", PDO::PARAM_STR);

                $stmt->bindValue(":amounts", $negative_amount, PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "VAT", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

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
                    $negative_amount = -1 * $summary["total_sales"] + $summary["vat"];
                }
                
                
                $stmt->bindValue(":glcodes", $slcode["glcode"], PDO::PARAM_STR);

                $stmt->bindValue(":slcodes", $slcode["slcodes"], PDO::PARAM_STR);

                $stmt->bindValue(":amounts", $negative_amount, PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transtype", "SALES", PDO::PARAM_STR);

                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);

                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);

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
                $stmt->bindValue(":amounts", $categorycostofsale, PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "COST OF SALE", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);
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
                $stmt->bindValue(":amounts", $total_cost, PDO::PARAM_STR);
                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":dm_id", "DM-" . $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":transtype", "INVENTORY", PDO::PARAM_STR);
                $stmt->bindValue(":customer_ids", $data["customerid"], PDO::PARAM_STR);
                $stmt->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $data["usertracker"], PDO::PARAM_STR);
                $stmt->execute();
            }
        }
                    $log = "INSERT INTO tbl_logs ()
                    VALUES (default, 'B1T1', :busunitcode, 'salestracker', 'Sales Transaction', :sales_id, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";
            
                    $logstmt = $this->conn->prepare($log);
            
                    $logstmt->bindValue(":id", "1", PDO::PARAM_STR);

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

}
