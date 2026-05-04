<?php
// UserPlanExpiryGateway.php
//
// ✅ GLOBAL SHARED PLAN BEHAVIOR (no linking):
// - If ANY user logs in and the GLOBAL plan is expired => DELETE ALL rows roleclass='Plan' for ALL users (scope)
// - If ANY user submits renewal/upgrade => INSERT "For Review" plan rows for ALL users (scope)
//
// ✅ Includes:
// - empid-safe email lookup (won't crash if empid column doesn't exist)
// - duplicate-safe insert (returns 409 with guidance if UNIQUE index not fixed)
// - FULL email sender (user + internal notify)
//
// ⚠️ REQUIRED DB FIX (recommended):
//   Drop old unique key (userid, rolename) and replace with:
//   UNIQUE(userid, roleclass, rolename, deletestatus)
//   so Active + For Review can coexist.
//

class UserPlanExpiryGateway
{
    private $conn;

    public function __construct(Database $database)
    {
        $this->conn = $database->getConnection();
    }

    /* ===========================
     * Helpers
     * =========================== */

    private function phNow(): DateTime
    {
        return new DateTime("now", new DateTimeZone("Asia/Manila"));
    }

    private function parseDateTime(string $dt): DateTime
    {
        return new DateTime($dt, new DateTimeZone("Asia/Manila"));
    }

    private function getIntEnv(string $key, int $fallback): int
    {
        $raw = $_ENV[$key] ?? null;
        if ($raw === null || $raw === "") return $fallback;
        if (!is_numeric($raw)) return $fallback;
        return (int)$raw;
    }

