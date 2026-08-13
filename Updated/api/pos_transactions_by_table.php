<?php
// api/pos_transactions_by_table.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { exit; }

require __DIR__ . "/pdo.php";

$date = $_GET["date"] ?? "";
$table_number = $_GET["table_number"] ?? "";

if (!$date || !$table_number) {
  http_response_code(400);
  echo json_encode(["error" => "Missing date or table_number"]);
  exit;
}

$sql = "
  SELECT *
  FROM tbl_pos_transactions
  WHERE status = 'Active'
    AND transaction_date = :date
    AND table_number = :table_number
";
$stmt = $pdo->prepare($sql);
$stmt->execute([
  ":date" => $date,
  ":table_number" => $table_number,
]);

echo json_encode($stmt->fetchAll());