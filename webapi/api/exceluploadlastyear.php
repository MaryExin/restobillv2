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
// $datelastyearbeg = $_GET['datelastyearbeg'] ?? null;
$datecurrentmodate = $_GET['datecurrentmodate'] ?? null;

// $excelAuth = new ExcelAuth($database);

// $isAuth = $excelAuth->authenticateExcelCreds($excelToken);

// if (!$isAuth > 0) {
//     echo json_encode(["message" => "Excel token required"]);
//     exit;
// }

// Validate parameters
if (!$busunitcode  || !$datecurrentmodate) {
    http_response_code(400);
    die("Missing required parameters.");
}

// Define the file name
$fileName = "tbl_upload_last_year.csv";
$datecurrentmodate = date('Y-m-d', strtotime($datecurrentmodate));

if ($filteroptions == "Area") {

    $sql = "SELECT t1.* FROM tbl_upload_last_year as t1 LEFT JOIN lkp_busunits AS t2 ON t2.busunitcode = t1.busunitcode
        where t2.areacode = :busunitcode AND t1.deletestatus = 'Active'
        AND YEAR(t1.lastyear_date) = YEAR(:lastyear_date1) AND  MONTH(t1.lastyear_date) = MONTH(:lastyear_date);";

} else if ($filteroptions == "Corporation") {

    $sql = "SELECT t1.* FROM tbl_upload_last_year as t1 LEFT JOIN lkp_busunits AS t2 ON t2.busunitcode = t1.busunitcode
        where t2.corpcode = :busunitcode AND t1.deletestatus = 'Active'
        AND YEAR(t1.lastyear_date) = YEAR(:lastyear_date1) AND  MONTH(t1.lastyear_date) = MONTH(:lastyear_date);";

} elseif ($filteroptions == "Brand") {

    $sql = "SELECT t1.* FROM tbl_upload_last_year as t1 LEFT JOIN lkp_busunits AS t2 ON t2.busunitcode = t1.busunitcode
        where t2.brandcode = :busunitcode AND t1.deletestatus = 'Active'
        AND YEAR(t1.lastyear_date) = YEAR(:lastyear_date1) AND  MONTH(t1.lastyear_date) = MONTH(:lastyear_date);";

} elseif ($filteroptions == "Busunit") {

    $sql = "SELECT * FROM tbl_upload_last_year where busunitcode = :busunitcode AND deletestatus = 'Active'
        AND YEAR(lastyear_date) = YEAR(:lastyear_date1) AND  MONTH(lastyear_date) = MONTH(:lastyear_date);";

}
// Fetch data

$stmt = $pdo->prepare($sql);
$stmt->bindParam(':busunitcode', $busunitcode);
$stmt->bindParam(':lastyear_date', $datecurrentmodate);
$stmt->bindParam(':lastyear_date1', $datecurrentmodate);
$stmt->execute();
$data = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($data)) {
    die("No data found for the given parameters.");
}

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
