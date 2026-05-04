<?php

declare(strict_types=1);

class PosReportsDashboardGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getDashboardData(
        string $datefrom,
        string $dateto,
        string $graph_datefrom,
        string $graph_dateto,
        bool $includeVoided = false,
        bool $voidOnly = false,
        string $busunitcode = ''
    ): array {
        try {
            $statusSql = $this->buildStatusSql($includeVoided, $voidOnly);
            $txWhere = $this->buildBusunitWhere('t', $busunitcode);
            $detailWhere = $this->buildBusunitWhere('t', $busunitcode);

            $timeExpr = "COALESCE(
                STR_TO_DATE(t.transaction_time, '%h:%i:%s %p'),
                STR_TO_DATE(t.transaction_time, '%h:%i %p'),
                STR_TO_DATE(t.transaction_time, '%H:%i:%s'),
                STR_TO_DATE(t.transaction_time, '%H:%i')
            )";
            $hourExpr = "HOUR($timeExpr)";

            $kpi = $this->getKpi($datefrom, $dateto, $statusSql, $txWhere, $busunitcode);
            $dailyRows = $this->getDailyRows($datefrom, $dateto, $statusSql, $txWhere, $busunitcode);
            $dailyGraphRows = $this->getDailyGraphRows($graph_datefrom, $graph_dateto, $statusSql, $txWhere, $busunitcode);
            $hourlyRows = $this->getHourlyRows($datefrom, $dateto, $statusSql, $txWhere, $hourExpr, $busunitcode);
            $perProductRows = $this->getPerProductRows($datefrom, $dateto, $statusSql, $detailWhere, $busunitcode);
            $hourlyPerProductRows = $this->getHourlyPerProductRows($datefrom, $dateto, $statusSql, $detailWhere, $hourExpr, $busunitcode);

            return [
                'filters' => [
                    'datefrom' => $datefrom,
                    'dateto' => $dateto,
                    'graph_datefrom' => $graph_datefrom,
                    'graph_dateto' => $graph_dateto,
                    'includeVoided' => $includeVoided,
                    'voidOnly' => $voidOnly,
                    'busunitcode' => $busunitcode,
                ],
                'kpi' => $kpi,
                'dailySales' => $dailyRows,
                'dailyGraph' => $dailyGraphRows,
                'hourlySales' => $hourlyRows,
                'salesPerProduct' => $perProductRows,
                'hourlySalesPerProduct' => $hourlyPerProductRows,
            ];
        } catch (Throwable $e) {
            http_response_code(500);
            return [
                'message' => 'Failed',
                'error' => $e->getMessage(),
                'filters' => [
                    'datefrom' => $datefrom,
                    'dateto' => $dateto,
                    'graph_datefrom' => $graph_datefrom,
                    'graph_dateto' => $graph_dateto,
                    'includeVoided' => $includeVoided,
                    'voidOnly' => $voidOnly,
                    'busunitcode' => $busunitcode,
                ],
                'kpi' => [
                    'txn_count' => 0,
                    'gross_sales' => 0,
                    'discount_total' => 0,
                    'net_sales' => 0,
                    'vatable_sales' => 0,
                    'vat_amount' => 0,
                    'vat_exempt_sales' => 0,
                    'vat_exemption' => 0,
                ],
                'dailySales' => [],
                'dailyGraph' => [],
                'hourlySales' => [],
                'salesPerProduct' => [],
                'hourlySalesPerProduct' => [],
            ];
        }
    }

    private function buildStatusSql(bool $includeVoided, bool $voidOnly): string
    {
        if ($voidOnly) {
            return "t.status = 'Voided'";
        }

        if ($includeVoided) {
            return "(t.status = 'Active' OR t.status = 'Voided')";
        }

        return "t.status = 'Active'";
    }

    private function buildBusunitWhere(string $alias, string $busunitcode): string
    {
        if (trim($busunitcode) === '') {
            return '1=1';
        }

        return "{$alias}.Unit_Code = :busunitcode";
    }

    private function bindBusunitIfNeeded(PDOStatement $stmt, string $busunitcode): void
    {
        if (trim($busunitcode) !== '') {
            $stmt->bindValue(':busunitcode', $busunitcode, PDO::PARAM_STR);
        }
    }

    private function getKpi(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $txWhere,
        string $busunitcode
    ): array {
        $sql = "
            SELECT
                SUM(CASE WHEN $statusSql THEN 1 ELSE 0 END) AS txn_count,
                SUM(CASE WHEN $statusSql THEN t.TotalSales ELSE 0 END) AS gross_sales,
                SUM(CASE WHEN $statusSql THEN t.Discount ELSE 0 END) AS discount_total,
                SUM(CASE WHEN $statusSql THEN t.TotalAmountDue ELSE 0 END) AS net_sales,
                SUM(CASE WHEN $statusSql THEN t.VATableSales ELSE 0 END) AS vatable_sales,
                SUM(CASE WHEN $statusSql THEN t.VATableSales_VAT ELSE 0 END) AS vat_amount,
                SUM(CASE WHEN $statusSql THEN t.VATExemptSales ELSE 0 END) AS vat_exempt_sales,
                SUM(CASE WHEN $statusSql THEN t.VATExemptSales_VAT ELSE 0 END) AS vat_exemption
            FROM tbl_pos_transactions t
            WHERE t.transaction_date BETWEEN :datefrom AND :dateto
              AND ($txWhere)
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':datefrom', $datefrom, PDO::PARAM_STR);
        $stmt->bindValue(':dateto', $dateto, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: [
            'txn_count' => 0,
            'gross_sales' => 0,
            'discount_total' => 0,
            'net_sales' => 0,
            'vatable_sales' => 0,
            'vat_amount' => 0,
            'vat_exempt_sales' => 0,
            'vat_exemption' => 0,
        ];
    }

    private function getDailyRows(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $txWhere,
        string $busunitcode
    ): array {
        $sql = "
            SELECT
                t.transaction_date AS Date,

                SUM(CASE WHEN $statusSql THEN t.TotalSales ELSE 0 END) AS `Gross Sales`,

                SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%Senior%' THEN t.Discount ELSE 0 END) AS `SRC Disc.`,
                SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%PWD%' THEN t.Discount ELSE 0 END) AS `PWD Disc.`,
                SUM(CASE WHEN $statusSql AND (t.discount_type LIKE '%NAAC%' OR t.discount_type LIKE '%NACC%') THEN t.Discount ELSE 0 END) AS `NAAC Disc.`,
                SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%Solo%' THEN t.Discount ELSE 0 END) AS `Solo Parent Disc.`,

                SUM(
                    CASE
                        WHEN $statusSql
                         AND t.Discount > 0
                         AND t.discount_type NOT LIKE '%Senior%'
                         AND t.discount_type NOT LIKE '%PWD%'
                         AND t.discount_type NOT LIKE '%NAAC%'
                         AND t.discount_type NOT LIKE '%NACC%'
                         AND t.discount_type NOT LIKE '%Solo%'
                         AND t.discount_type NOT LIKE '%No Discount%'
                        THEN t.Discount ELSE 0
                    END
                ) AS `Other Disc.`,

                SUM(
                    CASE
                        WHEN $statusSql AND t.payment_method = 'Cash'
                        THEN (t.payment_amount - IFNULL(t.change_amount,0))
                        ELSE 0
                    END
                ) AS `Cash Payment`,

                SUM(CASE WHEN $statusSql AND t.payment_method LIKE '%Cheque%' THEN t.payment_amount ELSE 0 END) AS `Cheque Payment`,
                SUM(CASE WHEN $statusSql AND (t.payment_method LIKE '%Card%' OR t.payment_method LIKE '%BDO%') THEN t.payment_amount ELSE 0 END) AS `Card Payment`,
                SUM(CASE WHEN $statusSql AND t.payment_method LIKE '%GCash%' THEN t.payment_amount ELSE 0 END) AS `GCash Payment`,
                SUM(CASE WHEN $statusSql AND (t.payment_method LIKE '%PayMaya%' OR t.payment_method LIKE '%Maya%') THEN t.payment_amount ELSE 0 END) AS `Maya Payment`,

                SUM(
                    CASE
                        WHEN $statusSql AND (
                            t.payment_method LIKE '%,%'
                            OR (
                                t.payment_method NOT LIKE '%Cash%'
                                AND t.payment_method NOT LIKE '%Cheque%'
                                AND t.payment_method NOT LIKE '%Card%'
                                AND t.payment_method NOT LIKE '%BDO%'
                                AND t.payment_method NOT LIKE '%GCash%'
                                AND t.payment_method NOT LIKE '%PayMaya%'
                                AND t.payment_method NOT LIKE '%Maya%'
                            )
                        )
                        THEN t.payment_amount ELSE 0
                    END
                ) AS `Other Payment`,

                SUM(CASE WHEN $statusSql THEN t.VATableSales ELSE 0 END) AS `VATable Sales`,
                SUM(CASE WHEN $statusSql THEN t.VATableSales_VAT ELSE 0 END) AS `VAT Amount`,
                SUM(CASE WHEN $statusSql THEN t.VATExemptSales ELSE 0 END) AS `VAT Exempt Sales`,
                SUM(CASE WHEN $statusSql THEN t.VATExemptSales_VAT ELSE 0 END) AS `VAT Exemption`,
                SUM(CASE WHEN $statusSql THEN t.TotalAmountDue ELSE 0 END) AS `Net Sales`

            FROM tbl_pos_transactions t
            WHERE t.transaction_date BETWEEN :datefrom AND :dateto
              AND ($txWhere)
            GROUP BY t.transaction_date
            ORDER BY t.transaction_date ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':datefrom', $datefrom, PDO::PARAM_STR);
        $stmt->bindValue(':dateto', $dateto, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getDailyGraphRows(
        string $graph_datefrom,
        string $graph_dateto,
        string $statusSql,
        string $txWhere,
        string $busunitcode
    ): array {
        $sql = "
            SELECT
                t.transaction_date AS Date,

                SUM(CASE WHEN $statusSql THEN t.TotalSales ELSE 0 END) AS `Gross Sales`,
                SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%Senior%' THEN t.Discount ELSE 0 END) AS `SRC Disc.`,
                SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%PWD%' THEN t.Discount ELSE 0 END) AS `PWD Disc.`,
                SUM(CASE WHEN $statusSql AND (t.discount_type LIKE '%NAAC%' OR t.discount_type LIKE '%NACC%') THEN t.Discount ELSE 0 END) AS `NAAC Disc.`,
                SUM(CASE WHEN $statusSql AND t.discount_type LIKE '%Solo%' THEN t.Discount ELSE 0 END) AS `Solo Parent Disc.`,
                SUM(
                    CASE
                        WHEN $statusSql
                         AND t.Discount > 0
                         AND t.discount_type NOT LIKE '%Senior%'
                         AND t.discount_type NOT LIKE '%PWD%'
                         AND t.discount_type NOT LIKE '%NAAC%'
                         AND t.discount_type NOT LIKE '%NACC%'
                         AND t.discount_type NOT LIKE '%Solo%'
                         AND t.discount_type NOT LIKE '%No Discount%'
                        THEN t.Discount ELSE 0
                    END
                ) AS `Other Disc.`,
                SUM(CASE WHEN $statusSql THEN t.TotalAmountDue ELSE 0 END) AS `Net Sales`

            FROM tbl_pos_transactions t
            WHERE t.transaction_date BETWEEN :gfrom AND :gto
              AND ($txWhere)
            GROUP BY t.transaction_date
            ORDER BY t.transaction_date ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':gfrom', $graph_datefrom, PDO::PARAM_STR);
        $stmt->bindValue(':gto', $graph_dateto, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getHourlyRows(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $txWhere,
        string $hourExpr,
        string $busunitcode
    ): array {
        $sql = "
            SELECT
                t.transaction_date AS Date,
                $hourExpr AS hr,
                SUM(CASE WHEN $statusSql THEN t.TotalSales ELSE 0 END) AS amount
            FROM tbl_pos_transactions t
            WHERE t.transaction_date BETWEEN :datefrom AND :dateto
              AND ($txWhere)
            GROUP BY t.transaction_date, $hourExpr
            ORDER BY t.transaction_date ASC, hr ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':datefrom', $datefrom, PDO::PARAM_STR);
        $stmt->bindValue(':dateto', $dateto, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $hourlyMap = [];
        foreach ($raw as $r) {
            $d = $r['Date'];
            $h = (int) $r['hr'];
            $amt = (float) $r['amount'];

            if (!isset($hourlyMap[$d])) {
                $hourlyMap[$d] = [
                    'Date' => $d,
                    'Total Sales' => 0,
                    'hours' => array_fill(0, 24, 0),
                ];
            }

            if ($h >= 0 && $h <= 23) {
                $hourlyMap[$d]['hours'][$h] += $amt;
                $hourlyMap[$d]['Total Sales'] += $amt;
            }
        }

        return array_values($hourlyMap);
    }

    private function getPerProductRows(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $detailWhere,
        string $busunitcode
    ): array {
        $sql = "
            SELECT
                d.product_id AS Code,
                COALESCE(b.desc, d.product_id) AS `Product Name`,
                'PRODUCT' AS `Item Type`,
                SUM(d.sales_quantity) AS `Total Qty Sold`,
                SUM(d.sales_quantity * d.selling_price) AS `Gross Sales`
            FROM tbl_pos_transactions_detailed d
            INNER JOIN tbl_pos_transactions t
                ON t.transaction_id = d.transaction_id
            LEFT JOIN lkp_build_of_products b
                ON b.productcode = d.product_id
            WHERE d.transaction_date BETWEEN :datefrom AND :dateto
              AND $statusSql
              AND ($detailWhere)
            GROUP BY d.product_id, b.desc
            ORDER BY `Product Name` ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':datefrom', $datefrom, PDO::PARAM_STR);
        $stmt->bindValue(':dateto', $dateto, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getHourlyPerProductRows(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $detailWhere,
        string $hourExpr,
        string $busunitcode
    ): array {
        $sql = "
            SELECT
                d.product_id AS Code,
                COALESCE(b.category, 'UNCATEGORIZED') AS Category,
                COALESCE(b.desc, d.product_id) AS `Product Name`,
                $hourExpr AS hr,
                SUM(d.sales_quantity) AS qty
            FROM tbl_pos_transactions_detailed d
            INNER JOIN tbl_pos_transactions t
                ON t.transaction_id = d.transaction_id
            LEFT JOIN lkp_build_of_products b
                ON b.productcode = d.product_id
            WHERE d.transaction_date BETWEEN :datefrom AND :dateto
              AND $statusSql
              AND ($detailWhere)
            GROUP BY d.product_id, Category, `Product Name`, $hourExpr
            ORDER BY `Product Name` ASC, hr ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':datefrom', $datefrom, PDO::PARAM_STR);
        $stmt->bindValue(':dateto', $dateto, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $map = [];
        foreach ($raw as $r) {
            $code = $r['Code'];
            $cat = $r['Category'];
            $name = $r['Product Name'];
            $hr = (int) $r['hr'];
            $qty = (float) $r['qty'];

            if (!isset($map[$code])) {
                $map[$code] = [
                    'Code' => $code,
                    'Category' => $cat,
                    'Product Name' => $name,
                    'hours' => array_fill(0, 24, 0),
                    'TOTAL' => 0,
                ];
            }

            if ($hr >= 0 && $hr <= 23) {
                $map[$code]['hours'][$hr] += $qty;
                $map[$code]['TOTAL'] += $qty;
            }
        }

        return array_values($map);
    }
}