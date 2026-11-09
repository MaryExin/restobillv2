<?php

declare(strict_types=1);

require __DIR__ . "/secure_guard.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: POST");
    echo json_encode(["status" => "error", "message" => "Method not allowed."]);
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

posRoleAuthRequireAnyPermission(
    $pdo,
    (string)($GLOBALS["pos_user_id"] ?? ""),
    [
        ["settings", "pricingEngine"],
        ["reports", "pricingManagement"],
    ]
);

class PricingValidationException extends RuntimeException
{
}

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
    $action = is_object($data) ? ($data->action ?? null) : null;
}

if (empty($action)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Action parameter is required."]);
    exit;
}

try {
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

    if (!in_array($action, ["add", "update"], true) || !is_object($data)) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Invalid pricing action."]);
        exit;
    }

    $pdo->beginTransaction();
    $user_id = (string)($GLOBALS["pos_user_id"] ?? "");

    // ==========================================
    // ACTION: ADD NEW PRODUCT
    // Accepts either:
    //   - prices: [{ sales_type: "DINE IN", srp: 100 }, ...]   (multi sales type)
    //   - target_sales_type + srp                              (legacy, single)
    // Creates 1 row in tbl_inventory_products_masterlist and
    // 1 row in tbl_pricing_details per sales type, in one transaction.
    // ==========================================
    if ($action === 'add') {
        $itemName = trim((string)($data->item_name ?? ''));
        $category = strtoupper(trim((string)($data->item_category ?? '')));
        $uom = strtoupper(trim((string)($data->unit_of_measure ?? ''))) ?: 'PC';
        $vatable = (($data->vatable ?? 'Yes') === 'No') ? 'No' : 'Yes';
        $isDiscountable = (($data->isDiscountable ?? 'Yes') === 'No') ? 'No' : 'Yes';

        if ($itemName === '') throw new PricingValidationException("Product name is required.");
        if (mb_strlen($itemName) > 255) throw new PricingValidationException("Product name is too long.");
        if ($category === '') throw new PricingValidationException("Category is required.");

        // Normalize price lines
        $priceLines = [];
        if (isset($data->prices) && is_array($data->prices)) {
            foreach ($data->prices as $line) {
                $stype = trim((string)($line->sales_type ?? ''));
                if ($stype === '') continue;
                $priceLines[strtoupper($stype)] = ['sales_type' => $stype, 'srp' => $line->srp ?? null];
            }
        } elseif (isset($data->target_sales_type)) {
            $stype = trim((string)$data->target_sales_type);
            $priceLines[strtoupper($stype)] = ['sales_type' => $stype, 'srp' => $data->srp ?? null];
        }
        if (count($priceLines) === 0) throw new PricingValidationException("Select at least one sales type.");

        foreach ($priceLines as $key => $line) {
            if (!is_numeric($line['srp']) || (float)$line['srp'] <= 0) {
                throw new PricingValidationException("Enter a valid price for " . $line['sales_type'] . ".");
            }
            $priceLines[$key]['srp'] = round((float)$line['srp'], 2);
        }

        // Duplicate product name check
        $stmtDup = $pdo->prepare("SELECT product_id FROM tbl_inventory_products_masterlist
                                  WHERE LOWER(TRIM(item_name)) = LOWER(:item_name) LIMIT 1");
        $stmtDup->execute([':item_name' => $itemName]);
        if ($stmtDup->fetchColumn() !== false) {
            throw new PricingValidationException("A product named \"{$itemName}\" already exists.");
        }

        // METADATA: copy codes from a product in the same category (or any product as fallback)
        $stmtMeta = $pdo->prepare("SELECT category_code, unit_code, inventory_type, item_brand
                                   FROM tbl_inventory_products_masterlist
                                   ORDER BY (item_category = :cat) DESC, seq DESC LIMIT 1");
        $stmtMeta->execute([':cat' => $category]);
        $meta = $stmtMeta->fetch() ?: [];
        $cc = $meta['category_code'] ?? 'GEN'; $uc = $meta['unit_code'] ?? '1001';
        $it = $meta['inventory_type'] ?? 'ALL'; $br = $meta['item_brand'] ?? 'BR-DEFAULT';

        // MAPPING: pricing code per sales type (prefer this business unit's mapping)
        $stmtMap = $pdo->prepare("SELECT pbs.pricing_category FROM tbl_pricing_by_sales_type pbs
                                  INNER JOIN lkp_sales_type lst ON pbs.sales_type_id = lst.sales_type_id
                                  WHERE lst.description = :stype
                                    AND COALESCE(pbs.deletestatus, 'Active') = 'Active'
                                  ORDER BY (pbs.busunitcode = :bu) DESC
                                  LIMIT 1");
        $missing = [];
        foreach ($priceLines as $key => $line) {
            $stmtMap->execute([':stype' => $line['sales_type'], ':bu' => $uc]);
            $map = $stmtMap->fetch();
            if (!$map) { $missing[] = $line['sales_type']; continue; }
            $priceLines[$key]['pricing_code'] = $map['pricing_category'];
        }
        if ($missing) {
            throw new PricingValidationException("No pricing setup found for: " . implode(", ", $missing) . ".");
        }

        // PRODUCT CODE: keep the client's code if given and unused, otherwise generate one
        $stmtCode = $pdo->prepare("SELECT 1 FROM tbl_inventory_products_masterlist WHERE product_id = :pid LIMIT 1");
        $inv_code = trim((string)($data->inv_code ?? ''));
        for ($i = 0; $i < 5; $i++) {
            if ($inv_code !== '') {
                $stmtCode->execute([':pid' => $inv_code]);
                if ($stmtCode->fetchColumn() === false) break;
            }
            $inv_code = 'BD-' . bin2hex(random_bytes(6));
        }

        // MASTERLIST: base selling price = first sales type's price
        $first = reset($priceLines);
        $baseSrp = $first['srp'];
        $baseCost = round($baseSrp * 0.40, 2);
        $sqlM = "INSERT INTO tbl_inventory_products_masterlist
                (product_id, category_code, unit_code, inventory_type, item_category, item_name, item_description, unit_of_measure, item_brand, unit_cost, selling_price, vatable, isDiscountable, status, beginning_inventory, actual_count, remaining_count, variance, safety_stock, reordering_point)
                VALUES (:inv, :cc, :uc, :it, :icat, :item_name, :item_desc, :uom, :br, :cost, :srp, :vatable, :discountable, 'Active', 0, 0, 0, 0, 0, 0)";
        $pdo->prepare($sqlM)->execute([
            ':inv' => $inv_code, ':cc' => $cc, ':uc' => $uc, ':it' => $it, ':icat' => $category,
            ':item_name' => $itemName, ':item_desc' => $itemName, ':uom' => $uom, ':br' => $br,
            ':cost' => $baseCost, ':srp' => $baseSrp, ':vatable' => $vatable, ':discountable' => $isDiscountable,
        ]);

        // PRICING: one row per sales type
        $stmtP = $pdo->prepare("INSERT INTO tbl_pricing_details (pricing_code, inv_code, cost_per_uom, srp, deletestatus, usertracker, createdtime)
                                VALUES (:pcode, :inv, :cost, :srp, 'Active', :tracker, NOW())");
        foreach ($priceLines as $line) {
            $stmtP->execute([
                ':pcode' => $line['pricing_code'], ':inv' => $inv_code,
                ':cost' => round($line['srp'] * 0.40, 2), ':srp' => $line['srp'], ':tracker' => $user_id,
            ]);
        }

        $pdo->commit();
        echo json_encode([
            "status" => "success",
            "inv_code" => $inv_code,
            "prices_added" => count($priceLines),
        ]);
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

} catch (PricingValidationException $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log("POS pricing mutation error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to process the pricing request."]);
}
