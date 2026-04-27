<?php

class MemberProfileGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($empId)
    {

        $sql = "SELECT tbl_employees.address, tbl_employees.birthdate, tbl_employees.contact_no,
            tbl_employees.createdtime, tbl_employees.date_started, tbl_employees.deletestatus,
            tbl_employees.department, tbl_employees.email, tbl_employees.empid, tbl_employees.firstname,
            tbl_employees.image_filename, tbl_employees.lastname, tbl_employees.mdf, tbl_employees.middlename,
            tbl_employees.phic, tbl_employees.position, tbl_employees.seq, tbl_employees.sss, tbl_employees.status,
            tbl_employees.tin, tbl_employees.user_id, tbl_employees.usertracker,
            tbl_team_assignment.teamid, tbl_teams.teamname  FROM tbl_employees
            LEFT OUTER JOIN  tbl_team_assignment ON tbl_employees.empid = tbl_team_assignment.empid
            LEFT OUTER JOIN  tbl_teams ON tbl_team_assignment.teamid = tbl_teams.teamid
            WHERE tbl_employees.deletestatus = 'Active'
            AND tbl_employees.empid = :empId";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empId", $empId, PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT tbl_team_assignment.seq, tbl_team_assignment.empid, tbl_team_assignment.teamid,  tbl_employees.firstname,



                tbl_employees.lastname, tbl_teams.teamname



                FROM tbl_team_assignment



                LEFT OUTER JOIN tbl_employees ON tbl_team_assignment.empid = tbl_employees.empid



                LEFT OUTER JOIN tbl_teams ON tbl_team_assignment.teamid = tbl_teams.teamid



                ORDER BY tbl_team_assignment.seq DESC LIMIT $pageIndex, $pageData";

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

    public function createForUser($user_id, $empid, $teamid)
    {

        $sql = "INSERT INTO tbl_team_assignment ()







                VALUES (default, :empid, :teamid, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empid", $empid, PDO::PARAM_INT);

        $stmt->bindValue(":teamid", $teamid, PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "teamAssignmentSuccess"]);

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
