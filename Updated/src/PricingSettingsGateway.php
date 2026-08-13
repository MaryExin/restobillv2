<?php

class PricingSettingsGateway
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

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_pricing_settings";

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
            (default, :datefrom, :dateto, :empid, :basic, :overtime,
            :paidleaves, :cola, :grosspay, :sss_ee, :phic_ee, :mdf_ee,
            :whtx, :net_pay, :sss_loan, :mdf_loan, :coop_loan, :housing_loan,
            :employee_advances, :others1, :others2, :others3, :net_cash,
            :sss_er, :ec_er, :phic_er, :mdf_er, :13th_mo, :busunitcode,
            :token, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);
            $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);
            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
            $stmt->bindValue(":basic", $data["basic"], PDO::PARAM_STR);
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
            $stmt->bindValue(":housing_loan", $data["housing_loan"], PDO::PARAM_STR);
            $stmt->bindValue(":employee_advances", $data["employee_advances"], PDO::PARAM_STR);
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

                tbl_user_roles.roleclass, tbl_user_roles.role_description , lkp_busunits.name

                FROM tbl_user_roles

                LEFT OUTER JOIN lkp_busunits ON  tbl_user_roles.rolename = lkp_busunits.busunitcode

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

}
