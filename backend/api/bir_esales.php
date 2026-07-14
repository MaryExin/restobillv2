<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') exit;

$config = include 'config.php';

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $conn = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $input = json_decode(file_get_contents("php://input"), true);
    $activeTab = $input['tab'] ?? 'E1';
    $dateFrom = $input['dateFrom'] ?? date('Y-m-d');
    $dateTo = $input['dateTo'] ?? date('Y-m-d');

    $resultData = [];

    if ($activeTab === "E1") {
        $sql = "SELECT * FROM tbl_pos_shifting_records 
                WHERE DATE(`Opening_DateTime`) BETWEEN ? AND ? 
                ORDER BY `Opening_DateTime` ASC";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute([$dateFrom, $dateTo]);
        $shifts = $stmt->fetchAll();

        foreach ($shifts as $shift) {
            $currentDate = date('Y-m-d', strtotime($shift['Opening_DateTime']));
            
            $sumSql = "SELECT
                        SUM(CASE WHEN status = 'Active' THEN TotalSales ELSE 0 END) as gross_day,
                        SUM(CASE WHEN status = 'Active' THEN VATableSales ELSE 0 END) as vatable,
                        SUM(CASE WHEN status = 'Active' THEN VATableSales_VAT ELSE 0 END) as vat_amt,
                        SUM(CASE WHEN status = 'Active' THEN VATExemptSales ELSE 0 END) as exempt,
                        SUM(CASE WHEN status = 'Active' THEN VATExemptSales_VAT ELSE 0 END) as vat_exemption_val,
                        SUM(CASE WHEN status = 'Active' THEN Discount ELSE 0 END) as total_discounts,
                        SUM(CASE WHEN status = 'Voided' THEN TotalAmountDue ELSE 0 END) as total_voids
                       FROM tbl_pos_transactions
                       WHERE DATE(transaction_date) = ?";

            $sumStmt = $conn->prepare($sumSql);
            $sumStmt->execute([$currentDate]);
            $sums = $sumStmt->fetch();

            // Per-type discount totals pulled from tbl_pos_transactions_discounts
            // (same source/discount_type labels as reprint_z_reading.php) so the
            // SC/PWD/NAAC/Solo Parent figures reconcile with the Z-Reading report
            // instead of matching against tbl_pos_transactions' composite
            // discount_type label, which undercounts whenever multiple discount
            // types apply to the same transaction.
            $discSql = "SELECT
                        COALESCE(SUM(CASE WHEN d.discount_type = 'Senior Citizen' THEN d.discount_amount ELSE 0 END), 0) as sc_disc,
                        COALESCE(SUM(CASE WHEN d.discount_type = 'PWD' THEN d.discount_amount ELSE 0 END), 0) as pwd_disc,
                        COALESCE(SUM(CASE WHEN d.discount_type = 'NAAC' THEN d.discount_amount ELSE 0 END), 0) as naac_disc,
                        COALESCE(SUM(CASE WHEN d.discount_type = 'Solo Parent' THEN d.discount_amount ELSE 0 END), 0) as solo_disc
                       FROM tbl_pos_transactions_discounts d
                       INNER JOIN tbl_pos_transactions t
                           ON d.transaction_id = t.transaction_id
                          AND d.Category_Code = t.Category_Code
                          AND d.Unit_Code = t.Unit_Code
                       WHERE DATE(t.transaction_date) = ?
                         AND d.Status = 'Active'";

            $discStmt = $conn->prepare($discSql);
            $discStmt->execute([$currentDate]);
            $discSums = $discStmt->fetch();

            $grandEnd = (float)($shift['Grand_Accum_Sales'] ?? 0);
            $grossSales = (float)($sums['gross_day'] ?? 0);
            $grandBeg = $grandEnd - $grossSales;
            
            $vatExemption = (float)($sums['vat_exemption_val'] ?? 0);
            $totalDeductions = (float)($sums['total_discounts'] ?? 0);
            $vatPayable = (float)($sums['vat_amt'] ?? 0);

            // BAGONG FORMULA MO: 
            // Gross Sales - VAT Exemption - Total Deductions - VAT Payable = Net sales
            $computedNet = $grossSales - $vatExemption - $totalDeductions - $vatPayable;

            $resultData[] = [
                "transaction_date" => $currentDate,
                "Beg_OR" => $shift['Beg_OR'] ?? '',
                "End_OR" => $shift['End_OR'] ?? '',
                "Grand_Accum_End" => $grandEnd,
                "Grand_Accum_Beg" => $grandBeg,
                "Gross_Sales" => $grossSales,
                "VATable_Sales" => (float)($sums['vatable'] ?? 0),
                "VAT_Amount" => $vatPayable,
                "VAT_Exempt_Sales" => (float)($sums['exempt'] ?? 0),
                "VAT_Exemption" => $vatExemption, 
                "Zero_Rated_Sales" => 0.00,
                "SC_Discount" => (float)($discSums['sc_disc'] ?? 0),
                "PWD_Disc" => (float)($discSums['pwd_disc'] ?? 0),
                "NAAC_Disc" => (float)($discSums['naac_disc'] ?? 0),
                "Solo_Parent_Disc" => (float)($discSums['solo_disc'] ?? 0),
                "Returns" => 0.00,
                "Voids" => (float)($sums['total_voids'] ?? 0),
                "Total_Deductions" => $totalDeductions,
                "VAT_Payable" => $vatPayable,
                
                // Ginamit ang parehong computed value base sa iyong request
                "Net_Sales" => $computedNet,
                "Total_Income" => $computedNet, 
                
                "Z_Counter" => $shift['Z_Counter_No'] ?? 0,
                "Remarks" => $shift['Remarks'] ?? ''
            ];
        }
    } else {
        // E2-E5 detail rows use the same discount source/type labels as E1.
        $discountTypes = ["E2" => "Senior Citizen", "E3" => "PWD", "E4" => "NAAC", "E5" => "Solo Parent"];
        $currentType = $discountTypes[$activeTab] ?? '';
        $sql = "SELECT
                    t.transaction_date,
                    COALESCE(NULLIF(d.customer_name, ''), NULLIF(c_by_id.customer_name, ''), NULLIF(c_by_number.customer_name, ''), '') as customer_name,
                    COALESCE(NULLIF(c_by_id.customer_id_number, ''), NULLIF(c_by_number.customer_id_number, ''), NULLIF(d.customer_id, ''), NULLIF(t.customer_exclusive_id, ''), '') as id_no,
                    t.transaction_id as trans_no,
                    t.invoice_no as or_no,
                    t.TotalSales as sales_inc_vat,
                    t.VATableSales_VAT as vat_amount,
                    t.VATExemptSales as vat_exempt_sales,
                    d.discount_amount as discount_20,
                    (t.VATExemptSales - d.discount_amount) as net_sales
                FROM tbl_pos_transactions_discounts d
                INNER JOIN tbl_pos_transactions t
                    ON d.transaction_id = t.transaction_id
                   AND d.Category_Code = t.Category_Code
                   AND d.Unit_Code = t.Unit_Code
                LEFT JOIN tbl_inventory_customer_list c_by_id
                    ON c_by_id.customer_id = d.customer_id
                LEFT JOIN tbl_inventory_customer_list c_by_number
                    ON c_by_number.customer_id_number = d.customer_id
                WHERE d.discount_type = ?
                  AND DATE(t.transaction_date) BETWEEN ? AND ?
                  AND d.Status = 'Active'
                  AND t.status = 'Active'
                ORDER BY t.transaction_date ASC, t.invoice_no ASC, d.id ASC";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$currentType, $dateFrom, $dateTo]);
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $resultData[] = [
                "transaction_date" => $row['transaction_date'],
                "customer_name" => $row['customer_name'],
                "id_no" => $row['id_no'] ?? '',
                "trans_no" => $row['trans_no'],
                "or_no" => $row['or_no'],
                "sales_inc_vat" => (float)$row['sales_inc_vat'],
                "vat_amount" => (float)$row['vat_amount'],
                "vat_exempt_sales" => (float)$row['vat_exempt_sales'],
                "discount_20" => (float)$row['discount_20'],
                "net_sales" => (float)$row['net_sales']
            ];
        }
    }
    echo json_encode([$activeTab => $resultData]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
