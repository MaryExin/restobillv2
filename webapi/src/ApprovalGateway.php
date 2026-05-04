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
                    tbl_employees.position
                FROM 
                    tbl_approval_creds
                    LEFT OUTER JOIN tbl_employees ON tbl_approval_creds.empid = tbl_employees.empid
                WHERE tbl_approval_creds.deletestatus = 'Active'
                    AND moduletoapprove = :route
                    AND busunitcode = :busunitcode
                ORDER BY tbl_approval_creds.approvalseq ASC";

        $stmt = $this->conn->prepare($sql);

        $result = [];
        $approvedMap = [];
        $route = $data["route"] ?? "";

        // Check if "references" exists and is an array
        if (isset($data["references"]) && is_array($data["references"])) {
            foreach ($data["references"] as $reference) {
                $approvedMap = array_merge(
                    $approvedMap,
                    $this->getApprovedHistoryMap($reference, $route),
                );
            }
        } elseif (isset($data["reference"]) && is_string($data["reference"])) { // Handle single reference as string
            $approvedMap = $this->getApprovedHistoryMap($data["reference"], $route);
        } else {
            throw new Exception("Invalid reference data format");
        }

        $stmt->bindValue(":route", $route, PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $row["approvalhistoryid"] = isset($approvedMap[$row["approvalid"]])
                ? $row["approvalid"]
                : null;
            $result[] = $row;
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

//Helpers

private function getActiveApprovers($route, $busunitcode)
{
    $sql = "SELECT approvalid, empid, approvaldescription, approvalseq
            FROM tbl_approval_creds
            WHERE deletestatus = 'Active'
              AND moduletoapprove = :route
              AND busunitcode = :busunitcode
            ORDER BY approvalseq ASC, seq ASC";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":route", $route, PDO::PARAM_STR);
    $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

private function getApproverById($route, $busunitcode, $approvalid)
{
    $sql = "SELECT approvalid, empid, approvaldescription, approvalseq
            FROM tbl_approval_creds
            WHERE deletestatus = 'Active'
              AND moduletoapprove = :route
              AND busunitcode = :busunitcode
              AND approvalid = :approvalid
            LIMIT 1";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":route", $route, PDO::PARAM_STR);
    $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
    $stmt->bindValue(":approvalid", $approvalid, PDO::PARAM_STR);
    $stmt->execute();

    return $stmt->fetch(PDO::FETCH_ASSOC);
}

private function getReferenceAliases($reference, $route = "")
{
    $reference = strtoupper(trim((string) $reference));
    $route = trim((string) $route);

    if ($reference === "") {
        return [];
    }

    $aliases = [$reference => true];

    if ($route === "/pettycashtransaction") {
        if (strpos($reference, "PCF-") === 0) {
            $aliases["DB--" . substr($reference, 4)] = true;
            $aliases["DB-" . substr($reference, 4)] = true;
        } elseif (strpos($reference, "DB--") === 0) {
            $aliases["PCF-" . substr($reference, 4)] = true;
        } elseif (strpos($reference, "DB-") === 0) {
            $aliases["PCF-" . substr($reference, 3)] = true;
        }
    }

    return array_keys($aliases);
}

private function getApprovedHistoryMap($reference, $route = "")
{
    $aliases = $this->getReferenceAliases($reference, $route);
    if (empty($aliases)) {
        return [];
    }

    $placeholders = [];
    foreach ($aliases as $index => $alias) {
        $placeholders[] = ":reference_" . $index;
    }

    $sql = "SELECT approvalid
            FROM tbl_approval_history
            WHERE menutransactedref IN (" . implode(", ", $placeholders) . ")
              AND deletestatus = 'Active'";

    $stmt = $this->conn->prepare($sql);
    foreach ($aliases as $index => $alias) {
        $stmt->bindValue(":reference_" . $index, $alias, PDO::PARAM_STR);
    }
    $stmt->execute();

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $map = [];

    foreach ($rows as $row) {
        $map[$row["approvalid"]] = true;
    }

    return $map;
}

private function insertApprovalHistory($reference, $approvalid, $user_id)
{
    $sql = "INSERT INTO tbl_approval_history ()
            VALUES (
                default,
                :reference,
                :approvalid,
                'Active',
                :usertracker,
                DATE_ADD(NOW(), INTERVAL 8 HOUR)
            )";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
    $stmt->bindValue(":approvalid", $approvalid, PDO::PARAM_STR);
    $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
    $stmt->execute();
}

private function isPreviousSequenceApproved($approvers, $approvedMap, $previousSeq)
{
    $foundPrevious = false;

    foreach ($approvers as $approver) {
        if ((int) $approver["approvalseq"] === (int) $previousSeq) {
            $foundPrevious = true;

            if (!isset($approvedMap[$approver["approvalid"]])) {
                return false;
            }
        }
    }

    return $foundPrevious ? true : false;
}

private function areAllApprovalsCompleted($approvers, $approvedMap)
{
    foreach ($approvers as $approver) {
        if (!isset($approvedMap[$approver["approvalid"]])) {
            return false;
        }
    }

    return true;
}

private function updateAccountingTransactionApproval($reference, $approvalid, $approvaldescription)
{
    $sql = "UPDATE tbl_accounting_transactions
            SET approvalref = :approvalid,
                approvalstatus = :approvaldescription,
                createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
            WHERE menutransactedref = :reference";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":approvalid", $approvalid, PDO::PARAM_STR);
    $stmt->bindValue(":approvaldescription", $approvaldescription, PDO::PARAM_STR);
    $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
    $stmt->execute();
}

private function normalizeRoleNames(array $roles): array
{
    return array_values(array_unique(array_map(
        static fn($role) => strtoupper(trim((string) $role)),
        $roles
    )));
}

private function normalizeAccountingPeriod($accountingPeriod): string
{
    if (!is_string($accountingPeriod) || trim($accountingPeriod) === '') {
        throw new Exception("Transaction date is required.");
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $accountingPeriod);

    if (!$date) {
        throw new Exception("Invalid transaction date.");
    }

    return $date->modify('last day of this month')->format('Y-m-d');
}

private function getReferenceContext($reference)
{
    $sql = "SELECT transdate, document_date, busunitcode, approvalstatus, menutransacted
            FROM tbl_accounting_transactions
            WHERE menutransactedref = :reference
              AND deletestatus = 'Active'
            ORDER BY seq DESC
            LIMIT 1";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
    $stmt->execute();

    return $stmt->fetch(PDO::FETCH_ASSOC);
}

private function isClosedAccountingPeriod($busunitcode, $transdate): bool
{
    $normalizedAccountingPeriod = $this->normalizeAccountingPeriod($transdate);

    $sql = "SELECT MAX(accounting_period) AS accounting_period
            FROM tbl_accounting_period
            WHERE busunitcode = :busunitcode
              AND status = 'Closed'
              AND deletestatus = 'Active'";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
    $stmt->execute();

    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $latestClosedPeriod = $result["accounting_period"] ?? null;

    return !empty($latestClosedPeriod) && $latestClosedPeriod >= $normalizedAccountingPeriod;
}

private function getRestorableStatuses(): array
{
    return [
        "VOIDED",
        "CANCELLED",
        "CANCELED",
        "POSTED",
        "APPROVED",
        "FORWARDED TO DISBURSEMENT"
    ];
}

private function resetApprovalHistory($reference): void
{
    $sql = "UPDATE tbl_approval_history
            SET deletestatus = 'Inactive'
            WHERE menutransactedref = :reference
              AND deletestatus = 'Active'";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
    $stmt->execute();
}

private function updateFixedAssetApprovalByReference($reference, $approvaldescription): void
{
    $suffix = strlen((string) $reference) > 3 ? substr((string) $reference, 3) : (string) $reference;
    $likeReference = '%' . $suffix . '%';

    $sql = "UPDATE tbl_fixed_assets
            SET approvalstatus = :approvaldescription
            WHERE fixedassetid = :fixedasset_reference
               OR menutransactedref = :menu_reference
               OR fixedassetid LIKE :fixedasset_reference_like
               OR menutransactedref LIKE :menu_reference_like";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":approvaldescription", $approvaldescription, PDO::PARAM_STR);
    $stmt->bindValue(":fixedasset_reference", $reference, PDO::PARAM_STR);
    $stmt->bindValue(":menu_reference", $reference, PDO::PARAM_STR);
    $stmt->bindValue(":fixedasset_reference_like", $likeReference, PDO::PARAM_STR);
    $stmt->bindValue(":menu_reference_like", $likeReference, PDO::PARAM_STR);
    $stmt->execute();
}

private function applyPostedSideEffects($reference, $approvalid, $approvaldescription)
{
    if (substr($reference, 0, 2) == 'FA') {
        $sql = "SELECT * 
                FROM tbl_fixed_assets 
                WHERE fixedassetid LIKE :fixedassetid 
                  AND transactiontype = 'Setup'";
        $stmt = $this->conn->prepare($sql);
        $likeReference = '%' . $reference . '%';
        $stmt->bindValue(":fixedassetid", $likeReference, PDO::PARAM_STR);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($result) {
            $sql = "UPDATE tbl_accounting_transactions 
                    SET approvalstatus = 'Posted' 
                    WHERE menutransactedref = :reference";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
            $stmt->execute();
        }
    }

    $reference = trim((string) $reference);
    $refDB = $reference;
    $referenceLookupValue = $reference;
    $useReferenceLike = false;

    if (strpos($reference, 'JV-') === 0) {
        $refDB = "JV-" . substr($reference, 3);
        $referenceLookupValue = '%' . substr($reference, 3) . '%';
        $useReferenceLike = true;
    } elseif (strpos($reference, 'PCF-') === 0) {
        $refDB = $reference;
        $referenceLookupValue = $reference;
    } else {
        $refDB = "DB-" . substr($reference, 3);
        $referenceLookupValue = '%' . substr($reference, 3) . '%';
        $useReferenceLike = true;
    }

    $sql = "UPDATE tbl_accounting_transactions
            SET menutransactedref = :refDB
            WHERE menutransactedref " . ($useReferenceLike ? "LIKE" : "=") . " :reference";
    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":refDB", $refDB, PDO::PARAM_STR);
    $stmt->bindValue(":reference", $referenceLookupValue, PDO::PARAM_STR);
    $stmt->execute();

    if (substr($reference, 0, 2) == 'PV') {
        $sql = "UPDATE tbl_approval_history
                SET menutransactedref = :refDB
                WHERE menutransactedref LIKE :reference";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":refDB", $refDB, PDO::PARAM_STR);
        $stmt->bindValue(":reference", $referenceLookupValue, PDO::PARAM_STR);
        $stmt->execute();
    }

    $sql = "UPDATE tbl_fixed_assets
            SET menutransactedref = :refDB,
                approvalstatus = :approvaldescription
            WHERE fixedassetid LIKE :reference
              AND approvalstatus != 'Posted'";
    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":refDB", $refDB, PDO::PARAM_STR);
    $stmt->bindValue(":approvaldescription", $approvaldescription, PDO::PARAM_STR);
    $stmt->bindValue(":reference", $referenceLookupValue, PDO::PARAM_STR);
    $stmt->execute();

    $sql = "UPDATE tbl_disbursements
            SET deletestatus = 'Active'
            WHERE reference LIKE :reference";
    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":reference", $referenceLookupValue, PDO::PARAM_STR);
    $stmt->execute();
}

