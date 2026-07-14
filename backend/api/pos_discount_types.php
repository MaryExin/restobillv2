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

function fetchDiscountTypes(PDO $pdo)
{
    $stmt = $pdo->query("
        SELECT id, discount_name, calculation_type, default_value,
               is_vat_exempt, is_system_defined, industry_type, status
        FROM lkp_discount_type
        ORDER BY is_system_defined DESC, discount_name ASC
    ");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function fetchActiveSalesTypes(PDO $pdo)
{
    $stmt = $pdo->query("
        SELECT sales_type_id, description AS sales_type
        FROM lkp_sales_type
        WHERE deletestatus = 'Active'
        ORDER BY description ASC
    ");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function fetchMappings(PDO $pdo)
{
    $stmt = $pdo->query("
        SELECT discount_type_id, sales_type_id, is_active, percent_value
        FROM tbl_pos_discount_type_sales_type
    ");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function respondFullState(PDO $pdo, $message = "OK")
{
    respond(true, $message, [
        "discount_types" => fetchDiscountTypes($pdo),
        "sales_types" => fetchActiveSalesTypes($pdo),
        "mappings" => fetchMappings($pdo),
    ]);
}

function fetchActiveTypesForSalesType(PDO $pdo, $salesTypeId, $salesTypeDescription)
{
    $sql = "
        SELECT dt.id, dt.discount_name, dt.calculation_type, dt.is_vat_exempt,
               COALESCE(m.percent_value, dt.default_value) AS percent
        FROM lkp_discount_type dt
        JOIN tbl_pos_discount_type_sales_type m ON m.discount_type_id = dt.id
        JOIN lkp_sales_type st ON st.sales_type_id = m.sales_type_id
        WHERE m.is_active = 1
          AND dt.status = 'active'
    ";
    $params = [];

    if ($salesTypeId !== "") {
        $sql .= " AND m.sales_type_id = :sales_type_id";
        $params[":sales_type_id"] = $salesTypeId;
    } else {
        $sql .= " AND st.description = :sales_type_description";
        $params[":sales_type_description"] = $salesTypeDescription;
    }

    $sql .= " ORDER BY dt.discount_name ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

try {
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        $salesTypeId = trim((string)($_GET["sales_type_id"] ?? ""));
        $salesTypeDescription = trim((string)($_GET["sales_type_description"] ?? ""));
        if ($salesTypeId !== "" || $salesTypeDescription !== "") {
            respond(true, "Active discount types loaded.", [
                "discount_types" => fetchActiveTypesForSalesType($pdo, $salesTypeId, $salesTypeDescription),
            ]);
        }
        respondFullState($pdo);
    }

    if ($method !== "POST") {
        respond(false, "Method not allowed.", null, 405);
    }

    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = [];
    }

    $action = trim((string)($body["action"] ?? ""));

    if ($action === "create_type") {
        $name = trim((string)($body["discount_name"] ?? ""));
        if ($name === "") {
            respond(false, "Discount name is required.", null, 400);
        }

        $calcType = ($body["calculation_type"] ?? "percentage") === "fixed" ? "fixed" : "percentage";
        $defaultValue = round((float)($body["default_value"] ?? 0), 2);
        $isVatExempt = !empty($body["is_vat_exempt"]) ? 1 : 0;

        $stmt = $pdo->prepare("
            INSERT INTO lkp_discount_type
                (discount_name, calculation_type, default_value, is_vat_exempt, is_system_defined, industry_type, status)
            VALUES
                (:name, :calc_type, :default_value, :is_vat_exempt, 0, 'universal', 'active')
        ");
        $stmt->execute([
            ":name" => $name,
            ":calc_type" => $calcType,
            ":default_value" => $defaultValue,
            ":is_vat_exempt" => $isVatExempt,
        ]);

        respondFullState($pdo, "Discount type created.");
    }

    if ($action === "update_type") {
        $id = (int)($body["id"] ?? 0);
        if ($id <= 0) {
            respond(false, "id is required.", null, 400);
        }

        $existingStmt = $pdo->prepare("SELECT * FROM lkp_discount_type WHERE id = :id LIMIT 1");
        $existingStmt->execute([":id" => $id]);
        $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            respond(false, "Discount type not found.", null, 404);
        }

        // System-defined (statutory) types keep their name/calculation type/
        // VAT-exempt flag fixed; only their default percent and active
        // status can be changed from Settings.
        $isSystemDefined = (int)$existing["is_system_defined"] === 1;

        $name = $isSystemDefined
            ? $existing["discount_name"]
            : trim((string)($body["discount_name"] ?? $existing["discount_name"]));

        $calcType = $isSystemDefined
            ? $existing["calculation_type"]
            : (($body["calculation_type"] ?? $existing["calculation_type"]) === "fixed" ? "fixed" : "percentage");

        $isVatExempt = $isSystemDefined
            ? (int)$existing["is_vat_exempt"]
            : (!empty($body["is_vat_exempt"]) ? 1 : 0);

        $defaultValue = isset($body["default_value"])
            ? round((float)$body["default_value"], 2)
            : (float)$existing["default_value"];

        $status = ($body["status"] ?? $existing["status"]) === "inactive" ? "inactive" : "active";

        if ($name === "") {
            respond(false, "Discount name is required.", null, 400);
        }

        $stmt = $pdo->prepare("
            UPDATE lkp_discount_type
            SET discount_name = :name,
                calculation_type = :calc_type,
                default_value = :default_value,
                is_vat_exempt = :is_vat_exempt,
                status = :status
            WHERE id = :id
        ");
        $stmt->execute([
            ":name" => $name,
            ":calc_type" => $calcType,
            ":default_value" => $defaultValue,
            ":is_vat_exempt" => $isVatExempt,
            ":status" => $status,
            ":id" => $id,
        ]);

        respondFullState($pdo, "Discount type updated.");
    }

    if ($action === "delete_type") {
        $id = (int)($body["id"] ?? 0);
        if ($id <= 0) {
            respond(false, "id is required.", null, 400);
        }

        $existingStmt = $pdo->prepare("SELECT is_system_defined FROM lkp_discount_type WHERE id = :id LIMIT 1");
        $existingStmt->execute([":id" => $id]);
        $existing = $existingStmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            respond(false, "Discount type not found.", null, 404);
        }

        if ((int)$existing["is_system_defined"] === 1) {
            respond(false, "Statutory discount types cannot be deleted.", null, 400);
        }

        $pdo->prepare("DELETE FROM tbl_pos_discount_type_sales_type WHERE discount_type_id = :id")
            ->execute([":id" => $id]);
        $pdo->prepare("DELETE FROM lkp_discount_type WHERE id = :id")
            ->execute([":id" => $id]);

        respondFullState($pdo, "Discount type deleted.");
    }

    if ($action === "save_mapping") {
        $discountTypeId = (int)($body["discount_type_id"] ?? 0);
        $rows = is_array($body["mappings"] ?? null) ? $body["mappings"] : [];

        if ($discountTypeId <= 0) {
            respond(false, "discount_type_id is required.", null, 400);
        }

        $upsertStmt = $pdo->prepare("
            INSERT INTO tbl_pos_discount_type_sales_type
                (discount_type_id, sales_type_id, is_active, percent_value, usertracker)
            VALUES
                (:discount_type_id, :sales_type_id, :is_active, :percent_value, :usertracker)
            ON DUPLICATE KEY UPDATE
                is_active = VALUES(is_active),
                percent_value = VALUES(percent_value),
                usertracker = VALUES(usertracker)
        ");

        $usertracker = trim((string)($body["usertracker"] ?? ""));

        $pdo->beginTransaction();
        try {
            foreach ($rows as $row) {
                if (!is_array($row)) continue;

                $salesTypeId = trim((string)($row["sales_type_id"] ?? ""));
                if ($salesTypeId === "") continue;

                $isActive = !empty($row["is_active"]) ? 1 : 0;
                $percentValue = isset($row["percent_value"]) && $row["percent_value"] !== ""
                    ? round((float)$row["percent_value"], 2)
                    : null;

                $upsertStmt->execute([
                    ":discount_type_id" => $discountTypeId,
                    ":sales_type_id" => $salesTypeId,
                    ":is_active" => $isActive,
                    ":percent_value" => $percentValue,
                    ":usertracker" => $usertracker !== "" ? $usertracker : null,
                ]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        respondFullState($pdo, "Sales type availability saved.");
    }

    respond(false, "Unknown action.", null, 400);
} catch (Throwable $e) {
    respond(false, $e->getMessage(), null, 500);
}
