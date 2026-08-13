<?php

class PayrollGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

     public function getPayroll() 
    {
        try {
            // Query to fetch the journal voucher items
            $sql = "SELECT T2.name AS BusinessUnit , T1.datefrom, T1.dateto FROM tbl_payroll_postings_history AS T1
            JOIN lkp_busunits AS T2
            ON T1.busunitcode = T2.busunitcode";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            $payrollData = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $payrollData[] = $row;
            }


            return [
                'items' => $payrollData,
            
               

            ];

        } catch (PDOException $e) {
            // Handle SQL or database connection errors
            return [
                'error' => $e->getMessage()
            ];
        }
    }

    public function getClearingItems($busunitcode) 
    {
        try {


            // Query to fetch the journal voucher items
            $sql = "
            SELECT concat(firstname, ' ', middlename, ' ', lastname) as full_name,
            sss, phic mdf, salary, basic, tardiness, overtime, gross_pay, sss_employee,
            phic_employee, mdf_employee, whtx, net_pay, advances, T2.datefrom, T2.dateto
            FROM tbl_employees AS T1
            JOIN tbl_payroll_master AS T2
            ON T1.empid = T2.empid
            JOIN lkp_busunits AS T3
            ON T1.busunit_code = T3.busunitcode
            JOIN tbl_payroll_postings_history AS T4
            ON T1.busunit_code = T4.busunitcode
            WHERE T1.deletestatus = 'Active' 
            AND T2.busunitcode = :busunitcode
            ORDER BY 
            T2.seq DESC";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

            $stmt->execute();

            $payrollData = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $payrollData[] = $row;
            }


            return [
                'items' => $payrollData,
            ];

        } catch (PDOException $e) {
            // Handle SQL or database connection errors
            return [
                'error' => $e->getMessage()
            ];
        }
    }

    
}