private function processVoidOrCancelled($user_id, $reference, $approvalid, $approvaldescription)
{
    $this->updateAccountingTransactionApproval($reference, $approvalid, $approvaldescription);
    $this->insertApprovalHistory($reference, $approvalid, $user_id);
    $this->updateFixedAssetApprovalByReference($reference, $approvaldescription);

    if (substr($reference, 0, 2) == 'FA') {
        return;
    } elseif (substr($reference, 0, 2) == 'CV') {
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
        $stmt->bindValue(":check_id", $reference, PDO::PARAM_STR);
        $stmt->execute();
        $resultref = $stmt->fetch(PDO::FETCH_ASSOC);

        $sql = "UPDATE tbl_disbursements_clearing AS t1
                LEFT JOIN tbl_disbursement_check AS t2
                    ON t1.disbursement_reference = t2.disbursement_id
                LEFT JOIN tbl_accounting_transactions AS t3
                    ON t3.menutransactedref = t2.check_id
                    AND t1.payment_reference = t3.reference
                SET t1.deletestatus = 'Inactive',
                    t2.deletestatus = 'Inactive'
                WHERE t3.menutransactedref = :check_id";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":check_id", $reference, PDO::PARAM_STR);
        $stmt->execute();

        if ($resultref && isset($resultref["disbursement_reference"])) {
            $sql = "SELECT SUM(amount_cleared) as amount_cleared
                    FROM tbl_disbursements_clearing
                    WHERE disbursement_reference = :disbursement_reference
                      AND deletestatus = 'Active'";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":disbursement_reference", $resultref["disbursement_reference"], PDO::PARAM_STR);
            $stmt->execute();
            $amount_cleared = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($amount_cleared["amount_cleared"] === null) {
                $sql = "UPDATE tbl_disbursements
                        SET payment_status = 'Unpaid'
                        WHERE reference = :reference";
            } else {
                $sql = "UPDATE tbl_disbursements
                        SET payment_status = 'Partial'
                        WHERE reference = :reference";
            }

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":reference", $resultref["disbursement_reference"], PDO::PARAM_STR);
            $stmt->execute();
        }
    }
}

