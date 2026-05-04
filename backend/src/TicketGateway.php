<?php

class TicketGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
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
                    ROUND(SUM( (amount * -1)  ),2) as amount,
                    t1.transdate,t1.particulars,
                    t1.reference,
                    t1.busunitcode,
                    t2.sl_description,
                    t1.approvalstatus, 
                    t1.transactiontype,
                    t1.transactionclass,
                    t1.othermapref,
                    othermaprefroute,
                    DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), transdate) AS days_since_transdate
                    FROM tbl_accounting_transactions  as t1
                    LEFT JOIN lkp_chart_of_accounts as t2 ON t2.slcode = t1.slcode
                    WHERE t1.reference LIKE :search AND t1.deletestatus = 'Active' 
                    AND t1.busunitcode = :busunitcode
                    AND t1.amount < 0 
                    AND menutransacted = '/pettycashtransaction' 
                    GROUP BY t1.menutransactedref
                    ORDER BY t1.seq DESC 
                    LIMIT $pageIndex,$pageData";

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

    public function getInfiniteData($user_id, $page, $pageIndex, $pageData, $search, $busunitcode,$status)
    {
        $query = "";

        // if ($search == "All") {
           
            if ($busunitcode != "") {
                $sql = "SELECT t2.name AS company 
                        FROM  lkp_busunits AS t2 
                        WHERE t2.busunitcode = :busunit_code";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindParam(":busunit_code", $busunitcode);
                $stmt->execute();

                $output = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($output) {
                    $company = $output['company'];
                    $company = $this->conn->quote($company);
                    $query = "t1.client = $company";
                }
            // } else {
            //     $query = "t1.client IS NOT NULL";
            // }
        }elseif($busunitcode == "All"){
             $query = "t1.client IS NOT NULL";
             
        } else{
         
            $sql = "SELECT t2.name AS company 
                    FROM tbl_employees AS t1 
                    LEFT JOIN lkp_busunits AS t2 ON t1.busunit_code = t2.busunitcode 
                    WHERE t1.empid = :empid";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(":empid", $user_id);
            $stmt->execute();

            $output = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($output) {
                $company = $output['company'];
                $company = $this->conn->quote($company);
                $query = "t1.client = $company";
         
            }
        }

        // Handle case where $query is empty
        if (empty($query)) {
            $query = '1'; // Returns all rows if $query is empty
        }

        $sql = "SELECT t1.*, DATE(t1.datecreated) AS datecreated, 
                       CONCAT(t2.firstname, ' ', t2.middlename, ' ', t2.lastname) AS name,
                       CONCAT(t3.firstname, ' ', t3.middlename, ' ', t3.lastname) AS acknowledgebyname
                FROM tbl_ticket AS t1
                LEFT JOIN tbl_users_global_assignment AS t2
                    ON CONVERT(t1.empid USING utf8mb4) = CONVERT(t2.uuid USING utf8mb4)
                LEFT JOIN tbl_users_global_assignment AS t3
                    ON CONVERT(t1.acknowledgeby USING utf8mb4) = CONVERT(t3.uuid USING utf8mb4)
                WHERE t1.deletestatus = 'Active' AND $query and ticketid LIKE :search and t1.status LIKE :status
                ORDER BY t1.seq DESC
                LIMIT :pageIndex, :pageData";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
        $stmt->bindParam(':pageIndex', $pageIndex, PDO::PARAM_INT);
        $stmt->bindParam(':pageData', $pageData, PDO::PARAM_INT);
        $stmt->bindValue(":status", '%' . $status . '%', PDO::PARAM_STR);
        $stmt->execute();

        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data[] = $row;
        }

        $response = [
            'items' => $data,
            'nextPage' => $page + 1,
        ];

        return $response;
    }
    public function insertEntries($user_id, $data)
    {
        try {
                $this->conn->beginTransaction();

                $this->conn->exec("SET time_zone = 'Asia/Manila'");

                $sql = "SELECT t2.name  as company FROM tbl_employees AS t1 LEFT JOIN lkp_busunits as t2 on t1.busunit_code = t2.busunitcode WHERE t1.empid = :empid";

                $stmt = $this->conn->prepare($sql);
                
                $stmt->bindParam(":empid", $data["empid"]);

                $stmt->execute();     

                $output = $stmt->fetch(PDO::FETCH_ASSOC);

                $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

                $shortUuid = $randomString;

                $shortUuid = "TC-" . $shortUuid;

            if($output["company"] === null){
                echo json_encode(["message" => "Error"]);
                return;
            }else{
            // Prepare the SQL statement with column names
            $sql = "INSERT INTO tbl_ticket (
                        ticketid, 
                        tickettype, 
                        ticketdescription, 
                        priority, 
                        empid, 
                        client,status,remarks,deletestatus,acknowledgement,dateaccomplish,evaluation,
                        datecreated
                    ) VALUES (
                        :ticketid, 
                        :tickettype, 
                        :ticketdescription, 
                        :priority, 
                        :empid,
                        :client,'N/A','N/A','Active','N/A','N/A','N/A',
                         DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
                $stmt = $this->conn->prepare($sql);
                
                $stmt->bindParam(":ticketid", $shortUuid);
                $stmt->bindParam(":tickettype", $data["tickettype"]);
                $stmt->bindParam(":ticketdescription", $data["ticketdescription"]);
                $stmt->bindParam(":priority", $data["priority"]);
                $stmt->bindParam(":empid", $data["empid"]);
                $stmt->bindParam(":client", $output["company"]);
                                
                $stmt->execute();  
    
                $this->conn->commit();
    
                echo json_encode(["message" => "Success"]);
                 }

                } catch (PDOException $e) {

                $this->conn->rollBack();

                echo json_encode(["message" => "Error: " . $e->getMessage()]);
            }
    }

    public function ticketacknowledge($user_id, $data)
    {
       try {

                // Begin the transaction
                $this->conn->beginTransaction();
            $sql = "SELECT t1.email,t2.name as company,CONCAT(t1.firstname,' ',t1.lastname) as fullName FROM tbl_employees AS t1 LEFT JOIN lkp_busunits as t2 on t1.busunit_code = t2.busunitcode WHERE t1.empid = :acknowledgeby";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(":acknowledgeby", $data["acknowledgeby"]);
            $stmt->execute();     
    
            $output = $stmt->fetch(PDO::FETCH_ASSOC);

                $emailBoardlContent = "
                                <html>
                                    <body style='font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;'>
                                        <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);'>
                                            <div style='text-align: center;'>
                                                <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo' width='120' style='margin-bottom: 20px;'>
                                            </div>
                                            <p style='font-size: 18px; color: #333333;'>Hello, Exinnov Team,</p>
                                            <p style='font-size: 16px; color: #555555;'>
                                                The ticket {$data["ticketid"]} has been acknowledged by the {$output["company"]}.
                                            </p>
                                            <p style='font-size: 16px; color: #333333;'>Best regards,<br>The Support Team</p>
                                        </div>
                                    </body>
                                </html>";

                                
             $cc = ['gurayshimron@gmail.com','ARMAN.SANTIAGO.07@GMAIL.COM','LENARDPARAISO8@GMAIL.COM','DREISORILO@GMAIL.COM','maryentrepsbpo@gmail.com', 'charliebpanao12@gmail.com' , 'delacruzjennelyn15@gmail.com' ,'jeremiah.richwell@outlook.com'];
                // $cc = ['gurayshimron@gmail.com'];
            $emailController = new EmailSendController();
                $emailController->sendEmailtoBoard(
                    "mail.lightemsupport.com",
                    "accounts@lightemsupport.com",   
                    "LightemAccounts@2025",       
                    "accounts@lightemsupport.com",
                    "accounts@lightemsupport.com",
                    $cc,
                    "Ticket acknowledged by - {$output['fullName']} - {$output['company']} ",
                    $emailBoardlContent
                );
                // Update Accounting Approval
                $sql = "UPDATE tbl_ticket SET acknowledgement = :acknowledgement,acknowledgeby = :acknowledgeby

                        WHERE ticketid = :ticketid";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":acknowledgement", 'acknowledge', PDO::PARAM_STR);

                $stmt->bindValue(":acknowledgeby", $data["acknowledgeby"], PDO::PARAM_STR);

                $stmt->bindValue(":ticketid", $data["ticketid"], PDO::PARAM_STR);

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
    public function ticketdelete($user_id, $data)
    {
       try {

                // Begin the transaction
                $this->conn->beginTransaction();
                // Update Accounting Approval
                $sql = "UPDATE tbl_ticket SET deletestatus = :deletestatus

                        WHERE ticketid = :ticketid";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":deletestatus", 'Inactive', PDO::PARAM_STR);

                $stmt->bindValue(":ticketid", $data["ticketid"], PDO::PARAM_STR);

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
    public function ticketstatus($user_id, $data)
    {
       try {
            // Begin the transaction
            $this->conn->beginTransaction();

            $sql = "SELECT t2.email, CONCAT(t2.firstname, ' ', t2.lastname) as fullName 
                    FROM tbl_ticket as t1 
                    LEFT JOIN tbl_users_global_assignment as t2 
                    ON CONVERT(t1.empid USING utf8mb4) = CONVERT(t2.uuid USING utf8mb4) 
                    WHERE ticketid = :ticketid";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(":ticketid", $data["ticketid"]);
            $stmt->execute();     

            $output = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$output) {
                throw new Exception("No user found with the given ticketid.");
            }

            $emailContent = "<html>
                <body style='font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;'>
                    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);'>
                        <div style='text-align: center;'>
                            <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo' width='120' style='margin-bottom: 20px;'>
                        </div>
                        <p style='font-size: 18px; color: #333333;'>Hello, {$output["fullName"]},</p>
                        <p style='font-size: 16px; color: #555555;'>
                            The status of your ticket has been updated to: <strong>{$data["status"]}</strong>.
                        </p>
                        <p style='font-size: 16px; color: #555555;'>
                            Thank you for your patience. If you have any questions, feel free to reach out.
                        </p>
                        <p style='font-size: 16px; color: #333333;'>Best regards,<br>The Support Team</p>
                    </div>
                </body>
            </html>";

            $emailController = new EmailSendController();
            $emailController->sendEmail(
                "mail.lightemsupport.com",
                "accounts@lightemsupport.com",   
                "LightemAccounts@2025",       
                "accounts@lightemsupport.com",
                $output["email"],
                "Ticket Status Update - {$output["fullName"]}",
                $emailContent
            );

            // Update ticket status
            $sql = "UPDATE tbl_ticket SET status = :status , status_user = :user_id WHERE ticketid = :ticketid";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);
            $stmt->bindValue(":ticketid", $data["ticketid"], PDO::PARAM_STR);
             $stmt->bindValue(":user_id", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            // Commit the transaction
            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (Exception $e) {
            // Rollback the transaction if something failed
            $this->conn->rollBack();
            // Handle the exception
            echo json_encode(["message" => "Error", "error" => $e->getMessage()]);
        }
    }

    public function ticketremarks($user_id, $data)
    {
       try {
                // Begin the transaction
                $this->conn->beginTransaction();
                
            $sql = "SELECT t2.email, CONCAT(t2.firstname, ' ', t2.lastname) as fullName 
                    FROM tbl_ticket as t1 
                    LEFT JOIN tbl_users_global_assignment as t2 
                    ON CONVERT(t1.empid USING utf8mb4) = CONVERT(t2.uuid USING utf8mb4) 
                    WHERE ticketid = :ticketid";
    
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(":ticketid", $data["ticketid"]);
            $stmt->execute();     
    
            $output = $stmt->fetch(PDO::FETCH_ASSOC);
    
            if (!$output) {
                throw new Exception("No user found with the given ticketid.");
            }
    
            $emailContent = "<html>
                <body style='font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;'>
                    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);'>
                        <div style='text-align: center;'>
                            <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo' width='120' style='margin-bottom: 20px;'>
                        </div>
                        <p style='font-size: 18px; color: #333333;'>Hello, {$output["fullName"]},</p>
                        <p style='font-size: 16px; color: #555555;'>
                            The Remarks of your ticket has been updated to: <strong>{$data["remarks"]}</strong>.
                        </p>
                        <p style='font-size: 16px; color: #555555;'>
                            Thank you for your patience. If you have any questions, feel free to reach out.
                        </p>
                        <p style='font-size: 16px; color: #333333;'>Best regards,<br>The Support Team</p>
                    </div>
                </body>
            </html>";
    
            $emailController = new EmailSendController();
            $emailController->sendEmail(
                "mail.lightemsupport.com",
                "accounts@lightemsupport.com",   
                "LightemAccounts@2025",       
                "accounts@lightemsupport.com",
                $output["email"],
                "Ticket Remarks Update - {$output["fullName"]}",
                $emailContent
            );
                // Update Accounting Approval
                $sql = "UPDATE tbl_ticket SET remarks = :remarks , remarks_user = :user_id

                        WHERE ticketid = :ticketid";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":remarks", $data["remarks"], PDO::PARAM_STR);

                $stmt->bindValue(":ticketid", $data["ticketid"], PDO::PARAM_STR);
                 $stmt->bindValue(":user_id", $user_id, PDO::PARAM_STR);

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
    public function ticketEstimatedtime($user_id, $data)
    {
       try {
                // Begin the transaction
                $this->conn->beginTransaction();
                $sql = "SELECT t2.email, CONCAT(t2.firstname, ' ', t2.lastname) as fullName 
                    FROM tbl_ticket as t1 
                    LEFT JOIN tbl_users_global_assignment as t2 
                    ON CONVERT(t1.empid USING utf8mb4) = CONVERT(t2.uuid USING utf8mb4) 
                    WHERE ticketid = :ticketid";
    
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(":ticketid", $data["ticketid"]);
            $stmt->execute();     
    
            $output = $stmt->fetch(PDO::FETCH_ASSOC);
    
            if (!$output) {
                throw new Exception("No user found with the given ticketid.");
            }
    
            $emailContent = "<html>
                <body style='font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;'>
                    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);'>
                        <div style='text-align: center;'>
                            <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo' width='120' style='margin-bottom: 20px;'>
                        </div>
                        <p style='font-size: 18px; color: #333333;'>Hello, {$output["fullName"]},</p>
                        <p style='font-size: 16px; color: #555555;'>
                            The Estimated accoumplish time of your ticket has been updated to: <strong>{$data["dateaccomplish"]}</strong>.
                        </p>
                        <p style='font-size: 16px; color: #555555;'>
                            Thank you for your patience. If you have any questions, feel free to reach out.
                        </p>
                        <p style='font-size: 16px; color: #333333;'>Best regards,<br>The Support Team</p>
                    </div>
                </body>
            </html>";
    
            $emailController = new EmailSendController();
            $emailController->sendEmail(
                "mail.lightemsupport.com",
                "accounts@lightemsupport.com",   
                "LightemAccounts@2025",       
                "accounts@lightemsupport.com",
                $output["email"],
                "Ticket estimated accomplish date Update - {$output["fullName"]}",
                $emailContent
            );
                // Update Accounting Approval
                $sql = "UPDATE tbl_ticket SET dateaccomplish = :dateaccomplish ,estimated_user = :user_id

                        WHERE ticketid = :ticketid";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":dateaccomplish", $data["dateaccomplish"], PDO::PARAM_STR);

                $stmt->bindValue(":ticketid", $data["ticketid"], PDO::PARAM_STR);
                $stmt->bindValue(":user_id", $user_id, PDO::PARAM_STR);


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
    public function ticketEvaluation($user_id, $data)
    {
       try {
                // Begin the transaction
                $this->conn->beginTransaction();
                $sql = "SELECT t2.email, CONCAT(t2.firstname, ' ', t2.lastname) as fullName 
                    FROM tbl_ticket as t1 
                    LEFT JOIN tbl_users_global_assignment as t2 
                    ON CONVERT(t1.empid USING utf8mb4) = CONVERT(t2.uuid USING utf8mb4) 
                    WHERE ticketid = :ticketid";
    
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(":ticketid", $data["ticketid"]);
            $stmt->execute();     
    
            $output = $stmt->fetch(PDO::FETCH_ASSOC);
    
            if (!$output) {
                throw new Exception("No user found with the given ticketid.");
            }
    
            $emailContent = "<html>
                <body style='font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;'>
                    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);'>
                        <div style='text-align: center;'>
                            <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo' width='120' style='margin-bottom: 20px;'>
                        </div>
                        <p style='font-size: 18px; color: #333333;'>Hello, {$output["fullName"]},</p>
                        <p style='font-size: 16px; color: #555555;'>
                            The Estimated accoumplish time of your ticket has been updated to: <strong>{$data["evaluation"]}</strong>.
                        </p>
                        <p style='font-size: 16px; color: #555555;'>
                            Thank you for your patience. If you have any questions, feel free to reach out.
                        </p>
                        <p style='font-size: 16px; color: #333333;'>Best regards,<br>The Support Team</p>
                    </div>
                </body>
            </html>";
    
            $emailController = new EmailSendController();
            $emailController->sendEmail(
                "mail.lightemsupport.com",
                "accounts@lightemsupport.com",   
                "LightemAccounts@2025",       
                "accounts@lightemsupport.com",
                $output["email"],
                "Ticket evaluation Update - {$output["fullName"]}",
                $emailContent
            );
                // Update Accounting Approval
                $sql = "UPDATE tbl_ticket SET evaluation = :evaluation , evaluation_user = :user_id

                        WHERE ticketid = :ticketid";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":evaluation", $data["evaluation"], PDO::PARAM_STR);

                $stmt->bindValue(":ticketid", $data["ticketid"], PDO::PARAM_STR);

                $stmt->bindValue(":user_id", $user_id, PDO::PARAM_STR);


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
    public function ticketMessage($user_id, $data)
    {
       try {
                // Begin the transaction
                $this->conn->beginTransaction();
                $sql = "SELECT t2.email, CONCAT(t2.firstname, ' ', t2.lastname) as fullName 
                    FROM tbl_ticket as t1 
                    LEFT JOIN tbl_users_global_assignment as t2 
                    ON CONVERT(t1.empid USING utf8mb4) = CONVERT(t2.uuid USING utf8mb4) 
                    WHERE ticketid = :ticketid";
    
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(":ticketid", $data["ticketid"]);
            $stmt->execute();     
    
            $output = $stmt->fetch(PDO::FETCH_ASSOC);
    
            if (!$output) {
                throw new Exception("No user found with the given ticketid.");
            }
    
           $emailContent = "<html>
                                <body style='font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;'>
                                    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);'>
                                        <div style='text-align: center;'>
                                            <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo' width='120' style='margin-bottom: 20px;'>
                                        </div>
                                        <p style='font-size: 18px; color: #333333;'>Hello, {$output["fullName"]},</p>
                                        <p style='font-size: 16px; color: #555555; text-indent: 50px'>
                                           {$data["message"]}
                                        </p>

                                        <p style='font-size: 16px; color: #555555;'>
                                            Thank you for your patience, and we look forward to resolving your issue soon.
                                        </p>
                                        <p style='font-size: 16px; color: #333333;'>Best regards,<br>The Exinnov Team</p>
                                    </div>
                                </body>
                            </html>";

                            $emailController = new EmailSendController();
                            $emailController->sendEmail(
                                "mail.lightemsupport.com",
                                "accounts@lightemsupport.com",
                                "LightemAccounts@2025",
                                "accounts@lightemsupport.com",
                                $output["email"],
                                "Exinnov reply to the ticket - {$output["fullName"]}",
                                $emailContent
                            );

                // Update Accounting Approval
                $sql = "UPDATE tbl_ticket SET messagetoclients = :message , message_user = :user_id

                        WHERE ticketid = :ticketid";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":message", $data["message"], PDO::PARAM_STR);

                $stmt->bindValue(":ticketid", $data["ticketid"], PDO::PARAM_STR);

                $stmt->bindValue(":user_id", $user_id, PDO::PARAM_STR);

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

    public function getGroupData($user_id,$data)
    {

        $sql = "SELECT transdate,t1.slcode,t2.sl_description as gl_description,amount,menutransactedref FROM tbl_accounting_transactions as t1 LEFT JOIN lkp_chart_of_accounts as t2 on t1.slcode = t2.slcode    
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
