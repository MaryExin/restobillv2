<?php

class BalanceSheetGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getBalanceSheet(
        string $busunit,
        string $dateTo,
        string $filterType = '',
        string $filterValue = ''
    ): array
    {
        if (trim($dateTo) === '') return [];

        // Compute our date boundaries
        $ytdStart     = date('Y-01-01', strtotime($dateTo));
        $thisMonStart = date('Y-m-01', strtotime($dateTo));

        // Normalize inputs
        $filterType  = strtoupper(trim($filterType));
        $filterValue = trim($filterValue);

        // ✅ Accept aliases from frontend
        if ($filterType === 'CORP') $filterType = 'CORPORATION';
        if ($filterType === 'BU')   $filterType = 'BUSUNIT';

        $useGroup = in_array($filterType, ['AREA', 'CORPORATION', 'BRAND'], true) && $filterValue !== '';

        // Build group WHERE (no repeated placeholders)
        $groupWhere = '';
        if ($useGroup) {
            if ($filterType === 'AREA') {
                $groupWhere = "b.areacode = :fv";
            } elseif ($filterType === 'CORPORATION') {
                $groupWhere = "b.corpcode = :fv";
            } elseif ($filterType === 'BRAND') {
                $groupWhere = "b.brandcode = :fv";
            } else {
                $useGroup = false;
            }
        }

        // ------------------------------------------------------------
        // 1) Determine chart_type_id (same pattern as ProfitLoss)
        // ------------------------------------------------------------
        if ($useGroup) {
            $chartSql = <<<SQL
                SELECT m.chart_id
                FROM tbl_chart_of_accounts_map m
                INNER JOIN lkp_busunits b
                    ON b.busunitcode = m.busunituuid
                WHERE b.deletestatus = 'Active'
                  AND ($groupWhere)
                LIMIT 1
            SQL;

            $chartStmt = $this->conn->prepare($chartSql);
            $chartStmt->bindValue(':fv', $filterValue, \PDO::PARAM_STR);
            $chartStmt->execute();
            $charttypeid = $chartStmt->fetchColumn();
        } else {
            // ✅ BUSUNIT mode must have busunit
            if (trim($busunit) === '') return [];

            $chartSql = <<<SQL
                SELECT chart_id
                FROM tbl_chart_of_accounts_map
                WHERE busunituuid = :busunit
                LIMIT 1
            SQL;

            $chartStmt = $this->conn->prepare($chartSql);
            $chartStmt->bindValue(':busunit', $busunit, \PDO::PARAM_STR);
            $chartStmt->execute();
            $charttypeid = $chartStmt->fetchColumn();
        }

        if (!$charttypeid) return [];

        // ------------------------------------------------------------
        // 2) Build BU filter for transactions (group or single BU)
        // ------------------------------------------------------------
        if ($useGroup) {
            $buFilterSql = <<<SQL
                t.busunitcode IN (
                    SELECT b.busunitcode
                    FROM lkp_busunits b
                    WHERE b.deletestatus = 'Active'
                      AND ($groupWhere)
                )
            SQL;
        } else {
            $buFilterSql = "t.busunitcode = :busunit";
        }

        // ------------------------------------------------------------
        // 3) Main Balance Sheet query (keeps your buckets/logic)
        // ------------------------------------------------------------
        $sql = <<<SQL
            WITH coa AS (
                SELECT
                    chart_type_id,
                    glcode,
                    MIN(gl_description) AS gl_description
                FROM lkp_chart_of_accounts
                WHERE deletestatus = 'Active'
                  AND chart_type_id = :coaId1
                GROUP BY chart_type_id, glcode
            )
            SELECT
                c.glcode,
                c.gl_description AS gl_description,

                /* YTD bucket */
                COALESCE(SUM(CASE WHEN t.transdate <= :dateTo THEN t.amount ELSE 0 END), 0) AS amtToDate,

                /* This Month (kept as-is from your logic) */
                COALESCE(SUM(CASE WHEN t.transdate < :thisMonStart THEN t.amount ELSE 0 END), 0) AS amtThisMonth,

                /* Change vs this month (kept as-is) */
                COALESCE(SUM(CASE WHEN t.transdate <= :changeMoDateTo THEN t.amount ELSE 0 END), 0)
                  -
                COALESCE(SUM(CASE WHEN t.transdate < :changeMoThisMonStart THEN t.amount ELSE 0 END), 0) AS changeThisMonth,

                /* Last Year bucket (kept as-is) */
                COALESCE(SUM(CASE WHEN t.transdate < :ytdStart THEN t.amount ELSE 0 END), 0) AS amtLastYear,

                /* Change vs last year (kept as-is) */
                COALESCE(SUM(CASE WHEN t.transdate <= :changeLYDateTo THEN t.amount ELSE 0 END), 0)
                  -
                COALESCE(SUM(CASE WHEN t.transdate < :changeLYytdStart THEN t.amount ELSE 0 END), 0) AS changeLastYear

            FROM coa c
            LEFT JOIN tbl_accounting_transactions t
                ON t.glcode = c.glcode
               AND ($buFilterSql)
               AND t.approvalstatus = 'Posted'
               AND t.deletestatus   = 'Active'
            WHERE
                c.chart_type_id = :coaId2
                AND c.glcode >= 100
                AND c.glcode < 700
            GROUP BY
                c.glcode, c.gl_description
            ORDER BY
                c.glcode ASC
        SQL;

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(':coaId1', $charttypeid, \PDO::PARAM_STR);
        $stmt->bindValue(':coaId2', $charttypeid, \PDO::PARAM_STR);

        $stmt->bindValue(':ytdStart', $ytdStart, \PDO::PARAM_STR);
        $stmt->bindValue(':thisMonStart', $thisMonStart, \PDO::PARAM_STR);
        $stmt->bindValue(':dateTo', $dateTo, \PDO::PARAM_STR);

        $stmt->bindValue(':changeMoDateTo', $dateTo, \PDO::PARAM_STR);
        $stmt->bindValue(':changeMoThisMonStart', $thisMonStart, \PDO::PARAM_STR);

        $stmt->bindValue(':changeLYDateTo', $dateTo, \PDO::PARAM_STR);
        $stmt->bindValue(':changeLYytdStart', $ytdStart, \PDO::PARAM_STR);

        if ($useGroup) {
            $stmt->bindValue(':fv', $filterValue, \PDO::PARAM_STR);
        } else {
            $stmt->bindValue(':busunit', $busunit, \PDO::PARAM_STR);
        }

        $stmt->execute();
        $bsRows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        // ------------------------------------------------------------
        // 4) Profit & Loss summary query (also supports group aggregation)
        // ------------------------------------------------------------
        if ($useGroup) {
            $pnlBuFilter = <<<SQL
                busunitcode IN (
                    SELECT b.busunitcode
                    FROM lkp_busunits b
                    WHERE b.deletestatus = 'Active'
                      AND ($groupWhere)
                )
            SQL;
        } else {
            $pnlBuFilter = "busunitcode = :pnlBusunit";
        }

        $plSql = <<<SQL
            SELECT
                COALESCE(SUM(amount),0) AS totalAmount
            FROM tbl_accounting_transactions
            WHERE
                glcode >= 700
                AND ($pnlBuFilter)
                AND transdate BETWEEN :pnlDateFrom AND :pnlDateTo
                AND approvalstatus = 'Posted'
                AND deletestatus = 'Active'
        SQL;

        $plStmt = $this->conn->prepare($plSql);

        $plStmt->bindValue(':pnlDateFrom', $ytdStart, \PDO::PARAM_STR);
        $plStmt->bindValue(':pnlDateTo', $dateTo, \PDO::PARAM_STR);

        if ($useGroup) {
            // reuse same :fv placeholder
            $plStmt->bindValue(':fv', $filterValue, \PDO::PARAM_STR);
        } else {
            $plStmt->bindValue(':pnlBusunit', $busunit, \PDO::PARAM_STR);
        }

        $plStmt->execute();
        $plRows = $plStmt->fetchAll(\PDO::FETCH_ASSOC);

        return [
            'bsData' => $bsRows,
            'plData' => $plRows,
        ];
    }
}
