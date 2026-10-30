-- Run on the ONLINE/WEB MySQL server for lightemsupport.com.
-- Every table reference is scoped to the affected dbaxouyescmsgj database.
-- Do not run this against the local POS or its local reports_database.
--
-- The WEB base tables must already exist and match the deployed WEB API.
-- Clone their real definitions rather than local CSV samples: WEB child tables
-- also have fields such as terminal_number that are not in the local CSVs.
-- CREATE LIKE copies structure/indexes/defaults, not sales rows or triggers.
-- Existing _bd tables and their data are preserved. Only new empty tables
-- receive utf8mb4_general_ci and InnoDB DYNAMIC row format. DYNAMIC avoids
-- COMPACT index/row-size warnings when converting latin1 source definitions.
-- This is not a repair for older _bd schemas.
--
-- Run the whole file with stop-on-error enabled (mysql batch default).
-- Verify all source tables exist before any DDL; LIMIT 0 reads no sales data.
SELECT 1 AS web_sales_sources_ready
FROM `dbaxouyescmsgj`.`tbl_pos_shifting_records`,
     `dbaxouyescmsgj`.`tbl_pos_transactions`,
     `dbaxouyescmsgj`.`tbl_pos_transactions_detailed`,
     `dbaxouyescmsgj`.`tbl_pos_transactions_discounts`,
     `dbaxouyescmsgj`.`tbl_pos_transactions_payments`,
     `dbaxouyescmsgj`.`tbl_pos_transactions_other_charges`,
     `dbaxouyescmsgj`.`tbl_pos_transactions_customers`,
     `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_per_product`,
     `dbaxouyescmsgj`.`tbl_pos_loyalty_discounts`
LIMIT 0;

-- tbl_pos_shifting_records_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_shifting_records_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_shifting_records_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_shifting_records`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_shifting_records_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- tbl_pos_transactions_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_transactions_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_transactions`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_transactions_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- tbl_pos_transactions_detailed_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_transactions_detailed_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_detailed_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_transactions_detailed`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_transactions_detailed_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- tbl_pos_transactions_discounts_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_transactions_discounts_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_transactions_discounts`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- tbl_pos_transactions_payments_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_transactions_payments_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_payments_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_transactions_payments`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_transactions_payments_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- tbl_pos_transactions_other_charges_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_transactions_other_charges_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_other_charges_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_transactions_other_charges`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_transactions_other_charges_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- tbl_pos_transactions_customers_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_transactions_customers_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_customers_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_transactions_customers`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_transactions_customers_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- tbl_pos_transactions_discounts_per_product_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_transactions_discounts_per_product_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_per_product_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_per_product`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_transactions_discounts_per_product_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- tbl_pos_loyalty_discounts_bd
SET @web_sales_report_table_is_new := NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
      AND TABLE_NAME = 'tbl_pos_loyalty_discounts_bd'
);
CREATE TABLE IF NOT EXISTS `dbaxouyescmsgj`.`tbl_pos_loyalty_discounts_bd` LIKE `dbaxouyescmsgj`.`tbl_pos_loyalty_discounts`;
SET @web_sales_report_ddl := IF(
    @web_sales_report_table_is_new,
    'ALTER TABLE `dbaxouyescmsgj`.`tbl_pos_loyalty_discounts_bd` ROW_FORMAT=DYNAMIC, CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci',
    'SELECT 1 AS existing_report_table_preserved'
);
PREPARE web_sales_report_statement FROM @web_sales_report_ddl;
EXECUTE web_sales_report_statement;
DEALLOCATE PREPARE web_sales_report_statement;

-- Nine rows should be listed. Existing tables may retain a different collation.
SELECT TABLE_NAME, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'dbaxouyescmsgj'
  AND TABLE_NAME IN (
    'tbl_pos_shifting_records_bd',
    'tbl_pos_transactions_bd',
    'tbl_pos_transactions_detailed_bd',
    'tbl_pos_transactions_discounts_bd',
    'tbl_pos_transactions_payments_bd',
    'tbl_pos_transactions_other_charges_bd',
    'tbl_pos_transactions_customers_bd',
    'tbl_pos_transactions_discounts_per_product_bd',
    'tbl_pos_loyalty_discounts_bd'
  )
ORDER BY TABLE_NAME;

SET @web_sales_report_table_is_new := NULL;
SET @web_sales_report_ddl := NULL;

