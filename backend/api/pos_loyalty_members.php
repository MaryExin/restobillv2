<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

const LOYALTY_MEMBERS_TABLE = "lkp_loyalty_cs_name";

function getSignupBonusPoints(PDO $pdo): float
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
        ":category" => "Loyalty",
        ":description" => "Loyalty Signup Bonus Points",
    ]);

    $value = $stmt->fetchColumn();
    if (!is_numeric($value)) {
        return 0.0;
    }

    $points = round((float)$value, 2);
    return $points > 0 ? $points : 0.0;
}

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

function mapMemberRow(array $row)
{
    return [
        "id" => (int)$row["id"],
        "customer_name" => $row["customer_name"],
        "phone_number" => $row["phone_number"],
        "loyalty_points" => round((float)$row["loyalty_points"], 2),
        "date_registered" => $row["date_registered"],
    ];
}

function listMembers(PDO $pdo, $search)
{
    $search = trim((string)$search);

    if ($search !== "") {
        $stmt = $pdo->prepare("
            SELECT id, customer_name, phone_number, loyalty_points, date_registered
            FROM " . LOYALTY_MEMBERS_TABLE . "
            WHERE customer_name LIKE :term
               OR phone_number LIKE :term
            ORDER BY date_registered DESC, id DESC
        ");
        $stmt->execute([":term" => "%{$search}%"]);
    } else {
        $stmt = $pdo->query("
            SELECT id, customer_name, phone_number, loyalty_points, date_registered
            FROM " . LOYALTY_MEMBERS_TABLE . "
            ORDER BY date_registered DESC, id DESC
        ");
    }

    return array_map("mapMemberRow", $stmt->fetchAll(PDO::FETCH_ASSOC));
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        $search = $_GET["search"] ?? "";
        respond(true, "Loyalty members loaded.", listMembers($pdo, $search));
    }

    if ($method === "DELETE") {
        $raw = file_get_contents("php://input");
        $body = json_decode($raw, true);
        if (!is_array($body)) {
            $body = [];
        }

        $id = (int)($body["id"] ?? $_GET["id"] ?? 0);
        if ($id <= 0) {
            respond(false, "A valid member id is required.", null, 422);
        }

        $deleteStmt = $pdo->prepare("DELETE FROM " . LOYALTY_MEMBERS_TABLE . " WHERE id = :id");
        $deleteStmt->execute([":id" => $id]);

        if ($deleteStmt->rowCount() === 0) {
            respond(false, "Loyalty member not found.", null, 404);
        }

        respond(true, "Loyalty member deleted.", ["id" => $id]);
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }

    $customerName = trim((string)($body["customer_name"] ?? ""));
    $phoneNumber = trim((string)($body["phone_number"] ?? ""));

    if ($customerName === "") {
        respond(false, "Customer name is required.", null, 422);
    }

    if ($phoneNumber === "" || strlen(preg_replace("/\D/", "", $phoneNumber)) < 7) {
        respond(false, "A valid phone number is required.", null, 422);
    }

    $existingStmt = $pdo->prepare("
        SELECT id FROM " . LOYALTY_MEMBERS_TABLE . "
        WHERE phone_number = :phone
        LIMIT 1
    ");
    $existingStmt->execute([":phone" => $phoneNumber]);

    if ($existingStmt->fetchColumn()) {
        respond(false, "This phone number is already registered.", null, 409);
    }

    $signupBonusPoints = getSignupBonusPoints($pdo);

    $insertStmt = $pdo->prepare("
        INSERT INTO " . LOYALTY_MEMBERS_TABLE . " (customer_name, phone_number, loyalty_points, date_registered)
        VALUES (:customer_name, :phone_number, :signup_bonus_points, NOW())
    ");
    $insertStmt->execute([
        ":customer_name" => $customerName,
        ":phone_number" => $phoneNumber,
        ":signup_bonus_points" => $signupBonusPoints,
    ]);

    $newId = (int)$pdo->lastInsertId();

    $newRowStmt = $pdo->prepare("
        SELECT id, customer_name, phone_number, loyalty_points, date_registered
        FROM " . LOYALTY_MEMBERS_TABLE . "
        WHERE id = :id
    ");
    $newRowStmt->execute([":id" => $newId]);
    $newRow = $newRowStmt->fetch(PDO::FETCH_ASSOC);

    respond(true, "Customer registered.", mapMemberRow($newRow), 201);
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
