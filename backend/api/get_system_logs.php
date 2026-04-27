<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");

$config = require 'config.php'; 

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $conn = new PDO($dsn, $config['user'], $config['pass']);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(["error" => "Connection failed: " . $e->getMessage()]);
    exit;
}

$from          = $_GET['from'] ?? date('Y-m-d');
$to            = $_GET['to'] ?? date('Y-m-d');
$viewType      = $_GET['viewType'] ?? 'TABLE';
$targetId      = $_GET['id'] ?? null; 
$transactionId = $_GET['transaction_id'] ?? null;

// --- STEP 2: GET PAYMENTS (KAPAG CLINICK YUNG TRANSACTION ID) ---
if ($transactionId) {
    $sql = "SELECT payment_method, payment_amount 
            FROM tbl_pos_transactions_payments 
            WHERE transaction_id = :tid";
    $stmt = $conn->prepare($sql);
    $stmt->execute([':tid' => $transactionId]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// --- STEP 1: GET TRANSACTIONS (KAPAG CLINICK YUNG CARD) ---
if ($targetId) {
    $filterColumn = "";
    $cleanId = $targetId;

    if ($viewType === 'TABLE') {
        $filterColumn = "table_number";
        $cleanId = str_ireplace('Table ', '', $targetId);
    } elseif ($viewType === 'CASHIER') {
        $filterColumn = "cashier";
    } else {
        $filterColumn = "payment_method";
    }

    $sql = "SELECT transaction_id, transaction_date AS created_at, TotalAmountDue AS amount, cashier, table_number
            FROM tbl_pos_transactions 
            WHERE status = 'Active' 
              AND DATE(transaction_date) BETWEEN :start AND :end
              AND $filterColumn = :targetId
            ORDER BY transaction_date DESC";

    $stmt = $conn->prepare($sql);
    $stmt->execute([':start' => $from, ':end' => $to, ':targetId' => $cleanId]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// --- ORIGINAL SUMMARY LOGIC ---
if ($viewType === 'TABLE') {
    $sql = "SELECT table_number AS name, 'Dining Area' AS subtitle, COUNT(*) AS transaction_count, IFNULL(SUM(TotalAmountDue), 0) AS total_amount
            FROM tbl_pos_transactions WHERE status = 'Active' AND DATE(transaction_date) BETWEEN :start AND :end
            GROUP BY table_number HAVING total_amount > 0 ORDER BY table_number ASC";
} elseif ($viewType === 'CASHIER') {
    $sql = "SELECT cashier AS name, 'Authorized Staff' AS subtitle, COUNT(*) AS transaction_count, IFNULL(SUM(TotalAmountDue), 0) AS total_amount
            FROM tbl_pos_transactions WHERE status = 'Active' AND DATE(transaction_date) BETWEEN :start AND :end
            GROUP BY cashier HAVING total_amount > 0 ORDER BY total_amount DESC";
} else {
    $sql = "SELECT payment_method AS name, 'Payment Channel' AS subtitle, COUNT(*) AS transaction_count, IFNULL(SUM(TotalAmountDue), 0) AS total_amount
            FROM tbl_pos_transactions WHERE status = 'Active' AND DATE(transaction_date) BETWEEN :start AND :end
            GROUP BY payment_method HAVING total_amount > 0 ORDER BY total_amount DESC";
}

try {
    $stmt = $conn->prepare($sql);
    $stmt->execute([':start' => $from, ':end' => $to]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $finalData = [];
    foreach ($results as $row) {
        $finalData[] = [
            "name"              => $row['name'],
            "subtitle"          => $row['subtitle'],
            "total_amount"      => (float)$row['total_amount'],
            "transaction_count" => (int)$row['transaction_count']
        ];
    }
    echo json_encode($finalData);
} catch (PDOException $e) { echo json_encode(["error" => $e->getMessage()]); }
?>