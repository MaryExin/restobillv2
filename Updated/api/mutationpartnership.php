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

try {


$emailContent = "<html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }
            .email-container {
                max-width: 600px;
                background-color: #ffffff;
                margin: 20px auto;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
            }
            .email-header {
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 2px solid #eeeeee;
            }
            .email-header img {
                max-width: 200px;
            }
            .email-body {
                padding: 20px;
                color: #333;
                line-height: 1.6;
            }
            .email-body p {
                font-size: 16px;
            }
            .email-body strong {
                color: #333;
            }
            .highlight-blue {
                color: #007bff; /* Changed to blue for date & time */
                font-weight: bold;
            }
            .highlight {
                color: #e63946; /* Keeping red for emphasis elsewhere */
                font-weight: bold;
            }
            .email-footer {
                text-align: center;
                padding-top: 20px;
                border-top: 2px solid #eeeeee;
                font-size: 14px;
                color: #666;
            }
            .cta-button {
                display: inline-block;
                background-color: #e63946;
                color: white;
                padding: 12px 20px;
                text-decoration: none;
                border-radius: 5px;
                font-size: 16px;
                font-weight: bold;
                margin-top: 20px;
            }
            .cta-button:hover {
                background-color: #d62839;
            }
        </style>
    </head>
    <body>
        <div class='email-container'>
            <div class='email-header'>
                <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo'>
            </div>
            <div class='email-body'>
                <p><strong>Dear Ma'am/Sir,</strong></p>
                <p><strong>Thank you for your interest in partnering with us. We have received your request with the following details:</strong></p>
                
                <p>
                    <strong>*Name:*</strong> {$data["completeName"]}<br>
                    <strong>*Profession:*</strong> {$data["profession"]}<br>
                    <strong>*Company:*</strong> {$data["compName"]}<br>
                    <strong>*Count of target potential clients:*</strong> {$data["targetClients"]}<br>
                    <strong>*Contact:*</strong> {$data["PhoneNumber"]}<br>
                    <strong>*Email:*</strong> {$data["email"]}<br>
                    <strong>*Address:*</strong> {$data["address"]}<br>
                    <strong>*Gender:*</strong> {$data["gender"]}<br>
                    <strong>*Lightem products that  you are interested in:*</strong> {$data["lightemProducts"]}<br>
                </p>

                <p>We will review your partnership request and get back to you shortly to discuss the next steps. Our team will reach out via email or phone for further coordination.</p>
                <p>During our discussion, we will explore how our collaboration can bring mutual benefits, align with our goals, and create valuable opportunities.</p>

                <p>If there are specific aspects of the partnership you'd like to highlight or discuss, please let us know in advance.</p>

                <p>We look forward to working with you and growing together!</p><br>

                <p>Best regards,</p>
                <p>The Lightem Team</p>
                <p>admin@lightemsupport.com</p>
                <p>lightemsupport.com</p>

            </div>

        </div>
    </body>
</html>";



    $emailController = new EmailSendController();
    $emailController->sendEmail(
        "mail.lightemsupport.com",
        "accounts@lightemsupport.com",   
        "LightemAccounts@2025",       
        "accounts@lightemsupport.com",
        $data["email"],
        "Lightem Partnership - Lightem Business Solution",
        $emailContent
    );

$emaiBoardlContent = "<html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }
            .email-container {
                max-width: 600px;
                background-color: #ffffff;
                margin: 20px auto;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
            }
            .email-header {
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 2px solid #eeeeee;
            }
            .email-header img {
                max-width: 200px;
            }
            .email-body {
                padding: 20px;
                color: #333;
                line-height: 1.6;
            }
            .email-body p {
                font-size: 16px;
            }
            .email-body strong {
                color: #333;
            }
            .highlight {
                color: #007bff; /* Changed to blue */
                font-weight: bold;
            }
            .email-footer {
                text-align: center;
                padding-top: 20px;
                border-top: 2px solid #eeeeee;
                font-size: 14px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class='email-container'>
            <div class='email-header'>
                <img src='https://lightemsupport.com/images/app/logo.png' alt='Logo'>
            </div>
            <div class='email-body'>
                <p><strong>Partnership Details:</strong></p>
                <p>
                    <strong>*Name:*</strong> {$data["completeName"]}<br>
                    <strong>*Profession:*</strong> {$data["profession"]}<br>
                    <strong>*Company:*</strong> {$data["compName"]}<br>
                    <strong>*Count of target potential clients:*</strong> {$data["targetClients"]}<br>
                    <strong>*Contact:*</strong> {$data["PhoneNumber"]}<br>
                    <strong>*Email:*</strong> {$data["email"]}<br>
                    <strong>*Address:*</strong> {$data["address"]}<br>
                    <strong>*Gender:*</strong> {$data["gender"]}<br>
                    <strong>*Lightem products that interested in:*</strong> {$data["lightemProducts"]}<br>
                </p>
            </div>
            <div class='email-footer'>
                <p>The <strong>Lightem</strong> Team</p>
            </div>
        </div>
    </body>
</html>";




 $cc = ['lenardparaiso8@gmail.com', 'maryexinnov@gmail.com', 'charliebpanao12@gmail.com' , 'delacruzjennelyn15@gmail.com' ,'jeremiah.richwell@outlook.com', 'bposarahjanegarcia@gmail.com', 'silverioj824@gmail.com', 'ofalsalordmichael@gmail.com', 'kim.lightemph@gmail.com', 'jhetprix2024@gmail.com'];


    $emailController = new EmailSendController();
    $emailController->sendEmailtoBoard(
        "mail.lightemsupport.com",
        "accounts@lightemsupport.com",   
        "LightemAccounts@2025",       
        "accounts@lightemsupport.com",
        "accounts@lightemsupport.com",
        $cc,
        "Partnership Request by New Client",
        $emaiBoardlContent
    );

    $conn = $database->getConnection();


    $sql = "INSERT INTO tbl_partnership (
        partnership_code, fullname, profession, company_name, target_industry, 
        count_of_target_clients, contact_no, email, address, gender, 
        lightem_products, deletestatus, createdtime
    ) VALUES (
        CONCAT('PR-', ShortUUID()), :fullname, :profession, :company_name, :target_industry, 
        :count_of_target_clients, :contact_no, :email, :address, :gender, 
        :lightem_products, 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR)
    )";

    $stmt = $conn->prepare($sql);
    
    $stmt->bindValue(":fullname", $data["completeName"], PDO::PARAM_STR);
    $stmt->bindValue(":profession", $data["profession"], PDO::PARAM_STR);
    $stmt->bindValue(":company_name", $data["compName"], PDO::PARAM_STR);
    $stmt->bindValue(":target_industry", $data["targetIndustry"], PDO::PARAM_STR);
    $stmt->bindValue(":count_of_target_clients", $data["targetClients"], PDO::PARAM_STR);
    $stmt->bindValue(":contact_no", $data["PhoneNumber"], PDO::PARAM_STR);
    $stmt->bindValue(":email", $data["email"], PDO::PARAM_STR);
    $stmt->bindValue(":address", $data["address"], PDO::PARAM_STR);
    $stmt->bindValue(":gender", $data["gender"], PDO::PARAM_STR);
    $stmt->bindValue(":lightem_products", $data["lightemProducts"], PDO::PARAM_STR);
    
    $stmt->execute();


    echo json_encode(["message" => "Success"]);
    exit;

} catch (PDOException $e) {

    echo "Error: " . $e->getMessage();
}
