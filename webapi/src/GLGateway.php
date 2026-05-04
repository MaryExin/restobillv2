<?php

class GLGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM lkp_glcodes Where deletestatus = 'Active' ORDER BY gldescription ASC";

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

    public function getbyPageData($pageIndex, $pageData)
    {

        $sql = "SELECT * FROM lkp_glcodes Where deletestatus = 'Active' ORDER BY createtime LIMIT $pageIndex, $pageData";

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
     $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_glcodes WHERE glcode = :glcodes && deletestatus = 'Active' || gldescription = :gldescs && deletestatus = 'Active'";
    $checkforduplistmt = $this->conn->prepare($checkforduplisql);
    $checkforduplistmt->bindValue(":glcodes", $data["glcode"], PDO::PARAM_STR);
    $checkforduplistmt->bindValue(":gldescs", $data["gldesc"], PDO::PARAM_STR);
    $checkforduplistmt->execute();
    $rowCount = $checkforduplistmt->fetchColumn();

    if($rowCount > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
    }  else {

        $sql = "INSERT INTO lkp_glcodes ()

                VALUES (CONCAT('GL-',ShortUUID()),:glcodes,:gldescriptions,:normalbalance, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":glcodes", $data["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":gldescriptions", $data["gldesc"], PDO::PARAM_STR);
        $stmt->bindValue(":normalbalance", $data["normalbalance"], PDO::PARAM_STR);

        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
    }
    }

    public function editdgl($user_id, $id)
{
    // Expected payload from frontend/controller:
    // $id["generalcode"] => uuid
    // $id["glcode"]
    // $id["gldesc"] or $id["gldescription"]
    // $id["normalbalance"]

    $uuid = $id["generalcode"] ?? $id["uuid"] ?? null;
    if (!$uuid) {
        echo json_encode(["message" => "Missing generalcode/uuid"]);
        return 0;
    }

    $glcode = $id["glcode"] ?? "";
    $gldesc = $id["gldesc"] ?? ($id["gldescription"] ?? "");
    $normal = $id["normalbalance"] ?? "";

    // Basic validation (optional but helpful)
    if (trim($glcode) === "" || trim($gldesc) === "" || trim($normal) === "") {
        echo json_encode(["message" => "Missing required fields"]);
        return 0;
    }

    // ✅ Duplicate check (Active only) excluding current uuid
    $dupSql = "SELECT COUNT(*) 
               FROM lkp_glcodes 
               WHERE deletestatus = 'Active'
               AND uuid <> :uuid
               AND (glcode = :glcode OR gldescription = :gldesc)";
    $dupStmt = $this->conn->prepare($dupSql);
    $dupStmt->bindValue(":uuid", $uuid, PDO::PARAM_STR);
    $dupStmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
    $dupStmt->bindValue(":gldesc", $gldesc, PDO::PARAM_STR);
    $dupStmt->execute();

    if ((int)$dupStmt->fetchColumn() > 0) {
        echo json_encode(["message" => "Duplicate Entry"]);
        return 0;
    }

    // ✅ Update using your real columns
    $sql = "UPDATE lkp_glcodes
            SET
                glcode = :glcode,
                gldescription = :gldesc,
                normalbalance = :normalbalance,
                usertracker = :usertracker
            WHERE uuid = :uuid";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":glcode", $glcode, PDO::PARAM_STR);
    $stmt->bindValue(":gldesc", $gldesc, PDO::PARAM_STR);
    $stmt->bindValue(":normalbalance", $normal, PDO::PARAM_STR);
    $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
    $stmt->bindValue(":uuid", $uuid, PDO::PARAM_STR);
    $stmt->execute();

    echo json_encode(["message" => "Edited"]);
    return $stmt->rowCount();
}


    public function rejectdgl($user_id, string $id)
    {

        $sql = "UPDATE lkp_glcodes

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      glcode    = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
         echo json_encode(["message" => "Deleted"]);

    }

    public function editgl($user_id, $id)
    {

        // $branchcode = $id["glcode"];

        // $branchid = join($branchcode);

        $sql = "UPDATE lkp_glcodes

                SET

                    glcode = :glcodes,
                    gldescription = :gldescriptions,
                    accountclass = :accountclasss,
                    subaccounctclass = :subaccountclasss,

                    usertracker  = :usertracker

                WHERE

                      uuid   = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":glcodes", $id["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":gldescriptions", $id["gldescription"], PDO::PARAM_STR);
        $stmt->bindValue(":accountclasss", $id["accountclass"], PDO::PARAM_STR);
        $stmt->bindValue(":subaccountclasss", $id["subaccountclass"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->bindValue(":id", $id["generalcode"], PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM lkp_glcodes Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_glcodes Where deletestatus = 'Active' AND gldescription LIKE :search ORDER BY glcode LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT * FROM lkp_glcodes Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
