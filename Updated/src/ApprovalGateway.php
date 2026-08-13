<?php







class ApprovalGateway

{







    private $conn;







    public function __construct(Database $database)



    {







        $this->conn = $database->getConnection();







    }







        public function getApprovalSummary($user_id, $data)
    {
        $sql = "SELECT DISTINCT
                    tbl_approval_creds.approvalid,
                    tbl_approval_creds.empid,
                    tbl_approval_creds.moduletoapprove,
                    tbl_approval_creds.approvaldescription,
                    tbl_approval_creds.approvalseq,
                    tbl_approval_creds.busunitcode,
                    CONCAT(tbl_employees.firstname,' ',tbl_employees.middlename,' ',tbl_employees.lastname) AS approvername,
                    tbl_employees.position,
                    tbl_approval_history.approvalid AS approvalhistoryid
                FROM 
                    tbl_approval_creds
                    LEFT OUTER JOIN tbl_employees ON tbl_approval_creds.empid = tbl_employees.empid
                    LEFT OUTER JOIN tbl_approval_history ON tbl_approval_creds.approvalid = tbl_approval_history.approvalid
                    AND tbl_approval_history.menutransactedref = :reference
                WHERE tbl_approval_creds.deletestatus = 'Active'
                    AND moduletoapprove = :route
                    AND busunitcode = :busunitcode
                ORDER BY tbl_approval_creds.approvalseq ASC";

        $stmt = $this->conn->prepare($sql);

        $result = [];

        // Check if "references" exists and is an array
        if (isset($data["references"]) && is_array($data["references"])) {
            foreach ($data["references"] as $reference) {
                $stmt->bindValue(":route", $data["route"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);

                $stmt->execute();

                // Fetching results and storing them in the result array
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    // Check if the approvalid already exists in the result array to avoid duplication
                    $exists = false;
                    foreach ($result as $existingRow) {
                        if ($existingRow['approvalid'] === $row['approvalid']) {
                            $exists = true;
                            break;
                        }
                    }

                    // Only add the row if it's not a duplicate
                    if (!$exists) {
                        $result[] = $row;
                    }
                }
            }
        } elseif (isset($data["reference"]) && is_string($data["reference"])) { // Handle single reference as string
            $stmt->bindValue(":route", $data["route"], PDO::PARAM_STR);
            $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
            $stmt->bindValue(":reference", $data["reference"], PDO::PARAM_STR);

            $stmt->execute();

            // Fetching results and storing them in the result array
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                // Check if the approvalid already exists in the result array to avoid duplication
                $exists = false;
                foreach ($result as $existingRow) {
                    if ($existingRow['approvalid'] === $row['approvalid']) {
                        $exists = true;
                        break;
                    }
                }

                // Only add the row if it's not a duplicate
                if (!$exists) {
                    $result[] = $row;
                }
            }
        } else {
            throw new Exception("Invalid reference data format");
        }

