<?php

class DashboardWareHouseGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllWarehouseData($user_id, $data)
    {

        $dailysales = [];
        $monthlysales = [];
        $yearlysales = [];
        $topProducts = [];
        $transactionbydate = [];

        // sales today
        $sql = "SELECT bu.name, SUM(COALESCE(pqs.subtotal, 0)) + SUM(COALESCE(pcd.amount, 0)) AS today_sales
                FROM lkp_busunits AS bu
                LEFT OUTER JOIN tbl_products_queue_summary AS pqs 
                    ON bu.busunitcode = pqs.orderedby
                LEFT OUTER JOIN tbl_pr_charge_deduction AS pcd
                    ON pqs.prd_queue_code = pcd.transaction_id
                WHERE bu.class = 'STORE'
                  AND pqs.payee = :busunitcode
                  AND pqs.billing_date BETWEEN :dateFrom AND :dateTo
                GROUP BY bu.busunitcode";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
        $stmt->bindValue(":dateFrom", $data["dateFrom"]);
        $stmt->bindValue(":dateTo", $data["dateTo"]);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $dailysales[] = $row;
        }

        // monthly sales
        $monthName = strtoupper($data["month"]); 
        $year = $data["year"];                    

        $monthNumber = date('m', strtotime("1 $monthName"));
        $dateFrom = "$year-$monthNumber-01";
        $dateTo = date("Y-m-t", strtotime($dateFrom));

        $sql = "SELECT bu.name, SUM(COALESCE(pqs.subtotal, 0)) + SUM(COALESCE(pcd.amount, 0)) AS monthly_sales 
                FROM lkp_busunits AS bu
                LEFT OUTER JOIN tbl_products_queue_summary AS pqs 
                    ON bu.busunitcode = pqs.orderedby
                LEFT OUTER JOIN tbl_pr_charge_deduction AS pcd
                    ON pqs.prd_queue_code = pcd.transaction_id
                WHERE bu.class = 'STORE'
                  AND pqs.payee = :busunitcode
                  AND pqs.billing_date BETWEEN :dateFrom AND :dateTo
                GROUP BY bu.busunitcode";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
        $stmt->bindValue(":dateFrom", $dateFrom);
        $stmt->bindValue(":dateTo", $dateTo);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $monthlysales[] = $row;
        }

        // top products
        $sql = "SELECT 
            COALESCE(rm.mat_code, bop.build_code) AS inv_code,
            COALESCE(rm.desc, bop.desc) AS product_description,
            SUM(pq.uomval) AS total_sales
        FROM lkp_busunits AS bu
        LEFT JOIN tbl_products_queue_summary AS pqs 
            ON bu.busunitcode = pqs.orderedby
        LEFT JOIN tbl_products_queue AS pq
            ON pqs.prd_queue_code = pq.prd_queue_code
        LEFT JOIN lkp_raw_mats AS rm
            ON pq.inv_code = rm.mat_code AND pq.inv_code LIKE 'RM%'
        LEFT JOIN lkp_build_of_products AS bop
            ON pq.inv_code = bop.build_code AND pq.inv_code LIKE 'BD%'
        WHERE bu.class = 'STORE'
          AND pqs.payee = :busunitcode
          AND pqs.billing_date BETWEEN :dateFrom AND :dateTo
        GROUP BY pq.inv_code
        ORDER BY total_sales DESC
        LIMIT 10";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
        $stmt->bindValue(":dateFrom", $dateFrom);
        $stmt->bindValue(":dateTo", $dateTo);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $topProducts[] = $row;
        }

        // yearly sales
        $dateFrom = "$year-01-01";
        $dateTo = "$year-12-31";

        $sql = "SELECT 
                    bu.name,
                    SUM(COALESCE(pqs.subtotal, 0)) + SUM(COALESCE(pcd.amount, 0)) AS yearly_sales
                FROM lkp_busunits AS bu
                LEFT OUTER JOIN tbl_products_queue_summary AS pqs 
                    ON bu.busunitcode = pqs.orderedby
                LEFT OUTER JOIN tbl_pr_charge_deduction AS pcd
                    ON pqs.prd_queue_code = pcd.transaction_id
                WHERE bu.class = 'STORE'
                  AND pqs.payee = :busunitcode
                  AND pqs.billing_date BETWEEN :dateFrom AND :dateTo
                GROUP BY bu.busunitcode";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
        $stmt->bindValue(":dateFrom", $dateFrom);
        $stmt->bindValue(":dateTo", $dateTo);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $yearlysales[] = $row;
        }

        $sql = "SELECT 
            SUM(COALESCE(pqs.subtotal, 0)) + SUM(COALESCE(pcd.amount, 0)) AS total_sale,
            pqs.billing_date as transdate,
            COALESCE(rm.mat_code, bop.build_code) AS inv_code,
            COALESCE(rm.desc, bop.desc) AS product_description,
            SUM(pq.quantity) AS total_sales
        FROM lkp_busunits AS bu
        LEFT JOIN tbl_products_queue_summary AS pqs 
            ON bu.busunitcode = pqs.orderedby
        LEFT JOIN tbl_products_queue AS pq
            ON pqs.prd_queue_code = pq.prd_queue_code
        LEFT JOIN lkp_raw_mats AS rm
            ON pq.inv_code = rm.mat_code AND pq.inv_code LIKE 'RM%'
        LEFT JOIN lkp_build_of_products AS bop
            ON pq.inv_code = bop.build_code AND pq.inv_code LIKE 'BD%'
        LEFT OUTER JOIN tbl_pr_charge_deduction AS pcd
            ON pqs.prd_queue_code = pcd.transaction_id
        WHERE bu.class = 'STORE'
          AND pqs.payee = :busunitcode
          AND pqs.billing_date = :dateTo
        GROUP BY pq.inv_code
        ORDER BY pqs.billing_date ASC";



        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
        $stmt->bindValue(":dateTo", $data["dateTo"]);
        $stmt->execute();

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $transactionbydate[] = $row;
        }

        

        echo json_encode([
            "data" => [
                "dailysales" => $dailysales,
                "monthlysales" => $monthlysales,
                "yearlysales" => $yearlysales
            ],
            "productdata" => [
                "topProducts" => $topProducts,
                "transactionbydate" => $transactionbydate
            ]
        ]);
    }


}
