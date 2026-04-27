<?php
/**
 * PRICING SELECTION API
 * Gets sales type ID, pricing category, and priced products
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set("Asia/Manila");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

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
$input = json_decode(file_get_contents("php://input"), true) ?: $_POST ?: $_GET;

$category_code   = trim($input["category_code"] ?? "");
$unit_code       = trim($input["unit_code"] ?? "");
$sales_type_desc = trim($input["sales_type"] ?? "");
$item_category   = trim($input["item_category"] ?? "");
$search          = trim($input["search"] ?? "");
$limit           = (int)($input["limit"] ?? 50);

if ($limit <= 0) {
    $limit = 50;
}
if ($limit > 200) {
    $limit = 200;
}

/* ------------------------------
    3. VALIDATION
------------------------------ */
if ($category_code === "" || $unit_code === "" || $sales_type_desc === "") {
    http_response_code(400);
    echo json_encode([
        "status" => "error",
        "message" => "category_code, unit_code, and sales_type are required."
    ]);
    exit;
}

try {
    /* ------------------------------
        4. GET SALES TYPE ID
    ------------------------------ */
    $sqlSalesType = "SELECT sales_type_id
                     FROM lkp_sales_type
                     WHERE description = :sales_type_desc
                     LIMIT 1";
    $stmtSalesType = $pdo->prepare($sqlSalesType);
    $stmtSalesType->execute([
        ":sales_type_desc" => $sales_type_desc
    ]);
    $salesTypeRow = $stmtSalesType->fetch();

    if (!$salesTypeRow) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Sales type not found."
        ]);
        exit;
    }

    $sales_type_id = $salesTypeRow["sales_type_id"];

    /* ------------------------------
        5. GET PRICING CATEGORY
    ------------------------------ */
    $sqlPricingCategory = "SELECT pricing_category
                           FROM tbl_pricing_by_sales_type
                           WHERE busunitcode = :unit_code
                             AND sales_type_id = :sales_type_id
                           LIMIT 1";
    $stmtPricingCategory = $pdo->prepare($sqlPricingCategory);
    $stmtPricingCategory->execute([
        ":unit_code" => $unit_code,
        ":sales_type_id" => $sales_type_id
    ]);
    $pricingRow = $stmtPricingCategory->fetch();

    if (!$pricingRow) {
        http_response_code(404);
        echo json_encode([
            "status" => "error",
            "message" => "Pricing category not found for this sales type and business unit."
        ]);
        exit;
    }

    $pricing_category = $pricingRow["pricing_category"];

    /* ------------------------------
        6. BUILD PRODUCT QUERY
    ------------------------------ */
    $where = [];
    $params = [];

    $where[] = "T2.category_code = :category_code";
    $params[":category_code"] = $category_code;

    $where[] = "T2.unit_code = :unit_code";
    $params[":unit_code"] = $unit_code;

    $where[] = "T2.status = 'Active'";

    $where[] = "T1.pricing_code = :pricing_category";
    $params[":pricing_category"] = $pricing_category;

    if ($item_category !== "") {
        $where[] = "T2.item_category = :item_category";
        $params[":item_category"] = $item_category;
    }

    if ($search !== "") {
        $where[] = "(
            T2.item_name LIKE :search
            OR T2.item_description LIKE :search
            OR T2.sku LIKE :search
            OR T2.bar_code LIKE :search
            OR T1.inv_code LIKE :search
        )";
        $params[":search"] = "%" . $search . "%";
    }

    $sqlProducts = "SELECT
                        T1.pricing_code,
                        T1.inv_code AS product_id,
                        T1.cost_per_uom AS unit_cost,
                        T1.srp AS selling_price,
                        T2.category_code,
                        T2.unit_code,
                        T2.inventory_type,
                        T2.item_category,
                        T2.item_name,
                        T2.item_description,
                        T2.unit_of_measure,
                        T2.item_color,
                        T2.item_brand,
                        T2.item_variant,
                        T2.item_size,
                        T2.vatable,
                        T2.isDiscountable,
                        T2.bar_code,
                        T2.sku,
                        T2.beginning_inventory,
                        T2.actual_count,
                        T2.remaining_count,
                        T2.variance,
                        T2.safety_stock,
                        T2.reordering_point,
                        T2.status
                    FROM tbl_pricing_details AS T1
                    LEFT JOIN tbl_inventory_products_masterlist AS T2
                        ON T1.inv_code = T2.product_id
                    WHERE " . implode(" AND ", $where) . "
                    ORDER BY T2.item_name ASC
                    LIMIT " . (int)$limit;

    $stmtProducts = $pdo->prepare($sqlProducts);
    $stmtProducts->execute($params);
    $products = $stmtProducts->fetchAll();

    /* ------------------------------
        7. RESPONSE
    ------------------------------ */
    echo json_encode([
        "status" => "success",
        "sales_type" => $sales_type_desc,
        "sales_type_id" => $sales_type_id,
        "pricing_category" => $pricing_category,
        "filters" => [
            "category_code" => $category_code,
            "unit_code" => $unit_code,
            "item_category" => $item_category,
            "search" => $search,
            "limit" => $limit
        ],
        "count" => count($products),
        "products" => $products
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}