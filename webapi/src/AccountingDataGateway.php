<?php

class AccountingDataGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM tbl_employees ORDER BY seq DESC LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetAccountingTransactions($busunitCode, $dateFrom, $dateTo)
    {

        $sql = "SELECT

                        *

                    FROM

                        tbl_accounting_transactions

                    WHERE

                        deletestatus = 'Active'

                            AND transdate BETWEEN :datefrom AND :dateto

                            AND busunitcode = :busunitcode

                            AND approvalstatus = 'Posted'

                    ORDER BY seq ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);

        $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }


    public function ExcelGetFormHDataCorp($dateFrom, $dateTo)
    {

        $sql = "SELECT
                    lkp_busunits.corpcode,
                    tbl_accounting_transactions.transdate,
                    tbl_accounting_transactions.glcode,
                    ROUND(SUM(tbl_accounting_transactions.amount),
                            2) AS amount
                FROM
                    tbl_accounting_transactions
                        LEFT OUTER JOIN
                    lkp_busunits ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
                WHERE
                    tbl_accounting_transactions.deletestatus = 'Active'
                        AND transdate BETWEEN :datefrom AND :dateto
                        AND tbl_accounting_transactions.approvalstatus = 'Posted'
                GROUP BY lkp_busunits.corpcode , tbl_accounting_transactions.glcode
                ORDER BY lkp_busunits.corpcode ASC , tbl_accounting_transactions.glcode ASC , tbl_accounting_transactions.transdate ASC;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

     public function ExcelGetLedgerListCorp($corpCode, $dateTo, $glCode)
    {

        $sql = "SELECT
                    tbl_accounting_transactions.slcode, lkp_slcodes.sldescription,
                    round(sum(tbl_accounting_transactions.amount),2) AS amount,
                    lkp_busunits.corpcode
                FROM
                    tbl_accounting_transactions
                    LEFT OUTER JOIN lkp_slcodes ON tbl_accounting_transactions.slcode = lkp_slcodes.slcodes
					LEFT OUTER JOIN lkp_busunits ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
                WHERE
                    tbl_accounting_transactions.deletestatus = 'Active'
                        AND tbl_accounting_transactions.transdate <= :dateto
                        AND lkp_busunits.corpcode = :corpcode
                        AND tbl_accounting_transactions.approvalstatus = 'Posted'
                        AND tbl_accounting_transactions.glcode = :glcode
                GROUP BY tbl_accounting_transactions.slcode
                ORDER BY tbl_accounting_transactions.slcode ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":corpcode", $corpCode, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":glcode", $glCode, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

     public function ExcelGetAccountingTransactionsByCorp($corpCode, $dateFrom, $dateTo)
    {

        $sql = "SELECT

                        tbl_accounting_transactions.*, lkp_busunits.corpcode

                    FROM

                        tbl_accounting_transactions

					LEFT OUTER JOIN lkp_busunits ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode

                    WHERE

                        tbl_accounting_transactions.deletestatus = 'Active'

                             AND tbl_accounting_transactions.transdate BETWEEN :datefrom AND :dateto

                            AND lkp_busunits.corpcode = :corpcode

                            AND tbl_accounting_transactions.approvalstatus = 'Posted'

                    ORDER BY seq ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":corpcode", $corpCode, PDO::PARAM_STR);

        $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }


    

    public function ExcelGetLedgerList($busunitCode, $dateTo, $glCode)
    {

        $sql = "SELECT
                    tbl_accounting_transactions.slcode, lkp_slcodes.sldescription,
                    round(sum(tbl_accounting_transactions.amount),2) AS amount
                FROM
                    tbl_accounting_transactions
                    LEFT OUTER JOIN lkp_slcodes ON tbl_accounting_transactions.slcode = lkp_slcodes.slcodes
                WHERE
                    tbl_accounting_transactions.deletestatus = 'Active'
                        AND tbl_accounting_transactions.transdate <= :dateto
                        AND tbl_accounting_transactions.busunitcode = :busunitcode
                        AND tbl_accounting_transactions.approvalstatus = 'Posted'
                        AND tbl_accounting_transactions.glcode = :glcode
                GROUP BY tbl_accounting_transactions.slcode
                ORDER BY tbl_accounting_transactions.slcode ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":glcode", $glCode, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetRunningBal($busunitCode, $dateFrom, $dateTo, $slCode)
    {

        $sql = "SELECT
                    transdate,
                    menutransactedref,
                    reference,
                    document_date,
                    amount,
                    particulars,
                    supplier_code,
                    customer_id,
                    transactiontype,
                    usertracker
                FROM
                    tbl_accounting_transactions
                WHERE
                    deletestatus = 'Active'
                        AND transdate BETWEEN :datefrom AND :dateto
                        AND busunitcode = :busunitcode
                        AND approvalstatus = 'Posted'
                        AND slcode = :slcode
                ORDER BY transdate ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);

        $stmt->bindValue(":slcode", $slCode, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetRunningBalCorp($corpCode, $dateFrom, $dateTo, $slCode)
    {

        $sql = "SELECT
                    tbl_accounting_transactions.transdate,
                    tbl_accounting_transactions.menutransactedref,
                    tbl_accounting_transactions.reference,
                    tbl_accounting_transactions.document_date,
                    tbl_accounting_transactions.amount,
                    tbl_accounting_transactions.particulars,
                    tbl_accounting_transactions.supplier_code,
                    tbl_accounting_transactions.customer_id,
                    tbl_accounting_transactions.transactiontype,
                    tbl_accounting_transactions.usertracker,
                    lkp_busunits.corpcode
                FROM
                    tbl_accounting_transactions
                LEFT OUTER JOIN lkp_busunits ON tbl_accounting_transactions.busunitcode = lkp_busunits.busunitcode
                WHERE
                    tbl_accounting_transactions.deletestatus = 'Active'
                        AND tbl_accounting_transactions.transdate BETWEEN :datefrom AND :dateto
                        AND lkp_busunits.corpcode = :corpcode
                        AND tbl_accounting_transactions.approvalstatus = 'Posted'
                        AND tbl_accounting_transactions.slcode = :slcode
                ORDER BY tbl_accounting_transactions.transdate ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":corpcode", $corpCode, PDO::PARAM_STR);

        $stmt->bindValue(":slcode", $slCode, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }
    public function ExcelGetFormHData($dateFrom, $dateTo)
    {

        $sql = "SELECT

                    busunitcode,

                    transdate,

                    glcode,

                    ROUND(SUM(amount), 2) AS amount

                FROM

                    tbl_accounting_transactions

                    WHERE

                        deletestatus = 'Active'

                            AND transdate BETWEEN :datefrom AND :dateto

                            AND approvalstatus = 'Posted'

                            GROUP BY busunitcode, glcode

                    ORDER BY busunitcode ASC, glcode ASC, transdate ASC;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM tbl_employees ORDER BY position ASC, firstname ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getCustomerDetails($data)
    {

        try {

            $sql = "SELECT * FROM tbl_customer_details WHERE deletestatus = 'Active'



            AND customer_id = :customer_id;";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":customer_id", $data["customerid"], PDO::PARAM_STR);

            $stmt->execute();

            $customerData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $customerData[] = $row;

            }

            $sql = "SELECT tbl_user_roles.uuid, tbl_user_roles.userid, tbl_user_roles.rolename,



                tbl_user_roles.roleclass, tbl_user_roles.role_description , lkp_busunits.name



                FROM tbl_user_roles



                LEFT OUTER JOIN lkp_busunits ON  tbl_user_roles.rolename = lkp_busunits.busunitcode



                WHERE tbl_user_roles.deletestatus = 'Active'



                AND tbl_user_roles.userid = :customer_id ;";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":customer_id", $data["customerid"], PDO::PARAM_STR);

            $stmt->execute();

            $roleData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $roleData[] = $row;

            }

            return ["customerdata" => $customerData, "roledata" => $roleData];

        } catch (PDOException $e) {

            // Handle database errors

            // For example, you can log the error or throw a custom exception

            // Log error

            error_log("Database error: " . $e->getMessage());

            // Or throw a custom exception

            throw new Exception("Database error occurred");

        } catch (Exception $e) {

            // Handle other types of errors

            // For example, you can log the error or re-throw it

            // Log error

            error_log("Error: " . $e->getMessage());

            // Re-throw the exception to let the caller handle it

            throw $e;

        }

    }

    public function getCustomersDetailsForId($data)
    {

        $sql = "SELECT *  FROM `tbl_customer_details` WHERE deletestatus = 'Active'



            AND customername LIKE :name ;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":name", '%' . $data["name"] . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_customer_details



            WHERE deletestatus = 'Active'



            AND customername LIKE :search



            LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        $response = [

            'items' => $data,

            'nextPage' => $page + 1, // Provide the next page number

        ];

        return $response;

    }

    public function getCustomerHistory($data)
    {

        $sql = "SELECT tbl_sales_transactions.transdate, tbl_sales_transactions.inv_code,



                IF(LEFT(tbl_sales_transactions.inv_code,2) = 'RM', lkp_raw_mats.desc, lkp_build_of_products.desc) AS productname,



                IF(LEFT(tbl_sales_transactions.inv_code,2) = 'RM', lkp_raw_mats.category, lkp_build_of_products.category) AS category,



                tbl_sales_transactions.qty, tbl_sales_transactions.cost_per_uom ,



                tbl_sales_transactions.uomval, tbl_sales_transactions.uom, tbl_sales_transactions.total_cost,



                tbl_sales_transactions.srp, tbl_sales_transactions.total_sales, tbl_sales_transactions.vat,



                tbl_sales_transactions.tax_type, tbl_sales_transactions.discount_type_id, tbl_sales_transactions.discount_amount,



                tbl_sales_transactions.sales_id,



                tbl_sales_summary.customer_id



                FROM tbl_sales_transactions



                    LEFT OUTER JOIN tbl_sales_summary ON tbl_sales_transactions.sales_id = tbl_sales_summary.sales_id



                    LEFT OUTER JOIN	lkp_raw_mats ON tbl_sales_transactions.inv_code = lkp_raw_mats.mat_code



                    LEFT OUTER JOIN	lkp_build_of_products ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code



                WHERE tbl_sales_transactions.deletestatus = 'Active'



                AND tbl_sales_summary.customer_id = :customerid



                ORDER BY tbl_sales_transactions.transdate DESC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":customerid", $data["customerid"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetLedgerList_DateRange($busunitCode, $dateFrom, $dateTo, $glCode)
    {

        $sql = "SELECT
                    tbl_accounting_transactions.slcode, lkp_slcodes.sldescription,
                    round(sum(tbl_accounting_transactions.amount),2) AS amount
                FROM
                    tbl_accounting_transactions
                    LEFT OUTER JOIN lkp_slcodes ON tbl_accounting_transactions.slcode = lkp_slcodes.slcodes
                WHERE
                    tbl_accounting_transactions.deletestatus = 'Active'
                        AND tbl_accounting_transactions.transdate BETWEEN :datefrom AND :dateto
                        AND tbl_accounting_transactions.busunitcode = :busunitcode
                        AND tbl_accounting_transactions.approvalstatus = 'Posted'
                        AND tbl_accounting_transactions.glcode = :glcode
                GROUP BY tbl_accounting_transactions.slcode
                ORDER BY tbl_accounting_transactions.slcode ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitCode, PDO::PARAM_STR);

        $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateTo, PDO::PARAM_STR);

        $stmt->bindValue(":glcode", $glCode, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

}
