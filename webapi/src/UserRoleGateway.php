<?php


class UserRoleGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    /**
     * ✅ NEW: Create a plan subscription request (PRO/PREMIUM) for the AUTHENTICATED USER.
     * Inserts:
     * - roleclass = 'Plan'
     * - rolename = 'PRO' or 'PREMIUM'
     * - role_description = same as rolename (requested)
     * - deletestatus = 'For Review' (requested)
     * - createtime = DATE_ADD(NOW(), INTERVAL 8 HOUR) (PH time request)
     * - payment_* fields stored
     *
     * ✅ NEW: After successful insert, email:
     * 1) User -> "For Review"
     * 2) Internal -> "Plan For Review" with {companycode} + {apiendpoint}
     */
    public function createPlanRequest($user_id, $data): array
    {
        $emailBody = "<html>
                        <body style='margin:0; padding:0; background-color:#ffffff;'>
                            <table
                            align='center'
                            width='100%'
                            cellpadding='0'
                            cellspacing='0'
                            style='max-width:600px; margin:auto; background:#ffffff; font-family:Arial, sans-serif; color:#333333; border-collapse:collapse;'
                            >
                            <!-- Header with Exinnov brand color -->
                            <tr>
                                <td style='padding:20px; text-align:center; background-color:#E5D9B6;'>
                                <img
                                    src='https://exinnovph.com/images/app/logo.png'
                                    alt='Exinnov Logo'
                                    width='120'
                                    style='display:block; margin:auto;'
                                >
                                </td>
                            </tr>

                            <!-- Body -->
                            <tr>
                                <td style='padding:30px;'>
                                <p style='font-size:18px; margin:0 0 20px;'>
                                    From <strong>Exinnov</strong>,
                                </p>

                                <p style='font-size:16px; margin:0 0 14px;'>
                                    <strong>Congratulations!</strong> Your <strong>Plan Upgrade</strong> request was submitted successfully.
                                </p>

                                <p style='font-size:14px; margin:0 0 22px; color:#555555; line-height:1.55;'>
                                    It is now marked for <strong>Payment Review</strong>. Please wait for a while — we will send a confirmation
                                    once your upgraded plan is verified and activated.
                                </p>

                                <p style='text-align:center; margin:0 0 26px;'>
                                    <span
                                    style='
                                        display:inline-block;
                                        font-size:16px;
                                        font-weight:bold;
                                        letter-spacing:0.3px;
                                        padding:12px 22px;
                                        background-color:#E5D9B6;
                                        color:#ffffff;
                                        border-radius:8px;
                                    '
                                    >
                                    Plan Upgrade Submitted ✅
                                    </span>
                                </p>

                                <p style='font-size:13px; margin:0 0 18px; color:#666666; font-style:italic; line-height:1.55;'>
                                    “Your Plan Upgrade was submitted for payment review. Please wait for a while and we will send a confirmation for your upgraded plan.”
                                </p>

                                <p style='font-size:14px; margin:0 0 20px;'>
                                    If you did not request this upgrade, please ignore this email or contact us on our facebook page right away.
                                </p>

                                <p style='font-size:14px; margin:0;'>
                                    Thank you,<br>
                                    <strong>Exinnov Team</strong>
                                </p>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style='padding:15px; text-align:center; font-size:12px; color:#888888;'>
                                © 2026 Exinnov. All rights reserved.
                                </td>
                            </tr>
                            </table>
                        </body>
                        </html>";
                        
        $emailBodyNotify = "<html>
                        <body style='margin:0; padding:0; background-color:#ffffff;'>
                            <table align='center' width='100%' cellpadding='0' cellspacing='0'
                            style='max-width:600px; margin:auto; background:#ffffff; font-family:Arial, sans-serif; color:#333333; border-collapse:collapse;'
                            >
                            <tr>
                                <td style='padding:20px; text-align:center; background-color:#E5D9B6;'>
                                <img
                                    src='https://exinnovph.com/images/app/logo.png'
                                    alt='Exinnov Logo'
                                    width='120'
                                    style='display:block; margin:auto;'
                                >
                                </td>
                            </tr>

                            <tr>
                                <td style='padding:30px;'>
                                <p style='font-size:18px; margin:0 0 16px;'>
                                    <strong>Action Notification</strong> (Subscription Request)
                                </p>

                                <p style='font-size:14px; margin:0 0 18px; color:#555555; line-height:1.55;'>
                                    A <strong>Plan Upgrade</strong> request was submitted and is now marked for <strong>Payment Review</strong>.
                                    Below are the captured details for verification.
                                </p>

                                <p style='text-align:center; margin:0 0 18px;'>
                                    <span style='display:inline-block; font-size:14px; font-weight:bold; letter-spacing:0.3px; padding:10px 18px; background-color:#E5D9B6; color:#ffffff; border-radius:8px;'>
                                    ".htmlspecialchars(($data['email'] ?? ''), ENT_QUOTES, 'UTF-8')." ✅
                                    </span>
                                </p>

                                <div style='margin:0 0 18px; padding:14px; border:1px solid #eeeeee; border-radius:12px; background:#fafafa;'>
                                    <p style='font-size:12px; margin:0 0 10px; color:#777777;'>
                                    Summary (for review)
                                    </p>

                                    <table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse; font-size:13px;'>
                                    <tr>
                                        <td style='padding:8px 10px; width:40%; font-weight:bold; border-bottom:1px solid #eaeaea;'>Email</td>
                                        <td style='padding:8px 10px; border-bottom:1px solid #eaeaea;'>"
                                        .htmlspecialchars(($data['email'] ?? ''), ENT_QUOTES, 'UTF-8').
                                        "</td>
                                    </tr>

                                    <tr>
                                        <td style='padding:8px 10px; font-weight:bold; border-bottom:1px solid #eaeaea;'>Company Code</td>
                                        <td style='padding:8px 10px; border-bottom:1px solid #eaeaea;'>"
                                        .htmlspecialchars(($data['companycode'] ?? ''), ENT_QUOTES, 'UTF-8').
                                        "</td>
                                    </tr>

                                    <tr>
                                        <td style='padding:8px 10px; font-weight:bold; border-bottom:1px solid #eaeaea;'>Plan</td>
                                        <td style='padding:8px 10px; border-bottom:1px solid #eaeaea;'>"
                                        .htmlspecialchars(($data['plan'] ?? ''), ENT_QUOTES, 'UTF-8').
                                        "</td>
                                    </tr>

                                    <tr>
                                        <td style='padding:8px 10px; font-weight:bold; border-bottom:1px solid #eaeaea;'>Payment Amount</td>
                                        <td style='padding:8px 10px; border-bottom:1px solid #eaeaea;'>"
                                        .htmlspecialchars(($data['payment_amount'] ?? ''), ENT_QUOTES, 'UTF-8').
                                        "</td>
                                    </tr>

                                    <tr>
                                        <td style='padding:8px 10px; font-weight:bold; border-bottom:1px solid #eaeaea;'>Payment Mode</td>
                                        <td style='padding:8px 10px; border-bottom:1px solid #eaeaea;'>"
                                        .htmlspecialchars(($data['payment_mode'] ?? ''), ENT_QUOTES, 'UTF-8').
                                        "</td>
                                    </tr>

                                    <tr>
                                        <td style='padding:8px 10px; font-weight:bold; border-bottom:1px solid #eaeaea;'>Payment Reference</td>
                                        <td style='padding:8px 10px; border-bottom:1px solid #eaeaea;'>"
                                        .htmlspecialchars(($data['payment_reference'] ?? ''), ENT_QUOTES, 'UTF-8').
                                        "</td>
                                    </tr>

                                    <tr>
                                        <td style='padding:8px 10px; font-weight:bold; border-bottom:1px solid #eaeaea;'>Agreement Accepted</td>
                                        <td style='padding:8px 10px; border-bottom:1px solid #eaeaea;'>"
                                        .htmlspecialchars(($data['agreement_accepted'] ?? ''), ENT_QUOTES, 'UTF-8').
                                        "</td>
                                    </tr>

                                    <tr>
                                        <td style='padding:8px 10px; font-weight:bold; border-bottom:1px solid #eaeaea;'>API Endpoint</td>
                                        <td style='padding:8px 10px; border-bottom:1px solid #eaeaea; word-break:break-all;'>"
                                        .htmlspecialchars(($data['apiendpoint'] ?? ''), ENT_QUOTES, 'UTF-8').
                                        "</td>
                                    </tr>
                                    </table>
                                </div>

                                <p style='font-size:13px; margin:0 0 14px; color:#666666; font-style:italic; line-height:1.55;'>
                                    “Please review the payment reference and verify the subscription upgrade before activation.”
                                </p>

                                <p style='font-size:14px; margin:0;'>
                                    Thank you,<br>
                                    <strong>Exinnov System</strong>
                                </p>
                                </td>
                            </tr>

                            <tr>
                                <td style='padding:15px; text-align:center; font-size:12px; color:#888888;'>
                                © 2026 Exinnov. All rights reserved.
                                </td>
                            </tr>
                            </table>
                        </body>
                        </html>";



        try {
            $plan = strtoupper(trim($data["plan"] ?? ""));

            if (!in_array($plan, ["PRO", "PREMIUM"], true)) {
                http_response_code(422);
                return ["message" => "Invalid plan."];
            }

            $amount = $data["payment_amount"] ?? null;
            $payref = trim($data["payment_reference"] ?? "");
            $paymode = trim($data["payment_mode"] ?? "");
            $agree = (bool)($data["agreement_accepted"] ?? false);

            if (!$agree) {
                http_response_code(422);
                return ["message" => "Agreement is required."];
            }

            if ($payref === "" || $paymode === "") {
                http_response_code(422);
                return ["message" => "Payment reference and mode of payment are required."];
            }

            if ($amount === null || $amount === "" || !is_numeric($amount)) {
                http_response_code(422);
                return ["message" => "Valid payment amount is required."];
            }

            // ✅ prevent duplicate pending/active plan requests
            $sql = "SELECT uuid
                    FROM tbl_user_roles
                    WHERE userid = :userid
                      AND roleclass = 'Plan'
                      AND rolename IN ('PRO','PREMIUM','UNLIMITED')
                      AND deletestatus IN ('Active','For Review')
                    LIMIT 1";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":userid", $user_id, PDO::PARAM_STR);
            $stmt->execute();

            if ($stmt->rowCount() > 0) {
                http_response_code(409);
                return ["message" => "You already have an active or pending plan request."];
            }

            // ✅ Insert plan request
            $sql = "INSERT INTO tbl_user_roles
                        (uuid, userid, roleclass, rolename, role_description,
                         deletestatus, usertracker, createtime,
                         payment_amount, payment_reference, payment_mode)
                    VALUES
                        (CONCAT('RL-', shortUUID()), :userid, 'Plan', :rolename, :roledesc,
                         'For Review', :usertracker, DATE_ADD(NOW(), INTERVAL 8 HOUR),
                         :amount, :payref, :paymode)";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":userid", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":rolename", $plan, PDO::PARAM_STR);
            $stmt->bindValue(":roledesc", $plan, PDO::PARAM_STR);
            $stmt->bindValue(":usertracker", $user_id, PDO::PARAM_STR);
            $stmt->bindValue(":amount", $amount, PDO::PARAM_STR);
            $stmt->bindValue(":payref", $payref, PDO::PARAM_STR);
            $stmt->bindValue(":paymode", $paymode, PDO::PARAM_STR);
            $stmt->execute();

            // ✅ Trigger emails ONLY upon successful insert
            $companycode = trim((string)($data["companycode"] ?? ""));
            $apiendpoint = trim((string)($data["apiendpoint"] ?? ""));
            // $this->notifyPlanForReviewEmails((string)$user_id, $plan, (string)$amount, $paymode, $payref, $companycode, $apiendpoint);
        $emailController = new EmailSendController();

        $emailController->sendEmail("mail.exinnovph.com", "admin@exinnovph.com",

    "ExinnovEmail@2025", "admin@exinnovph.com", $data["email"], "Plan Upgrade", $emailBody);

    //Notify Admin 

    $notifyRecipients = [
                            "jeremiah.richwell@outlook.com",
                        ];

    foreach ($notifyRecipients as $to) {
    $emailController->sendEmail(
        "mail.exinnovph.com",
        "admin@exinnovph.com",
        "ExinnovEmail@2025",
        "admin@exinnovph.com",
        $to,
        "Plan Upgrade (For Review)",
        $emailBodyNotify);}

    return ["message" => "Submitted for review. Activation will follow after verification."];

        } catch (Exception $e) {
            http_response_code(500);
            return ["message" => $e->getMessage()];
        }
    }

    /**
     * ✅ NEW: Send plan-for-review emails (user + internal).
     * Uses existing EmailSendController().
     */
