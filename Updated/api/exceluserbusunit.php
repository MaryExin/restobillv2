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
// Initialize connection var $conn, methods: getByUsername, getById

$busunitcode = $_GET['busunitcode'] ?? null;
$filteroptions = $_GET['filterOptions'] ?? null;


// $user_gateway = new UserGateway($database);

// //Initialize JWT Token with methods: encode, decode

// $codec = new JWTCodec($_ENV["SECRET_KEY"]);

// //Initialize Auth, methods: authenticateAccessToken, getUserID

// $auth = new Auth($user_gateway, $codec);

// //Method of auth checking if token is invalid signature or expired

// if (!$auth->authenticateAccessToken()) {

//     exit;

// }

// $user_id = $auth->getUserID();


// if (!$busunitcode || !$datecurrentmodate) {
//     http_response_code(400);
//     die("Missing required parameters.");
// }

// Define the file name
$fileName = "tbl_user_busunit.csv";
// $datecurrentmodate = date('Y-m-d', strtotime($datecurrentmodate));
// Fetch data

if ($filteroptions == "Area") {

        $sql = "SELECT
            t4.brand_name AS 'Brand Name',
            t2.brandcode AS 'Brand Code',
            t3.corp_name AS 'Corporation Name',
            t2.corpcode as  'Corporation Code',
            t5.area_name AS 'Area Name',
            t2.areacode AS 'Area Code',
            t2.name AS 'Busunit Name',
            t2.busunitcode AS 'Busunit Code',
            t3.corp_name AS 'Company Name',
            t3.sec_id AS 'REG ID',
            t3.sec_reg_date AS 'SEC REG DATE',
            t3.operating_period_start AS 'OPERATING START',
            t3.tin AS TIN,
            t3.taxtype AS 'TAX TYPE',
            t3.address AS ADDRESS,
            t3.zipcode as 'ZIP CODE'
        FROM
            tbl_user_roles AS t1
                LEFT JOIN
            lkp_busunits AS t2 ON t1.rolename = t2.busunitcode
                LEFT JOIN
            lkp_corporation AS t3 ON t2.corpcode = t3.corp_code
                LEFT JOIN
            lkp_brands AS t4 ON t2.brandcode = t4.brand_code
                LEFT JOIN
            lkp_area AS t5 ON t2.areacode = t5.area_code
        WHERE
            roleclass = 'Business Unit'
            AND t2.areacode = :busunitcode";


} else if ($filteroptions == "Corporation") {

        $sql = "SELECT
            t4.brand_name AS 'Brand Name',
            t2.brandcode AS 'Brand Code',
            t3.corp_name AS 'Corporation Name',
            t2.corpcode as  'Corporation Code',
            t2.areacode AS 'Area Code',
            t5.area_name AS 'Area Name',
            t2.name AS 'Busunit Name',
            t2.busunitcode AS 'Busunit Code',
            t3.corp_name AS 'Company Name',
            t3.sec_id AS 'REG ID',
            t3.sec_reg_date AS 'SEC REG DATE',
            t3.operating_period_start AS 'OPERATING START',
            t3.tin AS TIN,
            t3.taxtype AS 'TAX TYPE',
            t3.address AS ADDRESS,
            t3.zipcode as 'ZIP CODE'
        FROM
            tbl_user_roles AS t1
                LEFT JOIN
            lkp_busunits AS t2 ON t1.rolename = t2.busunitcode
                LEFT JOIN
            lkp_corporation AS t3 ON t2.corpcode = t3.corp_code
                LEFT JOIN
            lkp_brands AS t4 ON t2.brandcode = t4.brand_code
                LEFT JOIN
            lkp_area AS t5 ON t2.areacode = t5.area_code
        WHERE
            roleclass = 'Business Unit'
            AND t2.corpcode = :busunitcode";

} elseif ($filteroptions == "Brand") {

            $sql = "SELECT
                t4.brand_name AS 'Brand Name',
                t2.brandcode AS 'Brand Code',
                t3.corp_name AS 'Corporation Name',
                t2.corpcode as  'Corporation Code',
                t2.areacode AS 'Area Code',
                t5.area_name AS 'Area Name',
                t2.name AS 'Busunit Name',
                t2.busunitcode AS 'Busunit Code',
                t3.corp_name AS 'Company Name',
                t3.sec_id AS 'REG ID',
                t3.sec_reg_date AS 'SEC REG DATE',
                t3.operating_period_start AS 'OPERATING START',
                t3.tin AS TIN,
                t3.taxtype AS 'TAX TYPE',
                t3.address AS ADDRESS,
                t3.zipcode as 'ZIP CODE'
            FROM
                tbl_user_roles AS t1
                    LEFT JOIN
                lkp_busunits AS t2 ON t1.rolename = t2.busunitcode
                    LEFT JOIN
                lkp_corporation AS t3 ON t2.corpcode = t3.corp_code
                    LEFT JOIN
                lkp_brands AS t4 ON t2.brandcode = t4.brand_code
                    LEFT JOIN
                lkp_area AS t5 ON t2.areacode = t5.area_code
            WHERE
                roleclass = 'Business Unit'
                AND t2.brandcode = :busunitcode";

} elseif ($filteroptions == "Busunit") {

            $sql = "SELECT
                t4.brand_name AS 'Brand Name',
                t2.brandcode AS 'Brand Code',
                t3.corp_name AS 'Corporation Name',
                t2.corpcode as  'Corporation Code',
                t2.areacode AS 'Area Code',
                t5.area_name AS 'Area Name',
                t2.name AS 'Busunit Name',
                t2.busunitcode AS 'Busunit Code',
                t3.corp_name AS 'Company Name',
                t3.sec_id AS 'REG ID',
                t3.sec_reg_date AS 'SEC REG DATE',
                t3.operating_period_start AS 'OPERATING START',
                t3.tin AS TIN,
                t3.taxtype AS 'TAX TYPE',
                t3.address AS ADDRESS,
                t3.zipcode as 'ZIP CODE'
            FROM
                tbl_user_roles AS t1
                    LEFT JOIN
                lkp_busunits AS t2 ON t1.rolename = t2.busunitcode
                    LEFT JOIN
                lkp_corporation AS t3 ON t2.corpcode = t3.corp_code
                    LEFT JOIN
                lkp_brands AS t4 ON t2.brandcode = t4.brand_code
                    LEFT JOIN
                lkp_area AS t5 ON t2.areacode = t5.area_code
            WHERE
                roleclass = 'Business Unit'
                AND t2.busunitcode = :busunitcode";

}


$stmt = $pdo->prepare($sql);
$stmt->bindParam(':busunitcode', $busunitcode);
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
