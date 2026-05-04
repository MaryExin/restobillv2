<?php

class GovtDeductionsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function ExcelGetSSS($busunitCode, $dateFrom, $dateTo)
    {

        $sql = "SELECT
                    tbl_payroll_master.empid,
                    CONCAT(tbl_employees.lastname,
                            ', ', tbl_employees.firstname, ' ',
                            tbl_employees.middlename) AS name,
                    tbl_employees.sss,
                  sum(tbl_payroll_master.gross_pay) AS gross_pay,
                sum(tbl_payroll_master.sss_employee) AS sss_employee,
                sum(tbl_payroll_master.sss_employer) AS sss_employer,
                sum(tbl_payroll_master.ec_employer) AS ec_employer
                FROM
                    tbl_payroll_master
                        LEFT OUTER JOIN
                    tbl_employees ON tbl_payroll_master.empid = tbl_employees.empid
                WHERE tbl_payroll_master.busunitcode = :busunitcode
                AND tbl_payroll_master.datefrom BETWEEN :datefrom AND :dateto
                GROUP BY tbl_payroll_master.empid
                ORDER BY name ASC";

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

    public function ExcelGetPhilhealth($busunitCode, $dateFrom, $dateTo)
    {

        $sql = "SELECT
                    tbl_payroll_master.empid,
                    CONCAT(tbl_employees.lastname,
                            ', ', tbl_employees.firstname, ' ',
                            tbl_employees.middlename) AS name,
                    tbl_employees.phic,
                  sum(tbl_payroll_master.gross_pay) AS gross_pay,
                sum(tbl_payroll_master.phic_employee) AS phic_employee,
                sum(tbl_payroll_master.phic_employer) AS phic_employer
                FROM
                    tbl_payroll_master
                        LEFT OUTER JOIN
                    tbl_employees ON tbl_payroll_master.empid = tbl_employees.empid
                WHERE tbl_payroll_master.busunitcode = :busunitcode
                AND tbl_payroll_master.datefrom BETWEEN :datefrom AND :dateto
                GROUP BY tbl_payroll_master.empid
                ORDER BY name ASC";

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

    public function ExcelGetMdf($busunitCode, $dateFrom, $dateTo)
    {

        $sql = "SELECT
                    tbl_payroll_master.empid,
                    CONCAT(tbl_employees.lastname,
                            ', ', tbl_employees.firstname, ' ',
                            tbl_employees.middlename) AS name,
                    tbl_employees.mdf,
                  sum(tbl_payroll_master.gross_pay) AS gross_pay,
                sum(tbl_payroll_master.mdf_employee) AS mdf_employee,
                sum(tbl_payroll_master.mdf_employer) AS mdf_employer
                FROM
                    tbl_payroll_master
                        LEFT OUTER JOIN
                    tbl_employees ON tbl_payroll_master.empid = tbl_employees.empid
                WHERE tbl_payroll_master.busunitcode = :busunitcode
                AND tbl_payroll_master.datefrom BETWEEN :datefrom AND :dateto
                GROUP BY tbl_payroll_master.empid
                ORDER BY name ASC";

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

}
