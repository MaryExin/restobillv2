<?php

class DashboardSalesGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllDataByStore($data)
    {

        try {

            $sql = "SELECT tbl_sales_transactions.transdate, tbl_sales_summary.busunitcode,



            lkp_busunits.name, lkp_busunits.areacode, lkp_area.area_name,



            tbl_sales_transactions.inv_code, lkp_build_of_products.desc, tbl_sales_transactions.total_sales,



            tbl_sales_transactions.srp, tbl_sales_transactions.uomval, tbl_sales_transactions.uom,



            tbl_sales_transactions.qty, tbl_sales_transactions.discount_amount, tbl_sales_transactions.sales_id,



            tbl_sales_transactions.sales_trans_id, tbl_sales_transactions.createdtime



            FROM tbl_sales_transactions



            LEFT OUTER JOIN lkp_build_of_products



            ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code



            LEFT OUTER JOIN tbl_sales_summary



            ON tbl_sales_transactions.sales_trans_id = tbl_sales_summary.sales_trans_id



            LEFT OUTER JOIN lkp_busunits



            ON  tbl_sales_summary.busunitcode = lkp_busunits.busunitcode



            LEFT OUTER JOIN lkp_area



            ON  lkp_busunits.areacode = lkp_area.area_code



            WHERE tbl_sales_transactions.deletestatus = 'Active'



            AND tbl_sales_transactions.transdate BETWEEN :dateFrom AND :dateTo



            AND tbl_sales_summary.busunitcode LIKE :busunitcode GROUP BY tbl_sales_transactions.sales_id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllDataByArea($data)
    {

        try {

            $sql = "SELECT tbl_sales_transactions.transdate, tbl_sales_summary.busunitcode,



            lkp_busunits.name, lkp_busunits.areacode, lkp_area.area_name,



            tbl_sales_transactions.inv_code, lkp_build_of_products.desc, tbl_sales_transactions.total_sales,



            tbl_sales_transactions.srp, tbl_sales_transactions.uomval, tbl_sales_transactions.uom,



            tbl_sales_transactions.qty, tbl_sales_transactions.discount_amount, tbl_sales_transactions.sales_id,



            tbl_sales_transactions.sales_trans_id, tbl_sales_transactions.createdtime



            FROM tbl_sales_transactions



            LEFT OUTER JOIN lkp_build_of_products



            ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code



            LEFT OUTER JOIN tbl_sales_summary



            ON tbl_sales_transactions.sales_trans_id = tbl_sales_summary.sales_trans_id



            LEFT OUTER JOIN lkp_busunits



            ON  tbl_sales_summary.busunitcode = lkp_busunits.busunitcode



            LEFT OUTER JOIN lkp_area



            ON  lkp_busunits.areacode = lkp_area.area_code



            WHERE tbl_sales_transactions.deletestatus = 'Active'



            AND tbl_sales_transactions.transdate BETWEEN :dateFrom AND :dateTo



            AND lkp_busunits.areacode LIKE :areacode";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllDataByYearAndArea($data)
    {

        try {

            $sql = "SELECT YEAR(tbl_sales_transactions.transdate) AS year, tbl_sales_summary.busunitcode,



                lkp_busunits.name, lkp_busunits.areacode, lkp_area.area_name,



                SUM(tbl_sales_transactions.total_sales) AS totalsales



                FROM tbl_sales_transactions



                LEFT OUTER JOIN lkp_build_of_products



                ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code



                LEFT OUTER JOIN tbl_sales_summary



                ON tbl_sales_transactions.sales_trans_id = tbl_sales_summary.sales_trans_id



                LEFT OUTER JOIN lkp_busunits



                ON  tbl_sales_summary.busunitcode = lkp_busunits.busunitcode



                LEFT OUTER JOIN lkp_area



                ON  lkp_busunits.areacode = lkp_area.area_code



                WHERE tbl_sales_transactions.deletestatus = 'Active'



                AND lkp_busunits.areacode LIKE :areacode



                AND YEAR(tbl_sales_transactions.transdate) = :year



                GROUP BY year";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":year", $data["year"], PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllDataByMonthAndArea($data)
    {

        try {

            $sql = "SELECT YEAR(tbl_sales_transactions.transdate) AS year, MONTH(tbl_sales_transactions.transdate)AS month ,



                UPPER(DATE_FORMAT(tbl_sales_transactions.transdate, '%b')) AS monthname,



                tbl_sales_transactions.transdate, tbl_sales_summary.busunitcode,



                lkp_busunits.name, lkp_busunits.areacode, lkp_area.area_name,



                SUM(tbl_sales_transactions.total_sales) AS totalsales



                FROM tbl_sales_transactions



                LEFT OUTER JOIN lkp_build_of_products



                ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code



                LEFT OUTER JOIN tbl_sales_summary



                ON tbl_sales_transactions.sales_trans_id = tbl_sales_summary.sales_trans_id



                LEFT OUTER JOIN lkp_busunits



                ON  tbl_sales_summary.busunitcode = lkp_busunits.busunitcode



                LEFT OUTER JOIN lkp_area



                ON  lkp_busunits.areacode = lkp_area.area_code



                WHERE tbl_sales_transactions.deletestatus = 'Active'



                AND YEAR(tbl_sales_transactions.transdate) = :year



                AND lkp_busunits.areacode LIKE :areacode



                GROUP BY month";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":year", $data["year"], PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllDataByMonthAndAreaPerStore($data)
    {

        try {

            $sql = "SELECT YEAR(tbl_sales_transactions.transdate) AS year, MONTH(tbl_sales_transactions.transdate)AS month,



            UPPER(DATE_FORMAT(tbl_sales_transactions.transdate, '%M')) AS monthname,



            tbl_sales_transactions.transdate, tbl_sales_summary.busunitcode,



            lkp_busunits.name, lkp_busunits.areacode, lkp_area.area_name,



            SUM(tbl_sales_transactions.total_sales) AS totalsales



            FROM tbl_sales_transactions



            LEFT OUTER JOIN lkp_build_of_products



            ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code



            LEFT OUTER JOIN tbl_sales_summary



            ON tbl_sales_transactions.sales_trans_id = tbl_sales_summary.sales_trans_id



            LEFT OUTER JOIN lkp_busunits



            ON  tbl_sales_summary.busunitcode = lkp_busunits.busunitcode



            LEFT OUTER JOIN lkp_area



            ON  lkp_busunits.areacode = lkp_area.area_code



            WHERE tbl_sales_transactions.deletestatus = 'Active'



            AND YEAR(tbl_sales_transactions.transdate) = :year



            AND UPPER(DATE_FORMAT(tbl_sales_transactions.transdate, '%M')) = :month



            AND lkp_busunits.areacode LIKE :areacode



            GROUP BY tbl_sales_summary.busunitcode



            ORDER BY totalsales ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":year", $data["year"], PDO::PARAM_STR);

            $stmt->bindValue(":month", $data["month"], PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllDataByYearAndAreaPerStore($data)
    {

        try {

            $sql = "SELECT YEAR(tbl_sales_transactions.transdate) AS year, MONTH(tbl_sales_transactions.transdate)AS month ,



                UPPER(DATE_FORMAT(tbl_sales_transactions.transdate, '%b')) AS monthname,



                tbl_sales_transactions.transdate, tbl_sales_summary.busunitcode,



                lkp_busunits.name, lkp_busunits.areacode, lkp_area.area_name,



                SUM(tbl_sales_transactions.total_sales) AS totalsales



                FROM tbl_sales_transactions



                LEFT OUTER JOIN lkp_build_of_products



                ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code



                LEFT OUTER JOIN tbl_sales_summary



                ON tbl_sales_transactions.sales_trans_id = tbl_sales_summary.sales_trans_id



                LEFT OUTER JOIN lkp_busunits



                ON  tbl_sales_summary.busunitcode = lkp_busunits.busunitcode



                LEFT OUTER JOIN lkp_area



                ON  lkp_busunits.areacode = lkp_area.area_code



                WHERE tbl_sales_transactions.deletestatus = 'Active'



                AND YEAR(tbl_sales_transactions.transdate) = :year



                AND lkp_busunits.areacode LIKE :areacode



                GROUP BY tbl_sales_summary.busunitcode";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":year", $data["year"], PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllOpenStoresToday($data)
    {

        try {

            $sql = "SELECT

                lkp_busunits.busunitcode,

                lkp_busunits.class,

                lkp_busunits.name,

                lkp_busunits.areacode,

                tbl_cash_sales_summary_tracker.cash_trans_id,

                tbl_cash_sales_summary_tracker.opening_time,

                tbl_cash_sales_summary_tracker.closing_time,

                tbl_cash_sales_summary_tracker.transdate,

                tbl_cash_sales_summary_tracker.cash_opening_balance,

                tbl_cash_sales_summary_tracker.cash_closing_balance,

                tbl_cash_sales_summary_tracker.cash_count,

                tbl_cash_sales_summary_tracker.variance,

                tbl_cash_sales_summary_tracker.usertracker,

                UPPER(CONCAT(tbl_employees.firstname, ' ', tbl_employees.lastname)) AS employeename,

                CASE

                    WHEN

                        tbl_cash_sales_summary_tracker.opening_time <> 0

                            AND tbl_cash_sales_summary_tracker.closing_time = 0

                    THEN

                        'OPEN'

                    ELSE 'CLOSED'

                END AS storestatus

            FROM

                lkp_busunits

                    LEFT OUTER JOIN

                tbl_cash_sales_summary_tracker ON lkp_busunits.busunitcode = tbl_cash_sales_summary_tracker.busunitcode

                    LEFT OUTER JOIN

                tbl_employees ON tbl_cash_sales_summary_tracker.usertracker = tbl_employees.empid

            WHERE

                lkp_busunits.class = 'STORE'

                    AND lkp_busunits.deletestatus = 'Active'

                    AND lkp_busunits.areacode LIKE :areacode

                    AND tbl_cash_sales_summary_tracker.transdate = :currentdate";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":currentdate", $data["currentdate"], PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllClosedStoresToday($data)
    {

        try {

            $sql = "SELECT lkp_busunits.busunitcode,  lkp_busunits.class, lkp_busunits.name, lkp_busunits.areacode,



                    tbl_cash_summary_filtered.cash_trans_id, tbl_cash_summary_filtered.opening_time,  tbl_cash_summary_filtered.closing_time,



                    tbl_cash_summary_filtered.transdate, tbl_cash_summary_filtered.cash_opening_balance, tbl_cash_summary_filtered.cash_closing_balance,



                    tbl_cash_summary_filtered.cash_count, tbl_cash_summary_filtered.variance, CASE



                       WHEN tbl_cash_summary_filtered.closing_time <> 0  AND tbl_cash_summary_filtered.opening_time <> 0

						OR tbl_cash_summary_filtered.opening_time IS NULL OR tbl_cash_summary_filtered.closing_time IS NULL



                        THEN 'CLOSED'



                        ELSE 'OPEN'



                    END AS storestatus



                    FROM lkp_busunits



                    LEFT OUTER JOIN (SELECT tbl_cash_sales_summary_tracker.cash_trans_id, tbl_cash_sales_summary_tracker.opening_time,



                    tbl_cash_sales_summary_tracker.closing_time, tbl_cash_sales_summary_tracker.transdate, tbl_cash_sales_summary_tracker.busunitcode,



                    tbl_cash_sales_summary_tracker.cash_opening_balance, tbl_cash_sales_summary_tracker.cash_closing_balance,



                    tbl_cash_sales_summary_tracker.cash_count, tbl_cash_sales_summary_tracker.variance



                    FROM tbl_cash_sales_summary_tracker



                    WHERE tbl_cash_sales_summary_tracker.transdate = :currentdate)



                    AS tbl_cash_summary_filtered ON



                    lkp_busunits.busunitcode =  tbl_cash_summary_filtered.busunitcode



                    WHERE lkp_busunits.class = 'STORE'



                    AND  lkp_busunits.deletestatus = 'Active'



                    AND lkp_busunits.areacode LIKE :areacode";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":currentdate", $data["currentdate"], PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllMOPToday($data)
    {

        try {

            $sql = "SELECT  tbl_mop_summary.transdate, tbl_mop_summary.mop_trans_id,



                lkp_mop.description, lkp_mop.account_no, tbl_mop_summary.mop_id,



                tbl_mop_summary.amount, tbl_mop_summary.payment_ref, tbl_mop_summary.sales_id,



                tbl_sales_summary.busunitcode, lkp_busunits.areacode



                FROM tbl_mop_summary



                LEFT OUTER JOIN lkp_mop ON  tbl_mop_summary.mop_id = lkp_mop.mop_id



                LEFT OUTER JOIN tbl_sales_summary ON tbl_mop_summary.sales_id =  tbl_sales_summary.sales_id



                LEFT OUTER JOIN lkp_busunits ON tbl_sales_summary.busunitcode =  lkp_busunits.busunitcode



                WHERE tbl_mop_summary.deletestatus = 'Active'



                AND lkp_busunits.areacode LIKE :areacode



                AND tbl_mop_summary.transdate = :currentdate";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":currentdate", $data["currentdate"], PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllDataPerProductSold($data)
    {

        try {

            $sql = "SELECT



                tbl_sales_transactions.sales_trans_id, tbl_sales_transactions.transdate,



                tbl_sales_transactions.inv_code, lkp_build_of_products.desc, tbl_sales_summary.busunitcode, lkp_busunits.areacode,



                SUM(tbl_sales_transactions.qty) AS qty,



                tbl_sales_transactions.cost_per_uom, tbl_sales_transactions.uomval, tbl_sales_transactions.uom, SUM(tbl_sales_transactions.total_cost) AS total_cost,



                tbl_sales_transactions.srp, SUM(tbl_sales_transactions.total_sales) AS total_sales, ROUND(SUM(tbl_sales_transactions.vat),2) AS vat, tbl_sales_transactions.tax_type,



                tbl_sales_transactions.discount_type_id, SUM(tbl_sales_transactions.discount_amount) AS discount_amount, tbl_sales_transactions.sales_id



                FROM tbl_sales_transactions



                LEFT OUTER JOIN lkp_build_of_products ON tbl_sales_transactions.inv_code =  lkp_build_of_products.build_code



                LEFT OUTER JOIN tbl_sales_summary ON tbl_sales_summary.sales_id =  tbl_sales_transactions.sales_id



                LEFT OUTER JOIN lkp_busunits ON lkp_busunits.busunitcode =  tbl_sales_summary.busunitcode



                WHERE tbl_sales_summary.deletestatus = 'Active'



                AND lkp_busunits.areacode LIKE :areacode



                AND tbl_sales_summary.busunitcode LIKE :busunitcode



                AND tbl_sales_transactions.transdate BETWEEN :dateFrom AND :dateTo



                GROUP BY tbl_sales_transactions.inv_code



                ORDER BY total_sales ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getSalesTabular($data)
    {

        try {

            $sql = "SELECT
                        tbl_sales_transactions.transdate,
                        tbl_sales_summary.busunitcode,
                        IF(LEFT(tbl_sales_transactions.inv_code, 2) = 'RM',
                            lkp_raw_mats.category,
                            lkp_build_of_products.category) AS category,
                        lkp_busunits.name,
                        lkp_busunits.areacode,
                        lkp_area.area_name,
                        tbl_sales_transactions.inv_code,
                        lkp_build_of_products.desc,
                        SUM(tbl_sales_transactions.total_sales) AS total_sales,
                        tbl_sales_transactions.srp,
                        tbl_sales_transactions.uomval,
                        tbl_sales_transactions.uom,
                        SUM(tbl_sales_transactions.qty) AS qty,
                        SUM(tbl_sales_transactions.discount_amount) AS discount_amount,
                        tbl_sales_transactions.sales_id,
                        tbl_sales_transactions.sales_trans_id,
                        tbl_sales_transactions.createdtime
                    FROM
                        tbl_sales_transactions
                            LEFT OUTER JOIN
                        lkp_build_of_products ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code
                            LEFT OUTER JOIN
                        tbl_sales_summary ON tbl_sales_transactions.sales_trans_id = tbl_sales_summary.sales_trans_id
                            LEFT OUTER JOIN
                        lkp_busunits ON tbl_sales_summary.busunitcode = lkp_busunits.busunitcode
                            LEFT OUTER JOIN
                        lkp_area ON lkp_busunits.areacode = lkp_area.area_code
                            LEFT OUTER JOIN
                        lkp_raw_mats ON tbl_sales_transactions.inv_code = lkp_raw_mats.mat_code
                    WHERE
                        tbl_sales_transactions.deletestatus = 'Active'
                            AND lkp_busunits.areacode LIKE :areacode
                            AND tbl_sales_summary.busunitcode LIKE :busunitcode
                            AND tbl_sales_transactions.transdate BETWEEN :dateFrom AND :dateTo
                    GROUP BY tbl_sales_transactions.inv_code
                    ORDER BY lkp_busunits.name ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getAllSalesPerDay($data)
    {

        try {

            $sql = "SELECT



                tbl_sales_transactions.sales_trans_id, tbl_sales_transactions.transdate,



                tbl_sales_transactions.inv_code, lkp_build_of_products.desc, tbl_sales_summary.busunitcode, lkp_busunits.areacode,



                SUM(tbl_sales_transactions.qty) AS qty,



                tbl_sales_transactions.cost_per_uom, tbl_sales_transactions.uomval, tbl_sales_transactions.uom, SUM(tbl_sales_transactions.total_cost) AS total_cost,



                tbl_sales_transactions.srp, SUM(tbl_sales_transactions.total_sales) AS total_sales, ROUND(SUM(tbl_sales_transactions.vat),2) AS vat, tbl_sales_transactions.tax_type,



                tbl_sales_transactions.discount_type_id, SUM(tbl_sales_transactions.discount_amount) AS discount_amount, tbl_sales_transactions.sales_id



                FROM tbl_sales_transactions



                LEFT OUTER JOIN lkp_build_of_products ON tbl_sales_transactions.inv_code =  lkp_build_of_products.build_code



                LEFT OUTER JOIN tbl_sales_summary ON tbl_sales_summary.sales_id =  tbl_sales_transactions.sales_id



                LEFT OUTER JOIN lkp_busunits ON lkp_busunits.busunitcode =  tbl_sales_summary.busunitcode



                WHERE tbl_sales_summary.deletestatus = 'Active'



                  AND lkp_busunits.areacode LIKE :areacode



                AND tbl_sales_summary.busunitcode LIKE :busunitcode



                AND tbl_sales_transactions.transdate BETWEEN :dateFrom AND :dateTo



                GROUP BY tbl_sales_transactions.transdate



                ORDER BY tbl_sales_transactions.transdate";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

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
