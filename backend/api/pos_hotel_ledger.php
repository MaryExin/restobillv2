<?php
declare(strict_types=1);

/**
 * Hotel front desk ledger (no PMS): in-house guests (stays / folios),
 * Charge to Room, City Ledger (charge to company), Complimentary, and
 * collections (folio settlement at check-out, company payments).
 *
 * Accounting rule: the sale is recorded once, at the outlet, when the bill is
 * paid with "Charge to Room", "City Ledger" or "Complimentary" (special modes
 * of payment, tbl_mode_of_payment.mop_kind). Those payments create a
 * receivable here. Settling it later is a COLLECTION, not a new sale, so the
 * X / Z readings and BIR reports keep counting sales exactly as before.
 *
 * Tables are created on first use (see database/2026-11-15_pos_hotel_front_desk.sql).
 * PHP 7.4 compatible.
 */

const POS_HOTEL_KIND_ROOM_CHARGE = "ROOM_CHARGE";
const POS_HOTEL_KIND_CITY_LEDGER = "CITY_LEDGER";
const POS_HOTEL_KIND_COMPLIMENTARY = "COMPLIMENTARY";

const POS_HOTEL_SPECIAL_MOPS = [
    POS_HOTEL_KIND_ROOM_CHARGE => "Charge to Room",
    POS_HOTEL_KIND_CITY_LEDGER => "City Ledger",
    POS_HOTEL_KIND_COMPLIMENTARY => "Complimentary",
];

const POS_HOTEL_COMP_TYPES = ["Guest Comp", "Officer's Check", "Staff Meal", "Management"];

// System product used for room-night invoices (night audit). Inactive so it
// never shows on the ordering screen; reports read its name like any product.
const POS_HOTEL_ROOM_PRODUCT_ID = "HOTEL-ROOM-NIGHT";
const POS_HOTEL_ROOM_PRODUCT_NAME = "ROOM CHARGE";
const POS_HOTEL_ROOM_ORDER_TYPE = "ROOM";

const POS_HOTEL_ADMIN_ROLES = [
    "1", "2", "ADMIN", "MANAGER", "SUPERVISOR", "ADMIN / SUPERVISOR",
    "SUPER ADMIN", "SUPER_ADMIN", "SUPERADMIN",
];

class PosHotelLedgerException extends RuntimeException
{
}

function posHotelMoney($value): float
{
    return round((float)$value, 2);
}

function posHotelTableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare("
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t
        LIMIT 1
    ");
    $stmt->execute([":t" => $table]);
    return $stmt->fetchColumn() !== false;
}

/** Adds tbl_mode_of_payment.mop_kind once. Must run outside a DB transaction. */
function posHotelEnsureMopKindColumn(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $columns = [];
    foreach ($pdo->query("SHOW COLUMNS FROM tbl_mode_of_payment")->fetchAll(PDO::FETCH_ASSOC) as $column) {
        $columns[strtolower((string)$column["Field"])] = true;
    }
    if (!isset($columns["mop_kind"])) {
        $pdo->exec("ALTER TABLE tbl_mode_of_payment ADD COLUMN mop_kind VARCHAR(30) NULL AFTER MOP_On_Off");
    }
    $done = true;
}

