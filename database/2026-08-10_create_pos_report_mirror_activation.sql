-- Stores the immutable point where transaction skipping first became active.
-- Rows before this boundary remain authoritative in the primary POS database;
-- rows from the activation business date onward are read from the report DB.
-- This table contains state only and performs no historical data copy.
-- Run 2026-08-03_create_pos_report_transaction_map.sql first. This migration
-- then upgrades that report-only map with activation membership columns.
--
-- REQUIRED: replace __REPORT_DATABASE__ with the exact `report_db` value from
-- backend/api/config.php. Leaving the placeholder unchanged intentionally
-- fails instead of creating the table in the wrong database.

USE `__REPORT_DATABASE__`;

CREATE TABLE IF NOT EXISTS `__REPORT_DATABASE__`.`tbl_pos_report_mirror_activation` (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    activation_key VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    source_database VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    report_database VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    activation_business_date DATE NOT NULL,
    activated_at DATETIME NOT NULL,
    activation_source_pos_id DECIMAL(20, 0) UNSIGNED NOT NULL,
    activation_transaction_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    initial_skip_interval INT UNSIGNED NOT NULL,
    last_sequence BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_pos_report_mirror_activation_key (activation_key),
    UNIQUE KEY ux_pos_report_mirror_activation_source (source_database),
    KEY idx_pos_report_mirror_activation_date (activation_business_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Existing report-map installations must be upgraded before activation can
-- be claimed. The API reports migration_required and leaves the POS sale
-- successful until the nullable membership columns and unique sequence index
-- are present.
ALTER TABLE `__REPORT_DATABASE__`.`tbl_pos_report_transaction_map`
    ADD COLUMN IF NOT EXISTS `activation_key`
        VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL
        AFTER `source_rank`,
    ADD COLUMN IF NOT EXISTS `activation_sequence`
        BIGINT UNSIGNED NULL DEFAULT NULL
        AFTER `activation_key`;

CREATE UNIQUE INDEX IF NOT EXISTS `ux_pos_report_map_activation_sequence`
    ON `__REPORT_DATABASE__`.`tbl_pos_report_transaction_map`
        (`activation_key`, `activation_sequence`);
