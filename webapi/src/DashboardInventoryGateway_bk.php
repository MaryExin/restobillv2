<?php



class DashboardInventoryGateway

{



    private $conn;



    public function __construct(Database $database)

    {



        $this->conn = $database->getConnection();



    }



    public function getAllDataPerCostBalLevel($data)

    {
        try {

            $sql = "SELECT DISTINCT
                    trans_date, IF(parent_level = tbl_inventory_filtered.level AND parent_inv <> '', parent_inv, tbl_inventory_filtered.inv_code) AS inv_code,
                    IF(LEFT(tbl_inventory_filtered.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as description,
                    ROUND(SUM(CASE 
                       WHEN tbl_inventory_filtered.pr_queue_code != 'Physical' THEN tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val 
                       ELSE 0 
                     END), 2) AS running_uom_val,
                    tbl_inventory_filtered.productcode,
                    tbl_inventory_filtered.uom, ROUND(SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom),2) AS running_cost_per_uom,
                    tbl_inventory_filtered.pr_queue_code,
                    tbl_inventory_filtered.busunitcode, tbl_inventory_filtered.name, tbl_inventory_filtered.level, tbl_inventory_filtered.inv_class,
                    lkp_area.area_code, lkp_area.area_name, lkp_stock_levels.min_stock_level
                    FROM
                    (SELECT DISTINCT tbl_inventory_transactions.trans_date, tbl_inventory_transactions.inv_code,
                      IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.productcode, lkp_build_of_products.productcode) as productcode,
        IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) as description,
        IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.rawmats_parent, lkp_build_of_products.portion_parent) as parent_inv,
        IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) as parent_level,
        tbl_inventory_transactions.qty, tbl_inventory_transactions.cost_per_uom, tbl_inventory_transactions.uom_val,
        tbl_inventory_transactions.uom, tbl_inventory_transactions.pr_queue_code, tbl_inventory_transactions.busunitcode,
        lkp_busunits.name, lkp_busunits.pricing_category, lkp_busunits.class AS level, tbl_inventory_transactions.inv_class, lkp_busunits.areacode
        FROM
        tbl_inventory_transactions
        LEFT OUTER JOIN lkp_raw_mats ON  tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code
        LEFT OUTER JOIN lkp_build_of_products ON  tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code
        LEFT OUTER JOIN lkp_busunits ON  tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode
        LEFT OUTER JOIN tbl_pricing_details ON  lkp_busunits.pricing_category = tbl_pricing_details.pricing_code
        AND tbl_pricing_details.inv_code = tbl_inventory_transactions.inv_code
        WHERE tbl_inventory_transactions.deletestatus = 'Active'
        AND lkp_busunits.name  IS NOT NULL) AS tbl_inventory_filtered
                        LEFT OUTER JOIN lkp_raw_mats ON  tbl_inventory_filtered.inv_code = lkp_raw_mats.mat_code
                        LEFT OUTER JOIN lkp_build_of_products ON  tbl_inventory_filtered.inv_code = lkp_build_of_products.build_code
                        LEFT OUTER JOIN lkp_area ON  tbl_inventory_filtered.areacode = lkp_area.area_code
					    LEFT OUTER JOIN lkp_stock_levels ON  tbl_inventory_filtered.inv_code = lkp_stock_levels.inv_code
                        AND tbl_inventory_filtered.busunitcode = lkp_stock_levels.level
					WHERE tbl_inventory_filtered.busunitcode LIKE :busunitcode
                    AND trans_date <= :dateto
                    AND lkp_area.area_code LIKE :areacode
                    GROUP BY tbl_inventory_filtered.level, IF(parent_level = tbl_inventory_filtered.level AND parent_inv <> '', parent_inv, tbl_inventory_filtered.inv_code)
                    ORDER BY tbl_inventory_filtered.level, IF(LEFT(tbl_inventory_filtered.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) ASC";

        // AND IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) <> 'STORE'

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);
            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);
            $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);
            $stmt->execute();
            $data = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }
            return $data;

        } catch (Exception $e) {
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }
    
    public function getInventoryUsage($data)

    {



        try {



            $dateTo = $data["dateto"];

            $interval = $data["interval"];



            // Create a DateTime object from the $dateTo string

            $dateFrom = new DateTime($dateTo);

            $dateFrom->sub(new DateInterval("P{$interval}D"));

            $dateFrom = $dateFrom->format('Y-m-d');

            $dateBetween = date('Y-m-d', strtotime($dateFrom . ' +1 day'));

            $number = $interval -1;
            
            $dateYes = date('Y-m-d', strtotime($dateTo . ' -' . $number . ' days'));




            $sql = "SELECT

                'CURRENT',

                :dateHeaderTo AS transdate,

                IF(parent_level = tbl_inventory_filtered.level

                        AND parent_inv <> '',

                    parent_inv,

                    tbl_inventory_filtered.inv_code) AS inv_code,

                IF(LEFT(tbl_inventory_filtered.inv_code, 2) = 'RM',

                    lkp_raw_mats.desc,

                    lkp_build_of_products.desc) AS description,




                -- Calculate purchases_running_uom_val
                ROUND(SUM(
                    CASE 
                        WHEN tbl_inventory_filtered.pr_queue_code != 'Physical' 
                        AND DATE(tbl_inventory_filtered.trans_date) = :datePurchase
                        AND tbl_inventory_filtered.qty > 0
                        THEN tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
                        ELSE 0 
                    END), 2) AS purchases_running_uom_val,
                
                -- Calculate prev_running_uom_val by using purchases_running_uom_val in the second case
                ROUND(
                    SUM(
                        CASE
                            WHEN DATE(tbl_inventory_filtered.trans_date) = :dateSelected 
                            AND tbl_inventory_filtered.qty > 0 THEN
                                tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
                            WHEN DATE(tbl_inventory_filtered.trans_date) = :dateSelect 
                            AND tbl_inventory_filtered.qty <= 0 THEN
                                0  -- Handle zero or negative qty as 0 when trans_date matches
                            ELSE
                                tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
                        END
                    ) - (
                        SELECT ROUND(SUM(
                            CASE 
                                WHEN tbl_inventory_filtered.pr_queue_code != 'Physical' 
                                AND DATE(tbl_inventory_filtered.trans_date) = :datePur
                                AND tbl_inventory_filtered.qty > 0 THEN
                                    tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
                                ELSE 0 
                            END), 2)
                    ), 2) AS prev_running_uom_val,

                

                ROUND(
        SUM(
            CASE
                WHEN tbl_inventory_filtered.qty > 0 
                AND DATE(tbl_inventory_filtered.trans_date) = $dateTo
                THEN tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val
                ELSE 0
            END
        ) + SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val), 2
    ) AS running_uom_val,

                ROUND((IFNULL(tbl_previous.running_uom_val,0)

                + IFNULL(tbl_purchases.running_uom_val,0)

                - SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val)),2) AS `usage_uom_val`,

                tbl_inventory_filtered.uom,

                ROUND(IFNULL(SUM(tbl_previous.qty * tbl_previous.cost_per_uom),0),2) AS prev_running_cost_per_uom,

                ROUND(IFNULL(SUM(tbl_purchases.qty * tbl_purchases.cost_per_uom),0),2) AS purchases_running_cost_per_uom,

                ROUND(IFNULL(SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom),0),2) AS running_cost_per_uom,

                ( ROUND(IFNULL(SUM(tbl_previous.qty * tbl_previous.cost_per_uom),0),2)

                + ROUND(IFNULL(SUM(tbl_purchases.qty * tbl_purchases.cost_per_uom),0),2)

                - ROUND(IFNULL(SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom),0),2)) AS usage_running_cost_per_uom,

                tbl_inventory_filtered.pr_queue_code,

                tbl_inventory_filtered.busunitcode,

                tbl_inventory_filtered.name,

                tbl_inventory_filtered.level,

                tbl_inventory_filtered.category,

                tbl_inventory_filtered.inv_class,

                lkp_area.area_code,

                lkp_area.area_name,

                tbl_physical_count.count,

                IFNULL(lkp_stock_levels.min_stock_level,0) AS min_stock_level

            FROM

                (SELECT

                    tbl_inventory_transactions.trans_date,

                        tbl_inventory_transactions.inv_code,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS description,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.rawmats_parent, lkp_build_of_products.portion_parent) AS parent_inv,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) AS parent_level,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,

                        tbl_inventory_transactions.qty,

                        tbl_inventory_transactions.cost_per_uom,

                        tbl_inventory_transactions.uom_val,

                        tbl_inventory_transactions.uom,

                        tbl_inventory_transactions.pr_queue_code,

                        tbl_inventory_transactions.busunitcode,

                        lkp_busunits.name,

                        lkp_busunits.pricing_category,

                        lkp_busunits.class AS level,

                        tbl_inventory_transactions.inv_class,

                        lkp_busunits.areacode

                FROM

                    tbl_inventory_transactions

                LEFT OUTER JOIN lkp_raw_mats ON tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code

                LEFT OUTER JOIN lkp_build_of_products ON tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code

                LEFT OUTER JOIN lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode

                LEFT OUTER JOIN tbl_pricing_details ON lkp_busunits.pricing_category = tbl_pricing_details.pricing_code

                    AND tbl_pricing_details.inv_code = tbl_inventory_transactions.inv_code

                WHERE

                    tbl_inventory_transactions.deletestatus = 'Active'

               

                        AND lkp_busunits.name IS NOT NULL) AS tbl_inventory_filtered

                    LEFT OUTER JOIN

                lkp_raw_mats ON tbl_inventory_filtered.inv_code = lkp_raw_mats.mat_code

                    LEFT OUTER JOIN

                lkp_build_of_products ON tbl_inventory_filtered.inv_code = lkp_build_of_products.build_code

                    LEFT OUTER JOIN

                lkp_area ON tbl_inventory_filtered.areacode = lkp_area.area_code

                    LEFT OUTER JOIN

                lkp_stock_levels ON tbl_inventory_filtered.inv_code = lkp_stock_levels.inv_code

                    AND tbl_inventory_filtered.busunitcode = lkp_stock_levels.level



            -- JOIN BEGINNING



                    LEFT OUTER JOIN ( SELECT

                'PREVIOUS',

                :dateHeaderFrom AS transdate,

                IF(parent_level = tbl_inventory_filtered.level

                        AND parent_inv <> '',

                    parent_inv,

                    tbl_inventory_filtered.inv_code) AS inv_code,

                IF(LEFT(tbl_inventory_filtered.inv_code, 2) = 'RM',

                    lkp_raw_mats.desc,

                    lkp_build_of_products.desc) AS description,

                SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val) AS running_uom_val,

                tbl_inventory_filtered.uom,

                SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom) AS running_cost_per_uom,

                tbl_inventory_filtered.pr_queue_code,

                tbl_inventory_filtered.busunitcode,

                tbl_inventory_filtered.name,

                tbl_inventory_filtered.level,

                tbl_inventory_filtered.category,

                tbl_inventory_filtered.inv_class,

                tbl_inventory_filtered.qty,

                tbl_inventory_filtered.cost_per_uom,

                lkp_area.area_code,

                lkp_area.area_name,

                lkp_stock_levels.min_stock_level

            FROM

                (SELECT DISTINCT

                    tbl_inventory_transactions.trans_date,

                        tbl_inventory_transactions.inv_code,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS description,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.rawmats_parent, lkp_build_of_products.portion_parent) AS parent_inv,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) AS parent_level,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,

                        tbl_inventory_transactions.qty,

                        tbl_inventory_transactions.cost_per_uom,

                        tbl_inventory_transactions.uom_val,

                        tbl_inventory_transactions.uom,

                        tbl_inventory_transactions.pr_queue_code,

                        tbl_inventory_transactions.busunitcode,

                        lkp_busunits.name,

                        lkp_busunits.pricing_category,

                        lkp_busunits.class AS level,

                        tbl_inventory_transactions.inv_class,

                        lkp_busunits.areacode

                FROM

                    tbl_inventory_transactions

                LEFT OUTER JOIN lkp_raw_mats ON tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code

                LEFT OUTER JOIN lkp_build_of_products ON tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code

                LEFT OUTER JOIN lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode

                LEFT OUTER JOIN tbl_pricing_details ON lkp_busunits.pricing_category = tbl_pricing_details.pricing_code

                    AND tbl_pricing_details.inv_code = tbl_inventory_transactions.inv_code

                WHERE

                    tbl_inventory_transactions.deletestatus = 'Active'

                        AND lkp_busunits.name IS NOT NULL) AS tbl_inventory_filtered

                    LEFT OUTER JOIN

                lkp_raw_mats ON tbl_inventory_filtered.inv_code = lkp_raw_mats.mat_code

                    LEFT OUTER JOIN

                lkp_build_of_products ON tbl_inventory_filtered.inv_code = lkp_build_of_products.build_code

                    LEFT OUTER JOIN

                lkp_area ON tbl_inventory_filtered.areacode = lkp_area.area_code

                    LEFT OUTER JOIN

                lkp_stock_levels ON tbl_inventory_filtered.inv_code = lkp_stock_levels.inv_code

                    AND tbl_inventory_filtered.busunitcode = lkp_stock_levels.level

            WHERE

                tbl_inventory_filtered.busunitcode LIKE :begbusunitcode

             AND  tbl_inventory_filtered.areacode LIKE :begareacode

            AND tbl_inventory_filtered.trans_date <= :begdatefrom

            GROUP BY tbl_inventory_filtered.level , IF(parent_level = tbl_inventory_filtered.level

                    AND parent_inv <> '',

                parent_inv,

                tbl_inventory_filtered.inv_code)) tbl_previous ON tbl_inventory_filtered.inv_code = tbl_previous.inv_code



                -- JOIN PURCHASES



                    LEFT OUTER JOIN ( SELECT

                'PURCHASES',

                :dateHeaderPurchase AS transdate,

                IF(parent_level = tbl_inventory_filtered.level

                        AND parent_inv <> '',

                    parent_inv,

                    tbl_inventory_filtered.inv_code) AS inv_code,

                IF(LEFT(tbl_inventory_filtered.inv_code, 2) = 'RM',

                    lkp_raw_mats.desc,

                    lkp_build_of_products.desc) AS description,

                SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.uom_val) AS running_uom_val,

                tbl_inventory_filtered.uom,

                SUM(tbl_inventory_filtered.qty * tbl_inventory_filtered.cost_per_uom) AS running_cost_per_uom,

                tbl_inventory_filtered.pr_queue_code,

                tbl_inventory_filtered.busunitcode,

                tbl_inventory_filtered.name,

                tbl_inventory_filtered.level,

                tbl_inventory_filtered.category,

                tbl_inventory_filtered.inv_class,

                tbl_inventory_filtered.qty,

                tbl_inventory_filtered.cost_per_uom,

                lkp_area.area_code,

                lkp_area.area_name,

                lkp_stock_levels.min_stock_level

            FROM

                (SELECT DISTINCT

                    tbl_inventory_transactions.trans_date,

                        tbl_inventory_transactions.inv_code,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS description,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.rawmats_parent, lkp_build_of_products.portion_parent) AS parent_inv,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.level, lkp_build_of_products.level) AS parent_level,

                        IF(LEFT(tbl_inventory_transactions.inv_code, 2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,

                        tbl_inventory_transactions.qty,

                        tbl_inventory_transactions.cost_per_uom,

                        tbl_inventory_transactions.uom_val,

                        tbl_inventory_transactions.uom,

                        tbl_inventory_transactions.pr_queue_code,

                        tbl_inventory_transactions.busunitcode,

                        lkp_busunits.name,

                        lkp_busunits.pricing_category,

                        lkp_busunits.class AS level,

                        tbl_inventory_transactions.inv_class,

                        lkp_busunits.areacode

                FROM

                    tbl_inventory_transactions

                LEFT OUTER JOIN lkp_raw_mats ON tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code

                LEFT OUTER JOIN lkp_build_of_products ON tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code

                LEFT OUTER JOIN lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode

                LEFT OUTER JOIN tbl_pricing_details ON lkp_busunits.pricing_category = tbl_pricing_details.pricing_code

                    AND tbl_pricing_details.inv_code = tbl_inventory_transactions.inv_code

                WHERE

                    tbl_inventory_transactions.deletestatus = 'Active'

                    AND tbl_inventory_transactions.qty > 0

                        AND lkp_busunits.name IS NOT NULL) AS tbl_inventory_filtered

                    LEFT OUTER JOIN

                lkp_raw_mats ON tbl_inventory_filtered.inv_code = lkp_raw_mats.mat_code

                    LEFT OUTER JOIN

                lkp_build_of_products ON tbl_inventory_filtered.inv_code = lkp_build_of_products.build_code

                    LEFT OUTER JOIN

                lkp_area ON tbl_inventory_filtered.areacode = lkp_area.area_code

                    LEFT OUTER JOIN

                lkp_stock_levels ON tbl_inventory_filtered.inv_code = lkp_stock_levels.inv_code

                    AND tbl_inventory_filtered.busunitcode = lkp_stock_levels.level

            WHERE

                tbl_inventory_filtered.busunitcode LIKE :purchasebusunitcode

            AND tbl_inventory_filtered.areacode LIKE :purchaseareacode

            AND tbl_inventory_filtered.trans_date BETWEEN :purchasedatebetween AND :purchasedateto

            GROUP BY tbl_inventory_filtered.level , IF(parent_level = tbl_inventory_filtered.level

                    AND parent_inv <> '',

                parent_inv,

                tbl_inventory_filtered.inv_code)) tbl_purchases ON tbl_inventory_filtered.inv_code = tbl_purchases.inv_code



             -- ADD PHYSICAL COUNT TABLE

                LEFT OUTER JOIN

                tbl_physical_count ON tbl_inventory_filtered.inv_code = tbl_physical_count.inv_code

                    AND tbl_inventory_filtered.busunitcode = tbl_physical_count.busunitcode

                    AND :physicalDate = tbl_physical_count.transdate



            WHERE

                tbl_inventory_filtered.busunitcode LIKE :busunitcode

             AND tbl_inventory_filtered.areacode LIKE :areacode

            AND tbl_inventory_filtered.trans_date <= :dateto

            GROUP BY tbl_inventory_filtered.level , IF(parent_level = tbl_inventory_filtered.level

                    AND parent_inv <> '',

                parent_inv,

                tbl_inventory_filtered.inv_code)";



            $stmt = $this->conn->prepare($sql);



            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

            $stmt->bindValue(":datePurchase", $dateTo, PDO::PARAM_STR);

            $stmt->bindValue(":dateSelect", $dateTo, PDO::PARAM_STR);

            $stmt->bindValue(":dateSelected", $dateTo, PDO::PARAM_STR);
            
            $stmt->bindValue(":datePur", $dateTo, PDO::PARAM_STR);

            $stmt->bindValue(":begbusunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":begareacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":begdatefrom", $dateFrom, PDO::PARAM_STR);



            $stmt->bindValue(":purchasebusunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":purchaseareacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":purchasedatebetween", $dateBetween, PDO::PARAM_STR);

            $stmt->bindValue(":purchasedateto", $dateTo, PDO::PARAM_STR);



            $stmt->bindValue(":physicalDate", $dateTo, PDO::PARAM_STR);



            $stmt->bindValue(":dateHeaderTo", $dateTo, PDO::PARAM_STR);

            $stmt->bindValue(":dateHeaderFrom", $dateFrom, PDO::PARAM_STR);

            $stmt->bindValue(":dateHeaderPurchase", $dateBetween, PDO::PARAM_STR);



            $stmt->execute();



            $data = [];



            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



                $data[] = $row;



            }



            return $data;



        } catch (Exception $e) {



            echo json_encode(["message" => $e->getMessage()]);



            exit;



        }



    }



    public function getbyPageData($pageIndex, $pageData)

    {



        $sql = "SELECT * FROM lkp_brands Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";



        $stmt = $this->conn->prepare($sql);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }



    public function getForUser($user_id, $id): array

    {



        $sql = "SELECT *































                FROM tbl_tasks































                WHERE id = :id































                AND user_id = :user_id";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":id", $id, PDO::PARAM_INT);



        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);



        $stmt->execute();



        $data = $stmt->fetch(PDO::FETCH_ASSOC);



        if ($data !== false) {



            $data['is_completed'] = (bool) $data['is_completed'];



        }



        return $data;



    }



    public function createForUser($user_id, $data)

    {



        $sql = "INSERT INTO lkp_brands ()















                VALUES (default, CONCAT('BN-',ShortUUID()),:brandname, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":brandname", $data["brandname"], PDO::PARAM_STR);



        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);



        $stmt->execute();



        echo json_encode(["message" => "Success"]);



    }



    public function rejectbranchs($user_id, string $id)

    {



        $sql = "UPDATE lkp_brands















                SET















                    deletestatus = 'Inactive',















                    usertracker  = :usertracker















                WHERE















                      brand_code  = :id";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":id", $id, PDO::PARAM_STR);



        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);



        $stmt->execute();



        return $stmt->rowCount();



    }



    public function editbranch($user_id, $id)

    {



        $branchcode = $id["brand_code"];



        $branchid = join($branchcode);



        $sql = "UPDATE lkp_brands















                SET















                    brand_name  = :brand_name,















                    usertracker  = :usertracker















                WHERE















                      brand_code  = :id";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":brand_name", $id["brandname"], PDO::PARAM_STR);



        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);



        $stmt->bindValue(":id", $branchid, PDO::PARAM_STR);



        $stmt->execute();



        return $stmt->rowCount();



    }



    public function updateForUser(int $user_id, string $id, array $data): int

    {



        $fields = [];



        if (!empty($data["name"])) {



            $fields["name"] = [



                $data["name"],



                PDO::PARAM_STR,



            ];



        }



        if (array_key_exists("priority", $data)) {



            $fields["priority"] = [



                $data["priority"],



                $data["priority"] === null ? PDO::PARAM_NULL : PDO::PARAM_INT,



            ];



        }



        if (array_key_exists("is_completed", $data)) {



            $fields["is_completed"] = [



                $data["is_completed"],



                PDO::PARAM_BOOL,



            ];



        }



        if (empty($fields)) {



            return 0;



        } else {



            $sets = array_map(function ($value) {



                return "$value = :$value";



            }, array_keys($fields));



            $sql = "UPDATE tbl_tasks"



            . " SET " . implode(", ", $sets)



                . " WHERE id = :id"



                . " AND user_id = :user_id";



            $stmt = $this->conn->prepare($sql);



            $stmt->bindValue(":id", $id, PDO::PARAM_INT);



            $stmt->bindValue(":user_id", $user_id, PDO::PARAM_INT);



            foreach ($fields as $name => $values) {



                $stmt->bindValue(":$name", $values[0], $values[1]);



            }



            $stmt->execute();



            return $stmt->rowCount();



        }



    }



    public function deletedataWithIds($ids)

    {



        foreach ($ids as $id) {



            $sql = "DELETE FROM tbl_sales































                WHERE uuid = :id";



            $stmt = $this->conn->prepare($sql);



            $stmt->bindValue(":id", $id, PDO::PARAM_STR);



            $stmt->execute();



        }



        return $stmt->rowCount();



    }



}

