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
        $demotime = $data["demotime"];
    $formattedTime = date("h:i A", strtotime($demotime)); 

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
                <p><strong>Thank you for your interest in our demo. We have received your request with the following details:</strong></p>
                <p><strong>*Demo Details (For Scheduling Confirmation):*</strong></p>
                <p>
                    <strong>*Requested Date:</strong> <span class='highlight-blue'>{$data["demodate"]}</span><br>
                    <strong>*Requested Time:*</strong> <span class='highlight-blue'>{$formattedTime}</span><br>
                    <strong>*Company:*</strong> {$data["compName"]}<br>
                    <strong>*Business Type:*</strong> {$data["businesstype"]}<br>
                    <strong>*No. of Business Unit/s:*</strong> {$data["numberOfUnitBranch"]}<br>
                    <strong>*Attendee:*</strong> {$data["completeName"]}<br>
                    <strong>*Position:*</strong> {$data["position"]}<br>
                    <strong>*Current System:*</strong> {$data["currentsystem"]}<br>
                    <strong>*Main Concern:*</strong> {$data["mainConcern"]}<br>
                    <strong>*Contact:*</strong> {$data["PhoneNumber"]}<br>
                    <strong>*Email:*</strong> {$data["email"]}<br>
                </p>

                <p>We will check our schedule availability and confirm the final demo date and time with you shortly. Our team will reach out via email or phone for further coordination.</p>
                <p>During the demo, we will walk you through how our system can help streamline your business operations, improve efficiency, and integrate key processes seamlessly.</p>

                <p>If you have any specific concerns or areas you'd like us to focus on, please let us know in advance.</p>

                <p>We look forward to connecting with you and showcasing how *Lightem* can support your business!</p><br>

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
        "Demo Schedule Confirmation - Lightem Business Solution",
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
                <p><strong>Client Details:</strong></p>
                <p>
                    <strong>Name:</strong> <span class='highlight'>{$data["completeName"]}</span><br>
                    <strong>Company:</strong> {$data["compName"]}<br>
                    <strong>Position:</strong> {$data["position"]}<br>
                    <strong>Contact Information:</strong> {$data["PhoneNumber"]}<br>
                    <strong>Email:</strong> {$data["email"]}<br>
                    <strong>Business Type:</strong> {$data["businesstype"]}<br>
                    <strong>No of Business Unit/s:</strong> {$data["numberOfUnitBranch"]}<br>
                    <strong>Current System:</strong> {$data["currentsystem"]}<br>
                    <strong>Main Concern:</strong> {$data["mainConcern"]}<br>
                    <strong>Preffered Demo Date:</strong> <span class='highlight'>{$data["demodate"]}</span><br>
                    <strong>Preffered Demo Time:</strong> <span class='highlight'>{$formattedTime}</span><br>
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
        "Request for Demo by New Client",
        $emaiBoardlContent
    );

    $conn = $database->getConnection();


    $sql = "INSERT INTO tbl_inquiry (
            inquiry_code, fullname, position, company_name, email, 
            contact_no, business_type, no_of_busunits, current_system, 
            main_concern, preferred_date, preferred_time, createdtime, status
        ) VALUES (
            CONCAT('IQ-', ShortUUID()), :fullname, :position, :company_name, :email, 
            :contact_no, :business_type, :no_of_busunits, :current_system, 
            :main_concern, :preferred_date, :preferred_time, DATE_ADD(NOW(), INTERVAL 8 HOUR), 'Pending'
        )";

    $stmt = $conn->prepare($sql);
    
    $stmt->bindValue(":fullname", $data["completeName"], PDO::PARAM_STR);
    $stmt->bindValue(":position", $data["position"], PDO::PARAM_STR);
    $stmt->bindValue(":company_name", $data["compName"], PDO::PARAM_STR);
    $stmt->bindValue(":email", $data["email"], PDO::PARAM_STR);
    $stmt->bindValue(":contact_no", $data["PhoneNumber"], PDO::PARAM_STR);
    $stmt->bindValue(":business_type", $data["businesstype"], PDO::PARAM_STR);
    $stmt->bindValue(":no_of_busunits", $data["numberOfUnitBranch"], PDO::PARAM_STR);
    $stmt->bindValue(":current_system", $data["currentsystem"], PDO::PARAM_STR);
    $stmt->bindValue(":main_concern", $data["mainConcern"], PDO::PARAM_STR);
    $stmt->bindValue(":preferred_date", $data["demodate"], PDO::PARAM_STR);
    $stmt->bindValue(":preferred_time", $formattedTime, PDO::PARAM_STR);
    
    $stmt->execute();

    echo json_encode(["message" => "Success"]);
    exit;

} catch (PDOException $e) {

    echo "Error: " . $e->getMessage();
}
