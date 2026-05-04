<?php

class IMSDeliveryWorkbenchGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getJobs(array $data): array
    {
        $busunitCode = trim((string) ($data["busunitcode"] ?? ""));
        $this->syncDeliveryJobStatusesFromQueueSummaries(null, $busunitCode);

        $where = "j.deletestatus = 'Active'";
        if ($busunitCode !== "") {
            $where .= " AND j.busunitcode = :busunitcode";
        }

        $sql = "SELECT
                    j.seq,
                    j.job_code,
                    j.busunitcode,
                    j.target_delivery_date,
                    j.tentative_delivery_date,
                    j.actual_delivery_date,
                    j.cancelled_date,
                    j.status,
                    j.vehicle,
                    j.sender,
                    j.receiver,
                    j.notes,
                    j.queue_count,
                    j.total_qty,
                    j.createdtime,
                    COUNT(l.seq) AS line_count,
                    GROUP_CONCAT(DISTINCT l.prd_queue_code ORDER BY l.seq SEPARATOR ', ') AS order_ids
                FROM tbl_ims_delivery_job j
                LEFT JOIN tbl_ims_delivery_job_line l
                    ON j.job_code = l.job_code
                    AND l.deletestatus = 'Active'
                WHERE {$where}
                GROUP BY
                    j.seq,
                    j.job_code,
                    j.busunitcode,
                    j.target_delivery_date,
                    j.tentative_delivery_date,
                    j.actual_delivery_date,
                    j.cancelled_date,
                    j.status,
                    j.vehicle,
                    j.sender,
                    j.receiver,
                    j.notes,
                    j.queue_count,
                    j.total_qty,
                    j.createdtime
                ORDER BY j.createdtime DESC";

        $stmt = $this->conn->prepare($sql);
        if ($busunitCode !== "") {
            $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
        }
        $stmt->execute();

        return [
            "items" => $stmt->fetchAll(PDO::FETCH_ASSOC),
        ];
    }

    public function getCandidates(array $data): array
    {
        $where = [
            "pqs.deletestatus = 'Active'",
            "UPPER(TRIM(COALESCE(pqs.production_status, ''))) IN ('COMPLETED', 'SKIPPED')",
            "UPPER(TRIM(COALESCE(pqs.delivery_status, 'PENDING'))) <> 'DELIVERED'",
            "NOT EXISTS (
                SELECT 1
                FROM tbl_ims_delivery_job_line l
                INNER JOIN tbl_ims_delivery_job j
                    ON l.job_code = j.job_code
                    AND j.deletestatus = 'Active'
                WHERE l.prd_queue_code = pqs.prd_queue_code
                  AND l.deletestatus = 'Active'
                  AND LOWER(TRIM(COALESCE(j.status, ''))) <> 'cancelled'
            )",
        ];
        $params = [];

        $busunitCode = trim((string) ($data["busunitcode"] ?? ""));
        if ($busunitCode !== "") {
            $where[] = "(pqs.orderedby = :busunitcode_ordered OR pqs.payee = :busunitcode_payee)";
            $params[":busunitcode_ordered"] = $busunitCode;
            $params[":busunitcode_payee"] = $busunitCode;
        }

        $search = trim((string) ($data["search"] ?? ""));
        if ($search !== "") {
            $where[] = "(
                pqs.prd_queue_code LIKE :search
                OR ordered_by.name LIKE :search
                OR payee_bu.name LIKE :search
                OR supplier.supplier_name LIKE :search
            )";
            $params[":search"] = "%" . $search . "%";
        }

        $limit = (int) ($data["limit"] ?? 800);
        if ($limit <= 0) {
            $limit = 800;
        }
        $limit = min($limit, 2000);

        $sql = "SELECT
                    pqs.prd_queue_code,
                    pqs.subtotal,
                    pqs.orderedby,
                    pqs.payee,
                    pqs.pr_status,
                    pqs.po_status,
                    pqs.production_status,
                    pqs.delivery_status,
                    pqs.shipping_date,
                    pqs.date_delivered,
                    pqs.notes,
                    pqs.createdtime,
                    ordered_by.name AS orderedbyname,
                    COALESCE(payee_bu.name, supplier.supplier_name, pqs.payee) AS payeename,
                    COUNT(pq.seq) AS line_count,
                    COALESCE(SUM(pq.quantity), 0) AS total_quantity
                FROM tbl_products_queue_summary pqs
                LEFT JOIN tbl_products_queue pq
                    ON pqs.prd_queue_code = pq.prd_queue_code
                    AND pq.deletestatus = 'Active'
                LEFT JOIN lkp_busunits ordered_by
                    ON pqs.orderedby = ordered_by.busunitcode
                LEFT JOIN lkp_busunits payee_bu
                    ON pqs.payee = payee_bu.busunitcode
                LEFT JOIN lkp_supplier supplier
                    ON pqs.payee = supplier.supplier_code
                WHERE " . implode(" AND ", $where) . "
                GROUP BY
                    pqs.seq,
                    pqs.prd_queue_code,
                    pqs.subtotal,
                    pqs.orderedby,
                    pqs.payee,
                    pqs.pr_status,
                    pqs.po_status,
                    pqs.production_status,
                    pqs.delivery_status,
                    pqs.shipping_date,
                    pqs.date_delivered,
                    pqs.notes,
                    pqs.createdtime,
                    ordered_by.name,
                    payee_bu.name,
                    supplier.supplier_name
                ORDER BY pqs.createdtime DESC, pqs.prd_queue_code DESC
                LIMIT " . $limit;

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $name => $value) {
            $stmt->bindValue($name, $value, PDO::PARAM_STR);
        }
        $stmt->execute();

        return [
            "items" => $stmt->fetchAll(PDO::FETCH_ASSOC),
        ];
    }

    public function getJobDetail(array $data): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        if ($jobCode === "") {
            return [
                "job" => null,
                "lines" => [],
            ];
        }

        $this->syncDeliveryJobStatusesFromQueueSummaries($jobCode);

        $jobSql = "SELECT
                        j.seq,
                        j.job_code,
                        j.busunitcode,
                        j.target_delivery_date,
                        j.tentative_delivery_date,
                        j.actual_delivery_date,
                        j.cancelled_date,
                        j.status,
                        j.vehicle,
                        j.sender,
                        j.receiver,
                        j.notes,
                        j.queue_count,
                        j.total_qty,
                        j.createdtime
                    FROM tbl_ims_delivery_job j
                    WHERE j.job_code = :job_code
                      AND j.deletestatus = 'Active'
                    LIMIT 1";

        $stmt = $this->conn->prepare($jobSql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->execute();
        $job = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($job === false) {
            return [
                "job" => null,
                "lines" => [],
            ];
        }

        $lineSql = "SELECT
                        l.seq,
                        l.job_code,
                        l.prd_queue_code,
                        l.orderedby,
                        l.payee,
                        l.total_quantity,
                        l.status,
                        l.target_delivery_date,
                        l.actual_delivery_date,
                        l.cancelled_date,
                        l.notes,
                        l.createdtime,
                        pqs.pr_status,
                        pqs.po_status,
                        pqs.production_status,
                        pqs.delivery_status,
                        pqs.shipping_date,
                        pqs.date_delivered,
                        ordered_by.name AS orderedbyname,
                        payee_bu.name AS payeebu_name,
                        supplier.supplier_name
                    FROM tbl_ims_delivery_job_line l
                    LEFT JOIN tbl_products_queue_summary pqs
                        ON l.prd_queue_code = pqs.prd_queue_code
                    LEFT JOIN lkp_busunits ordered_by
                        ON l.orderedby = ordered_by.busunitcode
                    LEFT JOIN lkp_busunits payee_bu
                        ON l.payee = payee_bu.busunitcode
                    LEFT JOIN lkp_supplier supplier
                        ON l.payee = supplier.supplier_code
                    WHERE l.job_code = :job_code
                      AND l.deletestatus = 'Active'
                    ORDER BY l.seq ASC";

        $lineStmt = $this->conn->prepare($lineSql);
        $lineStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $lineStmt->execute();
        $lineRows = $lineStmt->fetchAll(PDO::FETCH_ASSOC);

        $queueCodes = [];
        foreach ($lineRows as $lineRow) {
            $queueCode = trim((string) ($lineRow["prd_queue_code"] ?? ""));
            if ($queueCode === "") {
                continue;
            }
            $queueCodes[$queueCode] = true;
        }

        $productRows = [];
        if (!empty($queueCodes)) {
            $placeholders = [];
            $codeParams = array_keys($queueCodes);
            foreach ($codeParams as $index => $codeValue) {
                $placeholder = ":queue_code_" . $index;
                $placeholders[] = $placeholder;
            }

            $productSql = "SELECT
                                pq.seq,
                                pq.prd_queue_code,
                                pq.inv_code,
                                pq.cost_per_uom,
                                pq.uomval,
                                pq.uom,
                                pq.quantity,
                                pq.quantity AS ordered_qty,
                                COALESCE(delivered_map.delivered_qty, 0) AS delivered_qty,
                                GREATEST(pq.quantity - COALESCE(delivered_map.delivered_qty, 0), 0) AS remaining_qty,
                                pq.total,
                                pq.transdate,
                                pq.orderedby,
                                pq.payee,
                                COALESCE(bp.`desc`, rm.`desc`, pq.inv_code) AS item_name,
                                COALESCE(bp.category, rm.category, 'Uncategorized') AS category,
                                COALESCE(bp.productcode, rm.productcode, pq.inv_code) AS productcode,
                                COALESCE(bp.expiry_days, rm.expiry_days, 0) AS expiry_days
                            FROM tbl_products_queue pq
                            LEFT JOIN lkp_build_of_products bp
                                ON pq.inv_code = bp.build_code
                            LEFT JOIN lkp_raw_mats rm
                                ON pq.inv_code = rm.mat_code
                            LEFT JOIN (
                                SELECT
                                    pr_queue_code,
                                    inv_code,
                                    busunitcode,
                                    SUM(qty) AS delivered_qty
                                FROM tbl_inventory_transactions
                                WHERE deletestatus = 'Active'
                                GROUP BY pr_queue_code, inv_code, busunitcode
                            ) delivered_map
                                ON pq.prd_queue_code = delivered_map.pr_queue_code
                                AND pq.inv_code = delivered_map.inv_code
                                AND pq.orderedby = delivered_map.busunitcode
                            WHERE pq.deletestatus = 'Active'
                              AND pq.prd_queue_code IN (" . implode(", ", $placeholders) . ")
                            ORDER BY pq.prd_queue_code ASC, pq.seq ASC";

            $productStmt = $this->conn->prepare($productSql);
            foreach ($codeParams as $index => $codeValue) {
                $productStmt->bindValue(":queue_code_" . $index, $codeValue, PDO::PARAM_STR);
            }
            $productStmt->execute();
            $productRows = $productStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        return [
            "job" => $job,
            "lines" => $lineRows,
            "product_lines" => $productRows,
        ];
    }

    public function saveJob(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        $needsGeneratedJobCode = $jobCode === "";

        $busunitCode = trim((string) ($data["busunitcode"] ?? ""));
        $status = trim((string) ($data["status"] ?? "Planned"));
        if ($status === "") {
            $status = "Planned";
        }
        $vehicle = trim((string) ($data["vehicle"] ?? ""));
        $sender = trim((string) ($data["sender"] ?? ""));
        $receiver = trim((string) ($data["receiver"] ?? ""));
        $notes = trim((string) ($data["notes"] ?? ""));
        $targetDeliveryDate = $this->normalizeDateString($data["target_delivery_date"] ?? null);
        $tentativeDeliveryDate = $this->normalizeDateString($data["tentative_delivery_date"] ?? null);
        $actualDeliveryDate = $this->normalizeDateString($data["actual_delivery_date"] ?? null);
        $cancelledDate = $this->normalizeDateString($data["cancelled_date"] ?? null);

        if (!$needsGeneratedJobCode && $this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }

        $lines = $this->normalizeJobLines($data["deliveryitems"] ?? []);
        $lines = $this->hydrateJobLinesWithQueueDefaults($lines);

        $queueCount = count($lines);
        if ($queueCount <= 0) {
            return ["message" => "orderIdsRequired"];
        }

        $totalQty = 0;
        $queueCodes = [];
        foreach ($lines as $line) {
            $totalQty += (float) ($line["total_quantity"] ?? 0);
            $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
            if ($queueCode !== "") {
                $queueCodes[$queueCode] = true;
            }
        }

        if (!empty($queueCodes)) {
            $placeholders = [];
            $codes = array_keys($queueCodes);
            foreach ($codes as $index => $codeValue) {
                $placeholders[] = ":conflict_queue_" . $index;
            }

            $conflictSql = "SELECT
                                l.prd_queue_code,
                                l.job_code,
                                j.status
                            FROM tbl_ims_delivery_job_line l
                            INNER JOIN tbl_ims_delivery_job j
                                ON l.job_code = j.job_code
                                AND j.deletestatus = 'Active'
                            WHERE l.deletestatus = 'Active'
                              AND l.prd_queue_code IN (" . implode(", ", $placeholders) . ")
                              AND l.job_code <> :job_code
                              AND LOWER(TRIM(COALESCE(j.status, ''))) <> 'cancelled'";
            $conflictStmt = $this->conn->prepare($conflictSql);
            foreach ($codes as $index => $codeValue) {
                $conflictStmt->bindValue(":conflict_queue_" . $index, $codeValue, PDO::PARAM_STR);
            }
            $conflictStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $conflictStmt->execute();
            $conflicts = $conflictStmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($conflicts)) {
                $blocked = array_values(array_unique(array_map(
                    static fn($row) => (string) ($row["prd_queue_code"] ?? ""),
                    $conflicts
                )));
                return [
                    "message" => "orderIdsAlreadyMapped",
                    "blocked_order_ids" => $blocked,
                    "conflicts" => $conflicts,
                ];
            }
        }

        $this->conn->beginTransaction();

        try {
            if ($needsGeneratedJobCode) {
                $jobCode = $this->generateDeliveryJobCode();
            }

            $existingSql = "SELECT seq
                            FROM tbl_ims_delivery_job
                            WHERE job_code = :job_code
                              AND deletestatus = 'Active'
                            ORDER BY createdtime DESC
                            LIMIT 1";
            $existingStmt = $this->conn->prepare($existingSql);
            $existingStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $existingStmt->execute();
            $existingSeq = $existingStmt->fetchColumn();

            $previousQueueCodes = [];
            $previousLineSql = "SELECT prd_queue_code
                                FROM tbl_ims_delivery_job_line
                                WHERE job_code = :job_code
                                  AND deletestatus = 'Active'";
            $previousLineStmt = $this->conn->prepare($previousLineSql);
            $previousLineStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $previousLineStmt->execute();
            while ($row = $previousLineStmt->fetch(PDO::FETCH_ASSOC)) {
                $queueCode = trim((string) ($row["prd_queue_code"] ?? ""));
                if ($queueCode !== "") {
                    $previousQueueCodes[$queueCode] = true;
                }
            }

            if ($existingSeq) {
                $headerSql = "UPDATE tbl_ims_delivery_job
                              SET busunitcode = :busunitcode,
                                  target_delivery_date = :target_delivery_date,
                                  tentative_delivery_date = :tentative_delivery_date,
                                  actual_delivery_date = :actual_delivery_date,
                                  cancelled_date = :cancelled_date,
                                  status = :status,
                                  vehicle = :vehicle,
                                  sender = :sender,
                                  receiver = :receiver,
                                  notes = :notes,
                                  queue_count = :queue_count,
                                  total_qty = :total_qty,
                                  usertracker = :usertracker,
                                  deletestatus = 'Active'
                              WHERE seq = :seq";
                $stmt = $this->conn->prepare($headerSql);
                $stmt->bindValue(":seq", (int) $existingSeq, PDO::PARAM_INT);
            } else {
                $headerSql = "INSERT INTO tbl_ims_delivery_job
                    (job_code, busunitcode, target_delivery_date, tentative_delivery_date, actual_delivery_date, cancelled_date, status, vehicle, sender, receiver, notes, queue_count, total_qty, deletestatus, usertracker, createdtime)
                    VALUES
                    (:job_code, :busunitcode, :target_delivery_date, :tentative_delivery_date, :actual_delivery_date, :cancelled_date, :status, :vehicle, :sender, :receiver, :notes, :queue_count, :total_qty, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                $stmt = $this->conn->prepare($headerSql);
                $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            }

            $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
            $stmt->bindValue(":target_delivery_date", $targetDeliveryDate, $targetDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(":tentative_delivery_date", $tentativeDeliveryDate, $tentativeDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(":actual_delivery_date", $actualDeliveryDate, $actualDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(":cancelled_date", $cancelledDate, $cancelledDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(":status", $status, PDO::PARAM_STR);
            $stmt->bindValue(":vehicle", $vehicle, PDO::PARAM_STR);
            $stmt->bindValue(":sender", $sender, PDO::PARAM_STR);
            $stmt->bindValue(":receiver", $receiver, PDO::PARAM_STR);
            $stmt->bindValue(":notes", $notes, PDO::PARAM_STR);
            $stmt->bindValue(":queue_count", $queueCount, PDO::PARAM_INT);
            $stmt->bindValue(":total_qty", $totalQty, PDO::PARAM_STR);
            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            $deleteLineSql = "DELETE FROM tbl_ims_delivery_job_line WHERE job_code = :job_code";
            $deleteStmt = $this->conn->prepare($deleteLineSql);
            $deleteStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $deleteStmt->execute();

            $lineSql = "INSERT INTO tbl_ims_delivery_job_line
                (job_code, prd_queue_code, orderedby, payee, total_quantity, status, target_delivery_date, actual_delivery_date, cancelled_date, notes, deletestatus, usertracker, createdtime)
                VALUES
                (:job_code, :prd_queue_code, :orderedby, :payee, :total_quantity, :status, :target_delivery_date, :actual_delivery_date, :cancelled_date, :notes, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $lineStmt = $this->conn->prepare($lineSql);
            foreach ($lines as $line) {
                $lineStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
                $lineStmt->bindValue(":prd_queue_code", (string) ($line["prd_queue_code"] ?? ""), PDO::PARAM_STR);
                $lineStmt->bindValue(":orderedby", (string) ($line["orderedby"] ?? ""), PDO::PARAM_STR);
                $lineStmt->bindValue(":payee", (string) ($line["payee"] ?? ""), PDO::PARAM_STR);
                $lineStmt->bindValue(":total_quantity", (string) ($line["total_quantity"] ?? 0), PDO::PARAM_STR);
                $lineStmt->bindValue(":status", $status, PDO::PARAM_STR);
                $lineStmt->bindValue(":target_delivery_date", $targetDeliveryDate, $targetDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $lineStmt->bindValue(":actual_delivery_date", $actualDeliveryDate, $actualDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $lineStmt->bindValue(":cancelled_date", $cancelledDate, $cancelledDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $lineStmt->bindValue(":notes", (string) ($line["notes"] ?? $notes), PDO::PARAM_STR);
                $lineStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $lineStmt->execute();
            }

            $newQueueCodes = [];
            foreach ($lines as $line) {
                $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
                if ($queueCode !== "") {
                    $newQueueCodes[$queueCode] = true;
                }
            }

            if (!empty($newQueueCodes)) {
                $placeholders = [];
                $codes = array_keys($newQueueCodes);
                foreach ($codes as $index => $codeValue) {
                    $placeholders[] = ":mapped_queue_" . $index;
                }

                $queueStatus = $this->resolveQueueStatusFromJobStatus($status);
                $mappedShippingDate = null;
                $mappedDeliveredDate = null;
                if ($queueStatus !== "Pending" && $queueStatus !== "Cancelled") {
                    $mappedShippingDate = $targetDeliveryDate
                        ?? $tentativeDeliveryDate
                        ?? date("Y-m-d");
                }
                if ($queueStatus === "Delivered") {
                    $mappedDeliveredDate = $actualDeliveryDate ?? date("Y-m-d");
                }

                $queueUpdateSql = "UPDATE tbl_products_queue_summary
                                   SET delivery_status = :delivery_status,
                                       shipping_date = :shipping_date,
                                       date_delivered = :date_delivered,
                                       usertracker = :usertracker
                                   WHERE prd_queue_code IN (" . implode(", ", $placeholders) . ")";
                $queueUpdateStmt = $this->conn->prepare($queueUpdateSql);
                $queueUpdateStmt->bindValue(":delivery_status", $queueStatus, PDO::PARAM_STR);
                $queueUpdateStmt->bindValue(":shipping_date", $mappedShippingDate, $mappedShippingDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $queueUpdateStmt->bindValue(":date_delivered", $mappedDeliveredDate, $mappedDeliveredDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $queueUpdateStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                foreach ($codes as $index => $codeValue) {
                    $queueUpdateStmt->bindValue(":mapped_queue_" . $index, $codeValue, PDO::PARAM_STR);
                }
                $queueUpdateStmt->execute();
            }

            $removedQueueCodes = array_diff(
                array_keys($previousQueueCodes),
                array_keys($newQueueCodes),
            );
            if (!empty($removedQueueCodes)) {
                $placeholders = [];
                foreach (array_values($removedQueueCodes) as $index => $codeValue) {
                    $placeholders[] = ":removed_queue_" . $index;
                }

                $removedSql = "UPDATE tbl_products_queue_summary
                               SET delivery_status = CASE
                                       WHEN delivery_status = 'Delivered' THEN delivery_status
                                       ELSE 'Pending'
                                   END,
                                   shipping_date = CASE
                                       WHEN delivery_status = 'Delivered' THEN shipping_date
                                       ELSE NULL
                                   END,
                                   date_delivered = CASE
                                       WHEN delivery_status = 'Delivered' THEN date_delivered
                                       ELSE NULL
                                   END,
                                    usertracker = :usertracker
                               WHERE prd_queue_code IN (" . implode(", ", $placeholders) . ")";
                $removedStmt = $this->conn->prepare($removedSql);
                $removedStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                foreach (array_values($removedQueueCodes) as $index => $codeValue) {
                    $removedStmt->bindValue(":removed_queue_" . $index, $codeValue, PDO::PARAM_STR);
                }
                $removedStmt->execute();
            }

            $this->conn->commit();

            return $this->getJobDetail(["job_code" => $jobCode]);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function cancelJob(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        if ($jobCode === "") {
            return ["message" => "job_codeRequired"];
        }
        if ($this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }

        $cancelReason = trim((string) ($data["cancel_reason"] ?? ($data["notes"] ?? "")));
        $cancelledDate = $this->normalizeDateString($data["cancelled_date"] ?? date("Y-m-d"));

        $this->conn->beginTransaction();
        try {
            $sql = "UPDATE tbl_ims_delivery_job
                    SET status = 'Cancelled',
                        cancelled_date = :cancelled_date,
                        notes = CASE
                            WHEN :cancel_reason_empty = '' THEN notes
                            WHEN notes IS NULL OR notes = '' THEN :cancel_reason_append
                            ELSE CONCAT(notes, ' | ', :cancel_reason_concat)
                        END,
                        usertracker = :usertracker
                    WHERE job_code = :job_code";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":cancelled_date", $cancelledDate, $cancelledDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $stmt->bindValue(":cancel_reason_empty", $cancelReason, PDO::PARAM_STR);
            $stmt->bindValue(":cancel_reason_append", $cancelReason, PDO::PARAM_STR);
            $stmt->bindValue(":cancel_reason_concat", $cancelReason, PDO::PARAM_STR);
            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $stmt->execute();

            $lineSql = "UPDATE tbl_ims_delivery_job_line
                        SET status = 'Cancelled',
                            cancelled_date = :cancelled_date,
                            usertracker = :usertracker
                        WHERE job_code = :job_code";
            $lineStmt = $this->conn->prepare($lineSql);
            $lineStmt->bindValue(":cancelled_date", $cancelledDate, $cancelledDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $lineStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $lineStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $lineStmt->execute();

            $this->conn->commit();
            return $this->getJobDetail(["job_code" => $jobCode]);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function undoCancelJob(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        if ($jobCode === "") {
            return ["message" => "job_codeRequired"];
        }
        if ($this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }

        $detail = $this->getJobDetail(["job_code" => $jobCode]);
        $job = is_array($detail["job"] ?? null) ? $detail["job"] : null;
        $lineRows = is_array($detail["lines"] ?? null) ? $detail["lines"] : [];

        if ($job === null) {
            return ["message" => "jobNotFound"];
        }

        if (strtolower(trim((string) ($job["status"] ?? ""))) !== "cancelled") {
            return [
                "message" => "jobIsNotCancelled",
                "job" => $job,
                "lines" => $lineRows,
            ];
        }

        $queueCodes = [];
        foreach ($lineRows as $lineRow) {
            $queueCode = trim((string) ($lineRow["prd_queue_code"] ?? ""));
            if ($queueCode !== "") {
                $queueCodes[$queueCode] = true;
            }
        }

        if (!empty($queueCodes)) {
            $placeholders = [];
            $codes = array_keys($queueCodes);
            foreach ($codes as $index => $_codeValue) {
                $placeholders[] = ":undo_conflict_queue_" . $index;
            }

            $conflictSql = "SELECT
                                l.prd_queue_code,
                                l.job_code,
                                j.status
                            FROM tbl_ims_delivery_job_line l
                            INNER JOIN tbl_ims_delivery_job j
                                ON l.job_code = j.job_code
                                AND j.deletestatus = 'Active'
                            WHERE l.deletestatus = 'Active'
                              AND l.prd_queue_code IN (" . implode(", ", $placeholders) . ")
                              AND l.job_code <> :job_code
                              AND LOWER(TRIM(COALESCE(j.status, ''))) <> 'cancelled'";
            $conflictStmt = $this->conn->prepare($conflictSql);
            foreach ($codes as $index => $codeValue) {
                $conflictStmt->bindValue(":undo_conflict_queue_" . $index, $codeValue, PDO::PARAM_STR);
            }
            $conflictStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $conflictStmt->execute();
            $conflicts = $conflictStmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($conflicts)) {
                $blocked = array_values(array_unique(array_map(
                    static fn($row) => (string) ($row["prd_queue_code"] ?? ""),
                    $conflicts
                )));
                return [
                    "message" => "orderIdsAlreadyMapped",
                    "blocked_order_ids" => $blocked,
                    "conflicts" => $conflicts,
                ];
            }
        }

        $this->conn->beginTransaction();
        try {
            $headerSql = "UPDATE tbl_ims_delivery_job
                          SET status = 'Planned',
                              actual_delivery_date = NULL,
                              cancelled_date = NULL,
                              usertracker = :usertracker
                          WHERE job_code = :job_code
                            AND deletestatus = 'Active'";
            $headerStmt = $this->conn->prepare($headerSql);
            $headerStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $headerStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $headerStmt->execute();

            $lineSql = "UPDATE tbl_ims_delivery_job_line
                        SET status = 'Planned',
                            actual_delivery_date = NULL,
                            cancelled_date = NULL,
                            usertracker = :usertracker
                        WHERE job_code = :job_code
                          AND deletestatus = 'Active'";
            $lineStmt = $this->conn->prepare($lineSql);
            $lineStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $lineStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $lineStmt->execute();

            if (!empty($queueCodes)) {
                $placeholders = [];
                $codes = array_keys($queueCodes);
                foreach ($codes as $index => $_codeValue) {
                    $placeholders[] = ":undo_queue_" . $index;
                }

                $queueSql = "UPDATE tbl_products_queue_summary
                             SET delivery_status = 'Pending',
                                 shipping_date = NULL,
                                 date_delivered = NULL,
                                 usertracker = :usertracker
                             WHERE prd_queue_code IN (" . implode(", ", $placeholders) . ")";
                $queueStmt = $this->conn->prepare($queueSql);
                $queueStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                foreach ($codes as $index => $codeValue) {
                    $queueStmt->bindValue(":undo_queue_" . $index, $codeValue, PDO::PARAM_STR);
                }
                $queueStmt->execute();
            }

            $this->conn->commit();

            $updatedDetail = $this->getJobDetail(["job_code" => $jobCode]);
            return [
                "message" => "Success",
                "job" => $updatedDetail["job"] ?? null,
                "lines" => $updatedDetail["lines"] ?? [],
                "product_lines" => $updatedDetail["product_lines"] ?? [],
            ];
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function syncJobPhase(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        if ($jobCode === "") {
            return ["message" => "job_codeRequired"];
        }

        $phase = strtolower(trim((string) ($data["phase"] ?? "")));
        if ($phase === "") {
            return ["message" => "phaseRequired"];
        }

        $phaseMap = [
            "dispatch" => "For Receiving",
            "shipping" => "For Receiving",
            "receiving" => "For Receiving",
            "delivered" => "Delivered",
            "cancelled" => "Cancelled",
        ];

        if (!isset($phaseMap[$phase])) {
            return ["message" => "phaseNotSupported"];
        }
        if ($this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }

        $phaseDate = $this->normalizeDateString($data["phase_date"] ?? date("Y-m-d"));

        $job = $this->getJobDetail(["job_code" => $jobCode]);
        if (empty($job["job"])) {
            return ["message" => "jobNotFound"];
        }

        $jobRow = $job["job"];
        $lineRows = is_array($job["lines"] ?? null) ? $job["lines"] : [];
        $deliveryStatus = $phaseMap[$phase];
        $shippingDate = null;
        $dateDelivered = null;
        $actualDeliveryDate = null;
        $cancelledDate = null;

        if ($phase === "dispatch" || $phase === "shipping" || $phase === "receiving") {
            $shippingDate = $this->normalizeDateString($jobRow["target_delivery_date"] ?? null)
                ?? $this->normalizeDateString($jobRow["tentative_delivery_date"] ?? null)
                ?? $phaseDate;
        }

        if ($phase === "delivered") {
            $shippingDate = $this->normalizeDateString($jobRow["target_delivery_date"] ?? null)
                ?? $this->normalizeDateString($jobRow["tentative_delivery_date"] ?? null)
                ?? $phaseDate;
            $dateDelivered = $this->normalizeDateString($jobRow["actual_delivery_date"] ?? null)
                ?? $phaseDate;
            $actualDeliveryDate = $dateDelivered;
        }

        if ($phase === "cancelled") {
            $cancelledDate = $this->normalizeDateString($jobRow["cancelled_date"] ?? null)
                ?? $phaseDate;
        }

        $this->conn->beginTransaction();
        try {
            $headerSql = "UPDATE tbl_ims_delivery_job
                          SET status = :status,
                              actual_delivery_date = :actual_delivery_date,
                              cancelled_date = :cancelled_date,
                              usertracker = :usertracker
                          WHERE job_code = :job_code";
            $headerStmt = $this->conn->prepare($headerSql);
            $headerStmt->bindValue(":status", $deliveryStatus, PDO::PARAM_STR);
            $headerStmt->bindValue(":actual_delivery_date", $actualDeliveryDate, $actualDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $headerStmt->bindValue(":cancelled_date", $cancelledDate, $cancelledDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $headerStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $headerStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $headerStmt->execute();

            $lineSql = "UPDATE tbl_ims_delivery_job_line
                        SET status = :status,
                            actual_delivery_date = :actual_delivery_date,
                            cancelled_date = :cancelled_date,
                            usertracker = :usertracker
                        WHERE job_code = :job_code";
            $lineStmt = $this->conn->prepare($lineSql);
            $lineStmt->bindValue(":status", $deliveryStatus, PDO::PARAM_STR);
            $lineStmt->bindValue(":actual_delivery_date", $actualDeliveryDate, $actualDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $lineStmt->bindValue(":cancelled_date", $cancelledDate, $cancelledDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $lineStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $lineStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
            $lineStmt->execute();

            $queueSql = "UPDATE tbl_products_queue_summary
                         SET delivery_status = :delivery_status,
                             shipping_date = :shipping_date,
                             date_delivered = :date_delivered,
                             del_code = CASE
                                 WHEN del_code IS NULL OR del_code = '' THEN :del_code
                                 ELSE del_code
                             END,
                             truck_details = :truck_details,
                             usertracker = :usertracker
                         WHERE prd_queue_code = :prd_queue_code";
            $queueStmt = $this->conn->prepare($queueSql);

            foreach ($lineRows as $line) {
                $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
                if ($queueCode === "") {
                    continue;
                }

                $queueStmt->bindValue(":delivery_status", $deliveryStatus, PDO::PARAM_STR);
                $queueStmt->bindValue(":shipping_date", $shippingDate, $shippingDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $queueStmt->bindValue(":date_delivered", $dateDelivered, $dateDelivered === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $queueStmt->bindValue(":del_code", "DL-" . $queueCode, PDO::PARAM_STR);
                $queueStmt->bindValue(":truck_details", (string) ($jobRow["vehicle"] ?? ""), PDO::PARAM_STR);
                $queueStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $queueStmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
                $queueStmt->execute();

                if ($deliveryStatus === "For Receiving") {
                    $this->syncLegacyDeliveryRecordsForQueue(
                        $queueCode,
                        (string) ($line["payee"] ?? ""),
                        (string) ($line["orderedby"] ?? ""),
                        (string) ($jobRow["vehicle"] ?? ""),
                        $user_id
                    );
                }
            }

            $this->conn->commit();

            return [
                "message" => "Success",
                "job" => $this->getJobDetail(["job_code" => $jobCode])["job"],
                "lines" => $this->getJobDetail(["job_code" => $jobCode])["lines"],
            ];
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function setOrderPhase(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        $queueCode = trim((string) ($data["prd_queue_code"] ?? ""));
        $phase = strtolower(trim((string) ($data["phase"] ?? "")));

        if ($jobCode === "" || $queueCode === "") {
            return ["message" => "jobAndOrderIdRequired"];
        }
        if ($this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }

        $phaseMap = [
            "dispatch" => "For Receiving",
            "undispatch" => "Pending",
            "shipping" => "For Receiving",
            "receiving" => "For Receiving",
        ];
        if (!isset($phaseMap[$phase])) {
            return ["message" => "phaseNotSupported"];
        }

        $line = $this->findJobLine($jobCode, $queueCode);
        if ($line === null) {
            return ["message" => "orderIdNotFoundInJob"];
        }
        if (
            $phase === "undispatch" &&
            !$this->isUndispatchAllowedStatus((string) ($line["status"] ?? ""))
        ) {
            return ["message" => "orderIsNotDispatchedYet"];
        }
        if (
            $phase === "dispatch" &&
            !$this->isDispatchAllEligibleStatus((string) ($line["status"] ?? ""))
        ) {
            return ["message" => "orderAlreadyDispatched"];
        }

        $deliveryStatus = $phaseMap[$phase];
        $phaseDate = $this->normalizeDateString($data["phase_date"] ?? date("Y-m-d"));
        $shippingDate = null;
        $dateDelivered = null;
        if ($deliveryStatus !== "Pending") {
            $shippingDate = $phaseDate;
        }

        $this->conn->beginTransaction();
        try {
            $lineSql = "UPDATE tbl_ims_delivery_job_line
                        SET status = ?,
                            actual_delivery_date = ?,
                            usertracker = ?
                        WHERE job_code = ?
                          AND prd_queue_code = ?
                          AND deletestatus = 'Active'";
            $lineStmt = $this->conn->prepare($lineSql);
            $lineStmt->execute([
                $deliveryStatus,
                $dateDelivered,
                (string) $user_id,
                $jobCode,
                $queueCode,
            ]);

            $queueSql = "UPDATE tbl_products_queue_summary
                         SET delivery_status = ?,
                             shipping_date = ?,
                             date_delivered = ?,
                             del_code = CASE
                                 WHEN del_code IS NULL OR del_code = '' THEN ?
                                 ELSE del_code
                             END,
                             truck_details = ?,
                             usertracker = ?
                         WHERE prd_queue_code = ?";
            $queueStmt = $this->conn->prepare($queueSql);
            $queueStmt->execute([
                $deliveryStatus,
                $shippingDate,
                $dateDelivered,
                "DL-" . $queueCode,
                (string) ($data["vehicle"] ?? ($line["job_vehicle"] ?? "")),
                (string) $user_id,
                $queueCode,
            ]);

            if ($deliveryStatus === "For Receiving") {
                $this->syncLegacyDeliveryRecordsForQueue(
                    $queueCode,
                    (string) ($line["payee"] ?? ""),
                    (string) ($line["orderedby"] ?? ""),
                    (string) ($data["vehicle"] ?? ($line["job_vehicle"] ?? "")),
                    $user_id
                );
            }

            $this->refreshJobRollup($jobCode, $user_id);
            $this->conn->commit();

            return [
                "message" => "Success",
                "job_code" => $jobCode,
                "prd_queue_code" => $queueCode,
                "phase" => $deliveryStatus,
                "detail" => $this->getJobDetail(["job_code" => $jobCode]),
            ];
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function setOrderPhaseAll(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        $phase = strtolower(trim((string) ($data["phase"] ?? "")));

        if ($jobCode === "") {
            return ["message" => "job_codeRequired"];
        }
        if ($this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }

        $phaseMap = [
            "dispatch" => "For Receiving",
            "undispatch" => "Pending",
        ];
        if (!isset($phaseMap[$phase])) {
            return ["message" => "phaseNotSupported"];
        }

        $detail = $this->getJobDetail(["job_code" => $jobCode]);
        $job = is_array($detail["job"] ?? null) ? $detail["job"] : null;
        $lineRows = is_array($detail["lines"] ?? null) ? $detail["lines"] : [];
        if ($job === null) {
            return ["message" => "jobNotFound"];
        }

        $eligibleQueueCodes = [];
        $skipped = 0;
        foreach ($lineRows as $line) {
            $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
            if ($queueCode === "") {
                $skipped++;
                continue;
            }

            $status = (string) ($line["status"] ?? "");
            if ($phase === "dispatch" && !$this->isDispatchAllEligibleStatus($status)) {
                $skipped++;
                continue;
            }
            if ($phase === "undispatch" && !$this->isUndispatchAllowedStatus($status)) {
                $skipped++;
                continue;
            }

            $eligibleQueueCodes[$queueCode] = true;
        }

        if (empty($eligibleQueueCodes)) {
            return [
                "message" => "noEligibleOrderIds",
                "applied_count" => 0,
                "skipped_count" => $skipped,
                "detail" => $detail,
            ];
        }

        $deliveryStatus = $phaseMap[$phase];
        $phaseDate = $this->normalizeDateString($data["phase_date"] ?? date("Y-m-d"));
        $shippingDate = $deliveryStatus === "Pending" ? null : $phaseDate;
        $dateDelivered = null;
        $jobVehicle = (string) ($job["vehicle"] ?? "");

        $this->conn->beginTransaction();
        try {
            $lineSql = "UPDATE tbl_ims_delivery_job_line
                        SET status = :status,
                            actual_delivery_date = :actual_delivery_date,
                            usertracker = :usertracker
                        WHERE job_code = :job_code
                          AND prd_queue_code = :prd_queue_code
                          AND deletestatus = 'Active'";
            $lineStmt = $this->conn->prepare($lineSql);

            $queueSql = "UPDATE tbl_products_queue_summary
                         SET delivery_status = :delivery_status,
                             shipping_date = :shipping_date,
                             date_delivered = :date_delivered,
                             del_code = :del_code,
                             truck_details = :truck_details,
                             usertracker = :usertracker
                         WHERE prd_queue_code = :prd_queue_code";
            $queueStmt = $this->conn->prepare($queueSql);

            $applied = 0;
            foreach (array_keys($eligibleQueueCodes) as $queueCode) {
                $lineStmt->bindValue(":status", $deliveryStatus, PDO::PARAM_STR);
                $lineStmt->bindValue(":actual_delivery_date", $dateDelivered, $dateDelivered === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $lineStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $lineStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
                $lineStmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
                $lineStmt->execute();

                $queueStmt->bindValue(":delivery_status", $deliveryStatus, PDO::PARAM_STR);
                $queueStmt->bindValue(":shipping_date", $shippingDate, $shippingDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $queueStmt->bindValue(":date_delivered", $dateDelivered, $dateDelivered === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $queueStmt->bindValue(":del_code", "DL-" . $queueCode, PDO::PARAM_STR);
                $queueStmt->bindValue(":truck_details", $jobVehicle, PDO::PARAM_STR);
                $queueStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $queueStmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
                $queueStmt->execute();

                if ($deliveryStatus === "For Receiving") {
                    $lineContext = $this->findJobLine($jobCode, $queueCode);
                    $this->syncLegacyDeliveryRecordsForQueue(
                        $queueCode,
                        (string) ($lineContext["payee"] ?? ""),
                        (string) ($lineContext["orderedby"] ?? ""),
                        $jobVehicle,
                        $user_id
                    );
                }

                $applied++;
            }

            $this->refreshJobRollup($jobCode, $user_id);
            $this->conn->commit();

            return [
                "message" => "Success",
                "applied_count" => $applied,
                "skipped_count" => $skipped,
                "detail" => $this->getJobDetail(["job_code" => $jobCode]),
            ];
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function deliverAllOrders(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        if ($jobCode === "") {
            return ["message" => "job_codeRequired"];
        }
        if ($this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }

        $detail = $this->getJobDetail(["job_code" => $jobCode]);
        $lineRows = is_array($detail["lines"] ?? null) ? $detail["lines"] : [];
        if (empty($detail["job"])) {
            return ["message" => "jobNotFound"];
        }

        $applied = 0;
        $skipped = 0;
        foreach ($lineRows as $line) {
            $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
            $orderedBy = trim((string) ($line["orderedby"] ?? ""));
            if ($queueCode === "" || $orderedBy === "") {
                $skipped++;
                continue;
            }

            if (!$this->isDispatchReadyStatus((string) ($line["status"] ?? ""))) {
                $skipped++;
                continue;
            }

            $progress = $this->readQueueDeliveryProgress($queueCode, $orderedBy);
            if ((float) ($progress["remaining_qty"] ?? 0) <= 0) {
                $skipped++;
                continue;
            }

            $result = $this->deliverOrderAll([
                "job_code" => $jobCode,
                "prd_queue_code" => $queueCode,
            ], $user_id);

            if (($result["message"] ?? "") === "Success") {
                $applied++;
            } else {
                $skipped++;
            }
        }

        return [
            "message" => $applied > 0 ? "Success" : "noEligibleOrderIds",
            "applied_count" => $applied,
            "skipped_count" => $skipped,
            "detail" => $this->getJobDetail(["job_code" => $jobCode]),
        ];
    }

    public function deliverOrderItem(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        $queueCode = trim((string) ($data["prd_queue_code"] ?? ""));
        $invCode = trim((string) ($data["inv_code"] ?? ""));
        $requestedQty = (float) ($data["delivered_qty"] ?? 0);
        $manualExpiryDate = $this->normalizeDateString($data["expiry_date"] ?? null);

        if ($jobCode === "" || $queueCode === "" || $invCode === "") {
            return ["message" => "jobOrderAndProductRequired"];
        }
        if ($this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }
        if ($requestedQty <= 0) {
            return ["message" => "deliveredQtyMustBePositive"];
        }

        $line = $this->findJobLine($jobCode, $queueCode);
        if ($line === null) {
            return ["message" => "orderIdNotFoundInJob"];
        }
        if (!$this->isDispatchReadyStatus((string) ($line["status"] ?? ""))) {
            return ["message" => "orderMustBeDispatchedFirst"];
        }

        $productRow = $this->findQueueProductRow($queueCode, $invCode);
        if ($productRow === null) {
            return ["message" => "productNotFoundInOrder"];
        }

        $orderedBy = (string) ($line["orderedby"] ?? $productRow["orderedby"] ?? "");
        if ($orderedBy === "") {
            return ["message" => "orderedByRequired"];
        }

        $orderedQty = (float) ($productRow["quantity"] ?? 0);
        $deliveredQty = $this->readDeliveredQty($queueCode, $invCode, $orderedBy);
        $remainingQty = max($orderedQty - $deliveredQty, 0);
        if ($remainingQty <= 0) {
            return ["message" => "lineAlreadyDelivered"];
        }

        $applyQty = min($requestedQty, $remainingQty);
        $resolvedExpiryDate = $manualExpiryDate ?? $this->buildAutoExpiryDate($productRow);
        $payee = trim((string) ($line["payee"] ?? $productRow["payee"] ?? ""));

        $this->conn->beginTransaction();
        try {
            $this->postDeliveryInventoryTransfer(
                $productRow,
                $queueCode,
                $invCode,
                $applyQty,
                $orderedBy,
                $payee,
                $resolvedExpiryDate,
                $user_id
            );

            $this->syncLegacyDeliveryDetailReceipt(
                $queueCode,
                $invCode,
                $applyQty,
                $user_id
            );

            $this->refreshQueueProgress($jobCode, $queueCode, $user_id);
            $this->conn->commit();

            return [
                "message" => "Success",
                "job_code" => $jobCode,
                "prd_queue_code" => $queueCode,
                "inv_code" => $invCode,
                "applied_qty" => $applyQty,
                "detail" => $this->getJobDetail(["job_code" => $jobCode]),
            ];
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function deliverOrderAll(array $data, int $user_id): array
    {
        $jobCode = trim((string) ($data["job_code"] ?? ""));
        $queueCode = trim((string) ($data["prd_queue_code"] ?? ""));
        $manualExpiryDate = $this->normalizeDateString($data["expiry_date"] ?? null);

        if ($jobCode === "" || $queueCode === "") {
            return ["message" => "jobAndOrderIdRequired"];
        }
        if ($this->isDeliveryJobDelivered($jobCode)) {
            return ["message" => "deliveryJobAlreadyDelivered"];
        }

        $line = $this->findJobLine($jobCode, $queueCode);
        if ($line === null) {
            return ["message" => "orderIdNotFoundInJob"];
        }
        if (!$this->isDispatchReadyStatus((string) ($line["status"] ?? ""))) {
            return ["message" => "orderMustBeDispatchedFirst"];
        }

        $productRows = $this->findQueueProductRows($queueCode);
        if (empty($productRows)) {
            return ["message" => "noProductsFoundForOrder"];
        }

        $orderedBy = (string) ($line["orderedby"] ?? "");
        $payee = trim((string) ($line["payee"] ?? ""));
        $applied = [];

        $this->conn->beginTransaction();
        try {
            foreach ($productRows as $productRow) {
                $invCode = (string) ($productRow["inv_code"] ?? "");
                if ($invCode === "") {
                    continue;
                }

                $orderedQty = (float) ($productRow["quantity"] ?? 0);
                $deliveredQty = $this->readDeliveredQty($queueCode, $invCode, $orderedBy);
                $remainingQty = max($orderedQty - $deliveredQty, 0);
                if ($remainingQty <= 0) {
                    continue;
                }

                $resolvedExpiryDate = $manualExpiryDate ?? $this->buildAutoExpiryDate($productRow);
                $this->postDeliveryInventoryTransfer(
                    $productRow,
                    $queueCode,
                    $invCode,
                    $remainingQty,
                    $orderedBy,
                    $payee !== "" ? $payee : trim((string) ($productRow["payee"] ?? "")),
                    $resolvedExpiryDate,
                    $user_id
                );

                $this->syncLegacyDeliveryDetailReceipt(
                    $queueCode,
                    $invCode,
                    $remainingQty,
                    $user_id
                );

                $applied[] = [
                    "inv_code" => $invCode,
                    "qty" => $remainingQty,
                ];
            }

            if (empty($applied)) {
                $this->conn->rollBack();
                return ["message" => "allProductsAlreadyDelivered"];
            }

            $this->refreshQueueProgress($jobCode, $queueCode, $user_id);
            $this->conn->commit();

            return [
                "message" => "Success",
                "job_code" => $jobCode,
                "prd_queue_code" => $queueCode,
                "applied" => $applied,
                "detail" => $this->getJobDetail(["job_code" => $jobCode]),
            ];
        } catch (PDOException $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    private function isDeliveryJobDelivered(string $jobCode): bool
    {
        $jobCode = trim($jobCode);
        if ($jobCode === "") {
            return false;
        }

        $this->syncDeliveryJobStatusesFromQueueSummaries($jobCode);

        $sql = "SELECT status
                FROM tbl_ims_delivery_job
                WHERE job_code = :job_code
                  AND deletestatus = 'Active'
                ORDER BY seq DESC
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->execute();

        return strtolower(trim((string) ($stmt->fetchColumn() ?: ""))) === "delivered";
    }

    private function syncDeliveryJobStatusesFromQueueSummaries(
        ?string $jobCode = null,
        ?string $busunitCode = null
    ): void {
        $where = [
            "j.deletestatus = 'Active'",
            "l.deletestatus = 'Active'",
            "pqs.deletestatus = 'Active'",
            "LOWER(TRIM(COALESCE(j.status, ''))) <> 'cancelled'",
        ];
        $params = [];

        $jobCode = trim((string) ($jobCode ?? ""));
        if ($jobCode !== "") {
            $where[] = "j.job_code = :sync_job_code";
            $params[":sync_job_code"] = $jobCode;
        }

        $busunitCode = trim((string) ($busunitCode ?? ""));
        if ($busunitCode !== "") {
            $where[] = "j.busunitcode = :sync_busunitcode";
            $params[":sync_busunitcode"] = $busunitCode;
        }

        $sql = "SELECT
                    j.job_code,
                    l.prd_queue_code,
                    l.status AS line_status,
                    l.actual_delivery_date AS line_actual_delivery_date,
                    pqs.delivery_status,
                    pqs.date_delivered
                FROM tbl_ims_delivery_job j
                INNER JOIN tbl_ims_delivery_job_line l
                    ON j.job_code = l.job_code
                    AND l.deletestatus = 'Active'
                INNER JOIN tbl_products_queue_summary pqs
                    ON l.prd_queue_code = pqs.prd_queue_code
                    AND pqs.deletestatus = 'Active'
                WHERE " . implode(" AND ", $where);

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $name => $value) {
            $stmt->bindValue($name, $value, PDO::PARAM_STR);
        }
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($rows)) {
            return;
        }

        $updateSql = "UPDATE tbl_ims_delivery_job_line
                      SET status = :status,
                          actual_delivery_date = :actual_delivery_date
                      WHERE job_code = :job_code
                        AND prd_queue_code = :prd_queue_code
                        AND deletestatus = 'Active'";
        $updateStmt = $this->conn->prepare($updateSql);
        $touchedJobs = [];

        foreach ($rows as $row) {
            $nextStatus = $this->resolveJobLineStatusFromQueueStatus((string) ($row["delivery_status"] ?? ""));
            if ($nextStatus === null) {
                continue;
            }

            $currentStatus = strtolower(trim((string) ($row["line_status"] ?? "")));
            $nextStatusNormalized = strtolower(trim($nextStatus));
            if ($currentStatus === "cancelled") {
                continue;
            }
            if ($currentStatus === "delivered" && $nextStatusNormalized !== "delivered") {
                continue;
            }
            if (
                $nextStatusNormalized === "pending" &&
                !in_array($currentStatus, ["", "planned", "ready", "scheduled", "pending"], true)
            ) {
                continue;
            }
            if (
                $currentStatus === "partial delivery" &&
                !in_array($nextStatusNormalized, ["partial delivery", "delivered"], true)
            ) {
                continue;
            }

            $actualDeliveryDate = null;
            if ($nextStatusNormalized === "delivered") {
                $actualDeliveryDate = $this->normalizeDateString($row["date_delivered"] ?? null) ?? date("Y-m-d");
            }

            $currentActualDate = $this->normalizeDateString($row["line_actual_delivery_date"] ?? null);
            if ($currentStatus === $nextStatusNormalized && $currentActualDate === $actualDeliveryDate) {
                continue;
            }

            $jobCodeValue = (string) ($row["job_code"] ?? "");
            $queueCodeValue = (string) ($row["prd_queue_code"] ?? "");
            if ($jobCodeValue === "" || $queueCodeValue === "") {
                continue;
            }

            $updateStmt->bindValue(":status", $nextStatus, PDO::PARAM_STR);
            $updateStmt->bindValue(":actual_delivery_date", $actualDeliveryDate, $actualDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $updateStmt->bindValue(":job_code", $jobCodeValue, PDO::PARAM_STR);
            $updateStmt->bindValue(":prd_queue_code", $queueCodeValue, PDO::PARAM_STR);
            $updateStmt->execute();

            $touchedJobs[$jobCodeValue] = true;
        }

        foreach (array_keys($touchedJobs) as $touchedJobCode) {
            $this->refreshJobRollup($touchedJobCode, null);
        }
    }

    private function resolveJobLineStatusFromQueueStatus(string $queueStatus): ?string
    {
        $status = strtolower(trim($queueStatus));
        if ($status === "") {
            return null;
        }

        if (in_array($status, ["delivered", "received", "completed"], true)) {
            return "Delivered";
        }
        if ($status === "partial delivery" || $status === "partial") {
            return "Partial Delivery";
        }
        if (in_array($status, ["for receiving", "for shipping", "shipped"], true)) {
            return "For Receiving";
        }
        if ($status === "for dispatching") {
            return "For Dispatching";
        }
        if ($status === "cancelled") {
            return "Cancelled";
        }
        if ($status === "pending") {
            return "Pending";
        }

        return null;
    }

    private function refreshQueueProgress(string $jobCode, string $queueCode, int $user_id): void
    {
        $line = $this->findJobLine($jobCode, $queueCode);
        if ($line === null) {
            return;
        }

        $orderedBy = (string) ($line["orderedby"] ?? "");
        $progress = $this->readQueueDeliveryProgress($queueCode, $orderedBy);

        $deliveryStatus = "Pending";
        $lineStatus = (string) ($line["status"] ?? "Pending");
        $dateDelivered = null;
        $actualLineDate = null;
        if ($progress["delivered_qty"] > 0 && $progress["remaining_qty"] > 0) {
            $deliveryStatus = "Partial Delivery";
            $lineStatus = "Partial Delivery";
        } elseif ($progress["total_qty"] > 0 && $progress["remaining_qty"] <= 0) {
            $deliveryStatus = "Delivered";
            $lineStatus = "Delivered";
            $dateDelivered = date("Y-m-d");
            $actualLineDate = $dateDelivered;
        }

        if ($deliveryStatus !== "Pending") {
            $queueSql = "UPDATE tbl_products_queue_summary
                         SET delivery_status = :delivery_status,
                             date_delivered = :date_delivered,
                             shipping_date = COALESCE(shipping_date, :shipping_date),
                             usertracker = :usertracker
                         WHERE prd_queue_code = :prd_queue_code";
            $queueStmt = $this->conn->prepare($queueSql);
            $queueStmt->bindValue(":delivery_status", $deliveryStatus, PDO::PARAM_STR);
            $queueStmt->bindValue(":date_delivered", $dateDelivered, $dateDelivered === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $queueStmt->bindValue(":shipping_date", date("Y-m-d"), PDO::PARAM_STR);
            $queueStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $queueStmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
            $queueStmt->execute();
        }

        $lineSql = "UPDATE tbl_ims_delivery_job_line
                    SET status = :status,
                        actual_delivery_date = :actual_delivery_date,
                        usertracker = :usertracker
                    WHERE job_code = :job_code
                      AND prd_queue_code = :prd_queue_code
                      AND deletestatus = 'Active'";
        $lineStmt = $this->conn->prepare($lineSql);
        $lineStmt->bindValue(":status", $lineStatus, PDO::PARAM_STR);
        $lineStmt->bindValue(":actual_delivery_date", $actualLineDate, $actualLineDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $lineStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $lineStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $lineStmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
        $lineStmt->execute();

        $this->refreshJobRollup($jobCode, $user_id);
    }

    private function refreshJobRollup(string $jobCode, ?int $user_id = null): void
    {
        $sql = "SELECT status, actual_delivery_date
                FROM tbl_ims_delivery_job_line
                WHERE job_code = :job_code
                  AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($rows)) {
            return;
        }

        $statuses = array_map(
            static fn($row) => strtolower(trim((string) ($row["status"] ?? ""))),
            $rows
        );

        $nextStatus = "Planned";
        if (count(array_filter($statuses, static fn($s) => $s === "cancelled")) === count($statuses)) {
            $nextStatus = "Cancelled";
        } elseif (count(array_filter($statuses, static fn($s) => $s === "delivered")) === count($statuses)) {
            $nextStatus = "Delivered";
        } elseif (in_array("partial delivery", $statuses, true)) {
            $nextStatus = "Partial Delivery";
        } elseif (
            in_array("for receiving", $statuses, true) ||
            in_array("for shipping", $statuses, true) ||
            in_array("shipped", $statuses, true)
        ) {
            $nextStatus = "For Receiving";
        } elseif (in_array("for dispatching", $statuses, true)) {
            $nextStatus = "For Dispatching";
        } elseif (in_array("ready", $statuses, true)) {
            $nextStatus = "Ready";
        } elseif (in_array("scheduled", $statuses, true)) {
            $nextStatus = "Scheduled";
        }

        $actualDeliveryDate = null;
        if ($nextStatus === "Delivered") {
            $lineDates = array_values(array_filter(array_map(
                fn($row) => $this->normalizeDateString($row["actual_delivery_date"] ?? null),
                $rows
            )));
            sort($lineDates);
            $actualDeliveryDate = end($lineDates) ?: date("Y-m-d");
        }

        $usertrackerSql = $user_id === null ? "" : ", usertracker = :usertracker";
        $updateSql = "UPDATE tbl_ims_delivery_job
                      SET status = :status,
                          actual_delivery_date = :actual_delivery_date
                          {$usertrackerSql}
                      WHERE job_code = :job_code
                        AND deletestatus = 'Active'";
        $updateStmt = $this->conn->prepare($updateSql);
        $updateStmt->bindValue(":status", $nextStatus, PDO::PARAM_STR);
        $updateStmt->bindValue(":actual_delivery_date", $actualDeliveryDate, $actualDeliveryDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        if ($user_id !== null) {
            $updateStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        }
        $updateStmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $updateStmt->execute();
    }

    private function findJobLine(string $jobCode, string $queueCode): ?array
    {
        $sql = "SELECT
                    l.*,
                    j.vehicle AS job_vehicle
                FROM tbl_ims_delivery_job_line l
                LEFT JOIN tbl_ims_delivery_job j
                    ON l.job_code = j.job_code
                    AND j.deletestatus = 'Active'
                WHERE l.job_code = :job_code
                  AND l.prd_queue_code = :prd_queue_code
                  AND l.deletestatus = 'Active'
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    private function findQueueProductRow(string $queueCode, string $invCode): ?array
    {
        $sql = "SELECT
                    pq.prd_queue_code,
                    pq.inv_code,
                    pq.cost_per_uom,
                    pq.uomval,
                    pq.uom,
                    pq.quantity,
                    pq.orderedby,
                    pq.payee,
                    COALESCE(bp.expiry_days, rm.expiry_days, 0) AS expiry_days
                FROM tbl_products_queue pq
                LEFT JOIN lkp_build_of_products bp
                    ON pq.inv_code = bp.build_code
                LEFT JOIN lkp_raw_mats rm
                    ON pq.inv_code = rm.mat_code
                WHERE pq.deletestatus = 'Active'
                  AND pq.prd_queue_code = :prd_queue_code
                  AND pq.inv_code = :inv_code
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    private function findQueueProductRows(string $queueCode): array
    {
        $sql = "SELECT
                    pq.prd_queue_code,
                    pq.inv_code,
                    pq.cost_per_uom,
                    pq.uomval,
                    pq.uom,
                    pq.quantity,
                    pq.orderedby,
                    pq.payee,
                    COALESCE(bp.expiry_days, rm.expiry_days, 0) AS expiry_days
                FROM tbl_products_queue pq
                LEFT JOIN lkp_build_of_products bp
                    ON pq.inv_code = bp.build_code
                LEFT JOIN lkp_raw_mats rm
                    ON pq.inv_code = rm.mat_code
                WHERE pq.deletestatus = 'Active'
                  AND pq.prd_queue_code = :prd_queue_code
                ORDER BY pq.seq ASC";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function syncLegacyDeliveryRecordsForQueue(
        string $queueCode,
        string $sender,
        string $receiver,
        string $vehicle,
        int $user_id
    ): void {
        $queueCode = trim($queueCode);
        $sender = trim($sender);
        $receiver = trim($receiver);
        if ($queueCode === "" || $sender === "" || $receiver === "") {
            return;
        }

        $productRows = $this->findQueueProductRows($queueCode);
        if (empty($productRows)) {
            return;
        }

        $delCode = "DL-" . $queueCode;
        $assignmentSql = "SELECT del_details_code
                          FROM tbl_delivery_assignment
                          WHERE del_code = :del_code
                            AND deletestatus = 'Active'
                          ORDER BY seq DESC
                          LIMIT 1";
        $assignmentStmt = $this->conn->prepare($assignmentSql);
        $assignmentStmt->bindValue(":del_code", $delCode, PDO::PARAM_STR);
        $assignmentStmt->execute();
        $delDetailsCode = (string) ($assignmentStmt->fetchColumn() ?: "");

        if ($delDetailsCode === "") {
            $delDetailsCode = $this->generateLegacyDeliveryDetailsCode();

            $insertAssignmentSql = "INSERT INTO tbl_delivery_assignment
                (del_code, sender, receiver, vehicle, del_details_code, deletestatus, user_tracker, createdtime)
                VALUES
                (:del_code, :sender, :receiver, :vehicle, :del_details_code, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
            $insertAssignmentStmt = $this->conn->prepare($insertAssignmentSql);
            $insertAssignmentStmt->bindValue(":del_code", $delCode, PDO::PARAM_STR);
            $insertAssignmentStmt->bindValue(":sender", $sender, PDO::PARAM_STR);
            $insertAssignmentStmt->bindValue(":receiver", $receiver, PDO::PARAM_STR);
            $insertAssignmentStmt->bindValue(":vehicle", $vehicle, PDO::PARAM_STR);
            $insertAssignmentStmt->bindValue(":del_details_code", $delDetailsCode, PDO::PARAM_STR);
            $insertAssignmentStmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $insertAssignmentStmt->execute();
        } else {
            $updateAssignmentSql = "UPDATE tbl_delivery_assignment
                                    SET sender = :sender,
                                        receiver = :receiver,
                                        vehicle = :vehicle,
                                        user_tracker = :user_tracker
                                    WHERE del_code = :del_code
                                      AND deletestatus = 'Active'";
            $updateAssignmentStmt = $this->conn->prepare($updateAssignmentSql);
            $updateAssignmentStmt->bindValue(":sender", $sender, PDO::PARAM_STR);
            $updateAssignmentStmt->bindValue(":receiver", $receiver, PDO::PARAM_STR);
            $updateAssignmentStmt->bindValue(":vehicle", $vehicle, PDO::PARAM_STR);
            $updateAssignmentStmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $updateAssignmentStmt->bindValue(":del_code", $delCode, PDO::PARAM_STR);
            $updateAssignmentStmt->execute();
        }

        $detailSql = "SELECT seq, inv_code, sender_qty, receiver_qty, status
                      FROM tbl_delivery_details
                      WHERE del_details_code = :del_details_code
                        AND deletestatus = 'Active'";
        $detailStmt = $this->conn->prepare($detailSql);
        $detailStmt->bindValue(":del_details_code", $delDetailsCode, PDO::PARAM_STR);
        $detailStmt->execute();

        $existingMap = [];
        foreach ($detailStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $existingMap[(string) ($row["inv_code"] ?? "")] = $row;
        }

        $insertDetailSql = "INSERT INTO tbl_delivery_details
            (del_details_code, level, sender, receiver, inv_code, sender_qty, receiver_qty, variance, status, queued_transdate, completed_transdate, deletestatus, usertracker, createdtime)
            VALUES
            (:del_details_code, :level, :sender, :receiver, :inv_code, :sender_qty, :receiver_qty, :variance, :status, :queued_transdate, :completed_transdate, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $insertDetailStmt = $this->conn->prepare($insertDetailSql);

        $updateDetailSql = "UPDATE tbl_delivery_details
                            SET level = :level,
                                sender = :sender,
                                receiver = :receiver,
                                sender_qty = :sender_qty,
                                variance = :variance,
                                status = :status,
                                completed_transdate = :completed_transdate,
                                usertracker = :usertracker
                            WHERE seq = :seq";
        $updateDetailStmt = $this->conn->prepare($updateDetailSql);

        $today = date("Y-m-d");
        foreach ($productRows as $productRow) {
            $invCode = trim((string) ($productRow["inv_code"] ?? ""));
            if ($invCode === "") {
                continue;
            }

            $senderQty = round((float) ($productRow["quantity"] ?? 0), 4);
            $existing = $existingMap[$invCode] ?? null;
            $receiverQty = round((float) ($existing["receiver_qty"] ?? 0), 4);
            $detailStatus = strtolower(trim((string) ($existing["status"] ?? "")));
            if (in_array($detailStatus, ["completed", "delivered"], true)) {
                $nextStatus = (string) ($existing["status"] ?? "Completed");
                $completedDate = $today;
            } elseif ($receiverQty > 0) {
                $nextStatus = "Partial";
                $completedDate = null;
            } else {
                $nextStatus = "On Delivery";
                $completedDate = null;
            }
            $variance = round($receiverQty - $senderQty, 4);

            if ($existing === null) {
                $insertDetailStmt->bindValue(":del_details_code", $delDetailsCode, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":level", "Delivery", PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":sender", $sender, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":receiver", $receiver, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":sender_qty", (string) $senderQty, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":receiver_qty", (string) $receiverQty, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":variance", (string) $variance, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":status", $nextStatus, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":queued_transdate", $today, PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":completed_transdate", $completedDate, $completedDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
                $insertDetailStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $insertDetailStmt->execute();
                continue;
            }

            $updateDetailStmt->bindValue(":level", "Delivery", PDO::PARAM_STR);
            $updateDetailStmt->bindValue(":sender", $sender, PDO::PARAM_STR);
            $updateDetailStmt->bindValue(":receiver", $receiver, PDO::PARAM_STR);
            $updateDetailStmt->bindValue(":sender_qty", (string) $senderQty, PDO::PARAM_STR);
            $updateDetailStmt->bindValue(":variance", (string) $variance, PDO::PARAM_STR);
            $updateDetailStmt->bindValue(":status", $nextStatus, PDO::PARAM_STR);
            $updateDetailStmt->bindValue(":completed_transdate", $completedDate, $completedDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
            $updateDetailStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $updateDetailStmt->bindValue(":seq", (int) ($existing["seq"] ?? 0), PDO::PARAM_INT);
            $updateDetailStmt->execute();
        }
    }

    private function syncLegacyDeliveryDetailReceipt(
        string $queueCode,
        string $invCode,
        float $deltaQty,
        int $user_id
    ): void {
        $detailRow = $this->findLegacyDeliveryDetailRow($queueCode, $invCode);
        if ($detailRow === null) {
            $queueRow = $this->findQueueProductRow($queueCode, $invCode);
            if ($queueRow === null) {
                return;
            }

            $this->syncLegacyDeliveryRecordsForQueue(
                $queueCode,
                (string) ($queueRow["payee"] ?? ""),
                (string) ($queueRow["orderedby"] ?? ""),
                "",
                $user_id
            );

            $detailRow = $this->findLegacyDeliveryDetailRow($queueCode, $invCode);
            if ($detailRow === null) {
                return;
            }
        }

        $senderQty = round((float) ($detailRow["sender_qty"] ?? 0), 4);
        $receiverQty = round((float) ($detailRow["receiver_qty"] ?? 0), 4);
        $nextReceiverQty = round($receiverQty + $deltaQty, 4);
        $variance = round($nextReceiverQty - $senderQty, 4);
        $isComplete = abs($senderQty - $nextReceiverQty) < 0.0001;
        $nextStatus = $isComplete ? "Completed" : "Partial";
        $completedDate = $isComplete ? date("Y-m-d") : null;

        $updateSql = "UPDATE tbl_delivery_details
                      SET receiver_qty = :receiver_qty,
                          variance = :variance,
                          status = :status,
                          completed_transdate = :completed_transdate,
                          usertracker = :usertracker
                      WHERE seq = :seq";
        $updateStmt = $this->conn->prepare($updateSql);
        $updateStmt->bindValue(":receiver_qty", (string) $nextReceiverQty, PDO::PARAM_STR);
        $updateStmt->bindValue(":variance", (string) $variance, PDO::PARAM_STR);
        $updateStmt->bindValue(":status", $nextStatus, PDO::PARAM_STR);
        $updateStmt->bindValue(":completed_transdate", $completedDate, $completedDate === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
        $updateStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $updateStmt->bindValue(":seq", (int) ($detailRow["seq"] ?? 0), PDO::PARAM_INT);
        $updateStmt->execute();
    }

    private function findLegacyDeliveryDetailRow(string $queueCode, string $invCode): ?array
    {
        $sql = "SELECT dd.seq, dd.sender_qty, dd.receiver_qty, dd.status
                FROM tbl_delivery_assignment da
                INNER JOIN tbl_delivery_details dd
                    ON da.del_details_code = dd.del_details_code
                    AND dd.deletestatus = 'Active'
                WHERE da.del_code = :del_code
                  AND da.deletestatus = 'Active'
                  AND dd.inv_code = :inv_code
                ORDER BY dd.seq DESC
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":del_code", "DL-" . trim($queueCode), PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", trim($invCode), PDO::PARAM_STR);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    private function generateLegacyDeliveryDetailsCode(): string
    {
        while (true) {
            $candidate = "DD-" . date("Ym") . substr(bin2hex(random_bytes(5)), 0, 10);
            $sql = "SELECT COUNT(*)
                    FROM tbl_delivery_assignment
                    WHERE del_details_code = :del_details_code";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":del_details_code", $candidate, PDO::PARAM_STR);
            $stmt->execute();
            if ((int) $stmt->fetchColumn() === 0) {
                return $candidate;
            }
        }
    }

    private function readDeliveredQty(string $queueCode, string $invCode, string $busunitCode): float
    {
        $sql = "SELECT COALESCE(SUM(qty), 0) AS delivered_qty
                FROM tbl_inventory_transactions
                WHERE pr_queue_code = :pr_queue_code
                  AND inv_code = :inv_code
                  AND busunitcode = :busunitcode
                  AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":pr_queue_code", $queueCode, PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
        $stmt->execute();
        $value = $stmt->fetchColumn();
        return (float) ($value === false ? 0 : $value);
    }

    private function readQueueDeliveryProgress(string $queueCode, string $orderedBy): array
    {
        $sql = "SELECT
                    COALESCE(SUM(pq.quantity), 0) AS total_qty,
                    COALESCE(SUM(delivered_map.delivered_qty), 0) AS delivered_qty
                FROM tbl_products_queue pq
                LEFT JOIN (
                    SELECT pr_queue_code, inv_code, busunitcode, SUM(qty) AS delivered_qty
                    FROM tbl_inventory_transactions
                    WHERE deletestatus = 'Active'
                    GROUP BY pr_queue_code, inv_code, busunitcode
                ) delivered_map
                    ON pq.prd_queue_code = delivered_map.pr_queue_code
                    AND pq.inv_code = delivered_map.inv_code
                    AND delivered_map.busunitcode = :orderedby
                WHERE pq.deletestatus = 'Active'
                  AND pq.prd_queue_code = :prd_queue_code";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":orderedby", $orderedBy, PDO::PARAM_STR);
        $stmt->bindValue(":prd_queue_code", $queueCode, PDO::PARAM_STR);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $totalQty = (float) ($row["total_qty"] ?? 0);
        $deliveredQty = (float) ($row["delivered_qty"] ?? 0);
        $remainingQty = max($totalQty - $deliveredQty, 0);

        return [
            "total_qty" => $totalQty,
            "delivered_qty" => $deliveredQty,
            "remaining_qty" => $remainingQty,
        ];
    }

    private function buildAutoExpiryDate(array $productRow): ?string
    {
        $expiryDays = (int) ($productRow["expiry_days"] ?? 0);
        if ($expiryDays <= 0) {
            return null;
        }

        $date = new DateTimeImmutable("now");
        $date = $date->modify("+" . $expiryDays . " days");
        return $date->format("Y-m-d");
    }

    private function postDeliveryInventoryTransfer(
        array $productRow,
        string $queueCode,
        string $invCode,
        float $qty,
        string $orderedBy,
        string $payee,
        ?string $expiryDate,
        int $user_id
    ): void {
        if ($qty <= 0 || trim($orderedBy) === "") {
            return;
        }

        $insertSql = "INSERT INTO tbl_inventory_transactions
                        (trans_date, inv_code, qty, cost_per_uom, uom_val, uom, pr_queue_code, busunitcode, inv_class, expirydate, deletestatus, usertracker, createddate)
                      VALUES
                        (:trans_date, :inv_code, :qty, :cost_per_uom, :uom_val, :uom, :pr_queue_code, :busunitcode, :inv_class, :expirydate, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $insertStmt = $this->conn->prepare($insertSql);

        $baseCostPerUom = (string) ($productRow["cost_per_uom"] ?? 0);
        $uomVal = (string) ($productRow["uomval"] ?? 1);
        $uom = (string) ($productRow["uom"] ?? "EA");
        $invClass = $this->resolveInventoryClass($invCode);
        $resolvedExpiryDate = $expiryDate ?? "0000-00-00";

        $this->insertInventoryTransaction(
            $insertStmt,
            $queueCode,
            $invCode,
            $qty,
            $baseCostPerUom,
            $uomVal,
            $uom,
            $orderedBy,
            $invClass,
            $resolvedExpiryDate,
            $user_id
        );

        $counterpart = trim($payee);
        if (
            $counterpart === "" ||
            $counterpart === trim($orderedBy) ||
            !$this->isInventoryBusinessUnit($counterpart)
        ) {
            return;
        }

        $counterpartCostPerUom = $this->resolveCounterpartCostPerUom(
            $invCode,
            $counterpart,
            $baseCostPerUom
        );

        $this->insertInventoryTransaction(
            $insertStmt,
            $queueCode,
            $invCode,
            $qty * -1,
            $counterpartCostPerUom,
            $uomVal,
            $uom,
            $counterpart,
            $invClass,
            $resolvedExpiryDate,
            $user_id
        );
    }

    private function insertInventoryTransaction(
        PDOStatement $stmt,
        string $queueCode,
        string $invCode,
        float $qty,
        string $costPerUom,
        string $uomVal,
        string $uom,
        string $busunitCode,
        string $invClass,
        string $expiryDate,
        int $user_id
    ): void {
        $stmt->bindValue(":trans_date", date("Y-m-d"), PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
        $stmt->bindValue(":qty", (string) $qty, PDO::PARAM_STR);
        $stmt->bindValue(":cost_per_uom", $costPerUom, PDO::PARAM_STR);
        $stmt->bindValue(":uom_val", $uomVal, PDO::PARAM_STR);
        $stmt->bindValue(":uom", $uom, PDO::PARAM_STR);
        $stmt->bindValue(":pr_queue_code", $queueCode, PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
        $stmt->bindValue(":inv_class", $invClass, PDO::PARAM_STR);
        $stmt->bindValue(":expirydate", $expiryDate, PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function resolveInventoryClass(string $invCode): string
    {
        return str_starts_with($invCode, "RM") ? "RM" : "FG";
    }

    private function isInventoryBusinessUnit(string $busunitCode): bool
    {
        $sql = "SELECT COUNT(*)
                FROM lkp_busunits
                WHERE busunitcode = :busunitcode";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
        $stmt->execute();
        return (int) $stmt->fetchColumn() > 0;
    }

    private function resolveCounterpartCostPerUom(
        string $invCode,
        string $busunitCode,
        string $fallbackCostPerUom
    ): string {
        $busunitSql = "SELECT pricing_category
                       FROM lkp_busunits
                       WHERE busunitcode = :busunitcode
                       LIMIT 1";
        $busunitStmt = $this->conn->prepare($busunitSql);
        $busunitStmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);
        $busunitStmt->execute();
        $pricingCategory = (string) ($busunitStmt->fetchColumn() ?: "");
        if ($pricingCategory === "") {
            return $fallbackCostPerUom;
        }

        $pricingSql = "SELECT cost_per_uom
                       FROM tbl_pricing_details
                       WHERE inv_code = :inv_code
                         AND pricing_code = :pricing_code
                       LIMIT 1";
        $pricingStmt = $this->conn->prepare($pricingSql);
        $pricingStmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
        $pricingStmt->bindValue(":pricing_code", $pricingCategory, PDO::PARAM_STR);
        $pricingStmt->execute();

        $mappedCost = $pricingStmt->fetchColumn();
        return $mappedCost === false ? $fallbackCostPerUom : (string) $mappedCost;
    }

    private function isDispatchReadyStatus(string $status): bool
    {
        $normalized = strtolower(trim($status));
        return in_array($normalized, [
            "for dispatching",
            "for shipping",
            "for receiving",
            "partial delivery",
            "delivered",
            "shipped",
        ], true);
    }

    private function isUndispatchAllowedStatus(string $status): bool
    {
        $normalized = strtolower(trim($status));
        return in_array($normalized, [
            "for dispatching",
            "for shipping",
            "for receiving",
            "shipped",
        ], true);
    }

    private function isDispatchAllEligibleStatus(string $status): bool
    {
        $normalized = strtolower(trim($status));
        return !in_array($normalized, [
            "for dispatching",
            "for shipping",
            "for receiving",
            "shipped",
            "delivered",
            "partial delivery",
            "cancelled",
        ], true);
    }

    private function resolveQueueStatusFromJobStatus(string $jobStatus): string
    {
        $normalized = strtolower(trim($jobStatus));
        if ($normalized === "cancelled") {
            return "Cancelled";
        }
        if ($normalized === "delivered") {
            return "Delivered";
        }
        if ($normalized === "partial delivery") {
            return "Partial Delivery";
        }
        if (
            $normalized === "for receiving" ||
            $normalized === "for shipping" ||
            $normalized === "shipped"
        ) {
            return "For Receiving";
        }
        if ($normalized === "for dispatching") {
            return "For Dispatching";
        }
        return "Pending";
    }

    private function hydrateJobLinesWithQueueDefaults(array $lines): array
    {
        if (empty($lines)) {
            return [];
        }

        $queueCodes = [];
        foreach ($lines as $line) {
            $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
            if ($queueCode !== "") {
                $queueCodes[$queueCode] = true;
            }
        }

        if (empty($queueCodes)) {
            return $lines;
        }

        $summaryMap = $this->readQueueSummaryMapByCodes(array_keys($queueCodes));
        $rows = [];
        foreach ($lines as $line) {
            $queueCode = trim((string) ($line["prd_queue_code"] ?? ""));
            if ($queueCode === "") {
                continue;
            }

            $summary = $summaryMap[$queueCode] ?? [];
            $orderedBy = trim((string) ($line["orderedby"] ?? ""));
            if ($orderedBy === "") {
                $orderedBy = trim((string) ($summary["orderedby"] ?? ""));
            }

            $payee = trim((string) ($line["payee"] ?? ""));
            if ($payee === "") {
                $payee = trim((string) ($summary["payee"] ?? ""));
            }

            $totalQuantity = (float) ($line["total_quantity"] ?? 0);
            if ($totalQuantity <= 0) {
                $totalQuantity = (float) ($summary["total_quantity"] ?? 0);
            }

            $rows[] = [
                "prd_queue_code" => $queueCode,
                "orderedby" => $orderedBy,
                "payee" => $payee,
                "total_quantity" => (string) $totalQuantity,
                "notes" => trim((string) ($line["notes"] ?? "")),
            ];
        }

        return $rows;
    }

    private function readQueueSummaryMapByCodes(array $queueCodes): array
    {
        if (empty($queueCodes)) {
            return [];
        }

        $placeholders = [];
        foreach ($queueCodes as $index => $_code) {
            $placeholders[] = ":summary_queue_" . $index;
        }

        $sql = "SELECT
                    pqs.prd_queue_code,
                    pqs.orderedby,
                    pqs.payee,
                    COALESCE(SUM(pq.quantity), 0) AS total_quantity
                FROM tbl_products_queue_summary pqs
                LEFT JOIN tbl_products_queue pq
                    ON pqs.prd_queue_code = pq.prd_queue_code
                    AND pq.deletestatus = 'Active'
                WHERE pqs.deletestatus = 'Active'
                  AND pqs.prd_queue_code IN (" . implode(", ", $placeholders) . ")
                GROUP BY pqs.prd_queue_code, pqs.orderedby, pqs.payee";
        $stmt = $this->conn->prepare($sql);
        foreach ($queueCodes as $index => $codeValue) {
            $stmt->bindValue(":summary_queue_" . $index, (string) $codeValue, PDO::PARAM_STR);
        }
        $stmt->execute();

        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $code = trim((string) ($row["prd_queue_code"] ?? ""));
            if ($code === "") {
                continue;
            }
            $map[$code] = $row;
        }
        return $map;
    }

    private function generateDeliveryJobCode(): string
    {
        $datePart = date("Ymd");
        $nextSeries = $this->getNextDeliveryJobSeriesForDate($datePart);

        while (true) {
            $candidate = "DJ-" . $datePart . "-" . str_pad((string) $nextSeries, 2, "0", STR_PAD_LEFT);
            if (!$this->deliveryJobCodeExists($candidate)) {
                return $candidate;
            }
            $nextSeries++;
        }
    }

    private function getNextDeliveryJobSeriesForDate(string $datePart): int
    {
        $sql = "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(job_code, '-', -1) AS UNSIGNED)), 0) AS last_series
                FROM tbl_ims_delivery_job
                WHERE job_code LIKE :job_prefix
                  AND job_code REGEXP :job_pattern
                FOR UPDATE";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_prefix", "DJ-" . $datePart . "-%", PDO::PARAM_STR);
        $stmt->bindValue(":job_pattern", "^DJ-" . $datePart . "-[0-9]+$", PDO::PARAM_STR);
        $stmt->execute();

        $lastSeries = (int) ($stmt->fetchColumn() ?: 0);
        return max(1, $lastSeries + 1);
    }

    private function deliveryJobCodeExists(string $jobCode): bool
    {
        $sql = "SELECT COUNT(*)
                FROM tbl_ims_delivery_job
                WHERE job_code = :job_code";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":job_code", $jobCode, PDO::PARAM_STR);
        $stmt->execute();

        return (int) $stmt->fetchColumn() > 0;
    }

    private function normalizeJobLines($lines): array
    {
        $rows = [];
        foreach (is_array($lines) ? $lines : [] as $line) {
            $queueCode = trim((string) ($line["prd_queue_code"] ?? $line["queue_code"] ?? ""));
            if ($queueCode === "") {
                continue;
            }
            $rows[] = [
                "prd_queue_code" => $queueCode,
                "orderedby" => trim((string) ($line["orderedby"] ?? "")),
                "payee" => trim((string) ($line["payee"] ?? "")),
                "total_quantity" => (string) ($line["total_quantity"] ?? $line["quantity"] ?? 0),
                "notes" => trim((string) ($line["notes"] ?? "")),
            ];
        }
        return $rows;
    }

    private function normalizeDateString($value): ?string
    {
        $value = trim((string) ($value ?? ""));
        if ($value === "" || $value === "0000-00-00") {
            return null;
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return null;
        }

        return date("Y-m-d", $timestamp);
    }
}
