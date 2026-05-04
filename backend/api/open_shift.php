<?php
/**
 * OPEN NEW SHIFT API
 * Handles shift validation and insertion into tbl_pos_shifting_records
 * With logs to:
 * - tbl_main_activity_logs
 * - tbl_main_transaction_logs
 */

declare(strict_types=1);

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

date_default_timezone_set("Asia/Manila");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/
function respondJson(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cleanString($value): string
{
    return trim((string)($value ?? ""));
}

function cleanAmount($value): string
{
    $value = trim((string)($value ?? ""));
    $value = str_replace(',', '', $value);
    return $value;
}

function releaseLockSafely(PDO $pdo, string $lockName): void
{
    try {
        $stmt = $pdo->prepare("SELECT RELEASE_LOCK(:lock_name)");
        $stmt->execute([":lock_name" => $lockName]);
    } catch (Throwable $e) {
        // ignore unlock failure
    }
}

/*
|--------------------------------------------------------------------------
| Load Config
|--------------------------------------------------------------------------
*/
$configPath = __DIR__ . "/config.php";

if (!file_exists($configPath)) {
    respondJson(500, [
        "status"  => "error",
        "message" => "config.php not found"
    ]);
}

$config = require $configPath;

/*
|--------------------------------------------------------------------------
| Database Connection
|--------------------------------------------------------------------------
*/
try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO(
        $dsn,
        $config['user'],
        $config['pass'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    respondJson(500, [
        "status"  => "error",
        "message" => "Database connection failed.",
        "error"   => $e->getMessage()
    ]);
}

/*
|--------------------------------------------------------------------------
| Accept FormData first, JSON fallback
|--------------------------------------------------------------------------
*/
$input = $_POST;

if (empty($input)) {
    $raw = file_get_contents("php://input");
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $input = $decoded;
    }
}

/*
|--------------------------------------------------------------------------
| Request Data
|--------------------------------------------------------------------------
*/
$user_id         = cleanString($input["user_id"] ?? "");
$user_name       = cleanString($input["user_name"] ?? "");
$cashier_name    = cleanString($input["cashier_name"] ?? $user_name);
$category_code   = cleanString($input["category_code"] ?? "");
$unit_code       = cleanString($input["unit_code"] ?? "");
$terminal_number = cleanString($input["terminal_number"] ?? "1");
$opening_cash    = cleanAmount($input["opening_cash_count"] ?? "");
$confirm_cash    = cleanAmount($input["opening_cash_count_confirmation"] ?? "");
$opening_date    = cleanString($input["opening_date"] ?? date("Y-m-d"));

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondJson(405, [
        "status"  => "error",
        "message" => "Method not allowed. POST required."
    ]);
}

if ($user_id === "" || $category_code === "" || $unit_code === "") {
    respondJson(422, [
        "status"  => "error",
        "message" => "Required identification fields (User, Category, or Unit) are missing."
    ]);
}

if ($opening_cash === "" || $confirm_cash === "") {
    respondJson(422, [
        "status"  => "error",
        "message" => "Please input opening amounts."
    ]);
}

if (!is_numeric($opening_cash) || !is_numeric($confirm_cash)) {
    respondJson(422, [
        "status"  => "error",
        "message" => "Opening amounts must be numeric."
    ]);
}

// if ((float)$opening_cash <= 0 || (float)$confirm_cash <= 0) {
//     respondJson(422, [
//         "status"  => "error",
//         "message" => "Opening amounts must be greater than zero."
//     ]);
// }

if ((float)$opening_cash !== (float)$confirm_cash) {
    respondJson(422, [
        "status"  => "error",
        "message" => "Opening cash and verification amounts do not match."
    ]);
}

/*
|--------------------------------------------------------------------------
| Main Process
|--------------------------------------------------------------------------
*/
$currentTime     = date("H:i:s");
$openNewDateTime = date("Y-m-d H:i:s", strtotime($opening_date . " " . $currentTime));
$checkDate       = date("Y-m-d", strtotime($openNewDateTime));
$lockName        = 'pos_open_shift_' . md5($unit_code . '|' . $terminal_number);

