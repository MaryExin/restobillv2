-- Stores the stable CNC-to-report transaction mapping.
-- This script intentionally performs no historical backfill. On a fresh
-- deployment the table starts empty; if it already exists, its rows remain
-- untouched. New map rows are created only by backend/api/save_order.php after
-- the immutable report-mirror activation boundary is available.
-- This is the schema setup to use for new-transactions-only deployments; do
-- not run the legacy token backfill or historical trigger migration afterward.
-- REQUIRED: replace __REPORT_DATABASE__ below with the exact `report_db` value
-- from backend/api/config.php. Leaving the placeholder unchanged makes the
-- script fail instead of silently creating the map in the wrong database.

USE `__REPORT_DATABASE__`;

CREATE TABLE IF NOT EXISTS `__REPORT_DATABASE__`.`tbl_pos_report_transaction_map` (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token_report VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    source_pos_id DOUBLE NOT NULL,
    source_rank INT NOT NULL DEFAULT 0,
    activation_key VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
    activation_sequence BIGINT UNSIGNED NULL DEFAULT NULL,
    source_transaction_id DOUBLE NOT NULL,
    source_order_slip_no DOUBLE NOT NULL DEFAULT 0,
    source_invoice_no DOUBLE NOT NULL DEFAULT 0,
    report_transaction_id DOUBLE NULL DEFAULT NULL,
    report_order_slip_no DOUBLE NULL DEFAULT NULL,
    report_invoice_no DOUBLE NULL DEFAULT NULL,
    Category_Code VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    Unit_Code VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    report_status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=posted, 1=not posted',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_pos_report_map_token (token_report),
    UNIQUE KEY ux_pos_report_map_source_pos (source_pos_id),
    UNIQUE KEY ux_pos_report_map_source_txn (source_transaction_id, Category_Code, Unit_Code),
    UNIQUE KEY ux_pos_report_map_report_txn (report_transaction_id, Category_Code, Unit_Code),
    UNIQUE KEY ux_pos_report_map_activation_sequence (activation_key, activation_sequence),
    KEY idx_pos_report_map_status (report_status),
    KEY idx_pos_report_map_source_rank (source_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE UNIQUE INDEX IF NOT EXISTS `ux_pos_transactions_report_txn_scope`
    ON `__REPORT_DATABASE__`.`tbl_pos_transactions`
        (`transaction_id`, `Category_Code`, `Unit_Code`);
