<?php

class TransactiontypesetupGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_transactiontype Where deletestatus = 'Active' ORDER BY transaction_name ASC";

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
        $randomString = substr(bin2hex(random_bytes(6)), 0, 12);
        $shortUuid = "FAC-" . $randomString;

            
            $sql = "SELECT COUNT(*) as count FROM lkp_transactiontype Where transaction_name = :className AND  module = :module";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":className", $data["className"]);
            $stmt->bindValue(":module", $data["module"]);
            $stmt->execute();

           $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $count = $result['count'] ?? 0;

            if($count == 0){
            $sql = "INSERT INTO lkp_transactiontype ()
                    VALUES (default, :shortUuid, :className, :module,'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);
            
            $stmt->bindValue(":className", $data["className"]);
            $stmt->bindValue(":module", $data["module"]);
            
            $stmt->bindValue(":shortUuid", $shortUuid);

            $stmt->bindValue(":user_tracker", $user_id);
            
            $stmt->execute();
            
            echo json_encode(["message" => "Success"]);
            }else{
                echo json_encode(["message" => "Failed"]);
            }
         
            
           
    }




}
