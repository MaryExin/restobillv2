<?php

class ProfitLossComparativeGateway
{


    private \PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    private function normalizeDates(string $dateFrom, string $dateTo): array
    {
        $to = $dateTo ?: date('Y-m-d');
        $from = $dateFrom ?: $to;

        // ✅ Rule: if equal => Jan 1..dateTo
        if ($from === $to) {
            $from = date('Y-01-01', strtotime($to));
        }

        return [$from, $to];
    }

    private function placeholders(array $arr, string $prefix): array
    {
        $out = [];
        foreach ($arr as $i => $_) $out[] = ':' . $prefix . $i;
        return $out;
    }

    private function bindArray(\PDOStatement $stmt, array $arr, string $prefix): void
    {
        foreach ($arr as $i => $val) {
            $stmt->bindValue(':' . $prefix . $i, (string)$val, \PDO::PARAM_STR);
        }
    }

    /**
     * Returns SQL for mapping table:
     * columns: group_code, group_name, busunitcode
     * Uses :c0.. placeholders if $codes not empty.
     */
    private function buildGroupMapSql(string $groupBy, array $codes): string
    {
        $groupBy = strtoupper($groupBy);
        $hasFilter = count($codes) > 0;
        $in = $hasFilter ? (" IN (" . implode(',', $this->placeholders($codes, 'c')) . ") ") : "";

        if ($groupBy === 'BUSUNIT') {
            return "
                SELECT
                    b.busunitcode AS group_code,
                    b.name        AS group_name,
                    b.busunitcode AS busunitcode
                FROM lkp_busunits b
                WHERE b.deletestatus = 'Active'
                " . ($hasFilter ? " AND b.busunitcode $in " : "") . "
            ";
        }

        if ($groupBy === 'AREA') {
            return "
                SELECT
                    a.area_code   AS group_code,
                    a.area_name   AS group_name,
                    b.busunitcode AS busunitcode
                FROM lkp_area a
                JOIN lkp_busunits b
                  ON b.areacode = a.area_code
                 AND b.deletestatus = 'Active'
                WHERE a.deletestatus = 'Active'
                " . ($hasFilter ? " AND a.area_code $in " : "") . "
            ";
        }

        if ($groupBy === 'CORP') {
            return "
                SELECT
                    c.corp_code   AS group_code,
                    c.corp_name   AS group_name,
                    b.busunitcode AS busunitcode
                FROM lkp_corporation c
                JOIN lkp_busunits b
                  ON b.corpcode = c.corp_code
                 AND b.deletestatus = 'Active'
                WHERE c.deletestatus = 'Active'
                " . ($hasFilter ? " AND c.corp_code $in " : "") . "
            ";
        }

        // BRAND
        return "
            SELECT
                br.brand_code AS group_code,
                br.brand_name AS group_name,
                b.busunitcode AS busunitcode
            FROM lkp_brands br
            JOIN lkp_busunits b
              ON b.brandcode = br.brand_code
             AND b.deletestatus = 'Active'
            WHERE br.deletestatus = 'Active'
            " . ($hasFilter ? " AND br.brand_code $in " : "") . "
        ";
    }

    public function getProfitAndLossComparative(string $groupBy, array $groupCodes, string $dateFrom, string $dateTo): array
    {
        [$from, $to] = $this->normalizeDates($dateFrom, $dateTo);

        $groupBy = strtoupper($groupBy);
        if (!in_array($groupBy, ['BUSUNIT', 'AREA', 'CORP', 'BRAND'], true)) {
            $groupBy = 'BUSUNIT';
        }

        $codes = array_values(array_filter($groupCodes, fn($v) => (string)$v !== ''));

        // 1) Build group map SQL (derived table)
        $groupMapSql = $this->buildGroupMapSql($groupBy, $codes);

        // 2) Fetch distinct busunits involved (so we can get a chart mapping)
        $sqlBus = "SELECT DISTINCT gm.busunitcode FROM ($groupMapSql) gm";
        $stmtBus = $this->conn->prepare($sqlBus);
        if (count($codes) > 0) $this->bindArray($stmtBus, $codes, 'c');
        $stmtBus->execute();
        $busunits = $stmtBus->fetchAll(\PDO::FETCH_COLUMN);

        if (!$busunits || count($busunits) === 0) return [];

        // 3) Find chart_type_id from ANY involved busunit (same logic pattern as yours)
        $ph = [];
        foreach ($busunits as $i => $_) $ph[] = ':b' . $i;

        $sqlChart = "
            SELECT chart_id
            FROM tbl_chart_of_accounts_map
            WHERE busunituuid IN (" . implode(',', $ph) . ")
            LIMIT 1
        ";
        $stmtChart = $this->conn->prepare($sqlChart);
        foreach ($busunits as $i => $b) {
            $stmtChart->bindValue(':b' . $i, (string)$b, \PDO::PARAM_STR);
        }
        $stmtChart->execute();
        $charttypeid = (string)$stmtChart->fetchColumn();

        if (!$charttypeid) return [];

        // 4) Derived COA table (no CTE)
        $coaSql = "
            SELECT
                glcode,
                MIN(gl_description) AS gl_description
            FROM lkp_chart_of_accounts
            WHERE deletestatus = 'Active'
              AND chart_type_id = :coaId
            GROUP BY glcode
        ";

        // 5) Main query: groups x coa LEFT JOIN transactions
        // ✅ CROSS JOIN ensures every gl appears for every group (even if amount=0)
        $sql = "
            SELECT
                gm.group_code,
                gm.group_name,
                coa.glcode,
                coa.gl_description,
                COALESCE(SUM(t.amount), 0) AS amount
            FROM ($groupMapSql) gm
            CROSS JOIN ($coaSql) coa
            LEFT JOIN tbl_accounting_transactions t
              ON t.glcode = coa.glcode
             AND t.busunitcode = gm.busunitcode
             AND t.approvalstatus = 'Posted'
             AND t.transdate BETWEEN :dateFrom AND :dateTo
            GROUP BY
                gm.group_code,
                gm.group_name,
                coa.glcode,
                coa.gl_description
            ORDER BY
                gm.group_name,
                coa.glcode
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':coaId', $charttypeid, \PDO::PARAM_STR);
        $stmt->bindValue(':dateFrom', $from, \PDO::PARAM_STR);
        $stmt->bindValue(':dateTo', $to, \PDO::PARAM_STR);

        if (count($codes) > 0) $this->bindArray($stmt, $codes, 'c');

        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
