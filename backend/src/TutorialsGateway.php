<?php

class TutorialsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getClearingItems($data)
    {

        $sql = "SELECT

                        tbl_disbursements.seq,

                        tbl_main.reference,

                        tbl_main.sl_code,

                        ROUND(SUM(tbl_main.total_amount), 2) AS amount,

                        tbl_disbursements.transdate,

                        tbl_disbursements.particulars,

                        tbl_disbursements.document_ref,

                        tbl_disbursements.payee_code,

                        tbl_disbursements.busunitcode,

                        lkp_supplier.supplier_name,

                        DATEDIFF(DATE_ADD(NOW(),INTERVAL 8 HOUR), tbl_disbursements.transdate) AS days_since_transdate

                    FROM

                        (SELECT

                            tbl_disbursements.reference,

                            tbl_disbursements.sl_code,

                            tbl_disbursements.amount AS total_amount

                        FROM

                            tbl_disbursements

                        WHERE

                            tbl_disbursements.sl_code = 49901

                            AND tbl_disbursements.deletestatus = 'Active'

                        UNION

                        SELECT

                            tbl_disbursements_clearing.disbursement_reference,

                            '49901',

                            tbl_disbursements_clearing.amount_cleared * - 1 AS total_amount

                        FROM

                            tbl_disbursements_clearing

                        WHERE

                            tbl_disbursements_clearing.deletestatus = 'Active') tbl_main

                    LEFT OUTER JOIN

                        tbl_disbursements ON tbl_main.reference = tbl_disbursements.reference

                        AND tbl_main.sl_code = tbl_disbursements.sl_code

                    LEFT OUTER JOIN

                        lkp_supplier ON tbl_disbursements.payee_code = lkp_supplier.supplier_code

                    WHERE

                        tbl_disbursements.busunitcode = :busunitcode

                    GROUP BY

                        tbl_main.reference

                    HAVING

                        ROUND(SUM(tbl_main.total_amount), 2) > 0

                    ORDER BY tbl_disbursements.seq DESC";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {

        $sql = "SELECT * FROM tbl_tutorials
            WHERE question LIKE :search
            ORDER BY sorting ASC
            LIMIT $pageIndex, $pageData";

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

        $sql = "SELECT  DISTINCT

            tbl_disbursements_clearing.disbursement_reference, tbl_disbursements_clearing.transdate, tbl_disbursements_clearing.amount_cleared,

            tbl_disbursements_clearing.payment_reference, tbl_disbursements_clearing.payment_type, tbl_disbursements_clearing.payment_date,

            tbl_disbursements_clearing.sl_code, tbl_disbursements_clearing.sl_description, tbl_disbursements_clearing.particulars,

            tbl_disbursements.payment_status

            FROM tbl_disbursements_clearing

            LEFT OUTER JOIN tbl_disbursements ON  tbl_disbursements_clearing.disbursement_reference = tbl_disbursements.reference

            WHERE tbl_disbursements_clearing.deletestatus = 'Active'

            AND tbl_disbursements.payment_status <> 'Paid'";

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

        $sql = "SELECT * FROM lkp_raw_mats ORDER BY seq LIMIT $pageIndex, $pageData";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function createForUser($user_id, $data)
    {

        try {

            //Post to Delivery Assignment

            $this->conn->beginTransaction();

            $randomString = substr(bin2hex(random_bytes(6)), 0, 12);

            $shortUuid = $randomString;

            $shortUuid = "DB-" . $shortUuid;

            $sql = "INSERT INTO tbl_disbursements () VALUES (default, :reference, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),

                :invoicedate,:slCode, :slDescription, :amount, :particulars, :payee_code, :busunitcode,

                 :payment_status, :document_ref,'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["disbursements"] as $disbursement) {

                $stmt->bindValue(":reference", $shortUuid, PDO::PARAM_STR);

                $stmt->bindValue(":invoicedate", $disbursement["invoicedate"], PDO::PARAM_STR);

                $stmt->bindValue(":slCode", $disbursement["slCode"], PDO::PARAM_STR);

                $stmt->bindValue(":slDescription", $disbursement["slDescription"], PDO::PARAM_STR);

                $stmt->bindValue(":amount", $disbursement["amount"], PDO::PARAM_STR);

                $stmt->bindValue(":particulars", $disbursement["particulars"], PDO::PARAM_STR);

                $stmt->bindValue(":payee_code", $disbursement["payeeCode"], PDO::PARAM_STR);

                $stmt->bindValue(":busunitcode", $disbursement["busUnitCode"], PDO::PARAM_STR);

                $stmt->bindValue(":payment_status", $disbursement["paymentStatus"], PDO::PARAM_STR);

                $stmt->bindValue(":document_ref", $disbursement["documentref"], PDO::PARAM_STR);

                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

                $stmt->execute();

            }

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

    public function clearForUser($user_id, $data)
    {

        try {

            //Post to Clearing

            $this->conn->beginTransaction();

            $sql = "INSERT INTO tbl_disbursements_clearing () VALUES (default, :disbursement_reference,

                DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)), :amount, :payment_reference, :payment_type,

                 :payment_date, :slCode, :slDescription, :particulars,

                 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":disbursement_reference", $data["disbursementReference"], PDO::PARAM_STR);

            $stmt->bindValue(":amount", $data["amount"], PDO::PARAM_STR);

            $stmt->bindValue(":payment_reference", $data["payment_reference"], PDO::PARAM_STR);

            $stmt->bindValue(":payment_type", $data["payment_type"], PDO::PARAM_STR);

            $stmt->bindValue(":payment_date", $data["payment_date"], PDO::PARAM_STR);

            $stmt->bindValue(":slCode", $data["slCode"], PDO::PARAM_STR);

            $stmt->bindValue(":slDescription", $data["slDescription"], PDO::PARAM_STR);

            $stmt->bindValue(":particulars", $data["particulars"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            // Update Status

            $sql = "UPDATE tbl_disbursements SET payment_status = :status,

            usertracker = :user_tracker

             WHERE

                reference = :reference";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindValue(":status", $data["status"], PDO::PARAM_STR);

            $stmt->bindValue(":reference", $data["disbursementReference"], PDO::PARAM_STR);

            $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

            $stmt->execute();

            // Finalize

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);

        }

    }

}
