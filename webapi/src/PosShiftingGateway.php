<?php

class PosShiftingGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }
    

    public function selectDate($user_id)
    {   

    $sql = "SELECT CONCAT(firstname, ' ', lastname) AS full_name ,
            classification
            FROM tbl_users_global_assignment 
            WHERE uuid = :user_id 
            LIMIT 1";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindParam(':user_id', $user_id);
    $stmt->execute();

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

        $sql = "SELECT Category_Code, Unit_Code,
                Unit_Name
                FROM tbl_main_business_units 
                ORDER BY id DESC -- Or your primary key
                LIMIT 1";
                    
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $codes = $stmt->fetch(PDO::FETCH_ASSOC);

    
        $sql = "SELECT 
            T1.Closing_DateTime, 
            T1.Shift_Status, 
            T1.Shift_ID, 
            T1.Opening_DateTime, 
            T1.Closing_DateTime,
            CONCAT(T2.firstname, ' ', T2.lastname) AS opened_by_name,
            -- Check if Closing_User_ID is not 0 and not NULL
            CASE 
                WHEN T1.Closing_User_ID IS NOT NULL AND T1.Closing_User_ID <> '0' 
                THEN CONCAT(T3.firstname, ' ', T3.lastname) 
                ELSE 'N/A' 
            END AS closed_by_name
        FROM tbl_pos_shifting_records AS T1
        LEFT JOIN tbl_users_global_assignment AS T2
            ON T1.Opening_User_ID = T2.uuid
        LEFT JOIN tbl_users_global_assignment AS T3
            ON T1.Closing_User_ID = T3.uuid
        ORDER BY T1.Opening_DateTime DESC 
        LIMIT 1;";
                    
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $lastRecord = $stmt->fetch(PDO::FETCH_ASSOC);

    
        $finalDate = ($lastRecord && !empty($lastRecord['Closing_DateTime'])) 
                    ? $lastRecord['Closing_DateTime'] 
                    : date("Y-m-d", strtotime("yesterday"));

    
        return [
            "Category_Code" => $codes['Category_Code'] ?? null,
            "Unit_Code"     => $codes['Unit_Code'] ?? null,
            "selectedDate"  => $finalDate,
            "Shift_Status" => $lastRecord['Shift_Status'] ?? null,
            "Shift_ID" => $lastRecord['Shift_ID'] ?? null,
            "Opening_DateTime" => $lastRecord['Opening_DateTime'] ?? null,
            "Closing_DateTime" => $lastRecord['Closing_DateTime'] ?? null,
            "opened_by_name" => $lastRecord['opened_by_name'] ?? null,
            "closed_by_name" => $lastRecord['closed_by_name'] ?? null,
            "Unit_Name" => $codes['Unit_Name'] ?? null,
             "userName" => $user['full_name'] ?? null,
              "classification" => $user['classification'] ?? null
             
        ];
    }


    public function openNewShift($user_id, $data)
    {
        try {
            $category_code = isset($data["category_code"]) ? $data["category_code"] : "";
            $unit_code = isset($data["unit_code"]) ? $data["unit_code"] : "";
            $terminal_number = isset($data["terminal_number"]) ? $data["terminal_number"] : "";
            $opening_cash_count = isset($data["opening_cash_count"]) ? $data["opening_cash_count"] : 0;
            $opening_cash_count_confirmation = isset($data["opening_cash_count_confirmation"]) ? $data["opening_cash_count_confirmation"] : 0;
            $opening_date = isset($data["opening_date"]) ? $data["opening_date"] : date("Y-m-d");

            if ($opening_cash_count === "" || $opening_cash_count_confirmation === "") {
                echo json_encode([
                    "status" => "error",
                    "message" => "Please input amount!"
                ]);
                return;
            }

            if ((string)$opening_cash_count !== (string)$opening_cash_count_confirmation) {
                echo json_encode([
                    "status" => "error",
                    "message" => "Amounts must be equal!"
                ]);
                return;
            }

            $sqlLastRecord = "
                SELECT Opening_DateTime
                FROM tbl_pos_shifting_records
                WHERE Category_Code = :category_code
                AND Unit_Code = :unit_code
                AND terminal_number = :terminal_number
                ORDER BY Opening_DateTime DESC
                LIMIT 1
            ";

            $stmtLastRecord = $this->conn->prepare($sqlLastRecord);
            $stmtLastRecord->bindValue(":category_code", $category_code);
            $stmtLastRecord->bindValue(":unit_code", $unit_code);
            $stmtLastRecord->bindValue(":terminal_number", $terminal_number);
            $stmtLastRecord->execute();

            $lastRecord = $stmtLastRecord->fetch(PDO::FETCH_ASSOC);

            if ($lastRecord && !empty($lastRecord["Opening_DateTime"])) {
                $nextOpeningDate = date("Y-m-d", strtotime($lastRecord["Opening_DateTime"] . " +1 day"));
            } else {
                $nextOpeningDate = date("Y-m-d");
            }

            if ($opening_date != "") {
                $openNewDate = date("Y-m-d H:i:s", strtotime($opening_date . " " . date("H:i:s")));
            } else {
                $openNewDate = date("Y-m-d H:i:s", strtotime($nextOpeningDate . " " . date("H:i:s")));
            }

            $openDateOnly = date("Y-m-d", strtotime($openNewDate));
            $timeStamp = date("Y-m-d H:i:s");

            $sqlCheckExisting = "
                SELECT COUNT(*) AS total
                FROM tbl_pos_shifting_records
                WHERE Category_Code = :category_code
                AND Unit_Code = :unit_code
                AND terminal_number = :terminal_number
                AND DATE(Opening_DateTime) = :opening_date
                LIMIT 1
            ";

            $stmtCheckExisting = $this->conn->prepare($sqlCheckExisting);
            $stmtCheckExisting->bindValue(":category_code", $category_code);
            $stmtCheckExisting->bindValue(":unit_code", $unit_code);
            $stmtCheckExisting->bindValue(":terminal_number", $terminal_number);
            $stmtCheckExisting->bindValue(":opening_date", $openDateOnly);
            $stmtCheckExisting->execute();

            $existingRecord = $stmtCheckExisting->fetch(PDO::FETCH_ASSOC);

            if ($existingRecord && (int)$existingRecord["total"] > 0) {
                echo json_encode([
                    "status" => "error",
                    "message" => "The date that you selected is already open."
                ]);
                return;
            }

            $sqlGenerateShiftId = "
                SELECT Shift_ID
                FROM tbl_pos_shifting_records
                WHERE Category_Code = :category_code
                AND Unit_Code = :unit_code
                AND terminal_number = :terminal_number
                ORDER BY Shift_ID DESC
                LIMIT 1
            ";

            $stmtGenerateShiftId = $this->conn->prepare($sqlGenerateShiftId);
            $stmtGenerateShiftId->bindValue(":category_code", $category_code);
            $stmtGenerateShiftId->bindValue(":unit_code", $unit_code);
            $stmtGenerateShiftId->bindValue(":terminal_number", $terminal_number);
            $stmtGenerateShiftId->execute();

            $lastShift = $stmtGenerateShiftId->fetch(PDO::FETCH_ASSOC);
            $shift_id = $lastShift ? ((int)$lastShift["Shift_ID"] + 1) : 1;

            $sqlInsert = "
                INSERT INTO tbl_pos_shifting_records
                (
                    Category_Code,
                    Unit_Code,
                    Shift_ID,
                    terminal_number,
                    Opening_User_ID,
                    Opening_DateTime,
                    Opening_Cash_Count,
                    Closing_User_ID,
                    Closing_DateTime,
                    Closing_Cash_Count,
                    Shift_Status,
                    Remarks,
                    Status,
                    Date_Recorded
                )
                VALUES
                (
                    :category_code,
                    :unit_code,
                    :shift_id,
                    '1',
                    :opening_user_id,
                    :opening_datetime,
                    :opening_cash_count,
                    :closing_user_id,
                    '',
                    :closing_cash_count,
                    :shift_status,
                    :remarks,
                    :status,
                    :date_recorded
                )
            ";

            $stmtInsert = $this->conn->prepare($sqlInsert);
            $stmtInsert->bindValue(":category_code", $category_code);
            $stmtInsert->bindValue(":unit_code", $unit_code);
            $stmtInsert->bindValue(":shift_id", $shift_id);
            $stmtInsert->bindValue(":opening_user_id", $user_id);
            $stmtInsert->bindValue(":opening_datetime", $openNewDate);
            $stmtInsert->bindValue(":opening_cash_count", $opening_cash_count);
            $stmtInsert->bindValue(":closing_user_id", "0");
            $stmtInsert->bindValue(":closing_cash_count", "0");
            $stmtInsert->bindValue(":shift_status", "Open");
            $stmtInsert->bindValue(":remarks", "");
            $stmtInsert->bindValue(":status", "Active");
            $stmtInsert->bindValue(":date_recorded", $timeStamp);
            $stmtInsert->execute();

            echo json_encode([
                "status" => "success",
                "message" => "New shift has been opened!",
                "shift_id" => $shift_id,
                "opening_datetime" => $openNewDate,
                "opening_cash_count" => (double)$opening_cash_count
            ]);
        } catch (PDOException $e) {
            echo json_encode([
                "status" => "error",
                "message" => "Database Error: " . $e->getMessage()
            ]);
        }
    }

}
