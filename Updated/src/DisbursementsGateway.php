<?php







class DisbursementsGateway
{







    private $conn;







    public function __construct(Database $database)
    {







        $this->conn = $database->getConnection();







    }

      public function createForUser($user_id, $data)
    {
        try {

            //Post to Delivery Assignment
            $this->conn->beginTransaction();

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
            // Approval id
            if(!isset($data["module"]) && $data["disbursements"][0]["approvalref"] === "Auto"){      
            $sql = "SELECT approvalid FROM tbl_approval_creds WHERE 
            empid = :empid  
            AND busunitcode = :busunitcode 
            AND moduletoapprove = '/disbursements' AND deletestatus = 'Active'";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":empid", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":busunitcode", $data["disbursements"][0]["busUnitCode"], PDO::PARAM_STR);
            $stmt->execute();
            $resultapprovalid = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$resultapprovalid || !isset($resultapprovalid['approvalid'])) {
                die(json_encode(["message" => "Approver_Error"]));
            }
            }

            

            // Insert into Table Disbursements
            $sql = "INSERT INTO tbl_disbursements () VALUES (default, :reference,:transactiondate,
                :invoicedate,:slCode, :slDescription, :amount, :particulars, :payee_code, :busunitcode,
                 :payment_status, :document_ref,'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["disbursements"] as $disbursement) {
          
                $stmt->bindValue(":reference", $shortUuid, PDO::PARAM_STR);
                // $stmt->bindValue(":referenceid", $id, PDO::PARAM_STR);
                $stmt->bindValue(":transactiondate", $disbursement["transactiondate"], PDO::PARAM_STR);
                $stmt->bindValue(":invoicedate", $disbursement["invoicedate"], PDO::PARAM_STR);
                $stmt->bindValue(":slCode", $disbursement["slCode"], PDO::PARAM_STR);
                $stmt->bindValue(":slDescription", $disbursement["slDescription"], PDO::PARAM_STR);
                $stmt->bindValue(":amount", abs($disbursement["amount"]), PDO::PARAM_STR);
                $stmt->bindValue(":particulars", $disbursement["particulars"], PDO::PARAM_STR);
                $stmt->bindValue(":payee_code", $disbursement["payeeCode"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $disbursement["busUnitCode"], PDO::PARAM_STR);
                $stmt->bindValue(":payment_status", $disbursement["paymentStatus"], PDO::PARAM_STR);
                $stmt->bindValue(":document_ref", $disbursement["documentref"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();


            }

            // Insert into Table Accounting Entries
            $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, :transactiondate,
               :invoicedate , :glcode, :slcode, :amount, :particulars, :reference, :approvalref, :approvalstatus, 
                null, :payee_code, null, null, :checkdate, :referenceid, 'Purchases', :transactionclass, '/disbursements', :busunitcode,
                :vat_tax_type, :whtx_atc, :whtx_rate, :disbursementid,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["disbursements"] as $disbursement) {
              
                $stmt->bindValue(":transactiondate", $disbursement["transactiondate"], PDO::PARAM_STR);
                $stmt->bindValue(":referenceid", $id, PDO::PARAM_STR);
                $stmt->bindValue(":invoicedate", $disbursement["invoicedate"], PDO::PARAM_STR);
                $stmt->bindValue(":checkdate", $disbursement["checkDate"], PDO::PARAM_STR);
                $stmt->bindValue(":glcode", substr($disbursement["slCode"], 0, 3), PDO::PARAM_STR);
                $stmt->bindValue(":slcode", $disbursement["slCode"], PDO::PARAM_STR);
                $stmt->bindValue(":amount", $disbursement["amount"], PDO::PARAM_STR);
                $stmt->bindValue(":approvalref", ($disbursement["approvalref"] != 'Auto') ? $disbursement["approvalref"] : $resultapprovalid["approvalid"], PDO::PARAM_STR);
                $stmt->bindValue(":approvalstatus", ($disbursement["approvalref"] != 'Auto') ? "Pending" : "Posted", PDO::PARAM_STR);
                $stmt->bindValue(":particulars", $disbursement["particulars"], PDO::PARAM_STR);
                $stmt->bindValue(":reference", $disbursement["documentref"], PDO::PARAM_STR);
                $stmt->bindValue(":payee_code", $disbursement["payeeCode"], PDO::PARAM_STR);
                $stmt->bindValue(":transactionclass", $disbursement["transactionClass"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $disbursement["busUnitCode"], PDO::PARAM_STR);
                $stmt->bindValue(":vat_tax_type", $disbursement["taxType"], PDO::PARAM_STR);
                $stmt->bindValue(":whtx_atc", $disbursement["atc"], PDO::PARAM_STR);
                $stmt->bindValue(":whtx_rate", $disbursement["whtxRate"], PDO::PARAM_STR);
                $stmt->bindValue(":disbursementid", $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();

            }

            $this->conn->commit();
            // Auto Approve 
            if($disbursement["approvalref"] === 'Auto'){
                // Insert to approval history
                $sql = "INSERT INTO tbl_approval_history () 
                    VALUES(default,:menutransactedref,:approvalid,'Active',:usertracker,DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":approvalid", $resultapprovalid["approvalid"], PDO::PARAM_STR);
                $stmt->bindValue(":menutransactedref",$shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }
            
            


            $disbursementBusunit = null;
            $disbursementAmount = null;
            $disbursementParticulars = null;

            foreach ($data["disbursements"] as $disbursement) {
                    $disbursementBusunit = $disbursement["busUnitCode"];
                    $disbursementAmount = $disbursement["amount"];
                    $disbursementParticulars = $disbursement["particulars"];
                    
            }
            if ($disbursementBusunit) {

                // Fetch emails of users who need to approve disbursements
                    $sql = "SELECT t2.email, t2.uuid, t1.approvaldescription,t1.approvalseq
                    FROM tbl_approval_creds AS t1 
                    LEFT JOIN tbl_users_global_assignment AS t2 
                    ON t2.uuid = t1.empid 
                    WHERE moduletoapprove = '/disbursements' AND busunitcode = :busunitcode AND t1.deletestatus  = 'Active'";
                    
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":busunitcode",$disbursementBusunit, PDO::PARAM_STR);
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
                                        APPROVER " . htmlspecialchars($email['approvalseq']) . " in Disbursment  <br><br>
                                        There is a request for disbursement that needs your approval.</p>
                                        <p  >Reference: " . htmlspecialchars($shortUuid) . "<br>
                                        Amount: " . htmlspecialchars($disbursementAmount * -1 ) . "<br>
                                        Particulars: " . htmlspecialchars($disbursementParticulars) . "</p>
                                    </center>
                                </body>
                            </html>"
                        );
                    }
            }

            $log = "INSERT INTO tbl_logs ()
            VALUES (default, 'LIGHTEM', :busunitcode, 'Disbursement', 'Disbursement', :particulars, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $logstmt = $this->conn->prepare($log);
            $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $logstmt->bindValue(":busunitcode", $data["disbursements"][0]["busUnitCode"], PDO::PARAM_STR);
            $logstmt->bindValue(":particulars", $data["disbursements"][0]["particulars"], PDO::PARAM_STR);
            $logstmt->execute();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }







    }




    public function getDisbursementVoucherDetails($data)
    {

        // Get Disbursement Details



        $sql = "SELECT  

                    tbl_accounting_transactions.seq,

                    tbl_accounting_transactions.menutransactedref,

                    tbl_accounting_transactions.transdate,

                    tbl_accounting_transactions.document_date,

                    tbl_accounting_transactions.reference,

                    tbl_accounting_transactions.glcode,

                    tbl_accounting_transactions.slcode,

                    ROUND(SUM(tbl_accounting_transactions.amount),

                            2) * -1 AS amount,

                    tbl_accounting_transactions.particulars,

                    tbl_accounting_transactions.supplier_code,

                    tbl_accounting_transactions.busunitcode,

                    lkp_busunits.name,

                    lkp_busunits.address,

                    lkp_corporation.corp_name,

                    lkp_corporation.address,

                   
                     CASE 
        WHEN   tbl_accounting_transactions.particulars = 'For-Replenish' 
        THEN (
            SELECT t1.sl_description
            FROM lkp_chart_of_accounts  as t1
            LEFT JOIN tbl_disbursements as t2 on t1.slcode = t2.sl_code
            WHERE t2.sl_code like '%101%' and t2.reference = tbl_accounting_transactions.menutransactedref
            LIMIT 1
        ) 
        WHEN LEFT(tbl_accounting_transactions.menutransactedref, 2) = 'CV' 
    THEN (
       COALESCE(( SELECT t1.sl_description
            FROM lkp_chart_of_accounts  as t1
            LEFT JOIN tbl_disbursements as t2 on t1.slcode = t2.sl_code
             LEFT JOIN tbl_disbursement_check as t3 on t3.disbursement_id = t2.reference
            WHERE t2.sl_code like '%101%' and t3.check_id = tbl_accounting_transactions.menutransactedref
            LIMIT 1),lkp_supplier.supplier_name)
    )
        ELSE  lkp_supplier.supplier_name
    END AS supplier_name,

                    concat(tbl_users_global_assignment.firstname, ' ', tbl_users_global_assignment.middlename, ' ', tbl_users_global_assignment.lastname) as fullname

                FROM

                    tbl_accounting_transactions

                        LEFT OUTER JOIN

                    lkp_supplier ON tbl_accounting_transactions.supplier_code = lkp_supplier.supplier_code

                        LEFT OUTER JOIN

                    lkp_busunits ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode

                        LEFT OUTER JOIN

                    lkp_corporation ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode

                        AND lkp_busunits.corpcode = lkp_corporation.corp_code
                        
                    LEFT JOIN tbl_users_global_assignment ON tbl_accounting_transactions.usertracker = tbl_users_global_assignment.uuid

                    -- Payable Clearing Account and Withholding Tax Account    

                    WHERE (tbl_accounting_transactions.slcode = 40099 OR tbl_accounting_transactions.slcode = 46001) 

                    

                    AND tbl_accounting_transactions.menutransactedref =  :menutransactedref  ";







        $stmt = $this->conn->prepare($sql);







        $stmt->bindValue(":menutransactedref", $data["reference"], PDO::PARAM_STR);







        $stmt->execute();







        $disbursementDetailsdata = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $disbursementDetailsdata[] = $row;







        }





        // Get Disbursement Entries
         $sqlQuery = "";

            if($data["Paymemtref"] != NULL){

                $ref =  "'" . $data["Paymemtref"] . "'";

                $sqlQuery = "AND reference = $ref" ;
              
            }


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

            menutransactedref = :disbursementid

            AND tbl_accounting_transactions.deletestatus = 'Active'

            GROUP BY seq

            ORDER BY tbl_accounting_transactions.amount DESC";


            




        $stmt = $this->conn->prepare($sql);







        $stmt->bindValue(":disbursementid", $data["reference"], PDO::PARAM_STR);







        $stmt->execute();







        $disbursementEntriesdata = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $disbursementEntriesdata[] = $row;







        }





