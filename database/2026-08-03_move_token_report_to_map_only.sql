-- Moves token_report out of the POS transaction tables.
-- LEGACY HISTORICAL MIGRATION: new-transactions-only deployments do not add
-- token_report columns and therefore do not need to run this script.

USE reports_database;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_transactions_report_txn_scope
    ON reports_database.tbl_pos_transactions (transaction_id, Category_Code, Unit_Code);

DROP INDEX IF EXISTS ux_pos_transactions_token_report
    ON reports_database.tbl_pos_transactions;

ALTER TABLE reports_database.tbl_pos_transactions
    DROP COLUMN IF EXISTS token_report;

DROP INDEX IF EXISTS ux_pos_transactions_token_report
    ON db_cnc_pos.tbl_pos_transactions;

DROP INDEX IF EXISTS idx_pos_transactions_token_report
    ON db_cnc_pos.tbl_pos_transactions;

ALTER TABLE db_cnc_pos.tbl_pos_transactions
    DROP COLUMN IF EXISTS token_report;
