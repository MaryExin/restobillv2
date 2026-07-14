<?php
// 1. SECURITY & CORS HEADERS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

// Handle Preflight Requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. LOADING PHPMailer
require_once __DIR__ . '/PHPMailer/src/Exception.php';
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if ($_SERVER["REQUEST_METHOD"] === 'POST') {
    $json = file_get_contents("php://input");
    $data = json_decode($json, true);

    if (!$data || empty($data['reportData'])) {
        echo json_encode(["status" => "error", "message" => "No data provided."]);
        exit;
    }

    $emailTo    = $data['emailTo'];
    $emailCC    = $data['emailCC'] ?? '';
    $dateFrom   = $data['datefrom'];
    $dateTo     = $data['dateto'];
    $reportData = $data['reportData'];

    // 3. GENERATE CSV IN MEMORY
    $csvFileName = "Daily_Sales_{$dateFrom}_to_{$dateTo}.csv";
    $f = fopen('php://memory', 'r+');
    
    // Add UTF-8 BOM for Excel Compatibility
    fprintf($f, chr(0xEF).chr(0xBB).chr(0xBF));

    // Get headers from the first object
    $headers = array_keys($reportData[0]);
    fputcsv($f, $headers);

    foreach ($reportData as $row) {
        fputcsv($f, $row);
    }

    rewind($f);
    $csvContent = stream_get_contents($f);
    fclose($f);

    // 4. CONFIGURE SMTP AND SEND
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'veegalvez0@gmail.com'; 
        $mail->Password   = 'bghw kbek vnnc mhab'; // Your Google App Password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom('veegalvez0@gmail.com', 'CNC STA MARIA POS');
        $mail->addAddress($emailTo);
        if (!empty($emailCC)) $mail->addCC($emailCC);

        // Attach CSV
        $mail->addStringAttachment($csvContent, $csvFileName);

        $mail->isHTML(true);
        $mail->Subject = "Daily Sales Report: $dateFrom to $dateTo";
        $mail->Body    = "
            <h3>Daily Sales Report Generated</h3>
            <p><b>Period:</b> $dateFrom to $dateTo</p>
            <p>Please find the attached CSV file for the full breakdown.</p>
        ";

        $mail->send();
        echo json_encode(["status" => "success", "message" => "Report sent successfully!"]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Mailer Error: " . $mail->ErrorInfo]);
    }
}