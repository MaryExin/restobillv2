<?php

class PcfsetupGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        try {
            $sql = "SELECT 
                t1.custodian, 
                t2.firstname, 
                t2.middlename, 
                t2.lastname, 
                t3.sl_description, 
                t3.slcode,
                t1.busunitcode,
                t2.empid,
				ROUND((t1.pcf_balance - ((COALESCE(t4.amounts, 0) + COALESCE(t6.amounts, 0))  * -1) ),2) as pcf_balance
            FROM 
                (SELECT seq, custodian, deletestatus, pcf_balance,sl_code,busunitcode FROM tbl_pcf_setup) AS t1 
            LEFT JOIN 
                (SELECT empid, firstname, middlename, lastname FROM tbl_employees) AS t2 
                ON t1.custodian = t2.empid 
            LEFT JOIN 
                (SELECT * FROM lkp_chart_of_accounts) AS t3 
                ON t3.slcode = t1.sl_code
            LEFT JOIN 
                (SELECT SUM(amount) as amounts, slcode , busunitcode 
                 FROM tbl_accounting_transactions 
                 WHERE amount < 0 AND menutransacted = '/pettycashtransaction' AND approvalstatus NOT IN ('Voided', 'Canceled')
                 GROUP BY slcode,busunitcode) AS t4 
                ON t4.slcode = t3.slcode  and t4.busunitcode = t1.busunitcode
            LEFT JOIN 
                (SELECT SUM(amount) as amounts, slcode ,busunitcode
                 FROM tbl_accounting_transactions 
                 WHERE menutransacted = '/disbursements' AND approvalstatus = 'Pending' 
                   GROUP BY slcode, busunitcode) AS t5 
                ON t5.slcode = t3.slcode and t5.busunitcode = t1.busunitcode
			LEFT JOIN
            (SELECT 
                    SUM(CASE
                            WHEN t1.payment_status = 'Partial' THEN t2.amount_cleared
                            WHEN t1.payment_status = 'Paid' THEN t1.amount
                            ELSE 0
                        END) AS amounts,
                        t1.sl_code,
                        t1.busunitcode
                FROM
                    tbl_disbursements AS t1
                LEFT JOIN tbl_disbursements_clearing AS t2 ON t1.reference = t2.disbursement_reference
                WHERE
                    (t1.payment_status = 'Paid'
                        OR t1.payment_status = 'Partial')
                        AND t2.deletestatus = 'Active'
                GROUP BY t1.sl_code , t1.busunitcode) AS t6 
                ON t6.sl_code = t3.slcode and t6.busunitcode = t1.busunitcode
            WHERE 
                t1.deletestatus = 'Active' 
            GROUP BY t1.seq 
            ORDER BY 
                t1.seq";
        //     $sql = "SELECT t1.custodian, t2.firstname, t2.middlename, t2.lastname 
        // FROM (SELECT seq, custodian, deletestatus FROM tbl_pcf_setup) AS t1 
        // LEFT JOIN (SELECT empid, firstname, middlename, lastname FROM tbl_employees) AS t2 
        // ON t1.custodian = t2.empid 
        // WHERE deletestatus = 'Active' 
        // ORDER BY seq";

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

    public function getbyPageData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT t1.*,t3.slcode,t3.sl_description,t4.name, CONCAT(t5.firstname, ' ', COALESCE(t5.middlename, ''), ' ', t5.lastname) AS custodian_name
            FROM tbl_pcf_setup as t1 	 
            LEFT JOIN 
    		(SELECT * FROM lkp_chart_of_accounts) AS t3 ON t3.slcode  = t1.sl_code
            LEFT JOIN 
            (SELECT * FROM lkp_busunits) AS t4 
            ON t4.busunitcode = t1.busunitcode
             LEFT JOIN tbl_users_global_assignment AS t5 
            ON t1.custodian = t5.uuid
            Where t1.deletestatus = 'Active' AND t3.sl_description LIKE :search GROUP BY t1.seq  ORDER BY t1.seq LIMIT $pageIndex, $pageData";

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
        $sqlselect = "SELECT COUNT(*) as exist FROM tbl_pcf_setup WHERE  busunitcode = :busunitcode AND sl_code = :slcode AND deletestatus = 'Active'";

        $stmtselect = $this->conn->prepare($sqlselect);

        // $stmtselect->bindValue(":custodian", $data["userid"], PDO::PARAM_STR);

        $stmtselect->bindValue(":busunitcode", $data["busunit"], PDO::PARAM_STR);
            $stmtselect->bindValue(":slcode", $data["slcode"], PDO::PARAM_STR);

