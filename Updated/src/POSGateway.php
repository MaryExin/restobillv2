<?php

class POSGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_pos Where deletestatus = 'Active' ORDER BY name ASC";

        $stmt = $this->conn->prepare($sql);

        $stmt->execute();

        $data = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            $data[] = $row;

        }

        return $data;

    }

    public function getInfiniteReadData($page, $pageIndex, $pageData, $search)
    {

       $sql = "SELECT T1.poscode, T1.name AS posname, T2.busunitcode, T2.name as busname
        FROM lkp_pos AS T1
        LEFT JOIN lkp_busunits AS T2
        ON T1.busunitcode  = T2.busunitcode 
        WHERE T1.deletestatus = 'Active' 
        AND T1.name LIKE :search 
        ORDER BY T1.seq 
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

    public function createPOS($user_id, $data)
    {
        $randomString = substr(bin2hex(random_bytes(6)), 0, 12);
        $shortUuid = "POS-" . $randomString;

        $sql = "INSERT INTO lkp_pos ()
        VALUES (default, :shortUuid, :busunitcode, :posname, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
            
        $stmt->bindValue(":posname", $data["posname"]);
            
        $stmt->bindValue(":shortUuid", $shortUuid);

        $stmt->bindValue(":user_tracker", $user_id);

        $stmt->execute();
        
        echo json_encode(["message" => "Success"]);
           
    }

    public function editPOS($user_id, $data)
    {

        $sql = "UPDATE lkp_pos SET name = :posname
        WHERE poscode = :poscode";
     

        $stmt = $this->conn->prepare($sql);
            
        $stmt->bindValue(":posname", $data["posname"]);
            
        $stmt->bindValue(":poscode", $data["poscode"]);

        $stmt->execute();
        
        echo json_encode(["message" => "Success"]);
           
    }

    public function deletePOS($user_id, $data)
    {
        

       $sql = "UPDATE lkp_pos set deletestatus = 'Inactive'
       WHERE poscode = :poscode";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":poscode", $data["poscode"]);
            
        $stmt->execute();
        
        echo json_encode(["message" => "Success"]);
           
    }


}
