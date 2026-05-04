<?php

class ProfitLossGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getProfitAndLoss(string $busunit, string $dateTo): array
    {
        // Compute our date boundaries
        $ytdStart      = date('Y-01-01', strtotime($dateTo));
        $thisMonStart  = date('Y-m-01', strtotime($dateTo));
        $lastMonStart  = date('Y-m-01', strtotime('first day of previous month', strtotime($dateTo)));
        $lastMonEnd    = date('Y-m-t',  strtotime('last day of previous month',  strtotime($dateTo)));

        $sql = "SELECT chart_id FROM tbl_chart_of_accounts_map
                WHERE busunituuid = :busunit LIMIT 1";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(':busunit',      $busunit,   \PDO::PARAM_STR);
            $stmt->execute();
            $charttypeid = $stmt->fetchColumn();  
            
            
                $sql = <<<SQL
        WITH coa AS (
            SELECT
                chart_type_id,
                glcode,
                MIN(gl_description) AS gl_description,
                deletestatus
            FROM lkp_chart_of_accounts
            WHERE deletestatus = 'Active'
            AND chart_type_id = :coaId1
            GROUP BY glcode
        )
        SELECT
            c.glcode,
            c.gl_description,
            /* YTD bucket */
            COALESCE(SUM(CASE WHEN t.transdate BETWEEN :ytdStart AND :ytdEnd THEN t.amount ELSE 0 END), 0) AS ytd,
            /* This Month bucket */
            COALESCE(SUM(CASE WHEN t.transdate BETWEEN :thisMonStart AND :thisMonEnd THEN t.amount ELSE 0 END), 0) AS this_month,
            /* Last Month bucket */
            COALESCE(SUM(CASE WHEN t.transdate BETWEEN :lastMonStart AND :lastMonEnd THEN t.amount ELSE 0 END), 0) AS last_month
        FROM coa AS c
        LEFT JOIN tbl_accounting_transactions AS t
            ON t.glcode         = c.glcode
            AND t.busunitcode    = :busunit
            AND t.approvalstatus = 'Posted'
        WHERE c.chart_type_id = :coaId2
        AND c.deletestatus = 'Active'
        GROUP BY
            c.glcode,
            c.gl_description
        ORDER BY
            c.glcode;
        SQL;

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':coaId1',   $charttypeid, \PDO::PARAM_STR);
        $stmt->bindValue(':busunit',      $busunit,   \PDO::PARAM_STR);
        $stmt->bindValue(':ytdStart',     $ytdStart,  \PDO::PARAM_STR);
        $stmt->bindValue(':ytdEnd',       $dateTo,    \PDO::PARAM_STR);
        $stmt->bindValue(':thisMonStart', $thisMonStart, \PDO::PARAM_STR);
        $stmt->bindValue(':thisMonEnd',   $dateTo,    \PDO::PARAM_STR);
        $stmt->bindValue(':lastMonStart', $lastMonStart, \PDO::PARAM_STR);
        $stmt->bindValue(':lastMonEnd',   $lastMonEnd, \PDO::PARAM_STR);
        $stmt->bindValue(':coaId2',   $charttypeid, \PDO::PARAM_STR);

        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
