<?php

class IMSNotificationQueueGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getSummary(array $filters): array
    {
        $queueRows = $this->getQueueRows(array_merge($filters, ["limit" => $filters["limit"] ?? 8]));
        $logRows = $this->getLogRows(array_merge($filters, ["limit" => $filters["limit"] ?? 8]));

        $queueCounts = $this->getGroupedCounts(
            "tbl_ims_notification_queue",
            "queue_status",
            $this->buildQueueFilters($filters)
        );

        $logCounts = $this->getGroupedCounts(
            "tbl_ims_notification_log",
            "delivery_status",
            $this->buildLogFilters($filters)
        );

        $queuedCount = 0;
        $failedCount = 0;
        foreach ($queueCounts["items"] as $row) {
            if (($row["group_value"] ?? "") === "Queued") {
                $queuedCount = (int) $row["group_count"];
            }
            if (($row["group_value"] ?? "") === "Failed") {
                $failedCount = (int) $row["group_count"];
            }
        }

        $sentCount = 0;
        foreach ($logCounts["items"] as $row) {
            if (($row["group_value"] ?? "") === "Sent") {
                $sentCount = (int) $row["group_count"];
            }
        }

        return [
            "queue_status_counts" => $queueCounts["items"],
            "delivery_status_counts" => $logCounts["items"],
            "recent_queue" => $queueRows,
            "recent_log" => $logRows,
            "totals" => [
                "queued" => $queuedCount,
                "failed" => $failedCount,
                "sent" => $sentCount,
                "recent_queue_count" => count($queueRows),
                "recent_log_count" => count($logRows),
            ],
        ];
    }

    public function getQueueRows(array $filters): array
    {
        $built = $this->buildQueueFilters($filters);
        $limit = $this->normalizeLimit($filters["limit"] ?? 12);

        $sql = "SELECT *
                FROM tbl_ims_notification_queue
                WHERE " . implode(" AND ", $built["where"]) . "
                ORDER BY createdtime DESC, seq DESC
                LIMIT " . $limit;

        $stmt = $this->conn->prepare($sql);
        foreach ($built["params"] as $name => $value) {
            $stmt->bindValue($name, $value, PDO::PARAM_STR);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getLogRows(array $filters): array
    {
        $built = $this->buildLogFilters($filters);
        $limit = $this->normalizeLimit($filters["limit"] ?? 12);

        $sql = "SELECT *
                FROM tbl_ims_notification_log
                WHERE " . implode(" AND ", $built["where"]) . "
                ORDER BY createdtime DESC, seq DESC
                LIMIT " . $limit;

        $stmt = $this->conn->prepare($sql);
        foreach ($built["params"] as $name => $value) {
            $stmt->bindValue($name, $value, PDO::PARAM_STR);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function enqueueForUser($user_id, array $data): array
    {
        $items = $this->normalizeItems($data);
        $inserted = 0;

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
                    :queue_status,
                    :priority_level,
                    :retry_count,
                    :last_attempt_at,
                    :sent_at,
                    :last_error,
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);

        try {
            $this->conn->beginTransaction();

            foreach ($items as $item) {
                $normalized = $this->normalizeQueueItem($item);

                $stmt->bindValue(":reference_type", $normalized["reference_type"], PDO::PARAM_STR);
                $stmt->bindValue(":reference_code", $normalized["reference_code"], PDO::PARAM_STR);
                $stmt->bindValue(":event_code", $normalized["event_code"], PDO::PARAM_STR);
                $stmt->bindValue(":sender_source", $normalized["sender_source"], PDO::PARAM_STR);
                $stmt->bindValue(":recipient_type", $normalized["recipient_type"], PDO::PARAM_STR);
                $this->bindNullableString($stmt, ":recipient_name", $normalized["recipient_name"]);
                $stmt->bindValue(":recipient_email", $normalized["recipient_email"], PDO::PARAM_STR);
                $stmt->bindValue(":subject", $normalized["subject"], PDO::PARAM_STR);
                $stmt->bindValue(":payload_json", $normalized["payload_json"], PDO::PARAM_STR);
                $stmt->bindValue(":queue_status", $normalized["queue_status"], PDO::PARAM_STR);
                $stmt->bindValue(":priority_level", $normalized["priority_level"], PDO::PARAM_INT);
                $stmt->bindValue(":retry_count", $normalized["retry_count"], PDO::PARAM_INT);
                $this->bindNullableString($stmt, ":last_attempt_at", $normalized["last_attempt_at"]);
                $this->bindNullableString($stmt, ":sent_at", $normalized["sent_at"]);
                $this->bindNullableString($stmt, ":last_error", $normalized["last_error"]);
                $stmt->bindValue(":usertracker", (string) $user_id, PDO::PARAM_STR);
                $stmt->execute();
                $inserted++;
            }

            $this->conn->commit();

            return ["message" => "Success", "inserted" => $inserted];
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);
            return ["message" => $e->getMessage()];
        }
    }

    public function markQueueStatusForUser($user_id, array $data): array
    {
        if (!array_key_exists("seq", $data) || !array_key_exists("queue_status", $data)) {
            http_response_code(422);
            return ["message" => "seqAndQueueStatusRequired"];
        }

        $fields = [
            "queue_status" => [$data["queue_status"], PDO::PARAM_STR],
            "usertracker" => [(string) $user_id, PDO::PARAM_STR],
        ];

        if (array_key_exists("retry_count", $data)) {
            $fields["retry_count"] = [(int) $data["retry_count"], PDO::PARAM_INT];
        }
        if (array_key_exists("last_attempt_at", $data)) {
            $fields["last_attempt_at"] = [(string) $data["last_attempt_at"], PDO::PARAM_STR];
        }
        if (array_key_exists("sent_at", $data)) {
            $fields["sent_at"] = [(string) $data["sent_at"], PDO::PARAM_STR];
        }
        if (array_key_exists("last_error", $data)) {
            $fields["last_error"] = [(string) $data["last_error"], PDO::PARAM_STR];
        }

        $sets = [];
        foreach (array_keys($fields) as $name) {
            $sets[] = $name . " = :" . $name;
        }

        $sql = "UPDATE tbl_ims_notification_queue
                SET " . implode(", ", $sets) . "
                WHERE seq = :seq";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":seq", (int) $data["seq"], PDO::PARAM_INT);
        foreach ($fields as $name => $values) {
            if ($values[1] === PDO::PARAM_STR && $values[0] === "") {
                $stmt->bindValue(":" . $name, null, PDO::PARAM_NULL);
                continue;
            }
            $stmt->bindValue(":" . $name, $values[0], $values[1]);
        }
        $stmt->execute();

        return ["message" => "Success", "rows" => $stmt->rowCount()];
    }

    public function createLogForUser($user_id, array $data): array
    {
        $items = $this->normalizeItems($data);
        $inserted = 0;

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
                    :provider_name,
                    :provider_message_id,
                    :error_message,
                    :sent_at,
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);

        try {
            $this->conn->beginTransaction();

            foreach ($items as $item) {
                $normalized = $this->normalizeLogItem($item);

                $this->bindNullableInt($stmt, ":queue_seq", $normalized["queue_seq"]);
                $stmt->bindValue(":reference_type", $normalized["reference_type"], PDO::PARAM_STR);
                $stmt->bindValue(":reference_code", $normalized["reference_code"], PDO::PARAM_STR);
                $stmt->bindValue(":event_code", $normalized["event_code"], PDO::PARAM_STR);
                $stmt->bindValue(":recipient_email", $normalized["recipient_email"], PDO::PARAM_STR);
                $stmt->bindValue(":subject", $normalized["subject"], PDO::PARAM_STR);
                $stmt->bindValue(":delivery_status", $normalized["delivery_status"], PDO::PARAM_STR);
                $this->bindNullableString($stmt, ":provider_name", $normalized["provider_name"]);
                $this->bindNullableString($stmt, ":provider_message_id", $normalized["provider_message_id"]);
                $this->bindNullableString($stmt, ":error_message", $normalized["error_message"]);
                $this->bindNullableString($stmt, ":sent_at", $normalized["sent_at"]);
                $stmt->bindValue(":usertracker", (string) $user_id, PDO::PARAM_STR);
                $stmt->execute();
                $inserted++;
            }

            $this->conn->commit();

            return ["message" => "Success", "inserted" => $inserted];
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);
            return ["message" => $e->getMessage()];
        }
    }

    private function getGroupedCounts(string $table, string $column, array $built): array
    {
        $sql = "SELECT " . $column . " AS group_value, COUNT(*) AS group_count
                FROM " . $table . "
                WHERE " . implode(" AND ", $built["where"]) . "
                GROUP BY " . $column . "
                ORDER BY group_count DESC, group_value ASC";

        $stmt = $this->conn->prepare($sql);
        foreach ($built["params"] as $name => $value) {
            $stmt->bindValue($name, $value, PDO::PARAM_STR);
        }
        $stmt->execute();

        return ["items" => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    private function buildQueueFilters(array $filters): array
    {
        $where = ["deletestatus = 'Active'"];
        $params = [];

        if (!empty($filters["reference_type"])) {
            $where[] = "reference_type = :reference_type";
            $params[":reference_type"] = (string) $filters["reference_type"];
        }
        if (!empty($filters["reference_code"])) {
            $where[] = "reference_code = :reference_code";
            $params[":reference_code"] = (string) $filters["reference_code"];
        }
        if (!empty($filters["recipient_email"])) {
            $where[] = "recipient_email = :recipient_email";
            $params[":recipient_email"] = (string) $filters["recipient_email"];
        }
        if (!empty($filters["queue_status"])) {
            $where[] = "queue_status = :queue_status";
            $params[":queue_status"] = (string) $filters["queue_status"];
        }
        if (!empty($filters["event_code"])) {
            $where[] = "event_code = :event_code";
            $params[":event_code"] = (string) $filters["event_code"];
        }

        return ["where" => $where, "params" => $params];
    }

    private function buildLogFilters(array $filters): array
    {
        $where = ["deletestatus = 'Active'"];
        $params = [];

        if (!empty($filters["reference_type"])) {
            $where[] = "reference_type = :reference_type";
            $params[":reference_type"] = (string) $filters["reference_type"];
        }
        if (!empty($filters["reference_code"])) {
            $where[] = "reference_code = :reference_code";
            $params[":reference_code"] = (string) $filters["reference_code"];
        }
        if (!empty($filters["recipient_email"])) {
            $where[] = "recipient_email = :recipient_email";
            $params[":recipient_email"] = (string) $filters["recipient_email"];
        }
        if (!empty($filters["delivery_status"])) {
            $where[] = "delivery_status = :delivery_status";
            $params[":delivery_status"] = (string) $filters["delivery_status"];
        }
        if (!empty($filters["event_code"])) {
            $where[] = "event_code = :event_code";
            $params[":event_code"] = (string) $filters["event_code"];
        }

        return ["where" => $where, "params" => $params];
    }

    private function normalizeItems(array $data): array
    {
        if (array_key_exists("items", $data) && is_array($data["items"])) {
            return $data["items"];
        }

        return [$data];
    }

    private function normalizeQueueItem(array $item): array
    {
        $referenceType = trim((string) ($item["reference_type"] ?? ""));
        $referenceCode = trim((string) ($item["reference_code"] ?? ""));
        $eventCode = trim((string) ($item["event_code"] ?? ""));
        $recipientType = trim((string) ($item["recipient_type"] ?? ""));
        $recipientEmail = trim((string) ($item["recipient_email"] ?? ""));
        $subject = trim((string) ($item["subject"] ?? ""));

        if (
            $referenceType === "" ||
            $referenceCode === "" ||
            $eventCode === "" ||
            $recipientType === "" ||
            $recipientEmail === "" ||
            $subject === ""
        ) {
            throw new InvalidArgumentException("reference/event/recipient/subjectRequired");
        }

        $payload = $item["payload_json"] ?? $item["payload"] ?? null;
        if (is_array($payload)) {
            $payload = json_encode($payload, JSON_UNESCAPED_UNICODE);
        }

        return [
            "reference_type" => $referenceType,
            "reference_code" => $referenceCode,
            "event_code" => $eventCode,
            "sender_source" => trim((string) ($item["sender_source"] ?? "SYSTEM")),
            "recipient_type" => $recipientType,
            "recipient_name" => trim((string) ($item["recipient_name"] ?? "")),
            "recipient_email" => $recipientEmail,
            "subject" => $subject,
            "payload_json" => (string) ($payload ?? ""),
            "queue_status" => trim((string) ($item["queue_status"] ?? "Queued")),
            "priority_level" => max(1, min(9, (int) ($item["priority_level"] ?? 3))),
            "retry_count" => max(0, (int) ($item["retry_count"] ?? 0)),
            "last_attempt_at" => trim((string) ($item["last_attempt_at"] ?? "")),
            "sent_at" => trim((string) ($item["sent_at"] ?? "")),
            "last_error" => trim((string) ($item["last_error"] ?? "")),
        ];
    }

    private function normalizeLogItem(array $item): array
    {
        $referenceType = trim((string) ($item["reference_type"] ?? ""));
        $referenceCode = trim((string) ($item["reference_code"] ?? ""));
        $eventCode = trim((string) ($item["event_code"] ?? ""));
        $recipientEmail = trim((string) ($item["recipient_email"] ?? ""));
        $subject = trim((string) ($item["subject"] ?? ""));

        if ($referenceType === "" || $referenceCode === "" || $eventCode === "" || $recipientEmail === "" || $subject === "") {
            throw new InvalidArgumentException("reference/event/recipient/subjectRequired");
        }

        return [
            "queue_seq" => (int) ($item["queue_seq"] ?? 0),
            "reference_type" => $referenceType,
            "reference_code" => $referenceCode,
            "event_code" => $eventCode,
            "recipient_email" => $recipientEmail,
            "subject" => $subject,
            "delivery_status" => trim((string) ($item["delivery_status"] ?? "Sent")),
            "provider_name" => trim((string) ($item["provider_name"] ?? "")),
            "provider_message_id" => trim((string) ($item["provider_message_id"] ?? "")),
            "error_message" => trim((string) ($item["error_message"] ?? "")),
            "sent_at" => trim((string) ($item["sent_at"] ?? "")),
        ];
    }

    private function normalizeLimit($limit): int
    {
        $normalized = (int) $limit;
        if ($normalized <= 0) {
            return 12;
        }

        return min($normalized, 100);
    }

    private function bindNullableString(PDOStatement $stmt, string $parameter, string $value): void
    {
        if ($value === "") {
            $stmt->bindValue($parameter, null, PDO::PARAM_NULL);
            return;
        }

        $stmt->bindValue($parameter, $value, PDO::PARAM_STR);
    }

    private function bindNullableInt(PDOStatement $stmt, string $parameter, int $value): void
    {
        if ($value <= 0) {
            $stmt->bindValue($parameter, null, PDO::PARAM_NULL);
            return;
        }

        $stmt->bindValue($parameter, $value, PDO::PARAM_INT);
    }
}
