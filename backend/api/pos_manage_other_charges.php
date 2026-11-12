<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$method = $_SERVER["REQUEST_METHOD"];
$requiresMutationAuthorization = in_array($method, ["POST", "PUT", "DELETE"], true);
if ($requiresMutationAuthorization) {
    require __DIR__ . "/secure_guard.php";
}

require __DIR__ . "/pdo.php";
if ($requiresMutationAuthorization) {
    require_once __DIR__ . "/pos_role_authorization.php";
}

// array_is_list() only exists from PHP 8.1; keep this endpoint working on
// PHP 7.4 / 8.0 installs (e.g. Windows XAMPP).
if (!function_exists("array_is_list")) {
    function array_is_list(array $array): bool
    {
        $expected = 0;
        foreach ($array as $key => $_value) {
            if ($key !== $expected) {
                return false;
            }
            $expected++;
        }
        return true;
    }
}

const AUTO_SERVICE_TYPE_CATEGORY = "Service";
const AUTO_SERVICE_TYPE_PREFIX = "Service Charge Auto Types: ";

// array_is_list() only exists in PHP 8.1+; XAMPP ships PHP 8.0.
if (!function_exists("array_is_list")) {
    function array_is_list(array $array): bool {
        return $array === [] || array_keys($array) === range(0, count($array) - 1);
    }
}

