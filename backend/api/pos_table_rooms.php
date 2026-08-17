<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

$config = require __DIR__ . "/config.php";

$conn = new mysqli(
    $config["host"],
    $config["user"],
    $config["pass"],
    $config["db"]
);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Connection failed"]);
    exit;
}

$conn->set_charset($config["charset"] ?? "utf8mb4");

$createTableSql = "
    CREATE TABLE IF NOT EXISTS tbl_pos_table_rooms (
        ID INT NOT NULL AUTO_INCREMENT,
        category_code VARCHAR(100) NOT NULL,
        unit_code VARCHAR(100) NOT NULL,
        room_key VARCHAR(120) NOT NULL,
        room_name VARCHAR(160) NOT NULL,
        tables_json LONGTEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (ID),
        UNIQUE KEY uq_pos_table_rooms_scope (category_code, unit_code, room_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
";

if (!$conn->query($createTableSql)) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Failed to prepare table room storage",
    ]);
    $conn->close();
    exit;
}

$normalizeScopeValue = function ($value) {
    $clean = trim((string)$value);
    return $clean === "" ? "default" : $clean;
};

$normalizeRoomKey = function ($value, $fallback = "main-room") {
    $clean = strtolower(trim((string)$value));
    $clean = preg_replace("/[^a-z0-9]+/", "-", $clean);
    $clean = trim($clean, "-");
    return $clean === "" ? $fallback : substr($clean, 0, 120);
};

$decodeTables = function ($value) {
    if ($value === null || $value === "") {
        return [];
    }

    $decoded = json_decode($value, true);
    if (!is_array($decoded)) {
        return [];
    }

    $tables = [];
    $seen = [];
    foreach ($decoded as $tableName) {
        $clean = trim((string)$tableName);
        $key = strtolower($clean);
        if ($clean === "" || isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;
        $tables[] = $clean;
    }

    return $tables;
};

$readMasterTables = function ($categoryCode, $unitCode) use ($conn) {
    $stmt = $conn->prepare("
        SELECT table_name
        FROM tbl_pos_tables
        WHERE category_code = ?
          AND unit_code = ?
        ORDER BY table_name ASC
    ");

    if (!$stmt) {
        return [];
    }

    $stmt->bind_param("ss", $categoryCode, $unitCode);
    $stmt->execute();
    $result = $stmt->get_result();

    $tables = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            if (!empty($row["table_name"])) {
                $tables[] = $row["table_name"];
            }
        }
    }

    $stmt->close();
    return $tables;
};

$readRooms = function ($categoryCode, $unitCode) use ($conn, $decodeTables) {
    $stmt = $conn->prepare("
        SELECT ID, room_key, room_name, tables_json, sort_order
        FROM tbl_pos_table_rooms
        WHERE category_code = ?
          AND unit_code = ?
          AND is_active = 1
        ORDER BY sort_order ASC, ID ASC
    ");

    if (!$stmt) {
        return [];
    }

    $stmt->bind_param("ss", $categoryCode, $unitCode);
    $stmt->execute();
    $result = $stmt->get_result();

    $rooms = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $rooms[] = [
                "id" => (int)$row["ID"],
                "room_key" => $row["room_key"],
                "room_name" => $row["room_name"],
                "tables" => $decodeTables($row["tables_json"] ?? null),
                "sort_order" => (int)$row["sort_order"],
            ];
        }
    }

    $stmt->close();
    return $rooms;
};

