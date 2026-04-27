<?php

class SalesSummaryGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($user_id)
    {

        $sql = "SELECT * FROM tbl_sales_summary WHERE
        deletestatus = 'Active'
        AND transdate = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) ORDER BY seq DESC;";

        $stmt = $this->conn->prepare($sql);

        // $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getCashClosingData($data, $user_id)
    {

        $sql = "SELECT * FROM tbl_sales_summary WHERE
                transdate = :transdate
                AND deletestatus = 'Active'
                AND busunitcode = :busunitcode";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

        $stmt->bindValue(":transdate", date("Y-m-d"), PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

      echo json_encode($data);

    }

    public function getAllDataPerTransaction($data, $user_id)
    {

        if (isset($data["period"])) {

        } else {

            //Return sales transactions

            $sql = "SELECT tbl_sales_transactions.sales_trans_id, tbl_sales_transactions.transdate, tbl_sales_transactions.inv_code,



                tbl_sales_transactions.qty, tbl_sales_transactions.cost_per_uom, tbl_sales_transactions.uomval, tbl_sales_transactions.uom,



                tbl_sales_transactions.total_cost, tbl_sales_transactions.srp,



                tbl_sales_transactions.total_sales, tbl_sales_transactions.vat, tbl_sales_transactions.tax_type,



                tbl_sales_transactions.discount_type_id, tbl_sales_transactions.discount_amount, tbl_sales_transactions.sales_id,



                lkp_build_of_products.desc AS description



                FROM tbl_sales_transactions



                LEFT OUTER JOIN lkp_build_of_products



                ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code



                WHERE tbl_sales_transactions.sales_id = :sales_summary_id



                AND tbl_sales_transactions.deletestatus = 'Active'



                ORDER BY tbl_sales_transactions.tax_type ASC, lkp_build_of_products.desc ASC ";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":sales_summary_id", $data["sales_summary_id"], PDO::PARAM_STR);

            $stmt->execute();

            $salesData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $salesData[] = $row;

            }

            // Return Discounts

            $sql = "SELECT tbl_discounts.transdate,tbl_discounts.discount_id, tbl_discounts.discount_type_id,



                tbl_discounts.amount, tbl_discounts.discount_ref_no, tbl_discounts.sales_id,  lkp_discounts.description



                FROM tbl_discounts



                LEFT OUTER JOIN lkp_discounts



                ON tbl_discounts.discount_type_id = lkp_discounts.discount_type_id



                WHERE tbl_discounts.sales_id = :sales_summary_id



                AND tbl_discounts.deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":sales_summary_id", $data["sales_summary_id"], PDO::PARAM_STR);

            $stmt->execute();

            $discountData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $discountData[] = $row;

            }

            // Return mode of Payment

            $sql = "SELECT tbl_mop_summary.transdate, tbl_mop_summary.mop_trans_id, tbl_mop_summary.mop_id,



                tbl_mop_summary.amount, tbl_mop_summary.payment_ref, tbl_mop_summary.sales_id,



                if(LEFT(tbl_mop_summary.mop_id,2) = 'MP' , lkp_mop.description, lkp_gift_cards.description) AS description,



                lkp_mop.account_no



                FROM tbl_mop_summary



                LEFT OUTER JOIN lkp_mop



                ON tbl_mop_summary.mop_id = lkp_mop.mop_id



				 LEFT OUTER JOIN lkp_gift_cards



                ON tbl_mop_summary.mop_id = lkp_gift_cards.gift_card_type_id



                WHERE tbl_mop_summary.sales_id = :sales_summary_id



                AND tbl_mop_summary.deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":sales_summary_id", $data["sales_summary_id"], PDO::PARAM_STR);

            $stmt->execute();

            $mopData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $mopData[] = $row;

            }

            $consoData = [];

            $consoData = ["salesdata" => $salesData, "discountsdata" => $discountData, "mopData" => $mopData];

            return $consoData;

        }

    }

    public function getVoidSales()
    {

        $sql = "SELECT * FROM tbl_void_sales WHERE status = 'For Voiding' AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData, $data)
    {

        $sql = "SELECT sales_id, transdate, lkp_busunits.busunitcode, lkp_busunits.name,  lkp_busunits.class,sales_trans_id, cash_trans_id, mop_trans_id, sales_type_id, discount_id,



                total_sales, total_vat, total_discounts, total_other_mop, net_sales, cash_received, `change`, net_cash



                FROM tbl_sales_summary



                LEFT OUTER JOIN lkp_busunits



                ON tbl_sales_summary.busunitcode = lkp_busunits.busunitcode



                WHERE tbl_sales_summary.deletestatus = 'Active'



                AND transdate BETWEEN :datefrom AND  :dateto



                ORDER BY tbl_sales_summary.seq DESC LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);

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

            $stmt->execute();

            // TBL_SALES_SUMMARY

            $netCash = $data["transactionsummary"]["cash_received"] - $data["transactionsummary"]["change"];

            $sql = "INSERT INTO tbl_sales_summary ()



            VALUES (default, :sales_id, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :busunitcode, :sales_trans_id,:cash_trans_id,



            :mop_trans_id, :sales_type_id, :discount_id, :total_sales, :total_vat,



            :total_discounts, :total_other_mop, :net_sales, :cash_received, :change, :net_cash, :gender, :age,



            :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["transactionsummary"]["busunit"], PDO::PARAM_STR);

            $stmt->bindValue(":sales_trans_id", "STS-" . $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":cash_trans_id", "CTS-" . $shortUuid, PDO::PARAM_STR);

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

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            // TBL_SALES_TRANSACTIONS

            $sql = "INSERT INTO tbl_sales_transactions ()



            VALUES (default, :sales_trans_id, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:inv_code, :qty, :cost_per_uom, :total_cost,



            :srp, :total_sales, :vat, :tax_type, :discount_type_id, :discount_amount, :sales_id,



            :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Sales Transactions

            foreach ($data["salessummary"] as $sales) {

                $stmt->bindValue(":sales_trans_id", "STS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":inv_code", $sales["inv_code"], PDO::PARAM_STR);

                $stmt->bindValue(":qty", $sales["qty"], PDO::PARAM_STR);

                $stmt->bindValue(":cost_per_uom", $sales["cost_per_uom"], PDO::PARAM_STR);

                $stmt->bindValue(":total_cost", $sales["total_cost"], PDO::PARAM_STR);

                $stmt->bindValue(":srp", $sales["srp"], PDO::PARAM_STR);

                $stmt->bindValue(":total_sales", $sales["total_sales"], PDO::PARAM_STR);

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

                $stmt->bindValue(":total_cost", $discountedSales["total_cost"], PDO::PARAM_STR);

                $stmt->bindValue(":srp", $discountedSales["srp"], PDO::PARAM_STR);

                $stmt->bindValue(":total_sales", $discountedSales["total_sales"], PDO::PARAM_STR);

                $stmt->bindValue(":vat", $discountedSales["vat"], PDO::PARAM_STR);

                $stmt->bindValue(":tax_type", $discountedSales["tax_type"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", $discountedSales["discount_id"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_amount", $discountedSales["discount_value"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_INVENTORY_TRANSACTIONS

            $sql = "INSERT INTO tbl_inventory_transactions ()



            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:inv_code, :qty, :cost_per_uom, :uom_val, :uom,



            :pr_queue_code, :busunitcode, :inv_class, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

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

                $stmt->bindValue(":amount", $discount["discount_value"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_ref_no", implode(",", $discount["discount_reference"]), PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // Post Other Discounts

            foreach ($data["otherdiscountsummary"] as $otherDiscount) {

                $stmt->bindValue(":discount_id", "DCS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":discount_type_id", $otherDiscount["discount_id"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", $otherDiscount["discount_value"], PDO::PARAM_STR);

                $stmt->bindValue(":discount_ref_no", $otherDiscount["discount_reference"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            // TBL_MOP

            $sql = "INSERT INTO tbl_mop_summary ()



            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:mop_trans_id, :mop_id, :amount, :payment_ref,



            :sales_id, :payment_status ,:user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            // Post Payments

            foreach ($data["paymentsummary"] as $payments) {

                $stmt->bindValue(":mop_trans_id", "MPS-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":mop_id", $payments["mop_id"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", $payments["amount_tendered"], PDO::PARAM_STR);

                $stmt->bindValue(":payment_ref", $payments["payment_ref"], PDO::PARAM_STR);

                $stmt->bindValue(":sales_id", "SSM-" . $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":payment_status", $payments["payment_status"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

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

    public function updateCashClosingForUser($user_id, $data)
    {

        try {

            $this->conn->beginTransaction();

            //UPDATE CASH SUMMARY SALES SUMMARY ID

            $sql = "UPDATE  tbl_cash_sales_summary_tracker SET cash_closing_balance = :cash_closing_balance,



            cash_count = :cash_count, variance = :variance, closing_time = DATE_ADD(NOW(), INTERVAL 8 HOUR)



             WHERE cash_trans_id = :cash_trans_id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":cash_closing_balance", $data["cashclosing"], PDO::PARAM_STR);

            $stmt->bindValue(":cash_count", $data["cashcount"], PDO::PARAM_STR);

            $stmt->bindValue(":variance", $data["variance"], PDO::PARAM_STR);

            $stmt->bindValue(":cash_trans_id", $data["cashtrackingid"], PDO::PARAM_STR);


            $stmt->execute();

            $log = "INSERT INTO tbl_logs ()
            VALUES (default, 'LIGHTEM', :busunitcode, 'salestracker', 'Cash Closing', :particulars, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $logstmt = $this->conn->prepare($log);
            $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $logstmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
            $logstmt->bindValue(":particulars", $data["cashcount"], PDO::PARAM_STR);
            $logstmt->execute();

            $this->conn->commit();
             if($data["variance"] !== 0){
                $this->sqlaccountingEntries($data, $user_id);
            }

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollback();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function updateCashClosingForAdmin($user_id, $data)
    {

        try {

            $this->conn->beginTransaction();

            //UPDATE CASH SUMMARY SALES SUMMARY ID

            $sql = "UPDATE  tbl_cash_sales_summary_tracker SET cash_closing_balance = :cash_closing_balance,
            cash_count = :cash_count, variance = :variance, closing_time = DATE_ADD(NOW(), INTERVAL 8 HOUR)
            WHERE cash_trans_id = :cash_trans_id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":cash_closing_balance", $data["cashclosing"], PDO::PARAM_STR);

            $stmt->bindValue(":cash_count", $data["cashcount"], PDO::PARAM_STR);

            $stmt->bindValue(":variance", $data["variance"], PDO::PARAM_STR);

            $stmt->bindValue(":cash_trans_id", $data["cashtrackingid"], PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollback();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function createVoidRequest($user_id, $data)
    {

        try {

            $this->conn->beginTransaction();

            $sql = "INSERT INTO tbl_void_sales () VALUES (default, :sales_id, :status,



            :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":sales_id", $data["salesid"], PDO::PARAM_STR);

            $stmt->bindValue(":status", "For Voiding", PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

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

    public function voidSales($user_id, $data)
    {

        $this->conn->beginTransaction();

        try {

            //Update tbl_sales_summary

            $sql = "UPDATE tbl_sales_summary
                SET
                    deletestatus = :status,
                    createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user_tracker
                WHERE
                    sales_id = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", 'Inactive', PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":id", $data["salesid"], PDO::PARAM_STR);
            $stmt->execute();

            //Update tbl_sales_transactions

            $sql = "UPDATE tbl_sales_transactions
                SET
                    deletestatus = :status,
                    createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user_tracker
                WHERE
                    sales_id = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", 'Inactive', PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":id", $data["salesid"], PDO::PARAM_STR);
            $stmt->execute();

            //Update tbl_discounts

            $sql = "UPDATE tbl_discounts
                SET
                    deletestatus = :status,
                    createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user_tracker
                WHERE
                    sales_id = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", 'Inactive', PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":id", $data["salesid"], PDO::PARAM_STR);
            $stmt->execute();

            //Update tbl_mop_summary

            $sql = "UPDATE tbl_mop_summary
                SET
                    deletestatus = :status,
                    createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user_tracker
                WHERE
                    sales_id = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", 'Inactive', PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":id", $data["salesid"], PDO::PARAM_STR);
            $stmt->execute();

            //Update tbl_inventory_transactions

            $sql = "UPDATE tbl_inventory_transactions
                SET
                    deletestatus = :status,
                    createddate = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user_tracker
                WHERE
                    pr_queue_code = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", 'Inactive', PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":id", $data["salesid"], PDO::PARAM_STR);
            $stmt->execute();

            $sql = "UPDATE tbl_accounting_transactions
                SET
                    deletestatus = :status,
                    createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user_tracker
                WHERE
                    reference = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", 'Inactive', PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":id", $data["salesid"], PDO::PARAM_STR);
            $stmt->execute();

            // //Update tbl_cash_sales_summary_tracker

            // $sql = "UPDATE tbl_cash_sales_summary_tracker

            //     SET

            //         deletestatus = :status,

            //         createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),

            //         usertracker = :user_tracker

            //     WHERE

            //         sales_id = :id";

            // $stmt = $this->conn->prepare($sql);

            // $stmt->bindValue(":status", 'Inactive', PDO::PARAM_STR);

            // $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            // $stmt->bindValue(":id", $data["salesid"], PDO::PARAM_STR);

            // $stmt->execute();

            //Update tbl_void_sales

            $sql = "UPDATE tbl_void_sales
                SET
                    status = :status,
                    createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user_tracker
                WHERE
                    sales_id = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", 'Void', PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":id", $data["salesid"], PDO::PARAM_STR);
            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

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
    public function sqlaccountingEntries($data,$user_id){

        $sql = "SELECT busunitcode FROM tbl_cash_sales_summary_tracker WHERE cash_trans_id = :cash_trans_id";
        
        $stmt = $this->conn->prepare($sql);
        
        $stmt->bindValue(":cash_trans_id", $data["cashtrackingid"], PDO::PARAM_STR);
        
        $stmt->execute();
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if($data["variance"] < 0){
            $multiplier710 = 1; 
            $multiplier100 = -1; 
        }else{
            $multiplier710 = -1;
            $multiplier100 = 1;  
        }

            $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

            $shortUuid = $randomString;

            $shortUuid = "DM-" . $shortUuid;

        $InsertSql = "INSERT INTO tbl_accounting_transactions (transdate, 
                                                document_date, 
                                                glcode, 
                                                slcode, 
                                                amount, 
                                                particulars, 
                                                reference, 
                                                approvalref, 
                                                approvalstatus,  
                                                transactiontype, 
                                                transactionclass, 
                                                menutransacted, 
                                                busunitcode, 
                                                whtxrate, 
                                                menutransactedref, 
                                                deletestatus, 
                                                usertracker, 
                                                createdtime
                                                ) VALUES (CURRENT_TIMESTAMP(),
                                                CURRENT_TIMESTAMP(),
                                                :glcode,
                                                :bankaccount,
                                                :totalCashCount,
                                                'SALES',
                                                :reference,
                                                'AUTO',
                                                'Posted',
                                                'SALESTRACKER',
                                                'SALESTRACKER',
                                                :menutransacted,
                                                :busunitcode,
                                                '0',
                                                :menutransactedref,
                                                'Active',
                                                :user_tracker,
                                                CURRENT_TIMESTAMP())";

            $InsertSql2 = "INSERT INTO tbl_accounting_transactions (transdate, 
                                                document_date, 
                                                glcode, 
                                                slcode, 
                                                amount, 
                                                particulars, 
                                                reference, 
                                                approvalref, 
                                                approvalstatus,  
                                                transactiontype, 
                                                transactionclass, 
                                                menutransacted, 
                                                busunitcode, 
                                                whtxrate, 
                                                menutransactedref, 
                                                deletestatus, 
                                                usertracker, 
                                                createdtime
                                                ) VALUES (CURRENT_TIMESTAMP(),
                                                CURRENT_TIMESTAMP(),
                                                :glcode,
                                                :bankaccount,
                                                :totalCashCount,
                                                'SALES',
                                                :reference,
                                                'AUTO',
                                                'Posted',
                                                'SALESTRACKER',
                                                'SALESTRACKER',
                                                :menutransacted,
                                                :busunitcode,
                                                '0',
                                                :menutransactedref,
                                                'Active',
                                                :user_tracker,
                                                CURRENT_TIMESTAMP())";

                $stmt1 = $this->conn->prepare($InsertSql);
               
                $stmt1->bindValue(":glcode", '710', PDO::PARAM_STR);
                $stmt1->bindValue(":bankaccount", '71001', PDO::PARAM_STR);
                $stmt1->bindValue(":totalCashCount", ($data["variance"] * $multiplier710) , PDO::PARAM_STR);
                $stmt1->bindValue(":reference", $data["cashtrackingid"], PDO::PARAM_STR);
                $stmt1->bindValue(":menutransacted", '/salestracker', PDO::PARAM_STR);
                $stmt1->bindValue(":busunitcode", $row["busunitcode"], PDO::PARAM_STR);
                $stmt1->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                $stmt1->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            
                $stmt1->execute();

                $stmt2 = $this->conn->prepare($InsertSql2);
               
                $stmt2->bindValue(":glcode", '100', PDO::PARAM_STR);
                $stmt2->bindValue(":bankaccount", '10002', PDO::PARAM_STR);
                $stmt2->bindValue(":totalCashCount", ($data["variance"] * $multiplier100), PDO::PARAM_STR);
                $stmt2->bindValue(":reference", $data["cashtrackingid"], PDO::PARAM_STR);
                $stmt2->bindValue(":menutransacted", '/salestracker', PDO::PARAM_STR);
                $stmt2->bindValue(":busunitcode", $row["busunitcode"], PDO::PARAM_STR);
                $stmt2->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                $stmt2->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            
                $stmt2->execute();
     
    }

}
