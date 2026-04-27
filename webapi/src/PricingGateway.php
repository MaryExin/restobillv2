<?php

class PricingGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    /* =========
       Existing
    ========= */
    public function getAllData()
    {
        $sql = "SELECT * FROM lkp_pricing_code
                WHERE deletestatus = 'Active'
                ORDER BY pricing_code ASC";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();

        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $data[] = $row;
        return $data;
    }


    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_pricing_details Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

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

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT tbl_pricing_details.seq, tbl_pricing_details.pricing_code,
            lkp_pricing_code.pricing_code as pricing_category, tbl_pricing_details.inv_code,
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as product_description,
            tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) as level
		         FROM tbl_pricing_details
            LEFT OUTER JOIN lkp_pricing_code ON  tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
            LEFT OUTER JOIN lkp_raw_mats ON  tbl_pricing_details.inv_code = lkp_raw_mats.mat_code
            LEFT OUTER JOIN lkp_build_of_products ON  tbl_pricing_details.inv_code = lkp_build_of_products.build_code
            WHERE tbl_pricing_details.deletestatus = 'Active'
            AND IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) LIKE :search
            ORDER BY
            IF(LEFT(tbl_pricing_details.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) ASC,
            lkp_pricing_code.pricing_code
            LIMIT $pageIndex, $pageData";
        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

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
    /* ==========================================================
       ✅ HISTORY RULE (CORE):
       Before inserting a new price:
       1) If active row for (inv_code + pricing_code) exists:
          - If same cost/srp => Duplicate Entry
          - Else set old active row(s) to Inactive
       2) Insert new Active row
    ========================================================== */
    private function inactivatePreviousActive(string $inv, string $pricing_uuid, string $user_id): void
    {
        $sql = "UPDATE tbl_pricing_details
                SET deletestatus = 'Inactive',
                    -- createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user
                WHERE inv_code = :inv
                  AND pricing_code = :pricing
                  AND deletestatus = 'Active'";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":inv", $inv, PDO::PARAM_STR);
        $stmt->bindValue(":pricing", $pricing_uuid, PDO::PARAM_STR);
        $stmt->bindValue(":user", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function insertNewActive(string $inv, string $pricing_uuid, string $cost, string $srp, string $user_id): void
    {
        $sql = "INSERT INTO tbl_pricing_details
                VALUES (default, :pricing_category, :inv_code, :cost_per_uom, :srp, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":pricing_category", $pricing_uuid, PDO::PARAM_STR);
        $stmt->bindValue(":inv_code", $inv, PDO::PARAM_STR);
        $stmt->bindValue(":cost_per_uom", $cost, PDO::PARAM_STR);
        $stmt->bindValue(":srp", $srp, PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();
    }

    private function getActiveRow(string $inv, string $pricing_uuid): ?array
    {
        $sql = "SELECT seq, cost_per_uom, srp
                FROM tbl_pricing_details
                WHERE inv_code = :inv AND pricing_code = :pricing AND deletestatus = 'Active'
                ORDER BY seq DESC
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":inv", $inv, PDO::PARAM_STR);
        $stmt->bindValue(":pricing", $pricing_uuid, PDO::PARAM_STR);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function createForUser($user_id, $data)
    {
    $inv = trim((string)($data["product"] ?? ""));
        $pricing_uuid = trim((string)($data["pricingcategory"] ?? ""));
        $cost = (string)($data["cost"] ?? "0");
        $srp  = (string)($data["srp"] ?? "0");

        if ($inv === "" || $pricing_uuid === "") {
            http_response_code(422);
            echo json_encode(["message" => "Missing required fields"]);
            return;
        }

        // ✅ check active row if same values
        $active = $this->getActiveRow($inv, $pricing_uuid);
        if ($active) {
            $same = ((string)$active["cost_per_uom"] === (string)$cost) && ((string)$active["srp"] === (string)$srp);
            if ($same) {
                echo json_encode(["message" => "Duplicate Entry"]);
                return;
            }
        }

        try {
            $this->conn->beginTransaction();

            // ✅ inactivate previous Active
            $this->inactivatePreviousActive($inv, $pricing_uuid, (string)$user_id);

            // ✅ insert new Active
            $this->insertNewActive($inv, $pricing_uuid, $cost, $srp, (string)$user_id);

            $this->conn->commit();
            echo json_encode(["message" => "Success"]);
        } catch (Throwable $e) {
            $this->conn->rollBack();
            http_response_code(500);
            echo json_encode(["message" => "Server error", "error" => $e->getMessage()]);
        }
    }

    /**
     * ✅ PATCH edit: now "history write"
     * - optional: inactivate specific seq first
     * - then run same rule (inactivate active + insert new active)
     */
    public function editpricing($user_id, $data)
    {
        $oldSeq = (string)($data["pricingId"] ?? "");
    $inv = trim((string)($data["product"] ?? ""));
        $pricing_uuid = trim((string)($data["pricingCategory"] ?? ""));
        $cost = (string)($data["cost"] ?? "0");
        $srp  = (string)($data["srp"] ?? "0");

        if ($inv === "" || $pricing_uuid === "") {
            http_response_code(422);
            echo json_encode(["message" => "Missing required fields"]);
            return;
        }

        // if current active already same => duplicate
        $active = $this->getActiveRow($inv, $pricing_uuid);
        if ($active) {
            $same = ((string)$active["cost_per_uom"] === (string)$cost) && ((string)$active["srp"] === (string)$srp);
            if ($same) {
                echo json_encode(["message" => "Duplicate Entry"]);
                return;
            }
        }

        try {
            $this->conn->beginTransaction();

            // ✅ mark old seq inactive (safety)
            if ($oldSeq !== "") {
                $sql = "UPDATE tbl_pricing_details
                        SET deletestatus = 'Inactive',
                            -- createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                            usertracker = :user
                        WHERE seq = :id";
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":id", $oldSeq, PDO::PARAM_STR);
                $stmt->bindValue(":user", (string)$user_id, PDO::PARAM_STR);
                $stmt->execute();
            }

            // ✅ inactivate other active rows for same key
            $this->inactivatePreviousActive($inv, $pricing_uuid, (string)$user_id);

            // ✅ insert new active
            $this->insertNewActive($inv, $pricing_uuid, $cost, $srp, (string)$user_id);

            $this->conn->commit();
            echo json_encode(["message" => "Edited"]);
        } catch (Throwable $e) {
            $this->conn->rollBack();
            http_response_code(500);
            echo json_encode(["message" => "Server error", "error" => $e->getMessage()]);
        }
    }

    public function rejectpricing($user_id, $data)
    {
        $sql = "UPDATE tbl_pricing_details
                SET deletestatus = 'Inactive',
                    createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker = :user_tracker
                WHERE seq = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":id", $data["pricingId"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        echo json_encode(["message" => "Deleted"]);
    }

    /* ==========================================================
       ✅ MULTI ADD (BATCH) - used by ModalMultiplePricingUpload
       payload:
         Action=multiadd
         multiproduct: [{product, pricingcategory, cost, srp}, ...]
       behavior:
         for each row: if same as active => skip duplicate
         else inactivate previous active then insert new
    ========================================================== */
    public function createForMultiProduce($user_id, $data): array
    {
        $list = $data["multiproduct"] ?? [];
        if (!is_array($list)) {
            http_response_code(422);
            return ["message" => "Invalid multiproduct payload"];
        }

        $inserted = 0;
        $skipped = 0;
        $errors = [];

        try {
            $this->conn->beginTransaction();

            foreach ($list as $i => $row) {
               $inv = trim((string)($row["product"] ?? ""));
                $pricing_uuid = trim((string)($row["pricingcategory"] ?? ""));
                $cost = (string)($row["cost"] ?? "0");
                $srp  = (string)($row["srp"] ?? "0");

                if ($inv === "" || $pricing_uuid === "") {
                    $errors[] = ["index" => $i, "message" => "Missing product/pricingcategory"];
                    continue;
                }

                $active = $this->getActiveRow($inv, $pricing_uuid);
                if ($active) {
                    $same = ((string)$active["cost_per_uom"] === (string)$cost) && ((string)$active["srp"] === (string)$srp);
                    if ($same) {
                        $skipped++;
                        continue;
                    }
                }

                // history write
                $this->inactivatePreviousActive($inv, $pricing_uuid, (string)$user_id);
                $this->insertNewActive($inv, $pricing_uuid, $cost, $srp, (string)$user_id);
                $inserted++;
            }

            $this->conn->commit();

            return [
                "message" => "Batch success",
                "inserted" => $inserted,
                "skipped_duplicate" => $skipped,
                "errors" => $errors,
            ];
        } catch (Throwable $e) {
            $this->conn->rollBack();
            http_response_code(500);
            return ["message" => "Server error", "error" => $e->getMessage()];
        }
    }

    /* ==========================================================
       ✅ ANALYTICS (GET Action=analytics)
       Query params:
         type=ALL|RM|BD
         pricing_uuid=ALL|<uuid>
         inv_code=<code optional>
         days=7/30/90/...
    ========================================================== */
    public function getAnalytics(array $q): array
    {
        $type = strtoupper(trim((string)($q["type"] ?? "ALL")));
        $pricing_uuid = trim((string)($q["pricing_uuid"] ?? "ALL"));
        $inv_code = strtoupper(trim((string)($q["inv_code"] ?? "")));
        $days = (int)($q["days"] ?? 90);
        if ($days <= 0) $days = 90;

        $where = [];
        $params = [];

        // time window
        $where[] = "tbl_pricing_details.createdtime >= DATE_ADD(DATE_ADD(NOW(), INTERVAL 8 HOUR), INTERVAL -:days DAY)";
        $params[":days"] = $days;

        if ($type === "RM") {
            $where[] = "LEFT(tbl_pricing_details.inv_code,2) = 'RM'";
        } elseif ($type === "BD") {
            $where[] = "LEFT(tbl_pricing_details.inv_code,2) = 'BD'";
        }

        if ($pricing_uuid !== "" && $pricing_uuid !== "ALL") {
            $where[] = "tbl_pricing_details.pricing_code = :pricing";
            $params[":pricing"] = $pricing_uuid;
        }

        if ($inv_code !== "") {
            $where[] = "tbl_pricing_details.inv_code = :inv";
            $params[":inv"] = $inv_code;
        }

        $whereSql = $where ? ("WHERE " . implode(" AND ", $where)) : "";

        // KPI
        $sqlKpi = "SELECT
            COUNT(*) as total_changes,
            COUNT(DISTINCT tbl_pricing_details.inv_code) as distinct_products,
            AVG(tbl_pricing_details.srp) as avg_srp,
            AVG(tbl_pricing_details.cost_per_uom) as avg_cost
          FROM tbl_pricing_details
          $whereSql";
        $stmt = $this->conn->prepare($sqlKpi);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_INT);
        if (isset($params[":pricing"])) $stmt->bindValue(":pricing", $params[":pricing"], PDO::PARAM_STR);
        if (isset($params[":inv"])) $stmt->bindValue(":inv", $params[":inv"], PDO::PARAM_STR);
        $stmt->execute();
        $kpi = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        // Series (daily)
        $sqlSeries = "SELECT
            DATE(tbl_pricing_details.createdtime) as day,
            COUNT(*) as changes,
            AVG(tbl_pricing_details.srp) as avg_srp,
            AVG(tbl_pricing_details.cost_per_uom) as avg_cost
          FROM tbl_pricing_details
          $whereSql
          GROUP BY DATE(tbl_pricing_details.createdtime)
          ORDER BY day ASC";
        $stmt = $this->conn->prepare($sqlSeries);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_INT);
        if (isset($params[":pricing"])) $stmt->bindValue(":pricing", $params[":pricing"], PDO::PARAM_STR);
        if (isset($params[":inv"])) $stmt->bindValue(":inv", $params[":inv"], PDO::PARAM_STR);
        $stmt->execute();
        $series = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // By Pricing
        $sqlByPricing = "SELECT
            tbl_pricing_details.pricing_code,
            lkp_pricing_code.pricing_code as pricing_label,
            COUNT(*) as changes
          FROM tbl_pricing_details
          LEFT JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
          $whereSql
          GROUP BY tbl_pricing_details.pricing_code, lkp_pricing_code.pricing_code
          ORDER BY changes DESC
          LIMIT 20";
        $stmt = $this->conn->prepare($sqlByPricing);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_INT);
        if (isset($params[":pricing"])) $stmt->bindValue(":pricing", $params[":pricing"], PDO::PARAM_STR);
        if (isset($params[":inv"])) $stmt->bindValue(":inv", $params[":inv"], PDO::PARAM_STR);
        $stmt->execute();
        $byPricing = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // By Product
        $sqlByProduct = "SELECT
            tbl_pricing_details.inv_code,
            IF(LEFT(tbl_pricing_details.inv_code,2)='RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as product_description,
            COUNT(*) as changes
          FROM tbl_pricing_details
          LEFT JOIN lkp_raw_mats ON tbl_pricing_details.inv_code = lkp_raw_mats.mat_code
          LEFT JOIN lkp_build_of_products ON tbl_pricing_details.inv_code = lkp_build_of_products.build_code
          $whereSql
          GROUP BY tbl_pricing_details.inv_code, product_description
          ORDER BY changes DESC
          LIMIT 50";
        $stmt = $this->conn->prepare($sqlByProduct);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_INT);
        if (isset($params[":pricing"])) $stmt->bindValue(":pricing", $params[":pricing"], PDO::PARAM_STR);
        if (isset($params[":inv"])) $stmt->bindValue(":inv", $params[":inv"], PDO::PARAM_STR);
        $stmt->execute();
        $byProduct = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Recent events
        $sqlRecent = "SELECT
            tbl_pricing_details.seq,
            tbl_pricing_details.inv_code,
            tbl_pricing_details.pricing_code,
            lkp_pricing_code.pricing_code as pricing_label,
            IF(LEFT(tbl_pricing_details.inv_code,2)='RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as product_description,
            tbl_pricing_details.cost_per_uom,
            tbl_pricing_details.srp,
            tbl_pricing_details.createdtime
          FROM tbl_pricing_details
          LEFT JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid
          LEFT JOIN lkp_raw_mats ON tbl_pricing_details.inv_code = lkp_raw_mats.mat_code
          LEFT JOIN lkp_build_of_products ON tbl_pricing_details.inv_code = lkp_build_of_products.build_code
          $whereSql
          ORDER BY tbl_pricing_details.createdtime DESC
          LIMIT 50";
        $stmt = $this->conn->prepare($sqlRecent);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_INT);
        if (isset($params[":pricing"])) $stmt->bindValue(":pricing", $params[":pricing"], PDO::PARAM_STR);
        if (isset($params[":inv"])) $stmt->bindValue(":inv", $params[":inv"], PDO::PARAM_STR);
        $stmt->execute();
        $recent = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            "kpi" => $kpi,
            "series" => $series,
            "byPricing" => $byPricing,
            "byProduct" => $byProduct,
            "recent" => $recent,
        ];
    }

    /* optional placeholder (not used in your setup but kept for compatibility) */
    public function deleteForUser($user_id, $data) { echo json_encode(["message"=>"Not implemented"]); }
}
