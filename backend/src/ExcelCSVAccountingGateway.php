<?php

class ExcelCSVAccountingGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData($menutransacted,$busunit,$dateFrom,$dateTo)
    {

        // try {
            // $menutransactedtype = '';
            // if($menutransacted == 'journalvoucher' ){
            //     $menutransactedtype = '/journalvoucher';
            // }
            $sql = "SELECT * FROM tbl_accounting_transactions Where deletestatus = 'Active'
             AND menutransacted = :menutransacted AND busunitcode = :busunit
             AND transdate BETWEEN  :datefrom AND :dateto
            ";
           
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":menutransacted", $menutransacted, PDO::PARAM_STR);
            $stmt->bindValue(":busunit", $busunit, PDO::PARAM_STR);
            $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);
            $stmt->bindValue(":dateto",  $dateTo, PDO::PARAM_STR);
            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        // } catch (Exception $e) {

        //     echo json_encode(["message" => "Registration error"]);

        //     exit;

        // }

    }
     public function getAllDatapetty($menutransacted,$busunit, $custodian,$dateFrom,$dateTo)
    {

        // try {
            // $menutransactedtype = '';
            // if($menutransacted == 'journalvoucher' ){
            //     $menutransactedtype = '/journalvoucher';
            // }
            $sql = "SELECT * FROM tbl_accounting_transactions Where deletestatus = 'Active'
             AND menutransacted = :menutransacted AND busunitcode = :busunit
             AND transdate BETWEEN  :datefrom AND :dateto
            ";
           
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":menutransacted", $menutransacted, PDO::PARAM_STR);
            $stmt->bindValue(":busunit", $busunit, PDO::PARAM_STR);
            $stmt->bindValue(":custodian", $custodian, PDO::PARAM_STR);
            $stmt->bindValue(":datefrom", $dateFrom, PDO::PARAM_STR);
            $stmt->bindValue(":dateto",  $dateTo, PDO::PARAM_STR);
            $stmt->execute();

            $data = [];

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

                $data[] = $row;

            }

            return $data;

        // } catch (Exception $e) {

        //     echo json_encode(["message" => "Registration error"]);

        //     exit;

        // }

    }
    
 

    

   

}
