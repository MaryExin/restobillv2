-- Run on the online database server for lightemsupport.com.
-- Matches the existing loyalty migration and SHOW CREATE TABLE from
-- grumpyjoe_pos and grumpyjoe_pos_report, checked on 2026-10-27.
-- Existing tables and data are preserved; no backend changes are required.

CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_loyalty_discounts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `transaction_id` VARCHAR(50) NOT NULL,
  `Category_Code` VARCHAR(255) DEFAULT NULL,
  `Unit_Code` VARCHAR(255) DEFAULT NULL,
  `Project_Code` VARCHAR(255) DEFAULT NULL,
  `transaction_date` VARCHAR(50) DEFAULT NULL,
  `loyalty_member_id` INT NOT NULL,
  `customer_name` VARCHAR(150) DEFAULT NULL,
  `phone_number` VARCHAR(20) DEFAULT NULL,
  `points_redeemed` INT NOT NULL DEFAULT 0,
  `points_earned` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `usertracker` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_loyalty_discounts_txn` (`transaction_id`, `Category_Code`, `Unit_Code`),
  KEY `idx_loyalty_discounts_member` (`loyalty_member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_loyalty_discounts_bd`
LIKE `dbaxouyescmsgj`.`tbl_pos_loyalty_discounts`;

SELECT TABLE_NAME, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
  AND TABLE_NAME IN (
    'tbl_pos_loyalty_discounts',
    'tbl_pos_loyalty_discounts_bd'
  )
ORDER BY TABLE_NAME;
