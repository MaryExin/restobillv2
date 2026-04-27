<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require __DIR__ . "/bootstrap.php";

date_default_timezone_set('Asia/Manila');

$manualTransactionStarted = false;

try {
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);
    $data = is_array($json) ? $json : $_POST;

    $config = require __DIR__ . "/config.php";

    $database = new Database(
        $config["host"] ?? "localhost",
        $config["db"] ?? "",
        $config["user"] ?? "",
        $config["pass"] ?? "",
        $config["driver"] ?? "mysql",
        $config["sqlite_path"] ?? ""
    );

    $pdo = $database->getConnection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $rows = $data["rows"] ?? [];

    if (is_string($rows)) {
        $decodedRows = json_decode($rows, true);
        $rows = is_array($decodedRows) ? $decodedRows : [];
    }

    if (!is_array($rows) || empty($rows)) {
        echo json_encode([
            "status" => "error",
            "message" => "No WEB role rows received."
        ]);
        exit;
    }

    $pdo->beginTransaction();
    $manualTransactionStarted = true;

    $sqlCheck = "
        SELECT COUNT(*) 
        FROM tbl_user_roles
        WHERE userid = :userid
          AND roleclass = :roleclass
          AND rolename = :rolename
          AND deletestatus = 'Active'
    ";
    $stmtCheck = $pdo->prepare($sqlCheck);

    $sqlInsert = "
        INSERT INTO tbl_user_roles (
            uuid,
            userid,
            roleclass,
            rolename,
            role_description,
            deletestatus,
            usertracker,
            createtime
        ) VALUES (
            :uuid,
            :userid,
            :roleclass,
            :rolename,
            :role_description,
            :deletestatus,
            :usertracker,
            :createtime
        )
    ";
    $stmtInsert = $pdo->prepare($sqlInsert);

    $insertedCount = 0;
    $skippedCount = 0;
    $errorRows = [];
    $insertedRows = [];

    foreach ($rows as $index => $row) {
        $uuid = trim((string)($row["uuid"] ?? ""));
        $userid = trim((string)($row["userid"] ?? ""));
        $roleclass = trim((string)($row["roleclass"] ?? ""));
        $rolename = trim((string)($row["rolename"] ?? ""));
        $role_description = trim((string)($row["role_description"] ?? ""));
        $deletestatus = "Active";
        $usertracker = trim((string)($data["usertracker"] ?? "WEB ROLE SYNC"));
        $createtime = date("Y-m-d H:i:s");

        if ($uuid === "") {
            $uuid = uniqid("role_", true);
        }

        if ($userid === "" || $roleclass === "" || $rolename === "") {
            $skippedCount++;
            $errorRows[] = [
                "index" => $index,
                "message" => "Missing required fields: userid, roleclass, or rolename."
            ];
            continue;
        }

        $stmtCheck->execute([
            ":userid" => $userid,
            ":roleclass" => $roleclass,
            ":rolename" => $rolename
        ]);

        $existingCount = (int)$stmtCheck->fetchColumn();

        if ($existingCount > 0) {
            $skippedCount++;
            continue;
        }

        $stmtInsert->execute([
            ":uuid" => $uuid,
            ":userid" => $userid,
            ":roleclass" => $roleclass,
            ":rolename" => $rolename,
            ":role_description" => $role_description,
            ":deletestatus" => $deletestatus,
            ":usertracker" => $usertracker,
            ":createtime" => $createtime
        ]);

        $insertedCount++;

        $insertedRows[] = [
            "uuid" => $uuid,
            "userid" => $userid,
            "roleclass" => $roleclass,
            "rolename" => $rolename
        ];
    }

    $pdo->commit();
    $manualTransactionStarted = false;

    echo json_encode([
        "status" => "success",
        "message" => "WEB roles sync completed successfully.",
        "data" => [
            "received_rows" => count($rows),
            "inserted_count" => $insertedCount,
            "skipped_count" => $skippedCount,
            "inserted_rows" => $insertedRows,
            "errors" => $errorRows
        ]
    ]);
} catch (Throwable $e) {
    if (
        isset($pdo) &&
        $pdo instanceof PDO &&
        $manualTransactionStarted
    ) {
        try {
            $pdo->rollBack();
        } catch (Throwable $rollbackError) {
        }
    }

    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}