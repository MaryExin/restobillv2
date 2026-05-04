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

                <img src='https://exinnovph.com/images/app/logo.png' alt='Logo'>

            </div>

            <div class='email-body'>

                <p><strong>Dear Ma'am/Sir,</strong></p>

                <p><strong>Congratulations and welcome aboard! 🎉</strong></p>

                <p><strong>You’ve just unlocked your 1 month discount of Exinnov, starting today. 

                Dive in and enjoy our all-in-one command center—manage sales, inventory, accounting, and business intelligence with ease.

                The entire Exinnov team is here to support you every step of the way—let’s transform your business together! 🚀*</strong></p>

             

                <p>Out team will provide your user credentials through the email that you have registered</p>

                <p>Once you have your credentials, we have a Video Tutorials which will walk you through how to use our system and how can it help streamline your business operations, improve efficiency, and integrate key processes seamlessly.</p>



                <p>If you have any specific concerns or questions , please let us know in our Facebook Page or email</p>



                <p>We look forward in assisting you and showcasing how Exinnov System can support your business!</p><br>



                <p>Best regards,</p>

                <p>The Exinnov Team</p>

                <p>systems.Exinnov@gmail.com</p>

                <p>www.Exinnovph.dev</p>



            </div>

        </div>

    </body>

</html>";







    $emailController = new EmailSendController();

    $emailController->sendEmail(

        "mail.exinnovph.com",

        "admin@exinnovph.com",   

        "ExinnovEmail@2025",       

        "admin@exinnovph.com",

        $data["email"],

        "Demo Schedule Confirmation - Exinnov",

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

                <img src='https://exinnovph.com/images/app/logo.png' alt='Logo'>

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

                    <strong>Preffered Start Date:</strong> <span class='highlight'>{$data["demodate"]}</span><br>

                    <strong>Preffered Start Time:</strong> <span class='highlight'>{$formattedTime}</span><br>

                </p>

            </div>

            <div class='email-footer'>

                <p>The <strong>Exinnov</strong> Team</p>

            </div>

        </div>

    </body>

</html>";



 $cc = ['maryentrepsbpo@gmail.com', 'kim.Exinnovph@gmail.com',

  'systems.Exinnov@gmail.com', 'jdelarentrepsbpo@gmail.com', 'marondiraizel@gmail.com'];



    $emailController = new EmailSendController();

    $emailController->sendEmailtoBoard(

        "mail.exinnovph.com",

        "admin@exinnovph.com",   

        "ExinnovEmail@2025",       

        "admin@exinnovph.com",

        "admin@exinnovph.com",

        $cc,

        "New Client to Onboard",

        $emaiBoardlContent

    );



    $conn = $database->getConnection();





    $sql = "INSERT INTO tbl_inquiry (

            inquiry_code, fullname, position, company_name, email, 

            contact_no, business_type, no_of_busunits, current_system, 

            main_concern, preferred_date, preferred_time, status, deletestatus, createdtime

        ) VALUES (

            CONCAT('IQ-', ShortUUID()), :fullname, :position, :company_name, :email, 

            :contact_no, :business_type, :no_of_busunits, :current_system, 

            :main_concern, :preferred_date, :preferred_time, 'Pending', 'Active', DATE_ADD(NOW(), INTERVAL 8 HOUR)

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

