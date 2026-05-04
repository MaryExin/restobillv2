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
                        SUM(CASE WHEN status = 'Active' AND discount_type = 'Senior Citizen' THEN Discount ELSE 0 END) as sc_disc,
                        SUM(CASE WHEN status = 'Active' AND discount_type = 'PWD' THEN Discount ELSE 0 END) as pwd_disc,
                        SUM(CASE WHEN status = 'Active' AND discount_type = 'NAAC Discount' THEN Discount ELSE 0 END) as naac_disc,
                        SUM(CASE WHEN status = 'Active' AND discount_type = 'Solo Parent Discount' THEN Discount ELSE 0 END) as solo_disc,
                        SUM(CASE WHEN status = 'Active' THEN Discount ELSE 0 END) as total_discounts,
                        SUM(CASE WHEN status = 'Voided' THEN TotalAmountDue ELSE 0 END) as total_voids
                       FROM tbl_pos_transactions 
                       WHERE DATE(transaction_date) = ?";
            
            $sumStmt = $conn->prepare($sumSql);
            $sumStmt->execute([$currentDate]);
            $sums = $sumStmt->fetch();

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
                "SC_Discount" => (float)($sums['sc_disc'] ?? 0),
                "PWD_Disc" => (float)($sums['pwd_disc'] ?? 0),
                "NAAC_Disc" => (float)($sums['naac_disc'] ?? 0),
                "Solo_Parent_Disc" => (float)($sums['solo_disc'] ?? 0),
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
        // E2-E5 Logic (Simplified for individual records)
        $discountTypes = ["E2" => "Senior Citizen", "E3" => "PWD", "E4" => "NAAC Discount", "E5" => "Solo Parent Discount"];
        $currentType = $discountTypes[$activeTab] ?? '';
        $sql = "SELECT t1.*, COALESCE(t3.customer_name, '') as customer_name
                FROM tbl_pos_transactions t1
                LEFT JOIN tbl_pos_transactions_customers t2 ON t1.transaction_id = t2.transaction_id
                LEFT JOIN tbl_inventory_customer_list t3 ON t2.customer_id = t3.customer_id
                WHERE t1.discount_type = ? AND DATE(t1.transaction_date) BETWEEN ? AND ? AND t1.status = 'Active'";
        $stmt = $conn->prepare($sql);
        $stmt->execute([$currentType, $dateFrom, $dateTo]);
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $resultData[] = [
                "transaction_date" => $row['transaction_date'],
                "customer_name" => $row['customer_name'],
                "id_no" => $row['customer_exclusive_id'] ?? '',
                "trans_no" => $row['transaction_id'],
                "or_no" => $row['invoice_no'],
                "sales_inc_vat" => (float)$row['TotalSales'],
                "vat_amount" => (float)$row['VATableSales_VAT'],
                "vat_exempt_sales" => (float)$row['VATExemptSales'],
                "discount_20" => (float)$row['Discount'],
                "net_sales" => (float)$row['VATExemptSales'] - (float)$row['Discount']
            ];
        }
    }
    echo json_encode([$activeTab => $resultData]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}