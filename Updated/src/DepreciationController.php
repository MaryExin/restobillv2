<?php

class DepreciationController
{
    public function __construct()
    {}

    public function depreciation()
    {
 

            // Initialize database connection
            $database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]); 
            $conn = $database->getConnection();




            // Fetch fixed assets data with posted transactions
            $sql = "SELECT * FROM tbl_fixed_assets AS T1
            JOIN tbl_accounting_transactions AS T2
            ON T1.menutransactedref = T2.menutransactedref
            WHERE T1.approvalstatus = 'Posted'
            AND T1.purchasedate < NOW() - INTERVAL 30 DAY
            AND total_carrying_value > 0
            GROUP BY T1.fixedassetid";

            $stmt = $conn->prepare($sql);
            $stmt->execute();

            $summaryData = $stmt->fetchAll(PDO::FETCH_ASSOC);



            // Update each fixed asset's total carrying value
            foreach ($summaryData as $fixedAsset) {


                    $sql = "SELECT count(menutransactedref) as total FROM tbl_accounting_transactions where glcode = 990 and menutransactedref = :menutransactedref and amount > 0";
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(":menutransactedref", $fixedAsset['menutransactedref']);
                    $stmt->execute();

                    $fetch = $stmt->fetch(PDO::FETCH_ASSOC);
                    $month = $fetch['total'];
                    echo $month;
                if ($month != $fixedAsset['usefullifeinmos']) {


                    $monthlyDepreciation = ($fixedAsset["amount"] - $fixedAsset["residualvalue"]) / $fixedAsset["usefullifeinmos"];
                    $depcount =  $fixedAsset['usefullifeinmos'] - $month;

                                        if ($depcount == 1) {

                        $totalDepreciation = $fixedAsset['total_carrying_value'] - $fixedAsset["residualvalue"];
                        $totalCarryingAmount = $fixedAsset["residualvalue"];
                    } else {

                        $totalDepreciation = $monthlyDepreciation;
                        $totalCarryingAmount = $fixedAsset["total_carrying_value"] - $totalDepreciation;
                    }
                
                    // Round final values only for display or saving
                    $totalDepreciation = round($totalDepreciation, 2);
                    $totalCarryingAmount = round($totalCarryingAmount, 2);


                    // Prepare the update statement
                    $sql = "UPDATE tbl_fixed_assets SET total_carrying_value = :total_carrying_value WHERE fixedassetid = :fixedassetid";
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(":total_carrying_value", $totalCarryingAmount);
                    $stmt->bindValue(":fixedassetid", $fixedAsset["fixedassetid"]);
                    $stmt->execute();
                    $sql = "SELECT glcode, slcodes, sldescription FROM lkp_slcodes WHERE sldescription = :sldescription";
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(":sldescription", 'DEPRECIATION - ' . $fixedAsset["class"]);
                    $stmt->execute();
                    $debit = $stmt->fetch(PDO::FETCH_ASSOC);

                    $sql = "INSERT INTO tbl_accounting_transactions 
                    (transdate, document_date, glcode, slcode, amount, particulars, reference, approvalref, approvalstatus ,transactiontype, transactionclass, menutransacted, busunitcode, menutransactedref, deletestatus, createdtime)
                    VALUES (
                        DATE_ADD(NOW(), INTERVAL 8 HOUR), 
                        DATE_ADD(NOW(), INTERVAL 8 HOUR),
                        990, 
                        :slcode, 
                        :amount, 
                        :particulars, 
                        'Auto', 
                        'Auto', 
                        'Posted', 
                        'FIXED ASSET',
                        '/fixedasset',
                        'DEPRECIATION',
                        :busunitcode,
                        :menutransactedref,
                        'Active', 
                        DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";
                                
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(":slcode", $debit['slcodes']);
                    $stmt->bindValue(":amount", $totalDepreciation);
                    $stmt->bindValue(":particulars", $debit['sldescription']);
                    $stmt->bindValue(":busunitcode", $fixedAsset['busunitcode']);
                    $stmt->bindValue(":menutransactedref", $fixedAsset['menutransactedref']);
                    $stmt->execute();
            
                    $sql = "SELECT glcode, slcodes, sldescription FROM lkp_slcodes WHERE sldescription = :sldescription";
                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(":sldescription", 'ACCUMULATED DEPRECIATION - ' . $fixedAsset["class"]);
                    $stmt->execute();
                    $credit = $stmt->fetch(PDO::FETCH_ASSOC);

                    $sql = "INSERT INTO tbl_accounting_transactions 
                    (transdate, document_date, glcode, slcode, amount, particulars, reference, approvalref, approvalstatus ,transactiontype, transactionclass, menutransacted, busunitcode, menutransactedref, deletestatus, createdtime)
                    VALUES (
                        DATE_ADD(NOW(), INTERVAL 8 HOUR), 
                        DATE_ADD(NOW(), INTERVAL 8 HOUR),
                        290, 
                        :slcode, 
                        :amount, 
                        :particulars, 
                        'Auto', 
                        'Auto', 
                        'Posted',
                        'FIXED ASSET',
                        '/fixedasset',
                        'DEPRECIATION',
                        :busunitcode,
                        :menutransactedref, 
                        'Active', 
                        DATE_ADD(NOW(), INTERVAL 8 HOUR)
                    )";

                    $stmt = $conn->prepare($sql);
                    $stmt->bindValue(":slcode", $credit['slcodes']);
                    $stmt->bindValue(":amount", $totalDepreciation * -1);
                    $stmt->bindValue(":particulars", $credit['sldescription']);
                    $stmt->bindValue(":busunitcode", $fixedAsset['busunitcode']);
                    $stmt->bindValue(":menutransactedref", $fixedAsset['menutransactedref']);
                    $stmt->execute();

                   
                }
                
            }



            echo json_encode(["message" => "Success"]);
    

    }
}
