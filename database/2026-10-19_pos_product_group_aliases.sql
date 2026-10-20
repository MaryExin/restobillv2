-- Optional, reversible menu consolidation. Original masters, prices and sales remain unchanged.
-- Empty size_id is allowed only for a legacy canonical with a single configured size.
CREATE TABLE IF NOT EXISTS `tbl_pos_product_group_aliases` (
  `source_build_code` VARCHAR(64) NOT NULL,
  `canonical_build_code` VARCHAR(64) NOT NULL,
  `size_id` VARCHAR(64) NOT NULL DEFAULT '',
  `scope_key` VARCHAR(64) NOT NULL DEFAULT '',
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `revision` BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `usertracker` VARCHAR(64) NULL,
  `createdtime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedtime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`source_build_code`),
  KEY `idx_product_group_alias_target` (`canonical_build_code`, `enabled`),
  KEY `idx_product_group_alias_size` (`size_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
