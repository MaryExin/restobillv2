<?php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    header("Allow: GET");
    exit;
}

// Initialize the Database connection
$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);
$pdo = $database->getConnection();

// Parameters
// $excelToken = $_GET["exceltoken"];
$busunitcode = $_GET['busunitcode'] ?? null;
$filteroptions = $_GET['filterOptions'] ?? null;
$datelastyearbeg = $_GET['datelastyearbeg'] ?? null;
$datecurrentmodate = $_GET['datecurrentmodate'] ?? null;

// $excelAuth = new ExcelAuth($database);

// $isAuth = $excelAuth->authenticateExcelCreds($excelToken);

// if (!$isAuth > 0) {
//     echo json_encode(["message" => "Excel token required"]);
//     exit;
// }

// Validate parameters
if (!$busunitcode || !$datelastyearbeg || !$datecurrentmodate) {
    http_response_code(400);
    die("Missing required parameters.");
}

// Define the file name
$fileName = "tbl_accountingtransactions.csv";


if($filteroptions == "Area"){
    $sql = "SELECT t1.* FROM tbl_accounting_transactions AS t1 LEFT JOIN lkp_busunits AS t2 ON t2.busunitcode = t1.busunitcode
        WHERE t2.areacode = :busunitcode AND t1.deletestatus = 'Active' AND t1.approvalstatus = 'Posted'
        AND t1.transdate BETWEEN :datelastyearbeg AND :datecurrentmodate";

}else if($filteroptions == "Corporation"){
    $sql = "SELECT t1.* FROM tbl_accounting_transactions AS t1 LEFT JOIN lkp_busunits AS t2 ON t2.busunitcode = t1.busunitcode
        WHERE t2.corpcode = :busunitcode AND t1.deletestatus = 'Active' AND t1.approvalstatus = 'Posted'
        AND t1.transdate BETWEEN :datelastyearbeg AND :datecurrentmodate";


}elseif($filteroptions == "Brand"){
    $sql = "SELECT t1.* FROM tbl_accounting_transactions AS t1 LEFT JOIN lkp_busunits AS t2 ON t2.busunitcode = t1.busunitcode
        WHERE t2.brandcode = :busunitcode AND t1.deletestatus = 'Active' AND t1.approvalstatus = 'Posted'
        AND t1.transdate BETWEEN :datelastyearbeg AND :datecurrentmodate";

    
}elseif($filteroptions == "Busunit"){
    $sql = "SELECT * FROM tbl_accounting_transactions 
        WHERE busunitcode = :busunitcode AND deletestatus = 'Active' AND approvalstatus = 'Posted'
        AND transdate BETWEEN :datelastyearbeg AND :datecurrentmodate";
}

// Fetch data

$stmt = $pdo->prepare($sql);
$stmt->bindParam(':busunitcode', $busunitcode);
$stmt->bindParam(':datelastyearbeg', $datelastyearbeg);
$stmt->bindParam(':datecurrentmodate', $datecurrentmodate);
$stmt->execute();
$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

// if (empty($data)) {
//     die("No data found for the given parameters.");
// }

// Set headers to force download
header('Content-Type: text/csv');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Pragma: no-cache');
header('Expires: 0');

// Open output stream
$output = fopen('php://output', 'w');

// Add column headers
if (!empty($data)) {
    fputcsv($output, array_keys($data[0]));
}

// Add rows
foreach ($data as $row) {
    fputcsv($output, $row);
}

fclose($output);
exit;
