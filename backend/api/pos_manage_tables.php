<?php

declare(strict_types=1);

require __DIR__ . "/secure_guard.php";
require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";

posRoleAuthRequirePermission(
    $pdo,
    (string)($GLOBALS["pos_user_id"] ?? ""),
    "settings",
    "tableLayout"
);

class TableScopeNotFoundException extends RuntimeException
{
}

function respondTables(bool $success, string $message, ?array $data = null, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data,
    ]);
    exit;
}

function resolveTableScope(PDO $pdo, string $categoryCode, string $unitCode): array
{
    if ($unitCode !== "") {
        $stmt = $pdo->prepare("
            SELECT Category_Code, Unit_Code, Unit_Name
            FROM tbl_main_business_units
            WHERE Unit_Code = :unit_code
            LIMIT 1
        ");
        $stmt->execute([":unit_code" => $unitCode]);
    } else {
        $stmt = $pdo->query("
            SELECT Category_Code, Unit_Code, Unit_Name
            FROM tbl_main_business_units
            WHERE Status = 'Active'
              AND TRIM(COALESCE(Unit_Code, '')) <> ''
            ORDER BY ID ASC
            LIMIT 1
        ");
    }

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new TableScopeNotFoundException("No active POS business unit was found.");
    }

    $resolvedCategoryCode = trim((string)($row["Category_Code"] ?? ""));
    $resolvedUnitCode = trim((string)($row["Unit_Code"] ?? ""));

    if ($categoryCode !== "" && strcasecmp($categoryCode, $resolvedCategoryCode) !== 0) {
        throw new InvalidArgumentException("The selected category does not match the POS business unit.");
    }

    return [
        "category_code" => $resolvedCategoryCode,
        "unit_code" => $resolvedUnitCode,
        "unit_name" => trim((string)($row["Unit_Name"] ?? "")),
    ];
}

function readTables(PDO $pdo): array
{
    $stmt = $pdo->query("
        SELECT ID, category_code, unit_code, table_name, transaction_reference, status
        FROM tbl_pos_tables
        ORDER BY table_name ASC, ID ASC
    ");

    return array_map(static function (array $row): array {
        return [
            "ID" => (int)($row["ID"] ?? 0),
            "category_code" => (string)($row["category_code"] ?? ""),
            "unit_code" => (string)($row["unit_code"] ?? ""),
            "table_name" => (string)($row["table_name"] ?? ""),
            "transaction_reference" => (string)($row["transaction_reference"] ?? "0"),
            "status" => (string)($row["status"] ?? "Available"),
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function tableState(PDO $pdo, array $scope): array
{
    return [
        "scope" => $scope,
        "tables" => readTables($pdo),
    ];
}

try {
    $method = $_SERVER["REQUEST_METHOD"];
    if (!in_array($method, ["GET", "POST"], true)) {
        respondTables(false, "Method not allowed.", null, 405);
    }

    $body = [];
    if ($method === "POST") {
        $decoded = json_decode(file_get_contents("php://input"), true);
        if (!is_array($decoded)) {
            respondTables(false, "Invalid request body.", null, 400);
        }
        $body = $decoded;
    }

    $categoryCode = trim((string)(
        $body["category_code"] ?? $_GET["category_code"] ?? ""
    ));
    $unitCode = trim((string)(
        $body["unit_code"] ?? $_GET["unit_code"] ?? ""
    ));

    if ($method === "GET") {
        $scope = null;
        try {
            $scope = resolveTableScope($pdo, $categoryCode, $unitCode);
        } catch (InvalidArgumentException | TableScopeNotFoundException $e) {
            // Listing is a direct tbl_pos_tables read and does not depend on a
            // selected business-unit scope. Scope is only required for adds.
        }

        respondTables(true, "Table list loaded.", [
            "scope" => $scope,
            "tables" => readTables($pdo),
        ]);
    }

    $scope = resolveTableScope($pdo, $categoryCode, $unitCode);

    $tableName = trim((string)($body["table_name"] ?? ""));
    if ($tableName === "") {
        respondTables(false, "Table name is required.", tableState($pdo, $scope), 400);
    }
    if (mb_strlen($tableName) > 100) {
        respondTables(false, "Table name must not exceed 100 characters.", tableState($pdo, $scope), 400);
    }

    $duplicateStmt = $pdo->prepare("
        SELECT ID
        FROM tbl_pos_tables
        WHERE LOWER(TRIM(table_name)) = LOWER(:table_name)
        LIMIT 1
    ");
    $duplicateStmt->execute([
        ":table_name" => $tableName,
    ]);

    if ($duplicateStmt->fetchColumn() !== false) {
        respondTables(false, "That table already exists in tbl_pos_tables.", tableState($pdo, $scope), 409);
    }

    $insertStmt = $pdo->prepare("
        INSERT INTO tbl_pos_tables (
            category_code,
            unit_code,
            table_name,
            transaction_reference,
            status
        ) VALUES (
            :category_code,
            :unit_code,
            :table_name,
            :transaction_reference,
            :status
        )
    ");
    $insertStmt->execute([
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
        ":table_name" => $tableName,
        ":transaction_reference" => "0",
        ":status" => "Available",
    ]);

    respondTables(true, "Table added successfully.", tableState($pdo, $scope), 201);
} catch (InvalidArgumentException $e) {
    respondTables(false, $e->getMessage(), null, 400);
} catch (TableScopeNotFoundException $e) {
    respondTables(false, $e->getMessage(), null, 404);
} catch (Throwable $e) {
    error_log("POS table management error: " . $e->getMessage());
    respondTables(false, "Unable to process the POS table list.", null, 500);
}
