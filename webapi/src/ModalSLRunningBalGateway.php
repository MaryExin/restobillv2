<?php

class ModalSLRunningBalGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    private function normalizeFilterType(string $filterType): string
    {
        $ft = strtoupper(trim($filterType));
        if ($ft === 'CORP') $ft = 'CORPORATION';
        if ($ft === 'BU')   $ft = 'BUSUNIT';
        return $ft;
    }

    /**
     * Returns array of busunitcode (BU-xxxx) for AREA/CORPORATION/BRAND.
     * Uses your real lkp_busunits fields: areacode/corpcode/brandcode.
     */
    private function getBusunitsByGroup(string $filterType, string $filterValue): array
    {
        $filterValue = trim($filterValue);
        if ($filterValue === '') return [];

        $col = null;
        if ($filterType === 'AREA')        $col = 'areacode';
        if ($filterType === 'CORPORATION') $col = 'corpcode';
        if ($filterType === 'BRAND')       $col = 'brandcode';
        if (!$col) return [];

        // column name is whitelisted above (safe)
        $sql = "SELECT busunitcode
                FROM lkp_busunits
                WHERE deletestatus = 'Active'
                  AND {$col} = ?";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([$filterValue]);
        return $stmt->fetchAll(\PDO::FETCH_COLUMN) ?: [];
    }

    public function getSLRunningBal(
        string $busunit,
        string $dateTo,
        string $slCode,
        string $filterType = '',
        string $filterValue = ''
    ): array
    {
        $dateTo  = trim($dateTo);
        $slCode  = trim($slCode);
        $busunit = trim($busunit);

        if ($dateTo === '' || $slCode === '') {
            return [
                'sldata'  => [],
                'begdata' => ['begbal' => 0],
            ];
        }

        $ytdStart = date('Y-01-01', strtotime($dateTo));

        // Normalize filters
        $filterType  = $this->normalizeFilterType($filterType);
        $filterValue = trim($filterValue);

        // BUSUNIT mode can come from filterValue
        if ($filterType === 'BUSUNIT' && $busunit === '' && $filterValue !== '') {
            $busunit = $filterValue;
        }

        $useGroup = in_array($filterType, ['AREA','CORPORATION','BRAND'], true) && $filterValue !== '';

        // Resolve scope busunits
        if ($useGroup) {
            $busunits = $this->getBusunitsByGroup($filterType, $filterValue);
            if (count($busunits) === 0) {
                return [
                    'sldata'  => [],
                    'begdata' => ['begbal' => 0],
                ];
            }
        } else {
            if ($busunit === '') {
                return [
                    'sldata'  => [],
                    'begdata' => ['begbal' => 0],
                ];
            }
            $busunits = [$busunit];
        }

        $inPlaceholders = implode(',', array_fill(0, count($busunits), '?'));

        // ---------------- 1) Detailed transactions (sldata) ----------------
        $sql = "
            SELECT
              ta.transdate,
              ta.amount,
              ta.particulars,
              ta.reference,
              COALESCE(tc.customername, 'NA')  AS customer,
              COALESCE(ls.supplier_name, 'NA') AS supplier,
              ta.busunitcode
            FROM tbl_accounting_transactions AS ta
            LEFT JOIN tbl_customer_details AS tc
              ON ta.customer_id = tc.customer_id
            LEFT JOIN lkp_supplier AS ls
              ON ta.supplier_code = ls.supplier_code
            WHERE ta.slcode = ?
              AND ta.transdate BETWEEN ? AND ?
              AND ta.approvalstatus = 'Posted'
              AND ta.deletestatus   = 'Active'
              AND ta.busunitcode IN ($inPlaceholders)
            ORDER BY ta.transdate DESC
        ";

        $params = array_merge([$slCode, $ytdStart, $dateTo], $busunits);

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        $sldata = $stmt->fetchAll(\PDO::FETCH_ASSOC);

        // ---------------- 2) Beginning balance (begdata) ----------------
        $begSql = "
            SELECT COALESCE(SUM(amount), 0) AS begbal
            FROM tbl_accounting_transactions
            WHERE slcode         = ?
              AND transdate      < ?
              AND approvalstatus = 'Posted'
              AND deletestatus   = 'Active'
              AND busunitcode IN ($inPlaceholders)
        ";

        $begParams = array_merge([$slCode, $ytdStart], $busunits);

        $begStmt = $this->conn->prepare($begSql);
        $begStmt->execute($begParams);
        $begdata = $begStmt->fetch(\PDO::FETCH_ASSOC);

        return [
            'sldata'  => $sldata,
            'begdata' => $begdata ?: ['begbal' => 0],
        ];
    }
}
