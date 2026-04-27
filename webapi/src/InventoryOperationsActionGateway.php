<?php

class InventoryOperationsActionGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function processActionForUser(string $user_id, array $data): array
    {
        $action = strtolower(trim((string) ($data["action"] ?? "")));
        $queueCodes = $this->normalizeQueueCodes($data);

        if ($action === "" || empty($queueCodes)) {
            http_response_code(422);
            return ["message" => "actionAndQueueCodesRequired"];
        }

        $actionMap = [
            "approve_pr" => [
                "role_check" => ["IMS-ADMIN", "IMS-PR-APPROVER"],
                "label" => "PR Approved",
                "event_code" => "IMS_PR_APPROVED",
            ],
            "approve_po" => [
                "role_check" => ["IMS-ADMIN", "IMS-PO-APPROVER"],
                "label" => "PO Approved",
                "event_code" => "IMS_PO_APPROVED",
            ],
        ];

        if (!array_key_exists($action, $actionMap)) {
            http_response_code(422);
            return ["message" => "invalidAction"];
        }

        $roleSet = $this->getUserRoleSet($user_id);
        $allowed = false;
        foreach ($actionMap[$action]["role_check"] as $roleName) {
            if (isset($roleSet[$roleName])) {
                $allowed = true;
                break;
            }
        }

        if (!$allowed) {
            http_response_code(403);
            return [
                "message" => "roleRequired",
                "required_roles" => $actionMap[$action]["role_check"],
            ];
        }

        $summaryMap = $this->getQueueSummaryMap($queueCodes);
        $processed = [];
        $skipped = [];
        $processedSummaries = [];

        try {
            $this->conn->beginTransaction();

            foreach ($queueCodes as $queueCode) {
                if (!array_key_exists($queueCode, $summaryMap)) {
                    $skipped[] = [
                        "prd_queue_code" => $queueCode,
                        "reason" => "notFound",
                    ];
                    continue;
                }

                $summary = $summaryMap[$queueCode];

                if ($action === "approve_pr") {
                    if (strcasecmp((string) ($summary["pr_status"] ?? ""), "Approved") === 0) {
                        $skipped[] = [
                            "prd_queue_code" => $queueCode,
                            "reason" => "prAlreadyApproved",
                        ];
                        continue;
                    }

                    $this->approvePr($user_id, $queueCode);
                    $summary["pr_status"] = "Approved";
                }

                if ($action === "approve_po") {
                    if (strcasecmp((string) ($summary["pr_status"] ?? ""), "Approved") !== 0) {
                        $skipped[] = [
                            "prd_queue_code" => $queueCode,
                            "reason" => "prMustBeApprovedFirst",
                        ];
                        continue;
                    }

                    if (strcasecmp((string) ($summary["po_status"] ?? ""), "Approved") === 0) {
                        $skipped[] = [
                            "prd_queue_code" => $queueCode,
                            "reason" => "poAlreadyApproved",
                        ];
                        continue;
                    }

                    $poStatusNormalized = strtolower(trim((string) ($summary["po_status"] ?? "")));
                    if (!in_array($poStatusNormalized, ["pending", "approved by purchaser"], true)) {
                        $skipped[] = [
                            "prd_queue_code" => $queueCode,
                            "reason" => "poStatusNotApprovable",
                        ];
                        continue;
                    }

                    $this->approvePo($user_id, $queueCode, $summary);
                    $summary["po_status"] = "Approved";
                    if (str_starts_with((string) ($summary["orderedby"] ?? ""), "BU-") &&
                        str_starts_with((string) ($summary["payee"] ?? ""), "SP-")) {
                        $summary["production_status"] = "Skipped";
                        $summary["billing_status"] = "Skipped";
                    }
                    if (strtoupper(trim((string) ($summary["orderedby_class"] ?? ""))) === "COMMI" &&
                        strtoupper(trim((string) ($summary["payee_class"] ?? ""))) === "COMMI") {
                        $summary["production_status"] = "Pending";
                        if ((string) ($summary["orderedby"] ?? "") === (string) ($summary["payee"] ?? "")) {
                            $summary["billing_status"] = "Skipped";
                        } else {
                            $summary["delivery_status"] = "Pending";
                            $summary["billing_status"] = "Pending";
                        }
                    }
                }

                $processed[] = $queueCode;
                $processedSummaries[] = $summary;
            }

            $this->conn->commit();
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);
            return ["message" => $e->getMessage()];
        }

        $notificationResult = $this->dispatchNotificationsForAction(
            $user_id,
            $actionMap[$action]["label"],
            $actionMap[$action]["event_code"],
            $processedSummaries
        );

        return [
            "message" => "Success",
            "action" => $action,
            "processed_count" => count($processed),
            "processed" => $processed,
            "skipped" => $skipped,
            "notifications" => $notificationResult,
        ];
    }

    private function normalizeQueueCodes(array $data): array
    {
        $raw = [];

        if (!empty($data["queue_code"])) {
            $raw[] = (string) $data["queue_code"];
        }

        if (!empty($data["queue_codes"]) && is_array($data["queue_codes"])) {
            foreach ($data["queue_codes"] as $item) {
                $raw[] = (string) $item;
            }
        }

        $normalized = [];
        foreach ($raw as $item) {
            $next = trim($item);
            if ($next === "" || isset($normalized[$next])) {
                continue;
            }
            $normalized[$next] = true;
        }

        return array_keys($normalized);
    }

    private function getUserRoleSet(string $user_id): array
    {
        $sql = "SELECT rolename
                FROM tbl_user_roles
                WHERE userid = :userid
                  AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":userid", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        $roleSet = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $roleName = strtoupper(trim((string) ($row["rolename"] ?? "")));
            if ($roleName !== "") {
                $roleSet[$roleName] = true;
            }
        }

        return $roleSet;
    }

    private function getQueueSummaryMap(array $queueCodes): array
    {
        if (empty($queueCodes)) {
            return [];
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $queueCode) {
            $placeholders[] = ":queue_" . $index;
        }

        $sql = "SELECT
                    pqs.prd_queue_code,
                    pqs.orderedby,
                    pqs.payee,
                    pqs.pr_status,
                    pqs.po_status,
                    pqs.production_status,
                    pqs.billing_status,
                    pqs.delivery_status,
                    pqs.createdtime,
                    obu.name AS orderedby_name,
                    obu.class AS orderedby_class,
                    pbu.name AS payee_name,
                    pbu.class AS payee_class,
                    supplier.supplier_name
                FROM tbl_products_queue_summary AS pqs
                LEFT JOIN lkp_busunits AS obu
                    ON pqs.orderedby = obu.busunitcode
                LEFT JOIN lkp_busunits AS pbu
                    ON pqs.payee = pbu.busunitcode
                LEFT JOIN lkp_supplier AS supplier
                    ON pqs.payee = supplier.supplier_code
                WHERE pqs.prd_queue_code IN (" . implode(", ", $placeholders) . ")";

        $stmt = $this->conn->prepare($sql);
        foreach ($queueCodes as $index => $queueCode) {
            $stmt->bindValue(":queue_" . $index, $queueCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $map[(string) $row["prd_queue_code"]] = $row;
        }

        return $map;
    }

    private function approvePr(string $user_id, string $queueCode): void
    {
        $sql = "UPDATE tbl_products_queue_summary
                SET
                    pr_status = 'Approved',
                    pr_approved_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    po_created_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    pr_approved_by = :user_tracker
                WHERE prd_queue_code = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $queueCode, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function approvePo(string $user_id, string $queueCode, array $summary): void
    {
        $orderedBy = (string) ($summary["orderedby"] ?? "");
        $payee = (string) ($summary["payee"] ?? "");
        $orderedByClass = strtoupper(trim((string) ($summary["orderedby_class"] ?? "")));
        $payeeClass = strtoupper(trim((string) ($summary["payee_class"] ?? "")));

        if (str_starts_with($orderedBy, "BU-") && str_starts_with($payee, "SP-")) {
            $sql = "UPDATE tbl_products_queue_summary
                    SET
                        production_status = 'Skipped',
                        billing_status = 'Skipped'
                    WHERE prd_queue_code = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":id", $queueCode, PDO::PARAM_STR);
            $stmt->execute();
        }

        if ($orderedByClass === "COMMI" && $payeeClass === "COMMI") {
            if ($orderedBy === $payee) {
                $sql = "UPDATE tbl_products_queue_summary
                        SET
                            production_status = 'Pending',
                            billing_status = 'Skipped'
                        WHERE prd_queue_code = :id";
            } else {
                $sql = "UPDATE tbl_products_queue_summary
                        SET
                            production_status = 'Pending',
                            delivery_status = 'Pending',
                            billing_status = 'Pending'
                        WHERE prd_queue_code = :id";
            }

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":id", $queueCode, PDO::PARAM_STR);
            $stmt->execute();
        }

        $sql = "UPDATE tbl_products_queue_summary
                SET
                    po_status = 'Approved',
                    po_approved_date = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
                    po_approved_by = :user_tracker
                WHERE prd_queue_code = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $queueCode, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function dispatchNotificationsForAction(
        string $user_id,
        string $actionLabel,
        string $eventCode,
        array $summaries
    ): array {
        $result = [
            "queued" => 0,
            "sent" => 0,
            "failed" => 0,
            "skipped" => 0,
        ];

        if (empty($summaries)) {
            return $result;
        }

        $queueTableExists = $this->tableExists("tbl_ims_notification_queue");
        $logTableExists = $this->tableExists("tbl_ims_notification_log");
        $emailController = class_exists("EmailSendController") ? new EmailSendController() : null;

        foreach ($summaries as $summary) {
            $entries = $this->buildNotificationEntries($summary, $actionLabel, $eventCode);

            foreach ($entries as $entry) {
                $queueSeq = null;

                if ($queueTableExists) {
                    $queueSeq = $this->insertNotificationQueueRow($user_id, $entry);
                    $result["queued"]++;
                }

                if ($emailController === null) {
                    $result["skipped"]++;
                    continue;
                }

                try {
                    $emailController->sendEmail(
                        "mail.exinnovph.com",
                        "admin@exinnovph.com",
                        "ExinnovEmail@2025",
                        "admin@exinnovph.com",
                        $entry["recipient_email"],
                        $entry["subject"],
                        $entry["body"],
                        true
                    );

                    $result["sent"]++;

                    if ($queueTableExists && $queueSeq !== null) {
                        $this->updateNotificationQueueStatus($queueSeq, "Sent", null);
                    }

                    if ($logTableExists) {
                        $this->insertNotificationLogRow($user_id, $queueSeq, $entry, "Sent", null);
                    }
                } catch (Throwable $e) {
                    $result["failed"]++;

                    if ($queueTableExists && $queueSeq !== null) {
                        $this->updateNotificationQueueStatus($queueSeq, "Failed", $e->getMessage());
                    }

                    if ($logTableExists) {
                        $this->insertNotificationLogRow($user_id, $queueSeq, $entry, "Failed", $e->getMessage());
                    }
                }
            }
        }

        return $result;
    }

    private function buildNotificationEntries(array $summary, string $actionLabel, string $eventCode): array
    {
        $queueCode = (string) ($summary["prd_queue_code"] ?? "");
        $orderedBy = (string) ($summary["orderedby"] ?? "");
        $payee = (string) ($summary["payee"] ?? "");
        $orderedByName = trim((string) ($summary["orderedby_name"] ?? "")) !== ""
            ? (string) $summary["orderedby_name"]
            : $orderedBy;
        $payeeName = trim((string) ($summary["supplier_name"] ?? "")) !== ""
            ? (string) $summary["supplier_name"]
            : (trim((string) ($summary["payee_name"] ?? "")) !== "" ? (string) $summary["payee_name"] : $payee);

        $subject = $actionLabel . ": " . $queueCode;
        $body = $this->buildEmailBody($queueCode, $actionLabel, $orderedByName, $payeeName, $summary);

        $recipientMap = [];
        foreach ($this->resolveRecipientsForQueue($summary) as $recipient) {
            $email = trim((string) ($recipient["recipient_email"] ?? ""));
            if ($email === "" || isset($recipientMap[strtolower($email)])) {
                continue;
            }

            $recipientMap[strtolower($email)] = [
                "reference_type" => "Queue",
                "reference_code" => $queueCode,
                "event_code" => $eventCode,
                "sender_source" => "InventoryOperationsStudio",
                "recipient_type" => (string) ($recipient["recipient_type"] ?? "User"),
                "recipient_name" => (string) ($recipient["recipient_name"] ?? ""),
                "recipient_email" => $email,
                "subject" => $subject,
                "body" => $body,
                "payload_json" => json_encode([
                    "prd_queue_code" => $queueCode,
                    "orderedby" => $orderedBy,
                    "orderedby_name" => $orderedByName,
                    "payee" => $payee,
                    "payee_name" => $payeeName,
                    "action" => $actionLabel,
                ]),
            ];
        }

        return array_values($recipientMap);
    }

    private function resolveRecipientsForQueue(array $summary): array
    {
        $recipients = [];
        $orderedBy = trim((string) ($summary["orderedby"] ?? ""));
        $payee = trim((string) ($summary["payee"] ?? ""));

        if ($orderedBy !== "") {
            $recipients = array_merge(
                $recipients,
                $this->resolveBusunitRecipients(
                    $orderedBy,
                    trim((string) ($summary["orderedby_name"] ?? "")) !== ""
                        ? (string) $summary["orderedby_name"]
                        : $orderedBy
                )
            );
        }

        if ($payee !== "") {
            if (str_starts_with($payee, "BU-")) {
                $recipients = array_merge(
                    $recipients,
                    $this->resolveBusunitRecipients(
                        $payee,
                        trim((string) ($summary["payee_name"] ?? "")) !== ""
                            ? (string) $summary["payee_name"]
                            : $payee
                    )
                );
            }

            if (str_starts_with($payee, "SP-")) {
                $recipients = array_merge(
                    $recipients,
                    $this->resolveSupplierRecipients(
                        $payee,
                        trim((string) ($summary["supplier_name"] ?? "")) !== ""
                            ? (string) $summary["supplier_name"]
                            : $payee
                    )
                );
            }
        }

        return $recipients;
    }

    private function resolveBusunitRecipients(string $busunitCode, string $defaultName): array
    {
        $recipients = [];
        $seen = [];

        $directEmail = $this->findOptionalEmailByCode(
            "lkp_busunits",
            "busunitcode",
            $busunitCode,
            ["email", "busunit_email", "contact_email", "contactemail"]
        );

        if ($directEmail !== null) {
            $seen[strtolower($directEmail)] = true;
            $recipients[] = [
                "recipient_type" => "BusUnit",
                "recipient_name" => $defaultName,
                "recipient_email" => $directEmail,
            ];
        }

        $sql = "SELECT DISTINCT
                    uga.email,
                    CONCAT(
                        COALESCE(uga.firstname, ''),
                        CASE WHEN COALESCE(uga.lastname, '') <> '' THEN ' ' ELSE '' END,
                        COALESCE(uga.lastname, '')
                    ) AS recipient_name
                FROM tbl_user_roles AS ur
                INNER JOIN tbl_users_global_assignment AS uga
                    ON ur.userid = uga.uuid
                WHERE ur.rolename = :rolename
                  AND ur.deletestatus = 'Active'
                  AND uga.deletestatus = 'Active'
                  AND uga.status = 'Active'
                  AND uga.email IS NOT NULL
                  AND uga.email <> ''";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":rolename", $busunitCode, PDO::PARAM_STR);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $email = trim((string) ($row["email"] ?? ""));
            if ($email === "" || isset($seen[strtolower($email)])) {
                continue;
            }

            $seen[strtolower($email)] = true;
            $recipients[] = [
                "recipient_type" => "BusUnitUser",
                "recipient_name" => trim((string) ($row["recipient_name"] ?? "")) ?: $defaultName,
                "recipient_email" => $email,
            ];
        }

        return $recipients;
    }

    private function resolveSupplierRecipients(string $supplierCode, string $defaultName): array
    {
        $email = $this->findOptionalEmailByCode(
            "lkp_supplier",
            "supplier_code",
            $supplierCode,
            ["email", "supplier_email", "contact_email", "contactemail"]
        );

        if ($email === null) {
            return [];
        }

        return [[
            "recipient_type" => "Supplier",
            "recipient_name" => $defaultName,
            "recipient_email" => $email,
        ]];
    }

    private function findOptionalEmailByCode(
        string $tableName,
        string $codeColumn,
        string $codeValue,
        array $candidateColumns
    ): ?string {
        foreach ($candidateColumns as $columnName) {
            if (!$this->tableColumnExists($tableName, $columnName)) {
                continue;
            }

            $sql = "SELECT " . $columnName . " AS email_value
                    FROM " . $tableName . "
                    WHERE " . $codeColumn . " = :code
                    LIMIT 1";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":code", $codeValue, PDO::PARAM_STR);
            $stmt->execute();
            $value = trim((string) ($stmt->fetchColumn() ?: ""));

            if ($value !== "") {
                return $value;
            }
        }

        return null;
    }

    private function tableExists(string $tableName): bool
    {
        $sql = "SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name = :table_name";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":table_name", $tableName, PDO::PARAM_STR);
        $stmt->execute();

        return (int) $stmt->fetchColumn() > 0;
    }

    private function tableColumnExists(string $tableName, string $columnName): bool
    {
        $sql = "SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = :table_name
                  AND column_name = :column_name";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":table_name", $tableName, PDO::PARAM_STR);
        $stmt->bindValue(":column_name", $columnName, PDO::PARAM_STR);
        $stmt->execute();

        return (int) $stmt->fetchColumn() > 0;
    }

    private function insertNotificationQueueRow(string $user_id, array $entry): ?int
    {
        $sql = "INSERT INTO tbl_ims_notification_queue
                (
                    reference_type,
                    reference_code,
                    event_code,
                    sender_source,
                    recipient_type,
                    recipient_name,
                    recipient_email,
                    subject,
                    payload_json,
                    queue_status,
                    priority_level,
                    retry_count,
                    last_attempt_at,
                    sent_at,
                    last_error,
                    deletestatus,
                    usertracker,
                    createdtime
                )
                VALUES
                (
                    :reference_type,
                    :reference_code,
                    :event_code,
                    :sender_source,
                    :recipient_type,
                    :recipient_name,
                    :recipient_email,
                    :subject,
                    :payload_json,
                    'Queued',
                    2,
                    0,
                    NULL,
                    NULL,
                    NULL,
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":reference_type", $entry["reference_type"], PDO::PARAM_STR);
        $stmt->bindValue(":reference_code", $entry["reference_code"], PDO::PARAM_STR);
        $stmt->bindValue(":event_code", $entry["event_code"], PDO::PARAM_STR);
        $stmt->bindValue(":sender_source", $entry["sender_source"], PDO::PARAM_STR);
        $stmt->bindValue(":recipient_type", $entry["recipient_type"], PDO::PARAM_STR);
        $stmt->bindValue(":recipient_name", $entry["recipient_name"], PDO::PARAM_STR);
        $stmt->bindValue(":recipient_email", $entry["recipient_email"], PDO::PARAM_STR);
        $stmt->bindValue(":subject", $entry["subject"], PDO::PARAM_STR);
        $stmt->bindValue(":payload_json", $entry["payload_json"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        return (int) $this->conn->lastInsertId();
    }

    private function updateNotificationQueueStatus(int $queueSeq, string $status, ?string $errorMessage): void
    {
        $sql = "UPDATE tbl_ims_notification_queue
                SET
                    queue_status = :queue_status,
                    last_attempt_at = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    sent_at = CASE WHEN :sent_status = 'Sent' THEN DATE_ADD(NOW(), INTERVAL 8 HOUR) ELSE sent_at END,
                    last_error = :last_error
                WHERE seq = :seq";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":queue_status", $status, PDO::PARAM_STR);
        $stmt->bindValue(":sent_status", $status, PDO::PARAM_STR);
        if ($errorMessage === null || trim($errorMessage) === "") {
            $stmt->bindValue(":last_error", null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(":last_error", $errorMessage, PDO::PARAM_STR);
        }
        $stmt->bindValue(":seq", $queueSeq, PDO::PARAM_INT);
        $stmt->execute();
    }

    private function insertNotificationLogRow(
        string $user_id,
        ?int $queueSeq,
        array $entry,
        string $deliveryStatus,
        ?string $errorMessage
    ): void {
        $sql = "INSERT INTO tbl_ims_notification_log
                (
                    queue_seq,
                    reference_type,
                    reference_code,
                    event_code,
                    recipient_email,
                    subject,
                    delivery_status,
                    provider_name,
                    provider_message_id,
                    error_message,
                    sent_at,
                    deletestatus,
                    usertracker,
                    createdtime
                )
                VALUES
                (
                    :queue_seq,
                    :reference_type,
                    :reference_code,
                    :event_code,
                    :recipient_email,
                    :subject,
                    :delivery_status,
                    'PHPMailer',
                    NULL,
                    :error_message,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);
        if ($queueSeq === null) {
            $stmt->bindValue(":queue_seq", null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(":queue_seq", $queueSeq, PDO::PARAM_INT);
        }
        $stmt->bindValue(":reference_type", $entry["reference_type"], PDO::PARAM_STR);
        $stmt->bindValue(":reference_code", $entry["reference_code"], PDO::PARAM_STR);
        $stmt->bindValue(":event_code", $entry["event_code"], PDO::PARAM_STR);
        $stmt->bindValue(":recipient_email", $entry["recipient_email"], PDO::PARAM_STR);
        $stmt->bindValue(":subject", $entry["subject"], PDO::PARAM_STR);
        $stmt->bindValue(":delivery_status", $deliveryStatus, PDO::PARAM_STR);
        if ($errorMessage === null || trim($errorMessage) === "") {
            $stmt->bindValue(":error_message", null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(":error_message", $errorMessage, PDO::PARAM_STR);
        }
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function buildEmailBody(
        string $queueCode,
        string $actionLabel,
        string $orderedByName,
        string $payeeName,
        array $summary
    ): string {
        $flowType = $this->describeFlowType($summary);

        return "
            <html>
                <body style='font-family: Arial, sans-serif; color: #0f172a;'>
                    <div style='max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;'>
                        <div style='padding: 18px 22px; background: linear-gradient(90deg, #f97316, #dc2626); color: #ffffff;'>
                            <div style='font-size: 20px; font-weight: 700;'>Inventory Operations Update</div>
                            <div style='font-size: 13px; opacity: 0.95; margin-top: 4px;'>" . htmlspecialchars($actionLabel) . "</div>
                        </div>
                        <div style='padding: 22px; background: #ffffff;'>
                            <p style='margin-top: 0;'>Reference <strong>" . htmlspecialchars($queueCode) . "</strong> has been updated.</p>
                            <table style='width: 100%; border-collapse: collapse; margin-top: 14px;'>
                                <tr>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0; background: #fff7ed; width: 180px;'>Requester</td>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0;'>" . htmlspecialchars($orderedByName) . "</td>
                                </tr>
                                <tr>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0; background: #fff7ed;'>Counterparty</td>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0;'>" . htmlspecialchars($payeeName) . "</td>
                                </tr>
                                <tr>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0; background: #fff7ed;'>Flow</td>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0;'>" . htmlspecialchars($flowType) . "</td>
                                </tr>
                                <tr>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0; background: #fff7ed;'>PR Status</td>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0;'>" . htmlspecialchars((string) ($summary["pr_status"] ?? "")) . "</td>
                                </tr>
                                <tr>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0; background: #fff7ed;'>PO Status</td>
                                    <td style='padding: 10px; border: 1px solid #e2e8f0;'>" . htmlspecialchars((string) ($summary["po_status"] ?? "")) . "</td>
                                </tr>
                            </table>
                            <p style='margin-bottom: 0; margin-top: 16px;'>Please review the updated transaction inside the Inventory Operations module.</p>
                        </div>
                    </div>
                </body>
            </html>";
    }

    private function describeFlowType(array $summary): string
    {
        $orderedByClass = strtoupper(trim((string) ($summary["orderedby_class"] ?? "")));
        $payeeClass = strtoupper(trim((string) ($summary["payee_class"] ?? "")));
        $payee = (string) ($summary["payee"] ?? "");

        if (str_starts_with($payee, "SP-") && $orderedByClass === "COMMI") {
            return "Commissary to Supplier";
        }
        if (str_starts_with($payee, "SP-") && $orderedByClass === "STORE") {
            return "Store to Supplier";
        }
        if ($orderedByClass === "STORE" && $payeeClass === "COMMI") {
            return "Store to Commissary";
        }
        if ($orderedByClass === "STORE" && $payeeClass === "STORE") {
            return "Store to Store";
        }
        if ($orderedByClass === "COMMI" && $payeeClass === "STORE") {
            return "Commissary to Store";
        }

        return "Inventory Flow";
    }
}
