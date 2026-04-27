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
    $conn = $database->getConnection();

    $sql = "SELECT t1.email,t2.name as company,CONCAT(t1.firstname,' ',t1.lastname) as fullName FROM tbl_employees AS t1 LEFT JOIN lkp_busunits as t2 on t1.busunit_code = t2.busunitcode WHERE t1.empid = :uuid";

    $stmt = $conn->prepare($sql);

    $stmt->bindValue(":uuid", $data["empid"], PDO::PARAM_STR);
   
    $stmt->execute();
    
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $emailContent = "<html>
                        <body style='font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;'>
                            <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);'>
                                <div style='text-align: center;'>
                                    <img src='https://exinnovph.com/images/app/logo.png' alt='Logo' width='150' style='margin-bottom: 20px;'>
                                </div>
                                <p style='font-size: 18px; color: #333333;'>User: {$row["fullName"]},</p>
                                <p style='font-size: 16px; color: #555555; line-height: 1.5;'>
                                    Your ticket has been successfully submitted. Here are the details of your ticket:
                                </p>
                                <table style='width: 100%; margin-top: 20px; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; font-weight: bold; color: #333333;'>Ticket Type:</td>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; color: #555555;'>{$data["tickettype"]}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; font-weight: bold; color: #333333;'>Ticket Description:</td>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; color: #555555;'>{$data["ticketdescription"]}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; font-weight: bold; color: #333333;'>Ticket Priority:</td>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; color: #555555;'>{$data["priority"]}</td>
                                    </tr>
                                </table>
                                <p style='font-size: 16px; color: #555555; line-height: 1.5; margin-top: 20px;'>
                                    Our support team will review your ticket and get back to you as soon as possible.
                                </p>
                                <p style='font-size: 16px; color: #333333;'>Best regards,<br>The Support Team</p>
                            </div>
                        </body>
                    </html>";


    $emailController = new EmailSendController();
    $emailController->sendEmail(
        "mail.exinnovph.com",
        "admin@exinnovph.com",   
        "ExinnovEmail@2025",       
        "admin@exinnovph.com",
        $row["email"],
        "{$row["fullName"]} submitted Ticket",
        $emailContent
    );

    $emailBoardlContent = "
                    <html>
                        <body style='font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;'>
                            <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);'>
                                <div style='text-align: center;'>
                                    <img src='https://exinnovph.com/images/app/logo.png' alt='Logo' width='150' style='margin-bottom: 20px;'>
                                </div>
                                <p style='font-size: 18px; color: #333333;'>Hello,</p>
                                <p style='font-size: 16px; color: #555555; line-height: 1.5;'>
                                    A new ticket has been submitted by {$row["fullName"]} from {$row["company"]}. Here are the details of the submission:
                                </p>
                                <table style='width: 100%; margin-top: 20px; border-collapse: collapse;'>
                                    <tr>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; font-weight: bold; color: #333333;'>Ticket Category:</td>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; color: #555555;'>{$data["tickettype"]}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; font-weight: bold; color: #333333;'>Description:</td>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; color: #555555;'>{$data["ticketdescription"]}</td>
                                    </tr>
                                    <tr>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; font-weight: bold; color: #333333;'>Priority Level:</td>
                                        <td style='padding: 10px; border-bottom: 1px solid #dddddd; color: #555555;'>{$data["priority"]}</td>
                                    </tr>
                                </table>
                                <p style='font-size: 16px; color: #555555; line-height: 1.5; margin-top: 20px;'>
                                    You will be notified with further updates once the ticket has been processed.
                                </p>
                                <p style='font-size: 16px; color: #333333;'>Best regards,<br>The Support Team</p>
                            </div>
                        </body>
                    </html>";


                // 

    $cc = ['maryentrepsbpo@gmail.com', 'charliebpanao12@gmail.com' , 'delacruzjennelyn15@gmail.com' ,'jeremiah.richwell@outlook.com'];
    //   $cc = ['gurayshimron@gmail.com'];

    $emailController = new EmailSendController();
    $emailController->sendEmailtoBoard(
        "mail.exinnovph.com",
        "admin@exinnovph.com",   
        "ExinnovEmail@2025",       
        "admin@exinnovph.com",
        "admin@exinnovph.com",
        $cc,
        "{$row["fullName"]} submitted new Ticket",
        $emailBoardlContent
    );

    echo json_encode(["message" => "Success"]);
    exit;

} catch (PDOException $e) {

    echo "Error: " . $e->getMessage();
}
