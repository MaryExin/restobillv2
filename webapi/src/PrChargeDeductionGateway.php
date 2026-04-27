<?php

class PrChargeDeductionGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function viewDeductions($user_id, $data)
    {
        $sql = "SELECT * FROM tbl_pr_charge_deduction WHERE transaction_id = :transaction_id";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":transaction_id", $data["transaction_id"], PDO::PARAM_INT);

        $stmt->execute();

        $datas = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $datas[] = $row;

        }

        echo json_encode($datas);
    }

    public function insertDeductions($user_id, $data)
    {
        try {
        
            $this->conn->beginTransaction();

            $this->conn->exec("SET time_zone = 'Asia/Manila'");

            $sql = "DELETE FROM tbl_pr_charge_deduction
            WHERE transaction_id = :transaction_id";
            $stmt = $this->conn->prepare($sql);

            foreach ($data["DeductionsData"] as $Deductions) {
            
            $stmt->bindValue(":transaction_id", $Deductions["transaction_id"], PDO::PARAM_STR);
            
            $stmt->execute();
            }


            $sql = "INSERT INTO tbl_pr_charge_deduction () 
                VALUES (default, :transaction_id, :particulars, :amount, 'Active', :usertracker, CURRENT_TIMESTAMP())";

            $stmt = $this->conn->prepare($sql);

            foreach ($data["DeductionsData"] as $Deductions) {
            
            $stmt->bindValue(":transaction_id", $Deductions["transaction_id"], PDO::PARAM_STR);
            
            $stmt->bindValue(":particulars", $Deductions["particulars"], PDO::PARAM_STR);
            
            $stmt->bindValue(":amount", $Deductions["amount"], PDO::PARAM_STR);
            
            $stmt->bindValue(":usertracker", $user_id);

            $stmt->execute();
        }
          
            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {
        
            $this->conn->rollBack();

        echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

    public function updateDeductions($user_id, $data)
    {
        try {
        
            $this->conn->beginTransaction();
          
            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {
        
            $this->conn->rollBack();

        echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

    public function deleteDeductions($user_id, $data)
    {
        
    }



    
}
