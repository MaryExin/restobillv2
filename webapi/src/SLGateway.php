<?php

class SLGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {
        try {

            $sql = "SELECT * FROM lkp_slcodes Where deletestatus = 'Active' ORDER BY sldescription ASC";

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

    public function getAllDatawithfilter($data)
    {
        try {

            $sql = "SELECT * FROM lkp_slcodes Where deletestatus = 'Active' AND glcode = :glcodes ORDER BY glcode";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":glcodes", $data["glcode"], PDO::PARAM_STR);

            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

            //     $sql = "SELECT COUNT(*) as series FROM lkp_slcodes WHERE deletestatus = 'Active' AND glcode = :glcodes ORDER BY glcode";
            // $stmt = $this->conn->prepare($sql);
            // $stmt->bindValue(":glcodes", $data["glcode"], PDO::PARAM_STR);
            // $stmt->execute();

            // $count = 0; // Initialize a variable to hold the count

            // while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            //     $count = $row['series']; // Get the count value
            // }

            // // Increment the count by 1
            // $count += 1;

            // if ($count >= 10) {
            //     return $count; // Return the updated count
            // } else {
            //     $serie = "0" . $count; // Concatenate strings using '.' instead of '+'
            //     return $serie; // Return the updated count
            // }

        } catch (Exception $e) {

            echo json_encode(["message" => "SL Error"]);

            exit;

        }

    }

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_slcodes Where deletestatus = 'Active' ORDER BY createtime LIMIT $pageIndex, $pageData";

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
    // ✅ requires glcode + sldescription only
    $glcode = trim((string)($data["glcode"] ?? ""));
    $sldesc = trim((string)($data["sldescription"] ?? ""));

    if ($glcode === "" || $sldesc === "") {
        http_response_code(400);
        echo json_encode(["message" => "MissingFields", "required" => ["glcode", "sldescription"]]);
        return;
    }

    // ✅ first 3 digits of glcode as prefix
    $prefix = substr(preg_replace("/\D/", "", $glcode), 0, 3); // numeric-only, take first 3
    if (strlen($prefix) < 3) {
        http_response_code(422);
        echo json_encode(["message" => "InvalidGLCode", "details" => "GL must have at least 3 digits"]);
        return;
    }

    try {
        // ✅ protect from race conditions
        $this->conn->beginTransaction();

        // (Optional) lock existing rows for this glcode (best effort)
        // This works well with InnoDB. If table is MyISAM, switch to InnoDB.
        $lockSql = "
            SELECT slcodes
            FROM lkp_slcodes
            WHERE deletestatus = 'Active'
              AND glcode = :glcode
            ORDER BY CAST(slcodes AS UNSIGNED) DESC
            LIMIT 1
            FOR UPDATE
        ";
        $lockStmt = $this->conn->prepare($lockSql);
        $lockStmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
        $lockStmt->execute();
        $maxRow = $lockStmt->fetch(PDO::FETCH_ASSOC);

        // ✅ compute next slcode
        // Rule: slcodes is a numeric string like 1010001, 1010002... containing prefix + sequence
        $nextNumber = 0;

        if ($maxRow && isset($maxRow["slcodes"]) && $maxRow["slcodes"] !== "") {
            $maxVal = (int)preg_replace("/\D/", "", (string)$maxRow["slcodes"]);
            $nextNumber = $maxVal + 1;
        } else {
            // if none exists: start prefix + "0001"
            // e.g. prefix=101 -> 1010001
            $nextNumber = (int)($prefix . "0001");
        }

        $newSlCode = (string)$nextNumber;

        // ✅ ensure not duplicated by description within Active (your old behavior)
        $dupDescSql = "
            SELECT COUNT(*) 
            FROM lkp_slcodes 
            WHERE deletestatus='Active'
              AND sldescription = :sldesc
        ";
        $dupDescStmt = $this->conn->prepare($dupDescSql);
        $dupDescStmt->bindValue(":sldesc", strtoupper($sldesc), PDO::PARAM_STR);
        $dupDescStmt->execute();
        $dupDesc = (int)$dupDescStmt->fetchColumn();

        if ($dupDesc > 0) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Duplicate Entry"]);
            return;
        }

        // ✅ insert
        $ins = "
            INSERT INTO lkp_slcodes
            VALUES (CONCAT('SL-', ShortUUID()), :glcode, :slcode, :sldesc, 'Active', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))
        ";
        $stmt = $this->conn->prepare($ins);
        $stmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
        $stmt->bindValue(":slcode", $newSlCode, PDO::PARAM_STR);
        $stmt->bindValue(":sldesc", strtoupper($sldesc), PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        $this->conn->commit();
        echo json_encode(["message" => "Success", "slcode" => $newSlCode]);
        return;

    } catch (PDOException $e) {
        if ($this->conn->inTransaction()) $this->conn->rollBack();

        // If you add UNIQUE(glcode, slcodes, deletestatus), handle duplicate safely
        if ((int)$e->errorInfo[1] === 1062) {
            http_response_code(409);
            echo json_encode(["message" => "Duplicate SLCode", "details" => "Please retry"]);
            return;
        }

        http_response_code(500);
        echo json_encode(["message" => "SL Create Error"]);
        return;
    } catch (Exception $e) {
        if ($this->conn->inTransaction()) $this->conn->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "SL Create Error"]);
        return;
    }
}


    public function rejectsl($user_id, string $id)
    {

        $sql = "UPDATE lkp_slcodes

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      uuid    = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
           echo json_encode(["message" => "Deleted"]);

    }

    public function editsl($user_id, $id)
    {

        // $branchcode = $id["glcode"];

        // $branchid = join($branchcode);

        $sql = "UPDATE lkp_slcodes

                SET

                    glcode = :glcodes,
                    slcodes  = :slcodes,
                    sldescription  = :sldescriptions,

                    usertracker  = :usertracker

                WHERE

                      uuid   = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":glcodes", $id["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":slcodes", $id["slcode"], PDO::PARAM_STR);
        $stmt->bindValue(":sldescriptions", $id["sldescription"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $id["subcode"], PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();

        echo json_encode(["message" => "Edited"]);
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_slcodes Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_slcodes Where deletestatus = 'Active' AND sldescription  LIKE :search ORDER BY glcode , slcodes  LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_slcodes Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
