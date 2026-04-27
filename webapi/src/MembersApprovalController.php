<?php
// MembersApprovalController.php ✅ approve => Status Active + reset password + email (+ companycode)
class MembersApprovalController
{


    private MembersApprovalGateway $gateway;
    private int $user_id;

    public function __construct(MembersApprovalGateway $gateway, int $user_id)
    {
        $this->gateway = $gateway;
        $this->user_id = $user_id;
    }

    public function processRequest(string $method, ?string $memberId, ?string $status, ?string $companycode = ""): void
    {
        if ($method !== "PATCH") {
            $this->respondMethodNotAllowed("PATCH");
            return;
        }

        if (empty($memberId)) {
            http_response_code(400);
            echo json_encode(["message" => "missingId"]);
            return;
        }

        // Ensure member exists
        $member = $this->gateway->getForUser($memberId);
        if (!$member) {
            $this->respondNotFound($memberId);
            return;
        }

        // REJECT
        if (strtolower((string) $status) === "rejected") {
            $rows = $this->gateway->rejectMemberQueuing($memberId);
            echo json_encode([
                "message" => "memberrejected",
                "rows"    => $rows,
            ]);
            return;
        }

        // APPROVE => update status + reset password + email
        try {
            $result = $this->gateway->approveMemberQueuingAndResetPassword(
                $memberId,
                10,
                (string) ($_ENV["SECRET_KEY"] ?? "")
            );

            // Send email (do NOT return password to client)
            $emailSent  = false;
            $emailError = null;

            if (!empty($result["email"]) && !empty($result["plainPassword"])) {
                try {
                    $resetUserId     = $memberId;
                    $email           = (string) $result["email"];
                    $randomPassword  = (string) $result["plainPassword"];
                    $cc              = htmlspecialchars((string) $companycode, ENT_QUOTES, "UTF-8");
                    $emailSafe       = htmlspecialchars($email, ENT_QUOTES, "UTF-8");

                    $emailController = new EmailSendController();
                    $emailController->sendEmail(
                        "mail.exinnovph.com",
                        "admin@exinnovph.com",
                        "ExinnovEmail@2025",
                        "admin@exinnovph.com",
                        $email,
                        "Password Reset",
                        "<html>
                            <body>
                                <center>
                                    <img src='https://exinnovph.com/images/app/logo.png'alt='Logo' width='100'><br>
                                    <p style='font-size: 20px;'>
                                        Hello $resetUserId<br><br>

                                        <span style='display:inline-block; font-size: 14px; padding: 6px 10px; border-radius: 12px;
                                            background: #fdecea; color: #b42318; border: 1px solid #f5c2c7; margin: 0 4px;'>
                                            Email: <b>$emailSafe</b>
                                        </span>

                                        <span style='display:inline-block; font-size: 14px; padding: 6px 10px; border-radius: 12px;
                                            background: #fdecea; color: #b42318; border: 1px solid #f5c2c7; margin: 0 4px;'>
                                            Company Code: <b>$cc</b>
                                        </span>

                                        <br><br>
                                        Your New Password is:
                                        <span style='font-weight: bold; font-size: 20px;
                                            background-color: rgb(30, 84, 29); color: white; padding: 2px 8px; border-radius: 10px;'>
                                            $randomPassword
                                        </span>
                                        <br><br>
                                        You can change your password into the user settings menu.
                                        <br>Thank you<br>
                                    </p>
                                </center>
                            </body>
                        </html>"
                    );

                    $emailSent = true;
                } catch (Exception $e) {
                    // Email failure should not block approval/password update
                    $emailError = $e->getMessage();
                }
            }

            echo json_encode([
                "message"     => "memberregistered",
                "rows"        => (int) ($result["rows"] ?? 0),
                "emailSent"   => $emailSent,
                "emailError"  => $emailError,
                "companycode" => (string) $companycode,
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => "serverError", "error" => $e->getMessage()]);
        }
    }

    private function respondMethodNotAllowed(string $allowed_methods): void
    {
        http_response_code(405);
        header("Allow: $allowed_methods");
        echo json_encode(["message" => "methodNotAllowed"]);
    }

    private function respondNotFound(string $id): void
    {
        http_response_code(404);
        echo json_encode(["message" => "Member with ID $id not found"]);
    }
}
