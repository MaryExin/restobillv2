<?php

class FixedAssetsClassGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllData()
    {

        $sql = "SELECT * FROM lkp_fixed_assets_class Where deletestatus = 'Active' ORDER BY class_name ASC";

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
            $randomString = substr(bin2hex(random_bytes(6)), 0, 12);
            $randomString2 = substr(bin2hex(random_bytes(6)), 0, 12);
            $shortUuid = "FAC-" . $randomString;
            $slid = "SL-" . $randomString;
            $slid2 = "SL-" . $randomString2;
            $acctid = "ATM-" . $randomString;
            $acctids = "PC-" . $randomString;
            $checkforduplisql = "SELECT COUNT(*) as count FROM lkp_fixed_assets_class WHERE class_name = :className && deletestatus = 'Active'";
            $checkforduplistmt = $this->conn->prepare($checkforduplisql);
            $checkforduplistmt->bindValue(":className", $data["className"], PDO::PARAM_STR);
            $checkforduplistmt->execute();
            $rowCount = $checkforduplistmt->fetchColumn();

            if($rowCount > 0) {
                echo json_encode(["message" => "Duplicate Entry"]);
            } 
            else 
            {

                $generateidsql = "SELECT COUNT(*) as count FROM lkp_slcodes WHERE glcode = '990'";
                $generateidstmt = $this->conn->prepare($generateidsql);
                $generateidstmt->execute();
                $rowCount = $generateidstmt->fetchColumn();

                $uniqueNumber = $rowCount + 1;

                $sql = "INSERT INTO lkp_slcodes () VALUES (:slid, '990', :slcodes, :sldescs, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                $stmt = $this->conn->prepare($sql);

                $slcode = '990' . sprintf("%02d", $uniqueNumber);
                $sldesc = 'DEPRECIATION - ' . $data["className"];
                
                $stmt->bindValue(":slid", $slid, PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
                $stmt->bindValue(":sldescs", $sldesc, PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
    
                $acctgsql = "INSERT INTO lkp_acctg_transactions_map () VALUES (default, :acctid, :acctgslcode, :slcodes, '/fixedassetsclass', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                $acctgstmt = $this->conn->prepare($acctgsql);
                $acctgstmt->bindValue(":acctgslcode", $acctids , PDO::PARAM_STR);
                $acctgstmt->bindValue(":acctid", $acctid , PDO::PARAM_STR);
                $acctgstmt->bindValue(":acctid", $acctid , PDO::PARAM_STR);
                $acctgstmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
                $acctgstmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $acctgstmt->execute();

                $generateidsql = "SELECT COUNT(*) as count FROM lkp_slcodes WHERE glcode = '290'";
                $generateidstmt = $this->conn->prepare($generateidsql);
                $generateidstmt->execute();
                $rowCount = $generateidstmt->fetchColumn();

                $uniqueNumber = $rowCount + 1;

                $sql = "INSERT INTO lkp_slcodes () VALUES (:slid, '290', :slcodes, :sldescs, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                $stmt = $this->conn->prepare($sql);

                $slcode = '290' . sprintf("%02d", $uniqueNumber);
                $sldesc = 'ACCUMULATED DEPRECIATION - ' . $data["className"];
                
                $stmt->bindValue(":slid", $slid2, PDO::PARAM_STR);
                $stmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
                $stmt->bindValue(":sldescs", $sldesc, PDO::PARAM_STR);
                $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $stmt->execute();
    
                $acctgsql = "INSERT INTO lkp_acctg_transactions_map () VALUES (default, :acctid, :acctgslcode, :slcodes, '/fixedassetsclass', 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
                $acctgstmt = $this->conn->prepare($acctgsql);
                $acctgstmt->bindValue(":acctgslcode", $acctids , PDO::PARAM_STR);
                $acctgstmt->bindValue(":acctid", $acctid , PDO::PARAM_STR);
                $acctgstmt->bindValue(":acctid", $acctid , PDO::PARAM_STR);
                $acctgstmt->bindValue(":slcodes", $slcode, PDO::PARAM_STR);
                $acctgstmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                $acctgstmt->execute();
    
                $sql = "INSERT INTO lkp_fixed_assets_class ()
                        VALUES (default, :shortUuid, :className, 'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR))";
    
                $stmt = $this->conn->prepare($sql);
                
                $stmt->bindValue(":className", $data["className"]);
                
                $stmt->bindValue(":shortUuid", $shortUuid);
    
                $stmt->bindValue(":user_tracker", $user_id);
                
                $stmt->execute();
            }
            
            
            echo json_encode(["message" => "Success"]);
           
    }




}