private function processUndoVoid($reference, array $roles): void
{
    $normalizedRoles = $this->normalizeRoleNames($roles);

    if (!in_array("VOIDER", $normalizedRoles, true)) {
        throw new Exception("You need the VOIDER role to restore this transaction.");
    }

    $context = $this->getReferenceContext($reference);

    if (!$context) {
        throw new Exception("Transaction reference not found.");
    }

    $currentStatus = strtoupper(trim((string) ($context["approvalstatus"] ?? "")));
    if (!in_array($currentStatus, $this->getRestorableStatuses(), true)) {
        throw new Exception(
            "Only approved, posted, voided, cancelled, or forwarded transactions can be restored. Current status: " .
            ($currentStatus !== "" ? $currentStatus : "BLANK")
        );
    }

    $transactionDate = $context["transdate"] ?: $context["document_date"];
    if ($this->isClosedAccountingPeriod($context["busunitcode"] ?? "", $transactionDate)) {
        throw new Exception("Cannot restore this transaction because its accounting period is already closed.");
    }

    $sql = "UPDATE tbl_accounting_transactions
            SET approvalref = 'Initial',
                approvalstatus = 'Pending',
                createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
            WHERE menutransactedref = :reference";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
    $stmt->execute();

    $this->resetApprovalHistory($reference);
    $this->updateFixedAssetApprovalByReference($reference, "Pending");
}

