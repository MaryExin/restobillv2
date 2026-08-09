<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

// Preserve the endpoint's existing GET behavior; only report dispatch mutates
// external state and therefore requires the emailReports permission.
if ($_SERVER["REQUEST_METHOD"] === "GET") {
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: GET, POST");
    echo json_encode(["status" => "error", "message" => "Method not allowed."]);
    exit;
}

require __DIR__ . "/secure_guard.php";
require_once __DIR__ . "/../vendor/autoload.php";
require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

function respondPosDispatch(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

$temporaryFile = null;

try {
    posRoleAuthRequirePermission(
        $pdo,
        (string)($GLOBALS["pos_user_id"] ?? ""),
        "settings",
        "emailReports"
    );

    $request = json_decode(file_get_contents("php://input"), true);
    if (!is_array($request)) {
        respondPosDispatch(["status" => "error", "message" => "Invalid request."], 400);
    }

    $targetDate = trim((string)($request["selected_date"] ?? date("Y-m-d")));
    $date = DateTimeImmutable::createFromFormat("!Y-m-d", $targetDate);
    if (!$date || $date->format("Y-m-d") !== $targetDate) {
        respondPosDispatch(["status" => "error", "message" => "Invalid report date."], 422);
    }

    $requestedReports = is_array($request["reports"] ?? null)
        ? $request["reports"]
        : [];
    $reports = [
        "dailySales" => !empty($requestedReports["dailySales"]),
        "salesPerItem" => !empty($requestedReports["salesPerItem"]),
        "expensesPetty" => !empty($requestedReports["expensesPetty"]),
    ];
    if (!in_array(true, $reports, true)) {
        respondPosDispatch(["status" => "error", "message" => "Select at least one report."], 422);
    }

    $temporaryFile = tempnam(sys_get_temp_dir(), "pos-report-");
    if ($temporaryFile === false) {
        throw new RuntimeException("Unable to create the report file.");
    }

    $file = fopen($temporaryFile, "wb");
    if ($file === false) {
        throw new RuntimeException("Unable to open the report file.");
    }

    try {
        fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));

        if ($reports["dailySales"]) {
            fputcsv($file, ["=== DAILY SALES SUMMARY ==="]);
            fputcsv($file, ["Date", "Gross Sales", "Total Discount", "Net Amount Due"]);
            $stmt = $pdo->prepare("
                SELECT
                    transaction_date,
                    SUM(TotalSales),
                    SUM(Discount),
                    SUM(TotalAmountDue)
                FROM tbl_pos_transactions
                WHERE transaction_date = :target_date
                  AND status = 'Active'
            ");
            $stmt->execute([":target_date" => $targetDate]);
            $row = $stmt->fetch(PDO::FETCH_NUM);
            fputcsv(
                $file,
                ($row && $row[0]) ? $row : [$targetDate, "0.00", "0.00", "0.00"]
            );
            fputcsv($file, []);
        }

        if ($reports["salesPerItem"]) {
            fputcsv($file, ["=== SALES PER ITEM ==="]);
            fputcsv($file, ["Code", "Product Name", "Qty", "Total Revenue"]);
            $stmt = $pdo->prepare("
                SELECT
                    d.product_id,
                    COALESCE(m.item_name, d.product_id),
                    SUM(d.sales_quantity),
                    SUM(d.sales_quantity * d.selling_price)
                FROM tbl_pos_transactions_detailed d
                LEFT JOIN tbl_inventory_products_masterlist m
                    ON m.product_id = d.product_id
                WHERE d.transaction_date = :target_date
                GROUP BY d.product_id, m.item_name
            ");
            $stmt->execute([":target_date" => $targetDate]);
            while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
                fputcsv($file, $row);
            }
            fputcsv($file, []);
        }

        if ($reports["expensesPetty"]) {
            fputcsv($file, ["=== LEDGER REPORT (CASH FLOW) ==="]);
            fputcsv($file, ["ID", "Type", "Category", "Description", "Amount", "Time"]);
            $stmt = $pdo->prepare("
                SELECT id, entry_type, category, description, amount, entry_time
                FROM tbl_pos_ledger
                WHERE entry_date = :target_date
                  AND status = 'active'
                ORDER BY
                    CASE WHEN entry_type = 'IN' THEN 1 ELSE 2 END ASC,
                    entry_time ASC
            ");
            $stmt->execute([":target_date" => $targetDate]);

            $count = 0;
            while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
                fputcsv($file, $row);
                $count++;
            }
            if ($count === 0) {
                fputcsv($file, ["No ledger entries found for this day."]);
            }
            fputcsv($file, []);
        }
    } finally {
        fclose($file);
    }

    $filename = "CNC_REPORTS_" . $targetDate . ".csv";
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = "smtp.gmail.com";
    $mail->SMTPAuth = true;
    $mail->Username = "veegalvez0@gmail.com";
    $mail->Password = "bghw kbek vnnc mhab";
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;
    $mail->setFrom("veegalvez0@gmail.com", "CNC REPORTS SENDER");
    $mail->addAddress("silverioj824@gmail.com");
    $mail->Subject = "CNC POS CONSOLIDATED REPORT - " . $targetDate;
    $mail->Body = "Attached is the daily report packet (Sales, Items, and Ledger Transactions).";
    $mail->addAttachment($temporaryFile, $filename);
    $mail->send();

    @unlink($temporaryFile);
    $temporaryFile = null;
    respondPosDispatch(["status" => "success", "message" => "Successful!"]);
} catch (Exception $e) {
    error_log("POS report mail error: " . $e->getMessage());
    if (is_string($temporaryFile) && is_file($temporaryFile)) {
        @unlink($temporaryFile);
    }
    respondPosDispatch([
        "status" => "error",
        "message" => "Unable to send the report email.",
    ], 500);
} catch (Throwable $e) {
    error_log("POS report dispatch error: " . $e->getMessage());
    if (is_string($temporaryFile) && is_file($temporaryFile)) {
        @unlink($temporaryFile);
    }
    respondPosDispatch([
        "status" => "error",
        "message" => "Unable to prepare the report email.",
    ], 500);
}
