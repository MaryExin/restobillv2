<?php

class ModalSubledgerListGateway
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
     * Returns list of busunitcode for AREA/CORPORATION/BRAND filters.
     * Uses your real lkp_busunits columns: areacode, corpcode, brandcode.
     */
    private function getBusunitsByGroup(string $filterType, string $filterValue): array
    {
        $col = null;

        if ($filterType === 'AREA')         $col = 'areacode';
        if ($filterType === 'CORPORATION')  $col = 'corpcode';
        if ($filterType === 'BRAND')        $col = 'brandcode';

        if (!$col || trim($filterValue) === '') return [];

        // NOTE: column name is whitelisted above (safe)
        $sql = "SELECT busunitcode
                FROM lkp_busunits
                WHERE deletestatus = 'Active'
                  AND {$col} = ?";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([trim($filterValue)]);
        return $stmt->fetchAll(\PDO::FETCH_COLUMN) ?: [];
    }

    /**
     * Supports:
     * - BUSUNIT: uses $busunit (or filterValue if filterType=BUSUNIT and busunit empty)
     * - AREA: areacode = filterValue
     * - CORPORATION/CORP: corpcode = filterValue
     * - BRAND: brandcode = filterValue
     */
    public function getSubledgerList(
        string $busunit,
        string $dateTo,
        string $glCode,
        string $filterType = '',
        string $filterValue = ''
    ): array
    {
        $filterType  = $this->normalizeFilterType($filterType);
        $filterValue = trim($filterValue);

        // If frontend uses filterType=BUSUNIT and passes BU-xxxx in filterValue
        if ((trim($busunit) === '') && $filterType === 'BUSUNIT' && $filterValue !== '') {
            $busunit = $filterValue;
        }

        $useGroup = in_array($filterType, ['AREA','CORPORATION','BRAND'], true) && $filterValue !== '';

        // Resolve BU scope
        $busunits = [];
        if ($useGroup) {
            $busunits = $this->getBusunitsByGroup($filterType, $filterValue);
            if (count($busunits) === 0) return []; // no BU in that group
        } else {
            if (trim($busunit) === '') return [];  // no BU scope provided
            $busunits = [$busunit];
        }

        // Normalize GL prefix (LEFT(slcode,3))
        $glPrefix = str_pad((string)$glCode, 3, '0', STR_PAD_LEFT);

        // Build IN placeholders for BU scope
        $inPlaceholders = implode(',', array_fill(0, count($busunits), '?'));

        // ✅ Simple + fast: left join transactions directly (no derived table)
        // Keep BU/date filters inside JOIN so COA rows still show with 0 cumulative.
        $sql = "
            SELECT
                LEFT(coa.slcode, 3) AS glcode,
                coa.slcode,
                MIN(coa.sl_description) AS sl_description,
                COALESCE(SUM(t.amount), 0) AS cumulative
            FROM lkp_chart_of_accounts coa
            LEFT JOIN tbl_accounting_transactions t
                   ON t.slcode = coa.slcode
                  AND t.approvalstatus = 'Posted'
                  AND t.deletestatus   = 'Active'
                  AND t.transdate      <= ?
                  AND t.busunitcode IN ($inPlaceholders)
            WHERE coa.deletestatus = 'Active'
              AND LEFT(coa.slcode, 3) = ?
            GROUP BY coa.slcode
            ORDER BY coa.slcode ASC
        ";

        // params: dateTo, busunits..., glPrefix
        $params = array_merge([$dateTo], $busunits, [$glPrefix]);

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
