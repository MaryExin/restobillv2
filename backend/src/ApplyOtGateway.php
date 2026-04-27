<?php

class ApplyOtGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM tbl_payroll_form_ot Where deletestatus = 'Active' ORDER BY seq";

            $stmt = $this->conn->prepare($sql);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (Exception $e) {

            echo json_encode(["message" => "Registration error"]);

            exit;

        }

    }

    public function getbyPageDatas($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM tbl_payroll_form_ot Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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



                FROM tbl_payroll_form_ot



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
    $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_payroll_form_ot WHERE employee_id = :user_tracker && ot_date = :otdates && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":otdates", $data["otdate"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
        $sql = "INSERT INTO tbl_payroll_form_ot (AutoNum, uuid, employee_id, ot_date, ot_hours, remarks, approve_status, approve_date, deletestatus, usertracker, created_time) 
        VALUES (default, CONCAT('OT-', ShortUUID()), :user_trackers, :ot_date, :ot_hours, :ot_remarks, 'Pending', '', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
$stmt = $this->conn->prepare($sql);
$stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
$stmt->bindValue(":user_trackers", $user_id, PDO::PARAM_STR);
$stmt->bindValue(":ot_date", $data["otdate"], PDO::PARAM_STR);
$stmt->bindValue(":ot_hours", $data["othours"], PDO::PARAM_STR);
$stmt->bindValue(":ot_remarks", $data["otremarks"], PDO::PARAM_STR);
$stmt->execute();
echo json_encode(["message" => "Success"]);


    }
    }

    public function rejectot($user_id,$data)
    {

        $sql = "UPDATE tbl_payroll_form_ot

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      uuid   = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $data["otcode"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);

    }

    public function editot($user_id, $id)
    {
        $sql = "UPDATE tbl_payroll_form_ot
                SET
                    approve_status  = :approvestatuss,
                    approve_date = DATE_ADD(NOW(), INTERVAL 8 HOUR),
                    usertracker  = :usertracker
                WHERE
                      uuid   = :id";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":approvestatuss", $id["approvestatus"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["otcode"], PDO::PARAM_STR);
        $stmt->execute();
        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
        
    }

        public function getbyPageData($data)
    {
        try {

            // $sql = "SELECT * FROM tbl_payroll_form_ot WHERE deletestatus = 'Active' AND MONTH(ot_date) = :months AND YEAR(ot_date) = :years ORDER BY ot_date";

            $sql = "SELECT t1.uuid, t1.employee_id, t1.ot_date, t1.ot_hours, t1.remarks, t1.approve_status, t1.approve_date, t1.deletestatus,
            t2.firstname, t2.middlename, t2.lastname FROM 
            (Select uuid, employee_id, ot_date, ot_hours, remarks, approve_status, approve_date, deletestatus  from tbl_payroll_form_ot) as t1 
            LEFT JOIN (Select empid, firstname, middlename, lastname from tbl_employees) as t2 ON t1.employee_id = t2.empid
            WHERE t1.deletestatus = 'Active' AND MONTH(t1.ot_date) = :months AND YEAR(t1.ot_date) = :years ORDER BY t1.ot_date";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":months", $data["months"], PDO::PARAM_INT); // Assuming months is an integer

            $stmt->bindValue(":years", $data["years"], PDO::PARAM_INT); // Assuming years is an integer

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        } catch (PDOException $e) {

            echo "Error: " . $e->getMessage();

        }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_payroll_form_ot Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM tbl_payroll_form_ot Where deletestatus = 'Active' AND description LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM tbl_payroll_form_ot Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

            $sql = "UPDATE tbl_payroll_form_ot"

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
