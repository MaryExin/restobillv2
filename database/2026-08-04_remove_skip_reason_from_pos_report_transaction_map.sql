-- Removes the text skip reason from the report transaction map.
-- The report_status flag is enough to identify posted vs not-posted rows.

USE reports_database;

ALTER TABLE reports_database.tbl_pos_report_transaction_map
    DROP COLUMN IF EXISTS skip_reason;
