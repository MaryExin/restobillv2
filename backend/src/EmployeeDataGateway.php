<?php

class EmployeeDataGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        // $sql = "SELECT * FROM tbl_employees ORDER BY seq DESC LIMIT $pageIndex, $pageData";
        $sql = "SELECT * FROM tbl_employees ORDER BY seq DESC ";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getAllData()
    {

        $sql = "SELECT



                tbl_employees.empid, CONCAT(tbl_employees.firstname,' ', tbl_employees.middlename,' ', tbl_employees.lastname) AS fullname,



                tbl_employees.department, tbl_employees.busunit_code, tbl_main_business_units.Unit_Name as name



                FROM



                tbl_employees



					LEFT OUTER JOIN tbl_main_business_units ON tbl_employees.busunit_code = tbl_main_business_units.Unit_Code



                WHERE tbl_employees.deletestatus = 'Active'



                UNION



                SELECT



                tbl_customer_details.customer_id, tbl_customer_details.customername, tbl_customer_details.branchname, 'NA', 'NA'



                FROM



                tbl_customer_details



                WHERE tbl_customer_details.deletestatus = 'Active'



                ORDER BY 2 ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getAllDataperbuild()
    {

        $sql = "SELECT



                tbl_employees.empid, CONCAT(tbl_employees.firstname,' ', tbl_employees.middlename,' ', tbl_employees.lastname) AS fullname,



                tbl_employees.busunit_code



                FROM



                tbl_employees



                WHERE tbl_employees.deletestatus = 'Active'



                UNION



                SELECT



                tbl_customer_details.customer_id, tbl_customer_details.customername, tbl_customer_details.branchname



                FROM



                tbl_customer_details



                WHERE tbl_customer_details.deletestatus = 'Active'



                ORDER BY 2 ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getAllDatas()
    {

        $sql = "SELECT



                tbl_employees.empid, CONCAT(tbl_employees.firstname,' ', tbl_employees.middlename,' ', tbl_employees.lastname) AS fullname,



                tbl_employees.busunit_code



                FROM



                tbl_employees



                WHERE tbl_employees.deletestatus = 'Active'



                UNION



                SELECT



                tbl_customer_details.customer_id, tbl_customer_details.customername, tbl_customer_details.branchname



                FROM



                tbl_customer_details



                WHERE tbl_customer_details.deletestatus = 'Active'



                ORDER BY 2 ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetMonthlies($busunitcode)
    {

        $sql = "SELECT * FROM tbl_employees















        WHERE deletestatus = 'Active'















        AND salary_type = 'MOS'















        AND busunit_code = :busunitcode";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetDailies($busunitcode)
    {

        $sql = "SELECT * FROM tbl_employees















        WHERE deletestatus = 'Active'















        AND salary_type = 'DAS'















        AND busunit_code = :busunitcode";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetAllEmployees($busunitcode)
    {

        $sql = "SELECT * FROM tbl_employees















        WHERE deletestatus = 'Active'















        AND busunit_code = :busunitcode";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetAllowancesAndDeductions($busunitcode, $dateuntil)
    {

        $sql = "SELECT * FROM tbl_deduction_and_allowances







        WHERE busunitcode = :busunitcode







        AND dateuntil >= :dateuntil";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

        $stmt->bindValue(":dateuntil", $dateuntil, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetActualTimeLogs($busunitcode, $datefrom, $dateto)
    {

        $sql = "SELECT * FROM tbl_timelogs















        WHERE deletestatus = 'Active'















        AND busunit_code = :busunitcode















        AND `date` BETWEEN :datefrom AND :dateto















        ORDER BY userid ASC, `date` ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

        $stmt->bindValue(":datefrom", $datefrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateto, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetSchedules($busunitcode, $datefrom, $dateto)
    {

        $sql = "SELECT * FROM tbl_employee_schedule







                    WHERE busunitcode = :busunitcode







                    AND transdate BETWEEN :datefrom AND :dateto







                    ORDER BY empid ASC, transdate ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

        $stmt->bindValue(":datefrom", $datefrom, PDO::PARAM_STR);

        $stmt->bindValue(":dateto", $dateto, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelGetPayrollConso($busunitcode, $yearParams, $monthParams)
    {

        $sql = "SELECT

                    *

                FROM

                    tbl_payroll_master

                WHERE

                    busunitcode = :busunitcode

                        AND YEAR(datefrom) = :yearParams

                        AND MONTH(datefrom) = :monthParams

                ORDER BY empid ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

        $stmt->bindValue(":yearParams", $yearParams, PDO::PARAM_STR);

        $stmt->bindValue(":monthParams", $monthParams, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function ExcelPostEmployeeScheds($data)
    {

        try {

            $this->conn->beginTransaction();

            // Delete previous data

            $sql = "SELECT * FROM tbl_employee_schedule







                WHERE empid = :empid







                AND transdate = :transdate";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

            $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);

            $stmt->execute();

            $checkData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $checkData[] = $row;

            }

            $countCheck = $stmt->rowCount();

            if ($countCheck > 0) {

                foreach ($checkData as $id) {

                    $sql = "DELETE FROM tbl_employee_schedule







                        WHERE seq = :id";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":id", $id["seq"], PDO::PARAM_STR);

                    $stmt->execute();

                    $this->conn->commit();

                }

            }

            // Insert new data

            $sql = "INSERT INTO tbl_employee_schedule () VALUES







            (default, :empid, :busunitcode, :transdate, :schedin, :schedout,







            :breaktime, :daytype, :token, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["busunit"], PDO::PARAM_STR);

            $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);

            $stmt->bindValue(":schedin", $data["schedin"], PDO::PARAM_STR);

            $stmt->bindValue(":schedout", $data["schedout"], PDO::PARAM_STR);

            $stmt->bindValue(":breaktime", $data["breaktime"], PDO::PARAM_STR);

            $stmt->bindValue(":daytype", $data["daytype"], PDO::PARAM_STR);

            $stmt->bindValue(":token", $data["exceltoken"], PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            // Rollback the transaction if something went wrong

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function ExcelPostEmployeeActualLogs($data)
    {

        try {

            $this->conn->beginTransaction();

            // Delete previous data

            $sql = "SELECT * FROM tbl_timelogs
                WHERE userid = :empid
                AND `date` = :transdate
                AND busunit_code = :busunitcode
                AND deletestatus = 'Active'";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

            $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["busunit"], PDO::PARAM_STR);

            $stmt->execute();

            $checkData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $checkData[] = $row;

            }

            $countCheck = $stmt->rowCount();

            if ($countCheck > 0) {

                foreach ($checkData as $id) {

                    $sql = "DELETE FROM tbl_timelogs
                        WHERE seq = :id";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":id", $id["seq"], PDO::PARAM_STR);

                    $stmt->execute();

                    $this->conn->commit();

                }

            }

            // Insert new data

            $sql = "INSERT INTO tbl_timelogs () VALUES
            (default, CONCAT('TL-',shortUUID()), :empid, :transdate, :actualin, :actualout,
            :busunitcode, 'Upload', 'Active', :token, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

            $stmt->bindValue(":transdate", $data["transdate"], PDO::PARAM_STR);

            $stmt->bindValue(":actualin", $data["actualin"], PDO::PARAM_STR);

            $stmt->bindValue(":actualout", $data["actualout"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["busunit"], PDO::PARAM_STR);

            $stmt->bindValue(":token", $data["exceltoken"], PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            // Rollback the transaction if something went wrong

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function ExcelPostPayslips($data)
    {

        try {

            $this->conn->beginTransaction();

            // Check if Ok for Posting

            $sql = "SELECT * FROM tbl_payroll_postings_history







                WHERE busunitcode = :busunitcode







                AND datefrom = :datefrom







                AND dateto = :dateto";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

            $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);

            $stmt->execute();

            $checkData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $checkData[] = $row;

            }

            $countCheck = $stmt->rowCount();

            if ($countCheck > 0) {

                echo json_encode(["message" => "Payroll already posted"]);

                exit;

            }

            // Post Payroll Master

            // Insert new data

            $sql = "INSERT INTO tbl_payroll_master () VALUES







            (default, :datefrom, :dateto, :empid, :basic, :tardiness , :nightdiff, :overtime,







            :paidleaves, :cola, :grosspay, :sss_ee, :phic_ee, :mdf_ee,







            :whtx, :net_pay, :sss_loan, :mdf_loan, :coop_loan, :advances,







            :otherdeductions, :others1, :others2, :others3, :net_cash,







            :sss_er, :ec_er, :phic_er, :mdf_er, :13th_mo, :busunitcode,







            :token, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

            $stmt->bindValue(":basic", $data["basic"], PDO::PARAM_STR);

            $stmt->bindValue(":tardiness", $data["tardiness"], PDO::PARAM_STR);

            $stmt->bindValue(":nightdiff", $data["nightdiff"], PDO::PARAM_STR);

            $stmt->bindValue(":overtime", $data["overtime"], PDO::PARAM_STR);

            $stmt->bindValue(":paidleaves", $data["paidleaves"], PDO::PARAM_STR);

            $stmt->bindValue(":cola", $data["cola"], PDO::PARAM_STR);

            $stmt->bindValue(":grosspay", $data["grosspay"], PDO::PARAM_STR);

            $stmt->bindValue(":sss_ee", $data["sss_ee"], PDO::PARAM_STR);

            $stmt->bindValue(":phic_ee", $data["phic_ee"], PDO::PARAM_STR);

            $stmt->bindValue(":mdf_ee", $data["mdf_ee"], PDO::PARAM_STR);

            $stmt->bindValue(":whtx", $data["whtx"], PDO::PARAM_STR);

            $stmt->bindValue(":net_pay", $data["net_pay"], PDO::PARAM_STR);

            $stmt->bindValue(":sss_loan", $data["sss_loan"], PDO::PARAM_STR);

            $stmt->bindValue(":mdf_loan", $data["mdf_loan"], PDO::PARAM_STR);

            $stmt->bindValue(":coop_loan", $data["coop_loan"], PDO::PARAM_STR);

            $stmt->bindValue(":advances", $data["advances"], PDO::PARAM_STR);

            $stmt->bindValue(":otherdeductions", $data["otherdeductions"], PDO::PARAM_STR);

            $stmt->bindValue(":others1", $data["others1"], PDO::PARAM_STR);

            $stmt->bindValue(":others2", $data["others2"], PDO::PARAM_STR);

            $stmt->bindValue(":others3", $data["others3"], PDO::PARAM_STR);

            $stmt->bindValue(":net_cash", $data["net_cash"], PDO::PARAM_STR);

            $stmt->bindValue(":sss_er", $data["sss_er"], PDO::PARAM_STR);

            $stmt->bindValue(":ec_er", $data["ec_er"], PDO::PARAM_STR);

            $stmt->bindValue(":phic_er", $data["phic_er"], PDO::PARAM_STR);

            $stmt->bindValue(":mdf_er", $data["mdf_er"], PDO::PARAM_STR);

            $stmt->bindValue(":13th_mo", $data["13th_mo"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

            $stmt->bindValue(":token", $data["token"], PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            // Rollback the transaction if something went wrong

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function ExcelPostPayslipsHistory($data)
    {

        try {

            $this->conn->beginTransaction();

            // Check if Ok for Posting

            $sql = "SELECT * FROM tbl_payroll_postings_history







                WHERE busunitcode = :busunitcode







                AND datefrom = :datefrom







                AND dateto = :dateto";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

            $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);

            $stmt->execute();

            $checkData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $checkData[] = $row;

            }

            $countCheck = $stmt->rowCount();

            if ($countCheck > 0) {

                echo json_encode(["message" => "Payroll already posted"]);

                exit;

            }

            // Insert into tbl_payroll_history

            $sql = "INSERT INTO tbl_payroll_postings_history () VALUES







            (default, :datefrom, :dateto, :busunitcode,







            :token, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

            $stmt->bindValue(":token", $data["token"], PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            // Rollback the transaction if something went wrong

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function ExcelPostEntries($data)
    {

        try {

            //Post to Delivery Assignment

            $this->conn->beginTransaction();

            $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

            $shortUuid = $randomString;

            $shortUuid = "DB-" . $shortUuid;

            // Insert into Table Disbursements

            $sql = "INSERT INTO tbl_disbursements () VALUES (default, :reference, :transactiondate,
                :invoicedate,:slCode, :slDescription, :amount, :particulars, :payee_code, :busunitcode,
                 :payment_status, :document_ref,'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["exceldata"] as $payrollentry) {

                $stmt->bindValue(":reference", $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":transactiondate", $payrollentry["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":invoicedate", $payrollentry["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":slCode", $payrollentry["glsl"], PDO::PARAM_STR);

                $stmt->bindValue(":slDescription", $payrollentry["glsldescription"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", ROUND(abs($payrollentry["amount"]), 2), PDO::PARAM_STR);

                $stmt->bindValue(":particulars", $payrollentry["particulars"], PDO::PARAM_STR);

                $stmt->bindValue(":payee_code", $payrollentry["busunitcode"], PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $payrollentry["busunitcode"], PDO::PARAM_STR);

                $stmt->bindValue(":payment_status", "Unpaid", PDO::PARAM_STR);

                $stmt->bindValue(":document_ref", $payrollentry["busunitcode"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $payrollentry["token"], PDO::PARAM_STR);

                $stmt->execute();

            }

            // Insert into Table Accounting Entries

            $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, :transactiondate,
               :invoicedate , :glcode, :slcode, :amount, :particulars, :reference, 'PayrollAdmin', 'Posted',
                null, :payee_code, null, null, null, null, 'Payroll', 'PAYROLL', '/excelpayroll', :busunitcode,
                :vat_tax_type, :whtx_atc, :whtx_rate, :disbursementid,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["exceldata"] as $payrollentry) {

                $stmt->bindValue(":transactiondate", $payrollentry["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":invoicedate", $payrollentry["transdate"], PDO::PARAM_STR);

                $stmt->bindValue(":glcode", substr($payrollentry["glsl"], 0, 3), PDO::PARAM_STR);

                $stmt->bindValue(":slcode", $payrollentry["glsl"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", ROUND($payrollentry["amount"], 2), PDO::PARAM_STR);

                $stmt->bindValue(":particulars", $payrollentry["particulars"], PDO::PARAM_STR);

                $stmt->bindValue(":reference", $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":payee_code", $payrollentry["busunitcode"], PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $payrollentry["busunitcode"], PDO::PARAM_STR);

                $stmt->bindValue(":vat_tax_type", "NA", PDO::PARAM_STR);

                $stmt->bindValue(":whtx_atc", "NA", PDO::PARAM_STR);

                $stmt->bindValue(":whtx_rate", 0, PDO::PARAM_STR);

                $stmt->bindValue(":disbursementid", $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $payrollentry["token"], PDO::PARAM_STR);

                $stmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function ExcelPostDeductionsAndAllowances($data)
    {

        try {

            $this->conn->beginTransaction();

            // Check if Ok for Posting

            $sql = "SELECT * FROM tbl_deduction_and_allowances







                WHERE empid = :empid







                AND type = :type







                AND description = :description







                AND busunitcode = :busunitcode";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

            $stmt->bindValue(":type", $data["type"], PDO::PARAM_STR);

            $stmt->bindValue(":description", $data["description"], PDO::PARAM_STR);

            $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

            $stmt->execute();

            $countCheck = $stmt->rowCount();

            $checkData = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $checkData[] = $row;

            }

            if (!$countCheck > 0) {

                // Post To Deductions and Allowances

                $sql = "INSERT INTO tbl_deduction_and_allowances () VALUES







            (default, :empid, :type, :description, :amount, :dateuntil, :busunitcode,







            :token, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

                $stmt->bindValue(":type", $data["type"], PDO::PARAM_STR);

                $stmt->bindValue(":description", $data["description"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", $data["amount"], PDO::PARAM_STR);

                $stmt->bindValue(":dateuntil", $data["dateuntil"], PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                $stmt->bindValue(":token", $data["token"], PDO::PARAM_STR);

                $stmt->execute();

            } else {

                $sql = "UPDATE tbl_deduction_and_allowances SET







                empid = :empid, type = :type, description = :description, amount = :amount,







                dateuntil = :dateuntil , token = :token, datetime = DATE_ADD(NOW(), INTERVAL 8 HOUR),







                busunitcode = :busunitcode







                WHERE seq = :seq";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

                $stmt->bindValue(":type", $data["type"], PDO::PARAM_STR);

                $stmt->bindValue(":description", $data["description"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", $data["amount"], PDO::PARAM_STR);

                $stmt->bindValue(":dateuntil", $data["dateuntil"], PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                $stmt->bindValue(":token", $data["token"], PDO::PARAM_STR);

                $stmt->bindValue(":seq", $checkData[0]["seq"], PDO::PARAM_STR);

                $stmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            // Rollback the transaction if something went wrong

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function getEmployeeDetails($data)
    {

        $sql = "SELECT *  FROM tbl_employees WHERE deletestatus = 'Active'















            AND empid = :empid ;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

        $stmt->execute();

        $empData = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $empData[] = $row;

        }

        $sql = "SELECT tbl_user_roles.uuid, tbl_user_roles.userid, tbl_user_roles.rolename,















                tbl_user_roles.roleclass, tbl_user_roles.role_description , tbl_main_business_units.Unit_Name as name















                FROM tbl_user_roles















                LEFT OUTER JOIN tbl_main_business_units ON  tbl_user_roles.rolename = tbl_main_business_units.Unit_Code




                WHERE tbl_user_roles.deletestatus = 'Active'















                AND tbl_user_roles.userid = :empid ;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

        $stmt->execute();

        $roleData = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $roleData[] = $row;

        }

        return ["empdata" => $empData, "roledata" => $roleData];

    }

    public function getEmployeeDetailsForId($data)
    {

        $sql = "SELECT *  FROM tbl_employees WHERE deletestatus = 'Active'



            AND CONCAT(firstname,' ',lastname) LIKE :name ;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":name", '%' . $data["name"] . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getEmployeeAll($data)
    {

        $sql = "SELECT MAX(payroll_empid) as payroll_empid  FROM tbl_employees";

        $stmt = $this->conn->prepare($sql);

        // $stmt->bindValue(":name", '%' . $data["name"] . '%', PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

}
