<?php

class ExpensesGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllExpenses($data)
    {
        $sql = "SELECT * FROM tbl_expenses WHERE deletestatus = 'Active' AND DATE(datacreated) = :datacreated ORDER BY seq DESC";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":datacreated", $data['date'], PDO::PARAM_STR);
        $stmt->execute();
    
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
        echo json_encode($result);
    }

   public function insertExpenses($data) 
{
    $sql = "INSERT INTO tbl_expenses (
                seq, busunitcode, inv_number, expenses_desc, 
                expenses_amount, user, deletestatus, datacreated
            ) VALUES (
                :seq, :busunitcode, :inv_number, :expenses_desc, 
                :expenses_amount, :user, :deletestatus, 
                STR_TO_DATE(:datacreated, '%m/%d/%Y %h:%i:%s %p')
            )";

    $stmt = $this->conn->prepare($sql);

    foreach ($data['expenses'] as $expense) {
        $stmt->bindValue(":seq", $expense['seq'], PDO::PARAM_INT);
        $stmt->bindValue(":busunitcode", $expense['busunitcode'], PDO::PARAM_STR);
        $stmt->bindValue(":inv_number", $expense['inv_number'], PDO::PARAM_STR);
        $stmt->bindValue(":expenses_desc", $expense['expenses_desc'], PDO::PARAM_STR);
        $stmt->bindValue(":expenses_amount", $expense['expenses_amount'], PDO::PARAM_STR);
        $stmt->bindValue(":user", $expense['user'], PDO::PARAM_STR);
        $stmt->bindValue(":deletestatus", $expense['deletestatus'], PDO::PARAM_STR);
        $stmt->bindValue(":datacreated", $expense['datacreated'], PDO::PARAM_STR);

        $stmt->execute();
    }

    echo json_encode(["message" => "Expenses Inserted Successfully"]);
}


    

}
