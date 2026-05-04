<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../vendor/autoload.php'; 
require_once __DIR__ . "/pdo.php"; 

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { exit; }

if ($_SERVER["REQUEST_METHOD"] === 'POST') {
    $req = json_decode(file_get_contents("php://input"), true);
    $targetDate = $req['selected_date'] ?? date('Y-m-d');
    $reports = $req['reports'] ?? [];
    
    $filename = "CNC_REPORTS_" . $targetDate . ".csv";
    $filepath = __DIR__ . "/" . $filename;
    $file = fopen($filepath, 'w');
    fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

    $hasReportContent = false;

    // 1. DAILY SALES SUMMARY
    if (isset($reports['dailySales']) && $reports['dailySales'] == true) {
        $hasReportContent = true;
        fputcsv($file, ["=== DAILY SALES SUMMARY ==="]);
        fputcsv($file, ["Date", "Gross Sales", "Total Discount", "Net Amount Due"]);
        $stmt = $pdo->prepare("SELECT transaction_date, SUM(TotalSales), SUM(Discount), SUM(TotalAmountDue) FROM tbl_pos_transactions WHERE transaction_date = ? AND status = 'Active'");
        $stmt->execute([$targetDate]);
        $row = $stmt->fetch(PDO::FETCH_NUM);
        fputcsv($file, ($row && $row[0]) ? $row : [$targetDate, "0.00", "0.00", "0.00"]);
        fputcsv($file, []); 
    }

    // 2. SALES PER ITEM
    if (isset($reports['salesPerItem']) && $reports['salesPerItem'] == true) {
        $hasReportContent = true;
        fputcsv($file, ["=== SALES PER ITEM ==="]);
        fputcsv($file, ["Code", "Product Name", "Qty", "Total Revenue"]);
        $stmt = $pdo->prepare("SELECT d.product_id, COALESCE(m.item_name, d.product_id), SUM(d.sales_quantity), SUM(d.sales_quantity * d.selling_price) 
                               FROM tbl_pos_transactions_detailed d 
                               LEFT JOIN tbl_inventory_products_masterlist m ON m.product_id = d.product_id 
                               WHERE d.transaction_date = ? GROUP BY d.product_id");
        $stmt->execute([$targetDate]);
        while($row = $stmt->fetch(PDO::FETCH_NUM)) { fputcsv($file, $row); }
        fputcsv($file, []);
    }

    // 3. LEDGER (EXPENSES & PETTY) - Exact match sa snippet mo
    if (isset($reports['expensesPetty']) && $reports['expensesPetty'] == true) {
        $hasReportContent = true;
        fputcsv($file, ["=== LEDGER REPORT (CASH FLOW) ==="]);
        fputcsv($file, ["ID", "Type", "Category", "Description", "Amount", "Time"]);
        
        // Sinunod ang query sa Action 4: Export Ledger ng snippet mo
        $stmt = $pdo->prepare("SELECT id, entry_type, category, description, amount, entry_time 
                               FROM tbl_pos_ledger 
                               WHERE entry_date = ? AND status = 'active' 
                               ORDER BY CASE WHEN entry_type = 'IN' THEN 1 ELSE 2 END ASC, entry_time ASC");
        $stmt->execute([$targetDate]);
        
        $count = 0;
        while($row = $stmt->fetch(PDO::FETCH_NUM)) { 
            fputcsv($file, $row); 
            $count++; 
        }
        if($count === 0) fputcsv($file, ["No ledger entries found for this day."]);
        fputcsv($file, []);
    }

    fclose($file);

    // --- MAILER ---
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'veegalvez0@gmail.com'; 
        $mail->Password = 'bghw kbek vnnc mhab'; 
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = 587;
        $mail->setFrom('veegalvez0@gmail.com', 'CNC REPORTS SENDER');
        $mail->addAddress('silverioj824@gmail.com'); 
        $mail->Subject = "CNC POS CONSOLIDATED REPORT - $targetDate";
        $mail->Body = "Attached is the daily report packet (Sales, Items, and Ledger Transactions).";
        $mail->addAttachment($filepath, $filename);

        if ($mail->send()) {
            unlink($filepath);
            echo json_encode(["status" => "success", "message" => "Successful!"]);
        }
    } catch (Exception $e) {
        if(file_exists($filepath)) unlink($filepath);
        echo json_encode(["status" => "error", "message" => "Mail Error: " . $mail->ErrorInfo]);
    }
}