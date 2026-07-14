-- Per-sales-type configuration for each discount type: whether it's active
-- (selectable in /printbilling and /payments) for a given sales type, and
-- the percent to apply there. A missing row for a (discount_type_id,
-- sales_type_id) pair means "not yet configured" -> treated as inactive
-- until an admin explicitly turns it on in Settings > Discount Mode.
-- percent_value NULL means "use lkp_discount_type.default_value".

CREATE TABLE IF NOT EXISTS `tbl_pos_discount_type_sales_type` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `discount_type_id` INT NOT NULL,
  `sales_type_id` VARCHAR(50) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  `percent_value` DECIMAL(8,2) NULL,
  `usertracker` VARCHAR(100) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_discount_sales_type` (`discount_type_id`, `sales_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
