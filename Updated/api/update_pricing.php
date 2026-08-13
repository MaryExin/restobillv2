<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$config = require 'config.php';
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->inv_code) && isset($data->new_price) && !empty($data->service_type)) {
    try {
        $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
        $pdo = new PDO($dsn, $config['user'], $config['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);

        $pdo->beginTransaction();

        $new_price    = (float)$data->new_price;
        $new_cost     = $new_price * 0.40; 
        $inv_code     = $data->inv_code;
        $service_type = $data->service_type;
        
        $user_id   = !empty($data->user_id) ? $data->user_id : '0';
        $user_name = !empty($data->user_name) ? $data->user_name : 'SYSTEM';

        // 1. UPDATE LOCAL DB (tbl_pricing_details)
        // Dito lang tayo mag-u-update, rekta sa main table.
        $sqlUpdate = "UPDATE tbl_pricing_details p
                      INNER JOIN tbl_pricing_by_sales_type s ON p.pricing_code = s.pricing_category
                      INNER JOIN lkp_sales_type t ON s.sales_type_id = t.sales_type_id
                      SET p.srp = :srp, 
                          p.cost_per_uom = :cost,
                          p.usertracker = :tracker
                      WHERE p.inv_code = :inv_code 
                        AND t.description = :service_type 
                        AND p.deletestatus = 'Active'";
        
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([
            ':srp'          => $new_price,
            ':cost'         => $new_cost,
            ':tracker'      => $user_id,
            ':inv_code'     => $inv_code,
            ':service_type' => $service_type
        ]);

        // 2. LOGS (tbl_main_activity_logs)
        // Importante ito para sa audit trail kahit walang sync.
        $log_activity = "Updated SRP of $inv_code ($service_type) to " . number_format($new_price, 2);
        $log_values   = "Price change only (Local) | SRP: $new_price | Updated By ID: $user_id";

        $sqlLog = "INSERT INTO tbl_main_activity_logs 
                   (Category_Code, Unit_Code, activity_date_time, user_id, user_name, type_of_activity, activity_performed, values_of_data) 
                   VALUES 
                   ('PRICING', 'SYSTEM', NOW(), :uid, :uname, 'UPDATE', :performed, :vdata)";
        
        $stmtLog = $pdo->prepare($sqlLog);
        $stmtLog->execute([
            ':uid'       => $user_id,
            ':uname'     => $user_name,
            ':performed' => $log_activity,
            ':vdata'     => $log_values
        ]);

        $pdo->commit();
        echo json_encode([
            "status"  => "success", 
            "message" => "Local price updated successfully."
        ]);

    } catch (Exception $e) {
        if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Incomplete parameters."]);
}
?>