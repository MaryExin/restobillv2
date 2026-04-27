<?php



class CreditSalesGateway

{



    private $conn;



    public function __construct(Database $database)

    {



        $this->conn = $database->getConnection();



    }



    public function getAllData()

    {



        $sql = "SELECT * FROM lkp_mop  WHERE deletestatus = 'Active' ORDER BY description ASC";



        $stmt = $this->conn->prepare($sql);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }



    public function getSalesInvoice($data)

    {



        //Get Customer Details



        $sql = "SELECT tbl_mop_summary.payment_ref, tbl_customer_details.customername,

                    tbl_customer_details.tin, tbl_customer_details.address, tbl_customer_details.email,

                    tbl_customer_details.contact_no, tbl_customer_details.otherinfo

                    FROM

                    tbl_mop_summary

                        LEFT OUTER JOIN tbl_customer_details ON tbl_mop_summary.payment_ref = tbl_customer_details.customer_id

                    WHERE

                    tbl_mop_summary.deletestatus = 'Active'

                    AND sales_id = :salesid";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":salesid", $data["salesid"], PDO::PARAM_STR);



        $stmt->execute();



        $customerDetails = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $customerDetails[] = $row;



        }



        //Sales Breakdown



        $sql = "SELECT tbl_sales_transactions.transdate,

                IF(LEFT(tbl_sales_transactions.inv_code, 2) = 'RM',  lkp_raw_mats.desc,   lkp_build_of_products.desc) AS productname,

                tbl_sales_transactions.inv_code, tbl_sales_transactions.qty,

                tbl_sales_transactions.srp,   tbl_sales_transactions.total_sales, tbl_sales_transactions.vat,

                tbl_sales_transactions.tax_type, tbl_sales_transactions.discount_type_id, tbl_sales_transactions.discount_amount,

                tbl_sales_transactions.sales_id

                FROM

                tbl_sales_transactions

                    LEFT OUTER JOIN

                    lkp_raw_mats ON tbl_sales_transactions.inv_code = lkp_raw_mats.mat_code

                    LEFT OUTER JOIN

                    lkp_build_of_products ON tbl_sales_transactions.inv_code = lkp_build_of_products.build_code

                WHERE tbl_sales_transactions.deletestatus = 'Active'

                AND tbl_sales_transactions.sales_id = :salesid";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":salesid", $data["salesid"], PDO::PARAM_STR);



        $stmt->execute();