public function approveTransaction($user_id, $data)
{
    try {
        $this->conn->beginTransaction();

        if (isset($data["references"])) {
            $references = is_array($data["references"]) ? $data["references"] : [$data["references"]];
        } elseif (isset($data["reference"])) {
            $references = [$data["reference"]];
        } else {
            throw new Exception("Reference is required");
        }

        $route = $data["route"] ?? "";
        $busunitcode = $data["busunitcode"] ?? "";
        $requestedApprovalid = $data["approvalid"] ?? "";
        $requestedDescription = $data["approvaldescription"] ?? "APPROVER";
        $approvalMode = strtoupper(trim($data["approvalmode"] ?? "NORMAL"));
        $roles = isset($data["roles"]) && is_array($data["roles"]) ? $data["roles"] : [];

        $hasApproveAll = in_array("ACCTG-APPROVEALL", $roles, true);
        $hasApproveSkip = in_array("ACCTG-APPROVESKIP", $roles, true);

        /**
         * Final effective mode priority:
         * VOID > APPROVEALL > APPROVESKIP > NORMAL
         *
         * If user has both APPROVEALL and APPROVESKIP,
         * APPROVEALL wins.
         */
        if ($approvalMode === "UNDO_VOID") {
            $effectiveApprovalMode = "UNDO_VOID";
        } elseif (
            $requestedDescription === "Voided" ||
            $requestedDescription === "Cancelled" ||
            $approvalMode === "VOID"
        ) {
            $effectiveApprovalMode = "VOID";
        } elseif ($hasApproveAll) {
            $effectiveApprovalMode = "APPROVEALL";
        } elseif ($hasApproveSkip) {
            $effectiveApprovalMode = "APPROVESKIP";
        } else {
            $effectiveApprovalMode = "NORMAL";
        }

        foreach ($references as $reference) {
            if ($effectiveApprovalMode === "UNDO_VOID") {
                $this->processUndoVoid($reference, $roles);
                continue;
            }

            if ($effectiveApprovalMode === "VOID") {
                $this->processVoidOrCancelled(
                    $user_id,
                    $reference,
                    $requestedApprovalid,
                    $requestedDescription
                );
                continue;
            }

            if (empty($route) || empty($busunitcode) || empty($requestedApprovalid)) {
                throw new Exception("route, busunitcode, and approvalid are required");
            }

            $approvers = $this->getActiveApprovers($route, $busunitcode);
            if (empty($approvers)) {
                throw new Exception("No active approvers found");
            }

            $currentApprover = $this->getApproverById($route, $busunitcode, $requestedApprovalid);
            if (!$currentApprover) {
                throw new Exception("Approver not found");
            }

            if ((string) $currentApprover["empid"] !== (string) $user_id) {
                throw new Exception("You are not authorized to approve this transaction");
            }

            $approvedMap = $this->getApprovedHistoryMap($reference, $route);

            if (isset($approvedMap[$requestedApprovalid])) {
                throw new Exception("This approval step is already approved");
            }

            $finalApprovalid = $requestedApprovalid;
            $finalStatus = $requestedDescription;

            if ($effectiveApprovalMode === "APPROVEALL") {
                foreach ($approvers as $approver) {
                    if (!isset($approvedMap[$approver["approvalid"]])) {
                        $this->insertApprovalHistory($reference, $approver["approvalid"], $user_id);
                        $approvedMap[$approver["approvalid"]] = true;
                    }
                    $finalApprovalid = $approver["approvalid"];
                }

                $finalStatus = "Posted";
            } else {
                if ($effectiveApprovalMode !== "APPROVESKIP") {
                    $previousSeq = (int) $currentApprover["approvalseq"] - 1;

                    if (
                        $previousSeq > 0 &&
                        !$this->isPreviousSequenceApproved($approvers, $approvedMap, $previousSeq)
                    ) {
                        throw new Exception("Approval " . $previousSeq . " should be initiated first");
                    }
                }

                $this->insertApprovalHistory($reference, $requestedApprovalid, $user_id);
                $approvedMap[$requestedApprovalid] = true;

                $allApproved = $this->areAllApprovalsCompleted($approvers, $approvedMap);
                $finalStatus = $allApproved ? "Posted" : $requestedDescription;
            }

            $this->updateAccountingTransactionApproval($reference, $finalApprovalid, $finalStatus);

            if ($finalStatus === "Posted") {
                $this->applyPostedSideEffects($reference, $finalApprovalid, $finalStatus);
            } else {
                if (substr($reference, 0, 2) == 'FA') {
                    $sql = "UPDATE tbl_accounting_transactions 
                            SET approvalref = :approvalid, approvalstatus = 'Pending'
                            WHERE menutransactedref = :reference";
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":approvalid", $finalApprovalid, PDO::PARAM_STR);
                    $stmt->bindValue(":reference", $reference, PDO::PARAM_STR);
                    $stmt->execute();
                }
            }
        }

        $this->conn->commit();

        echo json_encode([
            "message" => "Success",
            "approvalmode" => $effectiveApprovalMode
        ]);
    } catch (Exception $e) {
        if ($this->conn->inTransaction()) {
            $this->conn->rollBack();
        }

        echo json_encode([
            "message" => "Error",
            "error" => $e->getMessage()
        ]);
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



