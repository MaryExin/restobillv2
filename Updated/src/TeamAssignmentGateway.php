<?php

class TeamAssignmentGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT tbl_team_assignment.seq, tbl_team_assignment.empid, tbl_team_assignment.teamid,  tbl_employees.firstname,

                tbl_employees.lastname, tbl_teams.teamname

                FROM tbl_team_assignment

                LEFT OUTER JOIN tbl_employees ON tbl_team_assignment.empid = tbl_employees.empid

                LEFT OUTER JOIN tbl_teams ON tbl_team_assignment.teamid = tbl_teams.teamid

                ORDER BY tbl_team_assignment.seq";

        $stmt = $this->conn->prepare($sql);

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

    public function createForUser($user_id, $data)
    {
    $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_team_assignment WHERE empid = :empids && teamid = :teamids && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":empids", $data["empid"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":teamids", $data["teamid"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        // echo json_encode(["message" => "Duplicate Entry"]);
    } else {

        $sql = "INSERT INTO tbl_team_assignment ()

                VALUES (default, :empid, :teamid, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_INT);
        $stmt->bindValue(":teamid", $data["teamid"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        echo json_encode(["message" => "Success"]);
    }
    }

    public function rejectteam($user_id, string $id)
    {

        $sql = "UPDATE tbl_team_assignment
                SET
                    deletestatus = 'Inactive',
                    usertracker  = :usertracker
                WHERE
                      seq    = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);

    }

    public function editteam($user_id, $id)
    {

    $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_team_assignment WHERE description = :saletypedecriptions && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":saletypedecriptions", $id["Saletypedecription"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "UPDATE tbl_team_assignment
                SET
                    description  = :saletypedecriptions,
                    usertracker  = :usertracker
                WHERE
                      sales_type_id   = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":saletypedecriptions", $id["Saletypedecription"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["Saletypecode"], PDO::PARAM_STR);
        $stmt->execute();
        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
        }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_team_assignment Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT t1.seq, t1.empid, t1.teamid, t1.createdtime, t2.teamname, t3.firstname,t3.middlename, t3.lastname, t1.deletestatus  FROM 
        (Select seq, empid, teamid, deletestatus, createdtime from tbl_team_assignment) as t1 
        LEFT JOIN(Select teamid, teamname  from tbl_teams) as t2 ON t1.teamid = t2.teamid
        LEFT JOIN(Select empid, firstname, middlename, lastname from tbl_employees) as t3 ON t1.empid = t3.empid 
        Where t1.deletestatus = 'Active' AND t1.empid LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

    public function getClearingData()
    {

        $sql = "SELECT * FROM tbl_team_assignment Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

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
