-- Run on the ONLINE MySQL server used by lightemsupport.com.
-- Do not run this in localhost phpMyAdmin.
-- Payload fields verified against SHOW CREATE TABLE in grumpyjoe_pos and
-- grumpyjoe_pos_report. Use an integer auto-generated ID for online MySQL;
-- the local MariaDB DOUBLE AUTO_INCREMENT definition is not portable.
-- Existing tables/data are preserved; this creates missing tables only.

CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_customers` (
  `ID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `transaction_id` double NOT NULL,
  `Category_Code` varchar(255) NOT NULL,
  `Unit_Code` varchar(255) NOT NULL,
  `Project_Code` varchar(100) NOT NULL,
  `transaction_date` date NOT NULL DEFAULT '1990-01-01',
  `customer_id` int(11) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_customers_bd`
LIKE `dbaxouyescmsgj`.`tbl_pos_transactions_customers`;

SELECT TABLE_NAME, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
  AND TABLE_NAME IN ('tbl_pos_transactions_customers', 'tbl_pos_transactions_customers_bd');
