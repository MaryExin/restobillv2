<?php







class DisbursementsGateway
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

    private function assertEditablePendingReference($reference, $busunitcode, $transdate)
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

        $effectiveBusunit = $busunitcode ?: ($existing["busunitcode"] ?? "");
        $effectiveTransdate = $transdate ?: ($existing["transdate"] ?? "");
        $normalizedAccountingPeriod = $this->normalizeAccountingPeriod($effectiveTransdate);

        $checkSql = "SELECT MAX(accounting_period) AS accounting_period
                     FROM tbl_accounting_period
                     WHERE busunitcode = :busunitcode_check";
        $checkStmt = $this->conn->prepare($checkSql);
        $checkStmt->bindValue(":busunitcode_check", $effectiveBusunit, PDO::PARAM_STR);
        $checkStmt->execute();
        $closedPeriod = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (
            !empty($closedPeriod["accounting_period"]) &&
            $closedPeriod["accounting_period"] >= $normalizedAccountingPeriod
        ) {
            throw new Exception("Cannot edit this transaction because its accounting period is already closed.");
        }
    }

    private function resetApprovalHistory($reference)
    {
        $sql = "UPDATE tbl_approval_history
                SET deletestatus = 'Inactive'
                WHERE menutransactedref = :history_reference
                  AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":history_reference", $reference, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function extractReferenceParts($reference, $prefix)
    {
        $normalizedReference = strtoupper(trim((string) $reference));
        $normalizedPrefix = strtoupper(trim((string) $prefix)) . "-";

        if (strpos($normalizedReference, $normalizedPrefix) !== 0) {
            throw new Exception("Invalid transaction reference format.");
        }

        $suffix = substr($normalizedReference, strlen($normalizedPrefix));
        $year = substr($suffix, 0, 2);
        $formattedId = substr($suffix, 2);
        $id = (int) ltrim($formattedId, '0');

        return [
            "year" => $year,
            "formattedId" => $formattedId,
            "id" => $id > 0 ? $id : 0,
        ];
    }

    private function isValidDisbursementReference($reference)
    {
        try {
            $this->extractReferenceParts($reference, "DB");
            return true;
        } catch (Throwable $e) {
            return false;
        }
    }

    private function resolveEditReference($data)
    {
        $rootEditReference = trim((string) ($data["editReference"] ?? ""));
        if ($rootEditReference !== "" && $this->isValidDisbursementReference($rootEditReference)) {
            return strtoupper($rootEditReference);
        }

        $entryReferences = [];
        foreach (($data["disbursements"] ?? []) as $disbursement) {
            $candidate = trim((string) ($disbursement["menutransactedref"] ?? ""));
            if ($candidate === "" || !$this->isValidDisbursementReference($candidate)) {
                continue;
            }

            $entryReferences[strtoupper($candidate)] = true;
        }

        if (count($entryReferences) === 1) {
            return array_key_first($entryReferences);
        }

        return "";
    }

    private function generateNextReference($prefix, $table, $column)
    {
        $normalizedPrefix = strtoupper(trim((string) $prefix));
        $year = date("y");
        $likePrefix = $normalizedPrefix . "-" . $year . "%";

        $sql = "SELECT MAX(CAST(SUBSTRING($column, 6) AS UNSIGNED)) AS max_id
                FROM $table
                WHERE $column LIKE :reference_prefix";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":reference_prefix", $likePrefix, PDO::PARAM_STR);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        $id = ((int) ($result["max_id"] ?? 0)) + 1;
        $formattedId = str_pad((string) $id, 8, '0', STR_PAD_LEFT);

        return [
            "year" => $year,
            "formattedId" => $formattedId,
            "id" => $id,
            "reference" => $normalizedPrefix . "-" . $year . $formattedId,
        ];
    }

    private function normalizeNumericValue($value)
    {
        if ($value === null || $value === "") {
            return 0;
        }

        return is_numeric($value) ? (float) $value : 0;
    }

      public function createForUser($user_id, $data)
    {
        try {

            //Post to Delivery Assignment
            $this->conn->beginTransaction();

            $editReference = $this->resolveEditReference($data);
            $isEditing = $editReference !== "";

            if ($isEditing) {
                $firstDisbursement = $data["disbursements"][0] ?? [];
                $this->assertEditablePendingReference(
                    $editReference,
                    $firstDisbursement["busUnitCode"] ?? "",
                    $firstDisbursement["transactiondate"] ?? "",
                );

                $parts = $this->extractReferenceParts($editReference, "DB");
                $id = $parts["id"];
                $year = $parts["year"];
                $formattedId = $parts["formattedId"];
                $shortUuid = $editReference;

                $deleteDisbursementSql = "DELETE FROM tbl_disbursements
                                          WHERE reference = :disbursement_reference_delete";
                $deleteDisbursementStmt = $this->conn->prepare($deleteDisbursementSql);
                $deleteDisbursementStmt->bindValue(":disbursement_reference_delete", $editReference, PDO::PARAM_STR);
                $deleteDisbursementStmt->execute();

                $deleteTransactionSql = "DELETE FROM tbl_accounting_transactions
                                         WHERE menutransactedref = :transaction_reference_delete";
                $deleteTransactionStmt = $this->conn->prepare($deleteTransactionSql);
                $deleteTransactionStmt->bindValue(":transaction_reference_delete", $editReference, PDO::PARAM_STR);
                $deleteTransactionStmt->execute();

                $this->resetApprovalHistory($editReference);
            } else {
                $nextReference = $this->generateNextReference(
                    "DB",
                    "tbl_disbursements",
                    "reference",
                );
                $id = $nextReference["id"];
                $year = $nextReference["year"];
                $formattedId = $nextReference["formattedId"];
                $shortUuid = $nextReference["reference"];
            }
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
                $normalizedAmount = $this->normalizeNumericValue($disbursement["amount"] ?? 0);
          
                $stmt->bindValue(":reference", $shortUuid, PDO::PARAM_STR);
                // $stmt->bindValue(":referenceid", $id, PDO::PARAM_STR);
                $stmt->bindValue(":transactiondate", $disbursement["transactiondate"], PDO::PARAM_STR);
                $stmt->bindValue(":invoicedate", $disbursement["invoicedate"], PDO::PARAM_STR);
                $stmt->bindValue(":slCode", $disbursement["slCode"], PDO::PARAM_STR);
                $stmt->bindValue(":slDescription", $disbursement["slDescription"], PDO::PARAM_STR);
                $stmt->bindValue(":amount", abs($normalizedAmount), PDO::PARAM_STR);
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
                $normalizedAmount = $this->normalizeNumericValue($disbursement["amount"] ?? 0);
                $normalizedWhtxRate = $this->normalizeNumericValue($disbursement["whtxRate"] ?? 0);
                $linkedOtherMapRef = trim((string) ($disbursement["othermapref"] ?? ""));
                $linkedOtherMapRoute = trim((string) ($disbursement["othermaprefroute"] ?? ""));
                $otherMapRefValue = $linkedOtherMapRef !== ""
                    ? $linkedOtherMapRef
                    : ($disbursement["checkDate"] ?? null);
                $otherMapRouteValue = $linkedOtherMapRoute !== ""
                    ? $linkedOtherMapRoute
                    : $id;
              
                $stmt->bindValue(":transactiondate", $disbursement["transactiondate"], PDO::PARAM_STR);
                $stmt->bindValue(":referenceid", $otherMapRouteValue, PDO::PARAM_STR);
                $stmt->bindValue(":invoicedate", $disbursement["invoicedate"], PDO::PARAM_STR);
                $stmt->bindValue(":checkdate", $otherMapRefValue, PDO::PARAM_STR);
                $stmt->bindValue(":glcode", substr($disbursement["slCode"], 0, 3), PDO::PARAM_STR);
                $stmt->bindValue(":slcode", $disbursement["slCode"], PDO::PARAM_STR);
                $stmt->bindValue(":amount", $normalizedAmount, PDO::PARAM_STR);
                $stmt->bindValue(":approvalref", ($disbursement["approvalref"] != 'Auto') ? $disbursement["approvalref"] : $resultapprovalid["approvalid"], PDO::PARAM_STR);
                $stmt->bindValue(":approvalstatus", ($disbursement["approvalref"] != 'Auto') ? "Pending" : "Posted", PDO::PARAM_STR);
                $stmt->bindValue(":particulars", $disbursement["particulars"], PDO::PARAM_STR);
                $stmt->bindValue(":reference", $disbursement["documentref"], PDO::PARAM_STR);
                $stmt->bindValue(":payee_code", $disbursement["payeeCode"], PDO::PARAM_STR);
                $stmt->bindValue(":transactionclass", $disbursement["transactionClass"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $disbursement["busUnitCode"], PDO::PARAM_STR);
                $stmt->bindValue(":vat_tax_type", $disbursement["taxType"], PDO::PARAM_STR);
                $stmt->bindValue(":whtx_atc", $disbursement["atc"], PDO::PARAM_STR);
                $stmt->bindValue(":whtx_rate", $normalizedWhtxRate, PDO::PARAM_STR);
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
                        $recipientEmail = trim((string)($email['email'] ?? ''));
                        if ($recipientEmail === '') {
                            continue;
                        }

                        $emailController->sendEmail(
                            "mail.exinnovph.com",               // SMTP server
                            "admin@exinnovph.com",      // SMTP username
                            "ExinnovEmail@2025",                       // SMTP password (highly insecure, consider using environment variables)
                            "admin@exinnovph.com",      // From email address
                            $recipientEmail,                     // To email address
                            "Ready for approval",                // Email subject
                            "<html>
                                <body>
                                    <center>
                                        <img src='https://exinnovph.com/images/app/logo.png' alt='Logo' width='120'><br>
                                        <p style='font-size: 20px;'>Hello User, " . htmlspecialchars((string)($email['uuid'] ?? '')) . " <br><br>
                                        APPROVER " . htmlspecialchars((string)($email['approvalseq'] ?? '')) . " in Disbursment  <br><br>
                                        There is a request for disbursement that needs your approval.</p>
                                        <p  >Reference: " . htmlspecialchars((string)($shortUuid ?? '')) . "<br>
                                        Amount: " . htmlspecialchars((string)(($disbursementAmount ?? 0) * -1 )) . "<br>
                                        Particulars: " . htmlspecialchars((string)($disbursementParticulars ?? '')) . "</p>
                                    </center>
                                </body>
                            </html>"
                        );
                    }
            }

            $log = "INSERT INTO tbl_logs ()
            VALUES (default, 'Exinnov', :busunitcode, 'Disbursement', 'Disbursement', :particulars, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $logstmt = $this->conn->prepare($log);
            $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $logstmt->bindValue(":busunitcode", $data["disbursements"][0]["busUnitCode"], PDO::PARAM_STR);
            $logstmt->bindValue(":particulars", $data["disbursements"][0]["particulars"], PDO::PARAM_STR);
            $logstmt->execute();

            echo json_encode(["message" => "Success"]);

        } catch (Throwable $e) {

            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
                echo json_encode(["message" => "Error: " . $e->getMessage()]);
            } else {
                echo json_encode(["message" => "Success"]);
            }

        }







    }

    public function getMultipleClearingItems($user_id,$page, $pageIndex, $pageData, $search, $min, $max, $busunitcode) 
    {
        
            $sql = "SELECT DISTINCT
                            d.seq,
                            tbl_main.reference,
                            tbl_main.sl_code,
                            ROUND(SUM(tbl_main.total_amount), 2) AS amount,
                            d.transdate,
                            d.particulars,
                            d.document_ref,
                            d.payee_code,
                            d.busunitcode,
                            d.payment_status,
                            lkp_busunits.name,
                            CASE 
                            WHEN d.particulars = 'For-Replenish' THEN (
                                SELECT t1.sl_description
                                FROM lkp_chart_of_accounts AS t1
                                LEFT JOIN tbl_disbursements AS t2 ON t1.slcode = t2.sl_code
                                WHERE t2.sl_code LIKE '%101%' AND t2.reference = tbl_main.reference
                                LIMIT 1
                            )
                            WHEN LEFT(d.payee_code, 2) = 'SP' THEN (
                                SELECT supplier_name
                                FROM lkp_supplier
                                WHERE supplier_code = d.payee_code
                                LIMIT 1
                            )
                            WHEN LEFT(d.payee_code, 2) = 'BU' THEN (
                                SELECT name
                                FROM lkp_busunits
                                WHERE busunitcode = d.payee_code
                                LIMIT 1
                            )
                            ELSE NULL
                        END AS supplier_name,
                            tbl_distinct_accounting_trans.approvalstatus,
                            DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), d.transdate) AS days_since_transdate
                        FROM
                            (SELECT
                                tbl_accounting_transactions.menutransactedref AS reference,
                                tbl_accounting_transactions.slcode AS sl_code,
                                ABS(tbl_accounting_transactions.amount) AS total_amount
                            FROM
                                tbl_accounting_transactions
                            WHERE
                                LEFT(tbl_accounting_transactions.slcode,3) = 400
                                AND tbl_accounting_transactions.amount < 0
                                AND tbl_accounting_transactions.menutransacted = '/disbursements'
                                AND tbl_accounting_transactions.deletestatus = 'Active'
                                AND tbl_accounting_transactions.approvalstatus NOT IN ('Voided', 'Cancelled')
                            UNION ALL
                            SELECT
                                dc.disbursement_reference,
                                COALESCE(ls.slcode, '40099') AS clearing_slcode,
                                dc.amount_cleared * -1       AS total_amount
                                FROM
                                tbl_disbursements_clearing AS dc
                                LEFT JOIN (
                                    SELECT
                                    t2.reference    AS reference,
                                    MIN(t1.slcode)  AS slcode
                                    FROM
                                    lkp_supplier AS t1
                                    JOIN tbl_disbursements AS t2
                                        ON t1.supplier_code = t2.payee_code
                                    WHERE
                                    t1.deletestatus = 'Active'
                                    GROUP BY
                                    t2.reference
                                ) AS ls
                                    ON ls.reference = dc.disbursement_reference
                                WHERE
                                dc.deletestatus = 'Active') tbl_main
                        LEFT JOIN (
                            SELECT
                                reference,
                                MIN(seq) AS seq,
                                MAX(transdate) AS transdate,
                                MAX(invoice_date) AS invoice_date,
                                MAX(document_ref) AS document_ref,
                                MAX(particulars) AS particulars,
                                MAX(payee_code) AS payee_code,
                                MAX(busunitcode) AS busunitcode,
                                MAX(payment_status) AS payment_status,
                                MAX(usertracker) AS usertracker
                            FROM tbl_disbursements
                            WHERE deletestatus = 'Active'
                            GROUP BY reference
                        ) d
                            ON tbl_main.reference = d.reference
                    LEFT JOIN
                            (SELECT DISTINCT menutransactedref, menutransacted, approvalstatus 
                            FROM tbl_accounting_transactions WHERE deletestatus = 'Active') tbl_distinct_accounting_trans
                            ON d.reference = tbl_distinct_accounting_trans.menutransactedref
                            AND tbl_distinct_accounting_trans.menutransacted = '/disbursements'  
                    LEFT JOIN
						tbl_user_roles ON tbl_user_roles.rolename = d.busunitcode 
                    LEFT JOIN
                        lkp_busunits ON  d.busunitcode  = lkp_busunits.busunitcode
                        WHERE
                            tbl_main.reference LIKE :search
                            AND DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), d.transdate)
                            >= IF(:min <= 0, -100000, :min2) 
                            AND DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), d.transdate) <= :max
                            AND tbl_user_roles.userid = :busunitcode
                            AND LEFT(d.payee_code, 2) IN ('SP', 'BU')
                            AND d.payment_status <> 'Paid'
                        GROUP BY
                            tbl_main.reference
                        HAVING
                            ROUND(SUM(tbl_main.total_amount), 2) > 0
                        ORDER BY d.seq DESC
           ";
       
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
        $stmt->bindValue(":min", $min, PDO::PARAM_STR);
        $stmt->bindValue(":min2", $min, PDO::PARAM_STR);
        $stmt->bindValue(":max", $max, PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $user_id, PDO::PARAM_STR);
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
    public function multipleClearing($user_id, $data)
    {
        try {
            //Post to Clearing

            $this->conn->beginTransaction();
            foreach($data["bulkClearing"] as $datas){
            $reference = "CV" . substr($datas["disbursementReference"], 2);
            $referencedis = "DB" . substr($datas["disbursementReference"], 2);

            $slCode = $datas["slCode"] == 40098 ? $datas["pdcSLCode"]  : $datas["slCode"];  //40098 is ACcounts payable PDC
            $slDescription = $datas["slCode"] == 40098 ? $datas["pdcSLDescription"]  : $datas["slDescription"];  

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
            $stmt->bindValue(":amount", $datas["amount"], PDO::PARAM_STR);
            $stmt->bindValue(":payment_reference", $datas["payment_reference"], PDO::PARAM_STR);
            $stmt->bindValue(":payment_type", $datas["payment_type"], PDO::PARAM_STR);
            $stmt->bindValue(":payment_date", $datas["payment_date"], PDO::PARAM_STR);
            $stmt->bindValue(":slCode", $slCode, PDO::PARAM_STR);
            $stmt->bindValue(":slDescription",  $slDescription , PDO::PARAM_STR);
            $stmt->bindValue(":particulars", $datas["particulars"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            // Update Status
           
            $sql = "UPDATE tbl_disbursements SET payment_status = :status,
                    usertracker = :user_tracker
                    WHERE
                    reference = :reference";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":status", $datas["status"], PDO::PARAM_STR);
            // $stmt->bindValue(":ref", $reference);
            $stmt->bindValue(":reference", $datas["disbursementReference"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();
            }
           
             $sql = "SELECT RIGHT(MAX(menutransactedref ),6) AS total
        FROM tbl_accounting_transactions
        WHERE menutransactedref LIKE 'DB-%'
          AND RIGHT(menutransactedref, LENGTH(menutransactedref) - 3) REGEXP '^[0-9]+$'";

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

            foreach ($data["bulkClearing"] as $datas) {

                    if ($datas["busunitcode"] === $datas["originalBusUnitCode"]) {
                        // Use Payable (glcode = 400)
                       $SelectQuery = "
                                        SELECT t1.*
                                        FROM lkp_chart_of_accounts AS t1
                                        LEFT JOIN lkp_supplier AS t2
                                            ON t1.sl_description COLLATE utf8mb4_general_ci
                                            LIKE CONCAT('%', t2.supplier_name COLLATE utf8mb4_general_ci, '%')
                                        LEFT JOIN lkp_busunits AS t4
                                            ON t1.sl_description COLLATE utf8mb4_general_ci
                                            LIKE CONCAT('%', t4.name COLLATE utf8mb4_general_ci, '%')
                                        LEFT JOIN tbl_chart_of_accounts_map AS t3
                                            ON t3.chart_id = t1.chart_type_id
                                        WHERE t1.glcode = '400'
                                        AND t1.deletestatus = 'Active'
                                        AND t3.busunituuid = :busunitcode
                                        AND (
                                                (LEFT(:supplierCode, 2) = 'SP' AND t2.supplier_code = :supplierCode1)
                                            OR (LEFT(:supplierCode2, 2) = 'BU' AND t4.busunitcode = :supplierCode3)
                                        )
                                        LIMIT 1
                                    ";

                                    // Prepare and execute query
                                    $stmt = $this->conn->prepare($SelectQuery);
                                    $stmt->bindValue(":supplierCode", $datas["supplierCode"], PDO::PARAM_STR);
                                    $stmt->bindValue(":supplierCode1", $datas["supplierCode"], PDO::PARAM_STR);
                                    $stmt->bindValue(":supplierCode2", $datas["supplierCode"], PDO::PARAM_STR);
                                    $stmt->bindValue(":supplierCode3", $datas["supplierCode"], PDO::PARAM_STR);
                                    $stmt->bindValue(":busunitcode", $datas["busunitcode"], PDO::PARAM_STR);
                                    $stmt->execute();
                                    $result = $stmt->fetch(PDO::FETCH_ASSOC);

                    } else {
                        // Use Receivable (glcode = 120)
                        $SelectQuery = "SELECT *
                            FROM lkp_chart_of_accounts AS t1
                            LEFT JOIN lkp_busunits AS t2 
                            ON t1.sl_description COLLATE utf8mb4_general_ci LIKE CONCAT('%', t2.name COLLATE utf8mb4_general_ci, '%')
                            LEFT JOIN tbl_chart_of_accounts_map as t3 on t3.chart_id = t1.chart_type_id
                            WHERE t1.glcode = '120'
                            AND t1.deletestatus = 'Active'
                            AND t2.busunitcode = :originalBusUnitCode AND t3.busunituuid = :originalBusUnitCode1";
                              // Prepare and execute query
                        $stmt = $this->conn->prepare($SelectQuery);
                        $stmt->bindValue(":originalBusUnitCode", $datas["originalBusUnitCode"], PDO::PARAM_STR);
                        $stmt->bindValue(":originalBusUnitCode1", $datas["originalBusUnitCode"], PDO::PARAM_STR);
                        $stmt->execute();
                        $result = $stmt->fetch(PDO::FETCH_ASSOC);
                    }
                               $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, :transactiondate,
                                    :documentdate , :glcode, :slcode, :amount, :particulars, :reference, 'Auto', 'Posted', 
                                    null, :payee_code, null, null, null, null, 'Payments', 'Payments', '/disbursements', :busunitcode,
                                    'NA', 'NA', 0, :menutransactedref,
                                    'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";


                                $stmt = $this->conn->prepare($sql);
                                // $stmt->bindValue(":disbursement_id", $resultref['othermaprefroute'] , PDO::PARAM_STR);
                                $stmt->bindValue(":transactiondate", $datas["transaction_date"], PDO::PARAM_STR);
                                $stmt->bindValue(":documentdate", $datas["payment_date"], PDO::PARAM_STR);
                                $stmt->bindValue(":glcode",  $result["glcode"], PDO::PARAM_STR);
                                $stmt->bindValue(":slcode", $result["slcode"], PDO::PARAM_STR);
                                $stmt->bindValue(":amount", $datas["amount"] , PDO::PARAM_STR);
                                $stmt->bindValue(":particulars", $datas["particulars"], PDO::PARAM_STR);
                                $stmt->bindValue(":reference", $datas["payment_reference"], PDO::PARAM_STR);
                                $stmt->bindValue(":payee_code", $datas["supplierCode"], PDO::PARAM_STR);
                                $stmt->bindValue(":busunitcode", $datas["busunitcode"], PDO::PARAM_STR);
                                $stmt->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                                $stmt->execute();

                }
        
            foreach ($data["bulkClearing"] as $datas) {
                 $referencedis = "DB" . substr($datas["disbursementReference"], 2);
                if ($datas["busunitcode"] != $datas["originalBusUnitCode"]) {
                    $payeeCode = trim($datas["supplierCode"] ?? "");
                    if (strpos($payeeCode, "BU-") === 0) {
                        $SelectQuery = "
                            SELECT t1.*
                            FROM lkp_chart_of_accounts AS t1
                            INNER JOIN lkp_busunits AS t2
                                ON t1.sl_description COLLATE utf8mb4_general_ci
                                LIKE CONCAT('%', t2.name COLLATE utf8mb4_general_ci, '%')
                            WHERE t1.glcode = '400'
                            AND t1.deletestatus = 'Active'
                            AND t2.busunitcode = :payeeCode
                            LIMIT 1
                        ";
                    } else {
                        $SelectQuery = "
                            SELECT t1.*
                            FROM lkp_chart_of_accounts AS t1
                            INNER JOIN lkp_supplier AS t2
                                ON t1.sl_description COLLATE utf8mb4_general_ci
                                LIKE CONCAT('%', t2.supplier_name COLLATE utf8mb4_general_ci, '%')
                            WHERE t1.glcode = '400'
                            AND t1.deletestatus = 'Active'
                            AND t2.supplier_code = :payeeCode
                            LIMIT 1
                        ";
                    }

                    $stmt = $this->conn->prepare($SelectQuery);
                    $stmt->bindValue(":payeeCode", $payeeCode, PDO::PARAM_STR);
                    $stmt->execute();
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);

                     $SelectQueryUnit = "SELECT *
                                    FROM lkp_chart_of_accounts AS t1
                                    LEFT JOIN lkp_busunits AS t2 
                                        ON t1.sl_description COLLATE utf8mb4_general_ci LIKE CONCAT('%', t2.name COLLATE utf8mb4_general_ci, '%')
                                    WHERE t1.glcode = '400'
                                      AND t1.deletestatus = 'Active'
                                      AND t2.busunitcode = :busunitcode";
                                      // Prepare and execute query
                    $stmt = $this->conn->prepare($SelectQueryUnit);
                    $stmt->bindValue(":busunitcode", $datas["busunitcode"], PDO::PARAM_STR);
                    $stmt->execute();
                    $resultunit = $stmt->fetch(PDO::FETCH_ASSOC);

                    $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, :transactiondate,
                       :documentdate , :glcode, :slcode, :amount, :particulars, :reference, 'Auto', 'Posted', 
                        null, :payee_code, null, null, null, null, 'Payments', 'Payments', '/disbursements', :busunitcode,
                        'NA', 'NA', 0, :menutransactedref,
                        'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";


                    $stmt = $this->conn->prepare($sql);
                        // $stmt->bindValue(":disbursement_id", $resultref['othermaprefroute'] , PDO::PARAM_STR);
                        $stmt->bindValue(":transactiondate", $datas["transaction_date"], PDO::PARAM_STR);
                        $stmt->bindValue(":documentdate", $datas["payment_date"], PDO::PARAM_STR);
                        $stmt->bindValue(":glcode", $resultunit["glcode"], PDO::PARAM_STR);
                        $stmt->bindValue(":slcode", $resultunit["slcode"], PDO::PARAM_STR);
                        $stmt->bindValue(":amount", $datas["amount"] * -1, PDO::PARAM_STR);
                        $stmt->bindValue(":particulars", $datas["particulars"], PDO::PARAM_STR);
                        $stmt->bindValue(":reference", $datas["payment_reference"], PDO::PARAM_STR);
                        $stmt->bindValue(":payee_code", $datas["supplierCode"], PDO::PARAM_STR);
                        $stmt->bindValue(":busunitcode", $datas["busunitcode"], PDO::PARAM_STR);
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
                        $stmt->bindValue(":transactiondate", $datas["transaction_date"], PDO::PARAM_STR);
                        $stmt->bindValue(":documentdate", $datas["payment_date"], PDO::PARAM_STR);
                        $stmt->bindValue(":glcode", $result["glcode"], PDO::PARAM_STR);
                        $stmt->bindValue(":slcode", $result["slcode"], PDO::PARAM_STR);
                        $stmt->bindValue(":amount", $datas["amount"], PDO::PARAM_STR);
                        $stmt->bindValue(":particulars", $datas["particulars"], PDO::PARAM_STR);
                        $stmt->bindValue(":reference", $datas["payment_reference"], PDO::PARAM_STR);
                        $stmt->bindValue(":payee_code", $datas["supplierCode"], PDO::PARAM_STR);
                        $stmt->bindValue(":busunitcode", $datas["originalBusUnitCode"], PDO::PARAM_STR);
                        $stmt->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                        $stmt->execute();

                       
                }
                 $sql = "INSERT INTO tbl_disbursement_check () VALUES (default,:amount,:disbursement_id,:check_id,'Active',:user_tracker,DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":amount",$datas["amount"]);
                        $stmt->bindValue(":disbursement_id", $referencedis);
                        $stmt->bindValue(":check_id", $shortUuid, PDO::PARAM_STR);
                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                        $stmt->execute();
            }   
            $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, :transactiondate,
                   :documentdate , :glcode, :slcode, :amount, :particulars, :reference, 'Auto', 'Posted', 
                    null, :payee_code, null, null, null, null, 'Payments', 'Payments', '/disbursements', :busunitcode,
                    'NA', 'NA', 0, :menutransactedref,
                    'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sql);
                    // $stmt->bindValue(":disbursement_id", $resultref['othermaprefroute'] , PDO::PARAM_STR);
                    $stmt->bindValue(":transactiondate", $data["bulkClearing"][0]["transaction_date"], PDO::PARAM_STR);
                    $stmt->bindValue(":documentdate", $data["bulkClearing"][0]["payment_date"], PDO::PARAM_STR);
                    $stmt->bindValue(":glcode",  substr($data["bulkClearing"][0]["slCode"], 0, 3), PDO::PARAM_STR);
                    $stmt->bindValue(":slcode", $data["bulkClearing"][0]["slCode"], PDO::PARAM_STR);
                    $stmt->bindValue(":amount", $data["bulkClearing"][0]["totalAmount"] * -1, PDO::PARAM_STR);
                    $stmt->bindValue(":particulars", $data["bulkClearing"][0]["particulars"], PDO::PARAM_STR);
                    $stmt->bindValue(":reference", $data["bulkClearing"][0]["payment_reference"], PDO::PARAM_STR);
                    $stmt->bindValue(":payee_code", $data["bulkClearing"][0]["supplierCode"], PDO::PARAM_STR);
                    $stmt->bindValue(":busunitcode", $data["bulkClearing"][0]["originalBusUnitCode"], PDO::PARAM_STR);
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

             

            $this->conn->commit();
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
    ROUND(
        SUM(
            CASE
                WHEN LEFT(tbl_accounting_transactions.menutransactedref, 2) = 'CV'
                    AND tbl_accounting_transactions.amount < 0
                    THEN ABS(tbl_accounting_transactions.amount)
                WHEN LEFT(tbl_accounting_transactions.menutransactedref, 2) <> 'CV'
                    AND LEFT(tbl_accounting_transactions.slcode, 3) = '400'
                    AND tbl_accounting_transactions.amount < 0
                    THEN ABS(tbl_accounting_transactions.amount)
                ELSE 0
            END
        ),
        2
    ) AS amount,
    tbl_accounting_transactions.particulars,
    tbl_accounting_transactions.supplier_code,
    tbl_accounting_transactions.busunitcode,
    lkp_busunits.name,
    lkp_busunits.address,
    lkp_corporation.corp_name,
    lkp_corporation.address,
    CASE 
        WHEN tbl_accounting_transactions.particulars = 'For-Replenish' THEN (
            SELECT t1.sl_description
            FROM lkp_chart_of_accounts AS t1
            LEFT JOIN tbl_disbursements AS t2 ON t1.slcode = t2.sl_code
            WHERE t2.sl_code LIKE '%101%' 
              AND t2.reference = tbl_accounting_transactions.menutransactedref
            LIMIT 1
        )
        WHEN LEFT(tbl_accounting_transactions.menutransactedref, 2) = 'CV' THEN (
            COALESCE(
                (
                    SELECT t1.sl_description
                    FROM lkp_chart_of_accounts AS t1
                    LEFT JOIN tbl_disbursements AS t2 ON t1.slcode = t2.sl_code
                    LEFT JOIN tbl_disbursement_check AS t3 ON t3.disbursement_id = t2.reference
                    WHERE t2.sl_code LIKE '%101%' 
                      AND t3.check_id = tbl_accounting_transactions.menutransactedref
                    LIMIT 1
                ),
                CASE 
    WHEN LEFT(tbl_accounting_transactions.supplier_code, 2) = 'SP' THEN (
        SELECT supplier_name
        FROM lkp_supplier
        WHERE supplier_code = tbl_accounting_transactions.supplier_code
        LIMIT 1
    )
    WHEN LEFT(tbl_accounting_transactions.supplier_code, 2) = 'BU' THEN (
        SELECT name
        FROM lkp_busunits
        WHERE busunitcode = tbl_accounting_transactions.supplier_code
        LIMIT 1
    )
                    ELSE NULL
                END
            )
        )
        ELSE 
            CASE 
    WHEN LEFT(tbl_accounting_transactions.supplier_code, 2) = 'SP' THEN (
        SELECT supplier_name
        FROM lkp_supplier
        WHERE supplier_code = tbl_accounting_transactions.supplier_code
        LIMIT 1
    )
    WHEN LEFT(tbl_accounting_transactions.supplier_code, 2) = 'BU' THEN (
        SELECT name
        FROM lkp_busunits
        WHERE busunitcode = tbl_accounting_transactions.supplier_code
        LIMIT 1
    )
                ELSE NULL
            END
    END AS supplier_name,
    CONCAT(tbl_users_global_assignment.firstname, ' ', tbl_users_global_assignment.middlename, ' ', tbl_users_global_assignment.lastname) AS fullname
FROM
    tbl_accounting_transactions
LEFT OUTER JOIN lkp_supplier 
    ON tbl_accounting_transactions.supplier_code = lkp_supplier.supplier_code
LEFT OUTER JOIN lkp_busunits 
    ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
LEFT OUTER JOIN lkp_corporation 
    ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
    AND lkp_busunits.corpcode = lkp_corporation.corp_code
LEFT JOIN tbl_users_global_assignment 
    ON tbl_accounting_transactions.usertracker = tbl_users_global_assignment.uuid
WHERE 
    tbl_accounting_transactions.menutransactedref = :menutransactedref
";

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

            tbl_accounting_transactions.transactionclass,

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
                            d.seq,
                            tbl_main.reference,
                            tbl_main.sl_code,
                            ROUND(SUM(tbl_main.total_amount), 2) AS amount,
                            d.transdate,
                            d.particulars,
                            d.document_ref,
                            d.payee_code,
                            d.busunitcode,
                            d.payment_status,
                            tbl_distinct_accounting_trans.othermapref,
                            CASE 
    WHEN d.particulars = 'For-Replenish' THEN (
        SELECT t1.sl_description
        FROM lkp_chart_of_accounts AS t1
        LEFT JOIN tbl_disbursements AS t2 ON t1.slcode = t2.sl_code
        WHERE t2.sl_code LIKE '%101%' AND t2.reference = tbl_main.reference
        LIMIT 1
    )
    WHEN LEFT(d.payee_code, 2) = 'SP' THEN (
        SELECT supplier_name
        FROM lkp_supplier
        WHERE supplier_code = d.payee_code
        LIMIT 1
    )
    WHEN LEFT(d.payee_code, 2) = 'BU' THEN (
        SELECT name
        FROM lkp_busunits
        WHERE busunitcode = d.payee_code
        LIMIT 1
    )
    ELSE NULL
END AS supplier_name,
                            tbl_distinct_accounting_trans.approvalstatus,
                            DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), d.transdate) AS days_since_transdate
                        FROM
                            (SELECT
                                tbl_accounting_transactions.menutransactedref AS reference,
                                tbl_accounting_transactions.slcode AS sl_code,
                                
                                ABS(tbl_accounting_transactions.amount) AS total_amount
                            FROM
                                tbl_accounting_transactions
                            WHERE
                                LEFT(tbl_accounting_transactions.slcode,3) = 400
                                AND tbl_accounting_transactions.amount < 0
                                AND tbl_accounting_transactions.menutransacted = '/disbursements'
                                AND tbl_accounting_transactions.deletestatus = 'Active'
                                AND tbl_accounting_transactions.approvalstatus NOT IN ('Voided', 'Cancelled')
                            UNION ALL
                            SELECT
                                dc.disbursement_reference,
                                COALESCE(ls.slcode, '40099') AS clearing_slcode,
                                dc.amount_cleared * -1       AS total_amount
                                FROM
                                tbl_disbursements_clearing AS dc
                                LEFT JOIN (
                                    SELECT
                                    t2.reference    AS reference,
                                    MIN(t1.slcode)  AS slcode
                                    FROM
                                    lkp_supplier AS t1
                                    JOIN tbl_disbursements AS t2
                                        ON t1.supplier_code = t2.payee_code
                                    WHERE
                                    t1.deletestatus = 'Active'
                                    GROUP BY
                                    t2.reference
                                ) AS ls
                                    ON ls.reference = dc.disbursement_reference
                                WHERE
                                dc.deletestatus = 'Active') tbl_main
                        LEFT JOIN (
                            SELECT
                                reference,
                                MIN(seq) AS seq,
                                MAX(transdate) AS transdate,
                                MAX(invoice_date) AS invoice_date,
                                MAX(document_ref) AS document_ref,
                                MAX(particulars) AS particulars,
                                MAX(payee_code) AS payee_code,
                                MAX(busunitcode) AS busunitcode,
                                MAX(payment_status) AS payment_status,
                                MAX(usertracker) AS usertracker
                            FROM tbl_disbursements
                            WHERE deletestatus = 'Active'
                            GROUP BY reference
                        ) d
                            ON tbl_main.reference = d.reference
                    LEFT JOIN
                            (SELECT DISTINCT menutransactedref, menutransacted, approvalstatus ,othermapref
                            FROM tbl_accounting_transactions WHERE deletestatus = 'Active') tbl_distinct_accounting_trans
                            ON d.reference = tbl_distinct_accounting_trans.menutransactedref
                            AND tbl_distinct_accounting_trans.menutransacted = '/disbursements'   
                        WHERE
                            tbl_main.reference LIKE :search
                            AND DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), d.transdate)
                            >= IF(:min <= 0, -100000, :min2) 
                            AND DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), d.transdate) <= :max
                            AND d.busunitcode = :busunitcode
                            AND d.payment_status <> 'Paid'
                        GROUP BY
                            tbl_main.reference
                        HAVING
                            ROUND(SUM(tbl_main.total_amount), 2) > 0
                        ORDER BY d.seq DESC
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







    public function getInfiniteData($page, $pageIndex, $pageData, $search, $busunitcode = "")
    {







        $sql = "SELECT
            chk.check_id AS reference,
            d.reference AS disbursement_reference,
            COALESCE(pay.transdate, d.transdate) AS transdate,
            COALESCE(pay.document_date, d.invoice_date) AS document_date,
            COALESCE(pay.slcode, atx.slcode) AS slcode,
            COALESCE(pay.payment_reference, d.document_ref, chk.check_id) AS ref,
            CAST(ROUND(chk.amount, 2) AS DECIMAL(18,2)) AS amount,
            CAST(ROUND(chk.amount, 2) AS DECIMAL(18,2)) AS amount_cleared,
            CAST(ROUND(COALESCE(atx.payable_amount, 0), 2) AS DECIMAL(18,2)) AS payable_amount,
            CAST(
                ROUND(
                    GREATEST(
                        COALESCE(atx.payable_amount, 0) - COALESCE(dc_total.amount_cleared, 0),
                        0
                    ),
                    2
                ) AS DECIMAL(18,2)
            ) AS outstanding_amount,
            d.particulars,
            d.payee_code AS supplier_code,
            CASE
                WHEN LEFT(d.payee_code, 2) = 'SP' THEN (
                    SELECT supplier_name
                    FROM lkp_supplier
                    WHERE supplier_code = d.payee_code
                    LIMIT 1
                )
                WHEN LEFT(d.payee_code, 2) = 'BU' THEN (
                    SELECT name
                    FROM lkp_busunits
                    WHERE busunitcode = d.payee_code
                    LIMIT 1
                )
                ELSE NULL
            END AS supplier_name,
            lkp_supplier.check_name,
            lkp_supplier.tin,
            lkp_supplier.address,
            lkp_supplier.atc,
            lkp_supplier.whtx_rate,
            lkp_supplier.product_type,
            d.busunitcode,
            lkp_busunits.name,
            d.payment_status,
            DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), COALESCE(pay.transdate, d.transdate)) AS days_since_transdate,
            pay.payment_type,
            chk.usertracker,
            COALESCE(pay.approvalstatus, atx.approvalstatus) AS approvalstatus
        FROM tbl_disbursement_check chk
        INNER JOIN (
            SELECT
                reference,
                MIN(seq) AS seq,
                MAX(transdate) AS transdate,
                MAX(invoice_date) AS invoice_date,
                MAX(document_ref) AS document_ref,
                MAX(particulars) AS particulars,
                MAX(payee_code) AS payee_code,
                MAX(busunitcode) AS busunitcode,
                MAX(payment_status) AS payment_status,
                MAX(usertracker) AS usertracker,
                MAX(createdtime) AS createdtime
            FROM tbl_disbursements
            WHERE deletestatus = 'Active'
            GROUP BY reference
        ) d
            ON d.reference = chk.disbursement_id
        LEFT JOIN (
            SELECT
                menutransactedref,
                MIN(CASE WHEN LEFT(slcode, 3) = '400' AND amount < 0 THEN slcode END) AS slcode,
                MAX(approvalstatus) AS approvalstatus,
                ROUND(
                    SUM(
                        CASE
                            WHEN LEFT(slcode, 3) = '400'
                                AND amount < 0
                                AND approvalstatus NOT IN ('Voided', 'Cancelled')
                                THEN ABS(amount)
                            ELSE 0
                        END
                    ),
                    2
                ) AS payable_amount
            FROM tbl_accounting_transactions
            WHERE deletestatus = 'Active'
              AND menutransacted = '/disbursements'
            GROUP BY menutransactedref
        ) atx
            ON atx.menutransactedref = d.reference
        LEFT JOIN (
            SELECT
                menutransactedref,
                MAX(transdate) AS transdate,
                MAX(document_date) AS document_date,
                MIN(CASE WHEN LEFT(slcode, 3) IN ('100', '110') THEN slcode END) AS slcode,
                SUBSTRING_INDEX(
                    GROUP_CONCAT(reference ORDER BY seq DESC SEPARATOR '||'),
                    '||',
                    1
                ) AS payment_reference,
                CASE
                    WHEN SUM(CASE WHEN LEFT(slcode, 3) = '110' THEN 1 ELSE 0 END) > 0
                        THEN 'DATED CHECK'
                    ELSE 'CASH'
                END AS payment_type,
                MAX(approvalstatus) AS approvalstatus
            FROM tbl_accounting_transactions
            WHERE deletestatus = 'Active'
              AND menutransacted = '/disbursements'
              AND LEFT(menutransactedref, 2) = 'CV'
            GROUP BY menutransactedref
        ) pay
            ON pay.menutransactedref = chk.check_id
        LEFT JOIN (
            SELECT
                disbursement_reference,
                ROUND(SUM(amount_cleared), 2) AS amount_cleared
            FROM tbl_disbursements_clearing
            WHERE deletestatus = 'Active'
            GROUP BY disbursement_reference
        ) dc_total
            ON dc_total.disbursement_reference = d.reference
        LEFT OUTER JOIN lkp_supplier ON d.payee_code = lkp_supplier.supplier_code
        LEFT OUTER JOIN lkp_busunits ON d.busunitcode = lkp_busunits.busunitcode
        WHERE
            chk.deletestatus = 'Active'
            AND chk.amount > 0
            AND
            (
                d.document_ref LIKE :search_document_ref
                OR d.reference LIKE :search_reference
                OR chk.check_id LIKE :search_check_id
                OR pay.payment_reference LIKE :search_payment_reference
            )
            AND (
                :busunitcode_empty = ''
                OR d.busunitcode = :busunitcode_filter
            )
            AND d.payment_status IN ('Partial','Paid')
        ORDER BY
            DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), COALESCE(pay.transdate, d.transdate)) ASC,
            chk.createdtime DESC,
            supplier_name ASC,
            amount ASC,
            chk.seq DESC";







        $stmt = $this->conn->prepare($sql);







        $searchLike = '%' . $search . '%';
        $stmt->bindValue(":search_document_ref", $searchLike, PDO::PARAM_STR);
        $stmt->bindValue(":search_reference", $searchLike, PDO::PARAM_STR);
        $stmt->bindValue(":search_check_id", $searchLike, PDO::PARAM_STR);
        $stmt->bindValue(":search_payment_reference", $searchLike, PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode_empty", $busunitcode, PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode_filter", $busunitcode, PDO::PARAM_STR);







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

            $slCode = $data["slCode"] == 40098 ? $data["pdcSLCode"]  : $data["slCode"];  //40098 is ACcounts payable PDC
            $slDescription = $data["slCode"] == 40098 ? $data["pdcSLDescription"]  : $data["slDescription"];  

            $requestedAmount = (float) ($data["amount"] ?? 0);
            if ($requestedAmount <= 0) {
                throw new Exception("Amount to clear should be greater than zero.");
            }

            $outstandingSql = "SELECT
                    ROUND(
                        COALESCE(SUM(
                            CASE
                                WHEN LEFT(slcode, 3) = '400'
                                    AND amount < 0
                                    AND approvalstatus NOT IN ('Voided', 'Cancelled')
                                    THEN ABS(amount)
                                ELSE 0
                            END
                        ), 0)
                        - COALESCE((
                            SELECT SUM(amount_cleared)
                            FROM tbl_disbursements_clearing
                            WHERE disbursement_reference = :clearing_reference
                              AND deletestatus = 'Active'
                        ), 0),
                        2
                    ) AS outstanding_amount
                FROM tbl_accounting_transactions
                WHERE menutransactedref = :transaction_reference
                  AND menutransacted = '/disbursements'
                  AND deletestatus = 'Active'";
            $outstandingStmt = $this->conn->prepare($outstandingSql);
            $outstandingStmt->bindValue(":clearing_reference", $referencedis, PDO::PARAM_STR);
            $outstandingStmt->bindValue(":transaction_reference", $referencedis, PDO::PARAM_STR);
            $outstandingStmt->execute();
            $outstandingRow = $outstandingStmt->fetch(PDO::FETCH_ASSOC);
            $outstandingAmount = (float) ($outstandingRow["outstanding_amount"] ?? 0);

            if ($requestedAmount - $outstandingAmount > 0.004) {
                throw new Exception("Amount to clear should not be greater than the outstanding payable.");
            }

            $paymentStatus = abs($outstandingAmount - $requestedAmount) < 0.005 ? "Paid" : "Partial";

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
            $stmt->bindValue(":slCode", $slCode, PDO::PARAM_STR);
            $stmt->bindValue(":slDescription",  $slDescription , PDO::PARAM_STR);
            $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            // Update Status
           

            $sql = "UPDATE tbl_disbursements SET payment_status = :status,
            usertracker = :user_tracker
             WHERE
                reference = :reference";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":status", $paymentStatus, PDO::PARAM_STR);
            // $stmt->bindValue(":ref", $reference);
            $stmt->bindValue(":reference", $data["disbursementReference"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            //Insert into Table Accounting Entries Debit Cash Received

            $nextCheckReference = $this->generateNextReference(
                "CV",
                "tbl_disbursement_check",
                "check_id",
            );
            $shortUuid = $nextCheckReference["reference"];

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
                $stmt->bindValue(":slcode", $data["supplierslcode"], PDO::PARAM_STR);
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
        } catch (Throwable $e) {

            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }







    }

