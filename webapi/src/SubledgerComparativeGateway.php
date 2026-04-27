<?php

class SubledgerComparativeGateway
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

        if ($from === $to) {
            $from = date('Y-01-01', strtotime($to));
        }
        return [$from, $to];
    }

    public function getSubledger(string $groupBy, string $groupCode, int $glcode, string $dateFrom, string $dateTo): array
    {
        [$from, $to] = $this->normalizeDates($dateFrom, $dateTo);

        $groupBy = strtoupper($groupBy);
        if (!in_array($groupBy, ['BUSUNIT', 'AREA', 'CORP', 'BRAND'], true)) {
            $groupBy = 'BUSUNIT';
        }

        if (!$groupCode || !$glcode) return [];

        // Resolve busunits under the selected entity
        if ($groupBy === 'BUSUNIT') {
            $busunitSql = "SELECT busunitcode FROM lkp_busunits WHERE deletestatus='Active' AND busunitcode = :g LIMIT 1";
        } elseif ($groupBy === 'AREA') {
            $busunitSql = "SELECT busunitcode FROM lkp_busunits WHERE deletestatus='Active' AND areacode = :g";
        } elseif ($groupBy === 'CORP') {
            $busunitSql = "SELECT busunitcode FROM lkp_busunits WHERE deletestatus='Active' AND corpcode = :g";
        } else { // BRAND
            $busunitSql = "SELECT busunitcode FROM lkp_busunits WHERE deletestatus='Active' AND brandcode = :g";
        }

        $stmtB = $this->conn->prepare($busunitSql);
        $stmtB->bindValue(':g', $groupCode, \PDO::PARAM_STR);
        $stmtB->execute();
        $busunits = $stmtB->fetchAll(\PDO::FETCH_COLUMN);

        if (!$busunits || count($busunits) === 0) return [];

        // Dynamic IN placeholders
        $ph = [];
        foreach ($busunits as $i => $_) $ph[] = ':b' . $i;

        $sql = "
            SELECT
                t.transdate,
                t.reference,
                t.particulars,
                t.busunitcode,
                t.amount
            FROM tbl_accounting_transactions t
            WHERE t.approvalstatus = 'Posted'
              AND t.glcode = :gl
              AND t.transdate BETWEEN :df AND :dt
              AND t.busunitcode IN (" . implode(',', $ph) . ")
            ORDER BY t.transdate ASC, t.reference ASC
            LIMIT 2000
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':gl', $glcode, \PDO::PARAM_INT);
        $stmt->bindValue(':df', $from, \PDO::PARAM_STR);
        $stmt->bindValue(':dt', $to, \PDO::PARAM_STR);

        foreach ($busunits as $i => $b) {
            $stmt->bindValue(':b' . $i, (string)$b, \PDO::PARAM_STR);
        }

        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
