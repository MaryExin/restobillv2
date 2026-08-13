<?php

class PettyCashGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }
   public function getthepettycashSummaryDetails($data)
    {
        $results = [];
    
        foreach ($data["CheckedItems"]["checkedItemRefs"] as $item) {
            $sql = "SELECT t1.transdate,t1.particulars,t1.reference,t1.glcode,t1.slcode,t1.amount,t2.gl_description,t1.menutransactedref FROM tbl_accounting_transactions as t1 
                    LEFT JOIN  lkp_chart_of_accounts as t2 on t2.slcode = t1.slcode
                    WHERE t1.menutransacted = '/pettycashtransaction' 
                    AND t1.menutransactedref = :menutransactedref 
                    AND t1.amount > 0";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":menutransactedref", $item, PDO::PARAM_STR);
            $stmt->execute();
            
             $results = array_merge($results, $stmt->fetchAll(PDO::FETCH_ASSOC));
        }
        
        return $results;
    }
    public function pettycashForReplenish($data)
    {
        $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

        $shortUuid = $randomString;

        $shortUuid = "PCFR-" . $shortUuid;

        foreach ($data["CheckedItems"]["checkedItemRefs"] as $item) {
            // Update fetched records in tbl_pettycash_summary
                $updateSql = "UPDATE tbl_accounting_transactions 
                          SET othermapref = :menutransactedref, othermaprefroute = :othermaprefroute
                          WHERE menutransactedref = :menutransactedref_1";
                $updateStmt = $this->conn->prepare($updateSql);  
                $updateStmt->bindValue(":menutransactedref", $item, PDO::PARAM_STR);
                $updateStmt->bindValue(":menutransactedref_1", $item, PDO::PARAM_STR);
                $updateStmt->bindValue(":othermaprefroute", $shortUuid, PDO::PARAM_STR);
                $updateStmt->execute();
            
        }
                   // Fetch emails of users who need to approve disbursements
                    $sql = "SELECT t2.email, t2.uuid, t1.approvaldescription,t1.approvalseq
                    FROM tbl_approval_creds AS t1 
                    LEFT JOIN tbl_users_global_assignment AS t2 
                    ON t2.uuid = t1.empid 
                    WHERE moduletoapprove = '/disbursements' AND busunitcode = :busunitcode AND  t1.deletestatus  = 'Active'";
                    
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":busunitcode", $data['busunitCode'], PDO::PARAM_STR);
                    $stmt->execute();

                    $emails = [];
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $emails[] = $row;
                    }

                    // Create an instance of EmailSendController
                    $emailController = new EmailSendController();

                    // Send email to each fetched email address
                    foreach ($emails as $email) {
                        $emailController->sendEmail(
                            "mail.lightemsupport.com",               // SMTP server
                            "accounts@lightemsupport.com",      // SMTP username
                            "LightemAccounts@2025",                       // SMTP password (highly insecure, consider using environment variables)
                            "accounts@lightemsupport.com",      // From email address
                            $email['email'],                     // To email address
                            "Ready for approval",                // Email subject
                            "<html>
                                <body>
                                    <center>
                                        <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo' width='100'><br>
                                        <p style='font-size: 20px;'>Hello User, " . htmlspecialchars($email['uuid']) . " <br><br>
                                       APPROVER " . htmlspecialchars($email['approvalseq']) . " in Disbursement <br><br>There is a request for replenishment that needs your approval.</p>
                                    </center>
                                </body>
                            </html>"
                        );
                    }

                    return "Success";
    }

    public function getDisbursementVoucherDetails($data)
    {
        // Get PETTY CASH Details
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
                    tbl_accounting_transactions.busunitcode,
                    lkp_busunits.name,
                    lkp_busunits.address,
                    lkp_chart_of_accounts.sl_description,
                    lkp_corporation.address,
                    concat(tbl_users_global_assignment.firstname, ' ', tbl_users_global_assignment.middlename, ' ', tbl_users_global_assignment.lastname) as fullname
                FROM
                    tbl_accounting_transactions
                        LEFT OUTER JOIN lkp_busunits ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
                        LEFT OUTER JOIN lkp_corporation ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
                        AND lkp_busunits.corpcode = lkp_corporation.corp_code
                        LEFT OUTER JOIN lkp_chart_of_accounts ON lkp_chart_of_accounts.slcode = tbl_accounting_transactions.slcode
                        AND lkp_busunits.corpcode = lkp_corporation.corp_code
                        LEFT JOIN tbl_users_global_assignment ON tbl_accounting_transactions.usertracker = tbl_users_global_assignment.uuid
                WHERE tbl_accounting_transactions.amount < 0 
                AND tbl_accounting_transactions.menutransactedref =  :menutransactedref";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":menutransactedref", $data["reference"], PDO::PARAM_STR);
        $stmt->execute();

        $pettycashDetailsdata = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $pettycashDetailsdata[] = $row;
        }

        // Get PETTYCASH Entries
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
                    lkp_chart_of_accounts.sl_description
                FROM
                    tbl_accounting_transactions
                        LEFT OUTER JOIN lkp_chart_of_accounts ON tbl_accounting_transactions.slcode = lkp_chart_of_accounts.slcode
                WHERE
                    menutransactedref = :pettycashid
                    AND tbl_accounting_transactions.deletestatus = 'Active'
                ORDER BY tbl_accounting_transactions.amount DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":pettycashid", $data["reference"], PDO::PARAM_STR);
        $stmt->execute();

        $pettycashEntriesdata = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $pettycashEntriesdata[] = $row;
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
            "pettycashdetails" => $pettycashDetailsdata,
            "pettycashentries" => $pettycashEntriesdata,
            "approvalsdata" => $approvalsData
        ];
    }

    public function getClearingItems($page, $pageIndex, $pageData, $search, $busunitcode) 
    {
        // for the output of the petty cash voucher
        $sql ="SELECT DISTINCT 
                    t1.menutransactedref,
                    t1.slcode,
                    ROUND(amount * -1,2) as amount,
                    t1.transdate,t1.particulars,
                    t1.reference,
                    t1.busunitcode,
                    t2.sl_description,
                    t1.approvalstatus, 
                    t1.transactiontype,
                    t1.transactionclass,
                    t1.othermapref,
                    othermaprefroute,
                    t1.supplier_code,
                    DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), transdate) AS days_since_transdate
                    FROM tbl_accounting_transactions  as t1
                    LEFT JOIN lkp_chart_of_accounts as t2 ON t2.slcode = t1.slcode
                    WHERE t1.reference LIKE :search AND t1.deletestatus = 'Active' 
                   
                    AND t1.amount < 0 
                    AND menutransacted = '/pettycashtransaction' 
                    GROUP BY t1.menutransactedref
                    ORDER BY t1.seq DESC 
                    ";
