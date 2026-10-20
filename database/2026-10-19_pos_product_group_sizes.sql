-- Optional sizes on one product. Apply after 2026-10-19_pos_product_groups.sql.
-- No existing product, recipe, price or first-version group row is changed.
CREATE TABLE IF NOT EXISTS `tbl_pos_product_group_sizes` (
  `size_id` VARCHAR(64) NOT NULL,
  `build_code` VARCHAR(64) NOT NULL,
  `size_name` VARCHAR(64) NOT NULL,
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `recipe_configured` TINYINT NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`size_id`),
  UNIQUE KEY `uq_product_group_size` (`build_code`,`size_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `tbl_pos_product_group_size_prices` (
  `size_id` VARCHAR(64) NOT NULL,
  `pricing_category` VARCHAR(64) NOT NULL,
  `srp` DECIMAL(18,4) NOT NULL,
  `cost_per_uom` DECIMAL(18,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`size_id`,`pricing_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `tbl_pos_product_group_size_components` (
  `size_id` VARCHAR(64) NOT NULL,
  `component_code` VARCHAR(64) NOT NULL,
  `component_class` VARCHAR(2) NOT NULL,
  `qty` DECIMAL(18,6) NOT NULL,
  `description` VARCHAR(255) NOT NULL DEFAULT '',
  `uom` VARCHAR(32) NOT NULL DEFAULT 'PC',
  `uomval` DECIMAL(18,6) NOT NULL DEFAULT 1,
  `category` VARCHAR(100) NOT NULL DEFAULT '',
  `cost_per_uom` DECIMAL(18,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`size_id`,`component_code`,`component_class`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
