<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

function respondPosLedger(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function getPosLedgerShiftDate(PDO $pdo): string
{
    $stmt = $pdo->query("
        SELECT Opening_DateTime
        FROM tbl_pos_shifting_records
        WHERE Shift_Status = 'Open'
        ORDER BY id DESC
        LIMIT 1
    ");
    $openingDateTime = $stmt->fetchColumn();

    return $openingDateTime
        ? date("Y-m-d", strtotime((string)$openingDateTime))
        : date("Y-m-d");
}

$method = $_SERVER["REQUEST_METHOD"];
$action = trim((string)($_GET["action"] ?? ""));

if ($action === "get_ledger") {
    if ($method !== "GET") {
        respondPosLedger(["status" => "error", "message" => "Method not allowed."], 405);
    }

    require __DIR__ . "/pdo.php";

    try {
        $stmt = $pdo->query("
            SELECT l.*, u.firstname, u.lastname
            FROM tbl_pos_ledger l
            LEFT JOIN tbl_users_global_assignment u ON l.recorded_by = u.email
            ORDER BY l.id DESC
        ");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as &$row) {
            $firstName = trim((string)($row["firstname"] ?? ""));
            $lastName = trim((string)($row["lastname"] ?? ""));
            $fullName = trim($firstName . " " . $lastName);
            $row["display_name"] = $fullName !== ""
                ? $fullName
                : (string)($row["recorded_by"] ?? "");
        }
        unset($row);

        respondPosLedger(["status" => "success", "data" => $rows]);
    } catch (Throwable $e) {
        error_log("POS ledger read error: " . $e->getMessage());
        respondPosLedger([
            "status" => "error",
            "message" => "Unable to load ledger entries.",
        ], 500);
    }
}

if ($action !== "add_entry") {
    respondPosLedger(["status" => "error", "message" => "Unknown action."], 404);
}

if ($method !== "POST") {
    respondPosLedger(["status" => "error", "message" => "Method not allowed."], 405);
}

require __DIR__ . "/secure_guard.php";
require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

try {
    $authenticatedUserId = (string)($GLOBALS["pos_user_id"] ?? "");
    posRoleAuthRequirePermission(
        $pdo,
        $authenticatedUserId,
        "settings",
        "expensesPetty"
    );

    $request = json_decode(file_get_contents("php://input"), true);
    if (!is_array($request)) {
        respondPosLedger(["status" => "error", "message" => "Invalid request."], 400);
    }

    $type = strtoupper(trim((string)($request["type"] ?? "")));
    $category = trim((string)($request["category"] ?? "General"));
    $description = trim((string)($request["description"] ?? ""));
    $rawAmount = $request["amount"] ?? null;

    if (!in_array($type, ["IN", "OUT"], true)) {
        respondPosLedger(["status" => "error", "message" => "Invalid entry type."], 422);
    }
    if ($description === "" || !is_numeric($rawAmount)) {
        respondPosLedger(["status" => "error", "message" => "Description and amount are required."], 422);
    }

    $authenticatedAccount = posRoleAuthAccount($pdo, $authenticatedUserId);
    $recordedBy = trim((string)($authenticatedAccount["email"] ?? ""));
    if ($recordedBy === "") {
        respondPosLedger(["status" => "error", "message" => "Authenticated account is unavailable."], 403);
    }

    $insert = $pdo->prepare("
        INSERT INTO tbl_pos_ledger (
            entry_type,
            category,
            description,
            amount,
            recorded_by,
            entry_date,
            entry_time,
            status
        ) VALUES (
            :entry_type,
            :category,
            :description,
            :amount,
            :recorded_by,
            :entry_date,
            CURTIME(),
            'active'
        )
    ");
    $insert->execute([
        ":entry_type" => $type,
        ":category" => $category !== "" ? $category : "General",
        ":description" => $description,
        ":amount" => abs((float)$rawAmount),
        ":recorded_by" => $recordedBy,
        ":entry_date" => getPosLedgerShiftDate($pdo),
    ]);

    respondPosLedger(["status" => "success"]);
} catch (Throwable $e) {
    error_log("POS ledger write error: " . $e->getMessage());
    respondPosLedger([
        "status" => "error",
        "message" => "Unable to save the ledger entry.",
    ], 500);
}
