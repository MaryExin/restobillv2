-- =====================================================================
-- Room service payment details (2026-11-12)
-- The mode of payment (and the reference number for online, card or gift
-- certificate payments) taken with a room-service order is kept on the
-- order and pre-filled on the payment screen. MariaDB (XAMPP) syntax; the
-- API (pos_guest_columns.php) also adds the columns on first use. Safe to
-- re-run.
-- =====================================================================

ALTER TABLE db_cnc_pos.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS guest_payment_mode VARCHAR(60) NULL AFTER guest_request,
    ADD COLUMN IF NOT EXISTS guest_payment_reference VARCHAR(100) NULL AFTER guest_payment_mode;

ALTER TABLE reports_database.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS guest_payment_mode VARCHAR(60) NULL AFTER guest_request,
    ADD COLUMN IF NOT EXISTS guest_payment_reference VARCHAR(100) NULL AFTER guest_payment_mode;

-- Online, card and gift-certificate payments need a reference number
-- (Settings > Mode of Payment > Reference); cash does not.
UPDATE db_cnc_pos.tbl_mode_of_payment
SET reference_On_Off = 1
WHERE UPPER(TRIM(mop)) <> 'CASH';

-- Cash received at the front desk for a room-service order (optional), so
-- the payment screen can show the change.
ALTER TABLE db_cnc_pos.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS guest_payment_amount VARCHAR(20) NULL AFTER guest_payment_reference;

ALTER TABLE reports_database.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS guest_payment_amount VARCHAR(20) NULL AFTER guest_payment_reference;
