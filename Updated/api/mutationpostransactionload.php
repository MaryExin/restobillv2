<?php

declare(strict_types=1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET" && $_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Allow: GET, POST, OPTIONS");
    exit;
}

header("Content-Type: application/json; charset=utf-8");

try {
    // MAIN DATABASE
    $database = new Database(
        $_ENV["DB_HOST"],
        $_ENV["DB_NAME"],
        $_ENV["DB_USER"],
        $_ENV["DB_PASS"]
    );

    $pdo = $database->getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // SECOND DATABASE
    $cloudPdo = new PDO(
        "mysql:host=35.213.163.100;dbname=dbrxht3ymgg1pi;charset=utf8mb4",
        "u27ovgaqykbwl",
        "LightemSystems@2025",
        [   
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );

    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);
    $data = is_array($json) ? $json : $_POST;

    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $data = array_merge($_GET, $data);
    }

    $busunitcode = trim((string)($data["busunitcode"] ?? ""));
    $posTransId = trim((string)($data["pos_trans_id"] ?? ""));
    $transdate = trim((string)($data["transdate"] ?? ""));
    $customerId = trim((string)($data["customer_id"] ?? ""));
    $paymentAmount = $data["payment_amount"] ?? 0;
    $paymentMethod = trim((string)($data["payment_method"] ?? ""));
    $datetime = trim((string)($data["datetime"] ?? ""));
    $customerLoadStatus = trim((string)($data["customer_load_status"] ?? "Not Yet Loaded"));

    if ($busunitcode === "" || $posTransId === "") {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "busunitcode and pos_trans_id are required."
        ]);
        exit;
    }

    if ($transdate === "") {
        $transdate = date("Y-m-d");
    }

    if ($datetime === "") {
        $datetime = date("Y-m-d H:i:s");
    }

    // GET TRANSACTION TYPE FROM MAIN DATABASE
    $sqlTransType = "
        SELECT 
            CASE 
                WHEN t2.item_category = 'B1T1 LOAD' THEN 'Top-Up'
                WHEN t3.payment_method = 'B1T1Balance' THEN 'In-App Purchase'
                ELSE 'Normal Purchase'
            END AS pos_trans_type
        FROM tbl_pos_transactions_detailed AS t1
        LEFT JOIN tbl_inventory_products_masterlist AS t2
            ON t1.product_id = t2.product_id
        LEFT JOIN tbl_pos_transactions_payments AS t3
            ON t1.transaction_id = t3.transaction_id
        WHERE t1.Unit_Code = :busunitcode
          AND t1.transaction_id = :pos_trans_id
        LIMIT 1
    ";

    $stmtTransType = $pdo->prepare($sqlTransType);
    $stmtTransType->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
    $stmtTransType->bindValue(":pos_trans_id", $posTransId, PDO::PARAM_STR);
    $stmtTransType->execute();

    $posTransType = $stmtTransType->fetchColumn();
    if (!$posTransType) {
        $posTransType = "Normal Purchase";
    }

    // INSERT INTO SECOND DATABASE
    $sqlInsert = "
        INSERT INTO tbl_pos_app_transactions
        (
            busunitcode,
            pos_trans_id,
            transdate,
            customer_id,
            payment_amount,
            payment_method,
            datetime,
            pos_trans_type,
            customer_load_status
        )
        VALUES
        (
            :busunitcode,
            :pos_trans_id,
            :transdate,
            :customer_id,
            :payment_amount,
            :payment_method,
            :datetime,
            :pos_trans_type,
            :customer_load_status
        )
    ";

    $stmtInsert = $cloudPdo->prepare($sqlInsert);
    $stmtInsert->bindValue(":busunitcode", $busunitcode, PDO::PARAM_STR);
    $stmtInsert->bindValue(":pos_trans_id", $posTransId, PDO::PARAM_STR);
    $stmtInsert->bindValue(":transdate", $transdate, PDO::PARAM_STR);
    $stmtInsert->bindValue(":customer_id", $customerId, PDO::PARAM_STR);
    $stmtInsert->bindValue(":payment_amount", (float)$paymentAmount);
    $stmtInsert->bindValue(":payment_method", $paymentMethod, PDO::PARAM_STR);
    $stmtInsert->bindValue(":datetime", $datetime, PDO::PARAM_STR);
    $stmtInsert->bindValue(":pos_trans_type", $posTransType, PDO::PARAM_STR);
    $stmtInsert->bindValue(":customer_load_status", $customerLoadStatus, PDO::PARAM_STR);
    $stmtInsert->execute();

    echo json_encode([
        "success" => true,
        "message" => "Transaction saved successfully to cloud database.",
        "data" => [
            "busunitcode" => $busunitcode,
            "pos_trans_id" => $posTransId,
            "pos_trans_type" => $posTransType
        ]
    ]);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "System Error: " . $e->getMessage()
    ]);
    exit;
}