/** Creates the front desk tables once. Must run outside a DB transaction (DDL commits). */
function posHotelEnsureSchema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    posHotelEnsureMopKindColumn($pdo);

    $tables = [
        "tbl_pos_hotel_counters" => "
            CREATE TABLE IF NOT EXISTS tbl_pos_hotel_counters (
                Category_Code VARCHAR(100) NOT NULL,
                Unit_Code VARCHAR(100) NOT NULL,
                counter_key VARCHAR(30) NOT NULL,
                next_value INT NOT NULL DEFAULT 1,
                PRIMARY KEY (Category_Code, Unit_Code, counter_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
        "tbl_pos_hotel_stays" => "
            CREATE TABLE IF NOT EXISTS tbl_pos_hotel_stays (
                ID INT NOT NULL AUTO_INCREMENT,
                folio_no VARCHAR(20) NOT NULL,
                Category_Code VARCHAR(100) NOT NULL,
                Unit_Code VARCHAR(100) NOT NULL,
                room_name VARCHAR(100) NOT NULL,
                guest_name VARCHAR(150) NOT NULL,
                guest_contact VARCHAR(30) NULL,
                guest_count INT NOT NULL DEFAULT 1,
                check_in_at DATETIME NOT NULL,
                expected_check_out DATE NULL,
                room_rate DECIMAL(12,2) NULL,
                check_out_at DATETIME NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'In-House',
                notes VARCHAR(500) NULL,
                created_by VARCHAR(150) NOT NULL DEFAULT '',
                checked_out_by VARCHAR(150) NULL,
                date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ID),
                UNIQUE KEY uq_pos_hotel_stays_folio (Category_Code, Unit_Code, folio_no),
                KEY idx_pos_hotel_stays_status (Category_Code, Unit_Code, status),
                KEY idx_pos_hotel_stays_room (room_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
        "tbl_pos_city_ledger_accounts" => "
            CREATE TABLE IF NOT EXISTS tbl_pos_city_ledger_accounts (
                ID INT NOT NULL AUTO_INCREMENT,
                account_code VARCHAR(20) NOT NULL,
                Category_Code VARCHAR(100) NOT NULL,
                Unit_Code VARCHAR(100) NOT NULL,
                company_name VARCHAR(150) NOT NULL,
                contact_person VARCHAR(150) NULL,
                contact_number VARCHAR(30) NULL,
                email VARCHAR(150) NULL,
                address VARCHAR(300) NULL,
                tin VARCHAR(30) NULL,
                credit_limit DECIMAL(12,2) NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Active',
                created_by VARCHAR(150) NOT NULL DEFAULT '',
                date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (ID),
                UNIQUE KEY uq_pos_city_ledger_code (Category_Code, Unit_Code, account_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
        "tbl_pos_ar_charges" => "
            CREATE TABLE IF NOT EXISTS tbl_pos_ar_charges (
                ID INT NOT NULL AUTO_INCREMENT,
                ledger_type VARCHAR(20) NOT NULL,
                stay_id INT NULL,
                account_id INT NULL,
                Category_Code VARCHAR(100) NOT NULL,
                Unit_Code VARCHAR(100) NOT NULL,
                source VARCHAR(20) NOT NULL DEFAULT 'SALE',
                transaction_id VARCHAR(100) NULL,
                invoice_no BIGINT NULL,
                collection_no VARCHAR(20) NULL,
                service_date DATE NULL,
                description VARCHAR(300) NOT NULL DEFAULT '',
                amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'Active',
                reversed_reason VARCHAR(300) NULL,
                reversed_at DATETIME NULL,
                posted_by VARCHAR(150) NOT NULL DEFAULT '',
                charged_at DATETIME NOT NULL,
                PRIMARY KEY (ID),
                KEY idx_pos_ar_charges_stay (stay_id),
                KEY idx_pos_ar_charges_account (account_id),
                KEY idx_pos_ar_charges_txn (transaction_id, Category_Code, Unit_Code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
        "tbl_pos_ar_collections" => "
            CREATE TABLE IF NOT EXISTS tbl_pos_ar_collections (
                ID INT NOT NULL AUTO_INCREMENT,
                collection_no VARCHAR(20) NOT NULL,
                ledger_type VARCHAR(20) NOT NULL,
                stay_id INT NULL,
                account_id INT NULL,
                Category_Code VARCHAR(100) NOT NULL,
                Unit_Code VARCHAR(100) NOT NULL,
                payment_method VARCHAR(60) NOT NULL,
                payment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                payment_reference VARCHAR(100) NULL,
                terminal_number VARCHAR(20) NULL,
                cashier VARCHAR(150) NOT NULL DEFAULT '',
                remarks VARCHAR(300) NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'Active',
                void_reason VARCHAR(300) NULL,
                voided_by VARCHAR(150) NULL,
                voided_at DATETIME NULL,
                collected_at DATETIME NOT NULL,
                PRIMARY KEY (ID),
                KEY idx_pos_ar_collections_no (Category_Code, Unit_Code, collection_no),
                KEY idx_pos_ar_collections_stay (stay_id),
                KEY idx_pos_ar_collections_account (account_id),
                KEY idx_pos_ar_collections_date (collected_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
        "tbl_pos_complimentary" => "
            CREATE TABLE IF NOT EXISTS tbl_pos_complimentary (
                ID INT NOT NULL AUTO_INCREMENT,
                Category_Code VARCHAR(100) NOT NULL,
                Unit_Code VARCHAR(100) NOT NULL,
                transaction_id VARCHAR(100) NOT NULL,
                invoice_no BIGINT NULL,
                comp_type VARCHAR(40) NOT NULL,
                reason VARCHAR(300) NOT NULL,
                amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                guest_name VARCHAR(150) NULL,
                approved_by VARCHAR(100) NOT NULL,
                approved_by_name VARCHAR(150) NOT NULL DEFAULT '',
                cashier VARCHAR(150) NOT NULL DEFAULT '',
                status VARCHAR(20) NOT NULL DEFAULT 'Active',
                date_recorded DATETIME NOT NULL,
                PRIMARY KEY (ID),
                KEY idx_pos_complimentary_date (Category_Code, Unit_Code, date_recorded),
                KEY idx_pos_complimentary_txn (transaction_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
    ];
    foreach ($tables as $name => $sql) {
        if (!posHotelTableExists($pdo, $name)) {
            $pdo->exec($sql);
        }
    }

    // Columns added after the first release of these tables.
    $added = [
        "tbl_pos_hotel_stays" => ["room_rate" => "DECIMAL(12,2) NULL AFTER expected_check_out"],
        "tbl_pos_ar_charges" => ["service_date" => "DATE NULL AFTER collection_no"],
        "tbl_pos_ar_collections" => [
            "void_reason" => "VARCHAR(300) NULL AFTER status",
            "voided_by" => "VARCHAR(150) NULL AFTER void_reason",
            "voided_at" => "DATETIME NULL AFTER voided_by",
        ],
    ];
    foreach ($added as $table => $columns) {
        $existing = [];
        foreach ($pdo->query("SHOW COLUMNS FROM {$table}")->fetchAll(PDO::FETCH_ASSOC) as $column) {
            $existing[strtolower((string)$column["Field"])] = true;
        }
        foreach ($columns as $name => $definition) {
            if (!isset($existing[$name])) {
                $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$name} {$definition}");
            }
        }
    }
    $done = true;
}

/**
 * Makes sure the inactive ROOM CHARGE product exists (category / unit codes
 * copied from an existing product, like pricing_engine.php "add").
 */
function posHotelEnsureRoomProduct(PDO $pdo): void
{
    $check = $pdo->prepare("SELECT 1 FROM tbl_inventory_products_masterlist WHERE product_id = :pid LIMIT 1");
    $check->execute([":pid" => POS_HOTEL_ROOM_PRODUCT_ID]);
    if ($check->fetchColumn() !== false) {
        return;
    }
    $meta = $pdo->query("
        SELECT category_code, unit_code, inventory_type, item_brand
        FROM tbl_inventory_products_masterlist
        ORDER BY seq DESC LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC) ?: [];
    $pdo->prepare("
        INSERT INTO tbl_inventory_products_masterlist
            (product_id, category_code, unit_code, inventory_type, item_category, item_name, item_description,
             unit_of_measure, item_color, item_brand, item_variant, item_size, unit_cost, selling_price, vatable,
             bar_code, sku, isDiscountable, status, beginning_inventory, actual_count, remaining_count, variance,
             safety_stock, reordering_point)
        VALUES
            (:pid, :cc, :uc, :it, 'ROOM', :name, 'Room night (front desk)', 'NIGHT', '', :br, '', '', 0, 0, 'Yes',
             '', :sku, 'No', 'Inactive', 0, 0, 0, '0', 0, 0)
    ")->execute([
        ":pid" => POS_HOTEL_ROOM_PRODUCT_ID,
        ":cc" => $meta["category_code"] ?? "GEN",
        ":uc" => $meta["unit_code"] ?? "1001",
        ":it" => $meta["inventory_type"] ?? "ALL",
        ":name" => POS_HOTEL_ROOM_PRODUCT_NAME,
        ":br" => $meta["item_brand"] ?? "BR-DEFAULT",
        ":sku" => POS_HOTEL_ROOM_PRODUCT_ID,
    ]);
}

/** Dates from check-in through $throughDate (Y-m-d), inclusive. */
function posHotelNightDates(string $checkInAt, string $throughDate): array
{
    $dates = [];
    $day = new DateTime(substr($checkInAt, 0, 10));
    $end = new DateTime($throughDate);
    while ($day <= $end && count($dates) < 366) {
        $dates[] = $day->format("Y-m-d");
        $day->modify("+1 day");
    }
    return $dates;
}

/** Room nights of a stay (rate > 0) through $throughDate that have no active room charge yet. */
function posHotelUnpostedNights(PDO $pdo, array $stay, string $throughDate): array
{
    if ((float)($stay["room_rate"] ?? 0) <= 0) {
        return [];
    }
    $posted = $pdo->prepare("
        SELECT service_date FROM tbl_pos_ar_charges
        WHERE ledger_type = 'FOLIO' AND stay_id = :id AND source = 'ROOM' AND status = 'Active'
    ");
    $posted->execute([":id" => (int)$stay["ID"]]);
    $done = [];
    foreach ($posted->fetchAll(PDO::FETCH_COLUMN) as $date) {
        $done[(string)$date] = true;
    }
    return array_values(array_filter(
        posHotelNightDates((string)$stay["check_in_at"], $throughDate),
        function ($date) use ($done) {
            return !isset($done[$date]);
        }
    ));
}

/**
 * Cash received on folio / company collections at a terminal in a time window
 * (X / Z reading cash count). 0 when the front desk tables do not exist.
 * $cashierRegex: same REGEXP the X reading applies to transactions.cashier.
 */
function posHotelCashCollections(
    PDO $pdo,
    string $categoryCode,
    string $unitCode,
    string $terminalNumber,
    string $fromDateTime,
    string $toDateTime,
    string $cashierRegex = ".*"
): float {
    try {
        if (!posHotelTableExists($pdo, "tbl_pos_ar_collections")) {
            return 0.0;
        }
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(payment_amount), 0)
            FROM tbl_pos_ar_collections
            WHERE Category_Code = :cc
              AND Unit_Code = :uc
              AND COALESCE(terminal_number, '') = :terminal
              AND status = 'Active'
              AND UPPER(REPLACE(REPLACE(TRIM(payment_method), ' ', ''), '-', '')) = 'CASH'
              AND collected_at >= :from_dt
              AND collected_at <= :to_dt
              AND cashier REGEXP :cashier_regex
        ");
        $stmt->execute([
            ":cc" => $categoryCode,
            ":uc" => $unitCode,
            ":terminal" => $terminalNumber,
            ":from_dt" => $fromDateTime,
            ":to_dt" => $toDateTime,
            ":cashier_regex" => $cashierRegex !== "" ? $cashierRegex : ".*",
        ]);
        return posHotelMoney((float)$stmt->fetchColumn());
    } catch (Throwable $e) {
        error_log("POS hotel cash collections read failed: " . $e->getMessage());
        return 0.0;
    }
}

/**
 * Makes sure the three special modes of payment exist (turned ON).
 * An existing mode with the same name is tagged instead of duplicated.
 */
function posHotelEnsureSpecialMops(PDO $pdo): void
{
    posHotelEnsureMopKindColumn($pdo);
    foreach (POS_HOTEL_SPECIAL_MOPS as $kind => $name) {
        $byKind = $pdo->prepare("SELECT seq FROM tbl_mode_of_payment WHERE mop_kind = :kind LIMIT 1");
        $byKind->execute([":kind" => $kind]);
        if ($byKind->fetchColumn() !== false) {
            continue;
        }
        $byName = $pdo->prepare("SELECT seq FROM tbl_mode_of_payment WHERE LOWER(TRIM(mop)) = LOWER(:mop) LIMIT 1");
        $byName->execute([":mop" => $name]);
        $seq = $byName->fetchColumn();
        if ($seq !== false) {
            $pdo->prepare("UPDATE tbl_mode_of_payment SET mop_kind = :kind WHERE seq = :seq")
                ->execute([":kind" => $kind, ":seq" => $seq]);
            continue;
        }
        $pdo->prepare("
            INSERT INTO tbl_mode_of_payment (mop_id, mop, sl_code, reference_On_Off, MOP_On_Off, mop_kind)
            VALUES (:id, :mop, '', 0, 1, :kind)
        ")->execute([":id" => "MP-" . bin2hex(random_bytes(6)), ":mop" => $name, ":kind" => $kind]);
    }
}

/** lower(mop name) => kind, for the special modes only. */
function posHotelMopKinds(PDO $pdo): array
{
    posHotelEnsureMopKindColumn($pdo);
    $kinds = [];
    $rows = $pdo->query("
        SELECT mop, mop_kind FROM tbl_mode_of_payment
        WHERE mop_kind IS NOT NULL AND mop_kind <> ''
    ")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        $kinds[strtolower(trim((string)$row["mop"]))] = strtoupper(trim((string)$row["mop_kind"]));
    }
    return $kinds;
}

/**
 * Special modes for the payment posting path: SELECT only (no schema change).
 * Returns [] when the mop_kind column does not exist yet (no hotel modes set
 * up) and null when the modes could not be read.
 */
function posHotelPaymentKinds(PDO $pdo): ?array
{
    try {
        $rows = $pdo->query("
            SELECT mop, mop_kind FROM tbl_mode_of_payment
            WHERE mop_kind IS NOT NULL AND mop_kind <> ''
        ")->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        // 42S22: unknown column -> the front desk was never opened.
        return $e->getCode() === "42S22" ? [] : null;
    } catch (Throwable $e) {
        return null;
    }
    $kinds = [];
    foreach ($rows as $row) {
        $kinds[strtolower(trim((string)$row["mop"]))] = strtoupper(trim((string)$row["mop_kind"]));
    }
    return $kinds;
}

function posHotelResolveScope(PDO $pdo): array
{
    $row = $pdo->query("
        SELECT Category_Code, Unit_Code
        FROM tbl_main_business_units
        WHERE Status = 'Active'
          AND TRIM(COALESCE(Unit_Code, '')) <> ''
        ORDER BY ID ASC
        LIMIT 1
    ")->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new PosHotelLedgerException("No active POS business unit was found.");
    }
    return [
        "category_code" => trim((string)$row["Category_Code"]),
        "unit_code" => trim((string)$row["Unit_Code"]),
    ];
}

function posHotelUserName(PDO $pdo, string $userId): string
{
    if ($userId === "") {
        return "";
    }
    $stmt = $pdo->prepare("
        SELECT TRIM(CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))) AS full_name, email
        FROM tbl_users_global_assignment
        WHERE uuid = :uuid
        LIMIT 1
    ");
    $stmt->execute([":uuid" => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return $userId;
    }
    $name = trim((string)$row["full_name"]);
    return $name !== "" ? $name : (string)$row["email"];
}

/** Next number of a scoped counter (call inside a transaction). */
function posHotelNextNumber(PDO $pdo, array $scope, string $key): int
{
    $pdo->prepare("
        INSERT IGNORE INTO tbl_pos_hotel_counters (Category_Code, Unit_Code, counter_key, next_value)
        VALUES (:cc, :uc, :k, 1)
    ")->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":k" => $key]);

    $stmt = $pdo->prepare("
        SELECT next_value FROM tbl_pos_hotel_counters
        WHERE Category_Code = :cc AND Unit_Code = :uc AND counter_key = :k
        FOR UPDATE
    ");
    $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":k" => $key]);
    $next = (int)$stmt->fetchColumn();

    $pdo->prepare("
        UPDATE tbl_pos_hotel_counters SET next_value = next_value + 1
        WHERE Category_Code = :cc AND Unit_Code = :uc AND counter_key = :k
    ")->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":k" => $key]);

    return max(1, $next);
}

function posHotelFormatNumber(string $prefix, int $number): string
{
    return $prefix . "-" . str_pad((string)$number, 6, "0", STR_PAD_LEFT);
}

/** Checks an Admin / Supervisor / Super Admin password. Returns [uuid, name]. */
function posHotelVerifyApprover(PDO $pdo, string $approverId, string $password): array
{
    if ($approverId === "" || $password === "") {
        throw new PosHotelLedgerException("Select the approving admin and enter the password.");
    }
    $stmt = $pdo->prepare("
        SELECT uuid, password, classification
        FROM tbl_users_global_assignment
        WHERE (uuid = :id OR email = :id2)
          AND UPPER(TRIM(status)) = 'ACTIVE'
          AND UPPER(TRIM(deletestatus)) = 'ACTIVE'
        LIMIT 1
    ");
    $stmt->execute([":id" => $approverId, ":id2" => $approverId]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$admin) {
        throw new PosHotelLedgerException("Approving admin account not found.");
    }
    $role = strtoupper(trim((string)($admin["classification"] ?? "")));
    if (!in_array($role, POS_HOTEL_ADMIN_ROLES, true)) {
        throw new PosHotelLedgerException("This needs the approval of an Admin or Super Admin.");
    }
    $stored = (string)($admin["password"] ?? "");
    if (!(password_verify($password, $stored) || hash_equals($stored, $password))) {
        throw new PosHotelLedgerException("Invalid approver password.");
    }
    $uuid = (string)$admin["uuid"];
    return [$uuid, posHotelUserName($pdo, $uuid)];
}

function posHotelAdminApprovers(PDO $pdo): array
{
    $placeholders = implode(",", array_fill(0, count(POS_HOTEL_ADMIN_ROLES), "?"));
    $stmt = $pdo->prepare("
        SELECT uuid, TRIM(CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))) AS full_name, email
        FROM tbl_users_global_assignment
        WHERE UPPER(TRIM(classification)) IN ($placeholders)
          AND UPPER(TRIM(status)) = 'ACTIVE'
          AND UPPER(TRIM(deletestatus)) = 'ACTIVE'
        ORDER BY firstname ASC, lastname ASC
    ");
    $stmt->execute(POS_HOTEL_ADMIN_ROLES);
    return array_map(function ($row) {
        $name = trim((string)$row["full_name"]);
        return ["id" => (string)$row["uuid"], "name" => $name !== "" ? $name : (string)$row["email"]];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}

function posHotelFindStayByFolio(PDO $pdo, array $scope, string $folioNo, bool $lock = false): ?array
{
    $stmt = $pdo->prepare("
        SELECT * FROM tbl_pos_hotel_stays
        WHERE Category_Code = :cc AND Unit_Code = :uc AND folio_no = :folio
        LIMIT 1" . ($lock ? " FOR UPDATE" : ""));
    $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":folio" => $folioNo]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

function posHotelFindAccountByCode(PDO $pdo, array $scope, string $code, bool $lock = false): ?array
{
    $stmt = $pdo->prepare("
        SELECT * FROM tbl_pos_city_ledger_accounts
        WHERE Category_Code = :cc AND Unit_Code = :uc AND account_code = :code
        LIMIT 1" . ($lock ? " FOR UPDATE" : ""));
    $stmt->execute([":cc" => $scope["category_code"], ":uc" => $scope["unit_code"], ":code" => $code]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

/** Active charges minus active collections. */
function posHotelBalance(PDO $pdo, string $ledgerType, int $id): float
{
    $column = $ledgerType === "FOLIO" ? "stay_id" : "account_id";
    $charges = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0) FROM tbl_pos_ar_charges
        WHERE ledger_type = :lt AND {$column} = :id AND status = 'Active'
    ");
    $charges->execute([":lt" => $ledgerType, ":id" => $id]);
    $collections = $pdo->prepare("
        SELECT COALESCE(SUM(payment_amount), 0) FROM tbl_pos_ar_collections
        WHERE ledger_type = :lt AND {$column} = :id AND status = 'Active'
    ");
    $collections->execute([":lt" => $ledgerType, ":id" => $id]);
    return posHotelMoney((float)$charges->fetchColumn() - (float)$collections->fetchColumn());
}

function posHotelInsertCharge(PDO $pdo, array $fields): void
{
    $pdo->prepare("
        INSERT INTO tbl_pos_ar_charges
            (ledger_type, stay_id, account_id, Category_Code, Unit_Code, source, transaction_id,
             invoice_no, collection_no, service_date, description, amount, status, posted_by, charged_at)
        VALUES
            (:ledger_type, :stay_id, :account_id, :cc, :uc, :source, :transaction_id,
             :invoice_no, :collection_no, :service_date, :description, :amount, 'Active', :posted_by, NOW())
    ")->execute([
        ":ledger_type" => $fields["ledger_type"],
        ":stay_id" => $fields["stay_id"] ?? null,
        ":account_id" => $fields["account_id"] ?? null,
        ":cc" => $fields["category_code"],
        ":uc" => $fields["unit_code"],
        ":source" => $fields["source"] ?? "SALE",
        ":transaction_id" => $fields["transaction_id"] ?? null,
        ":invoice_no" => $fields["invoice_no"] ?? null,
        ":collection_no" => $fields["collection_no"] ?? null,
        ":service_date" => $fields["service_date"] ?? null,
        ":description" => mb_substr((string)($fields["description"] ?? ""), 0, 300),
        ":amount" => posHotelMoney($fields["amount"]),
        ":posted_by" => mb_substr((string)($fields["posted_by"] ?? ""), 0, 150),
    ]);
}

/** City ledger credit limit check (0 / NULL = no limit). */
function posHotelAssertCreditLimit(PDO $pdo, array $account, float $amount): void
{
    $limit = $account["credit_limit"] === null ? 0.0 : (float)$account["credit_limit"];
    if ($limit <= 0) {
        return;
    }
    $balance = posHotelBalance($pdo, "CITY_LEDGER", (int)$account["ID"]);
    if ($balance + $amount > $limit + 0.005) {
        throw new PosHotelLedgerException(sprintf(
            "%s is over its credit limit (limit %s, balance %s).",
            $account["company_name"],
            number_format($limit, 2),
            number_format($balance, 2)
        ));
    }
}

/**
 * Called by pos_payment_post_transaction.php inside its DB transaction, after
 * the payment rows are saved. Creates the receivable / complimentary records
 * for special modes of payment. Throws PosHotelLedgerException on bad input.
 *
 * $txn: Category_Code, Unit_Code, transaction_id, invoice_no, total_amount_due,
 *       label (e.g. "Room 101 · DINE IN"), guest_name
 */
function posHotelApplyTransactionPayments(
    PDO $pdo,
    array $kinds,
    array $txn,
    array $payments,
    array $complimentary,
    string $cashier,
    array $roomNight = []
): void {
    $scope = ["category_code" => $txn["Category_Code"], "unit_code" => $txn["Unit_Code"]];
    $due = posHotelMoney($txn["total_amount_due"] ?? 0);
    $invoiceNo = (int)($txn["invoice_no"] ?? 0);
    $label = trim((string)($txn["label"] ?? ""));
    $description = "Invoice #" . $invoiceNo . ($label !== "" ? " · " . $label : "");
    $compTotal = 0.0;
    $specialTotal = 0.0;

    foreach ($payments as $payment) {
        $method = trim((string)($payment["payment_method"] ?? ""));
        $amount = posHotelMoney($payment["payment_amount"] ?? 0);
        $kind = $kinds[strtolower($method)] ?? "";
        if ($kind === "" || $amount <= 0) {
            continue;
        }
        $specialTotal += $amount;
        $reference = trim((string)($payment["payment_reference"] ?? ""));

        if ($kind === POS_HOTEL_KIND_ROOM_CHARGE) {
            if ($reference === "") {
                throw new PosHotelLedgerException("Select the in-house guest for Charge to Room.");
            }
            $stay = posHotelFindStayByFolio($pdo, $scope, $reference, true);
            if (!$stay || $stay["status"] !== "In-House") {
                throw new PosHotelLedgerException("Folio {$reference} is not an in-house guest. Choose a checked-in guest.");
            }
            $serviceDate = null;
            $chargeDescription = $description;
            if ($roomNight) {
                // Night audit: one invoice per room night, never twice for the same night.
                $serviceDate = (string)($roomNight["service_date"] ?? "");
                if (($roomNight["folio_no"] ?? "") !== $reference
                    || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $serviceDate)
                    || $serviceDate < substr((string)$stay["check_in_at"], 0, 10)) {
                    throw new PosHotelLedgerException("Invalid room night for folio {$reference}.");
                }
                $dup = $pdo->prepare("
                    SELECT 1 FROM tbl_pos_ar_charges
                    WHERE ledger_type = 'FOLIO' AND stay_id = :id AND source = 'ROOM'
                      AND service_date = :d AND status = 'Active'
                    LIMIT 1
                ");
                $dup->execute([":id" => (int)$stay["ID"], ":d" => $serviceDate]);
                if ($dup->fetchColumn() !== false) {
                    throw new PosHotelLedgerException("The room night of {$serviceDate} is already posted to folio {$reference}.");
                }
                $chargeDescription = "Room night " . date("M j, Y", strtotime($serviceDate))
                    . " · " . $stay["room_name"] . " · Invoice #" . $invoiceNo;
            }
            posHotelInsertCharge($pdo, [
                "ledger_type" => "FOLIO",
                "stay_id" => (int)$stay["ID"],
                "category_code" => $scope["category_code"],
                "unit_code" => $scope["unit_code"],
                "source" => $roomNight ? "ROOM" : "SALE",
                "transaction_id" => $txn["transaction_id"],
                "invoice_no" => $invoiceNo,
                "service_date" => $serviceDate,
                "description" => $chargeDescription,
                "amount" => $amount,
                "posted_by" => $cashier,
            ]);
        } elseif ($kind === POS_HOTEL_KIND_CITY_LEDGER) {
            if ($reference === "") {
                throw new PosHotelLedgerException("Select the company account for City Ledger.");
            }
            $account = posHotelFindAccountByCode($pdo, $scope, $reference, true);
            if (!$account || $account["status"] !== "Active") {
                throw new PosHotelLedgerException("City ledger account {$reference} is not active.");
            }
            posHotelAssertCreditLimit($pdo, $account, $amount);
            $guest = trim((string)($txn["guest_name"] ?? ""));
            posHotelInsertCharge($pdo, [
                "ledger_type" => "CITY_LEDGER",
                "account_id" => (int)$account["ID"],
                "category_code" => $scope["category_code"],
                "unit_code" => $scope["unit_code"],
                "transaction_id" => $txn["transaction_id"],
                "invoice_no" => $invoiceNo,
                "description" => $description . ($guest !== "" ? " · " . $guest : ""),
                "amount" => $amount,
                "posted_by" => $cashier,
            ]);
        } elseif ($kind === POS_HOTEL_KIND_COMPLIMENTARY) {
            $compTotal += $amount;
        }
    }

    if ($roomNight && $specialTotal < $due - 0.005) {
        throw new PosHotelLedgerException("A room night must be charged to the room in full.");
    }
    if ($specialTotal > $due + 0.005) {
        throw new PosHotelLedgerException("Charge to Room, City Ledger and Complimentary cannot be more than the amount due.");
    }

    if ($compTotal > 0) {
        $compType = trim((string)($complimentary["comp_type"] ?? ""));
        $reason = trim((string)($complimentary["reason"] ?? ""));
        if (!in_array($compType, POS_HOTEL_COMP_TYPES, true)) {
            throw new PosHotelLedgerException("Select the complimentary type.");
        }
        if (mb_strlen($reason) < 3) {
            throw new PosHotelLedgerException("Enter the reason for the complimentary.");
        }
        list($approverId, $approverName) = posHotelVerifyApprover(
            $pdo,
            trim((string)($complimentary["approver_id"] ?? "")),
            (string)($complimentary["approver_password"] ?? "")
        );
        $pdo->prepare("
            INSERT INTO tbl_pos_complimentary
                (Category_Code, Unit_Code, transaction_id, invoice_no, comp_type, reason, amount,
                 guest_name, approved_by, approved_by_name, cashier, status, date_recorded)
            VALUES
                (:cc, :uc, :tid, :inv, :type, :reason, :amount, :guest, :approver, :approver_name,
                 :cashier, 'Active', NOW())
        ")->execute([
            ":cc" => $scope["category_code"],
            ":uc" => $scope["unit_code"],
            ":tid" => $txn["transaction_id"],
            ":inv" => $invoiceNo,
            ":type" => $compType,
            ":reason" => mb_substr($reason, 0, 300),
            ":amount" => posHotelMoney($compTotal),
            ":guest" => mb_substr(trim((string)($txn["guest_name"] ?? "")), 0, 150) ?: null,
            ":approver" => $approverId,
            ":approver_name" => mb_substr($approverName, 0, 150),
            ":cashier" => mb_substr($cashier, 0, 150),
        ]);
    }
}

/**
 * Called by void / refund inside their DB transaction: reverses the room /
 * company charges and the complimentary record of the transaction. A charge
 * on a guest who already checked out cannot be reversed here.
 */
function posHotelReverseTransaction(PDO $pdo, string $categoryCode, string $unitCode, string $transactionId, string $reason): void
{
    if (!posHotelTableExists($pdo, "tbl_pos_ar_charges")) {
        return;
    }
    $stmt = $pdo->prepare("
        SELECT c.ID, c.ledger_type, s.status AS stay_status, s.folio_no
        FROM tbl_pos_ar_charges c
        LEFT JOIN tbl_pos_hotel_stays s ON s.ID = c.stay_id
        WHERE c.transaction_id = :tid AND c.Category_Code = :cc AND c.Unit_Code = :uc
          AND c.status = 'Active'
        FOR UPDATE
    ");
    $stmt->execute([":tid" => $transactionId, ":cc" => $categoryCode, ":uc" => $unitCode]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        if ($row["ledger_type"] === "FOLIO" && $row["stay_status"] !== "In-House") {
            throw new PosHotelLedgerException(
                "This bill was charged to folio {$row['folio_no']}, which is already checked out. It cannot be voided or refunded here."
            );
        }
    }
    if ($rows) {
        $pdo->prepare("
            UPDATE tbl_pos_ar_charges
            SET status = 'Reversed', reversed_reason = :reason, reversed_at = NOW()
            WHERE transaction_id = :tid AND Category_Code = :cc AND Unit_Code = :uc AND status = 'Active'
        ")->execute([":reason" => mb_substr($reason, 0, 300), ":tid" => $transactionId, ":cc" => $categoryCode, ":uc" => $unitCode]);
    }
    if (posHotelTableExists($pdo, "tbl_pos_complimentary")) {
        $pdo->prepare("
            UPDATE tbl_pos_complimentary SET status = 'Reversed'
            WHERE transaction_id = :tid AND Category_Code = :cc AND Unit_Code = :uc AND status = 'Active'
        ")->execute([":tid" => $transactionId, ":cc" => $categoryCode, ":uc" => $unitCode]);
    }
}

/**
 * Saves a collection (one collection number, one row per payment line) on a
 * folio or a city ledger account. Run inside a DB transaction.
 * A "City Ledger" line on a folio moves that amount to the company account.
 * Returns the collection number.
 */
function posHotelRecordCollection(
    PDO $pdo,
    array $scope,
    string $ledgerType,
    array $owner,
    array $payments,
    array $kinds,
    string $cashier,
    string $terminal,
    string $remarks,
    bool $allowNegative = false
): string {
    $lines = [];
    foreach ($payments as $payment) {
        $method = trim((string)($payment["payment_method"] ?? ""));
        $amount = posHotelMoney($payment["payment_amount"] ?? 0);
        if ($method === "" || $amount == 0.0) {
            continue;
        }
        if ($amount < 0 && !$allowNegative) {
            throw new PosHotelLedgerException("Payment amounts must be greater than zero.");
        }
        $kind = $kinds[strtolower($method)] ?? "";
        if ($kind === POS_HOTEL_KIND_ROOM_CHARGE || $kind === POS_HOTEL_KIND_COMPLIMENTARY) {
            throw new PosHotelLedgerException("{$method} cannot be used to settle a balance.");
        }
        if ($kind === POS_HOTEL_KIND_CITY_LEDGER && $amount < 0) {
            throw new PosHotelLedgerException("A credit cannot be refunded through City Ledger.");
        }
        if ($kind === POS_HOTEL_KIND_CITY_LEDGER && $ledgerType !== "FOLIO") {
            throw new PosHotelLedgerException("City Ledger cannot pay a city ledger account.");
        }
        $lines[] = [
            "method" => $method,
            "amount" => $amount,
            "reference" => mb_substr(trim((string)($payment["payment_reference"] ?? "")), 0, 100),
            "kind" => $kind,
        ];
    }
    if (!$lines) {
        throw new PosHotelLedgerException("Add at least one payment.");
    }

    $collectionNo = posHotelFormatNumber("CR", posHotelNextNumber($pdo, $scope, "collection"));
    $insert = $pdo->prepare("
        INSERT INTO tbl_pos_ar_collections
            (collection_no, ledger_type, stay_id, account_id, Category_Code, Unit_Code, payment_method,
             payment_amount, payment_reference, terminal_number, cashier, remarks, status, collected_at)
        VALUES
            (:no, :lt, :stay_id, :account_id, :cc, :uc, :method, :amount, :reference, :terminal,
             :cashier, :remarks, 'Active', NOW())
    ");
    foreach ($lines as $line) {
        if ($line["kind"] === POS_HOTEL_KIND_CITY_LEDGER) {
            if ($line["reference"] === "") {
                throw new PosHotelLedgerException("Select the company account for City Ledger.");
            }
            $account = posHotelFindAccountByCode($pdo, $scope, $line["reference"], true);
            if (!$account || $account["status"] !== "Active") {
                throw new PosHotelLedgerException("City ledger account {$line['reference']} is not active.");
            }
            posHotelAssertCreditLimit($pdo, $account, $line["amount"]);
            posHotelInsertCharge($pdo, [
                "ledger_type" => "CITY_LEDGER",
                "account_id" => (int)$account["ID"],
                "category_code" => $scope["category_code"],
                "unit_code" => $scope["unit_code"],
                "source" => "FOLIO_TRANSFER",
                "collection_no" => $collectionNo,
                "description" => "Folio {$owner['folio_no']} · {$owner['room_name']} · {$owner['guest_name']}",
                "amount" => $line["amount"],
                "posted_by" => $cashier,
            ]);
        }
        $insert->execute([
            ":no" => $collectionNo,
            ":lt" => $ledgerType,
            ":stay_id" => $ledgerType === "FOLIO" ? (int)$owner["ID"] : null,
            ":account_id" => $ledgerType === "CITY_LEDGER" ? (int)$owner["ID"] : null,
            ":cc" => $scope["category_code"],
            ":uc" => $scope["unit_code"],
            ":method" => $line["method"],
            ":amount" => $line["amount"],
            ":reference" => $line["reference"] !== "" ? $line["reference"] : null,
            ":terminal" => $terminal !== "" ? mb_substr($terminal, 0, 20) : null,
            ":cashier" => mb_substr($cashier, 0, 150),
            ":remarks" => $remarks !== "" ? mb_substr($remarks, 0, 300) : null,
        ]);
    }
    return $collectionNo;
}
