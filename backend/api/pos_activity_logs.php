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

date_default_timezone_set("Asia/Manila");

function respond(bool $success, string $message, int $status = 200, array $extra = []): void {
    http_response_code($status);
    echo json_encode(["success" => $success, "message" => $message, ...$extra]);
    exit;
}

// ── Valid type_of_activity values (mirrors LOG.* constants on the frontend) ───
const VALID_TYPES = [
    "POS ORDER",    // ORDER
    "POS BILLING",  // BILLING
    "POS PAYMENT",  // PAYMENT
    "POS VOID",     // VOID
    "POS REFUND",   // REFUND
    "POS SETTINGS", // SAVE
    "POS REPORT",   // VIEW_REPORT
    "POS DATA",     // EDIT / DELETE
    "POS SHIFT",    // Shift open/close
    "Authentication",
];

// ═════════════════════════════════════════════════════════════════════════════
// POST — insert a new activity log row
// Body fields:
//   category_code      string  Branch/category code  (e.g. "LIGHTERRA")
//   unit_code          string  Business unit UUID     (e.g. "BU-abc123")
//   user_id            string  Logged-in user UUID
//   user_name          string  Cashier display name
//   type_of_activity   string  One of VALID_TYPES
//   activity_performed string  Short verb phrase      (e.g. "SAVE ORDER")
//   values_of_data     string  JSON-encoded detail payload
// ═════════════════════════════════════════════════════════════════════════════
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $body = json_decode(file_get_contents("php://input"), true) ?: [];

    $categoryCode      = trim((string)($body["category_code"]      ?? ""));
    $unitCode          = trim((string)($body["unit_code"]           ?? "0"));
    $userId            = trim((string)($body["user_id"]             ?? ""));
    $userName          = trim((string)($body["user_name"]           ?? ""));
    $typeOfActivity    = trim((string)($body["type_of_activity"]    ?? ""));
    $activityPerformed = trim((string)($body["activity_performed"]  ?? ""));
    $valuesOfData      = trim((string)($body["values_of_data"]      ?? "{}"));

    if ($activityPerformed === "") {
        respond(false, "activity_performed is required.", 400);
    }
    if (!in_array($typeOfActivity, VALID_TYPES, true)) {
        $allowed = implode(", ", VALID_TYPES);
        respond(false, "Invalid type_of_activity. Allowed: $allowed", 400);
    }

    // Ensure values_of_data is valid JSON; wrap plain strings automatically
    $decoded = json_decode($valuesOfData, true);
    if (!is_array($decoded)) {
        $valuesOfData = json_encode(["details" => $valuesOfData], JSON_UNESCAPED_UNICODE);
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO tbl_main_activity_logs (
                Category_Code,
                Unit_Code,
                activity_date_time,
                user_id,
                user_name,
                type_of_activity,
                activity_performed,
                values_of_data
            ) VALUES (
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

        $stmt->execute([
            ":Category_Code"      => $categoryCode,
            ":Unit_Code"          => $unitCode,
            ":activity_date_time" => date("Y-m-d H:i:s"),
            ":user_id"            => $userId,
            ":user_name"          => $userName,
            ":type_of_activity"   => $typeOfActivity,
            ":activity_performed" => $activityPerformed,
            ":values_of_data"     => $valuesOfData,
        ]);

        respond(true, "Activity logged.", 200, ["log_id" => (int)$pdo->lastInsertId()]);

    } catch (Throwable $e) {
        respond(false, $e->getMessage(), 500);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// GET — retrieve logs with optional filters
// Query params:
//   type_of_activity   filter by activity type
//   user_id            filter by user
//   category_code      filter by branch
//   date_from          YYYY-MM-DD  (inclusive)
//   date_to            YYYY-MM-DD  (inclusive, defaults to today)
//   limit              max rows returned (1-500, default 100)
//   offset             pagination offset (default 0)
// ═════════════════════════════════════════════════════════════════════════════
if ($_SERVER["REQUEST_METHOD"] === "GET") {
    $typeFilter   = trim($_GET["type_of_activity"] ?? "");
    $userFilter   = trim($_GET["user_id"]          ?? "");
    $catFilter    = trim($_GET["category_code"]    ?? "");
    $dateFrom     = trim($_GET["date_from"]        ?? date("Y-m-d"));
    $dateTo       = trim($_GET["date_to"]          ?? date("Y-m-d"));
    $limit        = max(1, min(500, (int)($_GET["limit"]  ?? 100)));
    $offset       = max(0, (int)($_GET["offset"] ?? 0));

    $where  = ["DATE(activity_date_time) BETWEEN :date_from AND :date_to"];
    $params = [":date_from" => $dateFrom, ":date_to" => $dateTo];

    if ($typeFilter !== "" && in_array($typeFilter, VALID_TYPES, true)) {
        $where[]                   = "type_of_activity = :type";
        $params[":type"]            = $typeFilter;
    }
    if ($userFilter !== "") {
        $where[]                   = "user_id = :uid";
        $params[":uid"]             = $userFilter;
    }
    if ($catFilter !== "") {
        $where[]                   = "Category_Code = :cat";
        $params[":cat"]             = $catFilter;
    }

    $conditions  = implode(" AND ", $where);
    $whereClause = "WHERE $conditions";

    try {
        $countStmt = $pdo->prepare(
            "SELECT COUNT(*) FROM tbl_main_activity_logs $whereClause"
        );
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $dataStmt = $pdo->prepare("
            SELECT
                ID                AS id,
                Category_Code     AS category_code,
                Unit_Code         AS unit_code,
                activity_date_time,
                user_id,
                user_name,
                type_of_activity,
                activity_performed,
                values_of_data
            FROM tbl_main_activity_logs
            $whereClause
            ORDER BY activity_date_time DESC
            LIMIT :lim OFFSET :off
        ");
        foreach ($params as $key => $val) {
            $dataStmt->bindValue($key, $val);
        }
        $dataStmt->bindValue(":lim", $limit, PDO::PARAM_INT);
        $dataStmt->bindValue(":off", $offset, PDO::PARAM_INT);
        $dataStmt->execute();

        respond(true, "Logs retrieved.", 200, [
            "data"   => $dataStmt->fetchAll(PDO::FETCH_ASSOC),
            "total"  => $total,
            "limit"  => $limit,
            "offset" => $offset,
        ]);

    } catch (Throwable $e) {
        respond(false, $e->getMessage(), 500);
    }
}

respond(false, "Method not allowed.", 405);
