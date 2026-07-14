-- Loyalty member lookup table.
-- NOTE: you mentioned `lkp_loyalty_cs_name` already exists in your live DB.
-- This statement is `CREATE TABLE IF NOT EXISTS`, so it is a no-op if the
-- table is already there. The columns below are what backend/api/pos_loyalty_members.php
-- expects by name (customer_name, phone_number, loyalty_points, date_registered) —
-- if your existing table uses different column names, rename them here to match
-- (there's no other schema on file to reconcile against).

CREATE TABLE IF NOT EXISTS `lkp_loyalty_cs_name` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customer_name` VARCHAR(150) NOT NULL,
  `phone_number` VARCHAR(20) NOT NULL,
  `loyalty_points` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `date_registered` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_loyalty_phone` (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