try {
    $pdo->beginTransaction();

    /*
    |--------------------------------------------------------------------------
    | Acquire Lock
    |--------------------------------------------------------------------------
    */
    $lockStmt = $pdo->prepare("SELECT GET_LOCK(:lock_name, 10) AS lck");
    $lockStmt->execute([":lock_name" => $lockName]);
    $lockRow = $lockStmt->fetch();

    if (!$lockRow || (int)($lockRow['lck'] ?? 0) !== 1) {
        throw new Exception("Could not acquire terminal shift lock. Please retry.");
    }

    /*
    |--------------------------------------------------------------------------
    | Check Existing Open Shift
    |--------------------------------------------------------------------------
    */
    $sqlCheckOpen = "
        SELECT COUNT(*) 
        FROM tbl_pos_shifting_records
        WHERE Unit_Code = ?
          AND terminal_number = ?
          AND Shift_Status = 'Open'
        FOR UPDATE
    ";
    $stmtCheckOpen = $pdo->prepare($sqlCheckOpen);
    $stmtCheckOpen->execute([$unit_code, $terminal_number]);

    if ((int)$stmtCheckOpen->fetchColumn() > 0) {
        throw new Exception("This terminal already has an active open shift.");
    }

    /*
    |--------------------------------------------------------------------------
    | Check Duplicate Date Record
    |--------------------------------------------------------------------------
    */
    $sqlCheckDate = "
        SELECT COUNT(*)
        FROM tbl_pos_shifting_records
        WHERE Unit_Code = ?
          AND terminal_number = ?
          AND DATE(Opening_DateTime) = ?
        FOR UPDATE
    ";
    $stmtCheckDate = $pdo->prepare($sqlCheckDate);
    $stmtCheckDate->execute([$unit_code, $terminal_number, $checkDate]);

    if ((int)$stmtCheckDate->fetchColumn() > 0) {
        throw new Exception("A shift record for this date already exists.");
    }

    /*
    |--------------------------------------------------------------------------
    | Generate Next Shift ID
    |--------------------------------------------------------------------------
    */
    $sqlShiftId = "
        SELECT COALESCE(MAX(Shift_ID), 0) + 1
        FROM tbl_pos_shifting_records
        WHERE Unit_Code = ?
          AND terminal_number = ?
        FOR UPDATE
    ";
    $stmtShift = $pdo->prepare($sqlShiftId);
    $stmtShift->execute([$unit_code, $terminal_number]);

    $next_shift_id = (int)$stmtShift->fetchColumn();

    if ($next_shift_id <= 0) {
        throw new Exception("Failed to generate shift id.");
    }

    /*
    |--------------------------------------------------------------------------
    | Insert Shift Record
    |--------------------------------------------------------------------------
    */
    $sqlInsert = "
        INSERT INTO tbl_pos_shifting_records (
            Category_Code,
            Unit_Code,
            Shift_ID,
            terminal_number,
            Opening_User_ID,
            Opening_DateTime,
            Opening_Cash_Count,
            Closing_User_ID,
            Closing_DateTime,
            Closing_Cash_Count,
            Shift_Status,
            Status,
            Date_Recorded
        ) VALUES (
            :Category_Code,
            :Unit_Code,
            :Shift_ID,
            :terminal_number,
            :Opening_User_ID,
            :Opening_DateTime,
            :Opening_Cash_Count,
            '0',
            '',
            '0',
            'Open',
            'Active',
            NOW()
        )
    ";

    $stmtInsert = $pdo->prepare($sqlInsert);
    $stmtInsert->execute([
        ":Category_Code"     => $category_code,
        ":Unit_Code"         => $unit_code,
        ":Shift_ID"          => $next_shift_id,
        ":terminal_number"   => $terminal_number,
        ":Opening_User_ID"   => $user_id,
        ":Opening_DateTime"  => $openNewDateTime,
        ":Opening_Cash_Count"=> (float)$opening_cash
    ]);

    /*
    |--------------------------------------------------------------------------
    | Logs
    |--------------------------------------------------------------------------
    */
    $logNow           = date("Y-m-d H:i:s");
    $logDate          = date("Y-m-d");
    $logTime          = date("H:i:s");
    $resolvedUserName = $user_name !== ""
        ? $user_name
        : ($cashier_name !== "" ? $cashier_name : $user_id);

    try {
        $valuesOfData = json_encode([
            "shift_id"                    => $next_shift_id,
            "opening_time"                => $openNewDateTime,
            "opening_date"                => $opening_date,
            "opening_cash"                => (float)$opening_cash,
            "opening_cash_confirmation"   => (float)$confirm_cash,
            "terminal_number"             => $terminal_number,
            "category_code"               => $category_code,
            "unit_code"                   => $unit_code,
            "status"                      => "Open"
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $stmtActivityLog = $pdo->prepare("
            INSERT INTO tbl_main_activity_logs
            (
                Category_Code,
                Unit_Code,
                activity_date_time,
                user_id,
                user_name,
                type_of_activity,
                activity_performed,
                values_of_data
            )
            VALUES
            (
                :Category_Code,
                :Unit_Code,
                :activity_date_time,
                :user_id,
                :user_name,
                :type_of_activity,
                :activity_performed,
                :values_of_data
            )
        ");

        $stmtActivityLog->execute([
            ":Category_Code"      => $category_code,
            ":Unit_Code"          => $unit_code,
            ":activity_date_time" => $logNow,
            ":user_id"            => $user_id,
            ":user_name"          => $cashier_name,
            ":type_of_activity"   => "POS SHIFT",
            ":activity_performed" => "OPEN NEW SHIFT",
            ":values_of_data"     => $valuesOfData
        ]);
    } catch (Throwable $activityLogError) {
        // ignore activity log failure
    }

    try {
        $referenceNo = (string)$next_shift_id;
        $description = "POS OPEN SHIFT | SHIFT: {$referenceNo} | TERMINAL: {$terminal_number} | OPENING CASH: {$opening_cash} | USER: {$resolvedUserName}";

        $stmtTransactionLog = $pdo->prepare("
            INSERT INTO tbl_main_transaction_logs
            (
                Category_Code,
                Unit_Code,
                Register,
                Trans_Date,
                Reference_No,
                Trans_Type,
                User_ID,
                Amount,
                Description,
                Log_Date,
                Log_Time
            )
            VALUES
            (
                :Category_Code,
                :Unit_Code,
                :Register,
                :Trans_Date,
                :Reference_No,
                :Trans_Type,
                :User_ID,
                :Amount,
                :Description,
                :Log_Date,
                :Log_Time
            )
        ");

        $stmtTransactionLog->execute([
            ":Category_Code" => $category_code,
            ":Unit_Code"     => $unit_code,
            ":Register"      => $terminal_number !== "" ? $terminal_number : "POS",
            ":Trans_Date"    => $checkDate,
            ":Reference_No"  => $referenceNo,
            ":Trans_Type"    => "OPEN SHIFT",
            ":User_ID"       => is_numeric($user_id) ? $user_id : "0",
            ":Amount"        => (float)$opening_cash,
            ":Description"   => $description,
            ":Log_Date"      => $logDate,
            ":Log_Time"      => $logTime
        ]);
    } catch (Throwable $transactionLogError) {
        // ignore transaction log failure
    }

    $pdo->commit();
    releaseLockSafely($pdo, $lockName);

    respondJson(200, [
        "status"  => "success",
        "message" => "New shift has been opened successfully.",
        "data"    => [
            "shift_id"      => $next_shift_id,
            "opening_time"  => $openNewDateTime,
            "opening_cash"  => (float)$opening_cash
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    releaseLockSafely($pdo, $lockName);

    respondJson(500, [
        "status"  => "error",
        "message" => $e->getMessage()
    ]);
}