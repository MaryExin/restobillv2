<?php

//PHP to CRUD Tasks End Point

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();

$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);
    header("Allow: POST");
    exit;
}

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"],
    $_ENV["DB_PASS"]);

// Initialize connection var $conn, methods: getByUsername, getById
$user_gateway = new UserGateway($database);

//Initialize JWT Token with methods: encode, decode

$codec = new JWTCodec($_ENV["SECRET_KEY"]);

//Initialize Auth, methods: authenticateAccessToken, getUserID

$auth = new Auth($user_gateway, $codec);

//Method of auth checking if token is invalid signature or expired
if (!$auth->authenticateAccessToken()) {
    exit;
}

$user_id = $auth->getUserID();

$pdo = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['csv_file']['tmp_name'])) {

    $fileType = $_FILES['csv_file']['type'];

    // Check if the file is a CSV by comparing the MIME type
    if ($fileType === 'text/csv' || $fileType === 'application/vnd.ms-excel') {

        try {
            $file = $_FILES['csv_file']['tmp_name'];
            $handle = fopen($file, "r");

            // Assuming the first row contains column headers
            $headers = fgetcsv($handle, 1000, ",");

            while (($data = fgetcsv($handle, 1000, ",")) !== false) {
                $uploadparams = [
                    'month' => $data[0],
                    'year' => $data[1],
                    'branch' => $data[2],
                    'area' => $data[3],
                    'gross_sales' => $data[4],
                    'cost_of_sales' => $data[5],
                    'expenses' => $data[6],
                    'net_income' => $data[7],
                    'userid' => $user_id,
                ];

                // Prepare and execute the SQL query
                $stmt = $pdo->prepare("INSERT INTO tbl_fsdata ()
                VALUES (default, uuid(), :month, :year, :branch, :area, :gross_sales, :cost_of_sales, :expenses, :net_income, :userid, now())");
                $stmt->execute($uploadparams);
            }

            fclose($handle);

            // Return a response indicating success
            echo json_encode(['message' => 'success']);
        } catch (PDOException $e) {
            // Handle database errors
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        } catch (Exception $e) {
            // Handle other errors
            http_response_code(400);
            echo json_encode(['error' => 'Error: ' . $e->getMessage()]);
        }

    } else {
        // Invalid file type
        http_response_code(400);
        echo json_encode(['error' => 'Invalid file type. Only CSV files are allowed.']);
        exit;
    }
} else {
    // Invalid request or no file submitted
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request or no file submitted.']);
    exit;
}
