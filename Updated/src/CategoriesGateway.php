<?php

class CategoriesGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllCategories()
    {

        $sql = "SELECT * FROM lkp_product_category
                    WHERE deletestatus = 'Active'
                    ORDER BY sort ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getAllProjectTasksData()
    {

        $sql = "SELECT  task_id, task_desc as project_task, project_id, project_desc, allocated_task_pct

                FROM tbl_projects

                WHERE deletestatus = 'Active'";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getProductAssignment($data)
    {

        $sql = "SELECT tbl_project_task_team_assignment.teamid, tbl_teams.teamname,

            tbl_project_task_team_assignment.project_id, tbl_projects.project_desc,

            tbl_project_task_team_assignment.task_id, tbl_projects.task_desc,

            tbl_project_task_team_assignment.assigned_date

            FROM tbl_project_task_team_assignment

            LEFT OUTER JOIN tbl_teams ON tbl_project_task_team_assignment.teamid = tbl_teams.teamid

            LEFT OUTER JOIN tbl_projects ON tbl_project_task_team_assignment.project_id = tbl_projects.project_id

            AND tbl_projects.task_id = tbl_project_task_team_assignment.task_id

            WHERE tbl_project_task_team_assignment.deletestatus = 'Active'

            AND tbl_project_task_team_assignment.project_id = :project_id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":project_id", $data["projectid"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getProductAssignmentByTeam($data)
    {

        $sql = "SELECT tbl_project_task_team_assignment.teamid, tbl_teams.teamname,

            tbl_project_task_team_assignment.project_id, tbl_projects.project_desc,

            tbl_project_task_team_assignment.task_id, tbl_projects.task_desc,

            tbl_project_task_team_assignment.assigned_date

            FROM tbl_project_task_team_assignment

            LEFT OUTER JOIN tbl_teams ON tbl_project_task_team_assignment.teamid = tbl_teams.teamid

            LEFT OUTER JOIN tbl_projects ON tbl_project_task_team_assignment.project_id = tbl_projects.project_id

            AND tbl_projects.task_id = tbl_project_task_team_assignment.task_id

            WHERE tbl_project_task_team_assignment.deletestatus = 'Active'

            AND tbl_project_task_team_assignment.project_id = :projectid

            AND tbl_project_task_team_assignment.teamid = :teamid";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":projectid", $data["projectid"], PDO::PARAM_STR);

        $stmt->bindValue(":teamid", $data["teamid"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getDistinctAllData()
    {

        $sql = "SELECT * FROM lkp_build_of_products



            WHERE deletestatus = 'Active'



            ORDER BY `desc` ASC;";

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

        $sql = "SELECT lkp_build_of_products.build_code, lkp_build_of_products.desc, lkp_build_of_products.build_qty,



            lkp_build_of_products.uomval, lkp_build_of_products.uom,



            tbl_pricing_details.pricing_code as pricing_category, lkp_pricing_code.pricing_code ,tbl_pricing_details.cost_per_uom, tbl_pricing_details.srp,



            lkp_build_of_products.level, lkp_build_of_products.tax_type, lkp_build_of_products.category, lkp_build_of_products.expiry_days,



            lkp_build_of_products.portion_parent



            FROM lkp_build_of_products



            LEFT OUTER JOIN tbl_pricing_details ON lkp_build_of_products.build_code =  tbl_pricing_details.inv_code



            LEFT OUTER JOIN lkp_pricing_code ON tbl_pricing_details.pricing_code = lkp_pricing_code.uuid



            WHERE lkp_build_of_products.deletestatus = 'Active'



            ORDER BY lkp_build_of_products.desc LIMIT $pageIndex, $pageData";

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

        $randomString = substr(bin2hex(random_bytes(5)), 0, 10);

        $currentYearMonth = date('Ym');

        $shortUuid = $currentYearMonth . $randomString;

        $shortUuid = str_pad($shortUuid, 16, '0', STR_PAD_RIGHT);

        $shortUuid = "PJ-" . $shortUuid;

        $sql = "INSERT INTO tbl_projects () VALUES (default, :project_id, CONCAT('TS-',shortUUID()),



        :project_desc, :task_desc, :allocated_pct, :status, :start_date, :target_date, :completed_date,



        'Active', :user_tracker, DATE_ADD(NOW(),INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        foreach ($data["tasks"] as $task) {

            $stmt->bindValue(":project_id", $shortUuid, PDO::PARAM_STR);

            $stmt->bindValue(":project_desc", $data["projectdescription"], PDO::PARAM_STR);

            $stmt->bindValue(":task_desc", $task["task"], PDO::PARAM_STR);

            $stmt->bindValue(":allocated_pct", $task["percentage"] / 100, PDO::PARAM_STR);

            $stmt->bindValue(":status", "Pending", PDO::PARAM_STR);

            $stmt->bindValue(":start_date", $data["startdate"], PDO::PARAM_STR);

            $stmt->bindValue(":target_date", $data["targetdate"], PDO::PARAM_STR);

            $stmt->bindValue(":completed_date", 0, PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

        }

        echo json_encode(["message" => "Success"]);

    }

    public function assignProject($user_id, $data)
    {

        $sql = "INSERT INTO tbl_project_task_team_assignment () VALUES (default, :team_id, :project_id,



        :task_id, DATE_ADD(NOW(),INTERVAL 8 HOUR), 'Active', :user_tracker, DATE_ADD(NOW(),INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":team_id", $data["teamid"], PDO::PARAM_STR);

        $stmt->bindValue(":project_id", $data["projectid"], PDO::PARAM_STR);

        $stmt->bindValue(":task_id", $data["taskid"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);

    }

    public function editData($user_id, $data)
    {

        $id = $data["buildCode"];

        $sql = "UPDATE lkp_build_of_products SET `desc` = :buildName, build_qty = :quantity, uomval = :uomVal,



                uom = :uom, level = :productLevel, tax_type = :taxType,  category = :category,



                expiry_days = :expiry, portion_parent = :parentProduct



                    WHERE build_code = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":buildName", $data["buildName"], PDO::PARAM_STR);

        $stmt->bindValue(":quantity", $data["quantity"], PDO::PARAM_STR);

        $stmt->bindValue(":uomVal", $data["uomVal"], PDO::PARAM_STR);

        $stmt->bindValue(":uom", $data["uom"], PDO::PARAM_STR);

        $stmt->bindValue(":productLevel", $data["productLevel"], PDO::PARAM_STR);

        $stmt->bindValue(":taxType", $data["taxType"], PDO::PARAM_STR);

        $stmt->bindValue(":category", $data["category"], PDO::PARAM_STR);

        $stmt->bindValue(":expiry", $data["expiry"], PDO::PARAM_STR);

        $stmt->bindValue(":parentProduct", $data["parentProduct"], PDO::PARAM_STR);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function deleteData($user_id, $data)
    {

        $sql = "UPDATE lkp_build_of_products







                SET







                    deletestatus = 'Inactive',







                    usertracker  = :usertracker







                WHERE







                      build_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

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
