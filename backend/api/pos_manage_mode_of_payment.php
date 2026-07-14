<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, PATCH, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

function fetchMops(PDO $pdo): array {
    $stmt = $pdo->query("
        SELECT seq, mop_id, mop, sl_code, reference_On_Off, MOP_On_Off
        FROM tbl_mode_of_payment
        ORDER BY seq ASC
    ");
    return array_map(function ($row) {
        return [
            "seq"              => (int)$row["seq"],
            "mop_id"           => $row["mop_id"],
            "mop"              => $row["mop"],
            "sl_code"          => $row["sl_code"],
            "reference_On_Off" => (int)$row["reference_On_Off"],
            "MOP_On_Off"       => (int)$row["MOP_On_Off"],
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function respond(bool $success, string $message, ?array $data = null, int $status = 200): void {
    http_response_code($status);
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit;
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        respond(true, "OK", fetchMops($pdo));
    }

    if ($method !== "PATCH") {
        respond(false, "Method not allowed.", null, 405);
    }

    $body  = json_decode(file_get_contents("php://input"), true) ?: [];
    $mopId = trim((string)($body["mop_id"] ?? ""));

    if ($mopId === "") {
        respond(false, "mop_id is required.", null, 400);
    }

    // Validate mop_id exists
    $check = $pdo->prepare("SELECT seq FROM tbl_mode_of_payment WHERE mop_id = :id LIMIT 1");
    $check->execute([":id" => $mopId]);
    if (!$check->fetch()) {
        respond(false, "MOP not found.", null, 404);
    }

    $fields = [];
    $params = [":id" => $mopId];

    if (array_key_exists("reference_On_Off", $body)) {
        $fields[] = "reference_On_Off = :ref";
        $params[":ref"] = (int)(bool)$body["reference_On_Off"];
    }
    if (array_key_exists("MOP_On_Off", $body)) {
        $fields[] = "MOP_On_Off = :mop_onoff";
        $params[":mop_onoff"] = (int)(bool)$body["MOP_On_Off"];
    }

    if (empty($fields)) {
        respond(false, "No fields to update.", null, 400);
    }

    $pdo->prepare("
        UPDATE tbl_mode_of_payment
        SET " . implode(", ", $fields) . "
        WHERE mop_id = :id
    ")->execute($params);

    respond(true, "Mode of payment updated.", fetchMops($pdo));

} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
