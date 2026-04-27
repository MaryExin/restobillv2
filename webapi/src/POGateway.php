<?php

class POGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {   

        $sql = "SELECT * FROM tbl_po_non_inventory WHERE deletestatus = 'Active'";
        
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

       $sql = "SELECT 
            *
        FROM tbl_po_non_inventory AS T1
        LEFT JOIN tbl_po_non_inventory_item AS T2
        ON T1.uuid = T2.uuid 
        WHERE T1.deletestatus = 'Active' 
        ORDER BY T2.seq 
        LIMIT $pageIndex, $pageData";

$stmt = $this->conn->prepare($sql);
$stmt->execute();

$data = [];
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $uuid = $row['uuid'];

    if (!isset($data[$uuid])) {
        $data[$uuid] = [
            'po_data' => [
                'uuid' => $row['uuid'],
                'po_no' => $row['po_no'],
                'busunitcode' => $row['busunitcode'], 
                'date' => $row['date'], 
                'supplier_name' => $row['supplier_name'], 
                'supplier_address' => $row['supplier_address'], 
                'supplier_email' => $row['supplier_email'], 
                'contact_person' => $row['contact_person'], 
                'contact_no' => $row['contact_no'], 
                'fax_no' => $row['fax_no'], 
                'tax' => $row['tax'], 
                'delivery_date' => $row['delivery_date'], 
                'delivery_address' => $row['delivery_address'], 
                'term_of_service' => $row['term_of_service'], 
                'payment_term' => $row['payment_term'], 
                'shipping' => $row['shipping'], 
                'status' => $row['status'], 
            ],
            'items' => [] 
        ];
    }


    if (!empty($row['item_description'])) { 
        $data[$uuid]['items'][] = [
            'seq' => $row['seq'], 
            'category' => $row['category'], 
            'item_description' => $row['item_description'],
                        'qty_hours' => $row['qty_hours'], 
            'unit_price' => $row['unit_price'] 
        ];
    }
}

$response = [
    'items' => array_values($data), 
    'nextPage' => $page + 1,
];

