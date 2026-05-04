<?php

class ProductBrandsGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {


        $sql = "SELECT * FROM lkp_product_brand 
                    WHERE deletestatus = 'Active' 
                    ORDER BY `brand_desc` ASC";

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


        // Check for duplicate entry
        $checkSQL = "SELECT COUNT(*) FROM lkp_product_brand 
                    WHERE brand_desc = :brandname 
                    AND deletestatus = 'Active'";

        $stmt = $this->conn->prepare($checkSQL);
        $stmt->bindValue(":brandname", $data["newbrand"]);
        $stmt->execute();

        if ($stmt->fetchColumn() > 0) {
            echo json_encode(["message" => "Duplicate"]);
            return;
        }

        $shortUuid = "BR-" . substr(bin2hex(random_bytes(6)), 0, 12);

        $sql = "INSERT INTO lkp_product_brand ()  
                VALUES    (default, :brandcode, :brand_desc, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":brandcode", $shortUuid, PDO::PARAM_STR);
        $stmt->bindValue(":brand_desc", strtoupper($data["newbrand"]), PDO::PARAM_STR);
        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);

        $stmt->execute();

        echo json_encode(["message" => "Success"]);

    }


    
}
