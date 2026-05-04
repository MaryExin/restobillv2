<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

//Initialize CorsPolicy Class

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

date_default_timezone_set('Asia/Manila');

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);
    header("Allow: POST");
    exit;
}

$data = (array) json_decode(file_get_contents("php://input"), true);

// echo json_encode($data);

$database = new Database($_ENV["DB_HOST"],
    $_ENV["DB_NAME"],
    $_ENV["DB_USER"],
    $_ENV["DB_PASS"]);

//Initialize connection var $conn, methods: getByUsername, getById
try {
$conn = $database->getConnection();

$sql1 = "INSERT INTO tbl_sales_transaction(Transaction_ID, Store, Casher_Name, Transaction_Type, Cash_Tendered, Sub_Total, Changes, Transaction_Date, Usertracker, Created_Datetime)
    VALUES (:Transaction_ID, :Store, :Casher_Name, :Transaction_Type, :Cash_Tendered, :Sub_Total, :Change, :Transaction_Date, :Usertracker, now())";
    $stmt = $conn->prepare($sql1);
    $stmt->bindValue(":Transaction_ID", $data["transactionsTotal"]["transactionId"], PDO::PARAM_STR);
    $stmt->bindValue(":Store", $data["transactionsTotal"]["store"], PDO::PARAM_STR);
    $stmt->bindValue(":Casher_Name", $data["cashiername"], PDO::PARAM_STR);
    $stmt->bindValue(":Transaction_Type", $data["transactionsTotal"]["type"], PDO::PARAM_STR);
    $stmt->bindValue(":Cash_Tendered", $data["transactionsTotal"]["cashtendered"], PDO::PARAM_STR);
    $stmt->bindValue(":Sub_Total", $data["transactionsTotal"]["subtotal"], PDO::PARAM_STR);
    $stmt->bindValue(":Change", $data["transactionsTotal"]["change"], PDO::PARAM_STR);
    $stmt->bindValue(":Transaction_Date", $data["transactionsTotal"]["transdate"], PDO::PARAM_STR);
    $stmt->bindValue(":Usertracker", $data["cashiername"], PDO::PARAM_STR);
    $stmt->execute();

$sql2 = "INSERT INTO tbl_sales_summary(Transaction_ID, Store, Type_of_Transaction, Product, Quantity, Amount, Total_Amount, Date_Transaction, Usertracker, Created_Datetime)
    VALUES (:Transaction_ID, :Store, :Type_of_Transaction, :Product, :Quantity, :Amount, :Total_Amount, :Date_Transaction, :Usertracker, now())";

   foreach ($data["salesSummary"] as $salesItem) {
    $stmt = $conn->prepare($sql2);
    $stmt->bindValue(":Transaction_ID", $salesItem["transid"], PDO::PARAM_STR);
    $stmt->bindValue(":Store", $salesItem["store"], PDO::PARAM_STR);
    $stmt->bindValue(":Type_of_Transaction", $salesItem["type"], PDO::PARAM_STR);
    $stmt->bindValue(":Product", $salesItem["product"], PDO::PARAM_STR);
    $stmt->bindValue(":Quantity", $salesItem["quantity"], PDO::PARAM_STR);
    $stmt->bindValue(":Amount", $salesItem["amount"], PDO::PARAM_STR);
    $stmt->bindValue(":Total_Amount", $salesItem["total"], PDO::PARAM_STR);
    $stmt->bindValue(":Date_Transaction", $salesItem["transdate"], PDO::PARAM_STR);
    $stmt->bindValue(":Usertracker", $data["cashiername"], PDO::PARAM_STR);
    $stmt->execute();
    }

    echo json_encode(["message" => "New Transaction Registered!."]);
    exit;

} catch (PDOException $e) {
    // Handle the exception, e.g., log the error or display an error message
    echo json_encode(["message" => "Error Regitration!."]);
}