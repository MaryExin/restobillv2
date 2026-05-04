<?php



class InventoryForecastingGateway

{

    private $conn;



    public function __construct(Database $database)

    {

        $this->conn = $database->getConnection();

    }



    public function getInventoryForecast($data): array

    {
                                                                                    
        $sql = "WITH usage_window AS (SELECT 
                    MIN(t.trans_date) AS min_date,
                    MAX(t.trans_date) AS max_date,
                    DATEDIFF(MAX(t.trans_date), MIN(t.trans_date)) AS days_covered
                FROM tbl_inventory_transactions t
                WHERE 
                    t.qty < 0 
                    AND t.deletestatus = 'Active'
                    AND t.busunitcode  = :busunitcodeone
                    AND t.trans_date BETWEEN :datefromone AND :datetoone
                ),

                sales_summary AS (
                -- BD codes: build products
                SELECT 
                    COALESCE(bp.category,         'Uncategorized') AS category,
                    COALESCE(pb.brand_desc,       '')              AS brand_desc,
                    bp.build_code                 AS inv_code,
                    COALESCE(bp.productcode, '')           AS productcode,
                    COALESCE(bp.uomval, '')           AS uomval,
                    COALESCE(bp.uom, '')           AS uom,
                    COALESCE(bp.`desc`,           '')              AS product_name,
                    SUM(ABS(t.qty))               AS observed_qty
                FROM tbl_inventory_transactions t
                LEFT JOIN lkp_build_of_products bp 
                    ON t.inv_code = bp.build_code
                LEFT JOIN lkp_product_brand pb 
                    ON bp.brandcode = pb.brandcode
                WHERE 
                    t.qty < 0
                    AND t.deletestatus = 'Active'
                    AND t.busunitcode  = :busunitcodetwo
                    AND t.inv_code LIKE 'BD%'
                    AND t.trans_date BETWEEN :datefromtwo AND :datetotwo
                GROUP BY bp.category, pb.brand_desc, bp.build_code, bp.`desc`

                UNION ALL

                -- Non-BD codes: raw materials
                SELECT 
                    COALESCE(rm.category,         'Uncategorized') AS category,
                    COALESCE(pb.brand_desc,       '')              AS brand_desc,
                    rm.mat_code                   AS inv_code,
                    COALESCE(rm.productcode, '')           AS productcode,
                    COALESCE(rm.uomval, '')           AS uomval,
                    COALESCE(rm.uom, '')           AS uom,
                    COALESCE(rm.`desc`,           '')              AS product_name,
                    SUM(ABS(t.qty))               AS observed_qty
                FROM tbl_inventory_transactions t
                LEFT JOIN lkp_raw_mats rm 
                    ON t.inv_code = rm.mat_code
                LEFT JOIN lkp_product_brand pb 
                    ON rm.brandcode = pb.brandcode
                WHERE 
                    t.qty < 0
                    AND t.deletestatus = 'Active'
                    AND t.busunitcode  = :busunitcodethree
                    AND t.inv_code NOT LIKE 'BD%'
                    AND t.trans_date BETWEEN :datefromthree AND :datetothree
                GROUP BY rm.category, pb.brand_desc, rm.mat_code, rm.`desc`
                ),

                ending_balance AS (
                SELECT 
                    t.inv_code AS inv_code,
                    SUM(t.qty) AS ending_balance
                FROM tbl_inventory_transactions t
                WHERE 
                    t.deletestatus = 'Active'
                    AND t.busunitcode = :busunitcodefour
                    AND t.trans_date <= :reportdate
                GROUP BY t.inv_code
                ),

                pending_delivery AS (
                SELECT
                    pq.inv_code AS inv_code,
                    SUM(
                    CASE WHEN pq.orderedby = :busunitcodefive
                        THEN pq.quantity 
                        ELSE 0 
                    END
                    ) AS pending_delivery_add,
                    SUM(
                    CASE WHEN pqs.payee = :busunitcodesix 
                        THEN pq.quantity 
                        ELSE 0 
                    END
                    ) AS pending_delivery_deduct
                FROM tbl_products_queue pq
                JOIN tbl_products_queue_summary pqs 
                    ON pq.prd_queue_code = pqs.prd_queue_code
                WHERE 
                    pqs.delivery_status <> 'Delivered'
                    AND pqs.po_status    = 'Approved'
                GROUP BY pq.inv_code
                ),

                pending_production AS (
                SELECT
                    COALESCE(bc.component_code, pq.inv_code) AS inv_code,
                    SUM(
                    CASE 
                        WHEN pq.orderedby = :busunitcodeseven 
                        THEN pq.quantity * COALESCE(bc.qty,1) 
                        ELSE 0 
                    END
                    ) AS pending_production_add,
                    SUM(
                    CASE 
                        WHEN pqs.payee = :busunitcodeeight 
                        THEN pq.quantity * COALESCE(bc.qty,1) 
                        ELSE 0 
                    END
                    ) AS pending_production_deduct
                FROM tbl_products_queue pq
                JOIN tbl_products_queue_summary pqs 
                    ON pq.prd_queue_code = pqs.prd_queue_code
                LEFT JOIN tbl_build_components bc 
                    ON pq.inv_code = bc.build_code
                WHERE 
                    pqs.production_status = 'In Progress'
                    AND pqs.po_status      = 'Approved'
                GROUP BY COALESCE(bc.component_code, pq.inv_code)
                )

                SELECT 
                s.category,
                s.brand_desc,
                s.inv_code,
                s.productcode,
                s.uomval,
                s.uom,
                s.product_name,

