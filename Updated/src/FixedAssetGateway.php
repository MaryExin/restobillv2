<?php

class FixedAssetGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
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
                    ROUND(SUM(tbl_accounting_transactions.amount), 2) * -1 AS amount,
                    tbl_accounting_transactions.particulars,
                    tbl_accounting_transactions.supplier_code,
                    tbl_accounting_transactions.busunitcode,
                    lkp_busunits.name,
                    lkp_busunits.address,
                    lkp_corporation.corp_name,
                    lkp_corporation.address,
                    lkp_supplier.supplier_name
                FROM
                    tbl_accounting_transactions
                        LEFT OUTER JOIN lkp_supplier ON tbl_accounting_transactions.supplier_code = lkp_supplier.supplier_code
                        LEFT OUTER JOIN lkp_busunits ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
                        LEFT OUTER JOIN lkp_corporation ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
                        AND lkp_busunits.corpcode = lkp_corporation.corp_code
                WHERE (tbl_accounting_transactions.slcode = 40099 OR tbl_accounting_transactions.slcode = 46001) 
                AND tbl_accounting_transactions.menutransactedref =  :menutransactedref";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":menutransactedref", $data["reference"], PDO::PARAM_STR);
        $stmt->execute();

        $disbursementDetailsdata = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $disbursementDetailsdata[] = $row;
        }

        // Get Disbursement Entries
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
            "disbursementdetails" => $disbursementDetailsdata,
            "disbursemententries" => $disbursementEntriesdata,
            "approvalsdata" => $approvalsData
        ];
    }

    public function getClearingItems($page, $pageIndex, $pageData, $search, $busunitcode) 
    {
        try {
            // Query to fetch the journal voucher items
            $sql1 = "
            SELECT DISTINCT
                ROUND(SUM(amount * -1), 2) AS amount, 
                T1.approvalstatus,
                T2.busunitcode, 
                T2.particulars, 
                T2.seq, 
                T2.slcode,
                concat(T3.firstname, ' ', T3.middlename, ' ', T3.lastname) as fullname,
                T2.transdate, 
                T2.menutransactedref,
                T2.reference, 
                T1.usefullifeinmos, 
                T1.residualvalue,
                T1.transactiontype
            FROM 
                tbl_fixed_assets AS T1
            JOIN 
                tbl_accounting_transactions AS T2
                ON T1.menutransactedref = T2.menutransactedref
            JOIN tbl_users_global_assignment AS T3
                ON T2.usertracker = T3.uuid
            LEFT OUTER JOIN lkp_supplier AS T4
                ON T2.supplier_code = T4.supplier_code
            WHERE 
                T2.reference LIKE :search 
                AND T1.deletestatus = 'Active' 
                AND T2.busunitcode = :busunitcode
                AND T2.amount < 0 
                AND T2.transactionclass != 'Payments'
            GROUP BY 
                T2.menutransactedref
            ORDER BY 
                T2.seq DESC  
            LIMIT 
                :pageIndex, :pageData";

            $stmt1 = $this->conn->prepare($sql1);
            $stmt1->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
            $stmt1->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
            $stmt1->bindValue(":pageIndex", (int)$pageIndex, PDO::PARAM_INT);
            $stmt1->bindValue(":pageData", (int)$pageData, PDO::PARAM_INT);
            $stmt1->execute();

            $journalItems = [];
            while ($row = $stmt1->fetch(PDO::FETCH_ASSOC)) {
                $journalItems[] = $row;
            }


            return [
                'items' => $journalItems,
            
                'nextPage' => $page + 1, // Provide the next page number

            ];

        } catch (PDOException $e) {
            // Handle SQL or database connection errors
            return [
                'error' => $e->getMessage()
            ];
        }
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
        try {
        $this->conn->beginTransaction();

        $this->conn->exec("SET time_zone = 'Asia/Manila'");


            $sql = "SELECT COUNT(DISTINCT menutransactedref) AS total FROM tbl_accounting_transactions";

            $stmt = $this->conn->prepare($sql);
            
            $stmt->execute();
            
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $id = 1; 
            
            $year = date("y"); 
            
            if ($result['total'] > 0) {
                $id = $result['total'] + 1; 
            } else {
                $id = 1; 
            }
            
            $formattedId = str_pad($id, 8, '0', STR_PAD_LEFT);
            
            $shortUuid = "FA-" . $year . $formattedId;

        // Prepare the SQL statement with column names
        $sql = "INSERT INTO tbl_accounting_transactions () 
                VALUES (
                    default, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), :glcode, :slcode, :amount, :particulars, :reference, :approvalref,
                    :approvalstatus, null, :supplier_code, null, null, null, :othermaprefroute,
                    :transactionType, :transactionclass, '/disbursements', :busunitcode, :vattaxtype, :whtxatc, :whtxrate,
                    :menutransactedref, 'Active', :usertracker, CURRENT_TIMESTAMP()
                )";

        $stmt = $this->conn->prepare($sql);

        foreach ($data["FixedAsset"] as $Entries) {
            
            if($Entries["transactionType"] == 'Setup')
            {
                $transactiontype = 'Posted';
                $approvalref = "APL" . $year . $formattedId;

            }
            else
            {
                $transactiontype = 'Pending';
                $approvalref = "Initial";

            }
            
            $glcode = substr($Entries["glsl"], 0, 3);

            $stmt->bindValue(":glcode", $glcode);
            
            $stmt->bindValue(":slcode", $Entries["glsl"], PDO::PARAM_STR);
            
            $stmt->bindValue(":amount", $Entries["amount"], PDO::PARAM_STR);
            
            $stmt->bindValue(":particulars", $Entries["particulars"], PDO::PARAM_STR);
            
            $stmt->bindValue(":approvalstatus", $transactiontype);

            $stmt->bindValue(":approvalref", $approvalref); 

            $stmt->bindValue(":reference", $Entries["reference"], PDO::PARAM_STR);            
            
            $stmt->bindValue(":supplier_code", $Entries["suppliercode"]);

            $stmt->bindValue(":othermaprefroute", $id);
            
            $stmt->bindValue(":transactionType", $Entries["transactionType"]);
            
            $stmt->bindValue(":transactionclass", $Entries["classtype"]);
            
            $stmt->bindValue(":busunitcode", $Entries["busunitcode"]);
            
            $stmt->bindValue(":vattaxtype", $Entries["taxType"]);
            
            $stmt->bindValue(":whtxatc", $Entries["withHoldingTaxCode"]);
            
            $stmt->bindValue(":whtxrate", $Entries["withHoldingTaxRate"]);
            
            $stmt->bindValue(":menutransactedref", $shortUuid);
            
            $stmt->bindValue(":usertracker", $user_id);

            $stmt->execute();



        }
        //insert to fix asset
        $sql = "INSERT INTO tbl_fixed_assets ()
        VALUES(default, :fixedassetid, :description, :quantity, :class, :transactiontype,
        :purchasedate, :usefullifeinmos, :residualvalue, 'Pending', :menutransactedref, 'Active',
        :usertracker, CURRENT_TIMESTAMP(), :total_value)";
        
        $stmt = $this->conn->prepare($sql);
        
        $stmt->bindValue(":fixedassetid", $shortUuid);
        
        $stmt->bindValue(":description", $Entries["particulars"]);

        $stmt->bindValue(":quantity", $Entries["quantity"]);
        
        $stmt->bindValue(":class", $Entries["classtype"]);

        $stmt->bindValue(":transactiontype", $Entries["transactionType"]);
        
        $stmt->bindValue(":purchasedate", $Entries["purchaseDate"]);
        
        $stmt->bindValue(":usefullifeinmos", $Entries["usefullife"]);

        $stmt->bindValue(":residualvalue", $Entries["residualvalue"]);

        $stmt->bindValue(":menutransactedref", $shortUuid);
        
        $stmt->bindValue(":usertracker", $user_id);

        $stmt->bindValue(":total_value", $Entries["amount"] * -1);

        $stmt->execute();

        //lkp_acctg_transactions_map
        $uuiATM = "ATM-" . $year . $formattedId;

        $sql = "INSERT INTO lkp_acctg_transactions_map ()
            VALUES(default, :uuid, :transactionid, :glsl,
            '/fixedasset', 'Active', :usertracker, CURRENT_TIMESTAMP())";

        $stmt = $this->conn->prepare($sql);

        foreach ($data["FixedAsset"] as $Entries) {

        $stmt->bindValue(":uuid", $uuiATM);
        
        $stmt->bindValue(":transactionid", $shortUuid);
        
        $stmt->bindValue(":glsl", $Entries["glsl"]);
        
        $stmt->bindValue(":usertracker", $user_id);

        $stmt->execute();

        }

        //tbl_disburement
       $uuidDB = "DB-" . $year . $formattedId;
       $uuidSP = "SP-" . $year . $formattedId;
      $sql = "INSERT INTO tbl_disbursements ()
          VALUES(default, :reference, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(),
          :sl_code, :sl_description, :amount, :particulars,
          :payee_code, :busunitcode, 'Unpaid', :document_ref,
          'Inactive', :usertracker, CURRENT_TIMESTAMP())";

      $stmt = $this->conn->prepare($sql);

      foreach ($data["FixedAsset"] as $Entries) {
      
      $amount = abs($Entries["amount"]);

      $stmt->bindValue(":reference", $uuidDB);
      
      $stmt->bindValue(":sl_code", $Entries["glsl"]);
      
      $stmt->bindValue(":sl_description", $Entries["glslName"]);
      
      $stmt->bindValue(":amount", $amount);
      
      $stmt->bindValue(":particulars", $Entries["particulars"]);
      
      $stmt->bindValue(":payee_code", $Entries["suppliercode"]);
      
      $stmt->bindValue(":busunitcode", $Entries["busunitcode"]);
      
      $stmt->bindValue(":document_ref", $Entries["reference"]);
      
      $stmt->bindValue(":usertracker", $user_id);

      if($Entries["transactionType"] == "Purchases")
      {
        $stmt->execute();
      }

        
        }

        $log = "INSERT INTO tbl_logs ()
        VALUES (default, 'LIGHTEM', :busunitcode, 'FixedAssets', 'FixedAssets', :particulars, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $logstmt = $this->conn->prepare($log);
        $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
        $logstmt->bindValue(":busunitcode", $data["FixedAsset"][0]["busunitcode"], PDO::PARAM_STR);
        $logstmt->bindValue(":particulars", $data["FixedAsset"][0]["particulars"], PDO::PARAM_STR);
        $logstmt->execute();       

       $this->conn->commit();

       $fixedassetbusunit = null;
            $fixedassetamount = null;
            $fixedassetparticulars = null;

            foreach ($data["FixedAsset"] as $fixedasset ){
                 if($fixedasset["transactionType"] !== 'Setup')
            {
                    $fixedassetbusunit = $fixedasset["busunitcode"];
                    $fixedassetamount = $fixedasset["amount"] * -1;
                    $fixedassetparticulars = $fixedasset["particulars"];
            }else{
                    $fixedassetbusunit = null;
                    $fixedassetamount = null;
                    $fixedassetparticulars = null;
                    }
           
                    
                    
            }
            if ($fixedassetbusunit) {

                // Fetch emails of users who need to approve disbursements
                    $sql = "SELECT t2.email, t2.uuid, t1.approvaldescription,t1.approvalseq
                    FROM tbl_approval_creds AS t1 
                    LEFT JOIN tbl_users_global_assignment AS t2 
                    ON t2.uuid = t1.empid 
                    WHERE moduletoapprove = '/fixedasset' AND busunitcode = :busunitcode AND t1.deletestatus  = 'Active'";
                    
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":busunitcode",$fixedassetbusunit, PDO::PARAM_STR);
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
                            "accounts@lightemsupport.com",    // From email address
                            $email['email'],                     // To email address
                            "Ready for approval",                // Email subject
                            "<html>
                                <body>
                                    <center>
                                        <img src='https://jeremiahd61.sg-host.com/images/app/logo.png' alt='Logo' width='100'><br>
                                        <p style='font-size: 20px;'>Hello User, " . htmlspecialchars($email['uuid']) . " <br><br>
                                        APPROVER " . htmlspecialchars($email['approvalseq']) . " in Fixed asset <br><br>
                                        There is a request for fixed asset that needs your approval.</p>
                                        <p  >Reference: " . htmlspecialchars($shortUuid) . "<br>
                                        Amount: " . htmlspecialchars($fixedassetamount) . "<br>
                                        Particulars: " . htmlspecialchars($fixedassetparticulars) . "</p>
                                    </center>
                                </body>
                            </html>"
                        );
                    }
            }

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

    public function summaryofFixedAssetsValue($page, $pageIndex, $pageData, $search, $busunitcode)
    {
        // Query to fetch summary data
        $sql2 = "
        SELECT 
            T2.slcode as summary_slcode, 
            T1.class as summary_description,
            SUM(T2.amount) AS summary_total_amount,
            SUM(T1.residualvalue) AS summary_total_residual_value,
            SUM((T2.amount - residualvalue) / usefullifeinmos) AS summary_total_depreciation,
            SUM(T1.total_carrying_value) AS summary_total_carrying_value
        FROM 
            tbl_fixed_assets AS T1
        JOIN 
            tbl_accounting_transactions AS T2
            ON T1.menutransactedref = T2.menutransactedref
        WHERE 
            T1.deletestatus = 'Active' 
            AND T2.busunitcode = :busunitcode
            AND T2.amount > 0 
            AND T1.approvalstatus = 'Posted'
        GROUP BY 
            T1.class
        ORDER BY 
            T2.seq DESC";

        $stmt2 = $this->conn->prepare($sql2);
        $stmt2->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt2->execute();

        $summaryData = [];
        while ($row = $stmt2->fetch(PDO::FETCH_ASSOC)) {
            // Ensure values are numeric
            $row['summary_total_residual_value'] = (float) $row['summary_total_residual_value'];
            $row['summary_total_carrying_value'] = (float) $row['summary_total_carrying_value'];
            $summaryData[] = $row;
        }

        return [
            'summaryData' => $summaryData,
        ];
    }

    public function depreciation($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();
    
            $this->conn->exec("SET time_zone = 'Asia/Manila'");
    
            $sql = "SELECT * FROM tbl_fixed_assets AS T1
                    JOIN tbl_accounting_transactions AS T2
                    ON T1.fixedassetid = T2.menutransactedref
                    WHERE approvalstatus = 'Posted'
                    GROUP BY fixedassetid";
    
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
    
            $summaryData = [];
            
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $summaryData[] = $row;
            }
    
            $sql = "UPDATE tbl_fixed_assets SET total_carrying_value = :total_carrying_value WHERE fixedassetid = :fixedassetid";
            $stmt = $this->conn->prepare($sql);
    
            foreach ($summaryData as $fixedassets) {
                
                $totaldepreciation =  ($fixedassets["amount"] - $fixedassets["residualvalue"]) / $fixedassets["usefullifeinmos"];
                
                $totalcarryingamount = $fixedassets["total_carrying_value"] - $totaldepreciation;
                //var_dump($totalcarryingamount);
                // echo '--amount-- ' . $fixedassets["amount"] . '---- ';
                // echo '--totaldepreciation-- ' . $totaldepreciation . '---- ';
                // echo '--totalcarryingamount-- ' . $totalcarryingamount . '---- ';

                $stmt->bindValue(":total_carrying_value", $totalcarryingamount);
                $stmt->bindValue(":fixedassetid", $fixedassets["fixedassetid"]);
                $stmt->execute();
            }
    
            $this->conn->commit();
    
            echo json_encode(["message" => "Success"]);
    
        } catch (PDOException $e) {
            $this->conn->rollBack();
    
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

    public function depreciationData($page, $pageIndex, $pageData, $search, $busunitcode)
    {
        try {
            // Query to fetch the journal voucher items
            $sql = "SELECT description, quantity, class, purchasedate,
            usefullifeinmos, residualvalue, total_carrying_value 
            FROM tbl_fixed_assets AS T1
            JOIN tbl_accounting_transactions AS T2
            ON T1.menutransactedref = T2.menutransactedref
            WHERE T1.approvalstatus = 'Posted'
            AND T1.deletestatus = 'Active' 
            AND T2.busunitcode = :busunitcode
            AND T1.class LIKE :search
            GROUP BY T2.menutransactedref
            ORDER BY T1.seq DESC";

            $stmt = $this->conn->prepare($sql);
            
            $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
            
            $stmt->bindValue(":search", $search, PDO::PARAM_STR);
            
            $stmt->execute();

            $fixedassets = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $fixedassets[] = $row;
            }


            return [
                'items' => $fixedassets,
            ];

        } catch (PDOException $e) {
            // Handle SQL or database connection errors
            return [
                'error' => $e->getMessage()
            ];
        }
    }

    public function depreciationExcelData($user_id, $data)
    {
       
        $sql = "SELECT busunitcode, transdate, glcode, slcode, 
                particulars, amount 
                FROM tbl_accounting_transactions 
                WHERE (glcode = 290 OR glcode = 990) 
                  AND busunitcode = :busunitcode";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
        $stmt->execute();
        $excelData = $stmt->fetchAll(PDO::FETCH_ASSOC);  

        // Round the amount to two decimal places in PHP
        foreach ($excelData as &$row) {
            $row['amount'] = number_format((float) $row['amount'], 2, '.', '');
        }

        echo json_encode($excelData);



    }


    
}
