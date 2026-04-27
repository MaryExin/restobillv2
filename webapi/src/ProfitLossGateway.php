<?php

class ProfitLossGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getProfitAndLoss(
        string $busunit,
        string $dateTo,
        string $filterType = '',
        string $filterValue = ''
    ): array
    {
        // Date boundaries
        $ytdStart     = date('Y-01-01', strtotime($dateTo));
        $thisMonStart = date('Y-m-01', strtotime($dateTo));
        $lastMonStart = date('Y-m-01', strtotime('first day of previous month', strtotime($dateTo)));
        $lastMonEnd   = date('Y-m-t',  strtotime('last day of previous month',  strtotime($dateTo)));

        // Normalize inputs
        $filterType  = strtoupper(trim($filterType));
        $filterValue = trim($filterValue);

        // ✅ Accept aliases from frontend
        // CORP -> CORPORATION
        if ($filterType === 'CORP') $filterType = 'CORPORATION';
        // BU -> BUSUNIT (if you ever send BU)
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

        // Determine chart_type_id
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

        // BU filter for transactions
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
            c.gl_description,
            COALESCE(SUM(CASE WHEN t.transdate BETWEEN :ytdStart AND :ytdEnd THEN t.amount ELSE 0 END), 0) AS ytd,
            COALESCE(SUM(CASE WHEN t.transdate BETWEEN :thisMonStart AND :thisMonEnd THEN t.amount ELSE 0 END), 0) AS this_month,
            COALESCE(SUM(CASE WHEN t.transdate BETWEEN :lastMonStart AND :lastMonEnd THEN t.amount ELSE 0 END), 0) AS last_month
        FROM coa c
        LEFT JOIN tbl_accounting_transactions t
            ON t.glcode = c.glcode
           AND t.approvalstatus = 'Posted'
           AND t.deletestatus   = 'Active'
           AND ($buFilterSql)
        WHERE c.chart_type_id = :coaId2
        GROUP BY c.glcode, c.gl_description
        ORDER BY c.glcode
        SQL;

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(':coaId1', $charttypeid, \PDO::PARAM_STR);
        $stmt->bindValue(':coaId2', $charttypeid, \PDO::PARAM_STR);

        $stmt->bindValue(':ytdStart', $ytdStart, \PDO::PARAM_STR);
        $stmt->bindValue(':ytdEnd', $dateTo, \PDO::PARAM_STR);

        $stmt->bindValue(':thisMonStart', $thisMonStart, \PDO::PARAM_STR);
        $stmt->bindValue(':thisMonEnd', $dateTo, \PDO::PARAM_STR);

        $stmt->bindValue(':lastMonStart', $lastMonStart, \PDO::PARAM_STR);
        $stmt->bindValue(':lastMonEnd', $lastMonEnd, \PDO::PARAM_STR);

        if ($useGroup) {
            $stmt->bindValue(':fv', $filterValue, \PDO::PARAM_STR);
        } else {
            $stmt->bindValue(':busunit', $busunit, \PDO::PARAM_STR);
        }

        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