                -- demand & reorder metrics, nulls → 0
                COALESCE(ROUND(s.observed_qty / NULLIF(u.days_covered,0),    2), 0) AS avg_demand,
                COALESCE(ROUND((s.observed_qty / NULLIF(u.days_covered,0))* :leadtimeone, 2), 0) AS reorder_point,
                COALESCE(ROUND((s.observed_qty / NULLIF(u.days_covered,0))* :leadtimetwo * :safetystockone, 2), 0) AS safety_stock,
                COALESCE(
                    ROUND(
                    ROUND((s.observed_qty / NULLIF(u.days_covered,0))* :leadtimethree,   2)
                    + ROUND((s.observed_qty / NULLIF(u.days_covered,0))* :leadtimefour * :safetystocktwo, 2),
                    2
                ), 0) AS reorder_level,

                -- balances & pending, nulls → 0
                COALESCE(eb.ending_balance,            0) AS ending_balance,
                COALESCE(pd.pending_delivery_add,      0) AS pending_delivery_add,
                COALESCE(pd.pending_delivery_deduct,   0) AS pending_delivery_deduct,
                COALESCE(pp.pending_production_add,    0) AS pending_production_add,
                COALESCE(pp.pending_production_deduct, 0) AS pending_production_deduct,

                -- net on-hand after pending, nulls → 0
                COALESCE(
                    (
                    COALESCE(eb.ending_balance,0)
                    + COALESCE(pd.pending_delivery_add,0)
                    - COALESCE(pd.pending_delivery_deduct,0)
                    + COALESCE(pp.pending_production_add,0)
                    - COALESCE(pp.pending_production_deduct,0)
                    ), 0
                ) AS ending_with_pending_items,

                -- status comparison inline
                COALESCE(
                    IF(
                    (
                        COALESCE(eb.ending_balance,0)
                        + COALESCE(pd.pending_delivery_add,0)
                        - COALESCE(pd.pending_delivery_deduct,0)
                        + COALESCE(pp.pending_production_add,0)
                        - COALESCE(pp.pending_production_deduct,0)
                    ) <= 
                    COALESCE(
                        ROUND(
                        ROUND((s.observed_qty / NULLIF(u.days_covered,0))* :leadtimefive,   2)
                        + ROUND((s.observed_qty / NULLIF(u.days_covered,0))* :leadtimesix * :safetystockthree, 2),
                        2
                    ), 0),
                    'Reorder','Safety'
                    ), 'Safety'
                ) AS status

                FROM sales_summary s
                JOIN usage_window       u  ON TRUE
                LEFT JOIN ending_balance eb ON eb.inv_code     = s.inv_code
                LEFT JOIN pending_delivery pd ON pd.inv_code   = s.inv_code
                LEFT JOIN pending_production pp ON pp.inv_code = s.inv_code

                ORDER BY s.category, s.brand_desc, s.product_name;";



        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(':busunitcodeone',   $data["busunitcode"], \PDO::PARAM_STR);

        $stmt->bindValue(':datefromone',      $data["datefrom"],   \PDO::PARAM_STR);

        $stmt->bindValue(':datetoone',      $data["dateto"],   \PDO::PARAM_STR);

        $stmt->bindValue(':datefromtwo',      $data["datefrom"],   \PDO::PARAM_STR);

        $stmt->bindValue(':datetotwo',      $data["dateto"],   \PDO::PARAM_STR);

        $stmt->bindValue(':datefromthree',      $data["datefrom"],   \PDO::PARAM_STR);

        $stmt->bindValue(':datetothree',      $data["dateto"],   \PDO::PARAM_STR);

        $stmt->bindValue(':busunitcodetwo',      $data["busunitcode"],   \PDO::PARAM_STR);

        $stmt->bindValue(':busunitcodethree',      $data["busunitcode"],   \PDO::PARAM_STR);

        $stmt->bindValue(':busunitcodefour',      $data["busunitcode"],   \PDO::PARAM_STR);

        $stmt->bindValue(':reportdate',      $data["reportdate"],   \PDO::PARAM_STR);

        $stmt->bindValue(':busunitcodefive',      $data["busunitcode"],   \PDO::PARAM_STR);

        $stmt->bindValue(':busunitcodesix',      $data["busunitcode"],   \PDO::PARAM_STR);

        $stmt->bindValue(':busunitcodeseven',      $data["busunitcode"],   \PDO::PARAM_STR);

        $stmt->bindValue(':busunitcodeeight',      $data["busunitcode"],   \PDO::PARAM_STR);

        $stmt->bindValue(':leadtimeone',      $data["leadtime"],   \PDO::PARAM_STR);
        
        $stmt->bindValue(':leadtimetwo',      $data["leadtime"],   \PDO::PARAM_STR);
        
        $stmt->bindValue(':leadtimethree',      $data["leadtime"],   \PDO::PARAM_STR);
        
        $stmt->bindValue(':leadtimefour',      $data["leadtime"],   \PDO::PARAM_STR);
        
        $stmt->bindValue(':leadtimefive',      $data["leadtime"],   \PDO::PARAM_STR);
        
        $stmt->bindValue(':leadtimesix',      $data["leadtime"],   \PDO::PARAM_STR);

        $stmt->bindValue(':safetystockone',      $data["safetystock"],   \PDO::PARAM_STR);
        $stmt->bindValue(':safetystocktwo',      $data["safetystock"],   \PDO::PARAM_STR);
        $stmt->bindValue(':safetystockthree',      $data["safetystock"],   \PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->fetchAll(\PDO::FETCH_ASSOC);

    }

}

