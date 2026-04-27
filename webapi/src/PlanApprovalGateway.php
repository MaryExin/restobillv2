<?php

class PlanApprovalGateway
{
    private $conn;

    // ✅ same notify list you use
    private $notifyRecipients = [
        "jeremiah.richwell@outlook.com",
        "systems.Exinnov@gmail.com",
        "khimchi76@gmail.com",
    ];

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    // ✅ GET list
    public function getForReviewPlans(string $q = ""): array
    {
        $q = trim($q);

        $sql = "SELECT  r.uuid,
                        r.userid,
                        CONCAT(e.firstname, ' ', e.lastname) AS username,
                        r.roleclass,
                        r.rolename,
                        r.role_description,
                        r.payment_amount,
                        r.payment_reference,
                        r.payment_mode,
                        r.createtime,
                        r.deletestatus
                FROM tbl_user_roles r
                LEFT JOIN tbl_employees e ON r.userid = e.empid
                WHERE r.roleclass = 'Plan'
                  AND r.deletestatus = 'For Review'";

        // optional search
        if ($q !== "") {
            $sql .= " AND (
                        r.userid LIKE :q
                        OR r.rolename LIKE :q
                        OR r.payment_reference LIKE :q
                        OR CONCAT(e.firstname, ' ', e.lastname) LIKE :q
                      )";
        }

        $sql .= " ORDER BY r.createtime DESC";

        $stmt = $this->conn->prepare($sql);
        if ($q !== "") $stmt->bindValue(":q", "%" . $q . "%", PDO::PARAM_STR);
        $stmt->execute();

        $rows = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $rows[] = $row;

