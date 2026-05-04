<?php

class SLCodeGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getslCode($data)
    {
        try{
        
        $sql = "SELECT * FROM lkp_chart_of_accounts WHERE glcode = :glcode";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':glcode', $data['glcode']);

        $stmt->execute();

        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $result;  
        
        }catch (PDOException $e) {
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

    public function paramsSlCode($user_id, $data)
    {
 
           
            $this->conn->beginTransaction();

            try{

            $sql = "SELECT glcode, gl_description, slcode, sl_description FROM lkp_chart_of_accounts WHERE glcode = :glcode";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':glcode', $data['glcode']);
            $stmt->execute();
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($result);
        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

}

