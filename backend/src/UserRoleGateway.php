<?php

class UserRoleGateway
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
                    $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

                    $shortUuid = $randomString;

                    $shortUuid = "RL-" . $shortUuid;
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
                            VALUES (:shortUuid, :user_id, :roleclass, :rolename, :role_description,
                            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);

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
                    $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

                    $shortUuid = $randomString;

                    $shortUuid = "RL-" . $shortUuid;
                    if ($rowCount === 0) {
                        $sql = "INSERT INTO tbl_user_roles ()
                            VALUES (:shortUuid, :user_id, :roleclass, :rolename, :role_description,
                            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                        $stmt = $this->conn->prepare($sql);

                        $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);

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
                    $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

                    $shortUuid = $randomString;

                    $shortUuid = "RL-" . $shortUuid;
                    // Get Busunit Name

                    $sql = "SELECT name FROM lkp_busunits
                        WHERE deletestatus = 'Active'
                        AND busunitcode = :busunit";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":busunit", $busunit, PDO::PARAM_STR);

                    $stmt->execute();

                    $busunitName = $stmt->fetch(PDO::FETCH_ASSOC);

                    $sql = "INSERT INTO tbl_user_roles ()
                            VALUES (:shortUuid, :user_id, :roleclass, :rolename, :role_description,
                            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);
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
                    $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

                    $shortUuid = $randomString;

                    $shortUuid = "RL-" . $shortUuid;
                    // Get Busunit Name

                    $sql = "SELECT teamname FROM tbl_teams
                        WHERE deletestatus = 'Active'
                        AND teamid = :teamcode";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":teamcode", $team, PDO::PARAM_STR);

                    $stmt->execute();

                    $teamName = $stmt->fetch(PDO::FETCH_ASSOC);

                    $sql = "INSERT INTO tbl_user_roles ()
                            VALUES (:shortUuid, :user_id, :roleclass, :rolename, :role_description,
                            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                    $stmt = $this->conn->prepare($sql);

                    $stmt->bindValue(":shortUuid", $shortUuid, PDO::PARAM_STR);

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

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT  tbl_user_roles.uuid, tbl_user_roles.userid, CONCAT(tbl_employees.firstname, ' ', tbl_employees.lastname) AS username,
            tbl_user_roles.roleclass, tbl_user_roles.rolename,
            tbl_user_roles.role_description
            FROM tbl_user_roles
            LEFT OUTER JOIN tbl_employees ON tbl_user_roles.userid = tbl_employees.empid
            WHERE tbl_user_roles.deletestatus = 'Active'
            AND CONCAT(tbl_employees.firstname, ' ', tbl_employees.lastname) LIKE :search
            ORDER BY  CONCAT(tbl_employees.firstname, ' ', tbl_employees.lastname) ASC, roleclass ASC, role_description ASC
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
