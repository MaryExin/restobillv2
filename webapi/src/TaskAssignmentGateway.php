<?php

class TaskAssignmentGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM tbl_teams ORDER BY seq";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getbyPageData($pageIndex, $pageData, $empId)
    {

        $sql = "SELECT * FROM tbl_task_assignment WHERE empid=:empid ORDER BY seq DESC LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empid", $empId, PDO::PARAM_STR);

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

        try {

            $this->conn->beginTransaction();

            $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

            $shortUuid = $randomString;

            $taskId = ($data["taskid"] === "none") ? "TS-" . $shortUuid : $data["taskid"];

            $empid = $data["empid"];
            $taskName = $data["taskname"];
            $dateStarted = $data["startdate"];
            $targetDate = $data["targetdate"];

            $sql = "INSERT INTO tbl_task_assignment () VALUES (default, :empid, :taskid, :taskname, :tasktype, 0,
            :startdate, :targetdate, null, 'Pending', :comments, null,
            'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);

            $stmt->bindValue(":taskid", $taskId, PDO::PARAM_STR);

            $stmt->bindValue(":taskname", $data["taskname"], PDO::PARAM_STR);

            $stmt->bindValue(":tasktype", $data["tasktype"], PDO::PARAM_STR);

            $stmt->bindValue(":startdate", $data["startdate"], PDO::PARAM_STR);

            $stmt->bindValue(":targetdate", $data["targetdate"], PDO::PARAM_STR);

            $stmt->bindValue(":comments", $data["comments"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            //Send Email Verification

            // Email

            $emailController = new EmailSendController();

            $emailController->sendEmail("mail.exinnovph.com", "admin@exinnovph.com",

                "ExinnovEmail@2025", "admin@exinnovph.com", $data["email"], $data["taskname"],

                "<html>
                <body>
                    <center>
                        <img src='https://jeremiahd61.sg-host.com/images/app/logo.png' alt='Logo' width='100'><br>

                        <p style='font-size: 20px;'>Hello $empid <br><br> A NEW Task has been assigned to you:
                            <span style='font-weight: bold; font-size: 20px;
                                background-color: rgb(226, 102, 56); color: white; padding: 2px 8px; border-radius: 10px;'>
                                $taskName
                            </span>
                            <br>
                            Start date: $dateStarted
                            <br>
                            Target date: $targetDate
                            <br>
                            Check you profile to see details
                            <br>
                            <br> Thank you <br>
                        </p>
                    </center>
                </body>
                </html>"
            );

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (Exception $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function updateForUser($user_id, $data)
    {

        if ($data["approvaltype"] === "Completed") {
            $sql = "UPDATE tbl_task_assignment SET completed_date = DATE_ADD(NOW(),INTERVAL 8 HOUR),
            status = 'Completed', createdtime = DATE_ADD(NOW(),INTERVAL 8 HOUR), usertracker = :user_tracker
            WHERE empid = :empid
            AND task_id = :taskid";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
            $stmt->bindValue(":taskid", $data["taskid"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            echo json_encode(["message" => "Success"]);

        } else {
            $sql = "UPDATE tbl_task_assignment SET grade = :grade,
            status = 'Reviewed', createdtime = DATE_ADD(NOW(),INTERVAL 8 HOUR), usertracker = :user_tracker
            WHERE empid = :empid
            AND task_id = :taskid";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":grade", $data["grade"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
            $stmt->bindValue(":taskid", $data["taskid"], PDO::PARAM_STR);

            $stmt->execute();

            echo json_encode(["message" => "Success"]);

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
