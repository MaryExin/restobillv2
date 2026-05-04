<?php

declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

//Send Email Verification

// Email

$emailController = new EmailSendController();

$emailController->sendEmail("mail.exinnovph.com", "admin@exinnovph.com",

    "ExinnovEmail@2025", "admin@exinnovph.com", "admin@exinnovph.com", "Your OTP",

    "<html>



    <body>



        <center>



            <img src='https://exinnovph.com/images/app/logo.png' alt='Logo' width='100'><br>



            <p style='font-size: 20px;'>Hello Test One<br><br>Your One-Time Password (OTP) for secure verification is:



                <span style='font-weight: bold; font-size: 20px;



                background-color: rgb(30, 84, 29); color: white; padding: 2px 8px; border-radius: 10px;'>



                Test One



                </span><br> <br> Please use this OTP to complete your login or transaction.



                <br> If you did not request this OTP, please ignore this message. <br> Thank you <br> </p>



        </center>



    </body>



    </html>"

);
