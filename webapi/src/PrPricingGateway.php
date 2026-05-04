<?php

class PrPricingGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_pr_pricing_by_dropdown WHERE  deletestatus = 'Active'";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC); 


        return $data;

    }

 


    public function editForUser($user_id, $data)
    {
        

        $sql = "UPDATE lkp_pr_pricing_by_dropdown
        SET
          pr_pricing_status = :prpricingstatus,
          deletestatus         = 'Active',
          usertracker          = :user_tracker,
          createdtime          = DATE_ADD(NOW(), INTERVAL 8 HOUR)
          WHERE seq = 1";
  

        $stmt = $this->conn->prepare($sql);


        $stmt->bindValue(":prpricingstatus", $data["status"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();


        echo json_encode(["message" => "Success"]);
  
    }

    
}
