<?php

class ApprovalCredsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM tbl_approval_creds Where deletestatus = 'Active'  ORDER BY seq";

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

        $sql = "SELECT * FROM tbl_approval_creds Where deletestatus = 'Active'  ORDER BY seq LIMIT $pageIndex, $pageData";

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
        $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_approval_creds
        WHERE empid = :empids && moduletoapprove = :moduletoapproves
        && approvaldescription = :approvaldescs && deletestatus = 'Active'
        && busunitcode = :businessunits";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":empids", $data["empid"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":moduletoapproves", $data["moduletoapprove"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":approvaldescs", $data["approvaldesc"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":businessunits", $data["businessunit"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = $checkforduplistmt->fetchColumn();

        if($rowCount > 0) {
            echo json_encode(["message" => "Duplicate Entry"]);
        } else {
        $forseq = "SELECT COUNT(*) as count FROM tbl_approval_creds WHERE moduletoapprove = :moduletoapproves && deletestatus = 'Active' && busunitcode = :businessunits";
        $forseqstmt = $this->conn->prepare($forseq);
        $forseqstmt->bindValue(":moduletoapproves", $data["moduletoapprove"], PDO::PARAM_STR);
        $forseqstmt->bindValue(":businessunits", $data["businessunit"], PDO::PARAM_STR);
        $forseqstmt->execute();
        $rowCount = $forseqstmt->fetchColumn();
    
        $rowCount++;

        $sql = "INSERT INTO tbl_approval_creds ()
                VALUES (default, CONCAT('APL-',ShortUUID()), :empids, :moduletoapproves, :approvaldescs, $rowCount, :businessunits, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":empids", $data["empid"], PDO::PARAM_STR);
        $stmt->bindValue(":moduletoapproves", $data["moduletoapprove"], PDO::PARAM_STR);
        $stmt->bindValue(":approvaldescs", $data["approvaldesc"], PDO::PARAM_STR);
        $stmt->bindValue(":businessunits", $data["businessunit"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);
        }
    }

    public function rejectapprovalcred($user_id, $id)
    {
                $sql = "UPDATE tbl_approval_creds

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      approvalid  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id["approvalcredid"], PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

       $stmt->execute();


        $sql = "SELECT busunitcode, moduletoapprove FROM tbl_approval_creds where approvalid = :approvalid";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":approvalid", $id["approvalcredid"], PDO::PARAM_STR);

        $stmt->execute();

        $result = $stmt->fetch(PDO::FETCH_ASSOC);

    

        $sql = "SELECT * FROM tbl_approval_creds
        WHERE moduletoapprove = :moduletoapprove AND busunitcode = :busunitcode and deletestatus = 'Active' order by approvalseq asc";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":moduletoapprove", $result['moduletoapprove']);

        $stmt->bindValue(":busunitcode", $result['busunitcode']);

        $stmt->execute();

        $approver = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
        
        $seq = 1;
        foreach ($approver as $approvers)
        {
           
            $sql = "UPDATE tbl_approval_creds SET approvalseq = :seq where approvalid = :approvalid ";
    
            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":seq", $seq);
            
            $stmt->bindValue(":approvalid", $approvers['approvalid']);

            $stmt->execute();

            $seq++;
            
        }

        echo json_encode(["message" => "Deleted"]);

    }

    public function editapprovalcred($user_id, $id)
    {
        $checkforduplisql = "SELECT COUNT(*) as count FROM tbl_approval_creds WHERE empid = :empids && moduletoapprove = :moduletoapproves && approvaldescription = :approvaldescs && deletestatus = 'Active'";
        $checkforduplistmt = $this->conn->prepare($checkforduplisql);
        $checkforduplistmt->bindValue(":empids", $id["empid"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":moduletoapproves", $id["moduletoapprove"], PDO::PARAM_STR);
        $checkforduplistmt->bindValue(":approvaldescs", $id["approvaldesc"], PDO::PARAM_STR);
        $checkforduplistmt->execute();
        $rowCount = $checkforduplistmt->fetchColumn();

        if($rowCount > 0) {
            echo json_encode(["message" => "Duplicate Entry"]);
        } else {
        $sql = "UPDATE tbl_approval_creds
                SET
                    empid  = :empids,
                    moduletoapprove  = :moduletoapproves,
                    approvaldescription  = :approvaldescriptions,
                    busunitcode  = :busunitcodes,
                    usertracker  = :usertracker
                WHERE
                      approvalid  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":empids", $id["empid"], PDO::PARAM_STR);
        $stmt->bindValue(":moduletoapproves", $id["moduletoapprove"], PDO::PARAM_STR);
        $stmt->bindValue(":approvaldescriptions", $id["approvaldesc"], PDO::PARAM_STR);
        $stmt->bindValue(":busunitcodes", $id["businessunit"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
        $stmt->bindValue(":id", $id["approvalcredid"], PDO::PARAM_STR);

        $stmt->execute();

        // return $stmt->rowCount();
        echo json_encode(["message" => "Edited"]);
        }
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_approval_creds Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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

        // $sql = "SELECT * FROM tbl_approval_creds Where deletestatus = 'Active' AND moduletoapprove LIKE :search ORDER BY seq LIMIT $pageIndex, $pageData";

        $sql = "SELECT 
            t1.*, 
            CONCAT(T2.lastname, ', ', T2.firstname, ' ', T2.middlename) AS employeename, 
            T3.route_name, 
            T4.name 
        FROM 
            (SELECT * 
             FROM tbl_approval_creds 
             WHERE deletestatus = 'Active' 
                AND moduletoapprove LIKE :search 
             ORDER BY seq 
             LIMIT $pageIndex, $pageData
            ) AS t1 
        LEFT JOIN tbl_employees AS T2 
            ON t1.empid = T2.empid
        LEFT JOIN lkp_routes AS T3 
            ON t1.moduletoapprove = T3.react_route
        LEFT JOIN lkp_busunits AS T4 
            ON t1.busunitcode = T4.busunitcode";



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

        $sql = "SELECT * FROM tbl_approval_creds Where deletestatus = 'Active' ORDER BY seq LIMIT $pageIndex, $pageData";

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
