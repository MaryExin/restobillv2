<?php
declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  header("Allow: POST");
  echo json_encode(["message" => "MethodNotAllowed"]);
  exit;
}

$data = (array) json_decode(file_get_contents("php://input"), true);

$database = new Database($_ENV["DB_HOST"], $_ENV["DB_NAME"], $_ENV["DB_USER"], $_ENV["DB_PASS"]);
$gateway = new SignupGateway($database);
$controller = new SignupController($gateway);

$controller->process($_SERVER["REQUEST_METHOD"], $data);

/* =========================
   CONTROLLER
========================= */

class SignupController {


  private SignupGateway $gateway;

  public function __construct(SignupGateway $gateway) {
    $this->gateway = $gateway;
  }

  public function process(string $method, array $data): void {
    $action = (string)($data["action"] ?? "");

    try {
      if ($action === "reserveSlot") {
        $email = trim((string)($data["email"] ?? ""));
        echo json_encode($this->gateway->reserveSlot($email));
        return;
      }

      if ($action === "verifyOtp") {
        $email = trim((string)($data["email"] ?? ""));
        $otp = trim((string)($data["otp"] ?? ""));
        $slotSeq = (int)($data["slotSeq"] ?? 0);
        echo json_encode($this->gateway->verifyOtp($email, $otp, $slotSeq));
        return;
      }

      if ($action === "activateCompany") {
        $email = trim((string)($data["email"] ?? ""));
        $otp = trim((string)($data["otp"] ?? ""));
        $slotSeq = (int)($data["slotSeq"] ?? 0);
        $companyName = trim((string)($data["company_name"] ?? ""));
        $dateReg = trim((string)($data["date_registered"] ?? "")); // yyyy-mm-dd
        echo json_encode($this->gateway->activateCompany($email, $otp, $slotSeq, $companyName, $dateReg));
        return;
      }

      http_response_code(400);
      echo json_encode(["message" => "InvalidAction"]);
      return;

    } catch (Exception $e) {
      http_response_code(400);
      echo json_encode(["message" => $e->getMessage()]);
      return;
    }
  }
}

/* =========================
   GATEWAY
========================= */

class SignupGateway {
  private PDO $conn;

  public function __construct(Database $database) {
    $this->conn = $database->getConnection();
  }

  private function isValidEmail(string $email): bool {
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
  }

  private function genOtp(): string {
    return (string) random_int(100000, 999999);
  }

  private function safeCompanyPrefix(string $companyName): string {
    $name = preg_replace("/[^\w\s-]/", " ", $companyName);
    $name = preg_replace("/\s+/", " ", trim((string)$name));
    $parts = explode(" ", strtolower($name));

    $first = $parts[0] ?? "co";
    $first = preg_replace("/[^a-z0-9]/", "", $first);
    if ($first === "") $first = "co";
    return substr($first, 0, 8);
  }

  private function yyFromDate(string $dateReg): string {
    if (preg_match("/^\d{4}-\d{2}-\d{2}$/", $dateReg)) return substr($dateReg, 2, 2);
    return date("y");
  }

  private function randCode2(): string {
    $alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return $alphabet[random_int(0, 35)] . $alphabet[random_int(0, 35)];
  }

  private function generateUniqueCompanyCode(string $companyName, string $dateReg): string {
    $prefix = $this->safeCompanyPrefix($companyName);
    $yy = $this->yyFromDate($dateReg);

    for ($i = 0; $i < 12; $i++) {
      $code = strtolower($prefix . $yy . $this->randCode2());
      $sql = "SELECT 1 FROM lkp_clients WHERE LOWER(company_code) = LOWER(:code) LIMIT 1";
      $stmt = $this->conn->prepare($sql);
      $stmt->bindValue(":code", $code, PDO::PARAM_STR);
      $stmt->execute();
      if ($stmt->rowCount() === 0) return $code;
    }
    return strtolower($prefix . $yy . random_int(100, 999));
  }

  /* =========================
     ✅ OTP EMAIL via EmailSendController (SMTP)
  ========================= */

  private function sendOtpEmail(string $email, string $otp, int $slotSeq): void {
    try {
      $emailController = new EmailSendController();

      $safeEmail = strtolower(trim($email));
      $safeOtp = htmlspecialchars((string)$otp, ENT_QUOTES, "UTF-8");
      $safeSlot = htmlspecialchars((string)$slotSeq, ENT_QUOTES, "UTF-8");

      $subject = "Exinnov Signup OTP";

      $html = "
      <html>
        <body style='margin:0; padding:0; background-color:#ffffff;'>
          <table align='center' width='100%' cellpadding='0' cellspacing='0'
            style='max-width:600px; margin:auto; background:#ffffff; font-family:Arial, sans-serif; color:#333333; border-collapse:collapse;'>
            <tr>
              <td style='padding:18px; text-align:center; background-color:#f1f1f1;'>
                <img src='https://exinnovph.com/images/app/logo.png' alt='Exinnov Logo' width='120' style='display:block; margin:auto;'>
              </td>
            </tr>

            <tr>
              <td style='padding:28px;'>
                <p style='font-size:16px; margin:0 0 14px;'>
                  Your Exinnov signup OTP is:
                </p>

                <div style='margin:14px 0 18px; padding:18px; border:1px solid #eee; border-radius:12px; background:#fafafa; text-align:center;'>
                  <div style='font-size:28px; letter-spacing:6px; font-weight:bold; color:#111;'>{$safeOtp}</div>
                  <div style='font-size:12px; color:#777; margin-top:8px;'>Slot Ref: {$safeSlot}</div>
                </div>

                <p style='font-size:13px; margin:0 0 8px; color:#444;'>
                  If you did not request this OTP, you can ignore this email.
                </p>

                <p style='font-size:12px; margin:0; color:#888;'>
                  © 2026 Exinnov. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>";

      $emailController->sendEmail(
        "mail.exinnovph.com",
        "admin@exinnovph.com",
        "ExinnovEmail@2025",
        "admin@exinnovph.com",
        $safeEmail,
        $subject,
        $html
      );
    } catch (Exception $mailErr) {
      // ✅ Do not block OTP flow if email fails
      // error_log("OTP email failed: " . $mailErr->getMessage());
    }
  }

