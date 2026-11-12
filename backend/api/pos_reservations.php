<?php
declare(strict_types=1);

/**
 * POS reservations.
 *
 * GET  ?date=YYYY-MM-DD                 reservations on that date (all statuses)
 * GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD   reservations in a date range
 * GET  (no date)                        upcoming: today onward, Booked only
 * GET  &status=Booked,Arrived           optional status filter
 * GET  &include_rooms=1                 also return the rooms grouped by floor
 *
 * GET  &include_menu=1                  also return the business unit codes and
 *                                       the sales types (for the pre-order picker)
 *
 * POST {action: "create", guest_name, contact_number, guest_count,
 *       reservation_date, reservation_time, table_name, special_request,
 *       pre_order_sales_type, pre_order_items: [{product_id, quantity}]}
 * POST {action: "update", id, ...same fields}
 * POST {action: "status", id, status}
 *
 * Pre-ordered items are optional; prices are re-read when the order is opened.
 * The guest is also saved in the customer registry (pos_customers.php) and
 * the reservation keeps the customer_code.
 * Written for PHP 7.4+ (no PHP 8-only syntax) so it also runs on older
 * Windows XAMPP installs.
 */

require __DIR__ . "/secure_guard.php";
require __DIR__ . "/pdo.php";
require_once __DIR__ . "/pos_role_authorization.php";
require_once __DIR__ . "/pos_customers.php";

date_default_timezone_set("Asia/Manila");

const RESERVATION_STATUSES = ["Booked", "Arrived", "Cancelled", "No Show"];
const RESERVATION_ACTIVE_STATUSES = ["Booked", "Arrived"];
// Two reservations on the same room/table must be at least this far apart.
const RESERVATION_CONFLICT_MINUTES = 120;
// Allow recording a reservation that started a little while ago (walk-ins).
const RESERVATION_PAST_GRACE_MINUTES = 30;
const RESERVATION_MAX_PRE_ORDER_LINES = 50;

class ReservationValidationException extends RuntimeException
{
}

function respondReservations(bool $success, string $message, $data = null, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data,
    ]);
    exit;
}

