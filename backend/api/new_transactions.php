<?php
/**
 * NEW TRANSACTION API
 * Loads business info, inventory types, sales types, and item categories
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set("Asia/Manila");

/* ------------------------------
    1. LOAD CONFIG & DB
------------------------------ */
$config = require __DIR__ . "/config.php";

try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    echo json_encode([
        "status" => "error",
        "message" => "Connection failed: " . $e->getMessage()
    ]);
    exit;
}

/* ------------------------------
    2. GET INPUT DATA
------------------------------ */
$input = json_decode(file_get_contents("php://input"), true) ?: $_POST;

$user_id = $input['user_id'] ?? 0;

/* ------------------------------
    3. FETCH DATA
------------------------------ */
try {
    /* ------------------------------
        4. FETCH BUSINESS CODES
    ------------------------------ */
    $sql_codes = "SELECT 
                    Category_Code,
                    Unit_Code,
                    Unit_Name
                  FROM tbl_main_business_units
                  ORDER BY id DESC
                  LIMIT 1";
    $stmt_codes = $pdo->prepare($sql_codes);
    $stmt_codes->execute();
    $codes = $stmt_codes->fetch();

    $cat_code = $codes['Category_Code'] ?? '';
    $unit_code = $codes['Unit_Code'] ?? '';

    /* ------------------------------
        5. FETCH INVENTORY TYPES
    ------------------------------ */
    $sql_inv = "SELECT inventory_type
                FROM tbl_inventory_products_masterlist
                GROUP BY inventory_type
                ORDER BY inventory_type ASC";
    $stmt_inv = $pdo->prepare($sql_inv);
    $stmt_inv->execute();
    $inventory_types = $stmt_inv->fetchAll();

    /* ------------------------------
        6. FETCH SALES TYPES
    ------------------------------ */
    $sql_sales = "SELECT
                    description AS sales_type,
                    sales_type_id
                  FROM lkp_sales_type
                  WHERE deletestatus = 'Active'
                  ORDER BY description ASC";
    $stmt_sales = $pdo->prepare($sql_sales);
    $stmt_sales->execute();
    $sales_types = $stmt_sales->fetchAll();

    // Apply the admin-configured display order (Settings > Sales Type Order),
    // falling back to alphabetical for any sales type not yet configured.
    $sql_order = "SELECT `value`
                  FROM tbl_pos_settings
                  WHERE category = 'SalesType'
                    AND description = 'Sales Type Display Order'
                  ORDER BY ID DESC
                  LIMIT 1";
    $stmt_order = $pdo->prepare($sql_order);
    $stmt_order->execute();
    $saved_order = json_decode((string)$stmt_order->fetchColumn(), true);

    if (is_array($saved_order) && count($saved_order) > 0) {
        $by_id = [];
        foreach ($sales_types as $row) {
            $by_id[$row['sales_type_id']] = $row;
        }

        $ordered_sales_types = [];
        foreach ($saved_order as $id) {
            if (isset($by_id[$id])) {
                $ordered_sales_types[] = $by_id[$id];
                unset($by_id[$id]);
            }
        }
        foreach ($by_id as $row) {
            $ordered_sales_types[] = $row;
        }

        $sales_types = $ordered_sales_types;
    }

    /* ------------------------------
        7. FETCH ITEM CATEGORIES
    ------------------------------ */
    $sql_cats = "SELECT DISTINCT item_category
                 FROM tbl_inventory_products_masterlist
                 WHERE category_code = :cat_code
                   AND unit_code = :unit_code
                   AND status = 'Active'
                 ORDER BY item_category ASC";
    $stmt_cats = $pdo->prepare($sql_cats);
    $stmt_cats->bindValue(':cat_code', $cat_code, PDO::PARAM_STR);
    $stmt_cats->bindValue(':unit_code', $unit_code, PDO::PARAM_STR);
    $stmt_cats->execute();
    $item_categories = $stmt_cats->fetchAll();

    /* ------------------------------
        8. RESPONSE
    ------------------------------ */
    echo json_encode([
        "status" => "success",
        "business_info" => $codes ?: [],
        "inventory_types" => $inventory_types,
        "sales_types" => $sales_types,
        "item_categories" => $item_categories
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}