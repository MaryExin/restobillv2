<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    header("Allow: GET");
    exit;
}

header("Content-Type: application/json; charset=utf-8");

try {
    $database = new Database(
        $_ENV["DB_HOST"],
        $_ENV["DB_NAME"],
        $_ENV["DB_USER"],
        $_ENV["DB_PASS"]
    );

    $pdo = $database->getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $unitCode = trim((string)($_GET["unitCode"] ?? ""));
    $terminalNumber = trim((string)($_GET["terminalNumber"] ?? ""));
    $categoryCode = trim((string)($_GET["categoryCode"] ?? ""));

    $sql = "
        SELECT
            id,
            categoryCode,
            unitCode,
            businessUnitName,
            terminalNumber,
            corpName,
            machineNumber,
            serialNumber,
            ptuNumber,
            ptuDateIssued,
            status
        FROM tbl_pos_terminal_config
        WHERE status = 'Active'
    ";

    $params = [];

    if ($unitCode !== "") {
        $sql .= " AND unitCode = :unitCode";
        $params["unitCode"] = $unitCode;
    }

    if ($terminalNumber !== "") {
        $sql .= " AND terminalNumber = :terminalNumber";
        $params["terminalNumber"] = $terminalNumber;
    }

    if ($categoryCode !== "") {
        $sql .= " AND categoryCode = :categoryCode";
        $params["categoryCode"] = $categoryCode;
    }

    $sql .= " ORDER BY id DESC LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $config = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$config) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "No active POS terminal configuration found."
        ]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "data" => [
            "categoryCode" => (string)($config["categoryCode"] ?? ""),
            "unitCode" => (string)($config["unitCode"] ?? ""),
            "businessUnitName" => (string)($config["businessUnitName"] ?? ""),
            "terminalNumber" => (string)($config["terminalNumber"] ?? ""),
            "corpName" => (string)($config["corpName"] ?? ""),
            "machineNumber" => (string)($config["machineNumber"] ?? ""),
            "serialNumber" => (string)($config["serialNumber"] ?? ""),
            "ptuNumber" => (string)($config["ptuNumber"] ?? ""),
            "ptuDateIssued" => (string)($config["ptuDateIssued"] ?? "")
        ]
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}