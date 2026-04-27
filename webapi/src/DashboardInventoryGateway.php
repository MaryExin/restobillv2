<?php
// DashboardInventoryGateway.php
declare(strict_types=1);

class DashboardInventoryGateway
{


    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    /* -------------------------------------------------------
       ✅ PERPETUAL STOCK SNAPSHOT (AS-OF ONLY)
       - Computes ending_balance and total_value from BEGINNING OF TIME up to :dateto
       - Supports busunitcode and areacode filters
       ------------------------------------------------------- */
    private function getStockSnapshotSqlAsOf(): string
    {
        return "
            SELECT
                MAX(x.trans_date) AS last_trans_date,
                IF(x.parent_level = x.level AND x.parent_inv <> '', x.parent_inv, x.inv_code) AS inv_code,
                IF(LEFT(x.inv_code,2) = 'RM', rm.desc, bp.desc) AS `desc`,
                IF(LEFT(x.inv_code,2) = 'RM', rm.category, bp.category) AS category,
                ROUND(SUM(
                    CASE
                        WHEN x.pr_queue_code != 'Physical' THEN x.qty * x.uom_val
                        ELSE 0
                    END
                ), 2) AS ending_balance,
                ROUND(SUM(
                    CASE
                        WHEN x.pr_queue_code != 'Physical' THEN x.qty * x.cost_per_uom
                        ELSE 0
                    END
                ), 2) AS total_value,
                IFNULL(sl.min_stock_level, 0) AS reorder_level,
                x.busunitcode,
                x.areacode
            FROM
            (
                SELECT
                    t.trans_date,
                    t.inv_code,
                    IF(LEFT(t.inv_code,2)='RM', rm0.rawmats_parent, bp0.portion_parent) AS parent_inv,
                    IF(LEFT(t.inv_code,2)='RM', rm0.level, bp0.level) AS parent_level,
                    t.qty,
                    t.cost_per_uom,
                    t.uom_val,
                    t.uom,
                    t.pr_queue_code,
                    t.busunitcode,
                    bu.areacode,
                    bu.class AS level
                FROM tbl_inventory_transactions t
                LEFT JOIN lkp_raw_mats rm0 ON t.inv_code = rm0.mat_code
                LEFT JOIN lkp_build_of_products bp0 ON t.inv_code = bp0.build_code
                LEFT JOIN lkp_busunits bu ON t.busunitcode = bu.busunitcode
                WHERE t.deletestatus = 'Active'
                  AND bu.name IS NOT NULL
            ) x
            LEFT JOIN lkp_raw_mats rm ON x.inv_code = rm.mat_code
            LEFT JOIN lkp_build_of_products bp ON x.inv_code = bp.build_code
            LEFT JOIN lkp_stock_levels sl
                ON x.inv_code = sl.inv_code
                AND x.busunitcode = sl.level
            WHERE x.busunitcode LIKE :busunitcode
              AND x.areacode LIKE :areacode
              AND x.trans_date <= :dateto
            GROUP BY
                x.busunitcode,
                x.areacode,
                IF(x.parent_level = x.level AND x.parent_inv <> '', x.parent_inv, x.inv_code)
        ";
    }

    /* -------------------------------------------------------
       ✅ Common binders
       ------------------------------------------------------- */
    private function bindAsOf(PDOStatement $stmt, array $data): void
    {
        $bus = (string)($data["busunitcode"] ?? "");
        $area = (string)($data["areacode"] ?? "");
        $dateto = (string)($data["dateto"] ?? "");

        $stmt->bindValue(":busunitcode", "%" . $bus . "%", PDO::PARAM_STR);
        $stmt->bindValue(":areacode", "%" . $area . "%", PDO::PARAM_STR);
        $stmt->bindValue(":dateto", $dateto, PDO::PARAM_STR);
    }

    private function bindRange(PDOStatement $stmt, array $data): void
    {
        $bus = (string)($data["busunitcode"] ?? "");
        $area = (string)($data["areacode"] ?? "");
        $dateto = (string)($data["dateto"] ?? "");
        $datefrom = (string)($data["datefrom"] ?? "");

        $stmt->bindValue(":busunitcode", "%" . $bus . "%", PDO::PARAM_STR);
        $stmt->bindValue(":areacode", "%" . $area . "%", PDO::PARAM_STR);
        $stmt->bindValue(":dateto", $dateto, PDO::PARAM_STR);
        $stmt->bindValue(":datefrom", $datefrom, PDO::PARAM_STR);
    }