        // Get Approvals



        $sql = "SELECT  

                tbl_approval_creds.approvalid,

                tbl_approval_creds.empid,

                tbl_approval_creds.moduletoapprove,

                tbl_approval_creds.approvaldescription,

                tbl_approval_creds.approvalseq,

                tbl_approval_creds.busunitcode,

                CONCAT(tbl_employees.firstname,' ',tbl_employees.middlename,' ',tbl_employees.lastname) AS approvername,

                tbl_employees.position

                FROM 

                    tbl_approval_creds

                    LEFT OUTER JOIN tbl_employees ON tbl_approval_creds.empid = tbl_employees.empid

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
            "disbursementdetails" => $disbursementDetailsdata,

            "disbursemententries" => $disbursementEntriesdata,

            "approvalsdata" => $approvalsData
        ];





    }









    public function getClearingItems($page, $pageIndex, $pageData, $search, $min, $max, $busunitcode) 
    {







            $sql = "SELECT DISTINCT



                            tbl_disbursements.seq,



                            tbl_main.reference,



                            tbl_main.sl_code,



                            ROUND(SUM(tbl_main.total_amount), 2) AS amount,



                            tbl_disbursements.transdate,



                            tbl_disbursements.particulars,



                            tbl_disbursements.document_ref,



                            tbl_disbursements.payee_code,



                            tbl_disbursements.busunitcode,



                            tbl_disbursements.payment_status,



                            CASE 
        WHEN  tbl_disbursements.particulars = 'For-Replenish' 
        THEN (
            SELECT t1.sl_description
            FROM lkp_chart_of_accounts  as t1
            LEFT JOIN tbl_disbursements as t2 on t1.slcode = t2.sl_code
            WHERE t2.sl_code like '%101%' and t2.reference = tbl_main.reference
            LIMIT 1
        ) 
        ELSE  lkp_supplier.supplier_name
    END AS supplier_name,

                            

                            tbl_distinct_accounting_trans.approvalstatus,



                            DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), tbl_disbursements.transdate) AS days_since_transdate



                        FROM



                            (SELECT



                                tbl_disbursements.reference,



                                tbl_disbursements.sl_code,



                                tbl_disbursements.amount AS total_amount



                            FROM



                                tbl_disbursements



                            WHERE



                                tbl_disbursements.sl_code = 40099



                                -- OR tbl_disbursements.sl_code = 46001



                                AND tbl_disbursements.deletestatus = 'Active'



                            UNION ALL



                            SELECT



                                tbl_disbursements_clearing.disbursement_reference,



                                '40099',



                                tbl_disbursements_clearing.amount_cleared * - 1 AS total_amount



                            FROM



                                tbl_disbursements_clearing



                            WHERE



                                tbl_disbursements_clearing.deletestatus = 'Active') tbl_main



                        LEFT OUTER JOIN



                            tbl_disbursements ON tbl_main.reference = tbl_disbursements.reference



                            AND tbl_main.sl_code = tbl_disbursements.sl_code



                        LEFT OUTER JOIN



                            lkp_supplier ON tbl_disbursements.payee_code = lkp_supplier.supplier_code

                            

                    LEFT JOIN



                            (SELECT DISTINCT menutransactedref, menutransacted, approvalstatus 

                            FROM tbl_accounting_transactions WHERE deletestatus = 'Active') tbl_distinct_accounting_trans

                            ON tbl_disbursements.reference = tbl_distinct_accounting_trans.menutransactedref

                            AND tbl_distinct_accounting_trans.menutransacted = '/disbursements'   



                        WHERE

                    
                            tbl_main.reference LIKE :search

                            AND DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), tbl_disbursements.transdate)
                            >= IF(:min <= 0, -100000, :min2) 
                            AND DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), tbl_disbursements.transdate) <= :max

                            AND tbl_disbursements.busunitcode = :busunitcode

                        GROUP BY



                            tbl_main.reference
                        



                        HAVING



                            ROUND(SUM(tbl_main.total_amount), 2) > 0



                        ORDER BY tbl_disbursements.seq DESC



           ";







        $stmt = $this->conn->prepare($sql);




        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

        $stmt->bindValue(":min", $min, PDO::PARAM_STR);
        
        $stmt->bindValue(":min2", $min, PDO::PARAM_STR);

        $stmt->bindValue(":max", $max, PDO::PARAM_STR);

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







        $sql = "SELECT t1.menutransactedref as reference, t1.transdate,t1.document_date, t1.slcode,



             t1.reference as ref,t1.amount, t1.particulars,



            t1.supplier_code,
             COALESCE(
    (SELECT t1.sl_description
     FROM lkp_chart_of_accounts AS t1
     LEFT JOIN tbl_disbursements AS t2 ON t1.slcode = t2.sl_code
     WHERE t2.sl_code LIKE '%101%' 
       AND t2.reference = tbl_disbursement_check.disbursement_id
     LIMIT 1
    ), 
    lkp_supplier.supplier_name
)

   as supplier_name, lkp_supplier.tin,



            lkp_supplier.address, lkp_supplier.atc, lkp_supplier.whtx_rate, lkp_supplier.product_type,



            t1.busunitcode, lkp_busunits.name, tbl_disbursements.payment_status,



            DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), tbl_disbursements.transdate) AS days_since_transdate,

            tbl_disbursements_clearing.payment_type,t1.usertracker,t1.approvalstatus



            FROM tbl_accounting_transactions as t1

            LEFT OUTER JOIN tbl_disbursement_check ON tbl_disbursement_check.check_id = t1.menutransactedref

			LEFT OUTER JOIN tbl_disbursements  ON tbl_disbursement_check.disbursement_id =  tbl_disbursements.reference OR t1.menutransactedref = tbl_disbursements.reference

            LEFT OUTER JOIN lkp_supplier ON tbl_disbursements.payee_code = lkp_supplier.supplier_code

            LEFT OUTER JOIN lkp_busunits ON tbl_disbursements.busunitcode = lkp_busunits.busunitcode

            LEFT OUTER JOIN tbl_disbursements_clearing ON tbl_disbursements.reference = tbl_disbursements_clearing.disbursement_reference

            WHERE 



            t1.reference LIKE :search

			AND (t1.slcode = 40099)
            
            AND t1.menutransacted = '/disbursements'
            

            AND tbl_disbursements.payment_status IN ('Partial','Paid','Unpaid')
            
            AND t1.amount > 0

            GROUP BY t1.reference,t1.menutransactedref

            ORDER BY DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), tbl_disbursements.transdate) ASC,

            tbl_disbursements.createdtime DESC

            ,lkp_supplier.supplier_name ASC, tbl_disbursements.amount ASC,t1.seq DESC



           ";







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
            //Post to Clearing

            $this->conn->beginTransaction();
            
            $reference = "CV" . substr($data["disbursementReference"], 2);
            $referencedis = "DB" . substr($data["disbursementReference"], 2);

             $sql = "SELECT othermaprefroute FROM tbl_accounting_transactions WHERE menutransactedref = :menutransactedref";
             $stmt = $this->conn->prepare($sql);
             $stmt->bindValue(":menutransactedref", $referencedis, PDO::PARAM_STR);
             $stmt->execute();
             $resultref = $stmt->fetch(PDO::FETCH_ASSOC); // Use PDO::FETCH_ASSOC to get an associative array
            
            $sql = "INSERT INTO tbl_disbursements_clearing () VALUES (default, :disbursement_reference,
                DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :amount, :payment_reference, :payment_type,
                 :payment_date, :slCode, :slDescription, :particulars,
                 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":disbursement_reference", $referencedis, PDO::PARAM_STR);
            // $stmt->bindValue(":disbursement_id", $resultref['othermaprefroute'] , PDO::PARAM_STR);
            $stmt->bindValue(":amount", $data["amount"], PDO::PARAM_STR);
            $stmt->bindValue(":payment_reference", $data["payment_reference"], PDO::PARAM_STR);
            $stmt->bindValue(":payment_type", $data["payment_type"], PDO::PARAM_STR);
            $stmt->bindValue(":payment_date", $data["payment_date"], PDO::PARAM_STR);
            $stmt->bindValue(":slCode", $data["slCode"], PDO::PARAM_STR);
            $stmt->bindValue(":slDescription", $data["slDescription"], PDO::PARAM_STR);
            $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            // Update Status
           

            $sql = "UPDATE tbl_disbursements SET payment_status = :status,
            usertracker = :user_tracker
             WHERE
                reference = :reference";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);
            // $stmt->bindValue(":ref", $reference);
            $stmt->bindValue(":reference", $data["disbursementReference"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            //Insert into Table Accounting Entries Debit Cash Received

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
            $shortUuid = "CV-" . $year . $formattedId;

            $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, :transactiondate,
               :documentdate , :glcode, :slcode, :amount, :particulars, :reference, 'Auto', 'Posted', 
                null, :payee_code, null, null, null, null, 'Payments', 'Payments', '/disbursements', :busunitcode,
                'NA', 'NA', 0, :menutransactedref,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";


            $stmt = $this->conn->prepare($sql);
                // $stmt->bindValue(":disbursement_id", $resultref['othermaprefroute'] , PDO::PARAM_STR);
                $stmt->bindValue(":transactiondate", $data["transaction_date"], PDO::PARAM_STR);
                $stmt->bindValue(":documentdate", $data["payment_date"], PDO::PARAM_STR);
                $stmt->bindValue(":glcode", substr($data["slCode"], 0, 3), PDO::PARAM_STR);
                $stmt->bindValue(":slcode", $data["slCode"], PDO::PARAM_STR);
                $stmt->bindValue(":amount", $data["amount"] * -1, PDO::PARAM_STR);
                $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);
                $stmt->bindValue(":reference", $data["payment_reference"], PDO::PARAM_STR);
                $stmt->bindValue(":payee_code", $data["supplierCode"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                $stmt->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();


        // Insert into Table Accounting Entries Debit Credit Payable Clearing
            $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, :transactiondate,
               :documentdate , :glcode, :slcode, :amount, :particulars, :reference, 'Auto', 'Posted', 
                null, :payee_code, null, null, null, null, 'Payments', 'Payments', '/disbursements', :busunitcode,
                'NA', 'NA', 0, :menutransactedref,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);
                // $stmt->bindValue(":disbursement_id", $resultref['othermaprefroute'] , PDO::PARAM_STR);
                $stmt->bindValue(":transactiondate", $data["transaction_date"], PDO::PARAM_STR);
                $stmt->bindValue(":documentdate", $data["payment_date"], PDO::PARAM_STR);
                $stmt->bindValue(":glcode", 400, PDO::PARAM_STR);
                $stmt->bindValue(":slcode", 40099, PDO::PARAM_STR);
                $stmt->bindValue(":amount", $data["amount"], PDO::PARAM_STR);
                $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);
                $stmt->bindValue(":reference", $data["payment_reference"], PDO::PARAM_STR);
                $stmt->bindValue(":payee_code", $data["supplierCode"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                $stmt->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            // $sql = "UPDATE tbl_accounting_transactions SET menutransactedref = :ref 
            //     WHERE menutransactedref = :reference";
            // $stmt = $this->conn->prepare($sql);
            // $stmt->bindValue(":ref", $reference);
            // $stmt->bindValue(":reference", $data["disbursementReference"], PDO::PARAM_STR);
            // $stmt->execute();

            // Finalize

               $sql = "INSERT INTO tbl_disbursement_check () VALUES (default,:amount,:disbursement_id,:check_id,'Active',:user_tracker,DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":amount",$data["amount"]);
                $stmt->bindValue(":disbursement_id", $referencedis);
                $stmt->bindValue(":check_id", $shortUuid, PDO::PARAM_STR);
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



