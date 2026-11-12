<?php
declare(strict_types=1);

/**
 * Optional guest details saved with an order (tbl_pos_transactions):
 * guest_name, guest_contact, guest_request, plus guest_customer_code (the
 * customer registry link, see pos_customers.php). Asked when an order is started
 * (walk-ins) or copied from the reservation; printed on the kitchen ticket,
 * bill/folio and receipt.
 *
 * posEnsureGuestColumns() adds the columns on first use so databases that
 * have not run database/2026-11-11_pos_transactions_guest_details.sql keep
 * working. PHP 7.4 compatible; accepts a PDO or mysqli connection.
 */

const POS_GUEST_COLUMNS = [
    "guest_name" => "VARCHAR(150) NULL",
    "guest_contact" => "VARCHAR(30) NULL",
    "guest_request" => "VARCHAR(500) NULL",
    // Intended payment taken with a room-service order; pre-filled at payment.
    "guest_payment_mode" => "VARCHAR(60) NULL",
    "guest_payment_reference" => "VARCHAR(100) NULL",
    "guest_payment_amount" => "VARCHAR(20) NULL",
    // Link to the customer registry (tbl_pos_customers.customer_code).
    "guest_customer_code" => "VARCHAR(20) NULL",
];

function posEnsureGuestColumns($db): void
{
    static $checked = [];
    $key = spl_object_id($db);
    if (isset($checked[$key])) {
        return;
    }

    $existing = [];
    if ($db instanceof PDO) {
        foreach ($db->query("SHOW COLUMNS FROM tbl_pos_transactions")->fetchAll(PDO::FETCH_ASSOC) as $column) {
            $existing[strtolower((string)$column["Field"])] = true;
        }
    } elseif ($db instanceof mysqli) {
        $result = $db->query("SHOW COLUMNS FROM tbl_pos_transactions");
        while ($result && ($column = $result->fetch_assoc())) {
            $existing[strtolower((string)$column["Field"])] = true;
        }
    } else {
        return;
    }

    $additions = [];
    foreach (POS_GUEST_COLUMNS as $name => $definition) {
        if (!isset($existing[$name])) {
            $additions[] = "ADD COLUMN `{$name}` {$definition}";
        }
    }
    if ($additions) {
        $sql = "ALTER TABLE tbl_pos_transactions " . implode(", ", $additions);
        if ($db instanceof PDO) {
            $db->exec($sql);
        } else {
            $db->query($sql);
        }
    }
    $checked[$key] = true;
}

function posCleanGuestText($value, int $maxLength): string
{
    $text = preg_replace('/\s+/u', ' ', trim((string)$value));
    return mb_substr($text, 0, $maxLength);
}

/** Normalized guest fields from a request body or an existing row. */
function posReadGuestFields(array $source): array
{
    return [
        "guest_name" => posCleanGuestText($source["guest_name"] ?? "", 150),
        "guest_contact" => posCleanGuestText($source["guest_contact"] ?? "", 30),
        "guest_request" => posCleanGuestText($source["guest_request"] ?? "", 500),
        "guest_payment_mode" => posCleanGuestText($source["guest_payment_mode"] ?? "", 60),
        "guest_payment_reference" => posCleanGuestText($source["guest_payment_reference"] ?? "", 100),
        "guest_payment_amount" => posCleanGuestText($source["guest_payment_amount"] ?? "", 20),
    ];
}

/**
 * Guest fields for an update: a field the client sent replaces the stored
 * one; fields it did not send keep their current value (clients send only
 * the fields they know about).
 */
function posMergeGuestFields(array $existing, array $posted): array
{
    $merged = [];
    foreach (array_keys(posReadGuestFields([])) as $key) {
        $merged[$key] = array_key_exists($key, $posted) ? $posted[$key] : ($existing[$key] ?? "");
    }
    return posReadGuestFields($merged);
}
