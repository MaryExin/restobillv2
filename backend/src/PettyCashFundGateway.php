<?php

class PettyCashFundGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }
    public function getcustodian(){
        try {

            $sql = "SELECT * FROM lkp_chart_of_accounts Where glCode = '101' AND deletestatus = 'Active' ORDER BY seq";

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
    public function getAllData()
    {

        try {

            $sql = "SELECT * FROM lkp_brands Where deletestatus = 'Active' ORDER BY seq";

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

    public function getPCFDataToday($user_id, $data): array
    {

        $sql = "SELECT DISTINCT tbl_pcf.seq, tbl_pcf.gl_code,  tbl_pcf.sl_code, tbl_pcf.reference, tbl_pcf.particulars,
            tbl_pcf.amount, tbl_pcf.cash_trans_id, GL.gl_description,
            SL.sl_description
            FROM tbl_pcf
            LEFT OUTER JOIN lkp_chart_of_accounts AS GL ON tbl_pcf.gl_code = GL.glcode
            LEFT OUTER JOIN lkp_chart_of_accounts AS SL ON tbl_pcf.sl_code = SL.slcode
            WHERE tbl_pcf.deletestatus = 'Active'
            AND cash_trans_id = :cashtransid
            ORDER BY tbl_pcf.seq DESC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":cashtransid", $data["cashtransid"], PDO::PARAM_INT);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

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

        $sql = "INSERT INTO tbl_pcf () VALUES (default, :glcode, :slcode, :reference, :particulars,
            :amount, :cashtransid, :user_tracker, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":glcode", $data["glcode"], PDO::PARAM_STR);
        $stmt->bindValue(":slcode", $data["slcode"], PDO::PARAM_STR);
        $stmt->bindValue(":reference", $data["reference"], PDO::PARAM_STR);
        $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);
        $stmt->bindValue(":amount", $data["amount"], PDO::PARAM_STR);
        $stmt->bindValue(":cashtransid", $data["cashtransid"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        $sqlentry = "INSERT INTO tbl_accounting_transactions ()

            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) , DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)) ,
            :glcodes, :slcodes, :amounts, :particular, :sales_id, 'AUTO', 'Posted', '', '', '', '' , '', '', 'SALES',
            :transtype, '/salestracker', :busunits, '', '', '0', :dm_id, 'Active' , :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmtentry = $this->conn->prepare($sqlentry);
        $stmtentry->bindValue(":glcodes", $data["glcode"], PDO::PARAM_STR);
        $stmtentry->bindValue(":slcodes", $data["slcode"], PDO::PARAM_STR);
        $stmtentry->bindValue(":amounts", $data["amount"], PDO::PARAM_STR);
        $stmtentry->bindValue(":sales_id", $data["reference"], PDO::PARAM_STR);
        $stmtentry->bindValue(":dm_id", $data["cashtransid"], PDO::PARAM_STR);
        $stmtentry->bindValue(":transtype", "PETTY CASH", PDO::PARAM_STR);
        $stmtentry->bindValue(":particular", $data["particulars"], PDO::PARAM_STR);
        $stmtentry->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
        $stmtentry->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmtentry->execute();

        $stmtentry->bindValue(":glcodes", "100", PDO::PARAM_STR);
        $stmtentry->bindValue(":slcodes", "10038", PDO::PARAM_STR);
        $stmtentry->bindValue(":amounts", $data["amount"]  * -1, PDO::PARAM_STR);
        $stmtentry->bindValue(":sales_id", $data["reference"], PDO::PARAM_STR);
        $stmtentry->bindValue(":dm_id", $data["cashtransid"], PDO::PARAM_STR);
        $stmtentry->bindValue(":transtype", "PETTY CASH", PDO::PARAM_STR);
        $stmtentry->bindValue(":particular", $data["particulars"], PDO::PARAM_STR);
        $stmtentry->bindValue(":busunits", $data["busunit"], PDO::PARAM_STR);
        $stmtentry->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmtentry->execute();

        echo json_encode(["message" => "Success"]);

    }

    public function deletePCFItem($user_id, $data)
    {
        $sql = "UPDATE tbl_pcf  SET deletestatus = 'Inactive',
        usertracker = :user_tracker
        WHERE seq = :seq;";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":seq", $data["id"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        return $stmt->rowCount();

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
