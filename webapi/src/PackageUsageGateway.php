<?php

class PackageUsageGateway
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

    public function getDatabyProduct($user_id, $data)
    {
        $sql = "SELECT 
            bc.*, 
            SUM(it.qty) AS stock, 
            rm.desc, rm.uomval, rm.uom, pd.cost_per_uom,
            (SELECT SUM(it2.qty) 
             FROM tbl_inventory_transactions AS it2 
             WHERE it2.inv_code = bc.build_code AND it2.busunitcode = :busUnits) AS main_product_stock
        FROM tbl_build_components AS bc
        LEFT JOIN tbl_inventory_transactions AS it ON bc.component_code = it.inv_code
        LEFT JOIN lkp_raw_mats AS rm ON bc.component_code = rm.mat_code
        LEFT JOIN tbl_pricing_details AS pd ON bc.component_code = pd.inv_code
        WHERE bc.build_code = :build_codes 
        AND bc.deletestatus = 'Active'
        GROUP BY bc.component_code";

$stmt = $this->conn->prepare($sql);
$stmt->bindValue(":build_codes", $data["build_code"], PDO::PARAM_STR);
$stmt->bindValue(":busUnits", $data["busUnit"], PDO::PARAM_STR);
$stmt->execute();
$data = [];

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $data[] = $row;
}

echo json_encode($data);

    }

    public function createPOS($user_id, $data)
    {

        $sql = "INSERT INTO tbl_inventory_transactions ()
            VALUES (default, DATE(DATE_ADD(NOW(), INTERVAL 8 HOUR)),:inv_code, :qty, :cost_per_uom, :uom_val, :uom,
            :pr_queue_code, :busunitcode, :inv_class, '', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $stmt = $this->conn->prepare($sql);
            // Post Components for Inventory Transactions
            foreach ($data["components"] as $component) {
                $stmt->bindValue(":inv_code", $component["component_code"], PDO::PARAM_STR);
                $stmt->bindValue(":qty", $component["qty"] * $data["quantity"] , PDO::PARAM_STR);
                $stmt->bindValue(":cost_per_uom", $component["cost_per_uom"], PDO::PARAM_STR);
                $stmt->bindValue(":uom_val", $component["uomval"], PDO::PARAM_STR);
                $stmt->bindValue(":uom", $component["uom"], PDO::PARAM_STR);
                $stmt->bindValue(":pr_queue_code", "Package Usage", PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $data["busUnit"], PDO::PARAM_STR);
                $stmt->bindValue(":inv_class", $component["component_class"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
            }

            $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":inv_code", $data["component_code"], PDO::PARAM_STR);
                $stmt->bindValue(":qty", $data["quantity"] * -1 , PDO::PARAM_STR);
                $stmt->bindValue(":cost_per_uom", $data["cost_per_uom"], PDO::PARAM_STR);
                $stmt->bindValue(":uom_val", $data["uomval"], PDO::PARAM_STR);
                $stmt->bindValue(":uom", $data["uom"], PDO::PARAM_STR);
                $stmt->bindValue(":pr_queue_code", "Package Usage", PDO::PARAM_STR);
                $stmt->bindValue(":busunitcode", $data["busUnit"], PDO::PARAM_STR);
                $stmt->bindValue(":inv_class", "FG", PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
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
