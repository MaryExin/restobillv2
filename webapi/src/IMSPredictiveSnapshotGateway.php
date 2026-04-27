<?php

class IMSPredictiveSnapshotGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getSnapshots(array $filters): array
    {
        $where = ["deletestatus = 'Active'"];
        $params = [];

        if (!empty($filters["busunitcode"])) {
            $where[] = "busunitcode = :busunitcode";
            $params[":busunitcode"] = (string) $filters["busunitcode"];
        }
        if (!empty($filters["inv_code"])) {
            $where[] = "inv_code = :inv_code";
            $params[":inv_code"] = (string) $filters["inv_code"];
        }
        if (!empty($filters["reference_date"])) {
            $where[] = "reference_date = :reference_date";
            $params[":reference_date"] = (string) $filters["reference_date"];
        }
        if (!empty($filters["expiry_risk_level"])) {
            $where[] = "expiry_risk_level = :expiry_risk_level";
            $params[":expiry_risk_level"] = (string) $filters["expiry_risk_level"];
        }
        if (!empty($filters["only_attention"])) {
            $where[] = "(expiry_risk_level <> 'Low' OR suggested_reorder_qty > 0 OR suggested_production_qty > 0)";
        }

        $limit = $this->normalizeLimit($filters["limit"] ?? 24);

        $sql = "SELECT *
                FROM tbl_ims_predictive_snapshot
                WHERE " . implode(" AND ", $where) . "
                ORDER BY reference_date DESC, expiry_risk_level DESC, suggested_reorder_qty DESC, seq DESC
                LIMIT " . $limit;

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $name => $value) {
            $stmt->bindValue($name, $value, PDO::PARAM_STR);
        }
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $riskCounts = [];
        $withReorder = 0;
        $withProduction = 0;
        foreach ($items as $item) {
            $risk = (string) ($item["expiry_risk_level"] ?? "Low");
            $riskCounts[$risk] = ($riskCounts[$risk] ?? 0) + 1;
            if ((float) ($item["suggested_reorder_qty"] ?? 0) > 0) {
                $withReorder++;
            }
            if ((float) ($item["suggested_production_qty"] ?? 0) > 0) {
                $withProduction++;
            }
        }

        $riskSummary = [];
        foreach ($riskCounts as $risk => $count) {
            $riskSummary[] = [
                "risk_level" => $risk,
                "count_records" => $count,
            ];
        }

        return [
            "items" => $items,
            "summary" => [
                "total" => count($items),
                "with_reorder" => $withReorder,
                "with_production" => $withProduction,
                "risk_levels" => $riskSummary,
            ],
        ];
    }

    public function upsertSnapshotsForUser($user_id, array $data): array
    {
        $items = array_key_exists("items", $data) && is_array($data["items"])
            ? $data["items"]
            : [$data];

        $inserted = 0;
        $updated = 0;

        try {
            $this->conn->beginTransaction();

            foreach ($items as $item) {
                $snapshot = $this->normalizeSnapshot($item);
                $existingSeq = $this->findExistingSeq($snapshot["snapshot_code"], $snapshot["busunitcode"], $snapshot["inv_code"]);

                if ($existingSeq !== null) {
                    $updated += $this->updateSnapshot($existingSeq, $user_id, $snapshot);
                    continue;
                }

                $inserted += $this->insertSnapshot($user_id, $snapshot);
            }

            $this->conn->commit();

            return [
                "message" => "Success",
                "inserted" => $inserted,
                "updated" => $updated,
            ];
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);
            return ["message" => $e->getMessage()];
        }
    }

    private function findExistingSeq(string $snapshotCode, string $busunitcode, string $invCode): ?int
    {
        $sql = "SELECT seq
                FROM tbl_ims_predictive_snapshot
                WHERE snapshot_code = :snapshot_code
                  AND busunitcode = :busunitcode
                  AND inv_code = :inv_code
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":snapshot_code", $snapshotCode, PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", $invCode, PDO::PARAM_STR);
        $stmt->execute();

        $seq = $stmt->fetchColumn();
        if ($seq === false) {
            return null;
        }

        return (int) $seq;
    }

    private function updateSnapshot(int $seq, $user_id, array $snapshot): int
    {
        $sql = "UPDATE tbl_ims_predictive_snapshot
                SET
                    reference_date = :reference_date,
                    on_hand_qty = :on_hand_qty,
                    in_transit_qty = :in_transit_qty,
                    allocated_qty = :allocated_qty,
                    approved_demand_qty = :approved_demand_qty,
                    historical_daily_avg = :historical_daily_avg,
                    lead_time_days = :lead_time_days,
                    safety_stock_qty = :safety_stock_qty,
                    reorder_point_qty = :reorder_point_qty,
                    suggested_reorder_qty = :suggested_reorder_qty,
                    suggested_production_qty = :suggested_production_qty,
                    suggested_allocation_qty = :suggested_allocation_qty,
                    days_cover = :days_cover,
                    expiry_risk_level = :expiry_risk_level,
                    risk_notes = :risk_notes,
                    deletestatus = 'Active',
                    usertracker = :usertracker
                WHERE seq = :seq";

        $stmt = $this->conn->prepare($sql);
        $this->bindSnapshotStatement($stmt, $snapshot, $user_id);
        $stmt->bindValue(":seq", $seq, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->rowCount();
    }

    private function insertSnapshot($user_id, array $snapshot): int
    {
        $sql = "INSERT INTO tbl_ims_predictive_snapshot
                (
                    snapshot_code,
                    reference_date,
                    busunitcode,
                    inv_code,
                    on_hand_qty,
                    in_transit_qty,
                    allocated_qty,
                    approved_demand_qty,
                    historical_daily_avg,
                    lead_time_days,
                    safety_stock_qty,
                    reorder_point_qty,
                    suggested_reorder_qty,
                    suggested_production_qty,
                    suggested_allocation_qty,
                    days_cover,
                    expiry_risk_level,
                    risk_notes,
                    deletestatus,
                    usertracker,
                    createdtime
                )
                VALUES
                (
                    :snapshot_code,
                    :reference_date,
                    :busunitcode,
                    :inv_code,
                    :on_hand_qty,
                    :in_transit_qty,
                    :allocated_qty,
                    :approved_demand_qty,
                    :historical_daily_avg,
                    :lead_time_days,
                    :safety_stock_qty,
                    :reorder_point_qty,
                    :suggested_reorder_qty,
                    :suggested_production_qty,
                    :suggested_allocation_qty,
                    :days_cover,
                    :expiry_risk_level,
                    :risk_notes,
                    'Active',
                    :usertracker,
                    DATE_ADD(NOW(), INTERVAL 8 HOUR)
                )";

        $stmt = $this->conn->prepare($sql);
        $this->bindSnapshotStatement($stmt, $snapshot, $user_id);
        $stmt->execute();

        return $stmt->rowCount();
    }

    private function bindSnapshotStatement(PDOStatement $stmt, array $snapshot, $user_id): void
    {
        $stmt->bindValue(":snapshot_code", $snapshot["snapshot_code"], PDO::PARAM_STR);
        $stmt->bindValue(":reference_date", $snapshot["reference_date"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $snapshot["busunitcode"], PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", $snapshot["inv_code"], PDO::PARAM_STR);
        $stmt->bindValue(":on_hand_qty", $snapshot["on_hand_qty"]);
        $stmt->bindValue(":in_transit_qty", $snapshot["in_transit_qty"]);
        $stmt->bindValue(":allocated_qty", $snapshot["allocated_qty"]);
        $stmt->bindValue(":approved_demand_qty", $snapshot["approved_demand_qty"]);
        $stmt->bindValue(":historical_daily_avg", $snapshot["historical_daily_avg"]);
        $stmt->bindValue(":lead_time_days", $snapshot["lead_time_days"], PDO::PARAM_INT);
        $stmt->bindValue(":safety_stock_qty", $snapshot["safety_stock_qty"]);
        $stmt->bindValue(":reorder_point_qty", $snapshot["reorder_point_qty"]);
        $stmt->bindValue(":suggested_reorder_qty", $snapshot["suggested_reorder_qty"]);
        $stmt->bindValue(":suggested_production_qty", $snapshot["suggested_production_qty"]);
        $stmt->bindValue(":suggested_allocation_qty", $snapshot["suggested_allocation_qty"]);
        $stmt->bindValue(":days_cover", $snapshot["days_cover"]);
        $stmt->bindValue(":expiry_risk_level", $snapshot["expiry_risk_level"], PDO::PARAM_STR);
        $stmt->bindValue(":risk_notes", $snapshot["risk_notes"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", (string) $user_id, PDO::PARAM_STR);
    }

    private function normalizeSnapshot(array $item): array
    {
        $busunitcode = trim((string) ($item["busunitcode"] ?? ""));
        $invCode = trim((string) ($item["inv_code"] ?? ""));

        if ($busunitcode === "" || $invCode === "") {
            throw new InvalidArgumentException("busunitcodeAndInvCodeRequired");
        }

        $snapshotCode = trim((string) ($item["snapshot_code"] ?? ""));
        if ($snapshotCode === "") {
            $snapshotCode = "IMSPS-" . date("Ymd");
        }

        $referenceDate = trim((string) ($item["reference_date"] ?? ""));
        if ($referenceDate === "") {
            $referenceDate = date("Y-m-d");
        }

        $onHand = $this->normalizeDecimal($item["on_hand_qty"] ?? 0);
        $inTransit = $this->normalizeDecimal($item["in_transit_qty"] ?? 0);
        $allocated = $this->normalizeDecimal($item["allocated_qty"] ?? 0);
        $approvedDemand = $this->normalizeDecimal($item["approved_demand_qty"] ?? 0);
        $historicalDailyAvg = $this->normalizeDecimal($item["historical_daily_avg"] ?? 0);
        $leadTimeDays = max(0, (int) ($item["lead_time_days"] ?? 0));
        $safetyStockQty = $this->normalizeDecimal($item["safety_stock_qty"] ?? 0);

        $availableBalance = round(($onHand + $inTransit) - $allocated, 4);
        $reorderPoint = array_key_exists("reorder_point_qty", $item)
            ? $this->normalizeDecimal($item["reorder_point_qty"])
            : round($historicalDailyAvg * $leadTimeDays, 4);

        $daysCover = array_key_exists("days_cover", $item)
            ? $this->normalizeDecimal($item["days_cover"])
            : ($historicalDailyAvg > 0 ? round($availableBalance / $historicalDailyAvg, 4) : 0.0);

        $suggestedReorder = array_key_exists("suggested_reorder_qty", $item)
            ? $this->normalizeDecimal($item["suggested_reorder_qty"])
            : round(max(0, ($reorderPoint + $safetyStockQty + $approvedDemand) - $availableBalance), 4);

        $suggestedProduction = array_key_exists("suggested_production_qty", $item)
            ? $this->normalizeDecimal($item["suggested_production_qty"])
            : round(max(0, $approvedDemand - max(0, $availableBalance - $safetyStockQty)), 4);

        $suggestedAllocation = array_key_exists("suggested_allocation_qty", $item)
            ? $this->normalizeDecimal($item["suggested_allocation_qty"])
            : round(min(max(0, $availableBalance), max(0, $approvedDemand)), 4);

        $expiryRiskLevel = trim((string) ($item["expiry_risk_level"] ?? ""));
        if ($expiryRiskLevel === "") {
            if ($daysCover <= 0) {
                $expiryRiskLevel = "Critical";
            } elseif ($suggestedReorder > 0 || $suggestedProduction > 0) {
                $expiryRiskLevel = "High";
            } elseif ($leadTimeDays > 0 && $daysCover <= $leadTimeDays) {
                $expiryRiskLevel = "Medium";
            } else {
                $expiryRiskLevel = "Low";
            }
        }

        return [
            "snapshot_code" => $snapshotCode,
            "reference_date" => $referenceDate,
            "busunitcode" => $busunitcode,
            "inv_code" => $invCode,
            "on_hand_qty" => $onHand,
            "in_transit_qty" => $inTransit,
            "allocated_qty" => $allocated,
            "approved_demand_qty" => $approvedDemand,
            "historical_daily_avg" => $historicalDailyAvg,
            "lead_time_days" => $leadTimeDays,
            "safety_stock_qty" => $safetyStockQty,
            "reorder_point_qty" => $reorderPoint,
            "suggested_reorder_qty" => $suggestedReorder,
            "suggested_production_qty" => $suggestedProduction,
            "suggested_allocation_qty" => $suggestedAllocation,
            "days_cover" => $daysCover,
            "expiry_risk_level" => $expiryRiskLevel,
            "risk_notes" => trim((string) ($item["risk_notes"] ?? "")),
        ];
    }

    private function normalizeDecimal($value): float
    {
        if (is_string($value)) {
            $value = str_replace(",", "", trim($value));
        }

        if (!is_numeric($value)) {
            return 0.0;
        }

        return round((float) $value, 4);
    }

    private function normalizeLimit($limit): int
    {
        $normalized = (int) $limit;
        if ($normalized <= 0) {
            return 24;
        }

        return min($normalized, 100);
    }
}
