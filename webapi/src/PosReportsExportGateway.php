<?php

declare(strict_types=1);

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class PosReportsExportGateway
{
    private PDO $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function exportReport(
        string $report,
        string $datefrom,
        string $dateto,
        bool $includeVoided = false,
        bool $voidOnly = false,
        string $year = '',
        string $busunitcode = ''
    ): void {
        $statusSql = $this->buildStatusSql($includeVoided, $voidOnly);
        $txWhere = $this->buildBusunitWhere('t', $busunitcode);

        $timeExpr = "COALESCE(
            STR_TO_DATE(t.transaction_time, '%h:%i:%s %p'),
            STR_TO_DATE(t.transaction_time, '%h:%i %p'),
            STR_TO_DATE(t.transaction_time, '%H:%i:%s'),
            STR_TO_DATE(t.transaction_time, '%H:%i')
        )";
        $hourExpr = "HOUR($timeExpr)";

        if ($report === 'daily') {
            $this->exportDaily($datefrom, $dateto, $statusSql, $txWhere, $busunitcode);
            return;
        }

        if ($report === 'hourly') {
            $this->exportHourly($datefrom, $dateto, $statusSql, $txWhere, $hourExpr, $busunitcode);
            return;
        }

        if ($report === 'perproduct') {
            $this->exportPerProduct($datefrom, $dateto, $statusSql, $txWhere, $busunitcode);
            return;
        }

        if ($report === 'hourlyperproduct') {
            $this->exportHourlyPerProduct($datefrom, $dateto, $statusSql, $txWhere, $hourExpr, $busunitcode);
            return;
        }

        if ($report === 'yearlyperproduct') {
            $this->exportYearlyPerProduct($year, $statusSql, $txWhere, $busunitcode);
            return;
        }

        http_response_code(400);
        echo 'Unknown report';
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

    private function hourLabel12(int $h): string
    {
        $ampm = $h < 12 ? 'AM' : 'PM';
        $hr12 = $h % 12;
        if ($hr12 === 0) {
            $hr12 = 12;
        }

        return str_pad((string) $hr12, 2, '0', STR_PAD_LEFT) . ':00 ' . $ampm;
    }

    private function streamCsvHeaders(string $filename): void
    {
        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"$filename\"");
    }

    private function exportDaily(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $txWhere,
        string $busunitcode
    ): void {
        $filename = "daily_{$datefrom}_to_{$dateto}.csv";
        $this->streamCsvHeaders($filename);

        $out = fopen('php://output', 'w');

        $headers = [
            'Date',
            'Gross Sales',
            'SRC Disc.',
            'PWD Disc.',
            'NAAC Disc.',
            'Solo Parent Disc.',
            'Other Disc.',
            'Cash Payment',
            'Cheque Payment',
            'Card Payment',
            'GCash Payment',
            'Maya Payment',
            'Other Payment',
            'VATable Sales',
            'VAT Amount',
            'VAT Exempt Sales',
            'VAT Exemption',
            'Net Sales',
        ];
        fputcsv($out, $headers);

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

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $line = [];
            foreach ($headers as $h) {
                $line[] = $row[$h] ?? '';
            }
            fputcsv($out, $line);
        }

        fclose($out);
        exit;
    }

    private function exportHourly(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $txWhere,
        string $hourExpr,
        string $busunitcode
    ): void {
        $filename = "hourly_{$datefrom}_to_{$dateto}.csv";
        $this->streamCsvHeaders($filename);

        $out = fopen('php://output', 'w');

        $hourHeaders = [];
        for ($h = 0; $h < 24; $h++) {
            $hourHeaders[] = $this->hourLabel12($h);
        }

        $headers = array_merge(['Date', 'Total Sales'], $hourHeaders);
        fputcsv($out, $headers);

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

        $map = [];
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $d = $r['Date'];
            $h = (int) $r['hr'];
            $amt = (float) $r['amount'];

            if (!isset($map[$d])) {
                $map[$d] = [
                    'Date' => $d,
                    'Total Sales' => 0,
                    'hours' => array_fill(0, 24, 0),
                ];
            }

            if ($h >= 0 && $h <= 23) {
                $map[$d]['hours'][$h] += $amt;
                $map[$d]['Total Sales'] += $amt;
            }
        }

        foreach ($map as $row) {
            $line = [$row['Date'], $row['Total Sales']];
            for ($h = 0; $h < 24; $h++) {
                $line[] = $row['hours'][$h];
            }
            fputcsv($out, $line);
        }

        fclose($out);
        exit;
    }

    private function exportPerProduct(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $txWhere,
        string $busunitcode
    ): void {
        $filename = "perproduct_{$datefrom}_to_{$dateto}.csv";
        $this->streamCsvHeaders($filename);

        $out = fopen('php://output', 'w');

        $headers = ['Code', 'Product Name', 'Item Type', 'Total Qty Sold', 'Gross Sales'];
        fputcsv($out, $headers);

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
              AND ($txWhere)
            GROUP BY d.product_id, b.desc
            ORDER BY `Product Name` ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':datefrom', $datefrom, PDO::PARAM_STR);
        $stmt->bindValue(':dateto', $dateto, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $line = [];
            foreach ($headers as $h) {
                $line[] = $row[$h] ?? '';
            }
            fputcsv($out, $line);
        }

        fclose($out);
        exit;
    }

    private function exportHourlyPerProduct(
        string $datefrom,
        string $dateto,
        string $statusSql,
        string $txWhere,
        string $hourExpr,
        string $busunitcode
    ): void {
        $filename = "hourlyperproduct_{$datefrom}_to_{$dateto}.csv";
        $this->streamCsvHeaders($filename);

        $out = fopen('php://output', 'w');

        $hourHeaders = [];
        for ($h = 0; $h < 24; $h++) {
            $hourHeaders[] = $this->hourLabel12($h);
        }

        $headers = array_merge(['Code', 'Category', 'Product Name'], $hourHeaders, ['TOTAL']);
        fputcsv($out, $headers);

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
              AND ($txWhere)
            GROUP BY d.product_id, Category, `Product Name`, $hourExpr
            ORDER BY `Product Name` ASC, hr ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':datefrom', $datefrom, PDO::PARAM_STR);
        $stmt->bindValue(':dateto', $dateto, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        $map = [];
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $code = $r['Code'];

            if (!isset($map[$code])) {
                $map[$code] = [
                    'Code' => $code,
                    'Category' => $r['Category'],
                    'Product Name' => $r['Product Name'],
                    'hours' => array_fill(0, 24, 0),
                    'TOTAL' => 0,
                ];
            }

            $h = (int) $r['hr'];
            $q = (float) $r['qty'];

            if ($h >= 0 && $h <= 23) {
                $map[$code]['hours'][$h] += $q;
                $map[$code]['TOTAL'] += $q;
            }
        }

        foreach ($map as $row) {
            $line = [$row['Code'], $row['Category'], $row['Product Name']];
            for ($h = 0; $h < 24; $h++) {
                $line[] = $row['hours'][$h];
            }
            $line[] = $row['TOTAL'];
            fputcsv($out, $line);
        }

        fclose($out);
        exit;
    }

    private function exportYearlyPerProduct(
        string $year,
        string $statusSql,
        string $txWhere,
        string $busunitcode
    ): void {
        $sql = "
            SELECT
                d.product_id AS code,
                COALESCE(b.desc, d.product_id) AS product_name,
                'PRODUCT' AS item_type,
                MONTH(d.transaction_date) AS sale_month,
                SUM(d.sales_quantity) AS total_qty,
                SUM(d.sales_quantity * d.selling_price) AS gross_sales
            FROM tbl_pos_transactions_detailed d
            INNER JOIN tbl_pos_transactions t
                ON t.transaction_id = d.transaction_id
            LEFT JOIN lkp_build_of_products b
                ON b.productcode = d.product_id
            WHERE YEAR(d.transaction_date) = :year
              AND $statusSql
              AND ($txWhere)
            GROUP BY
                d.product_id,
                COALESCE(b.desc, d.product_id),
                MONTH(d.transaction_date)
            ORDER BY COALESCE(b.desc, d.product_id) ASC
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':year', $year, PDO::PARAM_STR);
        $this->bindBusunitIfNeeded($stmt, $busunitcode);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];

        foreach ($rows as $row) {
            $code = $row['code'];
            $productName = $row['product_name'];
            $itemType = $row['item_type'];
            $month = (int) $row['sale_month'];
            $qty = (float) $row['total_qty'];
            $gross = (float) $row['gross_sales'];
            $category = $this->getProductCategory($productName);

            $key = $category . '||' . $code . '||' . $productName;

            if (!isset($data[$key])) {
                $data[$key] = [
                    'category' => $category,
                    'code' => $code,
                    'product_name' => $productName,
                    'item_type' => $itemType,
                    'months' => [],
                    'total_qty' => 0,
                    'total_gross' => 0,
                ];

                for ($m = 1; $m <= 12; $m++) {
                    $data[$key]['months'][$m] = [
                        'qty' => 0,
                        'gross' => 0,
                    ];
                }
            }

            $data[$key]['months'][$month]['qty'] += $qty;
            $data[$key]['months'][$month]['gross'] += $gross;
            $data[$key]['total_qty'] += $qty;
            $data[$key]['total_gross'] += $gross;
        }

        $data = array_values($data);

        usort($data, function ($a, $b) {
            $order = [
                'ADD ONS' => 1,
                'REGULAR' => 2,
                'UPSIZED' => 3,
                'LOAD' => 4,
                'OTHERS' => 5,
            ];

            $aOrder = $order[$a['category']] ?? 99;
            $bOrder = $order[$b['category']] ?? 99;

            if ($aOrder === $bOrder) {
                return strcmp($a['product_name'], $b['product_name']);
            }

            return $aOrder <=> $bOrder;
        });

        $sheetGroups = [
            'ADD ONS' => [],
            'REGULAR' => [],
            'UPSIZED' => [],
            'LOAD' => [],
            'OTHERS' => [],
        ];

        foreach ($data as $item) {
            if (isset($sheetGroups[$item['category']])) {
                $sheetGroups[$item['category']][] = $item;
            } else {
                $sheetGroups['OTHERS'][] = $item;
            }
        }

        $headers = [
            'Code',
            'Product Name',
            'Item Type',
            'Jan Qty', 'Jan Gross',
            'Feb Qty', 'Feb Gross',
            'Mar Qty', 'Mar Gross',
            'Apr Qty', 'Apr Gross',
            'May Qty', 'May Gross',
            'Jun Qty', 'Jun Gross',
            'Jul Qty', 'Jul Gross',
            'Aug Qty', 'Aug Gross',
            'Sep Qty', 'Sep Gross',
            'Oct Qty', 'Oct Gross',
            'Nov Qty', 'Nov Gross',
            'Dec Qty', 'Dec Gross',
            'Total Qty',
            'Total Gross Sales',
        ];

        $spreadsheet = new Spreadsheet();

        $fillSheet = function ($sheet, $sheetName, $items, $headers) {
            $sheet->setTitle(substr($sheetName, 0, 31));

            foreach ($headers as $index => $header) {
                $columnLetter = Coordinate::stringFromColumnIndex($index + 1);
                $sheet->setCellValue($columnLetter . '1', $header);
            }

            $rowNum = 2;

            foreach ($items as $item) {
                $sheet->setCellValue('A' . $rowNum, $item['code']);
                $sheet->setCellValue('B' . $rowNum, $item['product_name']);
                $sheet->setCellValue('C' . $rowNum, $item['item_type']);

                $colIndex = 4;

                for ($m = 1; $m <= 12; $m++) {
                    $qtyCol = Coordinate::stringFromColumnIndex($colIndex);
                    $grossCol = Coordinate::stringFromColumnIndex($colIndex + 1);

                    $sheet->setCellValue($qtyCol . $rowNum, $item['months'][$m]['qty']);
                    $sheet->setCellValue($grossCol . $rowNum, $item['months'][$m]['gross']);

                    $colIndex += 2;
                }

                $sheet->setCellValue('AB' . $rowNum, $item['total_qty']);
                $sheet->setCellValue('AC' . $rowNum, $item['total_gross']);

                $rowNum++;
            }

            $lastColumn = 'AC';
            $lastRow = max(2, $sheet->getHighestRow());

            $sheet->getStyle("A1:{$lastColumn}1")->getFont()->setBold(true);

            for ($i = 1; $i <= 29; $i++) {
                $colLetter = Coordinate::stringFromColumnIndex($i);
                $sheet->getColumnDimension($colLetter)->setAutoSize(true);
            }

            $sheet->freezePane('A2');
            $sheet->setAutoFilter("A1:{$lastColumn}1");

            $grossColumns = ['E','G','I','K','M','O','Q','S','U','W','Y','AA','AC'];
            foreach ($grossColumns as $col) {
                $sheet->getStyle("{$col}2:{$col}{$lastRow}")
                    ->getNumberFormat()
                    ->setFormatCode('#,##0.00');
            }

            $qtyColumns = ['D','F','H','J','L','N','P','R','T','V','X','Z','AB'];
            foreach ($qtyColumns as $col) {
                $sheet->getStyle("{$col}2:{$col}{$lastRow}")
                    ->getNumberFormat()
                    ->setFormatCode('#,##0.00');
            }
        };

        $sheetNames = ['ADD ONS', 'REGULAR', 'UPSIZED', 'LOAD', 'OTHERS'];
        $sheetIndex = 0;

        foreach ($sheetNames as $groupName) {
            $items = $sheetGroups[$groupName];

            if ($sheetIndex === 0) {
                $sheet = $spreadsheet->getActiveSheet();
            } else {
                $sheet = $spreadsheet->createSheet();
            }

            $fillSheet($sheet, $groupName, $items, $headers);
            $sheetIndex++;
        }

        $spreadsheet->setActiveSheetIndex(0);

        $filename = "yearlyperproduct_{$year}.xlsx";

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"$filename\"");
        header('Cache-Control: max-age=0');

        $writer = new Xlsx($spreadsheet);
        $writer->save('php://output');
        exit;
    }

    private function getProductCategory(string $productName): string
    {
        $name = strtoupper(trim($productName));

        if (strpos($name, 'ADD ONS') !== false) {
            return 'ADD ONS';
        }

        if ($name === 'UPSIZED' || strpos($name, 'UPSIZED') === 0) {
            return 'UPSIZED';
        }

        if (strpos($name, 'REGULAR') === 0) {
            return 'REGULAR';
        }

        if (strpos($name, 'LOAD') !== false) {
            return 'LOAD';
        }

        return 'OTHERS';
    }
}