  /* =========================
     ACTIONS
  ========================= */

  /** ✅ Reserve slot first + return API + send OTP */
  public function reserveSlot(string $email): array {
    $email = strtolower(trim($email));
    if (!$this->isValidEmail($email)) throw new Exception("InvalidEmail");

    // ✅ Email already exists? (central)
    $sql = "SELECT 1 FROM lkp_clients
            WHERE LOWER(email) = LOWER(:email)
            LIMIT 1";
    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->execute();
    if ($stmt->rowCount() > 0) {
      return ["message" => "EmailAlreadyExists"];
    }

    // Find available slot
    $sql = "SELECT seq, api FROM lkp_clients
            WHERE deletestatus = 'Available'
              AND company_code = 'nouser'
            ORDER BY seq ASC
            LIMIT 1";
    $stmt = $this->conn->prepare($sql);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) return ["message" => "NoSlotAvailable"];

    $slotSeq = (int) $row["seq"];
    $otp = $this->genOtp();

    // Reserve slot
    $update = "UPDATE lkp_clients
               SET deletestatus = 'Reserved',
                   usertracker = :otp,
                   email = :email
               WHERE seq = :seq
                 AND deletestatus = 'Available'
                 AND company_code = 'nouser'";
    $u = $this->conn->prepare($update);
    $u->bindValue(":otp", $otp, PDO::PARAM_STR);
    $u->bindValue(":email", $email, PDO::PARAM_STR);
    $u->bindValue(":seq", $slotSeq, PDO::PARAM_INT);
    $u->execute();

    if ($u->rowCount() === 0) {
      return ["message" => "NoSlotAvailable"];
    }

    // ✅ Send OTP using EmailSendController SMTP
    $this->sendOtpEmail($email, $otp, $slotSeq);

    return [
      "message" => "OtpSent",
      "slotSeq" => $slotSeq,
      "api" => $row["api"] ?? null
    ];
  }

  /** Verify OTP (slot must be Reserved) */
  public function verifyOtp(string $email, string $otp, int $slotSeq): array {
    $email = strtolower(trim($email));
    $otp = trim($otp);

    if (!$this->isValidEmail($email)) throw new Exception("InvalidEmail");
    if ($slotSeq <= 0) throw new Exception("InvalidSlot");
    if ($otp === "") throw new Exception("InvalidOtp");

    $sql = "SELECT 1 FROM lkp_clients
            WHERE seq = :seq
              AND deletestatus = 'Reserved'
              AND LOWER(email) = LOWER(:email)
              AND usertracker = :otp
            LIMIT 1";
    $stmt = $this->conn->prepare($sql);
    $stmt->bindValue(":seq", $slotSeq, PDO::PARAM_INT);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":otp", $otp, PDO::PARAM_STR);
    $stmt->execute();

    if ($stmt->rowCount() === 0) return ["message" => "OtpInvalid"];
    return ["message" => "OtpVerified"];
  }

  /** Activate company ONLY after OTP verified */
  public function activateCompany(string $email, string $otp, int $slotSeq, string $companyName, string $dateReg): array {
    $email = strtolower(trim($email));
    $otp = trim($otp);
    $companyName = trim($companyName);

    if (!$this->isValidEmail($email)) throw new Exception("InvalidEmail");
    if ($slotSeq <= 0) throw new Exception("InvalidSlot");
    if ($companyName === "") throw new Exception("CompanyNameRequired");

    $check = "SELECT api FROM lkp_clients
              WHERE seq = :seq
                AND deletestatus = 'Reserved'
                AND LOWER(email) = LOWER(:email)
                AND usertracker = :otp
              LIMIT 1";
    $stmt = $this->conn->prepare($check);
    $stmt->bindValue(":seq", $slotSeq, PDO::PARAM_INT);
    $stmt->bindValue(":email", $email, PDO::PARAM_STR);
    $stmt->bindValue(":otp", $otp, PDO::PARAM_STR);
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) return ["message" => "NoSlotAvailable"];

    $companyCode = $this->generateUniqueCompanyCode($companyName, $dateReg);

    $update = "UPDATE lkp_clients
               SET company_name = :company_name,
                   company_code = :company_code,
                   deletestatus = 'Active',
                   createdtime = DATE_ADD(NOW(), INTERVAL 8 HOUR)
               WHERE seq = :seq
                 AND deletestatus = 'Reserved'
                 AND LOWER(email) = LOWER(:email)
                 AND usertracker = :otp";
    $u = $this->conn->prepare($update);
    $u->bindValue(":company_name", strtoupper($companyName), PDO::PARAM_STR);
    $u->bindValue(":company_code", $companyCode, PDO::PARAM_STR);
    $u->bindValue(":seq", $slotSeq, PDO::PARAM_INT);
    $u->bindValue(":email", $email, PDO::PARAM_STR);
    $u->bindValue(":otp", $otp, PDO::PARAM_STR);
    $u->execute();

    if ($u->rowCount() === 0) return ["message" => "NoSlotAvailable"];

    return [
      "message" => "Activated",
      "company_code" => $companyCode,
      "api" => $row["api"] ?? null
    ];
  }
}
