-- Safe cutover for PHP-managed, new-transactions-only report mirroring.
-- This script drops only obsolete always-mirror triggers. It does not read,
-- insert, renumber, delete, or backfill any POS or report transaction data.
--
-- REQUIRED: replace __POS_DATABASE__ below with the exact `db` value from
-- backend/api/config.php. Leaving the placeholder unchanged makes this script
-- fail instead of silently operating on the wrong database.

USE `__POS_DATABASE__`;

DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_ai`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_au`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_ad`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_detail_ai`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_detail_au`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_detail_ad`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_payment_ai`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_payment_au`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_payment_ad`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_discount_ai`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_discount_au`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_discount_ad`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_charge_ai`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_charge_au`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_charge_ad`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_customer_ai`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_customer_au`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_customer_ad`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_prod_disc_ai`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_prod_disc_au`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_txn_prod_disc_ad`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_loyalty_ai`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_loyalty_au`;
DROP TRIGGER IF EXISTS `__POS_DATABASE__`.`trg_report_mirror_pos_loyalty_ad`;