        $stmtselect->execute();

        $result = $stmtselect->fetch(PDO::FETCH_ASSOC);

        if($result['exist'] != 1) {

            $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

            $shortUuid = $randomString;

            $shortUuid = "PCF-" . $shortUuid;

            $sql = "INSERT INTO tbl_pcf_setup (pcf_code,custodian, pcf_balance, pcf_description, sl_code, sl_description, deletestatus,busunitcode, usertracker, createdtime)
                    VALUES (:pcf_code, :custodian, :pcf_balance, :pcf_description, :sl_code, :sl_description, 'Active',:busunitcode, :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":pcf_code", $shortUuid, PDO::PARAM_STR);
            $stmt->bindValue(":custodian", $data["userid"], PDO::PARAM_STR);
            $stmt->bindValue(":pcf_balance", $data["pcfbalance"], PDO::PARAM_STR);
            $stmt->bindValue(":pcf_description", $data["pcfdesc"], PDO::PARAM_STR);
            $stmt->bindValue(":sl_code", $data["slcode"], PDO::PARAM_STR);
            $stmt->bindValue(":sl_description", $data["sldescription"], PDO::PARAM_STR);
            $stmt->bindValue(":busunitcode", $data["busunit"], PDO::PARAM_STR);
            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

           

            $glcode = substr($data["slcode"], 0, 3);
            $glcodebank = substr($data["slcodebank"], 0, 3);

            $sqlentry = "INSERT INTO tbl_accounting_transactions ()
            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) , DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) ,
            :glcodes, :slcodes, :amounts, :particular, 'N/A', 'AUTO', 'Posted', '', '', '', '' , '', '', 'PCF',
            :transtype, '/pcfsetup', :busunits, '', '', '0', :menutransactedref, 'Active' , :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmtentry = $this->conn->prepare($sqlentry);
            $stmtentry->bindValue(":glcodes", $glcode, PDO::PARAM_STR);
            $stmtentry->bindValue(":slcodes", $data["slcode"], PDO::PARAM_STR);
            $stmtentry->bindValue(":amounts", $data["pcfbalance"], PDO::PARAM_STR);
            // $stmtentry->bindValue(":sales_id", $data["reference"], PDO::PARAM_STR);
            // $stmtentry->bindValue(":dm_id", $data["cashtransid"], PDO::PARAM_STR);
            $stmtentry->bindValue(":transtype", "PETTY CASH", PDO::PARAM_STR);
            $stmtentry->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
            $stmtentry->bindValue(":particular", $data["particulars"], PDO::PARAM_STR);
            $stmtentry->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
            $stmtentry->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmtentry->execute();
            
            $stmtentry->bindValue(":glcodes", $glcodebank, PDO::PARAM_STR);
            $stmtentry->bindValue(":slcodes", $data["slcodebank"], PDO::PARAM_STR);
            $stmtentry->bindValue(":amounts", $data["pcfbalance"]  * -1, PDO::PARAM_STR);
            // $stmtentry->bindValue(":sales_id", $data["reference"], PDO::PARAM_STR);
            // $stmtentry->bindValue(":dm_id", $data["cashtransid"], PDO::PARAM_STR);
            $stmtentry->bindValue(":transtype", "PETTY CASH", PDO::PARAM_STR);
            $stmtentry->bindValue(":menutransactedref", $shortUuid, PDO::PARAM_STR);
            $stmtentry->bindValue(":particular", $data["particulars"], PDO::PARAM_STR);
            $stmtentry->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
            $stmtentry->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
            $stmtentry->execute();

            echo json_encode(["message" => "Success"]);
        } else {
            echo json_encode(["message" => "Account Exist"]);
        }
    }


    public function rejectpcfs($user_id, string $id)
    {

        $sql = "UPDATE tbl_pcf_setup

                SET

                    deletestatus = 'Inactive',

                    usertracker  = :usertracker

                WHERE

                      pcf_code  = :id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":id", $id, PDO::PARAM_STR);

        $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

    }

    public function editpcf($user_id, $id)
    {

        // $branchcode = $id["brand_code"];

        // $branchid = join($branchcode);

        $sql = "UPDATE tbl_pcf_setup

                SET

                    pcf_balance  = :pcf_balance,

                    pcf_description  = :pcf_description

                WHERE

                      custodian  = :userid";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":pcf_balance", $id["pcfbalance"], PDO::PARAM_STR);

        $stmt->bindValue(":pcf_description", $id["pcfdesc"], PDO::PARAM_STR);

        $stmt->bindValue(":userid", $id["userid"], PDO::PARAM_STR);

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