return $response;


    }  

    public function getProducts($user_id, $data)
    {   
        
        $sql = "SELECT * FROM tbl_po_non_inventory WHERE uuid = :uuid";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":uuid", $data["uuid"]); 
        $stmt->execute();

        $poData = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$poData) {
            echo json_encode(["error" => "No data found"], JSON_PRETTY_PRINT);
            return;
        }

      
        $sql = "SELECT * FROM tbl_po_non_inventory_item WHERE uuid = :uuid";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":uuid", $data["uuid"]);
        $stmt->execute();

        $poItems = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $poItems[] = $row;
        }

        
        $poData["poData"] = $poItems;

      
        echo json_encode($poData, JSON_PRETTY_PRINT);
    }


    public function insertPO($user_id, $data)
    {
        try {

            $this->conn->beginTransaction();

            $this->conn->exec("SET time_zone = 'Asia/Manila'");

            $randomUuid = bin2hex(random_bytes(16)); 

            $yearMonthDay = date("Ymd"); 

            $sql = "SELECT prd_queue_code FROM tbl_products_queue_summary 
                    WHERE prd_queue_code REGEXP '^[0-9]{8}[0-9]{6}$' 
                    ORDER BY prd_queue_code DESC LIMIT 1";

            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            $sequence = 1;

            if (!empty($result['prd_queue_code'])) {
                $lastCode = $result['prd_queue_code'];
            
   
                if (preg_match('/^\d{8}(\d{6})$/', $lastCode, $matches)) {
                    $lastSequence = intval($matches[1]);
                    $sequence = $lastSequence + 1;
                }
            }

            $formattedSequence = str_pad($sequence, 6, '0', STR_PAD_LEFT);
            $newPrdQueueCode = $yearMonthDay . $formattedSequence; 

            if($data["po_no"] === ""){
                $poId = $newPrdQueueCode;
            }
            else{
                $poId = $data["po_no"];
            }

            $sql = "INSERT INTO tbl_po_non_inventory ()
                VALUES (default, :uuid, :po_no, :busunitcodes, :date, :supplier_name, :supplier_address, :supplier_email,
                :contact_person, :contact_no, :fax_no, :tax, :delivery_date, :delivery_address,
                :term_of_service, :payment_term, :shipping, 'Pending', 'Active', :user_tracker, CURRENT_TIMESTAMP)";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":uuid", $randomUuid, PDO::PARAM_STR);
                $stmt->bindValue(":po_no", $poId, PDO::PARAM_STR);
                $stmt->bindValue(":busunitcodes", $data["busUnitTransacted"], PDO::PARAM_STR);
                $stmt->bindValue(":date", $data["date"], PDO::PARAM_STR);
                $stmt->bindValue(":supplier_name", $data["supplier_name"], PDO::PARAM_STR);
                $stmt->bindValue(":supplier_address", $data["supplier_address"], PDO::PARAM_STR);
                $stmt->bindValue(":supplier_email", $data["supplier_email"], PDO::PARAM_STR);
                $stmt->bindValue(":contact_person", $data["contact_person"], PDO::PARAM_STR);
                $stmt->bindValue(":contact_no", $data["contact_no"], PDO::PARAM_STR);
                $stmt->bindValue(":fax_no", $data["fax_no"], PDO::PARAM_STR);
                $stmt->bindValue(":tax", $data["tax"], PDO::PARAM_STR);
                $stmt->bindValue(":delivery_date", $data["delivery_date"], PDO::PARAM_STR);
                $stmt->bindValue(":delivery_address", $data["delivery_address"], PDO::PARAM_STR);
                $stmt->bindValue(":term_of_service", $data["term_of_service"], PDO::PARAM_STR);
                $stmt->bindValue(":payment_term", $data["payment_term"], PDO::PARAM_STR);
                $stmt->bindValue(":shipping", $data["shipping"], PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();

    
                foreach ($data["poData"] as $po) 
                {
                    $sql = "INSERT INTO tbl_po_non_inventory_item ()
                            VALUES (default, :uuid, :item_description, :category, :qty_hours, :unit_price, 'Active', :user_tracker, CURRENT_TIMESTAMP)";
                
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":uuid", $randomUuid);
                    $stmt->bindValue(":item_description", $po["item_description"]);
                    $stmt->bindValue(":category", $po["category"]);
                    $stmt->bindValue(":qty_hours", $po["qty_hours"]);
                    $stmt->bindValue(":unit_price", $po["unit_price"]);
                    $stmt->bindValue(":user_tracker", $user_id);
                    $stmt->execute();
                }
                

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);

            } catch (PDOException $e) {

            $this->conn->rollBack();
    
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }


    public function updatePO($user_id, $data)
    {
        try {

            $this->conn->beginTransaction();

            $this->conn->exec("SET time_zone = 'Asia/Manila'");

            $sql = "UPDATE tbl_po_non_inventory 
            SET po_no = :po_no, 
            date = :date, 
            supplier_name = :supplier_name, 
            supplier_address = :supplier_address, 
            supplier_email = :supplier_email, 
            contact_person = :contact_person, 
            contact_no = :contact_no, 
            fax_no = :fax_no, 
            tax = :tax, 
            delivery_date = :delivery_date, 
            delivery_address = :delivery_address, 
            term_of_service = :term_of_service, 
            payment_term = :payment_term, 
            shipping = :shipping,  
            usertracker = :user_tracker
            WHERE uuid = :uuid";

        $stmt = $this->conn->prepare($sql);

        $stmt->bindValue(":po_no", $data["po_no"]);
        $stmt->bindValue(":date", $data["date"]);
        $stmt->bindValue(":supplier_name", $data["supplier_name"]);
        $stmt->bindValue(":supplier_address", $data["supplier_address"]);
        $stmt->bindValue(":supplier_email", $data["supplier_email"]);
        $stmt->bindValue(":contact_person", $data["contact_person"]);
        $stmt->bindValue(":contact_no", $data["contact_no"]);
        $stmt->bindValue(":fax_no", $data["fax_no"]);
        $stmt->bindValue(":tax", $data["tax"]);
        $stmt->bindValue(":delivery_date", $data["delivery_date"]);
        $stmt->bindValue(":delivery_address", $data["delivery_address"]);
        $stmt->bindValue(":term_of_service", $data["term_of_service"]);
        $stmt->bindValue(":payment_term", $data["payment_term"]);
        $stmt->bindValue(":shipping", $data["shipping"]);
        $stmt->bindValue(":user_tracker", $user_id);
        $stmt->bindValue(":uuid", $data["uuid"]);
        $stmt->execute();
        
        $sql = "DELETE FROM tbl_po_non_inventory_item WHERE uuid = :uuid";

        $stmt = $this->conn->prepare($sql);
        
        $stmt->bindValue(":uuid", $data["uuid"]);
        
        $stmt->execute();

                foreach ($data["poData"] as $po) 
                {
                    $sql = "INSERT INTO tbl_po_non_inventory_item ()
                            VALUES (default, :uuid, :item_description, :category, :qty_hours, :unit_price, 'Active', :user_tracker, CURRENT_TIMESTAMP)";
                
                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":uuid", $data["uuid"]);
                    $stmt->bindValue(":item_description", $po["item_description"]);
                    $stmt->bindValue(":category", $po["category"]);
                    $stmt->bindValue(":qty_hours", $po["qty_hours"]);
                    $stmt->bindValue(":unit_price", $po["unit_price"]);
                    $stmt->bindValue(":user_tracker", $user_id);
                    $stmt->execute();
                }
                

            $this->conn->commit();

            echo json_encode(["message" => "Edited"]);

            } catch (PDOException $e) {

            $this->conn->rollBack();
    
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

    public function deletePO($user_id, $data)
    {
        try {

            $this->conn->beginTransaction();

            $sql = "UPDATE tbl_po_non_inventory SET deletestatus = 'Inactive' WHERE uuid = :uuid";
            
            $stmt = $this->conn->prepare($sql);
            
            $stmt->bindValue(":uuid", $data["uuid"]);
            
            $stmt->execute();

            $sql = "UPDATE tbl_po_non_inventory_item SET deletestatus = 'Inactive' WHERE uuid = :uuid";
            
            $stmt = $this->conn->prepare($sql);
            
            $stmt->bindValue(":uuid", $data["uuid"]);
            
            $stmt->execute();
            
            $this->conn->commit();

            echo json_encode(["message" => "Deleted"]);

            } catch (PDOException $e) {

            $this->conn->rollBack();
    
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }



}
