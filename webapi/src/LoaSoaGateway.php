<?php

class LoaSoaGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }


    public function getLoa($user_id, $data)
    {   
        $dateFrom = date("Y-01-01");
        $dateTo = date("Y-m-d");

        $sql = "SELECT 
            T1.transdate, 
            T1.glcode,
            T2.gldescription,
            T1.slcode, 
            T3.sldescription, 
            T1.reference, 
            T1.menutransacted, 
            SUM(T1.amount) AS amount
        FROM tbl_accounting_transactions AS T1
        LEFT OUTER JOIN lkp_glcodes AS T2
        ON T1.glcode = T2.glcode
        LEFT OUTER JOIN lkp_slcodes AS T3
        ON T1.slcode = T3.slcodes
        WHERE T1.transdate BETWEEN :dateFrom AND :dateTo 
            AND T1.busunitcode = :busunitcode 
            AND T1.glcode = :glcode
        GROUP BY T1.slcode
        ORDER BY T1.seq";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":dateFrom", $dateFrom);
        $stmt->bindValue(":dateTo", $dateTo);
        $stmt->bindValue(":busunitcode", $data["busunitcode"]);
        $stmt->bindValue(":glcode", $data["glcode"]);
        $stmt->execute();

        $result = [];
        $total = 0;
        $beginning_balance = 0;

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // Sum the amounts
            $beginning_balance += $row['amount'];

            $sqlcount = "SELECT COUNT(*) AS total_transaction
                FROM tbl_accounting_transactions AS T1
                WHERE T1.transdate BETWEEN :dateFrom AND :dateTo
                    AND T1.busunitcode = :busunitcode 
                    AND T1.slcode = :slcode";

            $stmtcount = $this->conn->prepare($sqlcount);
            $stmtcount->bindValue(":dateFrom", $dateFrom);
            $stmtcount->bindValue(":dateTo", $dateTo);
            $stmtcount->bindValue(":busunitcode", $data["busunitcode"]);
            $stmtcount->bindValue(":slcode", $row["slcode"]);
            $stmtcount->execute();

            $countResult = $stmtcount->fetch(PDO::FETCH_ASSOC);
            $row["total_transaction"] = $countResult["total_transaction"];
            $total += $row['total_transaction'];
            $result[] = $row;
        }

        $response = [
            "data" => $result,
            "total" => $total,
            "beginning_balance" => $beginning_balance // Added beginning balance sum
        ];

        echo json_encode($response);
    }



public function getSoa($user_id, $data) {     
    $sql = "SELECT          
        T1.transdate,          
        T1.glcode,          
        T1.slcode,          
        T1.reference,          
        T1.particulars,         
        T1.menutransacted,         
        T2.supplier_name,         
        CASE WHEN T1.amount >= 0 THEN T1.amount ELSE 0 END AS DEBIT,          
        CASE WHEN T1.amount < 0 THEN ABS(T1.amount) ELSE 0 END AS CREDIT     
    FROM tbl_accounting_transactions AS T1     
    LEFT OUTER JOIN lkp_supplier AS T2 ON T1.supplier_code = T2.supplier_code     
    WHERE T1.transdate BETWEEN :dateFrom AND :dateTo         
        AND T1.busunitcode = :busunitcode          
        AND T1.slcode = :slcode     
    ORDER BY T1.seq";  

    $stmt = $this->conn->prepare($sql);     
    $stmt->bindValue(":dateFrom", $data["dateFrom"]);     
    $stmt->bindValue(":dateTo", $data["dateTo"]);     
    $stmt->bindValue(":busunitcode", $data["busunitcode"]);     
    $stmt->bindValue(":slcode", $data["slcode"]);     
    $stmt->execute();  

    $result = [];     
    $total = 0;     
    $balance = 0;     
    $slcode = 0;     
    $debit_total = 0;     
    $credit_total = 0;     
    $balance_total = 0;  

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {         
        $slcode = $row["slcode"];         
        $debit_total += $row["DEBIT"];         
        $credit_total += $row["CREDIT"];         
        $result[] = $row;     
    }  

    $sqlcount = "SELECT SUM(amount) AS beginning_balance         
        FROM tbl_accounting_transactions AS T1         
        WHERE T1.transdate < :dateFrom             
            AND T1.busunitcode = :busunitcode              
            AND T1.slcode = :slcode";  

    $stmtcount = $this->conn->prepare($sqlcount);     
    $stmtcount->bindValue(":dateFrom", $data["dateFrom"]);     
    $stmtcount->bindValue(":busunitcode", $data["busunitcode"]);     
    $stmtcount->bindValue(":slcode", $slcode);     
    $stmtcount->execute();  

    $balanceData = $stmtcount->fetch(PDO::FETCH_ASSOC);     
    $total = $balanceData['beginning_balance'] ?? 0;  

    foreach ($result as &$row) {         
        $runningBalance = ($row['DEBIT'] - $row['CREDIT']);         
        $total += $runningBalance;         
        $row['running_balance'] = $total;     
    }  

    $balance_total = $total;  

    $response = [         
        "data" => $result,         
        "beginning_balance" => number_format($balanceData['beginning_balance'] ?? 0, 2, '.', ''),         
        "debit_total" => number_format($debit_total, 2, '.', ''),         
        "credit_total" => number_format($credit_total, 2, '.', ''),         
        "balance_total" => number_format($balance_total, 2, '.', '')     
    ];  

    echo json_encode($response); 
}




}
