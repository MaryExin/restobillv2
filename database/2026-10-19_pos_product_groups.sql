-- Optional POS product grouping. No existing product, price, recipe or sale is changed.
-- An absent row or enabled = 0 preserves the ordinary product flow.
CREATE TABLE IF NOT EXISTS `tbl_pos_product_groups` (
  `build_code` VARCHAR(64) NOT NULL,
  `scope_key` VARCHAR(64) NOT NULL DEFAULT '',
  `enabled` TINYINT NOT NULL DEFAULT 0,
  `group_name` VARCHAR(100) NOT NULL DEFAULT 'Products',
  `size_name` VARCHAR(64) NOT NULL DEFAULT '',
  `variant_name` VARCHAR(100) NOT NULL DEFAULT '',
  `allow_half` TINYINT NOT NULL DEFAULT 0,
  `allow_half_and_half` TINYINT NOT NULL DEFAULT 0,
  `active_variant` VARCHAR(266) GENERATED ALWAYS AS
    (CASE WHEN `enabled` = 1 THEN CONCAT(TRIM(`group_name`), CHAR(31), TRIM(`size_name`), CHAR(31), TRIM(`variant_name`)) ELSE NULL END) STORED,
  `revision` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `usertracker` VARCHAR(64) NULL,
  `createdtime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedtime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`build_code`),
  UNIQUE KEY `uq_product_group_variant` (`scope_key`, `active_variant`),
  KEY `idx_product_group` (`enabled`, `group_name`, `size_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Apply to the restaurant terminal database. Every physical variant line keeps its selection.
CREATE TABLE IF NOT EXISTS `tbl_pos_product_group_selections` (
  `pos_detail_id` BIGINT UNSIGNED NOT NULL,
  `transaction_id` VARCHAR(64) NOT NULL,
  `category_code` VARCHAR(64) NOT NULL,
  `unit_code` VARCHAR(64) NOT NULL,
  `selection_id` VARCHAR(64) NOT NULL,
  `group_selection_json` LONGTEXT NOT NULL,
  `line_label` VARCHAR(600) NOT NULL,
  `createdtime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`pos_detail_id`),
  KEY `idx_pos_group_transaction` (`transaction_id`, `category_code`, `unit_code`, `selection_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
