<?php

class PricingBySalesTypePerBUGateway
{
    private \PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function readAssignments(): array
    {
        try {
            $sql = <<<SQL
                SELECT
                    m.seq,
                    m.busunitcode,
                    b.name AS busunit_name,
                    b.class AS busunit_class,
                    b.address,
                    b.brandcode,
                    b.corpcode,
                    b.areacode,
                    s.sales_type_id,
                    s.description AS sales_type_desc,
                    p.uuid AS pricing_category,
                    p.pricing_code AS pricing_desc,
                    m.deletestatus,
                    m.usertracker,
                    m.createdtime
                FROM tbl_pricing_by_sales_type_per_bu m
                INNER JOIN lkp_busunits b
                    ON b.busunitcode = m.busunitcode
                INNER JOIN lkp_sales_type s
                    ON s.sales_type_id = m.sales_type_id
                INNER JOIN lkp_pricing_code p
                    ON p.uuid = m.pricing_category
                WHERE m.deletestatus = 'Active'
                  AND b.deletestatus = 'Active'
                ORDER BY b.name ASC, s.description ASC
            SQL;

            $stmt = $this->conn->prepare($sql);
            $stmt->execute();

            return $stmt->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            http_response_code(500);
            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    public function saveAssignments(array $data, $userId): array
    {
        try {
            $busunitcodes = $this->normalizeArray($data['busunitcodes'] ?? []);
            $assignments  = $data['assignments'] ?? [];

            if (count($busunitcodes) === 0) {
                return ['message' => 'No busunits selected'];
            }

            if (!is_array($assignments) || count($assignments) === 0) {
                return ['message' => 'No assignments provided'];
            }

            $cleanAssignments = $this->normalizeAssignments($assignments);

            if (count($cleanAssignments) === 0) {
                return ['message' => 'No valid assignments provided'];
            }

            /** sales type is the main basis in one batch */
            $seenSalesType = [];
            foreach ($cleanAssignments as $row) {
                $salesTypeId = $row['sales_type_id'];
                if (isset($seenSalesType[$salesTypeId])) {
                    return [
                        'message' => 'Duplicate Sales Type in request',
                        'sales_type_id' => $salesTypeId,
                    ];
                }
                $seenSalesType[$salesTypeId] = true;
            }

            $this->conn->beginTransaction();

            $inserted = 0;
            $updated = 0;

            $checkSalesTypeStmt = $this->conn->prepare("
                SELECT sales_type_id
                FROM lkp_sales_type
                WHERE sales_type_id = :sales_type_id
                  AND deletestatus = 'Active'
                LIMIT 1
            ");

            $checkPricingStmt = $this->conn->prepare("
                SELECT uuid
                FROM lkp_pricing_code
                WHERE uuid = :pricing_category
                  AND deletestatus = 'Active'
                LIMIT 1
            ");

            $checkBusunitStmt = $this->conn->prepare("
                SELECT busunitcode
                FROM lkp_busunits
                WHERE busunitcode = :busunitcode
                  AND deletestatus = 'Active'
                LIMIT 1
            ");

            /** if same busunit + sales_type already exists, update existing */
            $existingStmt = $this->conn->prepare("
                SELECT seq
                FROM tbl_pricing_by_sales_type_per_bu
                WHERE busunitcode = :busunitcode
                  AND sales_type_id = :sales_type_id
                ORDER BY seq DESC
            ");

            /** update all matching old records so duplicates don't stay inconsistent */
            $updateStmt = $this->conn->prepare("
                UPDATE tbl_pricing_by_sales_type_per_bu
                SET pricing_category = :pricing_category,
                    deletestatus = 'Active',
                    usertracker = :usertracker,
                    createdtime = NOW()
                WHERE busunitcode = :busunitcode
                  AND sales_type_id = :sales_type_id
            ");

            $insertStmt = $this->conn->prepare("
                INSERT INTO tbl_pricing_by_sales_type_per_bu
                    (busunitcode, sales_type_id, pricing_category, deletestatus, usertracker, createdtime)
                VALUES
                    (:busunitcode, :sales_type_id, :pricing_category, 'Active', :usertracker, NOW())
            ");

            foreach ($busunitcodes as $busunitcode) {
                /** validate busunit */
                $checkBusunitStmt->bindValue(':busunitcode', $busunitcode, \PDO::PARAM_STR);
                $checkBusunitStmt->execute();
                if (!$checkBusunitStmt->fetchColumn()) {
                    continue;
                }

                foreach ($cleanAssignments as $row) {
                    $salesTypeId = $row['sales_type_id'];
                    $pricingCategory = $row['pricing_category'];

                    /** validate sales type */
                    $checkSalesTypeStmt->bindValue(':sales_type_id', $salesTypeId, \PDO::PARAM_STR);
                    $checkSalesTypeStmt->execute();
                    if (!$checkSalesTypeStmt->fetchColumn()) {
                        continue;
                    }

                    /** validate pricing */
                    $checkPricingStmt->bindValue(':pricing_category', $pricingCategory, \PDO::PARAM_STR);
                    $checkPricingStmt->execute();
                    if (!$checkPricingStmt->fetchColumn()) {
                        continue;
                    }

                    /** check existing */
                    $existingStmt->bindValue(':busunitcode', $busunitcode, \PDO::PARAM_STR);
                    $existingStmt->bindValue(':sales_type_id', $salesTypeId, \PDO::PARAM_STR);
                    $existingStmt->execute();
                    $existingRows = $existingStmt->fetchAll(\PDO::FETCH_ASSOC);

                    if (count($existingRows) > 0) {
                        $updateStmt->bindValue(':pricing_category', $pricingCategory, \PDO::PARAM_STR);
                        $updateStmt->bindValue(':usertracker', (string)$userId, \PDO::PARAM_STR);
                        $updateStmt->bindValue(':busunitcode', $busunitcode, \PDO::PARAM_STR);
                        $updateStmt->bindValue(':sales_type_id', $salesTypeId, \PDO::PARAM_STR);
                        $updateStmt->execute();

                        $updated++;
                    } else {
                        $insertStmt->bindValue(':busunitcode', $busunitcode, \PDO::PARAM_STR);
                        $insertStmt->bindValue(':sales_type_id', $salesTypeId, \PDO::PARAM_STR);
                        $insertStmt->bindValue(':pricing_category', $pricingCategory, \PDO::PARAM_STR);
                        $insertStmt->bindValue(':usertracker', (string)$userId, \PDO::PARAM_STR);
                        $insertStmt->execute();

                        $inserted++;
                    }
                }
            }

            $this->conn->commit();

            return [
                'message' => 'Success',
                'inserted' => $inserted,
                'updated' => $updated,
                'affected_rows' => $inserted + $updated,
            ];
        } catch (\Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }

            http_response_code(500);

            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function normalizeArray($arr): array
    {
        if (!is_array($arr)) {
            return [];
        }

        $out = [];
        foreach ($arr as $value) {
            $v = trim((string)$value);
            if ($v !== '') {
                $out[$v] = $v;
            }
        }

        return array_values($out);
    }

    private function normalizeAssignments(array $assignments): array
    {
        $out = [];

        foreach ($assignments as $row) {
            if (!is_array($row)) {
                continue;
            }

            $salesTypeId = trim((string)($row['sales_type_id'] ?? ''));
            $pricingCategory = trim((string)($row['pricing_category'] ?? ''));

            if ($salesTypeId === '' || $pricingCategory === '') {
                continue;
            }

            $out[] = [
                'sales_type_id' => $salesTypeId,
                'pricing_category' => $pricingCategory,
            ];
        }

        return $out;
    }
}