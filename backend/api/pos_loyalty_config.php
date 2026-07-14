<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

const LOYALTY_CATEGORY = "Loyalty";
const LOYALTY_EARNING_DESCRIPTION = "Loyalty Earning Rule (PHP per Point)";
const LOYALTY_REDEMPTION_DESCRIPTION = "Loyalty Redemption Rule (PHP per Point)";
const LOYALTY_MIN_REDEEM_DESCRIPTION = "Loyalty Minimum Points to Redeem";
const LOYALTY_SIGNUP_BONUS_DESCRIPTION = "Loyalty Signup Bonus Points";

function respond($success, $message, $data = null, $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

function normalizePositiveMoney($value, $fallback)
{
    $amount = (float)($value ?? 0);
    if (!is_finite($amount) || $amount <= 0) {
        return $fallback;
    }

    return round($amount, 2);
}

function normalizePoints($value, $fallback)
{
    if (!is_numeric($value)) {
        return $fallback;
    }

    $points = (int)$value;
    if ($points < 0) {
        return $fallback;
    }

    return $points;
}

function normalizeNonNegativePoints($value, $fallback)
{
    if (!is_numeric($value)) {
        return $fallback;
    }

    $points = round((float)$value, 2);
    if ($points < 0) {
        return $fallback;
    }

    return $points;
}

function getSettingValue(PDO $pdo, $category, $description)
{
    $stmt = $pdo->prepare("
        SELECT `value`
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $stmt->execute([
        ":category" => $category,
        ":description" => $description,
    ]);

    $value = $stmt->fetchColumn();
    return $value === false ? null : $value;
}

function upsertSetting(PDO $pdo, $category, $description, $value)
{
    $existingStmt = $pdo->prepare("
        SELECT ID
        FROM tbl_pos_settings
        WHERE category = :category
          AND description = :description
        ORDER BY ID DESC
        LIMIT 1
    ");
    $existingStmt->execute([
        ":category" => $category,
        ":description" => $description,
    ]);

    $existingId = $existingStmt->fetchColumn();

    if ($existingId) {
        $updateStmt = $pdo->prepare("
            UPDATE tbl_pos_settings
            SET `value` = :setting_value
            WHERE ID = :id
        ");
        $updateStmt->execute([
            ":setting_value" => $value,
            ":id" => (int)$existingId,
        ]);
        return;
    }

    $nextIdStmt = $pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings");
    $nextId = (int)$nextIdStmt->fetchColumn();

    $insertStmt = $pdo->prepare("
        INSERT INTO tbl_pos_settings (ID, category, description, `value`)
        VALUES (:id, :category, :description, :setting_value)
    ");
    $insertStmt->execute([
        ":id" => $nextId,
        ":category" => $category,
        ":description" => $description,
        ":setting_value" => $value,
    ]);
}

function readLoyaltyConfig(PDO $pdo)
{
    $earningRule = normalizePositiveMoney(
        getSettingValue($pdo, LOYALTY_CATEGORY, LOYALTY_EARNING_DESCRIPTION),
        100.00
    );

    $redemptionRule = normalizePositiveMoney(
        getSettingValue($pdo, LOYALTY_CATEGORY, LOYALTY_REDEMPTION_DESCRIPTION),
        1.00
    );

    $minPointsToRedeem = normalizePoints(
        getSettingValue($pdo, LOYALTY_CATEGORY, LOYALTY_MIN_REDEEM_DESCRIPTION),
        50
    );

    $signupBonusPoints = normalizeNonNegativePoints(
        getSettingValue($pdo, LOYALTY_CATEGORY, LOYALTY_SIGNUP_BONUS_DESCRIPTION),
        0
    );

    return [
        "earning_rule_amount" => $earningRule,
        "redemption_rule_value" => $redemptionRule,
        "minimum_points_to_redeem" => $minPointsToRedeem,
        "signup_bonus_points" => $signupBonusPoints,
    ];
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "Loyalty configuration loaded.", readLoyaltyConfig($pdo));
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }

    $earningRule = normalizePositiveMoney($body["earning_rule_amount"] ?? null, 100.00);
    $redemptionRule = normalizePositiveMoney($body["redemption_rule_value"] ?? null, 1.00);
    $minPointsToRedeem = normalizePoints($body["minimum_points_to_redeem"] ?? null, 50);
    $signupBonusPoints = normalizeNonNegativePoints($body["signup_bonus_points"] ?? null, 0);

    upsertSetting(
        $pdo,
        LOYALTY_CATEGORY,
        LOYALTY_EARNING_DESCRIPTION,
        number_format($earningRule, 2, ".", "")
    );

    upsertSetting(
        $pdo,
        LOYALTY_CATEGORY,
        LOYALTY_REDEMPTION_DESCRIPTION,
        number_format($redemptionRule, 2, ".", "")
    );

    upsertSetting(
        $pdo,
        LOYALTY_CATEGORY,
        LOYALTY_MIN_REDEEM_DESCRIPTION,
        (string)$minPointsToRedeem
    );

    upsertSetting(
        $pdo,
        LOYALTY_CATEGORY,
        LOYALTY_SIGNUP_BONUS_DESCRIPTION,
        number_format($signupBonusPoints, 2, ".", "")
    );

    respond(true, "Loyalty configuration saved.", readLoyaltyConfig($pdo));
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