$insertRoom = function (
    $categoryCode,
    $unitCode,
    $roomKey,
    $roomName,
    $tables,
    $sortOrder
) use ($conn) {
    $tablesJson = json_encode(array_values($tables), JSON_UNESCAPED_UNICODE);
    if ($tablesJson === false) {
        $tablesJson = "[]";
    }

    $stmt = $conn->prepare("
        INSERT INTO tbl_pos_table_rooms (
            category_code,
            unit_code,
            room_key,
            room_name,
            tables_json,
            sort_order,
            is_active
        ) VALUES (?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            room_name = VALUES(room_name),
            tables_json = VALUES(tables_json),
            sort_order = VALUES(sort_order),
            is_active = 1,
            date_updated = NOW()
    ");

    if (!$stmt) {
        return false;
    }

    $stmt->bind_param(
        "sssssi",
        $categoryCode,
        $unitCode,
        $roomKey,
        $roomName,
        $tablesJson,
        $sortOrder
    );

    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
};

$ensureDefaultRoom = function ($categoryCode, $unitCode) use (
    $readRooms,
    $readMasterTables,
    $insertRoom
) {
    $rooms = $readRooms($categoryCode, $unitCode);
    if (count($rooms) > 0) {
        return $rooms;
    }

    $tables = $readMasterTables($categoryCode, $unitCode);
    $insertRoom($categoryCode, $unitCode, "main-room", "Main Room", $tables, 0);
    return $readRooms($categoryCode, $unitCode);
};

$respond = function ($status, $message, $data = null, $statusCode = 200) use ($conn) {
    http_response_code($statusCode);
    echo json_encode([
        "status" => $status,
        "message" => $message,
        "data" => $data,
    ]);
    $conn->close();
    exit;
};

try {
    if ($_SERVER["REQUEST_METHOD"] === "GET") {
        $categoryCode = $normalizeScopeValue($_GET["category_code"] ?? $_GET["Category_Code"] ?? "");
        $unitCode = $normalizeScopeValue($_GET["unit_code"] ?? $_GET["Unit_Code"] ?? "");

        $rooms = $ensureDefaultRoom($categoryCode, $unitCode);
        $respond("success", "Table rooms loaded", ["rooms" => $rooms]);
    }

    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        $respond("error", "Method not allowed", null, 405);
    }

    $input = json_decode(file_get_contents("php://input"), true);
    if (!is_array($input)) {
        $respond("error", "Invalid JSON body", null, 400);
    }

    $categoryCode = $normalizeScopeValue($input["category_code"] ?? $input["Category_Code"] ?? "");
    $unitCode = $normalizeScopeValue($input["unit_code"] ?? $input["Unit_Code"] ?? "");
    $roomsInput = is_array($input["rooms"] ?? null) ? $input["rooms"] : [];

    $rooms = [];
    $seenKeys = [];
    foreach ($roomsInput as $index => $room) {
        if (!is_array($room)) {
            continue;
        }

        $roomName = trim((string)($room["room_name"] ?? $room["name"] ?? ""));
        if ($roomName === "") {
            continue;
        }

        $roomKey = $normalizeRoomKey($room["room_key"] ?? $roomName, "room-" . ($index + 1));
        $baseKey = $roomKey;
        $suffix = 2;
        while (isset($seenKeys[$roomKey])) {
            $roomKey = substr($baseKey, 0, 110) . "-" . $suffix;
            $suffix++;
        }

        $seenKeys[$roomKey] = true;
        $tables = $decodeTables(json_encode($room["tables"] ?? []));
        $rooms[] = [
            "room_key" => $roomKey,
            "room_name" => substr($roomName, 0, 160),
            "tables" => $tables,
            "sort_order" => $index,
        ];
    }

    if (count($rooms) === 0) {
        $rooms[] = [
            "room_key" => "main-room",
            "room_name" => "Main Room",
            "tables" => $readMasterTables($categoryCode, $unitCode),
            "sort_order" => 0,
        ];
    }

    $transactionStarted = true;
    $conn->begin_transaction();

    $deactivateStmt = $conn->prepare("
        UPDATE tbl_pos_table_rooms
        SET is_active = 0,
            date_updated = NOW()
        WHERE category_code = ?
          AND unit_code = ?
    ");
    if (!$deactivateStmt) {
        throw new Exception("Failed to prepare room cleanup");
    }
    $deactivateStmt->bind_param("ss", $categoryCode, $unitCode);
    $deactivateStmt->execute();
    $deactivateStmt->close();

    foreach ($rooms as $room) {
        if (!$insertRoom(
            $categoryCode,
            $unitCode,
            $room["room_key"],
            $room["room_name"],
            $room["tables"],
            $room["sort_order"]
        )) {
            throw new Exception("Failed to save table room");
        }
    }

    $conn->commit();
    $transactionStarted = false;

    $respond("success", "Table rooms saved", [
        "rooms" => $readRooms($categoryCode, $unitCode),
    ]);
} catch (Throwable $e) {
    if (!empty($transactionStarted)) {
        $conn->rollback();
    }

    $respond("error", $e->getMessage(), null, 500);
}
?>