    private function fetchAll(PDOStatement $stmt): array
    {
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /* -------------------------------------------------------
       ✅ SNAPSHOT ENDPOINTS (AS-OF)
       ------------------------------------------------------- */

    public function getInvSummaryAsOf(array $data): array
    {
        try {
            $snapshot = $this->getStockSnapshotSqlAsOf();

            $sql = "
                SELECT
                    COUNT(*) AS total_skus,
                    ROUND(SUM(s.ending_balance), 2) AS total_qty,
                    ROUND(SUM(s.total_value), 2) AS total_value,
                    SUM(CASE WHEN s.ending_balance > 0 AND s.ending_balance <= s.reorder_level THEN 1 ELSE 0 END) AS low_stock_count,
                    SUM(CASE WHEN s.ending_balance <= 0 THEN 1 ELSE 0 END) AS out_of_stock_count
                FROM ( $snapshot ) s
            ";

            $stmt = $this->conn->prepare($sql);
            $this->bindAsOf($stmt, $data);

            return $this->fetchAll($stmt);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }

 public function getLowStockAsOf(array $data): array
{
    try {
        // ✅ Snapshot SQL (AS-OF)
        // IMPORTANT FIXES:
        // 1) stock levels must be Active only
        // 2) reorder_level must be > 0 for LOWSTOCK report
        $snapshot = "
            SELECT
                MAX(x.trans_date) AS last_trans_date,
                IF(x.parent_level = x.level AND x.parent_inv <> '', x.parent_inv, x.inv_code) AS inv_code,
                IF(LEFT(x.inv_code,2) = 'RM', rm.desc, bp.desc) AS `desc`,
                IF(LEFT(x.inv_code,2) = 'RM', rm.category, bp.category) AS category,
                ROUND(SUM(
                    CASE
                        WHEN x.pr_queue_code != 'Physical' THEN x.qty * x.uom_val
                        ELSE 0
                    END
                ), 2) AS ending_balance,
                ROUND(SUM(
                    CASE
                        WHEN x.pr_queue_code != 'Physical' THEN x.qty * x.cost_per_uom
                        ELSE 0
                    END
                ), 2) AS total_value,
                IFNULL(sl.min_stock_level, 0) AS reorder_level,
                x.busunitcode,
                x.areacode
            FROM
            (
                SELECT
                    t.trans_date,
                    t.inv_code,
                    IF(LEFT(t.inv_code,2)='RM', rm0.rawmats_parent, bp0.portion_parent) AS parent_inv,
                    IF(LEFT(t.inv_code,2)='RM', rm0.level, bp0.level) AS parent_level,
                    t.qty,
                    t.cost_per_uom,
                    t.uom_val,
                    t.uom,
                    t.pr_queue_code,
                    t.busunitcode,
                    bu.areacode,
                    bu.class AS level
                FROM tbl_inventory_transactions t
                LEFT JOIN lkp_raw_mats rm0 ON t.inv_code = rm0.mat_code
                LEFT JOIN lkp_build_of_products bp0 ON t.inv_code = bp0.build_code
                LEFT JOIN lkp_busunits bu ON t.busunitcode = bu.busunitcode
                WHERE t.deletestatus = 'Active'
                  AND bu.name IS NOT NULL
            ) x
            LEFT JOIN lkp_raw_mats rm ON x.inv_code = rm.mat_code
            LEFT JOIN lkp_build_of_products bp ON x.inv_code = bp.build_code

            -- ✅ FIX #1: use Active stock levels only
            LEFT JOIN lkp_stock_levels sl
                ON x.inv_code = sl.inv_code
                AND x.busunitcode = sl.level
                AND sl.deletestatus = 'Active'

            WHERE x.busunitcode LIKE :busunitcode
              AND x.areacode LIKE :areacode
              AND x.trans_date <= :dateto
            GROUP BY
                x.busunitcode,
                x.areacode,
                IF(x.parent_level = x.level AND x.parent_inv <> '', x.parent_inv, x.inv_code)
        ";

        // ✅ Low stock list based on snapshot
        $sql = "
            SELECT
                s.inv_code,
                s.`desc`,
                s.category,
                s.ending_balance,
                s.reorder_level,

                CASE
                    WHEN s.ending_balance <= 0 THEN 'OUT OF STOCK'
                    WHEN s.ending_balance <= s.reorder_level THEN 'REORDER'
                    ELSE 'OK'
                END AS status,

                s.last_trans_date
            FROM ( $snapshot ) s
            WHERE s.reorder_level > 0            -- ✅ FIX #2: must have a valid reorder level
              AND s.ending_balance > 0
              AND s.ending_balance <= s.reorder_level
            ORDER BY
                (CASE
                    WHEN s.reorder_level = 0 THEN 999999
                    ELSE (s.ending_balance / s.reorder_level)
                 END) ASC,
                s.ending_balance ASC
            LIMIT 2000
        ";

        $stmt = $this->conn->prepare($sql);
        $this->bindAsOf($stmt, $data);

        return $this->fetchAll($stmt);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["message" => $e->getMessage()]);
        exit;
    }
}


    public function getOutOfStockAsOf(array $data): array
    {
        try {
            $snapshot = $this->getStockSnapshotSqlAsOf();

            $sql = "
                SELECT
                    s.inv_code,
                    s.`desc`,
                    s.category,
                    s.ending_balance,
                    s.reorder_level,
                    'OUT OF STOCK' AS status,
                    s.last_trans_date
                FROM ( $snapshot ) s
                WHERE s.ending_balance <= 0
                ORDER BY s.last_trans_date DESC
                LIMIT 2000
            ";

            $stmt = $this->conn->prepare($sql);
            $this->bindAsOf($stmt, $data);

            return $this->fetchAll($stmt);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }

    public function getInvCategoryMixAsOf(array $data): array
    {
        try {
            $snapshot = $this->getStockSnapshotSqlAsOf();

            $sql = "
                SELECT
                    IFNULL(NULLIF(TRIM(s.category), ''), 'UNCATEGORIZED') AS category,
                    ROUND(SUM(s.total_value), 2) AS total_value
                FROM ( $snapshot ) s
                GROUP BY IFNULL(NULLIF(TRIM(s.category), ''), 'UNCATEGORIZED')
                ORDER BY total_value DESC
                LIMIT 20
            ";

            $stmt = $this->conn->prepare($sql);
            $this->bindAsOf($stmt, $data);

            return $this->fetchAll($stmt);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }

    public function getAllDataPerCostBalLevelAsOf(array $data): array
    {
        try {
            $snapshot = $this->getStockSnapshotSqlAsOf();

            $sql = "
                SELECT
                    s.last_trans_date,
                    s.inv_code,
                    s.`desc` AS description,
                    s.category,
                    s.ending_balance AS running_uom_val,
                    s.total_value AS running_cost_per_uom,
                    s.reorder_level AS min_stock_level
                FROM ( $snapshot ) s
                ORDER BY s.`desc` ASC
            ";

            $stmt = $this->conn->prepare($sql);
            $this->bindAsOf($stmt, $data);

            return $this->fetchAll($stmt);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }

    /* -------------------------------------------------------
       ✅ NEW: ENDING BALANCE REPORT (AS-OF)
       - Matches InventoryDashboardComponent.jsx mapper exactly
       - Returns: inv_code, desc, category, ending_balance, reorder_level, total_value, status
       ------------------------------------------------------- */
    public function getEndingBalanceReportAsOf(array $data): array
    {
        try {
            $snapshot = $this->getStockSnapshotSqlAsOf();

            // status output aligns with FE expectations:
            // OUT | LOW | SAFE (per your FE logic)
            $sql = "
                SELECT
                    s.inv_code,
                    s.`desc`,
                    s.category,
                    s.ending_balance,
                    s.reorder_level,
                    s.total_value,
                    CASE
                        WHEN s.ending_balance <= 0 THEN 'OUT'
                        WHEN s.reorder_level > 0 AND s.ending_balance < s.reorder_level THEN 'LOW'
                        ELSE 'SAFE'
                    END AS status
                FROM ( $snapshot ) s
                ORDER BY
                    (CASE
                        WHEN s.ending_balance <= 0 THEN 0
                        WHEN s.reorder_level > 0 AND s.ending_balance < s.reorder_level THEN 1
                        ELSE 2
                    END) ASC,
                    (CASE
                        WHEN s.reorder_level > 0 THEN (s.reorder_level - s.ending_balance)
                        ELSE 0
                    END) DESC,
                    s.`desc` ASC
                LIMIT 5000
            ";

            $stmt = $this->conn->prepare($sql);
            $this->bindAsOf($stmt, $data);

            return $this->fetchAll($stmt);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }

    /* -------------------------------------------------------
       ✅ MOVEMENT ENDPOINTS (RANGE)
       - Top movers uses datefrom..dateto
       ------------------------------------------------------- */

    public function getTopMoversRange(array $data): array
    {
        try {
            $dateTo = (string)($data["dateto"] ?? "");
            $dateFrom = (string)($data["datefrom"] ?? "");

            // If frontend doesn't send datefrom, default to last 30 days.
            if ($dateTo !== "" && $dateFrom === "") {
                $dt = new DateTime($dateTo);
                $dt->sub(new DateInterval("P30D"));
                $data["datefrom"] = $dt->format("Y-m-d");
            }

            $sql = "
                SELECT
                    t.inv_code,
                    IF(LEFT(t.inv_code,2)='RM', rm.desc, bp.desc) AS `desc`,
                    IF(LEFT(t.inv_code,2)='RM', rm.category, bp.category) AS category,
                    ROUND(SUM(CASE WHEN t.qty < 0 AND t.pr_queue_code != 'Physical' THEN -1 * t.qty ELSE 0 END), 2) AS qty,
                    ROUND(SUM(CASE WHEN t.qty < 0 AND t.pr_queue_code != 'Physical' THEN -1 * (t.qty * t.cost_per_uom) ELSE 0 END), 2) AS amount,
                    MAX(t.trans_date) AS last_trans_date
                FROM tbl_inventory_transactions t
                LEFT JOIN lkp_raw_mats rm ON t.inv_code = rm.mat_code
                LEFT JOIN lkp_build_of_products bp ON t.inv_code = bp.build_code
                LEFT JOIN lkp_busunits bu ON t.busunitcode = bu.busunitcode
                WHERE t.deletestatus='Active'
                  AND bu.name IS NOT NULL
                  AND t.busunitcode LIKE :busunitcode
                  AND bu.areacode LIKE :areacode
                  AND t.trans_date <= :dateto
                  AND t.trans_date >= :datefrom
                GROUP BY t.inv_code
                HAVING qty > 0
                ORDER BY qty DESC, amount DESC
                LIMIT 1500
            ";

            $stmt = $this->conn->prepare($sql);
            $this->bindRange($stmt, $data);

            return $this->fetchAll($stmt);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }

    /* -------------------------------------------------------
       ✅ Existing (kept)
       ------------------------------------------------------- */

    // public function getInventoryUsage($data)

    // {


    //     try {


    //         $dateTo = $data["dateto"];

    //         $interval = $data["interval"];


    //         // Create a DateTime object from the $dateTo string

    //         $dateFrom = new DateTime($dateTo);

    //         $dateFrom->sub(new DateInterval("P{$interval}D"));

    //         $dateFrom = $dateFrom->format('Y-m-d');

    //         $dateBetween = date('Y-m-d', strtotime($dateFrom . ' +1 day'));

    //         $number = $interval -1;
            
    //         $dateYes = date('Y-m-d', strtotime($dateTo . ' -' . $number . ' days'));


    //         $sql = "SELECT

    //             'CURRENT',

    //             :dateHeaderTo AS transdate,

    //             IF(parent_level = tbl_inventory_filtered.level

    //                     AND parent_inv <> '',

    //                 parent_inv,

    //                 tbl_inventory_filtered.inv_code) AS inv_code,

    //             IF(LEFT(tbl_inventory_filtered.inv_code, 2) = 'RM',

    //                 lkp_raw_mats.desc,

    //                 lkp_build_of_products.desc) AS description,


    //             -- Calculate purchases_running_uom_val
    //             ROUND(SUM(
    //                 CASE 
    //                     WHEN tbl_inventory_filtered.pr_queue_code != 'Physical' 
    //                     AND DATE(tbl_inventory_filtered.trans_date) = :datePurchase
    //                     AND tbl_inventory_filtered.qty > 0
    //                     THEN tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
    //                     ELSE 0 
    //                 END), 2) AS purchases_running_uom_val,
                
    //             -- Calculate prev_running_uom_val by using purchases_running_uom_val in the second case
    //             ROUND(
    //                 SUM(
    //                     CASE
    //                         WHEN DATE(tbl_inventory_filtered.trans_date) = :dateSelected 
    //                         AND tbl_inventory_filtered.qty > 0 THEN
    //                             tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
    //                         WHEN DATE(tbl_inventory_filtered.trans_date) = :dateSelect 
    //                         AND tbl_inventory_filtered.qty <= 0 THEN
    //                             0  -- Handle zero or negative qty as 0 when trans_date matches
    //                         ELSE
    //                             tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
    //                     END
    //                 ) - (
    //                     SELECT ROUND(SUM(
    //                         CASE 
    //                             WHEN tbl_inventory_filtered.pr_queue_code != 'Physical' 
    //                             AND DATE(tbl_inventory_filtered.trans_date) = :datePur
    //                             AND tbl_inventory_filtered.qty > 0 THEN
    //                                 tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
    //                             ELSE 0 
    //                         END), 2)
    //                 ), 2) AS prev_running_uom_val,

                

    //             ROUND(
    //     SUM(
    //         CASE
    //             WHEN tbl_inventory_filtered.qty > 0 
    //             AND DATE(tbl_inventory_filtered.trans_date) = $dateTo
    //             THEN tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
    //             ELSE 0
    //         END
    //     ) + SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val), 2
    // ) AS running_uom_val,

    //             ROUND((IFNULL(tbl_previous.running_uom_val,0)

    //             + IFNULL(tbl_purchases.running_uom_val,0)

    //             - SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val)),2) AS `usage_uom_val`,

    //             tbl_inventory_filtered.uom,

    //             ROUND(IFNULL(SUM(tbl_previous.qty * tbl_previous.cost_per_uom),0),2) AS prev_running_cost_per_uom,

    //             ROUND(IFNULL(SUM(tbl_purchases.qty * tbl_purchases.cost_per_uom),0),2) AS purchases_running_cost_per_uom,

    //             ROUND(IFNULL(SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom),0),2) AS running_cost_per_uom,

    //             ( ROUND(IFNULL(SUM(tbl_previous.qty * tbl_previous.cost_per_uom),0),2)

    //             + ROUND(IFNULL(SUM(tbl_purchases.qty * tbl_purchases.cost_per_uom),0),2)

    //             - ROUND(IFNULL(SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom),0),2)) AS usage_running_cost_per_uom,

    //             tbl_inventory_filtered.pr_queue_code,

    //             tbl_inventory_filtered.busunitcode,

    //             tbl_inventory_filtered.name,

    //             tbl_inventory_filtered.level,

    //             tbl_inventory_filtered.category,

    //             tbl_inventory_filtered.inv_class,

    //             lkp_area.area_code,

    //             lkp_area.area_name,

    //             tbl_physical_count.count,

    //             IFNULL(lkp_stock_levels.min_stock_level,0) AS min_stock_level

    //         FROM

    //             (SELECT

    //                 tbl_inventory_transactions.trans_date,

    //                     tbl_inventory_transactions.inv_code,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS description,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.rawmats_parent, lkp_build_of_products.portion_parent) AS parent_inv,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) AS parent_level,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,

    //                     tbl_inventory_transactions.qty,

    //                     tbl_inventory_transactions.cost_per_uom,

    //                     tbl_inventory_transactions.uom_val,

    //                     tbl_inventory_transactions.uom,

    //                     tbl_inventory_transactions.pr_queue_code,

    //                     tbl_inventory_transactions.busunitcode,

    //                     lkp_busunits.name,

    //                     lkp_busunits.pricing_category,

    //                     lkp_busunits.class AS level,

    //                     tbl_inventory_transactions.inv_class,

    //                     lkp_busunits.areacode

    //             FROM

    //                 tbl_inventory_transactions

    //             LEFT OUTER JOIN lkp_raw_mats ON tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code

    //             LEFT OUTER JOIN lkp_build_of_products ON tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code

    //             LEFT OUTER JOIN lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode

    //             LEFT OUTER JOIN tbl_pricing_details ON lkp_busunits.pricing_category = tbl_pricing_details.pricing_code

    //                 AND tbl_pricing_details.inv_code = tbl_inventory_transactions.inv_code

    //             WHERE

    //                 tbl_inventory_transactions.deletestatus = 'Active'

               

    //                     AND lkp_busunits.name IS NOT NULL) AS tbl_inventory_filtered

    //                 LEFT OUTER JOIN

    //             lkp_raw_mats ON tbl_inventory_filtered.inv_code = lkp_raw_mats.mat_code

    //                 LEFT OUTER JOIN

    //             lkp_build_of_products ON tbl_inventory_filtered.inv_code = lkp_build_of_products.build_code

    //                 LEFT OUTER JOIN

    //             lkp_area ON tbl_inventory_filtered.areacode = lkp_area.area_code

    //                 LEFT OUTER JOIN

    //             lkp_stock_levels ON tbl_inventory_filtered.inv_code = lkp_stock_levels.inv_code

    //                 AND tbl_inventory_filtered.busunitcode = lkp_stock_levels.level


    //         -- JOIN BEGINNING


    //                 LEFT OUTER JOIN ( SELECT

    //             'PREVIOUS',

    //             :dateHeaderFrom AS transdate,

    //             IF(parent_level = tbl_inventory_filtered.level

    //                     AND parent_inv <> '',

    //                 parent_inv,

    //                 tbl_inventory_filtered.inv_code) AS inv_code,

    //             IF(LEFT(tbl_inventory_filtered.inv_code, 2) = 'RM',

    //                 lkp_raw_mats.desc,

    //                 lkp_build_of_products.desc) AS description,

    //             SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val) AS running_uom_val,

    //             tbl_inventory_filtered.uom,

    //             SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom) AS running_cost_per_uom,

    //             tbl_inventory_filtered.pr_queue_code,

    //             tbl_inventory_filtered.busunitcode,

    //             tbl_inventory_filtered.name,

    //             tbl_inventory_filtered.level,

    //             tbl_inventory_filtered.category,

    //             tbl_inventory_filtered.inv_class,

    //             tbl_inventory_filtered.qty,

    //             tbl_inventory_filtered.cost_per_uom,

    //             lkp_area.area_code,

    //             lkp_area.area_name,

    //             lkp_stock_levels.min_stock_level

    //         FROM

    //             (SELECT DISTINCT

    //                 tbl_inventory_transactions.trans_date,

    //                     tbl_inventory_transactions.inv_code,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS description,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.rawmats_parent, lkp_build_of_products.portion_parent) AS parent_inv,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) AS parent_level,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,

    //                     tbl_inventory_transactions.qty,

    //                     tbl_inventory_transactions.cost_per_uom,

    //                     tbl_inventory_transactions.uom_val,

    //                     tbl_inventory_transactions.uom,

    //                     tbl_inventory_transactions.pr_queue_code,

    //                     tbl_inventory_transactions.busunitcode,

    //                     lkp_busunits.name,

    //                     lkp_busunits.pricing_category,

    //                     lkp_busunits.class AS level,

    //                     tbl_inventory_transactions.inv_class,

    //                     lkp_busunits.areacode

    //             FROM

    //                 tbl_inventory_transactions

    //             LEFT OUTER JOIN lkp_raw_mats ON tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code

    //             LEFT OUTER JOIN lkp_build_of_products ON tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code

    //             LEFT OUTER JOIN lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode

    //             LEFT OUTER JOIN tbl_pricing_details ON lkp_busunits.pricing_category = tbl_pricing_details.pricing_code

    //                 AND tbl_pricing_details.inv_code = tbl_inventory_transactions.inv_code

    //             WHERE

    //                 tbl_inventory_transactions.deletestatus = 'Active'

    //                     AND lkp_busunits.name IS NOT NULL) AS tbl_inventory_filtered

    //                 LEFT OUTER JOIN

    //             lkp_raw_mats ON tbl_inventory_filtered.inv_code = lkp_raw_mats.mat_code

    //                 LEFT OUTER JOIN

    //             lkp_build_of_products ON tbl_inventory_filtered.inv_code = lkp_build_of_products.build_code

    //                 LEFT OUTER JOIN

    //             lkp_area ON tbl_inventory_filtered.areacode = lkp_area.area_code

    //                 LEFT OUTER JOIN

    //             lkp_stock_levels ON tbl_inventory_filtered.inv_code = lkp_stock_levels.inv_code

    //                 AND tbl_inventory_filtered.busunitcode = lkp_stock_levels.level

    //         WHERE

    //             tbl_inventory_filtered.busunitcode LIKE :begbusunitcode

    //          AND  tbl_inventory_filtered.areacode LIKE :begareacode

    //         AND tbl_inventory_filtered.trans_date <= :begdatefrom

    //         GROUP BY tbl_inventory_filtered.level , IF(parent_level = tbl_inventory_filtered.level

    //                 AND parent_inv <> '',

    //             parent_inv,

    //             tbl_inventory_filtered.inv_code)) tbl_previous ON tbl_inventory_filtered.inv_code = tbl_previous.inv_code


    //             -- JOIN PURCHASES


    //                 LEFT OUTER JOIN ( SELECT

    //             'PURCHASES',

    //             :dateHeaderPurchase AS transdate,

    //             IF(parent_level = tbl_inventory_filtered.level

    //                     AND parent_inv <> '',

    //                 parent_inv,

    //                 tbl_inventory_filtered.inv_code) AS inv_code,

    //             IF(LEFT(tbl_inventory_filtered.inv_code, 2) = 'RM',

    //                 lkp_raw_mats.desc,

    //                 lkp_build_of_products.desc) AS description,

    //             SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val) AS running_uom_val,

    //             tbl_inventory_filtered.uom,

    //             SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom) AS running_cost_per_uom,

    //             tbl_inventory_filtered.pr_queue_code,

    //             tbl_inventory_filtered.busunitcode,

    //             tbl_inventory_filtered.name,

    //             tbl_inventory_filtered.level,

    //             tbl_inventory_filtered.category,

    //             tbl_inventory_filtered.inv_class,

    //             tbl_inventory_filtered.qty,

    //             tbl_inventory_filtered.cost_per_uom,

    //             lkp_area.area_code,

    //             lkp_area.area_name,

    //             lkp_stock_levels.min_stock_level

    //         FROM

    //             (SELECT DISTINCT

    //                 tbl_inventory_transactions.trans_date,

    //                     tbl_inventory_transactions.inv_code,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS description,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.rawmats_parent, lkp_build_of_products.portion_parent) AS parent_inv,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) AS parent_level,

    //                     IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,

    //                     tbl_inventory_transactions.qty,

    //                     tbl_inventory_transactions.cost_per_uom,

    //                     tbl_inventory_transactions.uom_val,

    //                     tbl_inventory_transactions.uom,

    //                     tbl_inventory_transactions.pr_queue_code,

    //                     tbl_inventory_transactions.busunitcode,

    //                     lkp_busunits.name,

    //                     lkp_busunits.pricing_category,

    //                     lkp_busunits.class AS level,

    //                     tbl_inventory_transactions.inv_class,

    //                     lkp_busunits.areacode

    //             FROM

    //                 tbl_inventory_transactions

    //             LEFT OUTER JOIN lkp_raw_mats ON tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code

    //             LEFT OUTER JOIN lkp_build_of_products ON tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code

    //             LEFT OUTER JOIN lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode

    //             LEFT OUTER JOIN tbl_pricing_details ON lkp_busunits.pricing_category = tbl_pricing_details.pricing_code

    //                 AND tbl_pricing_details.inv_code = tbl_inventory_transactions.inv_code

    //             WHERE

    //                 tbl_inventory_transactions.deletestatus = 'Active'

    //                 AND tbl_inventory_transactions.qty > 0

    //                     AND lkp_busunits.name IS NOT NULL) AS tbl_inventory_filtered

    //                 LEFT OUTER JOIN

    //             lkp_raw_mats ON tbl_inventory_filtered.inv_code = lkp_raw_mats.mat_code

    //                 LEFT OUTER JOIN

    //             lkp_build_of_products ON tbl_inventory_filtered.inv_code = lkp_build_of_products.build_code

    //                 LEFT OUTER JOIN

    //             lkp_area ON tbl_inventory_filtered.areacode = lkp_area.area_code

    //                 LEFT OUTER JOIN

    //             lkp_stock_levels ON tbl_inventory_filtered.inv_code = lkp_stock_levels.inv_code

    //                 AND tbl_inventory_filtered.busunitcode = lkp_stock_levels.level

    //         WHERE

    //             tbl_inventory_filtered.busunitcode LIKE :purchasebusunitcode

    //         AND tbl_inventory_filtered.areacode LIKE :purchaseareacode

    //         AND tbl_inventory_filtered.trans_date BETWEEN :purchasedatebetween AND :purchasedateto

    //         GROUP BY tbl_inventory_filtered.level , IF(parent_level = tbl_inventory_filtered.level

    //                 AND parent_inv <> '',

    //             parent_inv,

    //             tbl_inventory_filtered.inv_code)) tbl_purchases ON tbl_inventory_filtered.inv_code = tbl_purchases.inv_code


    //          -- ADD PHYSICAL COUNT TABLE

    //             LEFT OUTER JOIN

    //             tbl_physical_count ON tbl_inventory_filtered.inv_code = tbl_physical_count.inv_code

    //                 AND tbl_inventory_filtered.busunitcode = tbl_physical_count.busunitcode

    //                 AND :physicalDate = tbl_physical_count.transdate


    //         WHERE

    //             tbl_inventory_filtered.busunitcode LIKE :busunitcode

    //          AND tbl_inventory_filtered.areacode LIKE :areacode

    //         AND tbl_inventory_filtered.trans_date <= :dateto

    //         GROUP BY tbl_inventory_filtered.level , IF(parent_level = tbl_inventory_filtered.level

    //                 AND parent_inv <> '',

    //             parent_inv,

    //             tbl_inventory_filtered.inv_code)";


    //         $stmt = $this->conn->prepare($sql);


    //         $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

    //         $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

    //         $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

    //         $stmt->bindValue(":datePurchase", $dateTo, PDO::PARAM_STR);

    //         $stmt->bindValue(":dateSelect", $dateTo, PDO::PARAM_STR);

    //         $stmt->bindValue(":dateSelected", $dateTo, PDO::PARAM_STR);
            
    //         $stmt->bindValue(":datePur", $dateTo, PDO::PARAM_STR);

    //         $stmt->bindValue(":begbusunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

    //         $stmt->bindValue(":begareacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

    //         $stmt->bindValue(":begdatefrom", $dateFrom, PDO::PARAM_STR);


    //         $stmt->bindValue(":purchasebusunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

    //         $stmt->bindValue(":purchaseareacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

    //         $stmt->bindValue(":purchasedatebetween", $dateBetween, PDO::PARAM_STR);

    //         $stmt->bindValue(":purchasedateto", $dateTo, PDO::PARAM_STR);


    //         $stmt->bindValue(":physicalDate", $dateTo, PDO::PARAM_STR);


    //         $stmt->bindValue(":dateHeaderTo", $dateTo, PDO::PARAM_STR);

    //         $stmt->bindValue(":dateHeaderFrom", $dateFrom, PDO::PARAM_STR);

    //         $stmt->bindValue(":dateHeaderPurchase", $dateBetween, PDO::PARAM_STR);


    //         $stmt->execute();


    //         $data = [];


    //         while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {


    //             $data[] = $row;


    //         }


    //         return $data;


    //     } catch (Exception $e) {


    //         echo json_encode(["message" => $e->getMessage()]);


    //         exit;


    //     }


    // }

    public function getInventoryUsage($data)
{
    try {

        $dateTo   = $data["dateto"];
        $interval = (int) $data["interval"];

        // dateFrom = dateto - interval days
        $dateFrom = new DateTime($dateTo);
        $dateFrom->sub(new DateInterval("P{$interval}D"));
        $dateFrom = $dateFrom->format("Y-m-d");

        // dateBetween = dateFrom + 1 day
        // interval=1 => dateFrom = dateto-1 => dateBetween = dateto (window becomes dateto..dateto)
        $dateBetween = date("Y-m-d", strtotime($dateFrom . " +1 day"));

        // kept from your old code (not used by SQL directly, but preserved)
        $number  = $interval - 1;
        $dateYes = date("Y-m-d", strtotime($dateTo . " -" . $number . " days"));

        $sql = "
            SELECT
                'CURRENT',
                p.dateHeaderTo AS transdate,

                IF(base.parent_level = base.level AND base.parent_inv <> '',
                    base.parent_inv,
                    base.inv_code
                ) AS inv_code,

                IF(LEFT(base.inv_code, 2) = 'RM',
                    rm.`desc`,
                    bp.`desc`
                ) AS description,

                /* IN (+): purchases/production within window */
                ROUND(SUM(
                    CASE
                        WHEN base.pr_queue_code != 'Physical'
                         AND base.qty > 0
                         AND base.trans_date_parsed BETWEEN p.purchasedatebetween AND p.purchasedateto
                        THEN base.qty * base.uom_val
                        ELSE 0
                    END
                ), 2) AS purchases_running_uom_val,

                /* Previous/Beginning perpetual up to begdatefrom */
                ROUND(SUM(
                    CASE
                        WHEN base.trans_date_parsed <= p.begdatefrom
                        THEN base.qty * base.uom_val
                        ELSE 0
                    END
                ), 2) AS prev_running_uom_val,

                /* Ending perpetual up to dateto */
                ROUND(SUM(base.qty * base.uom_val), 2) AS running_uom_val,

                /* OUT (-): usage within window as POSITIVE number */
                ROUND(SUM(
                    CASE
                        WHEN base.qty < 0
                         AND base.trans_date_parsed BETWEEN p.purchasedatebetween AND p.purchasedateto
                        THEN ABS(base.qty * base.uom_val)
                        ELSE 0
                    END
                ), 2) AS `usage_uom_val`,

                base.uom,

                /* Cost outputs (same names) */
                ROUND(SUM(
                    CASE
                        WHEN base.trans_date_parsed <= p.begdatefrom
                        THEN base.qty * base.cost_per_uom
                        ELSE 0
                    END
                ), 2) AS prev_running_cost_per_uom,

                ROUND(SUM(
                    CASE
                        WHEN base.pr_queue_code != 'Physical'
                         AND base.qty > 0
                         AND base.trans_date_parsed BETWEEN p.purchasedatebetween AND p.purchasedateto
                        THEN base.qty * base.cost_per_uom
                        ELSE 0
                    END
                ), 2) AS purchases_running_cost_per_uom,

                ROUND(SUM(base.qty * base.cost_per_uom), 2) AS running_cost_per_uom,

                (
                    ROUND(SUM(
                        CASE
                            WHEN base.trans_date_parsed <= p.begdatefrom
                            THEN base.qty * base.cost_per_uom
                            ELSE 0
                        END
                    ), 2)
                    +
                    ROUND(SUM(
                        CASE
                            WHEN base.pr_queue_code != 'Physical'
                             AND base.qty > 0
                             AND base.trans_date_parsed BETWEEN p.purchasedatebetween AND p.purchasedateto
                            THEN base.qty * base.cost_per_uom
                            ELSE 0
                        END
                    ), 2)
                    -
                    ROUND(SUM(base.qty * base.cost_per_uom), 2)
                ) AS usage_running_cost_per_uom,

                /* These are not aggregated in your old query, but now we aggregate rows,
                   so use MAX() for stable output */
                MAX(base.pr_queue_code) AS pr_queue_code,
                base.busunitcode,
                MAX(base.name) AS name,
                MAX(base.level) AS level,
                MAX(base.category) AS category,
                MAX(base.inv_class) AS inv_class,

                MAX(base.areacode) AS area_code,
                (SELECT a.area_name FROM lkp_area a WHERE a.area_code = MAX(base.areacode) LIMIT 1) AS area_name,

                (SELECT pc2.`count`
                   FROM tbl_physical_count pc2
                  WHERE pc2.inv_code = IF(base.parent_level = base.level AND base.parent_inv <> '', base.parent_inv, base.inv_code)
                    AND pc2.busunitcode = base.busunitcode
                    AND pc2.transdate = p.physicalDate
                  LIMIT 1
                ) AS `count`,

                (SELECT IFNULL(sl2.min_stock_level,0)
                   FROM lkp_stock_levels sl2
                  WHERE sl2.inv_code = IF(base.parent_level = base.level AND base.parent_inv <> '', base.parent_inv, base.inv_code)
                    AND sl2.level = base.busunitcode
                  LIMIT 1
                ) AS min_stock_level

            FROM
            /* =========================
               PARAMS TABLE
               - every placeholder exists exactly ONCE here
               - this keeps ALL your bindValue() lines valid
               ========================= */
            (SELECT
                :busunitcode AS busunitcode_like,
                :areacode AS areacode_like,

                :begbusunitcode AS begbusunitcode_like,
                :begareacode AS begareacode_like,

                :purchasebusunitcode AS purchasebusunitcode_like,
                :purchaseareacode AS purchaseareacode_like,

                :dateto AS dateto,
                :begdatefrom AS begdatefrom,
                :purchasedatebetween AS purchasedatebetween,
                :purchasedateto AS purchasedateto,

                :physicalDate AS physicalDate,

                :dateHeaderTo AS dateHeaderTo,
                :dateHeaderFrom AS dateHeaderFrom,
                :dateHeaderPurchase AS dateHeaderPurchase,
                :datePurchase AS datePurchase,
                :dateSelect AS dateSelect,
                :dateSelected AS dateSelected,
                :datePur AS datePur
            ) p

            JOIN
            (
                SELECT
                    t.inv_code,
                    t.qty,
                    t.cost_per_uom,
                    t.uom_val,
                    t.uom,
                    t.pr_queue_code,
                    t.busunitcode,
                    bu.name,
                    bu.class AS level,
                    t.inv_class,
                    bu.areacode,

                    IF(LEFT(t.inv_code, 2)='RM', rm0.rawmats_parent, bp0.portion_parent) AS parent_inv,
                    IF(LEFT(t.inv_code, 2)='RM', rm0.level, bp0.level) AS parent_level,
                    IF(LEFT(t.inv_code, 2)='RM', rm0.category, bp0.category) AS category,

                    /* supports DATE/DATETIME, 'YYYY-MM-DD', or 'M/D/YYYY' */
                    COALESCE(
                        DATE(t.trans_date),
                        DATE(STR_TO_DATE(t.trans_date, '%Y-%m-%d')),
                        DATE(STR_TO_DATE(t.trans_date, '%c/%e/%Y'))
                    ) AS trans_date_parsed

                FROM tbl_inventory_transactions t
                LEFT OUTER JOIN lkp_raw_mats rm0 ON t.inv_code = rm0.mat_code
                LEFT OUTER JOIN lkp_build_of_products bp0 ON t.inv_code = bp0.build_code
                LEFT OUTER JOIN lkp_busunits bu ON t.busunitcode = bu.busunitcode

                /* IMPORTANT: removed tbl_pricing_details join to avoid row duplication */

                WHERE
                    t.deletestatus = 'Active'
                    AND bu.name IS NOT NULL
            ) base ON 1=1

            LEFT OUTER JOIN lkp_raw_mats rm ON base.inv_code = rm.mat_code
            LEFT OUTER JOIN lkp_build_of_products bp ON base.inv_code = bp.build_code

            WHERE
                /* your original filters kept */
                base.busunitcode LIKE p.busunitcode_like
                AND base.areacode LIKE p.areacode_like
                AND base.trans_date_parsed <= p.dateto

                /* keep the other LIKE filters (same bound values anyway) */
                AND base.busunitcode LIKE p.begbusunitcode_like
                AND base.areacode LIKE p.begareacode_like
                AND base.busunitcode LIKE p.purchasebusunitcode_like
                AND base.areacode LIKE p.purchaseareacode_like

            GROUP BY
                base.level,
                IF(base.parent_level = base.level AND base.parent_inv <> '',
                    base.parent_inv,
                    base.inv_code
                )
        ";

        $stmt = $this->conn->prepare($sql);

        // === your original bindings (ALL MUST EXIST in SQL; they do via params table) ===
        $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);
        $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);
        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":datePurchase", $dateTo, PDO::PARAM_STR);
        $stmt->bindValue(":dateSelect", $dateTo, PDO::PARAM_STR);
        $stmt->bindValue(":dateSelected", $dateTo, PDO::PARAM_STR);
        $stmt->bindValue(":datePur", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":begbusunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);
        $stmt->bindValue(":begareacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);
        $stmt->bindValue(":begdatefrom", $dateFrom, PDO::PARAM_STR);

        $stmt->bindValue(":purchasebusunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);
        $stmt->bindValue(":purchaseareacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);
        $stmt->bindValue(":purchasedatebetween", $dateBetween, PDO::PARAM_STR);
        $stmt->bindValue(":purchasedateto", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":physicalDate", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":dateHeaderTo", $dateTo, PDO::PARAM_STR);
        $stmt->bindValue(":dateHeaderFrom", $dateFrom, PDO::PARAM_STR);
        $stmt->bindValue(":dateHeaderPurchase", $dateBetween, PDO::PARAM_STR);

        $stmt->execute();

        $result = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $result[] = $row;
        }

        return $result;

    } catch (Exception $e) {
        echo json_encode(["message" => $e->getMessage()]);
        exit;
    }
}


}
