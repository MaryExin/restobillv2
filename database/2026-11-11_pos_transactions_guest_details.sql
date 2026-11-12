-- Optional guest details on orders (asked when an order is started, or copied
-- from the reservation): printed on the kitchen ticket, bill/folio and receipt.
-- MariaDB (XAMPP) syntax. The API (pos_guest_columns.php) also adds these
-- columns to the POS database automatically on first use; this file keeps the
-- report mirror database in step as well.

ALTER TABLE db_cnc_pos.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150) NULL AFTER customer_count_for_discount,
    ADD COLUMN IF NOT EXISTS guest_contact VARCHAR(30) NULL AFTER guest_name,
    ADD COLUMN IF NOT EXISTS guest_request VARCHAR(500) NULL AFTER guest_contact;

ALTER TABLE reports_database.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150) NULL AFTER customer_count_for_discount,
    ADD COLUMN IF NOT EXISTS guest_contact VARCHAR(30) NULL AFTER guest_name,
    ADD COLUMN IF NOT EXISTS guest_request VARCHAR(500) NULL AFTER guest_contact;
