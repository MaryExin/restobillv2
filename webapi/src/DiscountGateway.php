<?php

class DiscountGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    /* =========================================================
       ✅ NEW HELPERS (ChartType → lkp_chart_of_accounts sync)
       ========================================================= */

    /**
     * charttypedata can be:
     *  - array: ["CT-xxx", "CT-yyy"]
     *  - json string: '["CT-xxx","CT-yyy"]'
     *  - csv string: "CT-xxx,CT-yyy"
     */
    private function normalizeChartTypeIds($charttypedata): array
    {
        if (is_array($charttypedata)) {
            return array_values(array_filter(array_map("trim", $charttypedata)));
        }

        if (is_string($charttypedata)) {
            $s = trim($charttypedata);

            // JSON array/object?
            if ($s !== "" && ($s[0] === "[" || $s[0] === "{")) {
                $decoded = json_decode($s, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    // indexed array
                    if (array_keys($decoded) === range(0, count($decoded) - 1)) {
                        return array_values(array_filter(array_map("trim", $decoded)));
                    }
                    // object → values
                    return array_values(array_filter(array_map("trim", array_values($decoded))));
                }
            }

            // Comma-separated fallback
            $parts = array_map("trim", explode(",", $s));
            return array_values(array_filter($parts));
        }

        return [];
    }

    /**
     * Optional: fetch GL description from your GL master table.
     * If your GL table name/columns differ, update this query.
     */
    private function resolveGLDescription(string $glcode): string
    {
        try {
            // ✅ Change if your GL master table differs
            $sql = "SELECT gldescription FROM lkp_glcodes WHERE glcode = :glcode LIMIT 1";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
            $stmt->execute();
            $desc = $stmt->fetchColumn();
            if ($desc) return (string) $desc;
        } catch (Exception $e) {
            // ignore and fallback
        }

        return "GL " . $glcode;
    }

    /**
     * Inserts/syncs chart-of-accounts mapping rows:
     * - Inserts missing Active rows for provided chart types
     * - Optionally inactivates removed chart types (edit)
     *
     * lkp_chart_of_accounts columns from your snapshot:
     * seq, chart_type_id, glcode, gl_description, slcode, sl_description,
     * deletestatus, usertracker, createdtime
     */
    private function syncChartOfAccountsRows(
        string $user_id,
        array $chartTypeIds,
        string $glcode,
        string $slcode,
        string $sl_description,
        ?string $gl_description = null,
        bool $inactivateRemoved = false
    ): void {
        $chartTypeIds = array_values(array_unique(array_filter(array_map("trim", $chartTypeIds))));
        if (empty($chartTypeIds)) return;

        $gl_description = $gl_description ?: $this->resolveGLDescription($glcode);

        // 1) Insert missing rows
        $existsSql = "SELECT COUNT(*) FROM lkp_chart_of_accounts
                      WHERE chart_type_id = :chart_type_id
                        AND glcode = :glcode
                        AND slcode = :slcode
                        AND deletestatus = 'Active'";
        $existsStmt = $this->conn->prepare($existsSql);

        $insertSql = "INSERT INTO lkp_chart_of_accounts ()
                      VALUES (
                        default,
                        :chart_type_id,
                        :glcode,
                        :gl_description,
                        :slcode,
                        :sl_description,
                        'Active',
                        :usertracker,
                        DATE_ADD(NOW(), INTERVAL 8 HOUR)
                      )";
        $insertStmt = $this->conn->prepare($insertSql);

        foreach ($chartTypeIds as $ctid) {
            $existsStmt->bindValue(":chart_type_id", $ctid, PDO::PARAM_STR);
            $existsStmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
            $existsStmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
            $existsStmt->execute();
            $count = (int) $existsStmt->fetchColumn();

            if ($count <= 0) {
                $insertStmt->bindValue(":chart_type_id", $ctid, PDO::PARAM_STR);
                $insertStmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
                $insertStmt->bindValue(":gl_description", $gl_description, PDO::PARAM_STR);
                $insertStmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
                $insertStmt->bindValue(":sl_description", $sl_description, PDO::PARAM_STR);
                $insertStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
                $insertStmt->execute();
            }
        }

        // 2) Inactivate removed chart types (optional, for edit)
        if ($inactivateRemoved) {
            $placeholders = [];
            $params = [];
            foreach ($chartTypeIds as $i => $ctid) {
                $ph = ":ct" . $i;
                $placeholders[] = $ph;
                $params[$ph] = $ctid;
            }

            $inactSql = "UPDATE lkp_chart_of_accounts
                         SET deletestatus = 'Inactive',
                             usertracker  = :usertracker
                         WHERE slcode = :slcode
                           AND glcode = :glcode
                           AND deletestatus = 'Active'
                           AND chart_type_id NOT IN (" . implode(",", $placeholders) . ")";
            $inactStmt = $this->conn->prepare($inactSql);
            $inactStmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $inactStmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
            $inactStmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
            foreach ($params as $k => $v) {
                $inactStmt->bindValue($k, $v, PDO::PARAM_STR);
            }
            $inactStmt->execute();
        }
    }

    /* =========================================================
       EXISTING METHODS (yours) + UPDATED create/edit
       ========================================================= */

    public function getAllData()
    {
        try {
            $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' ORDER BY seq";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();

            $data = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $data[] = $row;
            }

            return $data;
        } catch (Exception $e) {
            echo json_encode(["message" => "Registration error"]);
            exit;
        }
    }

    public function getbyPageData($pageIndex, $pageData)
    {
        $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data[] = $row;
        }

        return $data;
    }

    public function getForUser($user_id, $id): array
    {
        $sql = "SELECT *
                FROM tbl_tasks
                WHERE id = :id
                AND user_id = :user_id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $id, PDO::PARAM_INT);
        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);
        $stmt->execute();

        $data = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($data !== false) {
            $data['is_completed'] = (bool) $data['is_completed'];
        }

        return $data;
    }

    /**
     * ✅ UPDATED: createForUser now ALSO inserts per charttypedata into lkp_chart_of_accounts
     */
    public function createForUser($user_id, $data)
    {
        $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_discounts WHERE description = :descriptions && deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":descriptions", $data["description"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = (int) $checkforduplistmt->fetchColumn();

        if ($rowCount > 0) {
            echo json_encode(["message" => "Duplicate Entry"]);
            return;
        }

        // Your discount logic uses GL 704
        $glcode = "704";

        try {
            $this->conn->beginTransaction();

            // --- SL creation (kept same style, just safer with transaction) ---
            $sql = "INSERT INTO lkp_slcodes () VALUES (CONCAT('SL-', ShortUUID()), :glcodes, :slcodes, :sldescs, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
            $stmt = $this->conn->prepare($sql);

            $generateidsql = "SELECT COUNT(*) as count FROM lkp_slcodes WHERE glcode = :glcodes";
            $generateidstmt = $this->conn->prepare($generateidsql);
            $generateidstmt->bindValue(":glcodes", $glcode, PDO::PARAM_STR);
            $generateidstmt->execute();
            $rowCount = (int) $generateidstmt->fetchColumn();

            $uniqueNumber = $rowCount + 1;
            $slcode = $glcode . sprintf("%03d", $uniqueNumber);

            $stmt->bindValue(":glcodes", $glcode, PDO::PARAM_STR);
            $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
            $stmt->bindValue(":sldescs", $data["description"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            // --- Discount insert (your original) ---
            $sql = "INSERT INTO lkp_discounts ()
                    VALUES (default, CONCAT('DC-',ShortUUID()),:descriptions,:Amounts,:taxtypes,:discounttypess,:busiunits,:buildcodes, :slcode, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":discounttypess", $data["discounttypes"], PDO::PARAM_STR);
            $stmt->bindValue(":descriptions", $data["description"], PDO::PARAM_STR);
            $stmt->bindValue(":Amounts", $data["Amount"], PDO::PARAM_STR);
            $stmt->bindValue(":taxtypes", $data["taxtype"], PDO::PARAM_STR);
            $stmt->bindValue(":busiunits", $data["busiunit"], PDO::PARAM_STR);
            $stmt->bindValue(":buildcodes", $data["buildcode"], PDO::PARAM_STR);
            $stmt->bindValue(":slcode", $slcode, PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            // ✅ NEW: lkp_chart_of_accounts rows per charttypedata
            $chartTypeIds = $this->normalizeChartTypeIds($data["charttypedata"] ?? []);
            $this->syncChartOfAccountsRows(
                (string) $user_id,
                $chartTypeIds,
                $glcode,
                $slcode,
                $data["description"],
                null,
                false
            );

            $this->conn->commit();
            echo json_encode(["message" => "Success"]);
        } catch (Exception $e) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Error", "error" => $e->getMessage()]);
        }
    }

    public function rejectdiscounts($user_id, string $id)
    {
        $sql = "UPDATE lkp_discounts
                SET
                    deletestatus = 'Inactive',
                    usertracker  = :usertracker
                WHERE
                    discount_type_id   = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $id, PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        echo json_encode(["message" => "Deleted"]);
    }

    /**
     * ✅ UPDATED: editdiscount now ALSO syncs charttypedata to lkp_chart_of_accounts
     * - inserts missing
     * - inactivates removed for the same slcode+glcode
     */
    public function editdiscount($user_id, $id)
    {
        $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_discounts WHERE description = :descriptions && 
                    type  = :type &&
                    value  = :value &&
                    tax_type  = :tax_type &&
                    busunitcode  = :busunitcode &&
                    build_code  = :buildcodes &&
                    slcode = :slcode &&
                    deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":descriptions", $id["description"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":type", $id["discounttypes"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":value", $id["Amount"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":tax_type", $id["taxtype"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":busunitcode", $id["busiunit"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":buildcodes", $id["buildcode"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":slcode", $id["slcode"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = (int) $checkforduplistmt->fetchColumn();

        if ($rowCount > 0) {
            echo json_encode(["message" => "Duplicate Entry"]);
            return;
        }

        $glcode = "704";

        try {
            $this->conn->beginTransaction();

            $sql = "UPDATE lkp_discounts
                    SET
                        type  = :type,
                        description  = :description,
                        value  = :value,
                        tax_type  = :tax_type,
                        busunitcode  = :busunitcode,
                        build_code  = :buildcodes,
                        slcode = :slcode,
                        usertracker  = :usertracker
                    WHERE
                        discount_type_id   = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id["discount_code"], PDO::PARAM_STR);
            $stmt->bindValue(":type", $id["discounttypes"], PDO::PARAM_STR);
            $stmt->bindValue(":description", $id["description"], PDO::PARAM_STR);
            $stmt->bindValue(":value", $id["Amount"], PDO::PARAM_STR);
            $stmt->bindValue(":tax_type", $id["taxtype"], PDO::PARAM_STR);
            $stmt->bindValue(":busunitcode", $id["busiunit"], PDO::PARAM_STR);
            $stmt->bindValue(":buildcodes", $id["buildcode"], PDO::PARAM_STR);
            $stmt->bindValue(":slcode", $id["slcode"], PDO::PARAM_STR);
            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            // ✅ NEW: sync chart-of-accounts mapping
            $chartTypeIds = $this->normalizeChartTypeIds($id["charttypedata"] ?? []);
            $this->syncChartOfAccountsRows(
                (string) $user_id,
                $chartTypeIds,
                $glcode,
                $id["slcode"],
                $id["description"],
                null,
                true // inactivate removed chart types
            );

            $this->conn->commit();
            echo json_encode(["message" => "Edited"]);
        } catch (Exception $e) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Error", "error" => $e->getMessage()]);
        }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {
        // NOTE: your original code bound :search but didn't use it.
        // Keeping your paging behavior; optional enhancement is to add LIKE filter.
        $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";
        $stmt = $this->conn->prepare($sql);

        // kept as-is (no :search in query)
        // $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

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

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {
        $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' AND description  LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";
        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
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

    public function getClearingData()
    {
        // Your original had LIMIT $pageIndex, $pageData but those vars were undefined.
        // Keeping intended behavior: return all Active, ordered by seq.
        $sql = "SELECT * FROM lkp_discounts Where deletestatus = 'Active' ORDER BY seq";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data[] = $row;
        }

        return $data;
    }

    public function updateForUser(int $user_id, string $id, array $data): int
    {
        $fields = [];

        if (!empty($data["name"])) {
            $fields["name"] = [
                $data["name"],
                PDO::PARAM_STR,
            ];
        }

        if (array_key_exists("priority", $data)) {
            $fields["priority"] = [
                $data["priority"],
                $data["priority"] === null ? PDO::PARAM_NULL : PDO::PARAM_INT,
            ];
        }

        if (array_key_exists("is_completed", $data)) {
            $fields["is_completed"] = [
                $data["is_completed"],
                PDO::PARAM_BOOL,
            ];
        }

        if (empty($fields)) {
            return 0;
        } else {
            $sets = array_map(function ($value) {
                return "$value = :$value";
            }, array_keys($fields));

            $sql = "UPDATE tbl_tasks"
                . " SET " . implode(", ", $sets)
                . " WHERE id = :id"
                . " AND user_id = :user_id";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":id", $id, PDO::PARAM_INT);
            $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);

            foreach ($fields as $name => $values) {
                $stmt->bindValue(":$name", $values[0], $values[1]);
            }

            $stmt->execute();
            return $stmt->rowCount();
        }
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
}
