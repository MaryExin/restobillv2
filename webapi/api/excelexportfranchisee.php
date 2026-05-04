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

// $excelAuth = new ExcelAuth($database);

// $isAuth = $excelAuth->authenticateExcelCreds($excelToken);

$date = $_GET['Date'] ?? null;
$busunitclass = $_GET['busunitclass'] ?? null;

// if (!$isAuth > 0) {
//     echo json_encode(["message" => "Excel token required"]);
//     exit;
// }

// Validate parameters
// if (!$busunitcode || !$datelastyearbeg || !$datecurrentmodate) {
//     http_response_code(400);
//     die("Missing required parameters.");
// }

// Define the file name
$fileName = "tbl_prfranchisee.csv";

// Fetch data
$sql = "SELECT 
            t3.name,
            t2.inv_code,
            CASE 
                WHEN t2.inv_code LIKE 'BD%' THEN lkp_bp.desc
                WHEN t2.inv_code LIKE 'RM%' THEN lkp_rm.desc
                ELSE NULL
            END AS Description,
            t2.quantity,
            CASE 
                WHEN t2.inv_code LIKE 'BD%' THEN t4.cost_per_uom * t2.quantity
                WHEN t2.inv_code LIKE 'RM%' THEN t5.cost_per_uom * t2.quantity
                ELSE NULL
            END AS total_cost,
            CASE 
                WHEN t2.inv_code LIKE 'BD%' THEN t4.srp * t2.quantity
                WHEN t2.inv_code LIKE 'RM%' THEN t5.srp * t2.quantity
                ELSE NULL
            END AS total_srp
        FROM tbl_products_queue_summary AS t1
        LEFT JOIN tbl_products_queue AS t2 ON t1.prd_queue_code = t2.prd_queue_code
        LEFT JOIN lkp_busunits AS t3 ON t1.orderedby = t3.busunitcode
        LEFT JOIN lkp_build_of_products AS lkp_bp ON t2.inv_code LIKE 'BD%' AND t2.inv_code = lkp_bp.build_code
        LEFT JOIN lkp_raw_mats AS lkp_rm ON t2.inv_code LIKE 'RM%' AND t2.inv_code = lkp_rm.mat_code
        LEFT JOIN tbl_pricing_details AS t4 ON t2.inv_code LIKE 'BD%' AND t2.inv_code = t4.inv_code
        LEFT JOIN tbl_pricing_details AS t5 ON t2.inv_code LIKE 'RM%' AND t2.inv_code = t5.inv_code
        WHERE t1.delivery_status = 'Delivered'
          AND (t2.inv_code LIKE 'BD%' OR t2.inv_code LIKE 'RM%')
          AND YEAR(t1.pr_approved_date) = YEAR(:Date1)
          AND MONTH(t1.pr_approved_date) = MONTH(:Date2)
            AND t3.class = :busunitclass";

$stmt = $pdo->prepare($sql);
$stmt->bindParam(':Date1',$date);
$stmt->bindParam(':Date2',$date);
$stmt->bindParam(':busunitclass',$busunitclass);
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
