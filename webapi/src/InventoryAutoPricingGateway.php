<?php















class InventoryAutoPricingGateway







{







    private $conn;















    public function __construct(Database $database)







    {







        $this->conn = $database->getConnection();







    }





    public function updateAutoInventoryPricing($data)

    {

        // 1) Recursive CTE to calculate new_cost_ea per component

        $sql = "WITH RECURSIVE

          parent_map AS (

            SELECT build_code AS parent, component_code AS child

            FROM tbl_build_components

          ),

          rec AS (

            SELECT inv_code AS inv, inv_code AS parent

            FROM tbl_inventory_transactions

            UNION ALL

            SELECT r.inv, pm.child AS parent

            FROM rec r

            JOIN parent_map pm ON pm.parent = r.parent

          ),

          ultimate_parent AS (

            SELECT inv, parent AS parent_inv

            FROM rec

            WHERE parent NOT IN (SELECT parent FROM parent_map)

            GROUP BY inv, parent

          ),

          tx_agg AS (

            SELECT

              t.busunitcode,

              lkp_busunits.ownership_status,

              inv_code AS source_component,

              SUM(cost_per_uom * qty) AS total_cost_remaining,

              SUM(qty) AS remaining_qty,

              MAX(uom_val) AS uom_val

            FROM tbl_inventory_transactions t

            LEFT JOIN lkp_busunits ON t.busunitcode = lkp_busunits.busunitcode

            WHERE lkp_busunits.ownership_status = 'CompanyOwned'

            GROUP BY t.busunitcode, inv_code

          )

          SELECT

            t.busunitcode,

            t.source_component,

            COALESCE(bp.desc, rm.desc) AS source_component_name,

            u.parent_inv,

            COALESCE(bp2.desc, rm2.desc) AS inv_name,

            COALESCE(ROUND(t.total_cost_remaining,2),0) AS total_cost_remaining,

            COALESCE(ROUND(t.remaining_qty,2),0) AS remaining_qty,

            COALESCE(ROUND(t.uom_val,2),0) AS uom_val,

            COALESCE(

              ROUND(

                t.total_cost_remaining / NULLIF(t.remaining_qty * t.uom_val,0)

              ,2),0

            ) AS avg_cost,

            COALESCE(

              ROUND(

                t.total_cost_remaining / NULLIF(t.uom_val,0)

              ,2),0

            ) AS converted_cost_remaining,

            COALESCE(

              ROUND(

                SUM(t.total_cost_remaining / NULLIF(t.uom_val,0))

                OVER (PARTITION BY u.parent_inv)

                / NULLIF(SUM(t.remaining_qty) OVER (PARTITION BY u.parent_inv),0)

              ,2),0

            ) AS avg_overall,

            COALESCE(

              ROUND(

                (

                  SUM(t.total_cost_remaining / NULLIF(t.uom_val,0))

                  OVER (PARTITION BY u.parent_inv)

                  / NULLIF(SUM(t.remaining_qty) OVER (PARTITION BY u.parent_inv),0)

                ) * t.uom_val

              ,2),0

            ) AS new_cost_ea

          FROM tx_agg t

          JOIN ultimate_parent u ON u.inv = t.source_component

          LEFT JOIN lkp_build_of_products bp ON bp.build_code = t.source_component

          LEFT JOIN lkp_raw_mats rm ON rm.mat_code = t.source_component

          LEFT JOIN lkp_build_of_products bp2 ON bp2.build_code = u.parent_inv

          LEFT JOIN lkp_raw_mats rm2 ON rm2.mat_code = u.parent_inv

          ORDER BY t.remaining_qty DESC;";

    

        $this->conn->beginTransaction();

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    

        // 2) Prepare update statement for pricing details

        $updateSql = "UPDATE tbl_pricing_details pd

          JOIN lkp_pricing_code pc ON pd.pricing_code = pc.uuid

          SET

            pd.cost_per_uom = :newCost,

            pd.srp = CASE

              WHEN pd.cost_per_uom = pd.srp THEN :newCostTwo

              ELSE pd.srp

            END

          WHERE pd.inv_code = :invCode

            AND pc.ownership_type = 'CompanyOwned'

        ";

        $updateStmt = $this->conn->prepare($updateSql);

    

        // 3) Loop through each component and apply updates

        foreach ($rows as $row) {



            if (isset($row['remaining_qty']) && floatval($row['remaining_qty']) <= 0) {

                continue;

            }

            

            $updateStmt->bindValue(':newCost',   $row['new_cost_ea'], PDO::PARAM_STR);

            $updateStmt->bindValue(':newCostTwo',   $row['new_cost_ea'], PDO::PARAM_STR);

            $updateStmt->bindValue(':invCode',   $row['source_component'], PDO::PARAM_STR);

            $updateStmt->execute();

        }

    

        $this->conn->commit();



        echo json_encode(["message" => "Success"]);

    }

    





}







