-- Per-user function permissions for the POS-only "User Roles" screen
-- (src/components/MainComponents/PosSettingsModal/PosUserRoles.jsx,
-- backend/api/pos_user_permissions.php). This is intentionally separate from
-- the legacy webapi HRIS role system (tbl_user_roles) -- it just records
-- which of the fixed POS function toggles are checked for a given user.
-- No enforcement is wired up yet; this is a record-only checklist for now.

CREATE TABLE IF NOT EXISTS `tbl_pos_user_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_uuid` VARCHAR(64) NOT NULL,
  `permission_key` VARCHAR(64) NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_permission` (`user_uuid`, `permission_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
