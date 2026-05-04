
<?php

class JournalVoucherGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    private function normalizeAccountingPeriod($accountingPeriod)
    {
        if (!is_string($accountingPeriod) || trim($accountingPeriod) === '') {
            throw new InvalidArgumentException("Invalid accounting period.");
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $accountingPeriod);

        if (!$date) {
            throw new InvalidArgumentException("Invalid accounting period.");
        }

        return $date->modify('last day of this month')->format('Y-m-d');
    }

    private function assertEditablePendingReference($reference, $transdate)
    {
        $sql = "SELECT approvalstatus, busunitcode, transdate
                FROM tbl_accounting_transactions
                WHERE menutransactedref = :reference_lookup
                  AND deletestatus = 'Active'
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":reference_lookup", $reference, PDO::PARAM_STR);
        $stmt->execute();

        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            throw new Exception("Transaction reference not found for editing.");
        }

        $currentStatus = strtoupper(trim((string) ($existing["approvalstatus"] ?? "")));
        if ($currentStatus !== "PENDING") {
            throw new Exception("Only pending transactions can be edited.");
        }

        $normalizedAccountingPeriod = $this->normalizeAccountingPeriod(
            $transdate ?: ($existing["transdate"] ?? "")
        );

        $checkSql = "SELECT MAX(accounting_period) AS accounting_period
                     FROM tbl_accounting_period
                     WHERE busunitcode = :busunitcode_check";
        $checkStmt = $this->conn->prepare($checkSql);
        $checkStmt->bindValue(":busunitcode_check", $existing["busunitcode"] ?? "", PDO::PARAM_STR);
        $checkStmt->execute();
        $closedPeriod = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (
            !empty($closedPeriod["accounting_period"]) &&
            $closedPeriod["accounting_period"] >= $normalizedAccountingPeriod
        ) {
            throw new Exception("Cannot edit this transaction because its accounting period is already closed.");
        }
    }

    public function getDisbursementVoucherDetails($data)
    {
        // Get journal Details
        $sql = "SELECT 
                    tbl_accounting_transactions.seq,
                    tbl_accounting_transactions.menutransactedref,
                    tbl_accounting_transactions.transdate,
                    tbl_accounting_transactions.document_date,
                    tbl_accounting_transactions.reference,
                    tbl_accounting_transactions.glcode,
                    tbl_accounting_transactions.slcode,
                    ROUND(SUM(tbl_accounting_transactions.amount), 2) * -1 AS amount,
                    tbl_accounting_transactions.particulars,
                    tbl_accounting_transactions.supplier_code,
                    tbl_accounting_transactions.busunitcode,
                    lkp_busunits.name,
                    lkp_busunits.address,
                    lkp_corporation.corp_name,
                    lkp_corporation.address,
                    lkp_supplier.supplier_name,
                    tbl_accounting_transactions.usertracker,
                    CONCAT(tbl_users_global_assignment.firstname, ' ', tbl_users_global_assignment.middlename, ' ', tbl_users_global_assignment.lastname) as fullname
                FROM
                    tbl_accounting_transactions
                        LEFT OUTER JOIN lkp_supplier ON tbl_accounting_transactions.supplier_code = lkp_supplier.supplier_code
                        LEFT OUTER JOIN lkp_busunits ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
                        LEFT OUTER JOIN lkp_corporation ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode 
                        LEFT JOIN tbl_users_global_assignment ON tbl_accounting_transactions.usertracker = tbl_users_global_assignment.uuid
                       
                WHERE tbl_accounting_transactions.menutransactedref =  :menutransactedref";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":menutransactedref", $data["reference"], PDO::PARAM_STR);
        $stmt->execute();

        $JournalDetailsdata = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $JournalDetailsdata[] = $row;
        }

        // Get Journal Entries
        $sql = "SELECT DISTINCT
                    tbl_accounting_transactions.seq,
                    tbl_accounting_transactions.transdate,
                    tbl_accounting_transactions.document_date,
                    tbl_accounting_transactions.glcode,
                    tbl_accounting_transactions.slcode,
                    tbl_accounting_transactions.amount,
                    tbl_accounting_transactions.particulars,
                    tbl_accounting_transactions.reference,
                    tbl_accounting_transactions.approvalref,
                    tbl_accounting_transactions.approvalstatus,
                    tbl_accounting_transactions.customer_id,
                    tbl_accounting_transactions.supplier_code,
                    tbl_accounting_transactions.project_code,
                    tbl_accounting_transactions.cost_center_code,
                    tbl_accounting_transactions.othermapref,
                    tbl_accounting_transactions.othermaprefroute,
                    tbl_accounting_transactions.transactiontype,
                    tbl_accounting_transactions.menutransacted,
                    tbl_accounting_transactions.busunitcode,
                    tbl_accounting_transactions.vattaxtype,
                    tbl_accounting_transactions.whtxatc,
                    tbl_accounting_transactions.whtxrate,
                    tbl_accounting_transactions.menutransactedref,
                    lkp_chart_of_accounts.gl_description,
                    tbl_accounting_transactions.transactionclass,
                    lkp_chart_of_accounts.sl_description,
                    lkp_supplier.supplier_name,
                    tbl_customer_details.customername,
                    B1.name,
                    tbl_fixed_assets.quantity,
                    tbl_fixed_assets.class,
                    tbl_fixed_assets.purchasedate,
                    tbl_fixed_assets.usefullifeinmos,
                    tbl_fixed_assets.residualvalue
                FROM
                    tbl_accounting_transactions
                        LEFT OUTER JOIN lkp_chart_of_accounts ON tbl_accounting_transactions.slcode = lkp_chart_of_accounts.slcode
                        LEFT OUTER JOIN lkp_supplier ON tbl_accounting_transactions.supplier_code = lkp_supplier.supplier_code
                        LEFT OUTER JOIN tbl_customer_details ON tbl_accounting_transactions.customer_id = tbl_customer_details.customer_id
                        LEFT OUTER JOIN lkp_busunits AS B1 ON tbl_accounting_transactions.supplier_code = B1.busunitcode
                        LEFT OUTER JOIN tbl_fixed_assets ON tbl_accounting_transactions.menutransactedref = tbl_fixed_assets.menutransactedref
                        AND tbl_fixed_assets.deletestatus = 'Active'
                WHERE
                    tbl_accounting_transactions.menutransactedref = :journalid
                    AND tbl_accounting_transactions.deletestatus = 'Active'
                    
                GROUP BY tbl_accounting_transactions.seq

                ORDER BY tbl_accounting_transactions.amount DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":journalid", $data["reference"], PDO::PARAM_STR);
        $stmt->execute();

        $JournalEntriesdata = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $JournalEntriesdata[] = $row;
        }

        // Get Approvals
        $sql = "SELECT  
                    tbl_approval_creds.approvalid,
                    tbl_approval_creds.empid,
                    tbl_approval_creds.moduletoapprove,
                    tbl_approval_creds.approvaldescription,
                    tbl_approval_creds.approvalseq,
                    tbl_approval_creds.busunitcode,
                    CONCAT(tbl_employees.firstname, ' ', tbl_employees.middlename, ' ', tbl_employees.lastname) AS approvername,
                    tbl_employees.position
                FROM 
                    tbl_approval_creds
                        LEFT OUTER JOIN     tbl_employees ON tbl_approval_creds.empid = tbl_employees.empid
                WHERE tbl_approval_creds.deletestatus = 'Active'
                    AND moduletoapprove = :route
                    AND busunitcode = :busunitcode
                ORDER BY tbl_approval_creds.approvalseq ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":route", $data["route"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
        $stmt->execute();

        $approvalsData = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $approvalsData[] = $row;
        }

        return [
            "journaltdetails" => $JournalDetailsdata,
            "journalentries" => $JournalEntriesdata,
            "approvalsdata" => $approvalsData
        ];
    }

    public function getClearingItems($page, $pageIndex, $pageData, $search,  $busunitcode) 
    {
        // for the output of the journal voucher
        // , 
        //             DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), transdate) AS days_since_transdate
        $sql ="SELECT DISTINCT 
                    t1.menutransactedref,
                    t1.slcode,
                    ROUND(SUM(amount * -1),2) as amount,
                    t1.transdate,t1.particulars,
                    t1.reference,t1.supplier_code,
                    lkp_supplier.supplier_name,
                    t1.busunitcode,
                    t1.approvalstatus,
                    B1.name
                    FROM tbl_accounting_transactions  as t1
                    LEFT OUTER JOIN lkp_supplier ON t1.supplier_code = lkp_supplier.supplier_code
                    LEFT OUTER JOIN lkp_busunits AS B1 ON t1.supplier_code = B1.busunitcode
                    WHERE t1.reference LIKE :search AND t1.deletestatus = 'Active' 
                    AND t1.busunitcode = :busunitcode
                    AND t1.amount < 0 
                    AND menutransacted = '/journalvoucher' 
                    GROUP BY t1.menutransactedref
                    ORDER BY t1.seq DESC 
                    ";
        // LIMIT $pageIndex,$pageData
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
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

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {
        $sql = "SELECT tbl_disbursements.reference, tbl_disbursements.document_ref, tbl_disbursements.transdate, tbl_disbursements.sl_code,
                    tbl_disbursements.sl_description, SUM(tbl_disbursements.amount) AS amount, tbl_disbursements.particulars,
                    tbl_disbursements.payee_code, lkp_supplier.supplier_name, lkp_supplier.supplier_name, lkp_supplier.tin,
                    lkp_supplier.address, tbl_disbursements.seq, tbl_disbursements.payment_status, tbl_disbursements.menutransactedref,
                    tbl_disbursements.busunitcode
                FROM
                    tbl_disbursements
                        LEFT JOIN lkp_supplier ON tbl_disbursements.payee_code = lkp_supplier.supplier_code
                WHERE
                    tbl_disbursements.reference LIKE :search
                    AND tbl_disbursements.deletestatus = 'Active'
                GROUP BY tbl_disbursements.reference
                ORDER BY tbl_disbursements.seq DESC
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

    public function getProjectCodes() 
    {
        $sql = "SELECT project_code, project_name FROM lkp_projects WHERE deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data[] = $row;
        }

        return $data;
    }

    public function insertEntries($user_id, $data)
    {
        // try 
        // {
            $this->conn->beginTransaction();

            $this->conn->exec("SET time_zone = 'Asia/Manila'");
            
            $sql = "SELECT COUNT(DISTINCT menutransactedref) AS total FROM tbl_accounting_transactions";

            $stmt = $this->conn->prepare($sql);
            
            $stmt->execute();
            
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $id = 1; // Default value in case there are no entries
            
            // Get the current year in 2-digit format
            $year = date("y"); 
            
            if ($result['total'] > 0) {
                $id = $result['total'] + 1; // Next total
            } else {
                $id = 1; // Starting point if no entries exist
            }
            
            // Format ID to 8 digits with leading zeros
            $formattedId = str_pad($id, 8, '0', STR_PAD_LEFT);
            
            // Combine everything into the final short UUID
            $shortUuid = "JV-" . $year . $formattedId;
            if(!isset($data["module"]) && $data["journalEntries"][0]["approvalref"] === "Auto"){   
            $sql = "SELECT approvalid FROM tbl_approval_creds WHERE 
            empid = :empid  
            AND busunitcode = :busunitcode 
            AND moduletoapprove = '/journalvoucher' AND deletestatus = 'Active'";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":empid", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":busunitcode", $data["journalEntries"][0]["busunitcode"], PDO::PARAM_STR);
            $stmt->execute();
            $resultapprovalid = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$resultapprovalid || !isset($resultapprovalid['approvalid'])) {
                die(json_encode(["message" => "Approver_Error"]));
            }
            }
            if($data["jv_no"] == "")
            {

            
                $sql = "INSERT INTO tbl_accounting_transactions () 
                VALUES (
                default, :transsDate, :docRefDate, :glcode, :slcode,
                :amount, :particulars, :reference, :approvalref,
                :approvalstatus, :customer, :supplier_code, null,
                null, null, null, :transactiontype, :transactionclass, '/journalvoucher',
                :busunitcode, :vattaxtype, :whtxatc, :whtxrate,
                :menutransactedref, 'Active', :usertracker, CURRENT_TIMESTAMP()
                )";
    
                $stmt = $this->conn->prepare($sql);
    
                foreach ($data["journalEntries"] as $Entries) {
                
                $glcode = substr($Entries["glsl"], 0, 3);
               
                $approvalRefValue = ($Entries["approvalref"] != 'Auto') ? $Entries["approvalref"] : $resultapprovalid["approvalid"];
                $approvalStatusValue = ($Entries["approvalref"] != 'Auto') ? "Pending" : "Posted";
                
                $stmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
                
                $stmt->bindValue(":slcode", $Entries["glsl"], PDO::PARAM_STR);
                
                $stmt->bindValue(":amount", $Entries["amount"], PDO::PARAM_STR);

                $stmt->bindValue(":transsDate", $Entries["transsDate"], PDO::PARAM_STR);

                $stmt->bindValue(":docRefDate", $Entries["docRefDate"], PDO::PARAM_STR);

                $stmt->bindValue(":approvalref", $approvalRefValue, PDO::PARAM_STR);
                
                $stmt->bindValue(":approvalstatus", $approvalStatusValue, PDO::PARAM_STR);
                
                $stmt->bindValue(":particulars", $Entries["particulars"], PDO::PARAM_STR);
                
                $stmt->bindValue(":reference", $Entries["reference"], PDO::PARAM_STR);         

                $stmt->bindValue(":customer", $Entries["customer"], PDO::PARAM_STR); 

                $stmt->bindValue(":supplier_code", $Entries["supplier"], PDO::PARAM_STR);
                
                $stmt->bindValue(":transactiontype", $Entries["transType"], PDO::PARAM_STR);
                
                $stmt->bindValue(":transactionclass", $Entries["transClass"], PDO::PARAM_STR);
                
                $stmt->bindValue(":busunitcode", $Entries["busunitcode"], PDO::PARAM_STR);
                
                $stmt->bindValue(":vattaxtype", $Entries["taxType"], PDO::PARAM_STR);
                
                $stmt->bindValue(":whtxatc", $Entries["whtxCode"], PDO::PARAM_STR);
                
                $stmt->bindValue(":whtxrate", $Entries["whtxRate"], PDO::PARAM_STR);
                
                $stmt->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                
                $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                
                $stmt->execute();

                
            }
            if($data["journalEntries"][0]["approvalref"] === 'Auto'){
                // Insert to approval history
                $sql = "INSERT INTO tbl_approval_history () 
                    VALUES(default,:menutransactedref,:approvalid,'Active',:usertracker,DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":approvalid", $resultapprovalid["approvalid"], PDO::PARAM_STR);
                $stmt->bindValue(":menutransactedref",$shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
                }
            }
            else
            {
                $this->assertEditablePendingReference($data["jv_no"], $data["journalEntries"][0]["transsDate"] ?? "");

                $sql = "DELETE FROM tbl_accounting_transactions WHERE menutransactedref = :menutransactedref";
                $stmt = $this->conn->prepare($sql);
                $stmt->bindParam(":menutransactedref", $data["jv_no"]);
                $stmt->execute();
                
                $sql = "INSERT INTO tbl_accounting_transactions () 
                VALUES (
                default, :transsDate,:docRefDate, :glcode, :slcode, :amount, :particulars, :reference, 'Initial',
                'Pending', null, :supplier_code, null, null, null, null,
                :transactiontype, :transactionclass, '/journalvoucher', :busunitcode, :vattaxtype, :whtxatc, :whtxrate,
                :menutransactedref, 'Active', :usertracker, CURRENT_TIMESTAMP()
                )";
    
                $stmt = $this->conn->prepare($sql);
    
                foreach ($data["journalEntries"] as $Entries) {
                
                $glcode = substr($Entries["glsl"], 0, 3);
                
                $stmt->bindParam(":glcode", $glcode);
                
                $stmt->bindParam(":slcode", $Entries["glsl"], PDO::PARAM_STR);
                
                $stmt->bindParam(":amount", $Entries["amount"], PDO::PARAM_STR);
                
                $stmt->bindParam(":particulars", $Entries["particulars"], PDO::PARAM_STR);
                
                $stmt->bindParam(":reference", $Entries["reference"], PDO::PARAM_STR);  

                $stmt->bindParam(":transsDate", $Entries["transsDate"], PDO::PARAM_STR);

                $stmt->bindParam(":docRefDate", $Entries["docRefDate"], PDO::PARAM_STR);        

                $stmt->bindParam(":supplier_code", $Entries["supplier"]);
                
                $stmt->bindParam(":transactiontype", $Entries["transType"]);
                
                $stmt->bindParam(":transactionclass", $Entries["transClass"]);
                
                $stmt->bindParam(":busunitcode", $Entries["busunitcode"]);
                
                $stmt->bindParam(":vattaxtype", $Entries["taxType"]);
                
                $stmt->bindParam(":whtxatc", $Entries["whtxCode"]);
                
                $stmt->bindParam(":whtxrate", $Entries["whtxRate"]);
                
                $stmt->bindParam(":menutransactedref", $data["jv_no"]);
                
                $stmt->bindParam(":usertracker", $user_id);
                
                $stmt->execute();
                }

                $sql = "UPDATE tbl_accounting_transactions SET particulars = :particulars, reference = :reference, customer_id = :customer_id,
                supplier_code = :supplier_code, transactiontype = :transactiontype, transactionclass = :transactionclass, vattaxtype =  :vattaxtype,
                whtxatc = :whtxatc, whtxrate = :whtxrate WHERE menutransactedref = :menutransactedref";
    
                $stmt = $this->conn->prepare($sql);

                $stmt->bindParam(":particulars", $data["particulars"]);
                $stmt->bindParam(":reference", $data["reference"]);
                $stmt->bindParam(":customer_id", $data["customer"]);
                $stmt->bindParam(":supplier_code", $data["supplier"]);
                $stmt->bindParam(":transactiontype", $data["transactionType"]);
                $stmt->bindParam(":transactionclass", $data["itemclass"]);
                $stmt->bindParam(":vattaxtype", $data["taxType"]);
                $stmt->bindParam(":whtxatc", $data["withHoldingTaxCode"]);
                $stmt->bindParam(":whtxrate", $data["withHoldingTaxRate"]);
                $stmt->bindParam(":menutransactedref", $data["jv_no"]);

                $stmt->execute();


            }
             

               


    
                $this->conn->commit();
    
                echo json_encode(["message" => "Success"]);

        // } 
            
        //     catch (PDOException $e) 
        //     {
        //         $this->conn->rollBack();
        //         echo json_encode(["message" => "Error: " . $e->getMessage()]);
        //     }
    
    }

    public function approval($user_id, $data)
    {

       try {

                // Begin the transaction
                $this->conn->beginTransaction();

                $sql = "SELECT approvaldescription FROM tbl_approval_creds WHERE moduletoapprove = '/journalvoucher' ORDER BY approvaldescription DESC LIMIT 1";
                
                $stmt = $this->conn->prepare($sql);

                $stmt->execute();

                $result = $stmt->fetch(PDO::FETCH_ASSOC);

                $result = $result['approvaldescription'];

                $status = $data["approvaldescription"];

                if($result == $data["approvaldescription"])
                {
                    $status = 'Posted';
                }
                // Update Accounting Approval
                $sql = "UPDATE tbl_accounting_transactions SET approvalref = :approvalid,

                        approvalstatus = :approvaldescription, createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)

                        WHERE menutransactedref = :reference";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":approvalid", $data["approvalid"], PDO::PARAM_STR);

                $stmt->bindValue(":approvaldescription", $status, PDO::PARAM_STR);

                $stmt->bindValue(":reference", $data["reference"], PDO::PARAM_STR);

                $stmt->execute();


                // Insert to Approval History
                $sql = "INSERT INTO tbl_approval_history ()  

                VALUES (default, :reference, 

                :approvalid, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":approvalid", $data["approvalid"], PDO::PARAM_STR);

                $stmt->bindValue(":reference", $data["reference"], PDO::PARAM_STR);

                $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

                
                $this->conn->commit();

                echo json_encode(["message" => "Success"]);

            } catch (Exception $e) {

                // Rollback the transaction if something failed

                $this->conn->rollBack();

                // Handle the exception

                echo json_encode(["message" => "Error", "error" => $e->getMessage()]);

            }



    }

    public function getjvData($user_id, $data)
    {
               $sql = "SELECT DISTINCT
                    tbl_accounting_transactions.seq,
                    tbl_accounting_transactions.transdate,
                    tbl_accounting_transactions.document_date,
                    tbl_accounting_transactions.glcode,
                    tbl_accounting_transactions.slcode,
                    tbl_accounting_transactions.amount,
                    tbl_accounting_transactions.particulars,
                    tbl_accounting_transactions.reference,
                    tbl_accounting_transactions.approvalref,
                    tbl_accounting_transactions.approvalstatus,
                    tbl_accounting_transactions.customer_id,
                    tbl_accounting_transactions.supplier_code,
                    tbl_accounting_transactions.project_code,
                    tbl_accounting_transactions.cost_center_code,
                    tbl_accounting_transactions.othermapref,
                    tbl_accounting_transactions.othermaprefroute,
                    tbl_accounting_transactions.transactiontype,
                    tbl_accounting_transactions.menutransacted,
                    tbl_accounting_transactions.busunitcode,
                    tbl_accounting_transactions.vattaxtype,
                    tbl_accounting_transactions.whtxatc,
                    tbl_accounting_transactions.whtxrate,
                    tbl_accounting_transactions.menutransactedref,
                    lkp_chart_of_accounts.gl_description,
                    tbl_accounting_transactions.transactionclass,
                    lkp_chart_of_accounts.sl_description,
                    lkp_supplier.supplier_name,
                    tbl_customer_details.customername,
                    B1.name
                FROM
                    tbl_accounting_transactions
                        LEFT OUTER JOIN lkp_chart_of_accounts ON tbl_accounting_transactions.slcode = lkp_chart_of_accounts.slcode
                        LEFT OUTER JOIN lkp_supplier ON tbl_accounting_transactions.supplier_code = lkp_supplier.supplier_code
                        LEFT OUTER JOIN tbl_customer_details ON tbl_accounting_transactions.customer_id = tbl_customer_details.customer_id
                        LEFT OUTER JOIN lkp_busunits AS B1 ON tbl_accounting_transactions.supplier_code = B1.busunitcode
                WHERE
                    tbl_accounting_transactions.menutransactedref = :menutransactedref
                    AND tbl_accounting_transactions.deletestatus = 'Active'
                    
                GROUP BY tbl_accounting_transactions.seq

                ORDER BY tbl_accounting_transactions.amount DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":menutransactedref", $data["reference"], PDO::PARAM_STR);
        $stmt->execute();

        $JournalEntriesdata = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $JournalEntriesdata[] = $row;
        }

                        echo json_encode($JournalEntriesdata);
    }
}
