<?php

class ClosingAccountingPeriodGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    public function closeAccountingEntries($user_id, $data)
    {
        try {

            $this->conn->beginTransaction();

            $this->conn->exec("SET time_zone = 'Asia/Manila'");
            
            $month = $data["accounting_period"];
            
            $yearMonth = date("y-m", strtotime($data["accounting_period"]));

            $year = substr($yearMonth, 0, 2);
            $month = substr($yearMonth, 3, 2);
            
            
            $sql = "SELECT * FROM tbl_accounting_period 
                    WHERE DATE_FORMAT(accounting_period, '%y-%m') = :yearMonth AND busunitcode = :busunitcode";
            
            $stmt = $this->conn->prepare($sql);
            
            $stmt->bindParam(":yearMonth", $yearMonth, PDO::PARAM_STR);
            
            $stmt->bindParam(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
            
            $stmt->execute();
            
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result) 
            {
               echo json_encode(["message" => "The accounting period for this month and year is already closed."]);
               exit;
            }
        
            $month = $data["accounting_period"];

            $sql = "INSERT INTO tbl_accounting_period () 
            VALUES (default, :accounting_period, 'Closed', :busunitcode, 'Active', :usertracker, CURRENT_TIMESTAMP())";
    
                $stmt = $this->conn->prepare($sql);
    
                $stmt->bindParam(":accounting_period", $data["accounting_period"], PDO::PARAM_STR);

                $stmt->bindParam(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);

                $stmt->bindParam(":usertracker", $user_id);
                
                $stmt->execute();

             $log = "INSERT INTO tbl_logs ()
            VALUES (default, 'LIGHTEM', :busunitcode, 'Closing', 'Accounting', :particulars, :id, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR))";

            $logstmt = $this->conn->prepare($log);
            $logstmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $logstmt->bindValue(":busunitcode", $data["busunitcode"], PDO::PARAM_STR);
            $logstmt->bindValue(":particulars", $data["accounting_period"], PDO::PARAM_STR);
            $logstmt->execute();               
         
                $this->conn->commit();
    
                echo json_encode(["message" => "Success"]);

        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }

     public function closeAccountingEntriesMap( $page,$search,  $busunitcode)
    {
        try {
            $this->conn->beginTransaction();

            $this->conn->exec("SET time_zone = 'Asia/Manila'");

            $checksql = "SELECT COUNT(*) as count FROM lkp_busunits where busunitcode = :busunitcode";

                $checkstmt = $this->conn->prepare($checksql);

                $checkstmt->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);

                $checkstmt->execute();

                $output = $checkstmt->fetch(PDO::FETCH_ASSOC);
               
            if($output["count"] === 0){
                      $data = [];
                       
            }else{
             
            $sql = "SELECT 
                            months.month,
    COALESCE(YEAR(MAX(data.accounting_period)), YEAR(NOW())) AS year,
    COALESCE(data.status, 'Open') AS status
                        FROM (
                            SELECT 1 AS month UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL 
                            SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL 
                            SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL 
                            SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
                        ) AS months
                        LEFT JOIN tbl_accounting_period AS data 
                            ON months.month = MONTH(data.accounting_period) 
                            AND data.busunitcode = :busunitcode
                            AND data.accounting_period LIKE :accounting_period
                        GROUP BY 
                            months.month
                        ORDER BY 
                            months.month ASC";

                $stmt = $this->conn->prepare($sql);
                 
                $stmt->bindValue(":accounting_period",'%' . $search . '%',PDO::PARAM_INT);
                // $stmt->bindValue(":accounting_period_1", $search ,PDO::PARAM_INT);    
                $stmt->bindValue(":busunitcode", $busunitcode);
                //   $stmt->bindValue(":busunitcode_2", $busunitcode, PDO::PARAM_STR);
                //   $stmt->bindValue(":busunitcode_3", $busunitcode, PDO::PARAM_STR);

              
                
                $stmt->execute();
  
                $this->conn->commit();
                $data = [];
                 while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                     $data[] = $row;
                 }

            }
            return(["items"=>$data]); 
        } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }
     public function checkingDate($user_id,$data)
    {   
        try {
                $this->conn->beginTransaction();

                $this->conn->exec("SET time_zone = 'Asia/Manila'");

                $checksql = "SELECT MAX(accounting_period) as accounting_period,busunitcode,status,deletestatus 
                            FROM tbl_accounting_period  where  busunitcode = :busunitcode";

                    $checkstmt = $this->conn->prepare($checksql);

                    $checkstmt->bindValue(":busunitcode", $data['busunitcode'], PDO::PARAM_STR);

                    $checkstmt->execute();

                    $output = $checkstmt->fetch(PDO::FETCH_ASSOC);

                if($output['accounting_period'] >= $data['accounting_period'] ){
                    $data ="Can't Access";
                }else{
                    $data ="Can Access";
                }
                // return($data);
                 echo json_encode(["message" => $data]);

            } catch (PDOException $e) {

            $this->conn->rollBack();

            echo json_encode(["message" => "Error: " . $e->getMessage()]);
        }
    }
}