        $salesDetails = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $salesDetails[] = $row;



        }



        //InitialPayments



        $sql = "SELECT DISTINCT
                    tbl_mop_summary.transdate,
                    tbl_mop_summary.mop_id,
                    lkp_mop.description,
                    tbl_mop_summary.amount,
                    tbl_mop_summary.payment_ref,
                    tbl_mop_summary.sales_id,
                    tbl_mop_summary.payment_status
                FROM
                    tbl_mop_summary
                        LEFT OUTER JOIN
                    lkp_mop ON tbl_mop_summary.mop_id = lkp_mop.mop_id
                        LEFT JOIN
                    tbl_credit_sales_clearing ON tbl_credit_sales_clearing.clearing_reference = tbl_mop_summary.sales_id
                WHERE
                    tbl_mop_summary.deletestatus = 'Active'
                        AND tbl_mop_summary.sales_id = :salesid
                        AND tbl_mop_summary.mop_id <> 'MP-52d754926a3c'

                UNION

                SELECT 	subquery.transdate,'',payment_type,subquery.description ,'',subquery.payment_reference ,'Paid'

				FROM (SELECT transdate, payment_type,SUM(amount_cleared * -1) as description ,'',payment_reference

				FROM tbl_credit_sales_clearing

                WHERE clearing_reference = :salesid1 GROUP BY seq ORDER BY seq ASC) as subquery";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":salesid", $data["salesid"], PDO::PARAM_STR);



        $stmt->bindValue(":salesid1", $data["salesid"], PDO::PARAM_STR);



        $stmt->execute();



        $initialPayments = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $initialPayments[] = $row;



        }



        //Discounts



        $sql = "SELECT tbl_discounts.transdate, tbl_discounts.discount_type_id,

        lkp_discounts.description, tbl_discounts.amount,

        tbl_discounts.discount_ref_no, tbl_discounts.sales_id

        FROM

        tbl_discounts

            LEFT OUTER JOIN lkp_discounts  ON tbl_discounts.discount_type_id = lkp_discounts.discount_type_id

        WHERE tbl_discounts.deletestatus = 'Active'

        AND tbl_discounts.sales_id = :salesid";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":salesid", $data["salesid"], PDO::PARAM_STR);



        $stmt->execute();



        $discounts = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $discounts[] = $row;



        }



        return ["customerdetails" => $customerDetails,

            "salesdetails"            => $salesDetails,

            "initialpayments"         => $initialPayments,

            "discounts"               => $discounts];



    }



    public function getInfiniteData($page, $pageIndex, $pageData, $search)

    {



        $sql = "SELECT

                    union_credit_sales_clearing.transdate,

                    union_credit_sales_clearing.busunitcode,

                    union_credit_sales_clearing.amount AS principal,

                    ROUND(SUM(union_credit_sales_clearing.amount),2) AS net_total,

                    union_credit_sales_clearing.sales_id,

                    union_credit_sales_clearing.customername,

                    union_credit_sales_clearing.customer_id,

                    union_credit_sales_clearing.description,

                    DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), union_credit_sales_clearing.transdate) AS days_since_transdate,

                    union_credit_sales_clearing.createdtime,

                    union_credit_sales_clearing.sales_id
                    -- tbl_mop_summary.sales_id

                FROM

                    (SELECT

							tbl_mop_summary.transdate,

							tbl_sales_summary.busunitcode,

                            tbl_mop_summary.amount,

                            tbl_mop_summary.sales_id,

                            tbl_customer_details.customername,

                            tbl_customer_details.customer_id,

                            tbl_sales_summary.description,

                            tbl_mop_summary.createdtime

                    FROM

                        tbl_mop_summary

                    LEFT OUTER JOIN tbl_customer_details ON tbl_mop_summary.payment_ref = tbl_customer_details.customer_id

                    LEFT OUTER JOIN tbl_sales_summary ON tbl_mop_summary.sales_id = tbl_sales_summary.sales_id

                    WHERE

                        tbl_mop_summary.deletestatus = 'Active'

                            AND tbl_mop_summary.mop_id = 'MP-52d754926a3c' -- CREDIT

                    UNION SELECT

                        tbl_credit_sales_clearing.transdate,

                        tbl_sales_summary.busunitcode,

                            tbl_credit_sales_clearing.amount_cleared,

                            tbl_credit_sales_clearing.clearing_reference,

                            tbl_credit_sales_clearing.payment_type,

                            `customer_id`,

                            tbl_credit_sales_clearing.particulars,

                            tbl_credit_sales_clearing.createdtime

                    FROM

                        tbl_credit_sales_clearing

                         LEFT OUTER JOIN tbl_sales_summary ON tbl_credit_sales_clearing.clearing_reference = tbl_sales_summary.sales_id

                    WHERE

                        tbl_credit_sales_clearing.deletestatus = 'Active') union_credit_sales_clearing

                        -- LEFT OUTER JOIN tbl_mop_summary ON union_credit_sales_clearing.sales_id = tbl_mop_summary.sales_id

                        WHERE union_credit_sales_clearing.sales_id LIKE :search

                        GROUP BY union_credit_sales_clearing.sales_id

                        ORDER BY union_credit_sales_clearing.createdtime DESC

						LIMIT $pageIndex, $pageData";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        $response = [



            'items'    => $data,



            'nextPage' => $page + 1, // Provide the next page number



        ];



        return $response;



    }



    public function clearForUser($user_id, $data)

    {



        try {



            //Post to Clearing



            $this->conn->beginTransaction();



            $sql = "INSERT INTO tbl_credit_sales_clearing () VALUES (default, :salesreference,



                DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :amount, :payment_reference, :payment_type,



                 :payment_date, :slCode, :slDescription, :particulars, :atcs, :withHoldingTaxAmounts,



                 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";



            $stmt = $this->conn->prepare($sql);



            $stmt->bindValue(":salesreference", $data["salesReference"], PDO::PARAM_STR);



            $stmt->bindValue(":amount", ($data["amount"] + $data["withHoldingTaxAmount"]) * -1, PDO::PARAM_STR);



            $stmt->bindValue(":payment_reference", $data["payment_reference"], PDO::PARAM_STR);



            $stmt->bindValue(":payment_type", $data["payment_type"], PDO::PARAM_STR);



            $stmt->bindValue(":payment_date", $data["payment_date"], PDO::PARAM_STR);



            $stmt->bindValue(":slCode", $data["clearingCode"] !== "" ? $data["clearingCode"] : $data["slCode"], PDO::PARAM_STR);



            $stmt->bindValue(":slDescription", $data["clearingDescription"] !== "" ?  $data["clearingDescription"] : $data["slDescription"], PDO::PARAM_STR);



            $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);



            $stmt->bindValue(":atcs", $data["atc"], PDO::PARAM_STR);



            $stmt->bindValue(":withHoldingTaxAmounts", $data["withHoldingTaxAmount"], PDO::PARAM_STR);



            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);



            $stmt->execute();



            // Update Status



            $sql = "UPDATE tbl_mop_summary SET payment_status = :status,



            usertracker = :user_tracker



            WHERE



            sales_id = :reference



            AND mop_id = 'MP-52d754926a3c'";



            $stmt = $this->conn->prepare($sql);



            $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);



            $stmt->bindValue(":reference", $data["salesReference"], PDO::PARAM_STR);



            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);



            $stmt->execute();



            //Enter to accounting transaction



            //InitialPayments



            //Look for Customer SL Code if Exists



            $sql = "SELECT * FROM lkp_slcodes WHERE sldescription =  :customername";



            $stmt = $this->conn->prepare($sql);



            $stmt->bindValue(":customername", 'ACCOUNTS RECEIVABLE - ' . $data["customername"], PDO::PARAM_STR);



            $stmt->execute();



            $customerDetails = $stmt->fetch(PDO::FETCH_ASSOC);



            if ($stmt->rowCount() > 0) {



                //Debit Cash



                $sql = "INSERT INTO tbl_accounting_transactions ()

                VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

                    :checkdate, :glcode, :slcode,

                    :amount, :particulars, :reference, :approvalref,

                    :approvalstatus, :customer_id, null, null, null, null, null,

                    :transactionType, :transactionclass, '/salestracker', :busunitcode, :vattaxtype, :whtxatc, :whtxrate,

                    :menutransactedref, 'Active', :user_tracker, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)))";



                $stmt = $this->conn->prepare($sql);



                $glcode = substr($data["slCode"], 0, 3);



                $stmt->bindValue(":checkdate", $data["payment_date"], PDO::PARAM_STR);



                $stmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);



                $stmt->bindValue(":slcode", $data["slCode"], PDO::PARAM_STR);



                $stmt->bindValue(":amount", $data["amount"] + $data["withHoldingTaxAmount"], PDO::PARAM_STR);



                $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);



                $stmt->bindValue(":approvalstatus", 'Posted', PDO::PARAM_STR);



                $stmt->bindValue(":approvalref", 'Auto', PDO::PARAM_STR);



                $stmt->bindValue(":reference", $data["payment_reference"], PDO::PARAM_STR);



                $stmt->bindValue(":customer_id", $data["customerid"], PDO::PARAM_STR);



                $stmt->bindValue(":transactionType", 'Clearing', PDO::PARAM_STR);



                $stmt->bindValue(":transactionclass", 'CLEARING', PDO::PARAM_STR);



                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);



                $stmt->bindValue(":vattaxtype", 'N/A', PDO::PARAM_STR);



                $stmt->bindValue(":whtxatc", 'N/A', PDO::PARAM_STR);



                $stmt->bindValue(":whtxrate", 0, PDO::PARAM_STR);



                $stmt->bindValue(":menutransactedref", $data["salesReference"], PDO::PARAM_STR);



                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);



                $stmt->execute();



                //Credit AR



                $sql = "INSERT INTO tbl_accounting_transactions ()

                VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

                    :checkdate, :glcode, :slcode,

                    :amount, :particulars, :reference, :approvalref,

                    :approvalstatus, :customer_id, null, null, null, null, null,

                    :transactionType, :transactionclass, '/salestracker', :busunitcode, :vattaxtype, :whtxatc, :whtxrate,

                    :menutransactedref, 'Active', :user_tracker, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)))";



                $stmt = $this->conn->prepare($sql);



                $glcode = substr($customerDetails["slcodes"], 0, 3);



                $stmt->bindValue(":checkdate", $data["payment_date"], PDO::PARAM_STR);



                $stmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);



                $stmt->bindValue(":slcode", $customerDetails["slcodes"], PDO::PARAM_STR);



                $stmt->bindValue(":amount", $data["amount"] * -1, PDO::PARAM_STR);



                $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);



                $stmt->bindValue(":approvalstatus", 'Posted', PDO::PARAM_STR);



                $stmt->bindValue(":approvalref", 'Auto', PDO::PARAM_STR);



                $stmt->bindValue(":reference", $data["payment_reference"], PDO::PARAM_STR);



                $stmt->bindValue(":customer_id", $data["customerid"], PDO::PARAM_STR);



                $stmt->bindValue(":transactionType", 'Clearing', PDO::PARAM_STR);



                $stmt->bindValue(":transactionclass", 'CLEARING', PDO::PARAM_STR);



                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);



                $stmt->bindValue(":vattaxtype", 'N/A', PDO::PARAM_STR);



                $stmt->bindValue(":whtxatc", 'N/A', PDO::PARAM_STR);



                $stmt->bindValue(":whtxrate", 0, PDO::PARAM_STR);



                $stmt->bindValue(":menutransactedref", $data["salesReference"], PDO::PARAM_STR);



                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);



                $stmt->execute();



                //Whtx



                if ($data["withHoldingTaxAmount"] != 0) {



                    $sql = "INSERT INTO tbl_accounting_transactions ()

                VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

                    :checkdate, :glcode, :slcode,

                    :amount, :particulars, :reference, :approvalref,

                    :approvalstatus, :customer_id, null, null, null, null, null,

                    :transactionType, :transactionclass, '/salestracker', :busunitcode, :vattaxtype, :whtxatc, :whtxrate,

                    :menutransactedref, 'Active', :user_tracker, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)))";



                    $stmt = $this->conn->prepare($sql);



                    $stmt->bindValue(":glcode", "185", PDO::PARAM_STR);



                    $stmt->bindValue(":checkdate", $data["payment_date"], PDO::PARAM_STR);



                    $stmt->bindValue(":slcode", "185001", PDO::PARAM_STR);



                    $stmt->bindValue(":amount", $data["withHoldingTaxAmount"] * -1, PDO::PARAM_STR);



                    $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);



                    $stmt->bindValue(":approvalstatus", 'Posted', PDO::PARAM_STR);



                    $stmt->bindValue(":approvalref", 'Auto', PDO::PARAM_STR);



                    $stmt->bindValue(":reference", $data["payment_reference"], PDO::PARAM_STR);



                    $stmt->bindValue(":customer_id", $data["customerid"], PDO::PARAM_STR);



                    $stmt->bindValue(":transactionType", 'Clearing', PDO::PARAM_STR);



                    $stmt->bindValue(":transactionclass", 'CLEARING', PDO::PARAM_STR);



                    $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);



                    $stmt->bindValue(":vattaxtype", 'N/A', PDO::PARAM_STR);



                    $stmt->bindValue(":whtxatc", 'N/A', PDO::PARAM_STR);



                    $stmt->bindValue(":whtxrate", 0, PDO::PARAM_STR);



                    $stmt->bindValue(":menutransactedref", $data["salesReference"], PDO::PARAM_STR);



                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);



                    $stmt->execute();



                }



            } else {

                $this->conn->rollBack();

                echo json_encode(["message" => "No GLSL found for this customer"]);

                exit;

            }



            // Finalize



            $this->conn->commit();



            echo json_encode(["message" => "Success"]);



        } catch (PDOException $e) {



            $this->conn->rollBack();



            echo json_encode(["message" => "Error: " . $e->getMessage()]);



        }



    }



    public function getCreditByBusUnit($data)

    {



        $sql = "SELECT lkp_busunits.name, tbl_sales_summary.busunitcode, tbl_sales_summary.net_sales,



            tbl_mop_summary.seq, tbl_mop_summary.transdate, tbl_mop_summary.mop_trans_id,



            tbl_mop_summary.mop_id, lkp_mop.description, tbl_mop_summary.amount, tbl_mop_summary.payment_ref,



            tbl_mop_summary.sales_id, tbl_mop_summary.payment_status



            FROM tbl_mop_summary



            LEFT OUTER JOIN lkp_mop ON tbl_mop_summary.mop_id = lkp_mop.mop_id



            LEFT OUTER JOIN tbl_sales_summary ON tbl_mop_summary.mop_trans_id = tbl_sales_summary.mop_trans_id



            LEFT OUTER JOIN lkp_busunits ON tbl_sales_summary.busunitcode = lkp_busunits.busunitcode



            WHERE tbl_mop_summary.deletestatus = 'Active'



            AND tbl_mop_summary.payment_status = 'Unpaid'



            AND lkp_mop.description = 'CREDIT'



            AND tbl_sales_summary.busunitcode = :busunit



            ORDER BY tbl_mop_summary.payment_ref ASC";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":busunit", $data["busunit"], PDO::PARAM_STR);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }



    public function getPaidCreditSalesToday($user_id, $data)

    {



        $sql = "SELECT

                    tbl_credit_sales_clearing.clearing_reference,

                    tbl_credit_sales_clearing.transdate,

                    tbl_credit_sales_clearing.payment_reference,

                    tbl_credit_sales_clearing.payment_type,

                    tbl_credit_sales_clearing.payment_date,

                    tbl_credit_sales_clearing.sl_code,

                    tbl_credit_sales_clearing.sl_description,

                    tbl_credit_sales_clearing.particulars,

                    tbl_sales_summary.busunitcode,

                    tbl_sales_summary.poscode,

                    ROUND(tbl_credit_sales_clearing.amount_cleared * - 1,2) AS amount

                FROM

                    tbl_credit_sales_clearing

                        LEFT OUTER JOIN

                    tbl_sales_summary ON tbl_credit_sales_clearing.clearing_reference = tbl_sales_summary.sales_id

                WHERE

                    tbl_credit_sales_clearing.deletestatus = 'Active'

                        AND tbl_sales_summary.busunitcode = :busunitcode

                        AND tbl_credit_sales_clearing.usertracker = :user_tracker

                        AND DATE(tbl_credit_sales_clearing.createdtime) = DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR))";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":busunitcode", $data["busunit"], PDO::PARAM_STR);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }



    public function getbyPageData($pageIndex, $pageData)

    {



        $sql = "SELECT * FROM lkp_busunits ORDER BY seq LIMIT $pageIndex, $pageData";



        $stmt = $this->conn->prepare($sql);



        $stmt->execute();



        $data = [];



        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {



            $data[] = $row;



        }



        return $data;



    }



    public function getForUser($user_id): array

    {



        $sql = "SELECT *















        FROM tbl_cash_sales_summary_tracker















        WHERE usertracker = :user_id















        AND transdate = :transdate















        AND deletestatus = 'Active'";



        $stmt = $this->conn->prepare($sql);



        $stmt->bindValue(":user_id", $user_id, PDO::PARAM_STR);



        $stmt->bindValue(":transdate", date("Y-m-d"), PDO::PARAM_STR);



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

