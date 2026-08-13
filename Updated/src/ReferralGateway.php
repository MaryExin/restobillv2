<?php

class ReferralGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function getInfiniteData($page, $pageIndex, $pageData, $search)
    {
        $sql = "SELECT seq, partnerid, firstname, middlename, lastname, tin, contactno, email,
                address    
         FROM tbl_referral WHERE
                deletestatus = 'Active'
                ORDER BY seq DESC
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

    public function getAllReferral()
    {
        try {
                $this->conn->beginTransaction();


                $checksql = "SELECT * FROM tbl_referral";

                $checkstmt = $this->conn->prepare($checksql);

                $checkstmt->execute();

                $result = $checkstmt->fetchAll(PDO::FETCH_ASSOC);

                return $result;

            } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

    public function getReferral($user_id, $data)
    {   
        try {
                $this->conn->beginTransaction();


                $sql = "SELECT *, CONCAT_WS(' ', firstname, middlename, lastname) as name 
                FROM tbl_referral  
                WHERE partnerid LIKE :partnerid OR
                CONCAT_WS(' ', firstname, middlename, lastname) LIKE :name";

                $stmt = $this->conn->prepare($sql);

                $stmt->bindValue(":partnerid", '%' . $data['params'] . '%', PDO::PARAM_STR);
                
                $stmt->bindValue(":name", '%' . $data['params'] . '%', PDO::PARAM_STR);

                $stmt->execute();

                $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

                if ($result === false) {
                    echo "";
                } else {
                    echo json_encode($result);
                }

            } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

    public function insertReferral($user_id, $data)
    {
        try {
           
            $this->conn->beginTransaction();

            
            $this->conn->exec("SET time_zone = 'Asia/Manila'");

            
            $sql = "INSERT INTO tbl_referral () 
                    VALUES (default, :partnerid, :firstname, :middlename, :lastname, :tin, :contactno, :email, :address, '', 'Active', 'Active', :usertracker, CURRENT_TIMESTAMP())";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindParam(':partnerid', $data['partnerid']);
            
            $stmt->bindParam(':firstname', $data['firstName']);
            
            $stmt->bindParam(':middlename', $data['middleName']);
            
            $stmt->bindParam(':lastname', $data['lastName']);
            
            $stmt->bindParam(':tin', $data['tin']);
            
            $stmt->bindParam(':contactno', $data['contact']);
            
            $stmt->bindParam(':email', $data['email']);
            
            $stmt->bindParam(':address', $data['address']);
            
            // $stmt->bindParam(':image_filename', $data['filename']);
            
            $stmt->bindParam(':usertracker', $user_id);

            $stmt->execute();   

            $this->conn->commit();

            echo json_encode(["message" => "Success"]);
        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

    public function updateReferral($user_id, $data)
    {
        try {

            $this->conn->beginTransaction();
       if(isset($data))
       {
               $sql = "UPDATE tbl_referral SET
                    firstname = :firstname,
                    middlename = :middlename,
                    lastname = :lastname,
                    tin = :tin,
                    contactno = :contactno,
                    email = :email,
                    address = :address
                    WHERE seq = :seq";
    
            $stmt = $this->conn->prepare($sql);

            $stmt->bindParam(':firstname', $data['firstname']);
            
            $stmt->bindParam(':middlename', $data['middlename']);
            
            $stmt->bindParam(':lastname', $data['lastname']);
            
            $stmt->bindParam(':tin', $data['tin']);
            
            $stmt->bindParam(':contactno', $data['contactno']);
            
            $stmt->bindParam(':email', $data['email']);
            
            $stmt->bindParam(':address', $data['address']);
            
            $stmt->bindParam(':seq', $data['seq']);

            $stmt->execute();

            $this->conn->commit();

            echo json_encode(["message" => "Success: Record Updated"]);
       }
       else
       {
           echo "need data";
       }
        
        } catch (PDOException $e) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    

    }   

    public function deleteReferral($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

                   if(isset($data))
       {

            $sql = "UPDATE tbl_referral SET status = 'Inactive' WHERE seq = :seq";

            $stmt = $this->conn->prepare($sql);

            $stmt->bindParam(':seq', $data['seq']);

            $stmt->execute();

            $this->conn->commit();
       }

            echo json_encode(["message" => "Success: Record deleted"]);
        } catch (PDOException $e) {
            $this->conn->rollBack();
            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }
    
}
