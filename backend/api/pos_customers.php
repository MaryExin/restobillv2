<?php
declare(strict_types=1);

/**
 * Customer registry (tbl_pos_customers).
 *
 * Every guest the POS meets is saved once: the optional guest details asked
 * when an order is started (walk-ins), reservations, and discount customer
 * cards. Orders link to the customer through
 * tbl_pos_transactions.guest_customer_code so Reports > Customers can list
 * each customer with their visits, transactions and amount spent.
 *
 * Matching: same contact number (digits only), else the same name when one
 * of the two has no contact number. Blank fields on a repeat visit never
 * erase what is already saved; a newer special request replaces the note.
 *
 * posEnsureCustomersTable() creates the table on first use so databases that
 * have not run database/2026-11-11_pos_customers.sql keep working. Endpoints
 * that write inside a transaction call posCustomersPrepareSchema() before
 * beginTransaction() (DDL commits) and the *Quietly variants: the registry
 * is a reporting aid and must never block a sale or a reservation.
 * PHP 7.4 compatible; accepts a PDO or mysqli connection.
 */

require_once __DIR__ . "/pos_guest_columns.php";

const POS_CUSTOMERS_TABLE = "tbl_pos_customers";
const POS_CUSTOMER_SOURCES = ["walk-in", "reservation", "discount"];
// Keep in step with database/2026-11-11_pos_customers.sql.
const POS_CUSTOMERS_CREATE_SQL = "
    CREATE TABLE IF NOT EXISTS tbl_pos_customers (
        ID INT NOT NULL AUTO_INCREMENT,
        customer_code VARCHAR(20) NOT NULL,
        Category_Code VARCHAR(255) NOT NULL DEFAULT '',
        Unit_Code VARCHAR(255) NOT NULL DEFAULT '',
        full_name VARCHAR(150) NOT NULL DEFAULT '',
        contact_number VARCHAR(30) NOT NULL DEFAULT '',
        contact_digits VARCHAR(30) NOT NULL DEFAULT '',
        email VARCHAR(150) NOT NULL DEFAULT '',
        address VARCHAR(255) NOT NULL DEFAULT '',
        notes VARCHAR(500) NOT NULL DEFAULT '',
        source VARCHAR(20) NOT NULL DEFAULT 'walk-in',
        first_visit DATETIME NULL,
        last_visit DATETIME NULL,
        visit_count INT NOT NULL DEFAULT 0,
        last_transaction_id BIGINT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Active',
        created_by VARCHAR(100) NOT NULL DEFAULT '',
        date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (ID),
        UNIQUE KEY uniq_pos_customers_code (customer_code),
        KEY idx_pos_customers_contact (Category_Code, Unit_Code, contact_digits),
        KEY idx_pos_customers_name (Category_Code, Unit_Code, full_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
";

/**
 * Runs one statement with positional (?) parameters on a PDO or mysqli
 * connection and returns the rows of a SELECT (an empty array otherwise).
 */
function posCustomersRun($db, string $sql, array $params = []): array
{
    $values = array_values($params);

    if ($db instanceof PDO) {
        $stmt = $db->prepare($sql);
        $stmt->execute($values);
        return $stmt->columnCount() > 0 ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    }

    if ($db instanceof mysqli) {
        $stmt = $db->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException("Customer registry prepare failed: " . $db->error);
        }
        if ($values) {
            $stmt->bind_param(str_repeat("s", count($values)), ...$values);
        }
        if (!$stmt->execute()) {
            $error = $stmt->error;
            $stmt->close();
            throw new RuntimeException("Customer registry query failed: " . $error);
        }
        $rows = [];
        $result = $stmt->get_result();
        if ($result instanceof mysqli_result) {
            $rows = $result->fetch_all(MYSQLI_ASSOC);
            $result->free();
        }
        $stmt->close();
        return $rows;
    }

    throw new InvalidArgumentException("Customer registry needs a PDO or mysqli connection.");
}

/** Creates tbl_pos_customers when it is missing (checked once per connection). */
function posEnsureCustomersTable($db): void
{
    static $checked = [];
    $key = spl_object_id($db);
    if (isset($checked[$key])) {
        return;
    }

    // Look before creating: CREATE TABLE is DDL and would commit an open
    // transaction even when the table already exists.
    $exists = false;
    if ($db instanceof PDO) {
        $exists = $db->query("SHOW TABLES LIKE '" . POS_CUSTOMERS_TABLE . "'")->fetchColumn() !== false;
    } elseif ($db instanceof mysqli) {
        $result = $db->query("SHOW TABLES LIKE '" . POS_CUSTOMERS_TABLE . "'");
        $exists = $result instanceof mysqli_result && $result->num_rows > 0;
        if ($result instanceof mysqli_result) {
            $result->free();
        }
    } else {
        return;
    }

    if (!$exists) {
        if ($db instanceof PDO) {
            $db->exec(POS_CUSTOMERS_CREATE_SQL);
        } else {
            $db->query(POS_CUSTOMERS_CREATE_SQL);
        }
    }
    $checked[$key] = true;
}

/**
 * Schema checks for endpoints that write inside a transaction: call before
 * beginTransaction(). Never throws; a failed check only means the registry
 * is skipped for this request.
 */
function posCustomersPrepareSchema($db): void
{
    try {
        posEnsureGuestColumns($db);
        posEnsureCustomersTable($db);
    } catch (Throwable $e) {
        error_log("pos_customers schema check skipped: " . $e->getMessage());
    }
}

/**
 * Digits of a contact number used for matching ("0917-123 4567" and
 * "+63 917 123 4567" both become 09171234567). "" when it is too short to be
 * a number.
 */
function posCustomerContactDigits($contact): string
{
    $digits = preg_replace('/\D+/', '', (string)$contact);
    if (strlen($digits) === 12 && strncmp($digits, "63", 2) === 0) {
        $digits = "0" . substr($digits, 2);
    }
    return strlen($digits) >= 5 ? $digits : "";
}

function posCustomerVisitedAt($value): string
{
    $text = trim((string)$value);
    $parsed = $text !== "" ? DateTime::createFromFormat("Y-m-d H:i:s", $text) : false;
    return $parsed instanceof DateTime ? $parsed->format("Y-m-d H:i:s") : date("Y-m-d H:i:s");
}

/** The customer with this contact, else the same name when one side has no contact. */
function posCustomerFind($db, string $categoryCode, string $unitCode, string $name, string $digits): ?array
{
    $columns = "ID, customer_code, full_name, contact_number, contact_digits, notes, last_transaction_id";

    if ($digits !== "") {
        $rows = posCustomersRun(
            $db,
            "SELECT {$columns} FROM " . POS_CUSTOMERS_TABLE . "
             WHERE Category_Code = ? AND Unit_Code = ? AND contact_digits = ?
             ORDER BY ID DESC LIMIT 1",
            [$categoryCode, $unitCode, $digits]
        );
        if ($rows) {
            return $rows[0];
        }
    }

    if ($name !== "") {
        // Two guests who share a name but have different numbers stay apart.
        $rows = posCustomersRun(
            $db,
            "SELECT {$columns} FROM " . POS_CUSTOMERS_TABLE . "
             WHERE Category_Code = ? AND Unit_Code = ? AND full_name = ?
               AND (contact_digits = '' OR ? = '')
             ORDER BY ID DESC LIMIT 1",
            [$categoryCode, $unitCode, $name, $digits]
        );
        if ($rows) {
            return $rows[0];
        }
    }

    return null;
}

/**
 * Registers (or re-uses) the customer described by $guest and returns the
 * customer_code, or "" when there is nothing to register (no name and no
 * contact number).
 *
 * $guest     guest_name / guest_contact / guest_request (as posReadGuestFields()
 *            returns them; a reservation passes contact_number as guest_contact).
 * $source    walk-in | reservation | discount (kept from the first registration).
 * $visit     ["transaction_id" => ..., "visited_at" => "Y-m-d H:i:s"] when the
 *            call records an order, which counts one visit per transaction;
 *            null for reservations and discount cards.
 */
function posCustomerRegister(
    $db,
    string $categoryCode,
    string $unitCode,
    array $guest,
    string $source = "walk-in",
    string $recordedBy = "",
    ?array $visit = null
): string {
    $name = posCleanGuestText($guest["guest_name"] ?? "", 150);
    $contact = posCleanGuestText($guest["guest_contact"] ?? "", 30);
    $digits = posCustomerContactDigits($contact);
    $notes = posCleanGuestText($guest["guest_request"] ?? "", 500);
    if ($name === "" && $digits === "") {
        return "";
    }

    if (!in_array($source, POS_CUSTOMER_SOURCES, true)) {
        $source = "walk-in";
    }
    $categoryCode = trim($categoryCode);
    $unitCode = trim($unitCode);
    $recordedBy = posCleanGuestText($recordedBy, 100);
    $visitTransactionId = $visit !== null ? trim((string)($visit["transaction_id"] ?? "")) : "";
    $visitedAt = $visit !== null ? posCustomerVisitedAt($visit["visited_at"] ?? "") : null;

    posEnsureCustomersTable($db);

    $existing = posCustomerFind($db, $categoryCode, $unitCode, $name, $digits);
    if ($existing !== null) {
        // The same order saved twice (update_order) is still one visit.
        $addVisit = $visit !== null
            && ($visitTransactionId === "" || (string)($existing["last_transaction_id"] ?? "") !== $visitTransactionId);
        $existingName = (string)$existing["full_name"];
        $existingContact = (string)$existing["contact_number"];
        $existingDigits = (string)$existing["contact_digits"];

        posCustomersRun(
            $db,
            "UPDATE " . POS_CUSTOMERS_TABLE . "
             SET full_name = ?,
                 contact_number = ?,
                 contact_digits = ?,
                 notes = ?,
                 visit_count = visit_count + ?,
                 first_visit = COALESCE(first_visit, ?),
                 last_visit = COALESCE(?, last_visit),
                 last_transaction_id = COALESCE(?, last_transaction_id),
                 status = 'Active'
             WHERE ID = ?",
            [
                $existingName !== "" ? $existingName : $name,
                $existingDigits !== "" ? $existingContact : ($contact !== "" ? $contact : $existingContact),
                $existingDigits !== "" ? $existingDigits : $digits,
                $notes !== "" ? $notes : (string)$existing["notes"],
                $addVisit ? "1" : "0",
                $addVisit ? $visitedAt : null,
                $addVisit ? $visitedAt : null,
                $addVisit && $visitTransactionId !== "" ? $visitTransactionId : null,
                (string)$existing["ID"],
            ]
        );

        return (string)$existing["customer_code"];
    }

    $customerCode = "CU-" . bin2hex(random_bytes(6));
    posCustomersRun(
        $db,
        "INSERT INTO " . POS_CUSTOMERS_TABLE . " (
            customer_code, Category_Code, Unit_Code, full_name, contact_number, contact_digits,
            notes, source, first_visit, last_visit, visit_count, last_transaction_id, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            $customerCode,
            $categoryCode,
            $unitCode,
            $name,
            $contact,
            $digits,
            $notes,
            $source,
            $visitedAt,
            $visitedAt,
            $visit !== null ? "1" : "0",
            $visitTransactionId !== "" ? $visitTransactionId : null,
            $recordedBy,
        ]
    );

    return $customerCode;
}

