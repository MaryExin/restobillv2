<?php

class CashieringReportGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($data)
    {

        $sql = "SELECT 
                    tbl_cash_sales_summary_tracker.transdate,
                    tbl_cash_sales_summary_tracker.cash_trans_id,
                    t2.busunitcode,
                    tbl_cash_sales_summary_tracker.usertracker,
                    t2.sales_id,
                    CONCAT(tbl_employees.firstname,
                            ' ',
                            tbl_employees.lastname) AS name,
                    IFNULL(tbl_cash_sales_summary_tracker.cash_opening_balance,
                            0) AS cash_opening_balance,
                    IFNULL(t2.total_sales, 0) AS total_sales,
                    IFNULL(t2.total_vat, 0) AS total_vat,
                    IFNULL(t2.total_discounts, 0) AS total_discounts,
                    IFNULL(t2.net_sales, 0) AS net_sales,
                    IFNULL(t2.total_other_mop, 0) AS total_other_mop,
                    ROUND((IFNULL(t2.net_sales, 0) - IFNULL(t2.total_other_mop, 0)),
                            2) AS cash_for_deposit,
                    IFNULL(t3.pcf_charges, 0) AS pcf_charges,
                    ROUND((IFNULL(t2.net_sales, 0) - IFNULL(t2.total_other_mop, 0) - IFNULL(t3.pcf_charges, 0)),
                            2) AS cash_balance,
                    tbl_cash_sales_summary_tracker.cash_count,
                    tbl_cash_sales_summary_tracker.variance
                FROM
                    tbl_cash_sales_summary_tracker
                        LEFT OUTER JOIN
                    (SELECT 
                        cash_trans_id,
                            busunitcode,
                                sales_id,
                            SUM(IFNULL(total_sales, 0)) AS total_sales,
                            SUM(IFNULL(total_vat, 0)) AS total_vat,
                            SUM(IFNULL(total_discounts, 0)) AS total_discounts,
                            SUM(IFNULL(total_other_mop, 0)) AS total_other_mop,
                            SUM(IFNULL(net_sales, 0)) AS net_sales,
                            SUM(IFNULL(net_sales, 0)) AS cash_received
                    FROM
                        tbl_sales_summary
                    WHERE
                        deletestatus = 'Active'
                    GROUP BY cash_trans_id) t2 ON tbl_cash_sales_summary_tracker.cash_trans_id = t2.cash_trans_id
                        LEFT OUTER JOIN
                    tbl_employees ON tbl_employees.empid = tbl_cash_sales_summary_tracker.usertracker
                        LEFT OUTER JOIN
                    (SELECT 
                        cash_trans_id, SUM(IFNULL(amount, 0)) AS pcf_charges
                    FROM
                        tbl_pcf
                    WHERE
                        deletestatus = 'Active'
                    GROUP BY cash_trans_id) t3 ON tbl_cash_sales_summary_tracker.cash_trans_id = t3.cash_trans_id
                WHERE
                    tbl_cash_sales_summary_tracker.transdate = :dateto
                        AND tbl_cash_sales_summary_tracker.deletestatus = 'Active'
                        AND t2.busunitcode = :busunitcode";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

     public function getDiscountSummaryData($data)
    {

    
        $sql = "SELECT 
                    tbl_sales_summary.sales_id,
                    tbl_discounts.discount_ref_no,
                    IFNULL(tbl_discounts.amount, 0) AS discount_amount,
                    lkp_discounts.description
                FROM
                    tbl_sales_summary
                        LEFT OUTER JOIN
                    tbl_discounts ON tbl_sales_summary.sales_id = tbl_discounts.sales_id
                        LEFT OUTER JOIN
                    lkp_discounts ON tbl_discounts.discount_type_id = lkp_discounts.discount_type_id
                WHERE
                    tbl_sales_summary.cash_trans_id = :cash_trans_id
                    AND discount_ref_no <> 'NULL'
                    ORDER BY  lkp_discounts.description ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":cash_trans_id", $data["cashtransid"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

      public function getOtherMopSummaryData($data)
    {

    
         $sql = "SELECT 
                    tbl_sales_summary.sales_id,
                    lkp_mop.description,
                    ROUND(SUM(IFNULL(tbl_mop_summary.amount, 0)),0) AS other_mop_amount,
                    tbl_mop_summary.payment_ref
                FROM
                    tbl_sales_summary
                        LEFT OUTER JOIN
                    tbl_mop_summary ON tbl_sales_summary.sales_id = tbl_mop_summary.sales_id
                    LEFT OUTER JOIN
                    lkp_mop ON tbl_mop_summary.mop_id = lkp_mop.mop_id
                WHERE
                    tbl_sales_summary.cash_trans_id = :cash_trans_id
                    AND lkp_mop.description <> 'CASH'
                    GROUP BY lkp_mop.description
                    ORDER BY lkp_mop.description ASC, 3 ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":cash_trans_id", $data["cashtransid"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }


    public function createForUser($user_id, $data)
    {

        if ($data["type"] === "cashOpening") {

            $sql = "INSERT INTO tbl_cash_sales_summary_tracker () VALUES (default, CONCAT('CT-',shortUUID()),







                DATE_ADD(NOW(), INTERVAL 8 HOUR), 0, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :cashbalance, 0, 0, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":cashbalance", $data["cashbalance"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            echo json_encode(["message" => "Success"]);

        }

    }

    public function updateForUser($user_id, $data)
    {

        $sql = "UPDATE tbl_mop_summary SET payment_status = 'Paid',

            usertracker = :user_tracker, createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)

            WHERE mop_trans_id = :moptransid";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":moptransid", $data["moptransid"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);

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