function fetchSalesTypes(PDO $pdo): array {
    return $pdo->query("
        SELECT TRIM(sales_type_id) AS sales_type_id, TRIM(description) AS description
        FROM lkp_sales_type
        WHERE TRIM(COALESCE(deletestatus, 'Active')) = 'Active'
          AND TRIM(COALESCE(sales_type_id, '')) <> ''
          AND TRIM(COALESCE(description, '')) <> ''
        ORDER BY description ASC
    ")->fetchAll(PDO::FETCH_ASSOC);
}

function fetchAutoSalesTypeMappings(PDO $pdo): array {
    $stmt = $pdo->prepare("
        SELECT description, `value`
        FROM tbl_pos_settings
        WHERE category = :category AND description LIKE :prefix
        ORDER BY ID DESC
    ");
    $stmt->execute([":category" => AUTO_SERVICE_TYPE_CATEGORY, ":prefix" => AUTO_SERVICE_TYPE_PREFIX . "%"]);
    $mappings = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $description = (string)$row["description"];
        if (array_key_exists($description, $mappings)) continue;
        $ids = json_decode((string)($row["value"] ?? ""), true);
        $mappings[$description] = is_array($ids) && array_is_list($ids)
            ? array_values(array_unique(array_filter($ids, static fn($id) => is_string($id) && trim($id) !== "")))
            : [];
    }
    return $mappings;
}

function validateAutoSalesTypeIds($value, array $salesTypes): array {
    if (!is_array($value) || !array_is_list($value)) {
        throw new InvalidArgumentException("Automatic service types must be a list of service type IDs.");
    }
    $validIds = array_column($salesTypes, "sales_type_id");
    $ids = [];
    foreach ($value as $id) {
        if (!is_string($id) || !in_array(trim($id), $validIds, true)) {
            throw new InvalidArgumentException("Choose an active service type for automatic charges.");
        }
        $ids[] = trim($id);
    }
    return array_values(array_unique($ids));
}

function saveAutoSalesTypeIds(PDO $pdo, int $chargeId, array $ids): void {
    $description = AUTO_SERVICE_TYPE_PREFIX . $chargeId;
    if ($ids === []) {
        deleteAutoSalesTypeIds($pdo, $chargeId);
        return;
    }
    $stmt = $pdo->prepare("
        SELECT ID FROM tbl_pos_settings
        WHERE category = :category AND description = :description
        ORDER BY ID DESC LIMIT 1
    ");
    $stmt->execute([":category" => AUTO_SERVICE_TYPE_CATEGORY, ":description" => $description]);
    $existingId = $stmt->fetchColumn();
    $value = json_encode($ids, JSON_THROW_ON_ERROR);
    if ($existingId !== false) {
        $pdo->prepare("UPDATE tbl_pos_settings SET `value` = :value WHERE ID = :id")
            ->execute([":value" => $value, ":id" => (int)$existingId]);
    } else {
        $nextId = (int)$pdo->query("SELECT COALESCE(MAX(ID), 0) + 1 FROM tbl_pos_settings")->fetchColumn();
        $pdo->prepare("INSERT INTO tbl_pos_settings (ID, category, description, `value`) VALUES (:id, :category, :description, :value)")
            ->execute([":id" => $nextId, ":category" => AUTO_SERVICE_TYPE_CATEGORY, ":description" => $description, ":value" => $value]);
    }
}

function deleteAutoSalesTypeIds(PDO $pdo, int $chargeId): void {
    $pdo->prepare("DELETE FROM tbl_pos_settings WHERE category = :category AND description = :description")
        ->execute([":category" => AUTO_SERVICE_TYPE_CATEGORY, ":description" => AUTO_SERVICE_TYPE_PREFIX . $chargeId]);
}

function fetchCharges(PDO $pdo, array $salesTypes): array {
    $mappings = fetchAutoSalesTypeMappings($pdo);
    $salesTypeNames = array_column($salesTypes, "description", "sales_type_id");
    $stmt = $pdo->query("
        SELECT ID, category, particulars, amount, rate_type, is_enabled
        FROM tbl_pos_list_of_other_charges
        WHERE category = 'POS'
        ORDER BY ID ASC
    ");
    return array_map(function($row) use ($mappings, $salesTypeNames) {
        $ids = $mappings[AUTO_SERVICE_TYPE_PREFIX . (int)$row["ID"]] ?? [];
        $activeIds = array_values(array_filter($ids, static fn($id) => isset($salesTypeNames[$id])));
        return [
            "ID"         => (int)$row["ID"],
            "category"   => $row["category"],
            "particulars"=> $row["particulars"],
            "amount"     => (float)$row["amount"],
            "rate_type"  => $row["rate_type"] ?: "Percentage",
            "is_enabled" => (int)$row["is_enabled"],
            "auto_sales_type_ids" => $ids,
            // Transactions store order_type as the description, not sales_type_id.
            "auto_sales_types" => array_map(static fn($id) => $salesTypeNames[$id], $activeIds),
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function respond(bool $success, string $message, array $charges = [], int $status = 200, array $salesTypes = []): void {
    http_response_code($status);
    echo json_encode(["success" => $success, "message" => $message, "charges" => $charges, "sales_types" => $salesTypes]);
    exit;
}

function respondState(PDO $pdo, string $message): void {
    $salesTypes = fetchSalesTypes($pdo);
    respond(true, $message, fetchCharges($pdo, $salesTypes), 200, $salesTypes);
}

try {
    if ($requiresMutationAuthorization) {
        posRoleAuthRequirePermission(
            $pdo,
            (string)($GLOBALS["pos_user_id"] ?? ""),
            "settings",
            "serviceCharge"
        );
    }

    // GET — list all
    if ($method === "GET") {
        respondState($pdo, "OK");
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true) ?: [];
    if (!is_array($body)) respond(false, "Invalid request body.", [], 400);
    $hasAutoSalesTypes = array_key_exists("auto_sales_type_ids", $body);
    $autoSalesTypeIds = null;
    if ($hasAutoSalesTypes && in_array($method, ["POST", "PUT"], true)) {
        // Keep JSON objects distinguishable from arrays, including an empty {}.
        $decodedBody = json_decode($raw);
        $autoSalesTypeIds = validateAutoSalesTypeIds($decodedBody->auto_sales_type_ids ?? null, fetchSalesTypes($pdo));
    }

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
            $salesTypes = fetchSalesTypes($pdo);
            respond(false, "A charge with that name already exists.", fetchCharges($pdo, $salesTypes), 409, $salesTypes);
        }

        $pdo->beginTransaction();
        $pdo->prepare("
            INSERT INTO tbl_pos_list_of_other_charges (category, particulars, amount, rate_type, is_enabled)
            VALUES ('POS', ?, ?, ?, 0)
        ")->execute([$particulars, $amount, $rateType]);
        $id = (int)$pdo->lastInsertId();
        if ($hasAutoSalesTypes) saveAutoSalesTypeIds($pdo, $id, $autoSalesTypeIds);
        $pdo->commit();

        respondState($pdo, "Charge added.");
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

        $pdo->beginTransaction();
        $existing = $pdo->prepare("SELECT ID FROM tbl_pos_list_of_other_charges WHERE ID = ? AND category = 'POS' FOR UPDATE");
        $existing->execute([$id]);
        if ($existing->fetchColumn() === false) {
            $pdo->rollBack();
            respond(false, "Charge not found.", [], 404);
        }

        if ($isEnabled !== null) {
            // Toggle only
            $pdo->prepare("UPDATE tbl_pos_list_of_other_charges SET is_enabled = ? WHERE ID = ? AND category = 'POS'")
                ->execute([$isEnabled, $id]);
        } elseif (!$hasAutoSalesTypes || array_key_exists("amount", $body) || array_key_exists("rate_type", $body)) {
            $pdo->prepare("
                UPDATE tbl_pos_list_of_other_charges
                SET amount = ?, rate_type = ?
                WHERE ID = ? AND category = 'POS'
            ")->execute([$amount, $rateType, $id]);
        }
        if ($hasAutoSalesTypes) saveAutoSalesTypeIds($pdo, $id, $autoSalesTypeIds);
        $pdo->commit();

        respondState($pdo, "Updated.");
    }

    // DELETE — remove
    if ($method === "DELETE") {
        $id = (int)($body["id"] ?? 0);
        if ($id <= 0) {
            respond(false, "Invalid ID.", [], 400);
        }
        $pdo->beginTransaction();
        $existing = $pdo->prepare("SELECT ID FROM tbl_pos_list_of_other_charges WHERE ID = ? AND category = 'POS' FOR UPDATE");
        $existing->execute([$id]);
        if ($existing->fetchColumn() === false) {
            $pdo->rollBack();
            respond(false, "Charge not found.", [], 404);
        }
        $pdo->prepare("DELETE FROM tbl_pos_list_of_other_charges WHERE ID = ? AND category = 'POS'")
            ->execute([$id]);
        deleteAutoSalesTypeIds($pdo, $id);
        $pdo->commit();
        respondState($pdo, "Charge removed.");
    }

    respond(false, "Method not allowed.", [], 405);

} catch (InvalidArgumentException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond(false, $e->getMessage(), [], 400);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log("POS other charges error: " . $e->getMessage());
    respond(false, "Unable to process other charge settings.", [], 500);
}
