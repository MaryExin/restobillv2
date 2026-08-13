<?php

declare(strict_types=1);

require __DIR__ . "/secure_guard.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    header("Allow: GET");
    echo json_encode(["error" => "Method not allowed."]);
    exit;
}

require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

try {
    posRoleAuthRequireAnyPermission(
        $pdo,
        (string)($GLOBALS["pos_user_id"] ?? ""),
        [
            ["settings", "pricingEngine"],
            ["reports", "pricingManagement"],
        ]
    );

    // Query na may WHERE clause para sa Active status
    $sql = "SELECT 
                i.product_id AS inv_code,
                i.item_name AS item_description,
                i.item_category, 
                p.cost_per_uom, 
                p.srp, 
                t.description AS service_type
            FROM tbl_pricing_details AS p
            INNER JOIN tbl_inventory_products_masterlist AS i 
                ON p.inv_code = i.product_id
            INNER JOIN tbl_pricing_by_sales_type AS s 
                ON p.pricing_code = s.pricing_category
            INNER JOIN lkp_sales_type AS t
                ON s.sales_type_id = t.sales_type_id
            WHERE p.deletestatus = 'Active'
            ORDER BY i.item_category ASC, i.item_name ASC";

    $stmt = $pdo->query($sql);
    $data = $stmt->fetchAll();

    echo json_encode($data, JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    error_log("POS pricing read error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => "Unable to load pricing data."]);
}
