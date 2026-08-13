<?php

class DashboardPnLGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllPNLData($data)
    {

        try {

            // SALES

            $sql = "SELECT 	tbl_sales_summary.busunitcode, lkp_busunits.areacode,

                YEAR(tbl_sales_summary.transdate) AS year, MONTH(tbl_sales_summary.transdate) AS month,

                UPPER(MONTHNAME(tbl_sales_summary.transdate)) AS full_month,

                SUM(tbl_sales_summary.total_sales) AS total_sales,

                SUM(tbl_sales_summary.total_discounts) AS total_discounts

                FROM tbl_sales_summary

                LEFT OUTER JOIN lkp_busunits ON tbl_sales_summary.busunitcode = lkp_busunits.busunitcode

                WHERE tbl_sales_summary.deletestatus = 'Active'

                AND YEAR(tbl_sales_summary.transdate) = :yearParams

                AND tbl_sales_summary.busunitcode LIKE :busunitcode

                AND lkp_busunits.areacode LIKE :areacode

                GROUP BY UPPER(MONTHNAME(tbl_sales_summary.transdate)), YEAR(tbl_sales_summary.transdate)";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":yearParams", $data["yearParams"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $salesData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $salesData[] = $row;

            }

            //COST OF SALES

            $sql = "SELECT subTwo.category, subTwo.class, subTwo.busunitcode, subTwo.areacode,
                    subTwo.year, subTwo.month, subTwo.full_month, ROUND(SUM(subTwo.total_cost),2) AS total_cost
                    FROM
                    (SELECT
                        IF(LEFT(tbl_inventory_transactions.inv_code,2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,
                        subOne.class,
                        tbl_inventory_transactions.busunitcode,
                        lkp_busunits.areacode,
                        YEAR(tbl_inventory_transactions.trans_date) AS year,
                        MONTH(tbl_inventory_transactions.trans_date) AS month,
                        UPPER(MONTHNAME(tbl_inventory_transactions.trans_date)) AS full_month,
                        ROUND((tbl_inventory_transactions.qty * tbl_inventory_transactions.cost_per_uom),
                                                    2) * -1 AS total_cost,
                        subOne.del_code
                    FROM
                        tbl_inventory_transactions
                            LEFT OUTER JOIN
                        lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode
                            LEFT OUTER JOIN
                        lkp_raw_mats ON tbl_inventory_transactions.inv_code = lkp_raw_mats.mat_code
                            LEFT OUTER JOIN
                        lkp_build_of_products ON tbl_inventory_transactions.inv_code = lkp_build_of_products.build_code
                            LEFT OUTER JOIN
                        (SELECT tbl_products_queue.prd_queue_code, tbl_products_queue.inv_code,
                    tbl_products_queue.orderedby, lkp_busunits.class, tbl_products_queue_summary.del_code
                    FROM tbl_products_queue
                    LEFT OUTER JOIN lkp_busunits ON tbl_products_queue.orderedby = lkp_busunits.busunitcode
                    LEFT OUTER JOIN tbl_products_queue_summary ON tbl_products_queue.prd_queue_code = tbl_products_queue_summary.prd_queue_code
                    WHERE tbl_products_queue.deletestatus = 'Active') subOne  ON subOne.prd_queue_code = tbl_inventory_transactions.pr_queue_code
                            AND subOne.inv_code = tbl_inventory_transactions.inv_code
                    WHERE
					tbl_inventory_transactions.deletestatus = 'Active'
                    AND  tbl_inventory_transactions.qty < 0
				  AND (subOne.del_code <> 'TRANSFER' OR subOne.del_code IS NULL OR (subOne.del_code IS NOT NULL AND subOne.del_code <> 'TRANSFER'))
                     AND YEAR(tbl_inventory_transactions.trans_date)  = :yearParams
                    AND tbl_inventory_transactions.busunitcode  LIKE :busunitcode
                    AND lkp_busunits.areacode LIKE :areacode
                    ) subTwo
                    WHERE subTwo.class <> 'SPOILAGE'
                    OR subTwo.class IS NULL
                    GROUP BY
                    subTwo.year,
                    subTwo.full_month,
                    subTwo.category
                    ORDER BY subTwo.category ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":yearParams", $data["yearParams"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $cosData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $cosData[] = $row;

            }

            //PAYROLL

            $sql = "SELECT
                        tbl_payroll_master.dateto,
                        tbl_employees.salary_type,
                        tbl_payroll_master.busunitcode,
                        lkp_busunits.areacode,
                        SUM(ROUND(tbl_payroll_master.basic  - tbl_payroll_master.sss_employee - tbl_payroll_master.phic_employee - tbl_payroll_master.mdf_employee,
                                2)) AS basicpay,
                        SUM(tbl_payroll_master.sss_employee) AS sss,
                        SUM(tbl_payroll_master.phic_employee) AS phic,
                        SUM(tbl_payroll_master.mdf_employee) AS mdf,
                        SUM(tbl_payroll_master.whtx) AS whtx,
                        SUM(tbl_payroll_master.tardiness) AS tardiness,
                        SUM(tbl_payroll_master.nightdiff) AS nightdiff,
                        SUM(tbl_payroll_master.overtime) AS overtime,
                        SUM(tbl_payroll_master.paidleaves) AS paidleaves,
                        YEAR(tbl_payroll_master.dateto) AS year,
                        MONTH(tbl_payroll_master.dateto) AS month,
                        UPPER(MONTHNAME(tbl_payroll_master.dateto)) AS full_month
                    FROM
                        tbl_payroll_master
                            LEFT OUTER JOIN
                        tbl_employees ON tbl_payroll_master.empid = tbl_employees.empid
                            LEFT OUTER JOIN
                        lkp_busunits ON tbl_payroll_master.busunitcode = lkp_busunits.busunitcode
                    WHERE
                        YEAR(tbl_payroll_master.dateto) = :yearParams
                        AND tbl_payroll_master.busunitcode LIKE :busunitcode
                        AND lkp_busunits.areacode LIKE :areacode
                    GROUP BY year , full_month , tbl_employees.salary_type
                    ORDER BY full_month , salary_type ASC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":yearParams", $data["yearParams"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $payrollData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $payrollData[] = $row;

            }

            //Spoilages

            $sql = "SELECT tbl_inventory_transactions.busunitcode AS spoilagebusunitcode, tbl_products_queue_summary.payee AS busunitcode,

				lkp_busunits.class, lkp_busunits.areacode, YEAR(tbl_inventory_transactions.trans_date) AS year,

                MONTH(tbl_inventory_transactions.trans_date) AS month,

                UPPER(MONTHNAME(tbl_inventory_transactions.trans_date)) AS full_month,

                SUM(tbl_inventory_transactions.qty * tbl_inventory_transactions.cost_per_uom) as total_cost

                FROM tbl_inventory_transactions

                LEFT OUTER JOIN lkp_busunits ON tbl_inventory_transactions.busunitcode = lkp_busunits.busunitcode

			    LEFT OUTER JOIN tbl_products_queue_summary ON tbl_inventory_transactions.pr_queue_code = tbl_products_queue_summary.prd_queue_code

                WHERE tbl_inventory_transactions.deletestatus = 'Active'

                AND tbl_inventory_transactions.qty > 0

                AND YEAR(tbl_inventory_transactions.trans_date) = :yearParams

                AND lkp_busunits.class = 'SPOILAGE'

                AND  tbl_products_queue_summary.payee LIKE  :busunitcode

                AND lkp_busunits.areacode LIKE :areacode

                GROUP BY UPPER(MONTHNAME(tbl_inventory_transactions.trans_date)), YEAR(tbl_inventory_transactions.trans_date)";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":yearParams", $data["yearParams"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $spoilagesData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $spoilagesData[] = $row;

            }

            //Disbursements

            $sql = "SELECT tbl_disbursements.busunitcode, lkp_busunits.areacode,

                YEAR(tbl_disbursements.transdate) AS year, MONTH(tbl_disbursements.transdate) AS month,

                UPPER(MONTHNAME(tbl_disbursements.transdate)) AS full_month, tbl_disbursements.sl_description,

                SUM(tbl_disbursements.amount) AS total_disbursements

                FROM tbl_disbursements

                LEFT OUTER JOIN lkp_busunits ON tbl_disbursements.busunitcode = lkp_busunits.busunitcode

                WHERE tbl_disbursements.deletestatus = 'Active'

                AND LEFT(tbl_disbursements.sl_code,3) > 799

                AND YEAR(tbl_disbursements.transdate) = :yearParams

                AND tbl_disbursements.busunitcode LIKE :busunitcode

                AND lkp_busunits.areacode LIKE :areacode

                GROUP BY tbl_disbursements.sl_code, UPPER(MONTHNAME(tbl_disbursements.transdate)),

                YEAR(tbl_disbursements.transdate)";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":yearParams", $data["yearParams"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $disbursementsData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $disbursementsData[] = $row;

            }

            //PCF Office

            $sql = "SELECT tbl_pcf_with_replenishment.busunitcode, lkp_busunits.areacode,

                YEAR(tbl_pcf_with_replenishment.transdate) AS year, MONTH(tbl_pcf_with_replenishment.transdate) AS month,

                UPPER(MONTHNAME(tbl_pcf_with_replenishment.transdate)) AS full_month, tbl_pcf_with_replenishment.sl_description,

                SUM(tbl_pcf_with_replenishment.amount) AS total_pcf_office_amount

                    FROM tbl_pcf_with_replenishment

                    LEFT OUTER JOIN lkp_busunits ON tbl_pcf_with_replenishment.busunitcode = lkp_busunits.busunitcode

                WHERE tbl_pcf_with_replenishment.deletestatus = 'Active'

                AND LEFT(tbl_pcf_with_replenishment.sl_code,3) > 799

                AND YEAR(tbl_pcf_with_replenishment.transdate) = :yearParams

                AND tbl_pcf_with_replenishment.busunitcode LIKE :busunitcode

                AND lkp_busunits.areacode LIKE :areacode

                GROUP BY tbl_pcf_with_replenishment.sl_code, UPPER(MONTHNAME(tbl_pcf_with_replenishment.transdate)),

                YEAR(tbl_pcf_with_replenishment.transdate)";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":yearParams", $data["yearParams"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $pcfOfficeData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $pcfOfficeData[] = $row;

            }

            //PCF Cashier

            $sql = "SELECT tbl_cash_sales_summary_tracker.busunitcode, lkp_busunits.areacode,

                YEAR(tbl_pcf.createdtime) AS year, MONTH(tbl_pcf.createdtime) AS month,

                UPPER(MONTHNAME(tbl_pcf.createdtime)) AS full_month, lkp_chart_of_accounts.sl_description,

                SUM(tbl_pcf.amount) AS total_pcf_cashier_amount

                    FROM tbl_pcf

                LEFT OUTER JOIN tbl_cash_sales_summary_tracker ON tbl_pcf.cash_trans_id = tbl_cash_sales_summary_tracker.cash_trans_id

                LEFT OUTER JOIN lkp_chart_of_accounts ON tbl_pcf.sl_code = lkp_chart_of_accounts.slcode

                LEFT OUTER JOIN lkp_busunits ON tbl_cash_sales_summary_tracker.busunitcode = lkp_busunits.busunitcode

                WHERE tbl_pcf.deletestatus = 'Active'

                AND LEFT(tbl_pcf.sl_code,3) > 799

                AND YEAR(tbl_pcf.createdtime) = :yearParams

                AND tbl_cash_sales_summary_tracker.busunitcode LIKE :busunitcode

                AND lkp_busunits.areacode LIKE :areacode

                GROUP BY tbl_pcf.sl_code, UPPER(MONTHNAME(tbl_pcf.createdtime)),

                YEAR(tbl_pcf.createdtime)";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":yearParams", $data["yearParams"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", "%" . $data["busunitcode"] . "%", PDO::PARAM_STR);

            $stmt->bindValue(":areacode", "%" . $data["areacode"] . "%", PDO::PARAM_STR);

            $stmt->execute();

            $pcfCashierData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $pcfCashierData[] = $row;

            }

            $consoData = ["sales" => $salesData, "cos" => $cosData, "disbursements" => $disbursementsData,
                "pcfoffice" => $pcfOfficeData, "pcfCashier" => $pcfCashierData, "spoilages" => $spoilagesData,
                "payrollData" => $payrollData];

            return $consoData;

        } catch (Exception $e) {

            echo json_encode(["message" => "Error"]);

            exit;

        }

    }

}
