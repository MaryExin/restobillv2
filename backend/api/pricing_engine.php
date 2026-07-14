<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$config = require 'config.php';

/**
 * FIXED LOGIC: 
 * Image uploads use FormData ($_POST). 
 * Add/Update use JSON (php://input).
 * We check both to find the action.
 */
$action = $_POST['action'] ?? null;
$data = null;

if (!$action) {
    $json = file_get_contents("php://input");
    $data = json_decode($json);
    $action = $data->action ?? null;
}

if (empty($action)) {
    echo json_encode(["status" => "error", "message" => "Action parameter is required."]);
    exit;
}

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    // ==========================================
    // ACTION: UPLOAD PRODUCT IMAGE
    // ==========================================
    if ($action === 'upload_image') {
        if (!isset($_FILES['file']) || !isset($_POST['item_name'])) {
            throw new Exception("File or Product Name missing.");
        }

        $itemName = $_POST['item_name'];
        $safeName = preg_replace('/[^A-Za-z0-9 _-]/', '', $itemName);
        $targetDir = $_SERVER['DOCUMENT_ROOT'] . "/item_pictures/";
        
        if (!file_exists($targetDir)) mkdir($targetDir, 0777, true);
        $targetFile = $targetDir . $safeName . ".jpg";

        if (move_uploaded_file($_FILES['file']['tmp_name'], $targetFile)) {
            echo json_encode(["status" => "success", "message" => "Image updated successfully."]);
        } else {
            throw new Exception("Error saving file to storage.");
        }
        exit;
    }

    $pdo->beginTransaction();
    $user_id = $data->user_id ?? ($_POST['user_id'] ?? '0');

    // ==========================================
    // ACTION: ADD NEW PRODUCT
    // ==========================================
    if ($action === 'add') {
        $inv_code = $data->inv_code;
        $category = $data->item_category;
        $srp = (float)$data->srp;
        $cost = $srp * 0.40;

        // 1. MAPPING: Get pricing code for Sales Mode
        $stmtMap = $pdo->prepare("SELECT pbs.pricing_category FROM tbl_pricing_by_sales_type pbs 
                                  INNER JOIN lkp_sales_type lst ON pbs.sales_type_id = lst.sales_type_id 
                                  WHERE lst.description = :stype LIMIT 1");
        $stmtMap->execute([':stype' => $data->target_sales_type]);
        $map = $stmtMap->fetch();
        if (!$map) throw new Exception("Pricing mapping not found for " . $data->target_sales_type);
        $p_code = $map['pricing_category'];

        // 2. METADATA: Get codes from category template
        $stmtMeta = $pdo->prepare("SELECT category_code, unit_code, inventory_type, item_brand 
                                   FROM tbl_inventory_products_masterlist WHERE item_category = :cat LIMIT 1");
        $stmtMeta->execute([':cat' => $category]);
        $meta = $stmtMeta->fetch();
        $cc = $meta['category_code'] ?? 'GEN'; $uc = $meta['unit_code'] ?? '1001'; 
        $it = $meta['inventory_type'] ?? 'ALL'; $br = $meta['item_brand'] ?? 'BR-DEFAULT';

        // 3. MASTERLIST: Insert product
        $sqlM = "INSERT INTO tbl_inventory_products_masterlist 
                (product_id, category_code, unit_code, inventory_type, item_category, item_name, item_description, unit_of_measure, item_brand, unit_cost, selling_price, status, beginning_inventory, actual_count, remaining_count, variance, safety_stock, reordering_point) 
                VALUES (:inv, :cc, :uc, :it, :icat, :name, :name, :uom, :br, :cost, :srp, 'Active', 0, 0, 0, 0, 0, 0)";
        $pdo->prepare($sqlM)->execute([':inv'=>$inv_code, ':cc'=>$cc, ':uc'=>$uc, ':it'=>$it, ':icat'=>$category, ':name'=>$data->item_name, ':uom'=>$data->unit_of_measure, ':br'=>$br, ':cost'=>$cost, ':srp'=>$srp]);

        // 4. PRICING: Insert price
        $sqlP = "INSERT INTO tbl_pricing_details (pricing_code, inv_code, cost_per_uom, srp, deletestatus, usertracker, createdtime) 
                 VALUES (:pcode, :inv, :cost, :srp, 'Active', :tracker, NOW())";
        $pdo->prepare($sqlP)->execute([':pcode'=>$p_code, ':inv'=>$inv_code, ':cost'=>$cost, ':srp'=>$srp, ':tracker'=>$user_id]);

        $pdo->commit();
        echo json_encode(["status" => "success"]);
    }

    // ==========================================
    // ACTION: UPDATE PRICE
    // ==========================================
    else if ($action === 'update') {
        $new_p = (float)$data->new_price; $new_c = $new_p * 0.40;
        $sqlU = "UPDATE tbl_pricing_details p 
                 INNER JOIN tbl_pricing_by_sales_type s ON p.pricing_code = s.pricing_category 
                 INNER JOIN lkp_sales_type t ON s.sales_type_id = t.sales_type_id 
                 SET p.srp = :srp, p.cost_per_uom = :cost, p.usertracker = :tracker 
                 WHERE p.inv_code = :inv AND t.description = :stype AND p.deletestatus = 'Active'";
        $pdo->prepare($sqlU)->execute([':srp'=>$new_p, ':cost'=>$new_c, ':tracker'=>$user_id, ':inv'=>$data->inv_code, ':stype'=>$data->service_type]);
        $pdo->commit();
        echo json_encode(["status" => "success"]);
    }

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>