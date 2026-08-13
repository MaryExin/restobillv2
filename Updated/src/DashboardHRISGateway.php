<?php

class DashboardHRISGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllDataDate($data)
    {

        try {

            $sql = "SELECT tbl_task_assignment.empid, tbl_employees.firstname, tbl_employees.lastname,
            tbl_employees.contact_no, tbl_task_assignment.task_id, tbl_projects.project_desc,
            tbl_projects.project_id , tbl_task_assignment.taskname,
            tbl_task_assignment.task_type, tbl_task_assignment.grade, tbl_task_assignment.start_date,
            tbl_task_assignment.target_date, tbl_task_assignment.completed_date, tbl_task_assignment.status,
            tbl_task_assignment.comments, tbl_task_assignment.image_filename, tbl_project_task_team_assignment.teamid,
            tbl_teams.teamname
            FROM tbl_task_assignment
            LEFT OUTER JOIN tbl_projects ON tbl_task_assignment.task_id = tbl_projects.task_id
            LEFT OUTER JOIN tbl_project_task_team_assignment ON tbl_task_assignment.task_id = tbl_project_task_team_assignment.task_id
            LEFT OUTER JOIN tbl_teams ON tbl_project_task_team_assignment.teamid = tbl_teams.teamid
                  LEFT OUTER JOIN tbl_employees ON tbl_task_assignment.empid = tbl_employees.empid
            WHERE tbl_task_assignment.deletestatus = 'Active'
            AND tbl_task_assignment.start_date BETWEEN :dateFrom AND :dateTo";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":dateFrom", $data["datefrom"], PDO::PARAM_STR);

            $stmt->bindValue(":dateTo", $data["dateto"], PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Error"]);

            exit;

        }

    }

    public function getAllPercentageData()
    {

        try {

            $sql = "SELECT
                tbl_projects.task_id,
                tbl_projects.start_date,
                tbl_projects.target_date,
                tbl_projects.completed_date,
                tbl_projects.status,
                tbl_projects.task_desc AS project_task,
                tbl_projects.project_id,
                tbl_projects.project_desc,
                tbl_projects.allocated_task_pct,
                COALESCE((SELECT COUNT(*) FROM tbl_task_assignment t WHERE t.task_id = tbl_projects.task_id), 0) AS tasks_count,
                COALESCE(SUM(CASE WHEN tbl_task_assignment.status = 'Pending' THEN 1 ELSE 0 END), 0) AS count_pending,
                COALESCE(SUM(CASE WHEN tbl_task_assignment.status <> 'Pending' THEN 1 ELSE 0 END), 0) AS count_completed,
                COALESCE(
                    ROUND(SUM(CASE WHEN tbl_task_assignment.status <> 'Pending' THEN 1 ELSE 0 END) /
                    NULLIF((SELECT COUNT(*) FROM tbl_task_assignment t WHERE t.task_id = tbl_projects.task_id), 0),2),
                0) AS task_pct_completed,
                    COALESCE(
                    ROUND((SUM(CASE WHEN tbl_task_assignment.status <> 'Pending' THEN 1 ELSE 0 END) /
                    NULLIF((SELECT COUNT(*) FROM tbl_task_assignment t WHERE t.task_id = tbl_projects.task_id), 0)) * allocated_task_pct,2),
                0) AS project_share_pct
            FROM
                tbl_projects
            LEFT OUTER JOIN
                tbl_task_assignment ON tbl_projects.task_id = tbl_task_assignment.task_id
            WHERE
                tbl_projects.deletestatus = 'Active'
            GROUP BY
                tbl_projects.task_id,
                tbl_projects.task_desc,
                tbl_projects.project_id,
                tbl_projects.project_desc,
                tbl_projects.allocated_task_pct";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Error"]);

            exit;

        }

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_brands Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "INSERT INTO lkp_brands ()



                VALUES (default, CONCAT('BN-',ShortUUID()),:brandname, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":brandname", $data["brandname"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);

    }

    public function rejectbranchs($user_id, string $id)
    {

        $sql = "UPDATE lkp_brands



                SET



                    deletestatus = 'Inactive',



                    usertracker  = :usertracker



                WHERE



                      brand_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function editbranch($user_id, $id)
    {

        $branchcode = $id["brand_code"];

        $branchid = join($branchcode);

        $sql = "UPDATE lkp_brands



                SET



                    brand_name  = :brand_name,



                    usertracker  = :usertracker



                WHERE



                      brand_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":brand_name", $id["brandname"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $branchid, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

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
