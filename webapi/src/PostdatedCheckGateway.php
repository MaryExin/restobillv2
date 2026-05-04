<?php

class PostdatedCheckGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getPostdatedCheckData($data)
    {
                $sql = "SELECT 
                            t1.transdate,
                            t1.document_date AS checkdate,
                            t1.busunitcode,
                            t1.slcode,
                            ABS(SUM(t1.amount)) AS amount,
                            t1.supplier_code,
                            t1.menutransactedref,
                            t1.transactiontype,
                            t1.transactionclass,
                            t2.payment_reference,
                            t2.sl_description,
                            t2.sl_code AS clearing_code
                        FROM
                            tbl_accounting_transactions AS t1
                                LEFT OUTER JOIN
                            (SELECT 
                                tbl_disbursements_clearing.payment_reference,
                                    tbl_disbursements_clearing.sl_description,
                                    tbl_disbursements_clearing.sl_code,
                                    tbl_disbursement_check.check_id
                            FROM
                                tbl_disbursements_clearing
                            LEFT OUTER JOIN tbl_disbursement_check ON tbl_disbursements_clearing.disbursement_reference = tbl_disbursement_check.disbursement_id
                                AND tbl_disbursement_check.deletestatus = 'Active'
                            WHERE
                                tbl_disbursements_clearing.deletestatus = 'Active'
                                AND payment_type = 'POSTDATED CHECK') t2 ON t1.menutransactedref = t2.check_id
                        WHERE
                            t1.slcode = 40098
                                AND t1.approvalstatus = 'Posted'
                                AND t1.deletestatus = 'Active'
                                AND t1.busunitcode = :busunitcode
                                AND t1.document_date BETWEEN :dateFrom AND :dateTo
                        GROUP BY t1.menutransactedref , t1.slcode
                        ORDER BY t1.document_date DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(':busunitcode',   $data["busunitcode"], \PDO::PARAM_STR);
        $stmt->bindValue(':dateFrom',      $data["datefrom"],   \PDO::PARAM_STR);
        $stmt->bindValue(':dateTo',     $data["dateto"],  \PDO::PARAM_STR);

        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function clearPdcSelected($user_id, $data)
    {
        try {
            //Post to Clearing

            $this->conn->beginTransaction();
            
           //Debit

            $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
               :documentdate , :glcode, :slcode, :amount, :particulars, :reference, 'Auto', 'Posted', 
                null, :payee_code, null, null, null, null, 'Payments', 'Payments', '/disbursements', :busunitcode,
                'NA', 'NA', 0, :menutransactedref,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";


            $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":documentdate", $data["documentdate"], PDO::PARAM_STR);
                $stmt->bindValue(":glcode", substr($data["slcode"], 0, 3), PDO::PARAM_STR);
                $stmt->bindValue(":slcode", $data["slcode"], PDO::PARAM_STR);
                $stmt->bindValue(":amount", $data["amounttoclear"], PDO::PARAM_STR);
                $stmt->bindValue(":particulars", "Clearing of PDC", PDO::PARAM_STR);
                $stmt->bindValue(":reference", $data["payment_reference"], PDO::PARAM_STR);
                $stmt->bindValue(":payee_code", $data["suppliercode"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                $stmt->bindValue(":menutransactedref", $data["menutransactedref"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
         
            
            $stmt->execute();

                
            //Credit

            $sql = "INSERT INTO tbl_accounting_transactions () VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),
               :documentdate , :glcode, :slcode, :amount, :particulars, :reference, 'Auto', 'Posted', 
                null, :payee_code, null, null, null, null, 'Payments', 'Payments', '/disbursements', :busunitcode,
                'NA', 'NA', 0, :menutransactedref,
                'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";


            $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":documentdate", $data["documentdate"], PDO::PARAM_STR);
                $stmt->bindValue(":glcode", substr($data["clearing_code"], 0, 3), PDO::PARAM_STR);
                $stmt->bindValue(":slcode", $data["clearing_code"], PDO::PARAM_STR);
                $stmt->bindValue(":amount", $data["amounttoclear"] * -1, PDO::PARAM_STR);
                $stmt->bindValue(":particulars", "Clearing of PDC", PDO::PARAM_STR);
                $stmt->bindValue(":reference", $data["payment_reference"], PDO::PARAM_STR);
                $stmt->bindValue(":payee_code", $data["suppliercode"], PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
                $stmt->bindValue(":menutransactedref", $data["menutransactedref"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
         
            
            $stmt->execute();


            $this->conn->commit();
            
            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }







    }
}