public function getAllDisbursementItems($page, $pageIndex, $pageData, $search, $busunitcode)
{
    $page = (int)($page ?: 1);
    $pageIndex = (int)($pageIndex ?: 10);

    $search = isset($search) && $search !== "undefined" && $search !== "null"
        ? trim($search)
        : "";

    // use pageData as busunitcode for this endpoint
    $busunitcode = isset($pageData) ? trim($pageData) : "";

    $sql = "SELECT
                d.seq,
                d.reference,
                d.transdate,
                d.invoice_date,
                d.document_ref,
                d.particulars,
                d.payee_code,
                d.busunitcode,
                d.payment_status,
                d.usertracker,
                atx.othermapref,
                COALESCE(atx.payable_amount, 0) AS payable_amount,
                COALESCE(dc.amount_cleared, 0) AS amount_cleared,
                ROUND(
                    GREATEST(
                        COALESCE(atx.payable_amount, 0) - COALESCE(dc.amount_cleared, 0),
                        0
                    ),
                    2
                ) AS amount,
                (
                    SELECT dc.payment_type
                    FROM tbl_disbursements_clearing dc
                    WHERE dc.disbursement_reference = d.reference
                      AND dc.deletestatus = 'Active'
                    ORDER BY dc.seq DESC
                    LIMIT 1
                ) AS payment_type,
                (
                    SELECT dc.payment_reference
                    FROM tbl_disbursements_clearing dc
                    WHERE dc.disbursement_reference = d.reference
                      AND dc.deletestatus = 'Active'
                    ORDER BY dc.seq DESC
                    LIMIT 1
                ) AS ref,
                CASE
                    WHEN d.particulars = 'For-Replenish' THEN (
                        SELECT coa.sl_description
                        FROM lkp_chart_of_accounts coa
                        LEFT JOIN tbl_disbursements d2
                            ON coa.slcode = d2.sl_code
                        WHERE d2.reference = d.reference
                          AND d2.sl_code LIKE '%101%'
                        LIMIT 1
                    )
                    WHEN LEFT(d.payee_code, 2) = 'SP' THEN (
                        SELECT supplier_name
                        FROM lkp_supplier
                        WHERE supplier_code = d.payee_code
                        LIMIT 1
                    )
                    WHEN LEFT(d.payee_code, 2) = 'BU' THEN (
                        SELECT name
                        FROM lkp_busunits
                        WHERE busunitcode = d.payee_code
                        LIMIT 1
                    )
                    ELSE NULL
                END AS supplier_name,
                atx.approvalstatus,
                DATEDIFF(DATE_ADD(NOW(), INTERVAL 8 HOUR), d.transdate) AS days_since_transdate
            FROM (
                SELECT
                    reference,
                    MIN(seq) AS seq,
                    MAX(transdate) AS transdate,
                    MAX(invoice_date) AS invoice_date,
                    MAX(document_ref) AS document_ref,
                    MAX(particulars) AS particulars,
                    MAX(payee_code) AS payee_code,
                    MAX(busunitcode) AS busunitcode,
                    MAX(payment_status) AS payment_status,
                    MAX(usertracker) AS usertracker
                FROM tbl_disbursements
                WHERE deletestatus = 'Active'
                GROUP BY reference
            ) d
            LEFT JOIN (
                SELECT
                    menutransactedref,othermapref,
                    MAX(approvalstatus) AS approvalstatus,
                    ROUND(
                        SUM(
                            CASE
                                WHEN LEFT(slcode, 3) = '400'
                                    AND amount < 0
                                    AND approvalstatus NOT IN ('Voided', 'Cancelled')
                                    THEN ABS(amount)
                                ELSE 0
                            END
                        ),
                        2
                    ) AS payable_amount
                FROM tbl_accounting_transactions
                WHERE deletestatus = 'Active'
                  AND menutransacted = '/disbursements'
                GROUP BY menutransactedref
            ) atx
                ON atx.menutransactedref = d.reference
            LEFT JOIN (
                SELECT
                    disbursement_reference,
                    ROUND(SUM(amount_cleared), 2) AS amount_cleared
                FROM tbl_disbursements_clearing
                WHERE deletestatus = 'Active'
                GROUP BY disbursement_reference
            ) dc
                ON dc.disbursement_reference = d.reference
            WHERE d.busunitcode = :busunitcode
              AND d.reference LIKE :search
            GROUP BY
                d.reference,
                d.seq,
                d.transdate,
                d.invoice_date,
                d.document_ref,
                d.particulars,
                d.payee_code,
                d.busunitcode,
                d.payment_status,
                d.usertracker,
                atx.approvalstatus,
                atx.payable_amount,
                dc.amount_cleared
            ORDER BY d.seq DESC";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
    $stmt->bindValue(":search", "%" . $search . "%", PDO::PARAM_STR);
    $stmt->execute();

    $data = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $data[] = $row;
    }

    return [
        "items" => $data,
        "nextPage" => count($data) > 0 ? $page + 1 : null,
    ];
}






}