    private function columnExists(string $table, string $column): bool
    {
        $sql = "SELECT 1
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = :t
                  AND COLUMN_NAME = :c
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":t", $table, PDO::PARAM_STR);
        $stmt->bindValue(":c", $column, PDO::PARAM_STR);
        $stmt->execute();
        return (bool)$stmt->fetchColumn();
    }

    private function inPlaceholders(array $ids, string $prefix = "p"): array
    {
        $placeholders = [];
        $params = [];
        foreach ($ids as $i => $id) {
            $k = ":" . $prefix . $i;
            $placeholders[] = $k;
            $params[$k] = $id;
        }
        return [$placeholders, $params];
    }

    /* ===========================
     * Email lookup (empid-safe)
     * =========================== */

    private function getUserEmail(string $user_id): string
    {
        $table = "tbl_users_global_assignment";

        // Email column could be email or email_address (you can add more if needed)
        $emailCols = ["email", "email_address"];
        $emailCol = "";
        foreach ($emailCols as $c) {
            if ($this->columnExists($table, $c)) {
                $emailCol = $c;
                break;
            }
        }
        if ($emailCol === "") return "";

        // Try common id columns (only those that exist)
        $idCols = [
            "uuid",
            "userid",
            "user_id",
            "id",
            "payroll_empid",
            "employee_id",
            "empid", // may NOT exist; safe-checked
        ];

        foreach ($idCols as $col) {
            if (!$this->columnExists($table, $col)) continue;

            // Column names can't be parameter-bound; we whitelist above and backtick here.
            $sql = "SELECT `$emailCol` AS email
                    FROM `$table`
                    WHERE `$col` = :id
                    LIMIT 1";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindValue(":id", $user_id, PDO::PARAM_STR);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row && !empty($row["email"])) {
                return (string)$row["email"];
            }
        }

        return "";
    }

    /* ===========================
     * Scope users (GLOBAL / per company)
     * =========================== */

    private function getScopeUserIds(?string $companycode = null): array
    {
        $userIds = [];

        // Prefer pulling all UUIDs from tbl_users_global_assignment if available
        $uga = "tbl_users_global_assignment";
        $hasUuid = $this->columnExists($uga, "uuid");

        $companyCol = null;
        if ($companycode !== null && $companycode !== "") {
            foreach (["companycode", "company_code", "corpcode", "corp_code"] as $cc) {
                if ($this->columnExists($uga, $cc)) {
                    $companyCol = $cc;
                    break;
                }
            }
        }

        if ($hasUuid) {
            if ($companyCol) {
                $sql = "SELECT DISTINCT uuid FROM `$uga` WHERE `$companyCol` = :cc";
                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue(":cc", $companycode, PDO::PARAM_STR);
                $stmt->execute();
            } else {
                $sql = "SELECT DISTINCT uuid FROM `$uga`";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute();
            }

            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($r["uuid"])) $userIds[] = (string)$r["uuid"];
            }
        }

        // Fallback: if none found, use tbl_user_roles distinct users
        if (count($userIds) === 0) {
            $sql = "SELECT DISTINCT userid FROM tbl_user_roles";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($r["userid"])) $userIds[] = (string)$r["userid"];
            }
        }

        return array_values(array_unique($userIds));
    }

    /* ===========================
     * Plan row getters (GLOBAL)
     * =========================== */

    private function getGlobalActivePlanRow(array $scopeUserIds): ?array
    {
        if (count($scopeUserIds) === 0) return null;

        [$ph, $params] = $this->inPlaceholders($scopeUserIds, "u");

        $sql = "SELECT uuid, userid, rolename, role_description, deletestatus, createtime,
                       payment_amount, payment_reference, payment_mode
                FROM tbl_user_roles
                WHERE userid IN (" . implode(",", $ph) . ")
                  AND roleclass = 'Plan'
                  AND rolename IN ('PRO','PREMIUM','UNLIMITED')
                  AND deletestatus = 'Active'
                ORDER BY createtime DESC
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_STR);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function getGlobalPendingPlanRow(array $scopeUserIds): ?array
    {
        if (count($scopeUserIds) === 0) return null;

        [$ph, $params] = $this->inPlaceholders($scopeUserIds, "u");

        $sql = "SELECT uuid, userid, rolename, role_description, deletestatus, createtime,
                       payment_amount, payment_reference, payment_mode
                FROM tbl_user_roles
                WHERE userid IN (" . implode(",", $ph) . ")
                  AND roleclass = 'Plan'
                  AND rolename IN ('PRO','PREMIUM','UNLIMITED')
                  AND deletestatus = 'For Review'
                ORDER BY createtime DESC
                LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_STR);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function deleteAllPlanRowsForScope(array $scopeUserIds): int
    {
        if (count($scopeUserIds) === 0) return 0;

        [$ph, $params] = $this->inPlaceholders($scopeUserIds, "u");

        $sql = "DELETE FROM tbl_user_roles
                WHERE userid IN (" . implode(",", $ph) . ")
                  AND roleclass = 'Plan'";
        $stmt = $this->conn->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_STR);
        $stmt->execute();

        return (int)$stmt->rowCount();
    }

    private function ensureActivePlanForAll(array $scopeUserIds, string $planName, string $startTime): void
    {
        if (count($scopeUserIds) === 0) return;

        $sqlCheck = "SELECT 1
                     FROM tbl_user_roles
                     WHERE userid = :userid
                       AND roleclass = 'Plan'
                       AND rolename = :rolename
                       AND deletestatus = 'Active'
                     LIMIT 1";
        $check = $this->conn->prepare($sqlCheck);

        $sqlInsert = "INSERT INTO tbl_user_roles
                        (uuid, userid, roleclass, rolename, role_description,
                         deletestatus, usertracker, createtime,
                         payment_amount, payment_reference, payment_mode)
                      VALUES
                        (CONCAT('RL-', shortUUID()), :userid, 'Plan', :rolename, 'Subscription',
                         'Active', :usertracker, :createtime,
                         NULL, NULL, NULL)";
        $ins = $this->conn->prepare($sqlInsert);

        foreach ($scopeUserIds as $uid) {
            $check->bindValue(":userid", $uid, PDO::PARAM_STR);
            $check->bindValue(":rolename", $planName, PDO::PARAM_STR);
            $check->execute();
            $exists = (bool)$check->fetchColumn();

            if (!$exists) {
                $ins->bindValue(":userid", $uid, PDO::PARAM_STR);
                $ins->bindValue(":rolename", $planName, PDO::PARAM_STR);
                $ins->bindValue(":usertracker", $uid, PDO::PARAM_STR);
                $ins->bindValue(":createtime", $startTime, PDO::PARAM_STR);
                try { $ins->execute(); } catch (Throwable $e) { /* ignore */ }
            }
        }
    }

    private function getActiveRolesForUser(string $user_id): array
    {
        $sql = "SELECT uuid, userid, roleclass, rolename, role_description,
                       deletestatus, createtime,
                       payment_amount, payment_reference, payment_mode
                FROM tbl_user_roles
                WHERE userid = :userid
                  AND deletestatus = 'Active'
                ORDER BY roleclass ASC, role_description ASC";
        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(":userid", $user_id, PDO::PARAM_STR);
        $stmt->execute();

        $rows = [];
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $rows[] = $r;
        }
        return $rows;
    }

    /* ===========================
     * PUBLIC: GLOBAL check
     * =========================== */

    public function checkGlobalPlanStatus(string $caller_user_id, array $data): array
    {
        try {
            $durationDays = $this->getIntEnv("PLAN_DURATION_DAYS", 30);
            $reminderDays = $this->getIntEnv("PLAN_REMINDER_DAYS", 5);

            $now = $this->phNow();

            $companycode = trim((string)($data["companycode"] ?? ""));
            $scopeUserIds = $this->getScopeUserIds($companycode);

            // safety fallback
            if (count($scopeUserIds) === 0) $scopeUserIds = [$caller_user_id];

            $active = $this->getGlobalActivePlanRow($scopeUserIds);
            $pending = $this->getGlobalPendingPlanRow($scopeUserIds);

            // No active plan (GLOBAL)
            if (!$active) {
                if ($pending) {
                    return [
                        "status" => "PENDING_REVIEW",
                        "message" => "A plan request is pending review (GLOBAL).",
                        "plan" => $pending["rolename"] ?? "",
                        "pending" => true,
                        "scopeUsers" => count($scopeUserIds),
                        "serverNow" => $now->format("Y-m-d H:i:s"),
                        "durationDays" => $durationDays,
                        "reminderDays" => $reminderDays,
                        "userrole" => $this->getActiveRolesForUser($caller_user_id),
                    ];
                }

                return [
                    "status" => "FREE",
                    "message" => "No active plan found (GLOBAL).",
                    "plan" => "FREE",
                    "pending" => false,
                    "scopeUsers" => count($scopeUserIds),
                    "serverNow" => $now->format("Y-m-d H:i:s"),
                    "durationDays" => $durationDays,
                    "reminderDays" => $reminderDays,
                    "userrole" => $this->getActiveRolesForUser($caller_user_id),
                ];
            }

            $planName = strtoupper((string)($active["rolename"] ?? ""));
            $start = $this->parseDateTime((string)$active["createtime"]);
            $expiry = (clone $start)->modify("+{$durationDays} days");
            $remindFrom = (clone $expiry)->modify("-{$reminderDays} days");

            // Keep consistent across scope (helpful if new users were added)
            $this->ensureActivePlanForAll($scopeUserIds, $planName, $start->format("Y-m-d H:i:s"));

            // Expired => delete ALL plan rows (GLOBAL) unless pending exists
            if ($now >= $expiry) {
                if ($pending) {
                    return [
                        "status" => "PENDING_REVIEW",
                        "message" => "Global plan is expired but renewal/upgrade is pending review.",
                        "plan" => $pending["rolename"] ?? $planName,
                        "pending" => true,
                        "isExpired" => true,
                        "expiryDate" => $expiry->format("Y-m-d"),
                        "scopeUsers" => count($scopeUserIds),
                        "serverNow" => $now->format("Y-m-d H:i:s"),
                        "durationDays" => $durationDays,
                        "reminderDays" => $reminderDays,
                        "userrole" => $this->getActiveRolesForUser($caller_user_id),
                    ];
                }

            $deleted = $this->deleteAllPlanRowsForScope($scopeUserIds);

            // ✅ NEW: tell MASTER to mark lkp_clients.subscription = Expired
            $masterBase = (string)($_ENV["MASTER_API_ENDPOINT_PATH"]);
            $masterExpired = ["ok" => false, "message" => "master_apiendpoint missing"];

            if ($masterBase !== "") {
                $masterExpired = $this->postToMasterExpireSubscription([
                    "companycode" => $companycode,
                    "requestedBy" => $caller_user_id,
                ], $masterBase);
            }

            return [
                "status" => "EXPIRED_REMOVED",
                "message" => "Global plan expired. ALL users' Plan roles were removed.",
                "plan" => "FREE",
                "pending" => false,
                "isExpired" => true,
                "deletedRows" => $deleted,
                "expiryDate" => $expiry->format("Y-m-d"),
                "scopeUsers" => count($scopeUserIds),
                "serverNow" => $now->format("Y-m-d H:i:s"),
                "durationDays" => $durationDays,
                "reminderDays" => $reminderDays,
                "userrole" => $this->getActiveRolesForUser($caller_user_id),

                // ✅ optional debug
                "masterExpireMessage" => $masterExpired["message"] ?? "",
            ];

            }

            // Reminder window
            if ($now >= $remindFrom) {
                $daysLeft = (int)$now->diff($expiry)->format("%a");

                return [
                    "status" => "REMINDER",
                    "message" => "Global plan is nearing expiry.",
                    "plan" => $planName,
                    "pending" => (bool)$pending,
                    "daysLeft" => $daysLeft,
                    "startDate" => $start->format("Y-m-d"),
                    "expiryDate" => $expiry->format("Y-m-d"),
                    "remindFrom" => $remindFrom->format("Y-m-d"),
                    "scopeUsers" => count($scopeUserIds),
                    "serverNow" => $now->format("Y-m-d H:i:s"),
                    "durationDays" => $durationDays,
                    "reminderDays" => $reminderDays,
                    "userrole" => $this->getActiveRolesForUser($caller_user_id),
                ];
            }

            // Active
            return [
                "status" => "ACTIVE",
                "message" => "Global plan is active.",
                "plan" => $planName,
                "pending" => (bool)$pending,
                "startDate" => $start->format("Y-m-d"),
                "expiryDate" => $expiry->format("Y-m-d"),
                "scopeUsers" => count($scopeUserIds),
                "serverNow" => $now->format("Y-m-d H:i:s"),
                "durationDays" => $durationDays,
                "reminderDays" => $reminderDays,
                "userrole" => $this->getActiveRolesForUser($caller_user_id),
            ];
        } catch (Throwable $e) {
            http_response_code(500);
            return ["message" => $e->getMessage()];
        }
    }

    /* ===========================
     * PUBLIC: GLOBAL renewal/upgrade request
     * =========================== */

    public function requestGlobalPlanRenewalOrUpgrade(string $caller_user_id, array $data): array
    {
        try {
            $companycode = trim((string)($data["companycode"] ?? ""));
            $scopeUserIds = $this->getScopeUserIds($companycode);
            if (count($scopeUserIds) === 0) $scopeUserIds = [$caller_user_id];

            $requestedPlan = strtoupper(trim((string)($data["plan"] ?? "")));
            if (!in_array($requestedPlan, ["PRO", "PREMIUM", "UNLIMITED"], true)) {
                http_response_code(422);
                return ["message" => "Invalid plan."];
            }

            $amount  = $data["payment_amount"] ?? null;
            $payref  = trim((string)($data["payment_reference"] ?? ""));
            $paymode = trim((string)($data["payment_mode"] ?? ""));
            $agree   = (bool)($data["agreement_accepted"] ?? false);

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

            // Block if ANY pending exists in scope
            $pending = $this->getGlobalPendingPlanRow($scopeUserIds);
            if ($pending) {
                http_response_code(409);
                return ["message" => "There is already a pending renewal/upgrade request (GLOBAL)."];
            }

            // Determine current global plan
            $active = $this->getGlobalActivePlanRow($scopeUserIds);
            $currentPlan = $active ? strtoupper((string)($active["rolename"] ?? "")) : "FREE";

            // Example rule: downgrade not allowed
            if ($currentPlan === "PREMIUM" && $requestedPlan === "PRO") {
                http_response_code(422);
                return ["message" => "Downgrade is not allowed."];
            }

            // Only PRO -> PREMIUM is an upgrade in your current rule set
            $isUpgrade = ($currentPlan === "PRO" && $requestedPlan === "PREMIUM");
            $roleDesc = $isUpgrade ? "Plan Upgrade Request" : "Renewal Request";

            // Use PH time
            $nowPH = $this->phNow()->format("Y-m-d H:i:s");

            $this->conn->beginTransaction();

            // Insert For Review plan row for ALL users in scope
            $sql = "INSERT INTO tbl_user_roles
                        (uuid, userid, roleclass, rolename, role_description,
                         deletestatus, usertracker, createtime,
                         payment_amount, payment_reference, payment_mode)
                    VALUES
                        (CONCAT('RL-', shortUUID()), :userid, 'Plan', :rolename, :roledesc,
                         'For Review', :usertracker, :createtime,
                         :amount, :payref, :paymode)";
            $stmt = $this->conn->prepare($sql);

            foreach ($scopeUserIds as $uid) {
                $stmt->bindValue(":userid", $uid, PDO::PARAM_STR);
                $stmt->bindValue(":rolename", $requestedPlan, PDO::PARAM_STR);
                $stmt->bindValue(":roledesc", $roleDesc, PDO::PARAM_STR);
                $stmt->bindValue(":usertracker", $caller_user_id, PDO::PARAM_STR);
                $stmt->bindValue(":createtime", $nowPH, PDO::PARAM_STR);
                $stmt->bindValue(":amount", (string)$amount, PDO::PARAM_STR);
                $stmt->bindValue(":payref", $payref, PDO::PARAM_STR);
                $stmt->bindValue(":paymode", $paymode, PDO::PARAM_STR);

                try {
                    $stmt->execute();
                } catch (PDOException $e) {
                    $driverCode = (int)($e->errorInfo[1] ?? 0);
                    if ($driverCode === 1062) {
                        $this->conn->rollBack();
                        http_response_code(409);
                        return [
                            "message" =>
                                "Duplicate conflict due to DB UNIQUE index. " .
                                "Apply this fix: UNIQUE(userid, roleclass, rolename, deletestatus)."
                        ];
                    }
                    throw $e;
                }
            }

            $this->conn->commit();

            // Send emails (user + notify)
            $userEmail = $this->getUserEmail($caller_user_id);
            $apiendpoint = trim((string)($data["apiendpoint"] ?? ""));

            $this->sendRenewalEmails(
                $userEmail,
                $requestedPlan,
                (string)$amount,
                $paymode,
                $payref,
                $companycode,
                $apiendpoint,
                $roleDesc,
                $currentPlan
            );

            return [
                "message" => $isUpgrade
                    ? "Global upgrade request submitted for review. This applies to ALL users."
                    : "Global renewal submitted for review. This applies to ALL users.",
                "status" => "PENDING_REVIEW",
                "requestType" => $isUpgrade ? "UPGRADE" : "RENEWAL",
                "currentPlan" => $currentPlan,
                "requestedPlan" => $requestedPlan,
                "scopeUsers" => count($scopeUserIds),
            ];
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            http_response_code(500);
            return ["message" => $e->getMessage()];
        }
    }

    private function postToMasterExpireSubscription(array $payload, string $masterBase): array
{

    $path = (string)($_ENV["MASTER_API_ENDPOINT_PATH"]);

    $url = $path;

    $payload["action"] = "expireSubscription";

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

    return ["ok" => true, "message" => $decoded["message"] ?? "Master subscription expired."];
}


    /* ===========================
     * EMAIL SENDER (FULL)
     * =========================== */

    private function sendRenewalEmails(
        string $toUserEmail,
        string $plan,
        string $amount,
        string $paymode,
        string $payref,
        string $companycode,
        string $apiendpoint,
        string $requestTypeDesc = "Renewal Request",
        string $currentPlan = ""
    ): void {
        // ✅ Ideally move these to ENV
        $smtpHost  = "mail.exinnovph.com";
        $smtpUser  = "admin@exinnovph.com";
        $smtpPass  = "ExinnovEmail@2025";
        $fromEmail = "admin@exinnovph.com";

        $safePlan = htmlspecialchars($plan, ENT_QUOTES, "UTF-8");
        $safeAmount = htmlspecialchars($amount, ENT_QUOTES, "UTF-8");
        $safeMop = htmlspecialchars($paymode, ENT_QUOTES, "UTF-8");
        $safeRef = htmlspecialchars($payref, ENT_QUOTES, "UTF-8");
        $safeCompany = htmlspecialchars($companycode, ENT_QUOTES, "UTF-8");
        $safeApi = htmlspecialchars($apiendpoint, ENT_QUOTES, "UTF-8");
        $safeReq = htmlspecialchars($requestTypeDesc, ENT_QUOTES, "UTF-8");
        $safeCurrent = htmlspecialchars($currentPlan, ENT_QUOTES, "UTF-8");

        $titleLine = $requestTypeDesc === "Plan Upgrade Request"
            ? "Plan Upgrade (For Review)"
            : "Plan Renewal (For Review)";

        $extra = "";
        if ($requestTypeDesc === "Plan Upgrade Request" && $currentPlan !== "") {
            $extra = "<p style='margin:0 0 6px; font-size:14px;'><strong>Current Plan:</strong> {$safeCurrent}</p>";
        }

        $emailBodyUser = "
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
                  <p style='font-size:18px; margin:0 0 16px;'>
                    From <strong>Exinnov</strong>,
                  </p>

                  <p style='font-size:16px; margin:0 0 14px;'>
                    Your <strong>{$safeReq}</strong> was submitted successfully.
                  </p>

                  <p style='font-size:14px; margin:0 0 18px; color:#555555; line-height:1.55;'>
                    It is now marked for <strong>Payment Review</strong>. We will notify you once it is verified and activated.
                  </p>

                  <div style='margin:0 0 18px; padding:14px; border:1px solid #eeeeee; border-radius:12px; background:#fafafa;'>
                    {$extra}
                    <p style='margin:0 0 6px; font-size:14px;'><strong>Requested Plan:</strong> {$safePlan}</p>
                    <p style='margin:0 0 6px; font-size:14px;'><strong>Amount:</strong> ₱{$safeAmount}</p>
                    <p style='margin:0 0 6px; font-size:14px;'><strong>MOP:</strong> {$safeMop}</p>
                    <p style='margin:0; font-size:14px;'><strong>Reference:</strong> {$safeRef}</p>
                  </div>

                  <p style='font-size:14px; margin:0;'>
                    Thank you,<br>
                    <strong>Exinnov Team</strong>
                  </p>
                </td>
              </tr>

              <tr>
                <td style='padding:15px; text-align:center; font-size:12px; color:#888888;'>
                  © " . date("Y") . " Exinnov. All rights reserved.
                </td>
              </tr>
            </table>
          </body>
        </html>";

        $emailBodyNotify = "
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
                  <p style='font-size:16px; margin:0 0 12px;'>
                    <strong>Action Notification</strong> ({$safeReq} - For Review)
                  </p>

                  <div style='border:1px solid #eee; border-radius:10px; padding:14px; background:#fafafa;'>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>Requested Plan:</strong> {$safePlan}</p>
                    " . ($safeCurrent !== "" ? "<p style='margin:0 0 8px; font-size:14px;'><strong>Current Plan:</strong> {$safeCurrent}</p>" : "") . "
                    <p style='margin:0 0 8px; font-size:14px;'><strong>Company Code:</strong> {$safeCompany}</p>
                    <p style='margin:0 0 8px; font-size:14px;'><strong>API Endpoint:</strong> {$safeApi}</p>
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
                  © " . date("Y") . " Exinnov. Internal notification.
                </td>
              </tr>
            </table>
          </body>
        </html>";

        $notifyRecipients = [
            "jeremiah.richwell@outlook.com",
            "systems.Exinnov@gmail.com",
            "khimchi76@gmail.com",
        ];

        try {
            $emailController = new EmailSendController();

            // User email (optional)
            if ($toUserEmail !== "") {
                $emailController->sendEmail(
                    $smtpHost,
                    $smtpUser,
                    $smtpPass,
                    $fromEmail,
                    $toUserEmail,
                    $titleLine,
                    $emailBodyUser
                );
            }

            // Notify internal recipients
            foreach ($notifyRecipients as $to) {
                $emailController->sendEmail(
                    $smtpHost,
                    $smtpUser,
                    $smtpPass,
                    $fromEmail,
                    $to,
                    $titleLine,
                    $emailBodyNotify
                );
            }
        } catch (Throwable $e) {
            // Never break the API response because of email
            error_log("[PLAN EMAIL ERROR] " . $e->getMessage());
        }
    }
}
