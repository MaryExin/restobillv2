<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require __DIR__ . "/pdo.php";

function fetchCharges(PDO $pdo): array {
    $stmt = $pdo->query("
        SELECT ID, category, particulars, amount, rate_type, is_enabled
        FROM tbl_pos_list_of_other_charges
        WHERE category = 'POS'
        ORDER BY ID ASC
    ");
    return array_map(function($row) {
        return [
            "ID"         => (int)$row["ID"],
            "category"   => $row["category"],
            "particulars"=> $row["particulars"],
            "amount"     => (float)$row["amount"],
            "rate_type"  => $row["rate_type"] ?: "Percentage",
            "is_enabled" => (int)$row["is_enabled"],
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function respond(bool $success, string $message, array $charges = [], int $status = 200): void {
    http_response_code($status);
    echo json_encode(["success" => $success, "message" => $message, "charges" => $charges]);
    exit;
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    // GET — list all
    if ($method === "GET") {
        respond(true, "OK", fetchCharges($pdo));
    }

    $body = json_decode(file_get_contents("php://input"), true) ?: [];

    // POST — add new charge
    if ($method === "POST") {
        $particulars = trim((string)($body["particulars"] ?? ""));
        $amount      = (float)($body["amount"] ?? 0);
        $rateType    = in_array($body["rate_type"] ?? "", ["Percentage", "Fixed"]) ? $body["rate_type"] : "Percentage";

        if ($particulars === "") {
            respond(false, "Charge name is required.", [], 400);
        }

        $check = $pdo->prepare("SELECT ID FROM tbl_pos_list_of_other_charges WHERE category = 'POS' AND particulars = ? LIMIT 1");
        $check->execute([$particulars]);
        if ($check->fetch()) {
            respond(false, "A charge with that name already exists.", fetchCharges($pdo), 409);
        }

        $pdo->prepare("
            INSERT INTO tbl_pos_list_of_other_charges (category, particulars, amount, rate_type, is_enabled)
            VALUES ('POS', ?, ?, ?, 0)
        ")->execute([$particulars, $amount, $rateType]);

        respond(true, "Charge added.", fetchCharges($pdo));
    }

    // PUT — update amount, rate_type, is_enabled
    if ($method === "PUT") {
        $id         = (int)($body["id"] ?? 0);
        $amount     = (float)($body["amount"] ?? 0);
        $rateType   = in_array($body["rate_type"] ?? "", ["Percentage", "Fixed"]) ? $body["rate_type"] : "Percentage";
        $isEnabled  = isset($body["is_enabled"]) ? (int)(bool)$body["is_enabled"] : null;

        if ($id <= 0) {
            respond(false, "Invalid ID.", [], 400);
        }

        if ($isEnabled !== null) {
            // Toggle only
            $pdo->prepare("UPDATE tbl_pos_list_of_other_charges SET is_enabled = ? WHERE ID = ? AND category = 'POS'")
                ->execute([$isEnabled, $id]);
        } else {
            $pdo->prepare("
                UPDATE tbl_pos_list_of_other_charges
                SET amount = ?, rate_type = ?
                WHERE ID = ? AND category = 'POS'
            ")->execute([$amount, $rateType, $id]);
        }

        respond(true, "Updated.", fetchCharges($pdo));
    }

    // DELETE — remove
    if ($method === "DELETE") {
        $id = (int)($body["id"] ?? 0);
        if ($id <= 0) {
            respond(false, "Invalid ID.", [], 400);
        }
        $pdo->prepare("DELETE FROM tbl_pos_list_of_other_charges WHERE ID = ? AND category = 'POS'")
            ->execute([$id]);
        respond(true, "Charge removed.", fetchCharges($pdo));
    }

    respond(false, "Method not allowed.", [], 405);

} catch (Throwable $e) {
    respond(false, $e->getMessage(), [], 500);
}
