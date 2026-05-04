<?php

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

class EmailSendController
{
    public function __construct()
    {}

    public function sendEmail($host, $username, $password, $from, $to, $subject, $body)
    {
        // Create a new PHPMailer instance
        $mail = new PHPMailer(true);

        try {
            // Server settings
            $mail->SMTPDebug = 0; // Set to 2 for debugging
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->SMTPAuth = true;
            $mail->Username = $username;
            $mail->Password = $password;
            $mail->SMTPSecure = 'ssl'; // Change to 'ssl' for SSL encryption if needed
            $mail->Port = 465;

            // Recipients
            $mail->setFrom($from);
            $mail->addAddress($to);

            // Email content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $body;

            // Send the email
            $mail->send();

        } catch (Exception $e) {
            echo json_encode(["message" => $e->getmessage()]);
        }
    }

    public function sendEmailtoBoard($host, $username, $password, $from, $to, $cc, $subject, $body)
{
    // Create a new PHPMailer instance
    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->SMTPDebug = 0; // Set to 2 for debugging
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->SMTPAuth = true;
        $mail->Username = $username;
        $mail->Password = $password;
        $mail->SMTPSecure = 'ssl'; // Change to 'ssl' for SSL encryption if needed
        $mail->Port = 465;

        // Recipients
        $mail->setFrom($from);
        $mail->addAddress($to);

        // Add CC recipients
        if (!empty($cc)) {
            if (is_array($cc)) {
                foreach ($cc as $ccRecipient) {
                    $mail->addCC($ccRecipient);
                }
            } else {
                $mail->addCC($cc);
            }
        }

        // Email content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $body;

        // Send the email
        $mail->send();
    } catch (Exception $e) {
        echo json_encode(["message" => $e->getmessage()]);
    }
}

}
