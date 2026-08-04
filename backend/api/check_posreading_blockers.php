<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

function requireMysqlIdentifier($value, string $label): string
{
    $identifier = trim((string)$value);

    if ($identifier === "" || !preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
        throw new InvalidArgumentException("Invalid {$label} configured.");
    }

    return $identifier;
}

function resolveReadingDatabaseName(array $input, string $posDbName, string $reportDbName): array
{
    $scope = strtolower(trim((string)(
        $input["readingDatabaseScope"] ??
        $input["reading_database_scope"] ??
        "cnc"
    )));

    if ($scope === "report") {
        return [$reportDbName, "report"];
    }

    return [$posDbName, "cnc"];
}

try {
    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        $input = $_POST;
    }

    $config = require __DIR__ . "/config.php";
    $posDbName = requireMysqlIdentifier($config["db"] ?? "db_cnc_pos", "POS database name");
    $reportDbName = requireMysqlIdentifier($config["report_db"] ?? "reports_database", "report database name");
    $charset = requireMysqlIdentifier($config["charset"] ?? "utf8mb4", "database charset");
    [$readingDbName, $readingDatabaseScope] = resolveReadingDatabaseName($input, $posDbName, $reportDbName);

    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$readingDbName};charset={$charset}",
        $config["user"],
        $config["pass"],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $transactionDate = isset($input["transaction_date"])
        ? trim((string) $input["transaction_date"])
        : "";

    $categoryCode = isset($input["category_code"])
        ? trim((string) $input["category_code"])
        : "";

    $unitCode = isset($input["unit_code"])
        ? trim((string) $input["unit_code"])
        : "";

    $terminalNumber = isset($input["terminal_number"])
        ? trim((string) $input["terminal_number"])
        : "";

    if ($transactionDate === "") {
        http_response_code(422);
        echo json_encode([
            "success" => false,
            "message" => "transaction_date is required."
        ]);
        exit;
    }

    $sql = "
        SELECT
            t1.ID,
            t1.transaction_id,
            t1.transaction_date,
            t1.transaction_time,
            t1.table_number,
            t1.order_slip_no,
            t1.billing_no,
            t1.invoice_no,
            t1.TotalAmountDue,
            t1.cashier,
            t1.remarks,
            t1.order_status,
            t1.status
        FROM tbl_pos_transactions t1
        WHERE t1.transaction_date = :transaction_date
          AND TRIM(COALESCE(t1.remarks, '')) IN ('Pending for Payment', 'Billed') AND status NOT in ('Voided','Refunded')
    ";

    $params = [
        ":transaction_date" => $transactionDate,
    ];

    if ($categoryCode !== "") {
        $sql .= " AND t1.Category_Code = :category_code ";
        $params[":category_code"] = $categoryCode;
    }

    if ($unitCode !== "") {
        $sql .= " AND t1.Unit_Code = :unit_code ";
        $params[":unit_code"] = $unitCode;
    }

    if ($terminalNumber !== "") {
        $sql .= " AND CAST(t1.terminal_number AS CHAR) = :terminal_number ";
        $params[":terminal_number"] = $terminalNumber;
    }

    $sql .= " ORDER BY t1.transaction_id DESC ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $data = [];
    $totalAmountDue = 0;

    foreach ($rows as $row) {
        $row["TotalAmountDue"] = (float) ($row["TotalAmountDue"] ?? 0);
        $totalAmountDue += $row["TotalAmountDue"];
        $data[] = $row;
    }

    echo json_encode([
        "success" => true,
        "blocked" => count($data) > 0,
        "message" => count($data) > 0
            ? "POS Reading is blocked because there are still transactions with remarks Pending for Payment or Billed."
            : "No blocking transactions found.",
        "transactionDate" => $transactionDate,
        "readingDatabaseScope" => $readingDatabaseScope,
        "readingDatabase" => $readingDbName,
        "totalTransactions" => count($data),
        "totalAmountDue" => $totalAmountDue,
        "data" => $data
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to check POS Reading blockers.",
        "error" => $e->getMessage()
    ]);
}
