<?php

class PosNewTransactionGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }
    

    public function newTransaction($user_id)
    {   
        try {
            // 1. Fetch Business Codes (Category and Unit)
            $sql_codes = "SELECT Category_Code, Unit_Code, Unit_Name
                        FROM tbl_main_business_units 
                        ORDER BY id DESC LIMIT 1";
            $stmt_codes = $this->conn->prepare($sql_codes);
            $stmt_codes->execute();
            $codes = $stmt_codes->fetch(PDO::FETCH_ASSOC);

            $cat_code = $codes['Category_Code'] ?? '';
            $unit_code = $codes['Unit_Code'] ?? '';

            // 2. Fetch Inventory Types
            $sql_inv = "SELECT inventory_type
                        FROM tbl_inventory_products_masterlist 
                        GROUP BY inventory_type 
                        ORDER BY inventory_type ASC";
            $stmt_inv = $this->conn->prepare($sql_inv);
            $stmt_inv->execute();
            $inventory_types = $stmt_inv->fetchAll(PDO::FETCH_ASSOC);

            // 3. Fetch Sales Types (Including ID)
            $sql_sales = "SELECT 
                            description AS sales_type,
                            sales_type_id 
                        FROM lkp_sales_type 
                        WHERE deletestatus = 'Active'
                        ORDER BY description ASC";
            $stmt_sales = $this->conn->prepare($sql_sales);
            $stmt_sales->execute();
            $sales_types = $stmt_sales->fetchAll(PDO::FETCH_ASSOC);

            // 4. Fetch Item Categories
            $sql_cats = "SELECT DISTINCT item_category 
                        FROM tbl_inventory_products_masterlist 
                        WHERE category_code = :cat_code 
                        AND unit_code = :unit_code 
                        AND status = 'Active' 
                        ORDER BY item_category ASC"; // Changed to ASC to match typical POS flow
            
            $stmt_cats = $this->conn->prepare($sql_cats);
            $stmt_cats->bindParam(':cat_code', $cat_code);
            $stmt_cats->bindParam(':unit_code', $unit_code);
            $stmt_cats->execute();
            $item_categories = $stmt_cats->fetchAll(PDO::FETCH_ASSOC);

            return [
                "status"          => "success",
                "business_info"   => $codes,
                "inventory_types" => $inventory_types,
                "sales_types"     => $sales_types,
                "item_categories" => $item_categories
            ];

        } catch (PDOException $e) {
            return [
                "status"  => "error",
                "message" => $e->getMessage()
            ];
        }
    }

    public function loadItemsMenu($user_id, $data)
    {
        try {
            // 1. Automatically fetch the active Category_Code and Unit_Code
            $sqlCodes = "SELECT Category_Code, Unit_Code 
                        FROM tbl_main_business_units 
                        ORDER BY id DESC LIMIT 1";
            $stmtCodes = $this->conn->prepare($sqlCodes);
            $stmtCodes->execute();
            $codes = $stmtCodes->fetch(PDO::FETCH_ASSOC);

            if (!$codes) {
                echo json_encode(["status" => "error", "message" => "Business unit not found."]);
                return;
            }

            $category_code = $codes['Category_Code'];
            $unit_code     = $codes['Unit_Code'];

            // 2. Extract remaining parameters from $data
            $pricing_category = isset($data["pricing_category"]) ? $data["pricing_category"] : "";
            $filter_category  = isset($data["filter_category"]) ? $data["filter_category"] : "";

            // 3. Build the Product Query
            $sql = "SELECT 
                        T1.pricing_code, 
                        T1.inv_code AS product_id, 
                        T1.cost_per_uom AS unit_cost, 
                        T1.srp AS selling_price, 
                        T2.item_name, 
                        T2.unit_of_measure, 
                        T2.item_category,
                        T2.vatable, 
                        T2.isDiscountable, 
                        T2.bar_code, 
                        T2.sku
                    FROM 
                        (SELECT pricing_code, inv_code, cost_per_uom, srp 
                        FROM tbl_pricing_details 
                        WHERE pricing_code = :pricing_category AND deletestatus = 'Active') AS T1 
                    LEFT JOIN 
                        (SELECT product_id, category_code, unit_code, item_name, 
                                unit_of_measure, item_category, vatable, 
                                isDiscountable, bar_code, sku, status 
                        FROM tbl_inventory_products_masterlist) AS T2 
                    ON T1.inv_code = T2.product_id 
                    WHERE T2.category_code = :category_code 
                    AND T2.unit_code = :unit_code 
                    AND T2.item_category = :filter_category 
                    AND T2.status = 'Active' 
                    ORDER BY T2.item_name ASC";

            $stmt = $this->conn->prepare($sql);
            
            // 4. Bind Values (Codes from Step 1, Filters from $data)
            $stmt->bindValue(":pricing_category", $pricing_category);
            $stmt->bindValue(":category_code", $category_code);
            $stmt->bindValue(":unit_code", $unit_code);
            $stmt->bindValue(":filter_category", $filter_category);
            
            $stmt->execute();
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                "status" => "success",
                "business_unit" => $unit_code,
                "data" => $products
            ]);

        } catch (PDOException $e) {
            echo json_encode([
                "status" => "error",
                "message" => "Database Error: " . $e->getMessage()
            ]);
        }
    }




}