        return ["items" => $rows];
    }

    // ✅ POST approve
    public function approvePlanRequests(string $approverUserId, array $data): array
    {
        try {
            $ids = $data["ids"] ?? null;
            if (!is_array($ids) || empty($ids)) {
                http_response_code(422);
                return ["message" => "ids[] is required."];
            }

            $companycode = strtoupper(trim((string)($data["companycode"] ?? "")));
            if ($companycode === "") {
                http_response_code(422);
                return ["message" => "companycode is required."];
            }

            // master endpoint base to call (optional but recommended)
            $masterBase = trim((string)($data["master_apiendpoint"] ?? ""));
            $requestedBy = (string)($data["requestedBy"] ?? "");

            // 1) Fetch selected rows (must be For Review)
            $in = implode(",", array_fill(0, count($ids), "?"));
            $sql = "SELECT uuid, userid, rolename, payment_amount, payment_reference, payment_mode, createtime
                    FROM tbl_user_roles
                    WHERE roleclass = 'Plan'
                      AND deletestatus = 'For Review'
                      AND uuid IN ($in)";
            $stmt = $this->conn->prepare($sql);
            foreach (array_values($ids) as $i => $id) {
                $stmt->bindValue($i + 1, (string)$id, PDO::PARAM_STR);
            }
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (!$rows || count($rows) === 0) {
                http_response_code(404);
                return ["message" => "No matching For Review plan requests found."];
            }

            // 2) Group by userid
            $byUser = [];
            foreach ($rows as $r) {
                $uid = (string)$r["userid"];
                if (!isset($byUser[$uid])) $byUser[$uid] = [];
                $byUser[$uid][] = $r;
            }

            $approvedCount = 0;
            $failed = [];
            $masterMessages = [];

            $this->conn->beginTransaction();

            foreach ($byUser as $userid => $userRows) {
                // Safety: pick newest selected request (by createtime desc)
                usort($userRows, function ($a, $b) {
                    return strcmp((string)$b["createtime"], (string)$a["createtime"]);
                });
                $winner = $userRows[0];
                $winnerUuid = (string)$winner["uuid"];
                $plan = strtoupper(trim((string)$winner["rolename"]));

                // (A) Delete existing active plan(s) for this user
                $del = $this->conn->prepare("
                    DELETE FROM tbl_user_roles
                    WHERE userid = :userid
                      AND roleclass = 'Plan'
                      AND deletestatus = 'Active'
                ");
                $del->bindValue(":userid", $userid, PDO::PARAM_STR);
                $del->execute();

                // (B) Activate the winner
                $up = $this->conn->prepare("
                    UPDATE tbl_user_roles
                    SET deletestatus = 'Active',
                        usertracker = :tracker
                    WHERE uuid = :uuid
                      AND roleclass = 'Plan'
                      AND deletestatus = 'For Review'
                    LIMIT 1
                ");
                $up->bindValue(":tracker", $approverUserId, PDO::PARAM_STR);
                $up->bindValue(":uuid", $winnerUuid, PDO::PARAM_STR);
                $up->execute();

                if ($up->rowCount() <= 0) {
                    $failed[] = ["userid" => $userid, "uuid" => $winnerUuid, "message" => "Update failed"];
                    continue;
                }

                // (C) Optional safety: mark OTHER pending plan rows for user as Inactive
                $inact = $this->conn->prepare("
                    UPDATE tbl_user_roles
                    SET deletestatus = 'Inactive',
                        usertracker = :tracker
                    WHERE userid = :userid
                      AND roleclass = 'Plan'
                      AND deletestatus = 'For Review'
                      AND uuid <> :winner
                ");
                $inact->bindValue(":tracker", $approverUserId, PDO::PARAM_STR);
                $inact->bindValue(":userid", $userid, PDO::PARAM_STR);
                $inact->bindValue(":winner", $winnerUuid, PDO::PARAM_STR);
                $inact->execute();

                // 3) Update master subscription For Review -> Active + log
                // NOTE: If you have a master base, we call the master endpoint.
                if ($masterBase !== "") {
                    $masterRes = $this->postToMasterActivateSubscription([
                        "companycode" => $companycode,
                        "plan" => $plan,
                        "requestedBy" => $requestedBy,
                        "email" => $this->resolveUserEmail($userid),
                        "payment_reference" => (string)($winner["payment_reference"] ?? ""),
                        "payment_mode" => (string)($winner["payment_mode"] ?? ""),
                        "payment_amount" => (string)($winner["payment_amount"] ?? ""),
                    ], $masterBase);

                    $masterMessages[] = $masterRes["message"] ?? "master updated";
                }

                // 4) Email user + notifyRecipients
                $this->sendPlanActivatedEmails(
                    $userid,
                    $plan,
                    (string)($winner["payment_amount"] ?? ""),
                    (string)($winner["payment_mode"] ?? ""),
                    (string)($winner["payment_reference"] ?? ""),
                    $companycode,
                    $approverUserId
                );

                $approvedCount++;
            }

            $this->conn->commit();

            return [
                "message" => "Approval processed.",
                "approvedCount" => $approvedCount,
                "failedCount" => count($failed),
                "failed" => $failed,
                "masterMessage" => implode(" | ", array_unique(array_filter($masterMessages))),
            ];
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            http_response_code(500);
            return ["message" => $e->getMessage()];
        }
    }

    /* ------------------------- MASTER CALL ------------------------- */

    private function postToMasterActivateSubscription(array $payload, string $masterBase): array
    {
        // expects master endpoint path to be same as your current master APIEndpoint endpoint:
        // e.g. VITE_GET_API_ENDPOINT="api/mutationgetapiendpoint.php"
        // We'll accept env if available, else fallback to common path.
        $path = (string)($_ENV["MASTER_API_ENDPOINT_PATH"]);

        $url = $path;

        $payload["action"] = "activateSubscription"; // ✅ new action we add on master

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

        $resp = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($resp === false) {
            return ["ok" => false, "message" => "Master call failed: {$err}"];
        }

        $decoded = json_decode($resp, true);
        if ($code < 200 || $code >= 300) {
            return ["ok" => false, "message" => $decoded["message"] ?? "Master error ({$code})"];
        }

        return ["ok" => true, "message" => $decoded["message"] ?? "Master subscription activated."];
    }

    /* ------------------------- EMAILS ------------------------- */

    private function resolveUserEmail(string $user_id): string
    {
        // Try uuid lookup first
        $stmt = $this->conn->prepare("
            SELECT email, uuid
            FROM tbl_users_global_assignment
            WHERE uuid = :id
            LIMIT 1
        ");
        $stmt->bindValue(":id", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        $uga = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($uga && !empty($uga["email"])) return (string)$uga["email"];

        // fallback: treat user_id as empid
        $stmt = $this->conn->prepare("
            SELECT email
            FROM tbl_users_global_assignment
            WHERE empid = :id
            LIMIT 1
        ");
        $stmt->bindValue(":id", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row && !empty($row["email"])) return (string)$row["email"];

        return "";
    }

    private function resolveUserFullname(string $user_id): string
    {
        // tbl_user_roles.userid commonly stores empid
        $stmt = $this->conn->prepare("
            SELECT CONCAT(firstname,' ',lastname) AS fullname
            FROM tbl_employees
            WHERE empid = :empid
            LIMIT 1
        ");
        $stmt->bindValue(":empid", $user_id, PDO::PARAM_STR);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return !empty($row["fullname"]) ? (string)$row["fullname"] : $user_id;
    }

    private function sendPlanActivatedEmails(
        string $user_id,
        string $plan,
        string $amount,
        string $paymode,
        string $payref,
        string $companycode,
        string $approvedBy
    ): void {
        try {
            $smtpHost  = "mail.exinnovph.com";
            $smtpUser  = "admin@exinnovph.com";
            $smtpPass  = "ExinnovEmail@2025";
            $fromEmail = "admin@exinnovph.com";

            $emailController = new EmailSendController();

            $userEmail = $this->resolveUserEmail($user_id);
            $fullName  = $this->resolveUserFullname($user_id);

            $safeName = htmlspecialchars($fullName, ENT_QUOTES, "UTF-8");
            $safePlan = htmlspecialchars($plan, ENT_QUOTES, "UTF-8");
            $safeAmt  = htmlspecialchars($amount, ENT_QUOTES, "UTF-8");
            $safeMop  = htmlspecialchars($paymode, ENT_QUOTES, "UTF-8");
            $safeRef  = htmlspecialchars($payref, ENT_QUOTES, "UTF-8");
            $safeCC   = htmlspecialchars($companycode, ENT_QUOTES, "UTF-8");
            $safeUID  = htmlspecialchars($user_id, ENT_QUOTES, "UTF-8");
            $safeAppr = htmlspecialchars($approvedBy, ENT_QUOTES, "UTF-8");

            // ✅ Email to user
            if ($userEmail !== "") {
                $subjectUser = "Exinnov Subscription Activated - " . $plan;

                $bodyUser = "
                <html>
                  <body style='margin:0; padding:0; background-color:#ffffff;'>
                    <table align='center' width='100%' cellpadding='0' cellspacing='0'
                      style='max-width:600px; margin:auto; background:#ffffff; font-family:Arial, sans-serif; color:#333333; border-collapse:collapse;'>
                      <tr>
                        <td style='padding:20px; text-align:center; background-color:#E5D9B6;'>
                          <img src='https://exinnovph.com/images/app/logo.png' alt='Exinnov Logo'
                            width='120' style='display:block; margin:auto;'>
                        </td>
                      </tr>

                      <tr>
                        <td style='padding:30px;'>
                          <p style='font-size:18px; margin:0 0 14px;'>Hi <strong>{$safeName}</strong>,</p>

                          <p style='font-size:15px; margin:0 0 14px; line-height:1.6;'>
                            Your subscription request has been <strong>APPROVED</strong> and your plan is now <strong>ACTIVE</strong>.
                          </p>

                          <div style='border:1px solid #eee; border-radius:10px; padding:14px; background:#fafafa; margin:0 0 16px;'>
                            <p style='margin:0 0 6px; font-size:14px;'><strong>Plan:</strong> {$safePlan}</p>
                            <p style='margin:0 0 6px; font-size:14px;'><strong>Amount:</strong> ₱{$safeAmt}</p>
                            <p style='margin:0 0 6px; font-size:14px;'><strong>Mode:</strong> {$safeMop}</p>
                            <p style='margin:0; font-size:14px;'><strong>Reference:</strong> {$safeRef}</p>
                          </div>

                          <p style='font-size:13px; color:#666; margin:0; line-height:1.55;'>
                            Thank you for subscribing. If you have questions, just reply to this email or message our Facebook page.
                          </p>

                          <p style='font-size:14px; margin:18px 0 0;'>
                            Thank you,<br><strong>Exinnov Team</strong>
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

                $emailController->sendEmail(
                    $smtpHost, $smtpUser, $smtpPass,
                    $fromEmail, $userEmail, $subjectUser, $bodyUser
                );
            }

            // ✅ Email notify recipients
            $subjectAdmin = "PLAN ACTIVATED: {$plan} ({$companycode})";
            $bodyAdmin = "
            <html>
              <body style='margin:0; padding:0; background-color:#ffffff;'>
                <table align='center' width='100%' cellpadding='0' cellspacing='0'
                  style='max-width:700px; margin:auto; background:#ffffff; font-family:Arial, sans-serif; color:#333333; border-collapse:collapse;'>
                  <tr>
                    <td style='padding:20px; text-align:center; background-color:#E5D9B6;'>
                      <img src='https://exinnovph.com/images/app/logo.png' alt='Exinnov Logo'
                        width='120' style='display:block; margin:auto;'>
                    </td>
                  </tr>

                  <tr>
                    <td style='padding:24px;'>
                      <p style='font-size:16px; margin:0 0 12px;'><strong>Subscription Activated</strong></p>

                      <div style='border:1px solid #eee; border-radius:10px; padding:14px; background:#fafafa;'>
                        <p style='margin:0 0 8px; font-size:14px;'><strong>Company Code:</strong> {$safeCC}</p>
                        <p style='margin:0 0 8px; font-size:14px;'><strong>User ID:</strong> {$safeUID}</p>
                        <p style='margin:0 0 8px; font-size:14px;'><strong>User:</strong> {$safeName}</p>
                        <p style='margin:0 0 8px; font-size:14px;'><strong>Plan:</strong> {$safePlan}</p>
                        <p style='margin:0 0 8px; font-size:14px;'><strong>Amount:</strong> ₱{$safeAmt}</p>
                        <p style='margin:0 0 8px; font-size:14px;'><strong>MOP:</strong> {$safeMop}</p>
                        <p style='margin:0 0 8px; font-size:14px;'><strong>Reference:</strong> {$safeRef}</p>
                        <p style='margin:0; font-size:14px;'><strong>Approved By:</strong> {$safeAppr}</p>
                      </div>

                      <p style='font-size:12px; color:#666; margin:14px 0 0;'>
                        This is an automated notification.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style='padding:15px; text-align:center; font-size:12px; color:#888888;'>
                      © 2026 Exinnov. Internal notification.
                    </td>
                  </tr>
                </table>
              </body>
            </html>";

            foreach ($this->notifyRecipients as $to) {
                $emailController->sendEmail(
                    $smtpHost, $smtpUser, $smtpPass,
                    $fromEmail, $to, $subjectAdmin, $bodyAdmin
                );
            }

        } catch (Throwable $e) {
            error_log("[PLAN APPROVAL EMAIL ERROR] " . $e->getMessage());
        }
    }
}
