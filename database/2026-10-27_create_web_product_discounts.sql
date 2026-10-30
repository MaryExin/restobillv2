-- Run on the online database server for lightemsupport.com.
-- Columns, types, defaults, nullability and indexes match SHOW CREATE TABLE
-- from grumpyjoe_pos and grumpyjoe_pos_report, checked on 2026-10-27.
-- Use the requested utf8mb4_general_ci collation for these online tables.
-- Existing tables and data are preserved; no backend changes are required.

CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_per_product` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `transaction_id` VARCHAR(50) NOT NULL,
  `transaction_date` DATE NOT NULL,
  `category_code` VARCHAR(50) DEFAULT NULL,
  `unit_code` VARCHAR(50) DEFAULT NULL,
  `product_id` INT NOT NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `customer_id` INT DEFAULT NULL,
  `discount_type` VARCHAR(50) NOT NULL,
  `discount_sharing` ENUM('SHARED','SOLO') DEFAULT 'SHARED',
  `total_customers` INT DEFAULT 1,
  `qualified_customers` INT DEFAULT 1,
  `vat_exempt_amount` DECIMAL(10,2) DEFAULT 0.00,
  `discount_amount` DECIMAL(10,2) DEFAULT 0.00,
  `status` VARCHAR(20) DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_transaction` (`transaction_id`),
  KEY `idx_date` (`transaction_date`),
  KEY `idx_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_per_product_bd`
LIKE `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_per_product`;

SELECT TABLE_NAME, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
  AND TABLE_NAME IN (
    'tbl_pos_transactions_discounts_per_product',
    'tbl_pos_transactions_discounts_per_product_bd'
  )
ORDER BY TABLE_NAME;
