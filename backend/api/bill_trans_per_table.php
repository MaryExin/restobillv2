<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$config = require __DIR__ . "/config.php";

$conn = new mysqli(
    $config["host"],
    $config["user"],
    $config["pass"],
    $config["db"]
);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$trans_id = $_GET['transaction_id'];

$sql = "
SELECT 
    t1.ID,
    t1.transaction_id,
    t1.product_id,
    t1.sku,
    t1.sales_quantity,
    t1.landing_cost,
    t1.unit_cost,
    t1.selling_price,
    t1.vatable,
    t1.isDiscountable,
    t2.transaction_date,
    t2.billing_no,
    t2.invoice_no,
    t2.table_number,
    t2.order_type,
    t2.TotalSales,
    t2.Discount,
    t2.OtherCharges,
    t2.TotalAmountDue,
    t2.VATableSales,
    t2.VATableSales_VAT,
    t2.VATExemptSales,
    t2.VATExemptSales_VAT,
    t2.VATZeroRatedSales,
    t2.customer_exclusive_id,
    t2.customer_head_count,
    t2.customer_count_for_discount,
    t2.discount_type,
    t2.payment_amount,
    t2.payment_method,
    t2.change_amount,
    t3.item_name,
    t3.unit_of_measure
FROM tbl_pos_transactions_detailed AS t1
LEFT JOIN tbl_pos_transactions AS t2
    ON t1.transaction_id = t2.transaction_id
LEFT JOIN tbl_inventory_products_masterlist AS t3
    ON t1.product_id = t3.product_id
WHERE t1.transaction_id = '" . $trans_id . "';
";

$result = $conn->query($sql);

$data = array();

while($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);
$conn->close();
?>