/** posCustomerRegister() that never throws: the registry must not block a sale. */
function posCustomerRegisterQuietly(
    $db,
    string $categoryCode,
    string $unitCode,
    array $guest,
    string $source = "walk-in",
    string $recordedBy = "",
    ?array $visit = null
): string {
    try {
        return posCustomerRegister($db, $categoryCode, $unitCode, $guest, $source, $recordedBy, $visit);
    } catch (Throwable $e) {
        error_log("pos_customers: customer not registered: " . $e->getMessage());
        return "";
    }
}

/**
 * Links an order to a customer when no customer is on it yet (discount
 * cards). Never throws.
 */
function posCustomerLinkTransaction($db, string $transactionId, string $customerCode): void
{
    $transactionId = trim($transactionId);
    $customerCode = trim($customerCode);
    if ($transactionId === "" || $customerCode === "") {
        return;
    }

    try {
        posEnsureGuestColumns($db);
        posCustomersRun(
            $db,
            "UPDATE tbl_pos_transactions
             SET guest_customer_code = ?
             WHERE transaction_id = ?
               AND (guest_customer_code IS NULL OR guest_customer_code = '')",
            [$customerCode, $transactionId]
        );
    } catch (Throwable $e) {
        error_log("pos_customers: order not linked to customer: " . $e->getMessage());
    }
}
