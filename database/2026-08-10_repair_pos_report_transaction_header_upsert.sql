-- Repairs report transaction headers created more than once because the
-- scoped unique key required by INSERT ... ON DUPLICATE KEY UPDATE was absent.
-- The newest row is retained for each report transaction scope because it is
-- the finalized row written by the latest payment/update mirror operation.
--
-- Back up tbl_pos_transactions before running this migration.
-- REQUIRED: replace __REPORT_DATABASE__ with the exact `report_db` value from
-- backend/api/config.php. Leaving the placeholder unchanged intentionally
-- fails instead of modifying the wrong database.

USE `__REPORT_DATABASE__`;

START TRANSACTION;

DELETE older
FROM `__REPORT_DATABASE__`.`tbl_pos_transactions` AS older
INNER JOIN `__REPORT_DATABASE__`.`tbl_pos_transactions` AS newer
    ON newer.`transaction_id` = older.`transaction_id`
   AND newer.`Category_Code` = older.`Category_Code`
   AND newer.`Unit_Code` = older.`Unit_Code`
   AND newer.`ID` > older.`ID`;

COMMIT;

CREATE UNIQUE INDEX IF NOT EXISTS `ux_pos_transactions_report_txn_scope`
    ON `__REPORT_DATABASE__`.`tbl_pos_transactions`
        (`transaction_id`, `Category_Code`, `Unit_Code`);