private function notifyPlanForReviewEmails(
    string $user_id,
    string $plan,
    string $amount,
    string $paymode,
    string $payref,
    string $companycode,
    string $apiendpoint
){

    // ✅ Email settings (same as OTP)
    $smtpHost  = "mail.exinnovph.com";
    $smtpUser  = "admin@exinnovph.com";
    $smtpPass  = "ExinnovEmail@2025";
    $fromEmail = "admin@exinnovph.com";

    try {
        $emailController = new EmailSendController();

        // ---------------------------------------------------
        // 1) Resolve user's email + empid (UUID-first)
        // ---------------------------------------------------
        $userEmail = "";
        $userName  = $user_id;
        $empid     = "";

        // ✅ Most common in your system: $user_id is UUID (login flow uses $user["uuid"])
        $stmt = $this->conn->prepare("
            SELECT email, empid
            FROM tbl_users_global_assignment
            WHERE uuid = :id
            LIMIT 1
        ");
        $stmt->bindValue(":id", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        $uga = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($uga) {
            if (!empty($uga["email"])) $userEmail = (string)$uga["email"];
            if (!empty($uga["empid"])) $empid = (string)$uga["empid"];
        }

        // Fallback: maybe token/user_id is empid in some older flows
        if ($userEmail === "") {
            $stmt = $this->conn->prepare("
                SELECT email
                FROM tbl_users_global_assignment
                WHERE empid = :id
                LIMIT 1
            ");
            $stmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row && !empty($row["email"])) {
                $userEmail = (string)$row["email"];
                $empid = $user_id; // use for name lookup
            }
        }

        // Resolve fullname (tbl_employees uses empid)
        if ($empid !== "") {
            $stmt = $this->conn->prepare("
                SELECT CONCAT(firstname,' ',lastname) AS fullname
                FROM tbl_employees
                WHERE empid = :empid
                LIMIT 1
            ");
            $stmt->bindValue(":empid", $empid, PDO::PARAM_STR);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row["fullname"])) {
                $userName = (string)$row["fullname"];
            }
        }

        // ---------------------------------------------------
        // 2) Email user (only if email found)
        // ---------------------------------------------------
        if ($userEmail !== "") {

            $subjectUser = "Exinnov Plan Upgrade - For Review";

            $safeAmount = htmlspecialchars((string)$amount, ENT_QUOTES, "UTF-8");
            $safeMop    = htmlspecialchars((string)$paymode, ENT_QUOTES, "UTF-8");
            $safeRef    = htmlspecialchars((string)$payref, ENT_QUOTES, "UTF-8");
            $safeName   = htmlspecialchars((string)$userName, ENT_QUOTES, "UTF-8");
            $safePlan   = htmlspecialchars((string)$plan, ENT_QUOTES, "UTF-8");

            $bodyUser = "
            <html>
              <body style='margin:0; padding:0; background-color:#ffffff;'>
                <table align='center' width='100%' cellpadding='0' cellspacing='0'
                  style='max-width:600px; margin:auto; background:#ffffff; font-family:Arial, sans-serif; color:#333333; border-collapse:collapse;'>
                  <tr>
                    <td style='padding:20px; text-align:center; background-color:darkgray;'>
                      <img src='https://exinnovph.com/images/app/logo.png' alt='Exinnov Logo'
                        width='120' style='display:block; margin:auto;'>
                    </td>
                  </tr>

                  <tr>
                    <td style='padding:30px;'>
                      <p style='font-size:18px; margin:0 0 16px;'>Hi <strong>{$safeName}</strong>,</p>

                      <p style='font-size:15px; margin:0 0 16px;'>
                        We received your <strong>{$safePlan}</strong> plan upgrade request. Your payment details are now marked as
                        <strong>For Review</strong>.
                      </p>

                      <div style='border:1px solid #eee; border-radius:10px; padding:14px; background:#fafafa; margin:0 0 16px;'>
                        <p style='margin:0 0 6px; font-size:14px;'><strong>Plan:</strong> {$safePlan}</p>
                        <p style='margin:0 0 6px; font-size:14px;'><strong>Amount:</strong> ₱{$safeAmount}</p>
                        <p style='margin:0 0 6px; font-size:14px;'><strong>Mode of Payment:</strong> {$safeMop}</p>
                        <p style='margin:0; font-size:14px;'><strong>Payment Reference:</strong> {$safeRef}</p>
                      </div>

                      <p style='font-size:14px; margin:0 0 10px;'>
                        Once verified, your plan will be activated and will expire after <strong>1 year</strong> from activation.
                      </p>

                      <p style='font-size:14px; margin:0;'>
                        Thank you,<br>
                        <strong>Exinnov Team</strong>
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style='padding:15px; text-align:center; font-size:12px; color:#888888;'>
                      © 2025 Exinnov. All rights reserved.
                    </td>
                  </tr>
                </table>
              </body>
            </html>";

            $ok = $emailController->sendEmail(
                $smtpHost,
                $smtpUser,
                $smtpPass,
                $fromEmail,
                $userEmail,
                $subjectUser,
                $bodyUser
            );

            // If your sendEmail() returns bool, this helps debug.
            if ($ok === false) {
                error_log("[PLAN EMAIL] sendEmail(user) returned false. to={$userEmail} user_id={$user_id}");
            }

        } else {
            error_log("[PLAN EMAIL] No user email found for user_id={$user_id} (uuid/empid lookup failed)");
        }

        // ---------------------------------------------------
        // 3) Email internal recipients (always)
        // ---------------------------------------------------
        $subjectAdmin = "PLAN FOR REVIEW: " . strtoupper($plan);

        $companyText = $companycode !== "" ? htmlspecialchars($companycode, ENT_QUOTES, "UTF-8") : "(no companycode provided)";
        $apiText     = $apiendpoint !== "" ? htmlspecialchars($apiendpoint, ENT_QUOTES, "UTF-8") : "(no apiendpoint provided)";

        $safeAmount = htmlspecialchars((string)$amount, ENT_QUOTES, "UTF-8");
        $safeMop    = htmlspecialchars((string)$paymode, ENT_QUOTES, "UTF-8");
        $safeRef    = htmlspecialchars((string)$payref, ENT_QUOTES, "UTF-8");
        $safeUid    = htmlspecialchars((string)$user_id, ENT_QUOTES, "UTF-8");
        $safeName   = htmlspecialchars((string)$userName, ENT_QUOTES, "UTF-8");
        $safePlan   = htmlspecialchars((string)$plan, ENT_QUOTES, "UTF-8");
        $safeUEmail = htmlspecialchars((string)$userEmail, ENT_QUOTES, "UTF-8");

        $bodyAdmin = "
        <html>
          <body style='margin:0; padding:0; background-color:#ffffff;'>
            <table align='center' width='100%' cellpadding='0' cellspacing='0'
              style='max-width:700px; margin:auto; background:#ffffff; font-family:Arial, sans-serif; color:#333333; border-collapse:collapse;'>
              <tr>
                <td style='padding:18px; text-align:center; background-color:darkgray;'>
                  <img src='https://exinnovph.com/images/app/logo.png' alt='Exinnov Logo'
                    width='120' style='display:block; margin:auto;'>
                </td>
              </tr>

              <tr>
                <td style='padding:24px;'>
                  <p style='font-size:16px; margin:0 0 12px;'>
                    A plan upgrade request is now <strong>FOR REVIEW</strong>.
                  </p>

                  <div style='border:1px solid #eee; border-radius:10px; padding:14px; background:#fafafa;'>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>Requested Plan:</strong> {$safePlan}</p>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>User ID:</strong> {$safeUid}</p>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>User Name:</strong> {$safeName}</p>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>User Email:</strong> {$safeUEmail}</p>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>Company Code:</strong> {$companyText}</p>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>API Endpoint:</strong> {$apiText}</p>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>Amount:</strong> ₱{$safeAmount}</p>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>MOP:</strong> {$safeMop}</p>
                    <p style='margin:0; font-size:14px;'><strong>Reference:</strong> {$safeRef}</p>
                  </div>

                  <p style='font-size:12px; color:#666; margin:14px 0 0;'>
                    Please verify payment and activate the plan accordingly.
                  </p>
                </td>
              </tr>

              <tr>
                <td style='padding:15px; text-align:center; font-size:12px; color:#888888;'>
                  © 2025 Exinnov. Internal notification.
                </td>
              </tr>
            </table>
          </body>
        </html>";

        $internalRecipients = [
            "jdelarentrepsbpo@gmail.com"
        ];

        foreach ($internalRecipients as $toEmail) {
            $ok = $emailController->sendEmail(
                $smtpHost,
                $smtpUser,
                $smtpPass,
                $fromEmail,
                $toEmail,
                $subjectAdmin,
                $bodyAdmin
            );

            if ($ok === false) {
                error_log("[PLAN EMAIL] sendEmail(admin) returned false. to={$toEmail} user_id={$user_id}");
            }
        }

    } catch (Throwable $e) {
        // ✅ while debugging, don't keep silent
        error_log("[PLAN EMAIL ERROR] " . $e->getMessage());
    }
}




    /**
     * ✅ NEW: Ensure target user inherits the same PLAN role as the master user (who is adding roles),
     * using the SAME createtime as the master plan row (no NOW()).
     *
     * IMPORTANT:
     * - If master user has NO plan row (FREE), DO NOTHING (do NOT insert any plan for target).
     * - Only propagate if master has PRO / PREMIUM / UNLIMITED with status Active or For Review.
     * - If target already has a plan row, DO NOTHING.
     */
    private function ensurePlanRoleForTarget(string $masterUserId, string $targetUserId): void
    {
        // ✅ Look up master plan (Active preferred, else For Review)
        $sql = "SELECT rolename, role_description, createtime, deletestatus
                FROM tbl_user_roles
                WHERE userid = :master
                  AND roleclass = 'Plan'
                  AND rolename IN ('PRO','PREMIUM','UNLIMITED')
                  AND deletestatus IN ('Active','For Review')
                ORDER BY (deletestatus = 'Active') DESC, createtime DESC
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":master", $masterUserId, PDO::PARAM_STR);
        $stmt->execute();

        $masterPlan = $stmt->fetch(PDO::FETCH_ASSOC);

        // ✅ If master has no plan (FREE), do nothing.
        if (!$masterPlan) {
            return;
        }

        // ✅ If target already has any plan role, do nothing.
        $sql = "SELECT uuid
                FROM tbl_user_roles
                WHERE userid = :target
                  AND roleclass = 'Plan'
                  AND rolename IN ('PRO','PREMIUM','UNLIMITED')
                  AND deletestatus IN ('Active','For Review')
                LIMIT 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":target", $targetUserId, PDO::PARAM_STR);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            return;
        }

        // ✅ Insert plan role for target using MASTER createtime (no NOW)
        $sql = "INSERT INTO tbl_user_roles
                    (uuid, userid, roleclass, rolename, role_description,
                     deletestatus, usertracker, createtime,
                     payment_amount, payment_reference, payment_mode)
                VALUES
                    (CONCAT('RL-', shortUUID()), :userid, 'Plan', :rolename, :roledesc,
                     :deletestatus, :usertracker, :createtime,
                     NULL, NULL, NULL)";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":userid", $targetUserId, PDO::PARAM_STR);
        $stmt->bindValue(":rolename", $masterPlan["rolename"], PDO::PARAM_STR);
        $stmt->bindValue(":roledesc", $masterPlan["role_description"] ?? $masterPlan["rolename"], PDO::PARAM_STR);
        $stmt->bindValue(":deletestatus", $masterPlan["deletestatus"], PDO::PARAM_STR);
        $stmt->bindValue(":usertracker", $masterUserId, PDO::PARAM_STR);
        $stmt->bindValue(":createtime", $masterPlan["createtime"], PDO::PARAM_STR);
        $stmt->execute();
    }

    /**
     * ✅ UPDATED: createForUser()
     * - Uses explicit INSERT columns because tbl_user_roles now has payment_* columns
     * - Propagates master's plan to target user (if master has one) with same createtime
     */
    public function createForUser($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $targetEmpId = (string)($data["empid"] ?? "");

            // ✅ If assigning roles to another user, ensure they inherit master's plan createtime (if any)
            if ($targetEmpId !== "" && $targetEmpId !== (string)$user_id) {
                $this->ensurePlanRoleForTarget((string)$user_id, $targetEmpId);
            }

            // ✅ Reusable insert for normal roles (payment_* not applicable here -> NULL)
            $insertSql = "INSERT INTO tbl_user_roles
                            (uuid, userid, roleclass, rolename, role_description,
                             deletestatus, usertracker, createtime,
                             payment_amount, payment_reference, payment_mode)
                          VALUES
                            (CONCAT('RL-',shortUUID()), :user_id, :roleclass, :rolename, :role_description,
                             'Active', :user_tracker, DATE_ADD(NOW(), INTERVAL 8 HOUR),
                             NULL, NULL, NULL)";

            // --- Post Routes / Functions
            foreach ($data["functionandroutes"] as $routeorfunction) {

                $checkRoute = substr($routeorfunction, 0, 1);

                if ($checkRoute === "/") {

                    $sql = "SELECT rolename FROM tbl_user_roles
                            WHERE deletestatus = 'Active'
                              AND rolename = :routename
                              AND userid = :empid";

                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
                    $stmt->bindValue(":routename", $routeorfunction, PDO::PARAM_STR);
                    $stmt->execute();

                    if ($stmt->rowCount() === 0) {

                        $stmt = $this->conn->prepare($insertSql);
                        $stmt->bindValue(":user_id", $data["empid"], PDO::PARAM_STR);
                        $stmt->bindValue(":roleclass", "Route", PDO::PARAM_STR);
                        $stmt->bindValue(":rolename", $routeorfunction, PDO::PARAM_STR);
                        $stmt->bindValue(":role_description", $routeorfunction, PDO::PARAM_STR);
                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                        $stmt->execute();
                    }

                } else {

                    $sql = "SELECT rolename FROM tbl_user_roles
                            WHERE deletestatus = 'Active'
                              AND rolename = :rolename
                              AND userid = :empid";

                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
                    $stmt->bindValue(":rolename", $routeorfunction, PDO::PARAM_STR);
                    $stmt->execute();

                    if ($stmt->rowCount() === 0) {

                        $stmt = $this->conn->prepare($insertSql);
                        $stmt->bindValue(":user_id", $data["empid"], PDO::PARAM_STR);
                        $stmt->bindValue(":roleclass", "Function", PDO::PARAM_STR);
                        $stmt->bindValue(":rolename", $routeorfunction, PDO::PARAM_STR);
                        $stmt->bindValue(":role_description", $routeorfunction, PDO::PARAM_STR);
                        $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                        $stmt->execute();
                    }
                }
            }

            // --- Post Business Units
            foreach ($data["busunit"] as $busunit) {

                $sql = "SELECT rolename FROM tbl_user_roles
                        WHERE deletestatus = 'Active'
                          AND rolename = :routename
                          AND userid = :empid";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
                $stmt->bindValue(":routename", $busunit, PDO::PARAM_STR);
                $stmt->execute();

                if ($stmt->rowCount() === 0) {

                    $sql = "SELECT name FROM lkp_busunits
                            WHERE deletestatus = 'Active'
                              AND busunitcode = :busunit";

                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":busunit", $busunit, PDO::PARAM_STR);
                    $stmt->execute();

                    $busunitName = $stmt->fetch(PDO::FETCH_ASSOC);
                    $desc = $busunitName ? ($busunitName["name"] ?? "") : "";

                    $stmt = $this->conn->prepare($insertSql);
                    $stmt->bindValue(":user_id", $data["empid"], PDO::PARAM_STR);
                    $stmt->bindValue(":roleclass", "Business Unit", PDO::PARAM_STR);
                    $stmt->bindValue(":rolename", $busunit, PDO::PARAM_STR);
                    $stmt->bindValue(":role_description", $desc, PDO::PARAM_STR);
                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                    $stmt->execute();
                }
            }

            // --- Post Teams
            foreach ($data["teams"] as $team) {

                $sql = "SELECT rolename FROM tbl_user_roles
                        WHERE deletestatus = 'Active'
                          AND rolename = :routename
                          AND userid = :empid";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":empid", $data["empid"], PDO::PARAM_STR);
                $stmt->bindValue(":routename", $team, PDO::PARAM_STR);
                $stmt->execute();

                if ($stmt->rowCount() === 0) {

                    $sql = "SELECT teamname FROM tbl_teams
                            WHERE deletestatus = 'Active'
                              AND teamid = :teamcode";

                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue(":teamcode", $team, PDO::PARAM_STR);
                    $stmt->execute();

                    $teamName = $stmt->fetch(PDO::FETCH_ASSOC);
                    $desc = $teamName ? ($teamName["teamname"] ?? "") : "";

                    $stmt = $this->conn->prepare($insertSql);
                    $stmt->bindValue(":user_id", $data["empid"], PDO::PARAM_STR);
                    $stmt->bindValue(":roleclass", "Team", PDO::PARAM_STR);
                    $stmt->bindValue(":rolename", $team, PDO::PARAM_STR);
                    $stmt->bindValue(":role_description", $desc, PDO::PARAM_STR);
                    $stmt->bindValue(":user_tracker", $user_id, PDO::PARAM_STR);
                    $stmt->execute();
                }
            }

            $this->conn->commit();
            echo json_encode(["message" => "Success"]);

        } catch (Exception $e) {

            $this->conn->rollBack();
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }

    public function deleteForUser($user_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            $sql = "DELETE from tbl_user_roles WHERE uuid = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":id", $data["id"], PDO::PARAM_STR);
            $stmt->execute();

            $this->conn->commit();
            echo json_encode(["message" => "Success"]);

        } catch (Exception $e) {

            $this->conn->rollBack();
            echo json_encode(["message" => $e->getMessage()]);
            exit;
        }
    }

    /**
     * ✅ UPDATED: include payment columns in SELECT so your UI won't break if you show them later.
     */
 public function getInfiniteData($search)
{
    $sql = "SELECT  tbl_user_roles.uuid,
                    tbl_user_roles.userid,
                    CONCAT(tbl_employees.firstname, ' ', tbl_employees.lastname) AS username,
                    tbl_user_roles.roleclass,
                    tbl_user_roles.rolename,
                    tbl_user_roles.role_description,
                    tbl_user_roles.createtime,
                    tbl_user_roles.deletestatus,
                    tbl_employees.email
            FROM tbl_user_roles
            LEFT OUTER JOIN tbl_employees ON tbl_user_roles.userid = tbl_employees.empid
            WHERE tbl_user_roles.deletestatus = 'Active'
              AND CONCAT(tbl_employees.firstname, ' ', tbl_employees.lastname) LIKE :search
            ORDER BY CONCAT(tbl_employees.firstname, ' ', tbl_employees.lastname) ASC,
                     roleclass ASC,
                     role_description ASC";

    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":search", '%' . $search . '%', PDO::PARAM_STR);
    $stmt->execute();

    $rows = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $rows[] = $row;
    }

    return [
        "items" => $rows,
        "count" => count($rows),        // ✅ optional but useful
        "nextPage" => null,             // ✅ keep compatibility if frontend expects it
        "hasNextPage" => false          // ✅ explicit
    ];
}

    // --- unchanged helpers you already have

    public function getByUsername($username)
    {
        try {
            $sql = "SELECT *
                    FROM tbl_users_global_assignment
                    WHERE email = :username";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":username", $username, PDO::PARAM_STR);
            $stmt->execute();

            return $stmt->fetch(PDO::FETCH_ASSOC);

        } catch (Exception $e) {
            echo json_encode(["message" => "invalidCredentials"]);
            exit;
        }
    }

    public function deletedataWithIds($ids)
    {
        foreach ($ids as $id) {
            $sql = "UPDATE tbl_user_roles SET deletestatus = 'Inactive' WHERE uuid = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":id", $id, PDO::PARAM_STR);
            $stmt->execute();
        }

        return $stmt->rowCount();
    }

    public function getByID($id)
    {
        try {
            $sql = "SELECT *
                    FROM tbl_users_global_assignment
                    WHERE uuid = :id";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":id", $id, PDO::PARAM_INT);
            $stmt->execute();

            return $stmt->fetch(PDO::FETCH_ASSOC);

        } catch (Exception $e) {
            echo json_encode(["message" => "invalidCredentials"]);
            exit;
        }
    }
}
