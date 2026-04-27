<?php

class InventoryReportByBrandCodeAndProductCodeGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getInventoryReportByBrandCodeAndProductCode(string $busunit, string $dateTo): array
    {

        $sql = "SELECT 
                    main.inv_code,
                    main.desc,
                    main.category,
                    b.brand_desc,
                    main.productcode,
                    SUM(t.qty) AS total_qty,
                    COALESCE(ROUND(SUM(t.qty * t.cost_per_uom) / NULLIF(SUM(t.qty), 0), 2), 0) AS avg_cost_per_uom,
                    COALESCE(SUM(t.qty) * ROUND(SUM(t.qty * t.cost_per_uom) / NULLIF(SUM(t.qty), 0), 2), 0) AS total_cost

                FROM tbl_inventory_transactions t

                JOIN (
                    SELECT 
                        build_code AS inv_code,
                        `desc`,
                        build_code,
                        category,
                        brandcode,
                        productcode
                    FROM lkp_build_of_products
                    WHERE deletestatus = 'Active'

                    UNION

                    SELECT 
                        mat_code AS inv_code,
                        `desc`,
                        mat_code AS build_code,
                        category,
                        brandcode,
                        productcode
                    FROM lkp_raw_mats
                    WHERE deletestatus = 'Active'
                ) AS main ON main.inv_code = t.inv_code

                LEFT JOIN lkp_product_brand b ON main.brandcode = b.brandcode AND b.deletestatus = 'Active'

                WHERE 
                    t.trans_date <= :dateto
                    AND t.deletestatus = 'Active'
                    AND t.busunitcode = :busunitcode

                GROUP BY 
                    main.inv_code, main.desc, main.build_code, main.category, b.brand_desc, main.productcode

                ORDER BY 
                    main.category, b.brand_desc, main.productcode;";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':dateto',   $dateTo, \PDO::PARAM_STR);
        $stmt->bindValue(':busunitcode',      $busunit,   \PDO::PARAM_STR);

        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }
}
