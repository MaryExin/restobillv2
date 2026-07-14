-- Per-transaction loyalty ledger entry: points redeemed (discount) and/or
-- points earned on the same sale. Kept separate from
-- tbl_pos_transactions_discounts (Senior/PWD/NAAC/Solo Parent/Manual) per
-- request -- loyalty redemptions are not a statutory discount and should
-- not compete with that table's per-customer rows.

CREATE TABLE IF NOT EXISTS `tbl_pos_loyalty_discounts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `transaction_id` VARCHAR(50) NOT NULL,
  `Category_Code` VARCHAR(255) NULL,
  `Unit_Code` VARCHAR(255) NULL,
  `Project_Code` VARCHAR(255) NULL,
  `transaction_date` VARCHAR(50) NULL,
  `loyalty_member_id` INT NOT NULL,
  `customer_name` VARCHAR(150) NULL,
  `phone_number` VARCHAR(20) NULL,
  `points_redeemed` INT NOT NULL DEFAULT 0,
  `points_earned` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `usertracker` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_loyalty_discounts_txn` (`transaction_id`, `Category_Code`, `Unit_Code`),
  KEY `idx_loyalty_discounts_member` (`loyalty_member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