function ensureReservationsTable(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tbl_pos_reservations (
            ID INT NOT NULL AUTO_INCREMENT,
            category_code VARCHAR(100) NOT NULL,
            unit_code VARCHAR(100) NOT NULL,
            guest_name VARCHAR(150) NOT NULL,
            contact_number VARCHAR(30) NOT NULL,
            guest_count INT NOT NULL DEFAULT 1,
            reservation_date DATE NOT NULL,
            reservation_time TIME NOT NULL,
            table_name VARCHAR(100) NULL,
            special_request TEXT NULL,
            pre_order_sales_type VARCHAR(45) NULL,
            pre_order_json LONGTEXT NULL,
            customer_code VARCHAR(20) NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Booked',
            created_by VARCHAR(100) NULL,
            updated_by VARCHAR(100) NULL,
            date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (ID),
            KEY idx_pos_reservations_scope_date (category_code, unit_code, reservation_date),
            KEY idx_pos_reservations_table_date (table_name, reservation_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    // Tables created before pre-orders existed: add the two columns.
    $columns = [];
    foreach ($pdo->query("SHOW COLUMNS FROM tbl_pos_reservations")->fetchAll(PDO::FETCH_ASSOC) as $column) {
        $columns[strtolower((string)$column["Field"])] = true;
    }
    if (!isset($columns["pre_order_sales_type"])) {
        $pdo->exec("ALTER TABLE tbl_pos_reservations ADD COLUMN pre_order_sales_type VARCHAR(45) NULL AFTER special_request");
    }
    if (!isset($columns["pre_order_json"])) {
        $pdo->exec("ALTER TABLE tbl_pos_reservations ADD COLUMN pre_order_json LONGTEXT NULL AFTER pre_order_sales_type");
    }
    if (!isset($columns["customer_code"])) {
        $pdo->exec("ALTER TABLE tbl_pos_reservations ADD COLUMN customer_code VARCHAR(20) NULL AFTER pre_order_json");
    }
    posEnsureCustomersTable($pdo);
}

function resolveReservationScope(PDO $pdo): array
{
    $stmt = $pdo->query("
        SELECT Category_Code, Unit_Code
        FROM tbl_main_business_units
        WHERE Status = 'Active'
          AND TRIM(COALESCE(Unit_Code, '')) <> ''
        ORDER BY ID ASC
        LIMIT 1
    ");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        respondReservations(false, "No active POS business unit was found.", null, 404);
    }

    return [
        "category_code" => trim((string)$row["Category_Code"]),
        "unit_code" => trim((string)$row["Unit_Code"]),
    ];
}

function reservationNow(): DateTime
{
    return new DateTime("now", new DateTimeZone("Asia/Manila"));
}

function parseReservationDate($value): ?string
{
    $value = trim((string)$value);
    $date = DateTime::createFromFormat("!Y-m-d", $value);
    return $date && $date->format("Y-m-d") === $value ? $value : null;
}

function parseReservationTime($value): ?string
{
    $value = trim((string)$value);
    if (!preg_match('/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/', $value, $parts)) {
        return null;
    }
    return $parts[1] . ":" . $parts[2] . ":00";
}

function parseStatusList($value): array
{
    $statuses = [];
    foreach (explode(",", (string)$value) as $status) {
        $status = trim($status);
        if ($status !== "" && in_array($status, RESERVATION_STATUSES, true)) {
            $statuses[] = $status;
        }
    }
    return array_values(array_unique($statuses));
}

function scopeRoomExists(PDO $pdo, array $scope, string $tableName): bool
{
    $stmt = $pdo->prepare("
        SELECT 1
        FROM tbl_pos_tables
        WHERE category_code = :category_code
          AND unit_code = :unit_code
          AND table_name = :table_name
        LIMIT 1
    ");
    $stmt->execute([
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
        ":table_name" => $tableName,
    ]);
    return (bool)$stmt->fetchColumn();
}

/** Sales types that have a price list for this business unit (for the picker). */
function readReservationSalesTypes(PDO $pdo, array $scope): array
{
    $stmt = $pdo->prepare("
        SELECT s.sales_type_id, s.description AS sales_type, MIN(p.pricing_category) AS pricing_category
        FROM lkp_sales_type s
        INNER JOIN tbl_pricing_by_sales_type p
            ON p.sales_type_id = s.sales_type_id
           AND p.busunitcode = :unit_code
        WHERE TRIM(COALESCE(s.deletestatus, 'Active')) = 'Active'
        GROUP BY s.sales_type_id, s.description
        ORDER BY MIN(s.seq) ASC
    ");
    $stmt->execute([":unit_code" => $scope["unit_code"]]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Optional pre-order: [{product_id, quantity, item_instruction?}] for one sales type. Returns
 * [sales type description, JSON] or [null, null] when there is no pre-order.
 * Every item must be active and priced in that sales type; the stored price
 * is only an estimate (the order re-reads current prices).
 */
function readPreOrder(PDO $pdo, array $scope, array $body): array
{
    $rawItems = $body["pre_order_items"] ?? [];
    if (!is_array($rawItems) || count($rawItems) === 0) {
        return [null, null];
    }

    $quantities = [];
    $instructions = [];
    foreach ($rawItems as $item) {
        $productId = trim((string)(is_array($item) ? ($item["product_id"] ?? "") : ""));
        $quantity = filter_var(is_array($item) ? ($item["quantity"] ?? null) : null, FILTER_VALIDATE_INT);
        if ($productId === "" || $quantity === false || $quantity < 1 || $quantity > 999) {
            throw new ReservationValidationException("Each pre-ordered item needs a quantity from 1 to 999.");
        }
        $quantities[$productId] = min(999, ($quantities[$productId] ?? 0) + (int)$quantity);
        // Suggested options / special instruction chosen for the item.
        $instruction = trim((string)(is_array($item) ? ($item["item_instruction"] ?? "") : ""));
        if (mb_strlen($instruction) > 500) {
            throw new ReservationValidationException("An item instruction must be 500 characters or less.");
        }
        if ($instruction !== "") {
            $instructions[$productId] = $instruction;
        }
    }
    if (count($quantities) > RESERVATION_MAX_PRE_ORDER_LINES) {
        throw new ReservationValidationException("A pre-order can have at most " . RESERVATION_MAX_PRE_ORDER_LINES . " different items.");
    }

    $salesTypeName = trim((string)($body["pre_order_sales_type"] ?? ""));
    $salesType = null;
    foreach (readReservationSalesTypes($pdo, $scope) as $row) {
        if (strcasecmp((string)$row["sales_type"], $salesTypeName) === 0) {
            $salesType = $row;
            break;
        }
    }
    if ($salesType === null) {
        throw new ReservationValidationException("Select the service type for the pre-order.");
    }

    $params = [
        ":pricing_category" => $salesType["pricing_category"],
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
    ];
    $placeholders = [];
    $index = 0;
    foreach (array_keys($quantities) as $productId) {
        $placeholder = ":code_" . $index++;
        $placeholders[] = $placeholder;
        $params[$placeholder] = $productId;
    }
    $stmt = $pdo->prepare("
        SELECT T1.inv_code AS product_id, T2.item_name, T1.srp
        FROM tbl_pricing_details AS T1
        INNER JOIN tbl_inventory_products_masterlist AS T2
            ON T2.product_id = T1.inv_code
        WHERE T1.pricing_code = :pricing_category
          AND T2.category_code = :category_code
          AND T2.unit_code = :unit_code
          AND T2.status = 'Active'
          AND T1.inv_code IN (" . implode(", ", $placeholders) . ")
    ");
    $stmt->execute($params);
    $found = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $found[(string)$row["product_id"]] = $row;
    }

    $lines = [];
    foreach ($quantities as $productId => $quantity) {
        if (!isset($found[$productId])) {
            throw new ReservationValidationException(
                "A pre-ordered item is not on the " . $salesType["sales_type"] . " menu anymore. Remove it and try again."
            );
        }
        $lines[] = [
            "product_id" => $productId,
            "item_name" => (string)$found[$productId]["item_name"],
            "quantity" => $quantity,
            "price" => round((float)$found[$productId]["srp"], 2),
            "item_instruction" => $instructions[$productId] ?? "",
        ];
    }

    return [(string)$salesType["sales_type"], json_encode($lines, JSON_UNESCAPED_UNICODE)];
}

/** Validates and normalizes the reservation form fields. */
function readReservationFields(PDO $pdo, array $scope, array $body, ?array $existing = null): array
{
    $guestName = preg_replace('/\s+/', ' ', trim((string)($body["guest_name"] ?? "")));
    if (mb_strlen($guestName) < 2 || mb_strlen($guestName) > 150) {
        throw new ReservationValidationException("Guest full name is required (2 to 150 characters).");
    }

    $contact = trim((string)($body["contact_number"] ?? ""));
    if (!preg_match('/^[0-9+()\-\s]{7,20}$/', $contact) || !preg_match('/\d{7,}/', preg_replace('/\D/', '', $contact))) {
        throw new ReservationValidationException("Enter a valid contact number (at least 7 digits).");
    }

    $guestCount = filter_var($body["guest_count"] ?? null, FILTER_VALIDATE_INT);
    if ($guestCount === false || $guestCount < 1 || $guestCount > 500) {
        throw new ReservationValidationException("Number of guests must be between 1 and 500.");
    }

    $date = parseReservationDate($body["reservation_date"] ?? "");
    if ($date === null) {
        throw new ReservationValidationException("Select a valid reservation date.");
    }

    $time = parseReservationTime($body["reservation_time"] ?? "");
    if ($time === null) {
        throw new ReservationValidationException("Select a valid reservation time.");
    }

    // Past check only when the schedule is new or changed (editing the note of
    // yesterday's reservation must still work).
    $scheduleChanged = $existing === null
        || $existing["reservation_date"] !== $date
        || substr((string)$existing["reservation_time"], 0, 5) !== substr($time, 0, 5);
    if ($scheduleChanged) {
        $when = new DateTime($date . " " . $time, new DateTimeZone("Asia/Manila"));
        $earliest = reservationNow()->modify("-" . RESERVATION_PAST_GRACE_MINUTES . " minutes");
        if ($when < $earliest) {
            throw new ReservationValidationException("The reservation date and time is already in the past.");
        }
    }

    $tableName = trim((string)($body["table_name"] ?? ""));
    if ($tableName !== "" && !scopeRoomExists($pdo, $scope, $tableName)) {
        throw new ReservationValidationException("The selected room/table does not exist.");
    }

    $specialRequest = trim((string)($body["special_request"] ?? ""));
    if (mb_strlen($specialRequest) > 1000) {
        throw new ReservationValidationException("Special request must be 1000 characters or less.");
    }

    list($preOrderSalesType, $preOrderJson) = readPreOrder($pdo, $scope, $body);

    return [
        "guest_name" => $guestName,
        "contact_number" => $contact,
        "guest_count" => (int)$guestCount,
        "reservation_date" => $date,
        "reservation_time" => $time,
        "table_name" => $tableName === "" ? null : $tableName,
        "special_request" => $specialRequest === "" ? null : $specialRequest,
        "pre_order_sales_type" => $preOrderSalesType,
        "pre_order_json" => $preOrderJson,
    ];
}

/** Saves the guest in the customer registry (best effort); null when nothing was registered. */
function registerReservationCustomer(PDO $pdo, array $scope, array $fields, string $userId): ?string
{
    $code = posCustomerRegisterQuietly(
        $pdo,
        $scope["category_code"],
        $scope["unit_code"],
        [
            "guest_name" => $fields["guest_name"],
            "guest_contact" => $fields["contact_number"],
            "guest_request" => (string)($fields["special_request"] ?? ""),
        ],
        "reservation",
        $userId
    );
    return $code === "" ? null : $code;
}

function assertNoRoomConflict(PDO $pdo, array $scope, array $fields, int $excludeId): void
{
    if ($fields["table_name"] === null) {
        return;
    }

    $stmt = $pdo->prepare("
        SELECT ID, guest_name, TIME_FORMAT(reservation_time, '%h:%i %p') AS time_label
        FROM tbl_pos_reservations
        WHERE category_code = :category_code
          AND unit_code = :unit_code
          AND table_name = :table_name
          AND reservation_date = :reservation_date
          AND status IN ('Booked', 'Arrived')
          AND ID <> :exclude_id
          AND ABS(TIME_TO_SEC(TIMEDIFF(reservation_time, :reservation_time))) < :conflict_seconds
        ORDER BY reservation_time ASC
        LIMIT 1
    ");
    $stmt->execute([
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
        ":table_name" => $fields["table_name"],
        ":reservation_date" => $fields["reservation_date"],
        ":exclude_id" => $excludeId,
        ":reservation_time" => $fields["reservation_time"],
        ":conflict_seconds" => RESERVATION_CONFLICT_MINUTES * 60,
    ]);
    $conflict = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($conflict) {
        throw new ReservationValidationException(sprintf(
            "%s is already reserved for %s at %s. Pick another room or time.",
            $fields["table_name"],
            $conflict["guest_name"],
            $conflict["time_label"]
        ));
    }
}

function findReservation(PDO $pdo, array $scope, int $id): ?array
{
    $stmt = $pdo->prepare("
        SELECT *
        FROM tbl_pos_reservations
        WHERE ID = :id
          AND category_code = :category_code
          AND unit_code = :unit_code
        LIMIT 1
    ");
    $stmt->execute([
        ":id" => $id,
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
    ]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function readRoomsByFloor(PDO $pdo, array $scope): array
{
    $stmt = $pdo->prepare("
        SELECT table_name
        FROM tbl_pos_tables
        WHERE category_code = :category_code
          AND unit_code = :unit_code
        ORDER BY table_name ASC
    ");
    $stmt->execute([
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
    ]);
    $allRooms = array_values(array_unique(array_map(
        function ($row) {
            return (string)$row["table_name"];
        },
        $stmt->fetchAll(PDO::FETCH_ASSOC)
    )));

    $floors = [];
    $assigned = [];
    try {
        $floorStmt = $pdo->prepare("
            SELECT room_name, tables_json
            FROM tbl_pos_table_rooms
            WHERE category_code = :category_code
              AND unit_code = :unit_code
              AND is_active = 1
            ORDER BY sort_order ASC, ID ASC
        ");
        $floorStmt->execute([
            ":category_code" => $scope["category_code"],
            ":unit_code" => $scope["unit_code"],
        ]);
        foreach ($floorStmt->fetchAll(PDO::FETCH_ASSOC) as $floor) {
            $names = json_decode((string)($floor["tables_json"] ?? "[]"), true);
            $rooms = [];
            foreach (is_array($names) ? $names : [] as $name) {
                $name = (string)$name;
                if (in_array($name, $allRooms, true) && !isset($assigned[$name])) {
                    $rooms[] = $name;
                    $assigned[$name] = true;
                }
            }
            if ($rooms) {
                $floors[] = ["floor" => (string)$floor["room_name"], "rooms" => $rooms];
            }
        }
    } catch (PDOException $e) {
        // No floor layout table yet: fall back to one flat list below.
    }

    $others = array_values(array_filter($allRooms, function ($name) use ($assigned) {
        return !isset($assigned[$name]);
    }));
    if ($others) {
        $floors[] = ["floor" => $floors ? "Other" : "Rooms", "rooms" => $others];
    }

    return $floors;
}

function readReservations(PDO $pdo, array $scope, array $query): array
{
    $where = ["category_code = :category_code", "unit_code = :unit_code"];
    $params = [
        ":category_code" => $scope["category_code"],
        ":unit_code" => $scope["unit_code"],
    ];

    $date = parseReservationDate($query["date"] ?? "");
    $from = parseReservationDate($query["from"] ?? "");
    $to = parseReservationDate($query["to"] ?? "");
    $statuses = parseStatusList($query["status"] ?? "");

    if ($date !== null) {
        $where[] = "reservation_date = :reservation_date";
        $params[":reservation_date"] = $date;
    } elseif ($from !== null || $to !== null) {
        if ($from !== null) {
            $where[] = "reservation_date >= :date_from";
            $params[":date_from"] = $from;
        }
        if ($to !== null) {
            $where[] = "reservation_date <= :date_to";
            $params[":date_to"] = $to;
        }
    } else {
        // Default view: upcoming reservations that are still booked.
        $where[] = "reservation_date >= :today";
        $params[":today"] = reservationNow()->format("Y-m-d");
        if (!$statuses) {
            $statuses = ["Booked"];
        }
    }

    if ($statuses) {
        $placeholders = [];
        foreach ($statuses as $index => $status) {
            $placeholder = ":status_" . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $status;
        }
        $where[] = "status IN (" . implode(", ", $placeholders) . ")";
    }

    $stmt = $pdo->prepare("
        SELECT
            ID AS id,
            guest_name,
            contact_number,
            guest_count,
            DATE_FORMAT(reservation_date, '%Y-%m-%d') AS reservation_date,
            TIME_FORMAT(reservation_time, '%H:%i') AS reservation_time,
            table_name,
            special_request,
            pre_order_sales_type,
            pre_order_json,
            customer_code,
            status,
            created_by,
            date_recorded
        FROM tbl_pos_reservations
        WHERE " . implode(" AND ", $where) . "
        ORDER BY reservation_date ASC, reservation_time ASC, ID ASC
        LIMIT 500
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$row) {
        $row["id"] = (int)$row["id"];
        $row["guest_count"] = (int)$row["guest_count"];
        $items = json_decode((string)($row["pre_order_json"] ?? ""), true);
        $row["pre_order_items"] = is_array($items) ? $items : [];
        unset($row["pre_order_json"]);
    }
    unset($row);

    return $rows;
}

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";
$userId = (string)($GLOBALS["pos_user_id"] ?? "");

if ($method === "GET") {
    // Ordering screens read today's reservations to mark reserved rooms.
    posRoleAuthRequireAnyPermission($pdo, $userId, [
        ["routes", "reservations"],
        ["routes", "newTransaction"],
    ]);
} elseif ($method === "POST") {
    posRoleAuthRequirePermission($pdo, $userId, "routes", "reservations");
} else {
    respondReservations(false, "Method not allowed.", null, 405);
}

try {
    ensureReservationsTable($pdo);
    $scope = resolveReservationScope($pdo);

    if ($method === "GET") {
        $data = [
            "today" => reservationNow()->format("Y-m-d"),
            "reservations" => readReservations($pdo, $scope, $_GET),
        ];
        if (!empty($_GET["include_rooms"])) {
            $data["rooms"] = readRoomsByFloor($pdo, $scope);
        }
        if (!empty($_GET["include_menu"])) {
            $data["scope"] = $scope;
            $data["sales_types"] = array_map(function ($row) {
                return ["sales_type_id" => $row["sales_type_id"], "sales_type" => $row["sales_type"]];
            }, readReservationSalesTypes($pdo, $scope));
        }
        respondReservations(true, "Reservations loaded.", $data);
    }

    $body = json_decode((string)file_get_contents("php://input"), true);
    if (!is_array($body)) {
        throw new ReservationValidationException("Invalid request body.");
    }
    $action = (string)($body["action"] ?? "create");

    if ($action === "create") {
        $fields = readReservationFields($pdo, $scope, $body);
        assertNoRoomConflict($pdo, $scope, $fields, 0);
        $customerCode = registerReservationCustomer($pdo, $scope, $fields, (string)$userId);

        $stmt = $pdo->prepare("
            INSERT INTO tbl_pos_reservations (
                category_code, unit_code, guest_name, contact_number, guest_count,
                reservation_date, reservation_time, table_name, special_request,
                pre_order_sales_type, pre_order_json, customer_code,
                status, created_by, updated_by
            ) VALUES (
                :category_code, :unit_code, :guest_name, :contact_number, :guest_count,
                :reservation_date, :reservation_time, :table_name, :special_request,
                :pre_order_sales_type, :pre_order_json, :customer_code,
                'Booked', :created_by, :updated_by
            )
        ");
        $stmt->execute([
            ":category_code" => $scope["category_code"],
            ":unit_code" => $scope["unit_code"],
            ":guest_name" => $fields["guest_name"],
            ":contact_number" => $fields["contact_number"],
            ":guest_count" => $fields["guest_count"],
            ":reservation_date" => $fields["reservation_date"],
            ":reservation_time" => $fields["reservation_time"],
            ":table_name" => $fields["table_name"],
            ":special_request" => $fields["special_request"],
            ":pre_order_sales_type" => $fields["pre_order_sales_type"],
            ":pre_order_json" => $fields["pre_order_json"],
            ":customer_code" => $customerCode,
            ":created_by" => $userId,
            ":updated_by" => $userId,
        ]);

        respondReservations(true, "Reservation saved.", ["id" => (int)$pdo->lastInsertId()], 201);
    }

    $id = filter_var($body["id"] ?? null, FILTER_VALIDATE_INT);
    if ($id === false || $id < 1) {
        throw new ReservationValidationException("Reservation ID is required.");
    }
    $existing = findReservation($pdo, $scope, (int)$id);
    if ($existing === null) {
        respondReservations(false, "Reservation not found.", null, 404);
    }

    if ($action === "update") {
        if (!in_array($existing["status"], RESERVATION_ACTIVE_STATUSES, true)) {
            throw new ReservationValidationException("Only booked or arrived reservations can be edited.");
        }
        $fields = readReservationFields($pdo, $scope, $body, $existing);
        assertNoRoomConflict($pdo, $scope, $fields, (int)$id);
        $customerCode = registerReservationCustomer($pdo, $scope, $fields, (string)$userId);

        $stmt = $pdo->prepare("
            UPDATE tbl_pos_reservations
            SET guest_name = :guest_name,
                contact_number = :contact_number,
                guest_count = :guest_count,
                reservation_date = :reservation_date,
                reservation_time = :reservation_time,
                table_name = :table_name,
                special_request = :special_request,
                pre_order_sales_type = :pre_order_sales_type,
                pre_order_json = :pre_order_json,
                customer_code = :customer_code,
                updated_by = :updated_by
            WHERE ID = :id
        ");
        $stmt->execute([
            ":guest_name" => $fields["guest_name"],
            ":contact_number" => $fields["contact_number"],
            ":guest_count" => $fields["guest_count"],
            ":reservation_date" => $fields["reservation_date"],
            ":reservation_time" => $fields["reservation_time"],
            ":table_name" => $fields["table_name"],
            ":special_request" => $fields["special_request"],
            ":pre_order_sales_type" => $fields["pre_order_sales_type"],
            ":pre_order_json" => $fields["pre_order_json"],
            ":customer_code" => $customerCode,
            ":updated_by" => $userId,
            ":id" => (int)$id,
        ]);

        respondReservations(true, "Reservation updated.", ["id" => (int)$id]);
    }

    if ($action === "status") {
        $status = trim((string)($body["status"] ?? ""));
        if (!in_array($status, RESERVATION_STATUSES, true)) {
            throw new ReservationValidationException("Invalid reservation status.");
        }
        if ($status === "Booked" || $status === "Arrived") {
            // Re-opening a reservation must not double-book its room.
            $fields = [
                "table_name" => $existing["table_name"] === null || $existing["table_name"] === ""
                    ? null : (string)$existing["table_name"],
                "reservation_date" => (string)$existing["reservation_date"],
                "reservation_time" => (string)$existing["reservation_time"],
            ];
            assertNoRoomConflict($pdo, $scope, $fields, (int)$id);
        }

        $stmt = $pdo->prepare("
            UPDATE tbl_pos_reservations
            SET status = :status,
                updated_by = :updated_by
            WHERE ID = :id
        ");
        $stmt->execute([
            ":status" => $status,
            ":updated_by" => $userId,
            ":id" => (int)$id,
        ]);

        respondReservations(true, "Reservation marked as {$status}.", ["id" => (int)$id, "status" => $status]);
    }

    throw new ReservationValidationException("Unknown action.");
} catch (ReservationValidationException $e) {
    respondReservations(false, $e->getMessage(), null, 422);
} catch (Throwable $e) {
    error_log("pos_reservations.php: " . $e->getMessage());
    respondReservations(false, "Could not process the reservation request.", null, 500);
}
