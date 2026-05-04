<?php

class ZreadingGateway
{

    private $conn;

    public function __construct(Database $database)
    {

        $this->conn = $database->getConnection();

    }

    public function getAllZreading($data)
    {
        $sql = "SELECT * FROM tbl_zreading WHERE DATE(Opening_DateTime) = :date ";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":date", $data['date'], PDO::PARAM_STR);
        $stmt->execute();
    
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
        echo json_encode($result);
    }

   public function Zreading( $data)
{
    $sql = "INSERT INTO tbl_zreading (
                busunitcode, Opening_DateTime, Opening_Cash_Count, Closing_DateTime, Closing_Cash_Count, 
                Beg_OR, End_OR, Beg_VoidNo, End_VoidNo, Beg_RefundNo, End_RefundNo, Z_Counter_No, 
                Present_Accum_Sales, Previous_Accum_Sales, Sales_For_The_Day, VATableSales, 
                VATableSales_VAT, VATExemptSales, VATExemptSales_VAT, VATZeroRatedSales, 
                OtherCharges, Gross_Amount, Discount, Voided_Sales, Refunded_Sales, 
                Discount_SRC, Discount_PWD, Discount_NAAC, Discount_SoloParent, Discount_Others, 
                Payment_Cash, Payment_Cheque, Payment_CreditCard, Payment_Others)
            VALUES (
                :busunit, STR_TO_DATE(:Opening_DateTime, '%m/%d/%Y %h:%i:%s %p'), :Opening_Cash_Count, 
                STR_TO_DATE(:Closing_DateTime, '%m/%d/%Y %h:%i:%s %p'), :Closing_Cash_Count, 
                :Beg_OR, :End_OR, :Beg_VoidNo, :End_VoidNo, :Beg_RefundNo, :End_RefundNo, :Z_Counter_No, 
                :Present_Accum_Sales, :Previous_Accum_Sales, :Sales_For_The_Day, :VATableSales, 
                :VATableSales_VAT, :VATExemptSales, :VATExemptSales_VAT, :VATZeroRatedSales, 
                :OtherCharges, :Gross_Amount, :Discount, :Voided_Sales, :Refunded_Sales, 
                :Discount_SRC, :Discount_PWD, :Discount_NAAC, :Discount_SoloParent, :Discount_Others, 
                :Payment_Cash, :Payment_Cheque, :Payment_CreditCard, :Payment_Others
            )";

    $stmt = $this->conn->prepare($sql);

    $stmt->bindValue(":busunit", $data['busunit'], PDO::PARAM_STR);

    foreach ($data['Zreading'][0] as $key => $value) {
        if (in_array($key, ['Opening_DateTime', 'Closing_DateTime'])) {
            $stmt->bindValue(":" . $key, date("m/d/Y h:i:s A", strtotime($value)), PDO::PARAM_STR);
        } else {
            $stmt->bindValue(":" . $key, $value, PDO::PARAM_STR);
        }
    }

    $stmt->execute();

    echo json_encode(["message" => "Zreading Inserted Successfully"]);
}

    

}
