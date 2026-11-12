-- =====================================================================
-- POS reservations (2026-11-11)
-- Guest reservations with a date/time, number of guests, optional
-- room/table assignment, special request and an optional pre-order. A reservation only affects
-- the room on its reservation_date (the room shows "Reserved" that day).
-- Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS `tbl_pos_reservations` (
  `ID` INT NOT NULL AUTO_INCREMENT,
  `category_code` VARCHAR(100) NOT NULL,
  `unit_code` VARCHAR(100) NOT NULL,
  `guest_name` VARCHAR(150) NOT NULL,
  `contact_number` VARCHAR(30) NOT NULL,
  `guest_count` INT NOT NULL DEFAULT 1,
  `reservation_date` DATE NOT NULL,
  `reservation_time` TIME NOT NULL,
  `table_name` VARCHAR(100) NULL,
  `special_request` TEXT NULL,
  `pre_order_sales_type` VARCHAR(45) NULL,
  `pre_order_json` LONGTEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Booked',
  `created_by` VARCHAR(100) NULL,
  `updated_by` VARCHAR(100) NULL,
  `date_recorded` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`),
  KEY `idx_pos_reservations_scope_date` (`category_code`, `unit_code`, `reservation_date`),
  KEY `idx_pos_reservations_table_date` (`table_name`, `reservation_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Optional pre-order (items chosen when booking). For a table created before
-- pre-orders existed. MariaDB (XAMPP) syntax; pos_reservations.php also adds
-- these columns automatically if they are missing.
ALTER TABLE `tbl_pos_reservations`
  ADD COLUMN IF NOT EXISTS `pre_order_sales_type` VARCHAR(45) NULL AFTER `special_request`,
  ADD COLUMN IF NOT EXISTS `pre_order_json` LONGTEXT NULL AFTER `pre_order_sales_type`;

-- Page permission (Settings > Role Access shows it as "Reservations").
INSERT INTO tbl_pos_permissions
    (permission_group, permission_key, permission_name, description,
     is_locked, is_developer_only, is_active, sort_order)
SELECT 'routes', 'reservations', 'Reservations', 'Reservations page.', 0, 0, 1, 75
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_pos_permissions
    WHERE permission_group = 'routes' AND permission_key = 'reservations'
);

-- Give it to every role that can already use Bill / Folio.
INSERT INTO tbl_pos_role_permissions (role_id, permission_id, can_access)
SELECT rp.role_id, p_new.id, rp.can_access
FROM tbl_pos_role_permissions rp
JOIN tbl_pos_permissions p_bill
  ON p_bill.id = rp.permission_id
 AND p_bill.permission_group = 'routes'
 AND p_bill.permission_key = 'billing'
JOIN tbl_pos_permissions p_new
  ON p_new.permission_group = 'routes'
 AND p_new.permission_key = 'reservations'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_pos_role_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = p_new.id
);