        return $result;
    }









    public function getbyPageData($pageIndex, $pageData)



    {







        $sql = "SELECT * FROM lkp_busunits ORDER BY seq LIMIT $pageIndex, $pageData";







        $stmt = $this->conn->prepare($sql);







        $stmt->execute();







        $data = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $data[] = $row;







        }







        return $data;







    }







    public function getForUser($user_id): array



    {







        $sql = "SELECT *































        FROM tbl_cash_sales_summary_tracker































        WHERE usertracker = :user_id































        AND transdate = :transdate































        AND deletestatus = 'Active'";







        $stmt = $this->conn->prepare($sql);







        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_STR);







        $stmt->bindValue(":transdate", date("Y-m-d"), PDO::PARAM_STR);







        $stmt->execute();







        $data = [];







        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {







            $data[] = $row;







        }







        return $data;







    }







    public function createForUser($user_id, $data)



    {







        if ($data["type"] === "cashOpening") {







            $sql = "INSERT INTO tbl_cash_sales_summary_tracker () VALUES (default, CONCAT('CT-',shortUUID()),































                DATE_ADD(NOW(), INTERVAL 8 HOUR), 0, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :cashbalance, 0, 0, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";







            $stmt = $this->conn->prepare($sql);







            $stmt->bindValue(":cashbalance", $data["cashbalance"], PDO::PARAM_STR);







            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);







            $stmt->execute();







            echo json_encode(["message" => "Success"]);







        }







    }

    public function approveTransaction($user_id, $data)
    {
        try {
            // Begin the transaction
            $this->conn->beginTransaction();

            // Determine if we're working with a single reference or multiple references
            if (isset($data["references"])) {
                // Handle multiple references
                $references = is_array($data["references"]) ? $data["references"] : [$data["references"]];
            } elseif (isset($data["reference"])) {
                // Handle a single reference
                $references = [$data["reference"]];
            }


            foreach ($references as $reference) {
                // Update Accounting Approval
                $sql = "UPDATE tbl_accounting_transactions SET approvalref = :approvalid,
                        approvalstatus = :approvaldescription, createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
                        WHERE menutransactedref = :reference";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":approvalid", $data["approvalid"], PDO::PARAM_STR);
                $stmt->bindValue(":approvaldescription", $data["approvaldescription"], PDO::PARAM_STR);
                $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
                $stmt->execute();

                // Insert to Approval History
                $sql = "INSERT INTO tbl_approval_history ()  
                        VALUES (default, :reference, 
                        :approvalid, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":approvalid", $data["approvalid"], PDO::PARAM_STR);
                $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
                $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();

                if ($data["approvaldescription"] !== "Voided" && $data["approvaldescription"] !== "Canceled") {
                 
                    if (substr($reference, 0, 2) == 'FA') {
                        $sql = "UPDATE tbl_accounting_transactions SET approvalref = :approvalid,
                                approvalstatus = 'Pending'
                                WHERE menutransactedref = :reference";

                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":approvalid", $data["approvalid"], PDO::PARAM_STR);
                        $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
                        $stmt->execute();
                    }
                    
                    if ($data["approvaldescription"] == 'Posted') {
                        if (substr($reference, 0, 2) == 'FA') {
                            // Check if the fixed asset is Setup
                            $sql = "SELECT * FROM tbl_fixed_assets WHERE fixedassetid LIKE :fixedassetid AND transactiontype = 'Setup'";
                            $stmt = $this->conn->prepare($sql);
                            $likeReference = '%' . $reference . '%';
                            $stmt->bindValue(":fixedassetid", $likeReference);
                            $stmt->execute();
                            $result = $stmt->fetch(PDO::FETCH_ASSOC);

                            if ($result) {
                                $sql = "UPDATE tbl_accounting_transactions SET approvalstatus = 'Posted' WHERE menutransactedref = :reference";
                                $stmt = $this->conn->prepare($sql);
                                $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
                                $stmt->execute();
                            }
                        }
                        if (substr($reference, 0, 2) != 'JV') {
                             $refDB = "DB-" . substr($reference, 3);
                        }else{
                            $refDB = "JV-" . substr($reference, 3);
                        }
                        // Update accounting transactions table
                       

                        $sql = "UPDATE tbl_accounting_transactions SET menutransactedref = :refDB WHERE menutransactedref LIKE :reference";
                        $stmt = $this->conn->prepare($sql);
                        $likeReference = '%' . substr($reference, 3) . '%';
                        $stmt->bindValue(":refDB", $refDB, PDO::PARAM_STR);
                        $stmt->bindValue(":reference", $likeReference, PDO::PARAM_STR);
                        $stmt->execute();
                        
                        if(substr($reference, 0, 2) == 'PV'){
                            
                            $sql = "UPDATE tbl_approval_history SET menutransactedref = :refDB WHERE menutransactedref LIKE :reference";
                            $stmt = $this->conn->prepare($sql);
                            $likeReference = '%' . substr($reference, 3) . '%';
                            $stmt->bindValue(":refDB", $refDB, PDO::PARAM_STR);
                            $stmt->bindValue(":reference", $likeReference, PDO::PARAM_STR);
                            $stmt->execute();
                        }

                        // Update fixed assets table
                        $sql = "UPDATE tbl_fixed_assets SET menutransactedref = :refDB, approvalstatus = :approvalid 
                                WHERE fixedassetid LIKE :reference AND approvalstatus != 'Posted'";
                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":refDB", $refDB, PDO::PARAM_STR);
                        $stmt->bindValue(":approvalid", $data["approvaldescription"], PDO::PARAM_STR);
                        $stmt->bindValue(":reference", $likeReference, PDO::PARAM_STR);
                        $stmt->execute();

                        // Update disbursement table
                        $sql = "UPDATE tbl_disbursements SET deletestatus = 'Active' WHERE reference LIKE :reference";
                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":reference", $likeReference, PDO::PARAM_STR);
                        $stmt->execute();
                        // update disbursement table into voided         
                    }
                 
                } else {
                      
                        if (substr($reference, 0, 2) == 'FA') {
                            // Update approval status for fixed assets
                            $sql = "UPDATE tbl_fixed_assets 
                                    SET approvalstatus = :approvaldescription
                                    WHERE fixedassetid = :reference";
                            $stmt = $this->conn->prepare($sql);
                            $stmt->bindValue(":approvaldescription", $data["approvaldescription"], PDO::PARAM_STR);
                            $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
                            $stmt->execute();
                        } elseif (substr($reference, 0, 2) == 'CV') {
                          
                            // Generate updated references for disbursements
                            
                        
                           foreach ($references as $ref) {

                                // Update accounting transactions to mark them as voided
                                // $sql = "UPDATE tbl_accounting_transactions 
                                //         SET approvalref = :approvalid, 
                                //             approvalstatus = 'Canceled'
                                //         WHERE menutransactedref = :reference";
                                // $stmt = $this->conn->prepare($sql);
                                // $stmt->bindValue(":reference",  $ref , PDO::PARAM_STR);       
                                // $stmt->bindValue(":approvalid", $data["approvalid"], PDO::PARAM_STR);
                                // $stmt->execute();

                                // $sql = "SELECT reference,particulars,othermaprefroute,amount,slcode
                                // FROM tbl_accounting_transactions WHERE menutransactedref = :menutransactedref 
                                // AND amount < 0 
                                // AND transactiontype = 'Payments'";

                                // $stmt = $this->conn->prepare($sql);
                                // $stmt->bindValue(":menutransactedref", $ref, PDO::PARAM_STR);
                                // $stmt->execute();
                                // $resultref = $stmt->fetch(PDO::FETCH_ASSOC); 

                                // $sql = "SELECT DISTINCT menutransactedref FROM tbl_accounting_transactions
                                //     WHERE othermaprefroute = :othermaprefroute AND menutransactedref LIKE :menutransactedref";
                                // $stmt = $this->conn->prepare($sql);
                                // $stmt->bindValue(":menutransactedref", '%DB-%', PDO::PARAM_STR);
                                // $stmt->bindValue(":othermaprefroute", $resultref["othermaprefroute"], PDO::PARAM_STR);
                                // $stmt->execute();
                                // $disbursement_reference = $stmt->fetch(PDO::FETCH_ASSOC); 

                                $sql = "SELECT DISTINCT t2.* 
                                        FROM tbl_disbursement_check AS t1 
                                        LEFT JOIN tbl_disbursements_clearing AS t2 
                                        ON t1.disbursement_id = t2.disbursement_reference  
                                        AND t1.amount = t2.amount_cleared  
                                        LEFT JOIN tbl_accounting_transactions AS t3 
                                        ON t3.menutransactedref = t1.check_id  
                                        AND t2.payment_reference = t3.reference  
                                        WHERE t3.menutransactedref = :check_id";

                                $stmt = $this->conn->prepare($sql);
                                $stmt->bindValue(":check_id", $ref, PDO::PARAM_STR);
                                $stmt->execute();
                                $resultref = $stmt->fetch(PDO::FETCH_ASSOC);

                                 $sql = "UPDATE tbl_disbursements_clearing AS t1  
                                        LEFT JOIN tbl_disbursement_check AS t2  
                                        ON t1.disbursement_reference = t2.disbursement_id  
                                        LEFT JOIN tbl_accounting_transactions AS t3  
                                        ON t3.menutransactedref = t2.check_id  
                                        AND t1.payment_reference = t3.reference  
                                        SET t1.deletestatus = 'Inactive' ,t2.deletestatus = 'Inactive'
                                        WHERE t3.menutransactedref = :check_id;";

                                $stmt = $this->conn->prepare($sql);
                                $stmt->bindValue(":check_id", $ref , PDO::PARAM_STR);                                  
                                $stmt->execute();
                                
                                $sql = "SELECT SUM(amount_cleared) as amount_cleared FROM tbl_disbursements_clearing
                                    WHERE disbursement_reference = :disbursement_reference AND deletestatus = 'Active' ";
                                $stmt = $this->conn->prepare($sql);
                                $stmt->bindValue(":disbursement_reference", $resultref["disbursement_reference"], PDO::PARAM_STR);
                                $stmt->execute();
                                $amount_cleared = $stmt->fetch(PDO::FETCH_ASSOC); 

                                if($amount_cleared["amount_cleared"] === null){
                                    $sql = "UPDATE tbl_disbursements 
                                        SET payment_status = 'Unpaid'
                                        WHERE reference = :reference ";
                                    $stmt = $this->conn->prepare($sql);
                                    $stmt->bindValue(":reference",  $resultref["disbursement_reference"] , PDO::PARAM_STR);  
                                    $stmt->execute();
                                }else{
                                    $sql = "UPDATE tbl_disbursements 
                                        SET payment_status = 'Partial'
                                        WHERE reference = :reference ";
                                    $stmt = $this->conn->prepare($sql);
                                    $stmt->bindValue(":reference",  $resultref["disbursement_reference"] , PDO::PARAM_STR);  
                                    $stmt->execute();
                                }

                            }


                        }

                }
            }

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










    public function updateForUser($user_id, $data)



    {







        $sql = "UPDATE tbl_mop_summary SET payment_status = 'Paid',







            usertracker = :user_tracker, createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)







            WHERE mop_trans_id = :moptransid";







        $stmt = $this->conn->prepare($sql);







        $stmt->bindValue(":moptransid", $data["moptransid"], PDO::PARAM_STR);







        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);







        $stmt->execute();







        echo json_encode(["message" => "Success"]);







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


        public function approveFixedAsset($user_id, $data)
    {

       try {
                // Begin the transaction
                $this->conn->beginTransaction();

                // update tbl_disburement
                             
                $sql = "UPDATE tbl_disbursements SET deletestatus = 'Active' WHERE reference LIKE :reference";

                $stmt = $this->conn->prepare($sql);
                
                
                $reference = '%' . $data["reference"] . '%';
                
                $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
                
                $stmt->execute();
                

                // Update Accounting Approval

                $sql = "UPDATE tbl_accounting_transactions SET approvalref = :approvalid,
                        approvalstatus = :approvaldescription, createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
                        WHERE menutransactedref = :reference";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":approvalid", $data["approvalid"], PDO::PARAM_STR);
                $stmt->bindValue(":approvaldescription", $data["approvaldescription"], PDO::PARAM_STR);
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




}