// LIMIT $pageIndex,$pageData  AND t1.busunitcode = :busunitcode
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
        
        // $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
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

    public function insertEntries($user_id, $data){
        try {
                $this->conn->beginTransaction();

                $this->conn->exec("SET time_zone = 'Asia/Manila'");

                // $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

                // $shortUuid = $randomString;

                // $shortUuid = "PV-" . $shortUuid;
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
            $shortUuid = "DB-" . $year . $formattedId;

        // Check if the reference already exists
        // $reference = $data["PettyCash"][0]["reference"];
        // $busunit = $data["PettyCash"][0]["busunitcode"];

        // $sql = "SELECT * FROM tbl_accounting_transactions WHERE reference = :reference AND busunitcode = :busunitcode LIMIT 1";

        // $stmt = $this->conn->prepare($sql);
        // $stmt->bindValue(":reference", $reference);
        // $stmt->bindValue(":busunitcode", $busunit);
        // $stmt->execute();

        // $ref = $stmt->fetch(PDO::FETCH_ASSOC);

        // if($ref) {
        //     echo json_encode(["message" => "Reference already exists"]);
        //     exit;
        // }
            
            // Prepare the SQL statement with column names
            $sql = "INSERT INTO tbl_accounting_transactions (
            seq, transdate, document_date, glcode, slcode, amount, particulars, reference, approvalref, approvalstatus, 
            customer_id, supplier_code, project_code, cost_center_code, othermapref, othermaprefroute, transactiontype, 
            transactionclass, menutransacted, busunitcode, vattaxtype, whtxatc, whtxrate, menutransactedref, deletestatus, 
            usertracker, createdtime
            ) VALUES (
            default, :transdate, CURRENT_TIMESTAMP(), :glcode, :slcode, :amount, :particulars, :reference, 'Initial', 'Pending', 
            null, :supplier, null, null, null, null, 
            :transactiontype,:transactionclass, '/pettycashtransaction', :busunitcode, :vattaxtype, 0, 0, 
            :menutransactedref, 'Active', :usertracker, CURRENT_TIMESTAMP()
            )";
                $stmt = $this->conn->prepare($sql);
    
                foreach ($data["PettyCash"] as $Entries) {
                
                $glcode = substr($Entries["glsl"], 0, 3);
                
                $stmt->bindParam(":glcode", $glcode);
                
                $stmt->bindParam(":slcode", $Entries["glsl"], PDO::PARAM_STR);
                
                $stmt->bindParam(":amount", $Entries["amount"], PDO::PARAM_STR);
                
                $stmt->bindParam(":particulars", $Entries["particulars"], PDO::PARAM_STR);
                
                $stmt->bindParam(":reference", $Entries["reference"], PDO::PARAM_STR);          

                $stmt->bindParam(":transdate", $Entries["transDate"]);
                
                $stmt->bindParam(":transactiontype", $Entries["transType"]);
                
                $stmt->bindParam(":transactionclass", $Entries["transClass"]);
                
                $stmt->bindParam(":busunitcode", $Entries["busunitcode"]);
                
                $stmt->bindParam(":vattaxtype", $Entries["taxType"]);

                $stmt->bindParam(":supplier", $Entries["supplier"]);
                
                // $stmt->bindParam(":whtxatc", $Entries["whtxCode"]);
                
                // $stmt->bindParam(":whtxrate", $Entries["whtxRate"]);
                
                $stmt->bindParam(":menutransactedref", $shortUuid);
                
                $stmt->bindParam(":usertracker", $user_id);
                
                $stmt->execute();
                }

            $log = "INSERT INTO tbl_logs ()
            VALUES (default, 'LIGHTEM', :busunitcode, 'PettyCash', 'Petty Cash Transaction', :particulars, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $logstmt = $this->conn->prepare($log);
            $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $logstmt->bindValue(":busunitcode", $data["PettyCash"][0]["busunitcode"], PDO::PARAM_STR);
            $logstmt->bindValue(":particulars", $data["PettyCash"][0]["particulars"], PDO::PARAM_STR);
            $logstmt->execute();

                $this->conn->commit();
            $pettycashbusunit = null;
            $pettycashamount = null;
            $pettycashparticulars = null;

            foreach ($data["PettyCash"] as $pettycash ){
                    $pettycashbusunit = $pettycash["busunitcode"];
                    $pettycashamount = $pettycash["amount"] * -1;
                    $pettycashparticulars = $pettycash["particulars"];
                    
            }
            if ($pettycashbusunit) {

                // Fetch emails of users who need to approve disbursements
                    $sql = "SELECT t2.email, t2.uuid, t1.approvaldescription,t1.approvalseq
                    FROM tbl_approval_creds AS t1 
                    LEFT JOIN tbl_users_global_assignment AS t2 
                    ON t2.uuid = t1.empid 
                    WHERE moduletoapprove = '/pettycashtransaction' AND busunitcode = :busunitcode AND t1.deletestatus  = 'Active'";
                    
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":busunitcode",$pettycashbusunit, PDO::PARAM_STR);
                    $stmt->execute();

                    $emails = [];
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $emails[] = $row;
                    }

                    // Create an instance of EmailSendController
                    $emailController = new EmailSendController();

                    // Send email to each fetched email address
                    foreach ($emails as $email) {
                        $emailController->sendEmail(
                            "mail.lightemsupport.com",               // SMTP server
                            "accounts@lightemsupport.com",      // SMTP username
                            "LightemAccounts@2025",                       // SMTP password (highly insecure, consider using environment variables)
                            "accounts@lightemsupport.com",      // From email address
                            $email['email'],                     // To email address
                            "Ready for approval",                // Email subject
                            "<html>
                                <body>
                                    <center>
                                        <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo' width='100'><br>
                                        <p style='font-size: 20px;'>Hello User, " . htmlspecialchars($email['uuid']) . " <br><br>
                                        APPROVER " . htmlspecialchars($email['approvalseq']) . " in Petty cash transaction <br><br>
                                        There is a request for Petty cash transaction that needs your approval.</p>
                                        <p  >Reference: " . htmlspecialchars($shortUuid) . "<br>
                                        Amount: " . htmlspecialchars($pettycashamount) . "<br>
                                        Particulars: " . htmlspecialchars($pettycashparticulars) . "</p>
                                    </center>
                                </body>
                            </html>"
                        );
                    }
            }

                    return "Success";
    
                $this->conn->commit();
    
                echo json_encode(["message" => "Success"]);

                } catch (PDOException $e) {

                $this->conn->rollBack();

                echo json_encode(["message" => "Error: " . $e->getMessage()]);
            }
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
    public function getGroupData($user_id,$data){

        $sql = "SELECT transdate,t1.slcode,t2.sl_description as gl_description,amount,t1.particulars,menutransactedref FROM tbl_accounting_transactions as t1 LEFT JOIN lkp_chart_of_accounts as t2 on t1.slcode = t2.slcode    
        WHERE othermaprefroute = :othermaprefroute AND amount > 0  ";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":othermaprefroute", $data['othermaprefroute'], PDO::PARAM_STR);
        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data[] = $row;
        }   

        return $data ; 
    }
}
