<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

date_default_timezone_set('Asia/Manila');

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$config = require __DIR__ . "/config.php";

try {
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['db']};charset=utf8mb4",
        $config["user"],
        $config["pass"],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        $stmt = $pdo->query("
            SELECT
                id,
                qr_item_printing,
                qr_reader,
                payment_syncing,
                automatic_to_payment,
                created_at
            FROM tbl_toggle_kiosks_type
            ORDER BY id DESC
            LIMIT 1
        ");

        $row = $stmt->fetch();

        if (!$row) {
            echo json_encode([
                "success" => true,
                "message" => "No toggle settings found. Returning defaults.",
                "data" => [
                    "id" => null,
                    "qr_item_printing" => false,
                    "qr_reader" => false,
                    "payment_syncing" => false,
                    "automatic_to_payment" => false,
                    "created_at" => null
                ]
            ]);
            exit;
        }

        echo json_encode([
            "success" => true,
            "message" => "Toggle settings loaded successfully.",
            "data" => [
                "id" => (int)$row["id"],
                "qr_item_printing" => (bool)((int)$row["qr_item_printing"]),
                "qr_reader" => (bool)((int)$row["qr_reader"]),
                "payment_syncing" => (bool)((int)$row["payment_syncing"]),
                "automatic_to_payment" => (bool)((int)$row["automatic_to_payment"]),
                "created_at" => $row["created_at"]
            ]
        ]);
        exit;
    }

    if ($method === "POST") {
        $raw = file_get_contents("php://input");
        $input = json_decode($raw, true);

        if (!$input || !is_array($input)) {
            $input = $_POST;
        }

        $key = isset($input["key"]) ? trim((string)$input["key"]) : "";
        $valueRaw = $input["value"] ?? null;

        $allowedKeys = [
            "qr_item_printing",
            "qr_reader",
            "payment_syncing",
            "automatic_to_payment"
        ];

        if ($key === "" || !in_array($key, $allowedKeys, true)) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Invalid toggle key."
            ]);
            exit;
        }

        $value = filter_var($valueRaw, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

        $stmtCheck = $pdo->query("
            SELECT id
            FROM tbl_toggle_kiosks_type
            ORDER BY id DESC
            LIMIT 1
        ");
        $existing = $stmtCheck->fetch();

        if (!$existing) {
            $stmtInsert = $pdo->prepare("
                INSERT INTO tbl_toggle_kiosks_type (
                    qr_item_printing,
                    qr_reader,
                    payment_syncing,
                    automatic_to_payment
                ) VALUES (
                    0,
                    0,
                    0,
                    0
                )
            ");
            $stmtInsert->execute();
            $rowId = (int)$pdo->lastInsertId();
        } else {
            $rowId = (int)$existing["id"];
        }

        $sql = "UPDATE tbl_toggle_kiosks_type SET {$key} = :value WHERE id = :id";
        $stmtUpdate = $pdo->prepare($sql);
        $stmtUpdate->bindValue(":value", $value, PDO::PARAM_INT);
        $stmtUpdate->bindValue(":id", $rowId, PDO::PARAM_INT);
        $stmtUpdate->execute();

        $stmtRead = $pdo->prepare("
            SELECT
                id,
                qr_item_printing,
                qr_reader,
                payment_syncing,
                automatic_to_payment,
                created_at
            FROM tbl_toggle_kiosks_type
            WHERE id = :id
            LIMIT 1
        ");
        $stmtRead->bindValue(":id", $rowId, PDO::PARAM_INT);
        $stmtRead->execute();

        $row = $stmtRead->fetch();

        echo json_encode([
            "success" => true,
            "message" => "Toggle updated successfully.",
            "data" => [
                "id" => (int)$row["id"],
                "qr_item_printing" => (bool)((int)$row["qr_item_printing"]),
                "qr_reader" => (bool)((int)$row["qr_reader"]),
                "payment_syncing" => (bool)((int)$row["payment_syncing"]),
                "automatic_to_payment" => (bool)((int)$row["automatic_to_payment"]),
                "created_at" => $row["created_at"]
            ]
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed. Use GET or POST."
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}