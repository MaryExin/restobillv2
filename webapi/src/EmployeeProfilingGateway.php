<?php

class EmployeeProfilingGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function createForUser($user_id, $data)
    {

        try {

            $this->conn->beginTransaction();

            //Post Routes

            foreach ($data["functionandroutes"] as $routeorfunction) {

                $checkRoute = substr($routeorfunction, 0, 1);

                if ($checkRoute === "/") {

                    // Check if exists routes role

                    $sql = "SELECT rolename FROM tbl_user_roles WHERE deletestatus = 'Active'

                        AND rolename = :routename

                        AND userid = :empid";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

                    $stmt->bindValue(":routename", $routeorfunction, PDO::PARAM_STR);

                    $stmt->execute();

                    $rowCount = $stmt->rowCount();

                    // Post Roles

                    if ($rowCount === 0) {

                        $sql = "INSERT INTO tbl_user_roles ()

                            VALUES (CONCAT('RL-',shortUUID()), :user_id, :roleclass, :rolename, :role_description,

                            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                        $stmt = $this->conn->prepare($sql);

                        $stmt->bindValue(":user_id", $data["empid"], PDO::PARAM_STR);

                        $stmt->bindValue(":roleclass", "Route", PDO::PARAM_STR);

                        $stmt->bindValue(":rolename", $routeorfunction, PDO::PARAM_STR);

                        $stmt->bindValue(":role_description", $routeorfunction, PDO::PARAM_STR);

                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                        $stmt->execute();

                    }

                } else {

                    // Check if exists function role

                    $sql = "SELECT rolename FROM tbl_user_roles WHERE deletestatus = 'Active'

                        AND rolename = :rolename

                        AND userid = :empid";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

                    $stmt->bindValue(":rolename", $routeorfunction, PDO::PARAM_STR);

                    $stmt->execute();

                    $rowCount = $stmt->rowCount();

                    // Post Roles

                    if ($rowCount === 0) {

                        $sql = "INSERT INTO tbl_user_roles ()

                            VALUES (CONCAT('RL-',shortUUID()), :user_id, :roleclass, :rolename, :role_description,

                            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                        $stmt = $this->conn->prepare($sql);

                        $stmt->bindValue(":user_id", $data["empid"], PDO::PARAM_STR);

                        $stmt->bindValue(":roleclass", "Function", PDO::PARAM_STR);

                        $stmt->bindValue(":rolename", $routeorfunction, PDO::PARAM_STR);

                        $stmt->bindValue(":role_description", $routeorfunction, PDO::PARAM_STR);

                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                        $stmt->execute();

                    }

                }

            }

            foreach ($data["busunit"] as $busunit) {

                // Check if exists busunit role

                $sql = "SELECT rolename FROM tbl_user_roles WHERE deletestatus = 'Active'

                        AND rolename = :routename

                        AND userid = :empid";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

                $stmt->bindValue(":routename", $busunit, PDO::PARAM_STR);

                $stmt->execute();

                $rowCount = $stmt->rowCount();

                // Post Roles

                if ($rowCount === 0) {

                    // Get Busunit Name

                    $sql = "SELECT name FROM lkp_busunits

                        WHERE deletestatus = 'Active'

                        AND busunitcode = :busunit";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":busunit", $busunit, PDO::PARAM_STR);

                    $stmt->execute();

                    $busunitName = $stmt->fetch(PDO::FETCH_ASSOC);

                    $sql = "INSERT INTO tbl_user_roles ()

                            VALUES (CONCAT('RL-',shortUUID()), :user_id, :roleclass, :rolename, :role_description,

                            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":user_id", $data["empid"], PDO::PARAM_STR);

                    $stmt->bindValue(":roleclass", "Business Unit", PDO::PARAM_STR);

                    $stmt->bindValue(":rolename", $busunit, PDO::PARAM_STR);

                    $stmt->bindValue(":role_description", $busunitName["name"], PDO::PARAM_STR);

                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $stmt->execute();

                }

            }

            foreach ($data["teams"] as $team) {

                // Check if exists busunit role

                $sql = "SELECT rolename FROM tbl_user_roles WHERE deletestatus = 'Active'

                        AND rolename = :routename

                        AND userid = :empid";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

                $stmt->bindValue(":routename", $team, PDO::PARAM_STR);

                $stmt->execute();

                $rowCount = $stmt->rowCount();

                // Post Roles

                if ($rowCount === 0) {

                    // Get Busunit Name

                    $sql = "SELECT teamname FROM tbl_teams

                        WHERE deletestatus = 'Active'

                        AND teamid = :teamcode";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":teamcode", $team, PDO::PARAM_STR);

                    $stmt->execute();

                    $teamName = $stmt->fetch(PDO::FETCH_ASSOC);

                    $sql = "INSERT INTO tbl_user_roles ()

                            VALUES (CONCAT('RL-',shortUUID()), :user_id, :roleclass, :rolename, :role_description,

                            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":user_id", $data["empid"], PDO::PARAM_STR);

                    $stmt->bindValue(":roleclass", "Team", PDO::PARAM_STR);

                    $stmt->bindValue(":rolename", $team, PDO::PARAM_STR);

                    $stmt->bindValue(":role_description", $teamName["teamname"], PDO::PARAM_STR);

                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                    $stmt->execute();

                }

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (Exception $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => $e->getMessage()]);

            exit;

        }

    }

    public function deleteForUser($user_id, $data)
    {

        try {

            $this->conn->beginTransaction();

            $sql = "DELETE from tbl_user_roles WHERE uuid = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (Exception $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => $e->getMessage()]);

            exit;

        }

    }

    public function getSchedForEmployee($data)
    {

        $sql = "SELECT * FROM tbl_employee_schedule
                WHERE empid = :empid
                AND busunitcode LIKE :busunitcode
                AND transdate BETWEEN :datefrom AND :dateto";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", '%' . $data["busunitcode"] . '%', PDO::PARAM_STR);
        $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);
        $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getActualLogsForEmployee($data)
    {

        $sql = "SELECT * FROM tbl_timelogs
                WHERE userid = :empid
                AND busunit_code LIKE :busunitcode
                AND `date` BETWEEN :datefrom AND :dateto";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", '%' . $data["busunitcode"] . '%', PDO::PARAM_STR);
        $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);
        $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getPayslipForEmployee($data)
    {

        $sql = "SELECT * FROM tbl_payroll_master
                WHERE empid = :empid
                AND busunitcode = :busunitcode
                AND datefrom = :datefrom
                AND dateto = :dateto";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
        $stmt->bindValue(":datefrom", $data["datefrom"], PDO::PARAM_STR);
        $stmt->bindValue(":dateto", $data["dateto"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getByUsername($username)
    {

        try {

            $sql = "SELECT *



                FROM tbl_users_global_assignment



                WHERE email = :username";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":username", $username, PDO::PARAM_STR);

            $stmt->execute();

            return $stmt->fetch(PDO::FETCH_ASSOC);

        } catch (Exception $e) {

            echo json_encode(["message" => "invalidCredentials"]);

            exit;

        }

    }

    public function deletedataWithIds($ids)
    {

        foreach ($ids as $id) {

            $sql = "UPDATE tbl_user_roles SET

                deletestatus = 'Inactive'

                WHERE uuid = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_STR);

            $stmt->execute();

        }

        return $stmt->rowCount();

    }

    public function getByID($id)
    {

        try {

            $sql = "SELECT *



                FROM tbl_users_global_assignment



                WHERE uuid = :id";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":id", $id, PDO::PARAM_INT);

            $stmt->execute();

            return $stmt->fetch(PDO::FETCH_ASSOC);

        } catch (Exception $e) {

            echo json_encode(["message" => "invalidCredentials"]);

            exit;

        }

    }

}
