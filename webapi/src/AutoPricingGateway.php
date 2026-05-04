<?php

class AutoPricingGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_auto_pricing WHERE  deletestatus = 'Active'";
        
        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC); 


        return $data;

    }

 


    public function editForUser($user_id, $data)
    {
        

        $sql = "UPDATE lkp_auto_pricing
        SET
          auto_pricing_status = :autopricingstatus,
          deletestatus         = 'Active',
          usertracker          = :user_tracker,
          createdtime          = DATE_ADD(NOW(), INTERVAL 8 HOUR)
          WHERE seq = 1";
  

        $stmt = $this->conn->prepare($sql);


        $stmt->bindValue(":autopricingstatus", $data["status"], PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
        $stmt->execute();


        echo json_encode(["message" => "Success"]);
  
    }

    
}
