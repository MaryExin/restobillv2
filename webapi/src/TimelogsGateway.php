<?php

class TimelogsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM tbl_timelogs Where deletestatus = 'Active' ORDER BY seq";

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

public function getbyPageData($data)
{
    if ($data["emptimelog"] != 'emptimelog') {
        try {

            $sql = "SELECT * FROM tbl_timelogs WHERE deletestatus = 'Active' AND MONTH(date) = :months AND YEAR(date) = :years ORDER BY date";

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
    } else {
        try {

            $sql = "SELECT * FROM tbl_timelogs WHERE userid = :empid AND  deletestatus = 'Active' AND MONTH(date) = :months AND YEAR(date) = :years ORDER BY date";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_INT);

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

    public function AddNewLogs($user_id, $data)
    {
                $dateObject = new DateTime($data["date"]);
                $formattedDate = $dateObject->format('Y/m/d');


    $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_timelogs WHERE date = :dates && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":dates", $formattedDate, PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    } else {
         $sql = "INSERT INTO tbl_timelogs ()
                        VALUES (default, CONCAT('TL-',ShortUUID()), :userid, :date, :timein, :timeout, :busicode, 'Manual', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":userid",  $data["Empid"], PDO::PARAM_STR);
                        $stmt->bindValue(":date", $formattedDate, PDO::PARAM_STR);
                        $stmt->bindValue(":timein", $data["Logtimein"], PDO::PARAM_STR);
                        $stmt->bindValue(":timeout", $data["Logtimeout"], PDO::PARAM_STR);
                        $stmt->bindValue(":busicode", $data["empbusunit"], PDO::PARAM_STR);
                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                        $stmt->execute();
        echo json_encode(["message" => "Success"]);
    }
    }

    public function createForUser($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $sqlgeoloc = "SELECT * FROM tbl_employee_location
            WHERE emplocation_user  = :emplocation_user
            AND deletestatus = 'Active'";

            $stmtgeoloc = $this->conn->prepare($sqlgeoloc);
            $stmtgeoloc->bindValue(":emplocation_user", $user_id, PDO::PARAM_STR);
            $stmtgeoloc->execute();
            $isExist = $stmtgeoloc->rowCount();

            if (!$isExist > 0) {
                echo json_encode(["message" => "NoLocation"]);
                exit;
            }

            $userData = $stmtgeoloc->fetch(PDO::FETCH_ASSOC);

            // Declare variables
            $userLatitude = $userData["latitude"];
            $userLongitude = $userData["longitude"];
            $currentLatitude = $data["latitude"];
            $currentLongitude = $data["longitude"];

            //Compute Distance

            // // Convert degrees to radians
            $lat1 = deg2rad($userLatitude);
            $lon1 = deg2rad($userLongitude);
            $lat2 = deg2rad($currentLatitude);
            $lon2 = deg2rad($currentLongitude);

            // Radius of the Earth in kilometers
            $radius = 6371;

            // Calculate differences
            $dlat = $lat2 - $lat1;
            $dlon = $lon2 - $lon1;

            // Haversine formula
            $a = sin($dlat / 2) * sin($dlat / 2) + cos($lat1) * cos($lat2) * sin($dlon / 2) * sin($dlon / 2);
            $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
            $distance = $radius * $c * 1000; // Convert kilometers to meters

            if ($distance > 150) { //Min. Distance is 150 meter
                echo json_encode(["message" => "invalidLocation", "distance" => $distance]);
                exit;
            } else {
                $dateObject = new DateTime($data["date"]);
                $formattedDate = $dateObject->format('Y/m/d');

                // TimeIn
                if ($data["timelogtype"] === "timein") {
                    $sqlchecking = "SELECT * FROM tbl_timelogs WHERE `date` = :date
                    AND userid = :userid
                    AND timein <> ''";

                    $stmtchecking = $this->conn->prepare($sqlchecking);
                    $stmtchecking->bindValue(":date", $formattedDate, PDO::PARAM_STR);
                    $stmtchecking->bindValue(":userid", $user_id, PDO::PARAM_STR);

                    $stmtchecking->execute();

                    if (!$stmtchecking->rowCount() > 0) {
                        $sql = "INSERT INTO tbl_timelogs ()
                        VALUES (default, CONCAT('TL-',ShortUUID()), :userid, :date, :timein, :timeout, :busicode, 'Bio', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

                        $stmt = $this->conn->prepare($sql);
                        $stmt->bindValue(":userid", $user_id, PDO::PARAM_STR);
                        $stmt->bindValue(":date", $formattedDate, PDO::PARAM_STR);
                        $stmt->bindValue(":timein", $data["timein"], PDO::PARAM_STR);
                        $stmt->bindValue(":timeout", "", PDO::PARAM_STR);
                        $stmt->bindValue(":busicode", $data["empbusunit"], PDO::PARAM_STR);
                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                        $stmt->execute();

                        echo json_encode(["message" => "timeInSuccess"]);
                    } else {
                        echo json_encode(["message" => "duplicateTimeIn", "distance" => $distance]);
                    }
                } else { // TimeOut
                    $sqlchecking = "SELECT * FROM tbl_timelogs WHERE `date` = :date
                    AND userid = :userid
                    AND timein <> ''";

                    $stmtchecking = $this->conn->prepare($sqlchecking);
                    $stmtchecking->bindValue(":date", $formattedDate, PDO::PARAM_STR);
                    $stmtchecking->bindValue(":userid", $user_id, PDO::PARAM_STR);

                    $stmtchecking->execute();

                    if (!$stmtchecking->rowCount() > 0) {
                        echo json_encode(["message" => "noTimeIn"]);
                    } else {
                        $sqlcheckingout = "SELECT * FROM tbl_timelogs WHERE `date` = :date
                        AND timeout <> ''
                        AND userid = :userid";

                        $stmtcheckingout = $this->conn->prepare($sqlcheckingout);
                        $stmtcheckingout->bindValue(":date", $formattedDate, PDO::PARAM_STR);
                        $stmtcheckingout->bindValue(":userid", $user_id, PDO::PARAM_STR);

                        $stmtcheckingout->execute();

                        if (!$stmtcheckingout->rowCount() > 0) {
                            $sql = "UPDATE tbl_timelogs SET timeout = :timeout , busunit_code = :busicode , remarks = 'Bio' WHERE userid = :userid AND date = :date";

                            $stmt = $this->conn->prepare($sql);
                            $stmt->bindValue(":userid", $user_id, PDO::PARAM_STR);
                            $stmt->bindValue(":date", $formattedDate, PDO::PARAM_STR);
                            $stmt->bindValue(":timeout", $data["timeout"], PDO::PARAM_STR);
                            $stmt->bindValue(":busicode", $data["empbusunit"], PDO::PARAM_STR);
                            $stmt->execute();

                            echo json_encode(["message" => "timeOutSuccess"]);
                        } else {
                            echo json_encode(["message" => "duplicateTimeOut", "distance" => $distance]);
                        }
                    }
                }
            }

            // Commit the transaction
            $this->conn->commit();
        } catch (PDOException $e) {
            // Rollback the transaction on error
            $this->conn->rollBack();

            // Handle the error
            echo json_encode(["error" => $e->getMessage()]);
        }

    }

    public function rejecttimelogss($user_id, $id)
    {

        $sql = "UPDATE tbl_timelogs
                SET
                    deletestatus = 'Inactive',
                    usertracker  = :usertracker
                WHERE
                      userid  = :Empid AND date = :Date";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":Empid", $id["empid"], PDO::PARAM_STR);
        $stmt->bindValue(":Date", $id["date"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Deleted"]);

    }

    public function edittimelogs($user_id, $id)
    {
    $dateObject = new DateTime($id["date"]);
    $formattedDate = $dateObject->format('Y/m/d');

    // $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_timelogs WHERE date = :dates && deletestatus = 'Active'";
    // $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    // $checkforduplistmt->bindValue(":dates", $formattedDate, PDO::PARAM_STR);
    // $checkforduplistmt->execute();
    // $rowCount = $checkforduplistmt->fetchColumn();

    // if($rowCount > 0) {
    //     echo json_encode(["message" => "Duplicate Entry"]);
    // } else {

        $sql = "UPDATE tbl_timelogs
                SET
                    timein  = :logtimein,
                    timeout  = :logtimeout,
                    remarks = 'Edit Manual',
                    usertracker  = :usertracker
                WHERE
                userid = :empid AND date  = :dates";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":dates", $id["date"], PDO::PARAM_STR);
        $stmt->bindValue(":empid", $id["Empid"], PDO::PARAM_STR);
        $stmt->bindValue(":logtimein", $id["Logtimein"], PDO::PARAM_STR);
        $stmt->bindValue(":logtimeout", $id["Logtimeout"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
    // }
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
