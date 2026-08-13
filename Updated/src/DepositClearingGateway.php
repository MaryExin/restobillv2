<?php

class DepositClearingGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT tbl_disbursements.reference,tbl_disbursements.document_ref, tbl_disbursements.transdate, tbl_disbursements.sl_code,
            tbl_disbursements.sl_description, tbl_disbursements.amount, tbl_disbursements.particulars,
            tbl_disbursements.payee_code, lkp_supplier.supplier_name, lkp_supplier.supplier_name, lkp_supplier.tin,
            lkp_supplier.address, lkp_supplier.atc, lkp_supplier.whtx_rate, lkp_supplier.product_type,
            tbl_disbursements.busunitcode, lkp_busunits.name, tbl_disbursements.payment_status,
            DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), tbl_disbursements.transdate) AS days_since_transdate
            FROM tbl_disbursements
            LEFT OUTER JOIN lkp_supplier ON tbl_disbursements.payee_code = lkp_supplier.supplier_code
            LEFT OUTER JOIN lkp_busunits ON tbl_disbursements.busunitcode = lkp_busunits.busunitcode
            WHERE tbl_disbursements.sl_code = 49901
            AND tbl_disbursements.deletestatus = 'Active'
            AND tbl_disbursements.payment_status <> 'Paid'
            ORDER BY DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), tbl_disbursements.transdate) ASC,
            lkp_supplier.supplier_name ASC, tbl_disbursements.amount ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT
            tbl_cash_sales_summary_tracker.seq, tbl_cash_sales_summary_tracker.cash_trans_id,
            tbl_cash_sales_summary_tracker.cash_count - tbl_cash_sales_summary_tracker.cash_opening_balance
            AS cash_count,
            tbl_cash_sales_summary_tracker.transdate, tbl_cash_sales_summary_tracker.busunitcode ,
            lkp_busunits.name,   tbl_cash_sales_summary_tracker.deposit_status
            FROM tbl_cash_sales_summary_tracker
            LEFT OUTER JOIN lkp_busunits ON tbl_cash_sales_summary_tracker.busunitcode = lkp_busunits.busunitcode
            WHERE tbl_cash_sales_summary_tracker.deletestatus = 'Active'
            AND tbl_cash_sales_summary_tracker.deposit_status = 'UNDEPOSITED'
            AND tbl_cash_sales_summary_tracker.cash_count LIKE :search
            AND  tbl_cash_sales_summary_tracker.cash_count - tbl_cash_sales_summary_tracker.cash_opening_balance > 0 
            ORDER BY tbl_cash_sales_summary_tracker.transdate DESC
            LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        $response = [
            'items' => $data,
            'nextPage' => $page + 1, // Provide the next page number
        ];

        return $response;

    }

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT
            tbl_cash_sales_summary_tracker.seq, tbl_cash_sales_summary_tracker.cash_trans_id,
            SUM(tbl_cash_sales_summary_tracker.cash_count) - SUM(tbl_cash_sales_summary_tracker.cash_opening_balance)
            AS cash_count,
            tbl_cash_sales_summary_tracker.transdate, tbl_cash_sales_summary_tracker.busunitcode ,
            lkp_busunits.name,   tbl_cash_sales_summary_tracker.deposit_status,
            tbl_cash_sales_summary_tracker.deposit_reference, tbl_cash_sales_summary_tracker.depositary_bank_acct,
            tbl_cash_sales_summary_tracker.depositary_bank_desc
            FROM tbl_cash_sales_summary_tracker
            LEFT OUTER JOIN lkp_busunits ON tbl_cash_sales_summary_tracker.busunitcode = lkp_busunits.busunitcode
            WHERE tbl_cash_sales_summary_tracker.deletestatus = 'Active'
            AND tbl_cash_sales_summary_tracker.deposit_status = 'DEPOSITED'
            AND tbl_cash_sales_summary_tracker.deposit_reference LIKE :search
            GROUP BY tbl_cash_sales_summary_tracker.deposit_reference 
            ORDER BY tbl_cash_sales_summary_tracker.transdate DESC,
            tbl_cash_sales_summary_tracker.deposit_reference,
            tbl_cash_sales_summary_tracker.cash_count ASC
            LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        $response = [
            'items' => $data,
            'nextPage' => $page + 1, // Provide the next page number
        ];

        return $response;

    }

    public function getInfiniteReadDataprint($user_id,$data)
    {

        $sql = "SELECT
            tbl_cash_sales_summary_tracker.seq, tbl_cash_sales_summary_tracker.cash_trans_id,
            SUM(tbl_cash_sales_summary_tracker.cash_count) - SUM(tbl_cash_sales_summary_tracker.cash_opening_balance)
            AS cash_count,
            tbl_cash_sales_summary_tracker.transdate, tbl_cash_sales_summary_tracker.busunitcode ,
            lkp_busunits.name,   tbl_cash_sales_summary_tracker.deposit_status,
            tbl_cash_sales_summary_tracker.deposit_reference, tbl_cash_sales_summary_tracker.depositary_bank_acct,
            tbl_cash_sales_summary_tracker.depositary_bank_desc
            FROM tbl_cash_sales_summary_tracker
            LEFT OUTER JOIN lkp_busunits ON tbl_cash_sales_summary_tracker.busunitcode = lkp_busunits.busunitcode
            WHERE tbl_cash_sales_summary_tracker.deletestatus = 'Active'
            AND tbl_cash_sales_summary_tracker.deposit_status = 'DEPOSITED'
            AND  tbl_cash_sales_summary_tracker.depositary_bank_desc = :depositary_bank_desc
            AND tbl_cash_sales_summary_tracker.deposit_reference = :reference
            GROUP BY 
			tbl_cash_sales_summary_tracker.cash_trans_id AND tbl_cash_sales_summary_tracker.transdate
            ORDER BY tbl_cash_sales_summary_tracker.transdate DESC,
            tbl_cash_sales_summary_tracker.deposit_reference,
            tbl_cash_sales_summary_tracker.cash_count ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":reference", $data['reference'], PDO::PARAM_STR);
        $stmt->bindValue(":depositary_bank_desc", $data['depositary_bank_desc'], PDO::PARAM_STR);

        $stmt->execute();
        $data = $stmt->fetchall(PDO::FETCH_ASSOC);
        

      

        echo json_encode(["message"=>$data]);

    }

    public function getClearingData()
    {

        $sql = "SELECT  DISTINCT
            tbl_disbursements_clearing.disbursement_reference, tbl_disbursements_clearing.transdate, tbl_disbursements_clearing.amount_cleared,
            tbl_disbursements_clearing.payment_reference, tbl_disbursements_clearing.payment_type, tbl_disbursements_clearing.payment_date,
            tbl_disbursements_clearing.sl_code, tbl_disbursements_clearing.sl_description, tbl_disbursements_clearing.particulars,
            tbl_disbursements.payment_status
            FROM tbl_disbursements_clearing
            LEFT OUTER JOIN tbl_disbursements ON  tbl_disbursements_clearing.disbursement_reference = tbl_disbursements.reference
            WHERE tbl_disbursements_clearing.deletestatus = 'Active'
            AND tbl_disbursements.payment_status <> 'Paid'";

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

        $sql = "SELECT * FROM lkp_raw_mats ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function clearForUser($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            // Update Status

            $sql = "UPDATE tbl_cash_sales_summary_tracker SET
            deposit_status = 'DEPOSITED', deposit_reference = :reference,
            depositary_bank_acct = :bankaccount, depositary_bank_desc = :bankdescription,
            usertracker = :user_tracker
            WHERE cash_trans_id = :transid";

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
                                                'Deposit',
                                                :reference,
                                                'AUTO',
                                                'Posted',
                                                'DEPOSIT',
                                                'DEPOSIT',
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
                                                'Deposit',
                                                :reference,
                                                'AUTO',
                                                'Posted',
                                                'DEPOSIT',
                                                'DEPOSIT',
                                                :menutransacted,
                                                :busunitcode,
                                                '0',
                                                :menutransactedref,
                                                'Active',
                                                :user_tracker,
                                                CURRENT_TIMESTAMP())";

                $stmt1 = $this->conn->prepare($InsertSql);
               
                $stmt1->bindValue(":glcode", substr($data["bank"], 0, 3), PDO::PARAM_STR);
                $stmt1->bindValue(":bankaccount", $data["bank"], PDO::PARAM_STR);
                $stmt1->bindValue(":totalCashCount", $data["totalCashCount"]   , PDO::PARAM_STR);
                $stmt1->bindValue(":reference", $data["reference"], PDO::PARAM_STR);
                $stmt1->bindValue(":menutransacted", $data["menutransacted"], PDO::PARAM_STR);
                $stmt1->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                $stmt1->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                $stmt1->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            
                $stmt1->execute();

                $stmt2 = $this->conn->prepare($InsertSql2);
               
                $stmt2->bindValue(":glcode", '100', PDO::PARAM_STR);
                $stmt2->bindValue(":bankaccount", '10002', PDO::PARAM_STR);
                $stmt2->bindValue(":totalCashCount", ($data["totalCashCount"]* -1), PDO::PARAM_STR);
                $stmt2->bindValue(":reference", $data["reference"], PDO::PARAM_STR);
                $stmt2->bindValue(":menutransacted", $data["menutransacted"], PDO::PARAM_STR);
                $stmt2->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                $stmt2->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                $stmt2->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            
                $stmt2->execute();

            foreach ($data["clearingitems"][0] as $transactionId) {
                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":reference", $data["reference"], PDO::PARAM_STR);
                $stmt->bindValue(":bankaccount", $data["bank"], PDO::PARAM_STR);
                $stmt->bindValue(":bankdescription", $data["bankdescription"], PDO::PARAM_STR);
                $stmt->bindValue(":transid", $transactionId, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }
            $log = "INSERT INTO tbl_logs ()
            VALUES (default, 'LIGHTEM', :busunitcode, 'Deposit', 'Deposit Clearing', :particulars, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $logstmt = $this->conn->prepare($log);
            $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $logstmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
            $logstmt->bindValue(":particulars", $data["totalCashCount"], PDO::PARAM_STR);
            $logstmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }

    }

}
