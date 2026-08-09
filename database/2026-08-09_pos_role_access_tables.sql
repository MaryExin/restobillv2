-- Normalized POS role and permission configuration.
-- Safe to re-run: tables use IF NOT EXISTS, definitions are upserted, and
-- default roles/role-permission rows are inserted only when missing.

CREATE TABLE IF NOT EXISTS `tbl_pos_roles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_key` VARCHAR(80) NOT NULL,
  `role_value` VARCHAR(64) NOT NULL,
  `role_name` VARCHAR(100) NOT NULL,
  `role_tokens_json` TEXT NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(80) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_pos_roles_role_key` (`role_key`),
  UNIQUE KEY `uq_tbl_pos_roles_role_value` (`role_value`),
  KEY `idx_tbl_pos_roles_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `tbl_pos_permissions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `permission_group` VARCHAR(60) NOT NULL,
  `permission_key` VARCHAR(80) NOT NULL,
  `permission_name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `is_locked` TINYINT(1) NOT NULL DEFAULT 0,
  `is_developer_only` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_pos_permissions_key` (`permission_group`, `permission_key`),
  KEY `idx_tbl_pos_permissions_active` (`is_active`),
  KEY `idx_tbl_pos_permissions_group` (`permission_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `tbl_pos_role_permissions` (
  `role_id` INT UNSIGNED NOT NULL,
  `permission_id` INT UNSIGNED NOT NULL,
  `can_access` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`, `permission_id`),
  KEY `idx_tbl_pos_role_permissions_permission` (`permission_id`),
  CONSTRAINT `fk_tbl_pos_role_permissions_role`
    FOREIGN KEY (`role_id`) REFERENCES `tbl_pos_roles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tbl_pos_role_permissions_permission`
    FOREIGN KEY (`permission_id`) REFERENCES `tbl_pos_permissions` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `tbl_pos_permissions` (
  `permission_group`,
  `permission_key`,
  `permission_name`,
  `description`,
  `is_locked`,
  `is_developer_only`,
  `is_active`,
  `sort_order`
) VALUES
  ('routes', 'home', 'Home', 'POS home screen.', 1, 0, 1, 10),
  ('routes', 'productList', 'Product List', 'Product list page.', 0, 0, 1, 20),
  ('routes', 'productPriceSyncing', 'Product & Price Syncing', 'Product and price sync page.', 0, 0, 1, 30),
  ('routes', 'salesRecordSyncing', 'Sales Record Syncing', 'Sales record sync page.', 0, 0, 1, 40),
  ('routes', 'openNewDay', 'Open New Day', 'Open day action.', 0, 0, 1, 50),
  ('routes', 'newTransaction', 'New Transaction', 'Ordering transaction page.', 0, 0, 1, 60),
  ('routes', 'billing', 'Billing', 'Billing page.', 0, 0, 1, 70),
  ('routes', 'payment', 'Payment', 'Payment page.', 0, 0, 1, 80),
  ('routes', 'registrySales', 'Registry Sales', 'Sales registry page.', 0, 0, 1, 90),
  ('routes', 'posReports', 'POS Reports', 'POS reports page.', 0, 0, 1, 100),
  ('routes', 'salesDashboard', 'Sales Dashboard', 'Sales dashboard page.', 0, 0, 1, 110),
  ('reading', 'xReading', 'X Reading', 'X reading access.', 0, 0, 1, 210),
  ('reading', 'zReading', 'Z Reading', 'Z reading access.', 0, 0, 1, 220),
  ('reports', 'dashboard', 'Dashboard', 'Sales dashboard report.', 0, 0, 1, 310),
  ('reports', 'dailySales', 'Daily Sales', 'Daily sales report.', 0, 0, 1, 320),
  ('reports', 'hourlySales', 'Hourly Sales', 'Hourly sales report.', 0, 0, 1, 330),
  ('reports', 'transactions', 'Transactions', 'Transactions report.', 0, 0, 1, 340),
  ('reports', 'salesPerItem', 'Sales Per Item', 'Sales per item report.', 0, 0, 1, 350),
  ('reports', 'birESales', 'BIR E-Sales', 'BIR e-sales report.', 0, 0, 1, 360),
  ('reports', 'zReadingReprint', 'Z-Reading', 'Z-reading reprint report.', 0, 0, 1, 370),
  ('reports', 'zReadingMonthly', 'Z-Reading Monthly', 'Monthly Z-reading report.', 0, 0, 1, 380),
  ('reports', 'customers', 'Customers', 'Customer report.', 0, 0, 1, 390),
  ('reports', 'refunds', 'Refunds', 'Refunds report.', 0, 0, 1, 400),
  ('reports', 'voids', 'Voids', 'Voids report.', 0, 0, 1, 410),
  ('reports', 'logs', 'Logs', 'System logs report.', 0, 0, 1, 420),
  ('reports', 'xml', 'XML', 'XML report export.', 0, 0, 1, 430),
  ('reports', 'monthlySales', 'Monthly Sales', 'Monthly sales report.', 0, 0, 1, 440),
  ('reports', 'salesPerItemPerDate', 'Sales Per Item Per Date', 'Sales per item by date report.', 0, 0, 1, 450),
  ('reports', 'eJournal', 'E-Journal Report', 'Electronic journal report.', 0, 0, 1, 460),
  ('reports', 'pricingManagement', 'Pricing Management', 'Pricing management report.', 0, 0, 1, 470),
  ('settings', 'reportDatabase', 'Report Database', 'Report database settings.', 0, 0, 1, 510),
  ('settings', 'myAccount', 'My Account', 'My account settings.', 0, 0, 1, 520),
  ('settings', 'userAccounts', 'User Accounts', 'User account management.', 0, 0, 1, 530),
  ('settings', 'userApproval', 'User Approval', 'User approval settings.', 0, 0, 1, 540),
  ('settings', 'roleAccess', 'User Roles', 'Developer-only role access configuration.', 0, 1, 1, 550),
  ('settings', 'registrySales', 'Registry Sales', 'Registry sales settings.', 0, 0, 1, 560),
  ('settings', 'expensesPetty', 'Expenses & Petty', 'Expenses and petty cash settings.', 0, 0, 1, 570),
  ('settings', 'modeOfPayment', 'Mode of Payment', 'Mode of payment settings.', 0, 0, 1, 580),
  ('settings', 'serviceCharge', 'Service Charge', 'Service charge settings.', 0, 0, 1, 590),
  ('settings', 'discountCeiling', 'Discount Ceiling', 'Discount ceiling settings.', 0, 0, 1, 600),
  ('settings', 'discountMode', 'Discount Mode', 'Discount mode settings.', 0, 0, 1, 610),
  ('settings', 'customerInfo', 'Customer Info', 'Customer info settings.', 0, 0, 1, 620),
  ('settings', 'tableLayout', 'Table Layout', 'Table layout settings.', 0, 0, 1, 630),
  ('settings', 'salesTypeOrder', 'Sales Type Order', 'Sales type order settings.', 0, 0, 1, 640),
  ('settings', 'loyaltyConfiguration', 'Loyalty Configuration', 'Loyalty configuration settings.', 0, 0, 1, 650),
  ('settings', 'emailReports', 'Email Reports', 'Email report settings.', 0, 0, 1, 660),
  ('settings', 'dataSecurity', 'Data & Security', 'Data security settings.', 0, 0, 1, 670),
  ('settings', 'appearance', 'Appearance', 'Appearance settings.', 0, 0, 1, 680),
  ('settings', 'connectedDevices', 'Printer Settings', 'Connected device and printer settings.', 0, 0, 1, 690),
  ('settings', 'printOptions', 'Print Options', 'Print option settings.', 0, 0, 1, 700),
  ('settings', 'pictureSettings', 'Picture Settings', 'Picture settings.', 0, 0, 1, 710),
  ('settings', 'productSubcategories', 'Product Subcategories', 'Product subcategory settings.', 0, 0, 1, 720),
  ('settings', 'pricingEngine', 'Pricing Engine', 'Pricing engine settings.', 0, 0, 1, 730),
  ('settings', 'layoutMode', 'Layout Mode', 'POS layout mode settings.', 0, 0, 1, 740),
  ('settings', 'secondScreen', 'Second Screen', 'Second screen settings.', 0, 0, 1, 750)
ON DUPLICATE KEY UPDATE
  `permission_name` = VALUES(`permission_name`),
  `description` = VALUES(`description`),
  `is_locked` = VALUES(`is_locked`),
  `is_developer_only` = VALUES(`is_developer_only`),
  `is_active` = VALUES(`is_active`),
  `sort_order` = VALUES(`sort_order`);

INSERT IGNORE INTO `tbl_pos_roles` (
  `role_key`,
  `role_value`,
  `role_name`,
  `role_tokens_json`,
  `is_system`,
  `is_active`,
  `sort_order`,
  `created_by`
) VALUES
  ('super_admin', '2', 'Super Admin', '["2","SUPER ADMIN","SUPER_ADMIN","SUPERADMIN"]', 1, 1, 10, 'SYSTEM'),
  ('admin', '1', 'Admin / Supervisor', '["1","ADMIN / SUPERVISOR","ADMIN","MANAGER","SUPERVISOR"]', 1, 1, 20, 'SYSTEM'),
  ('cashier', '0', 'Cashier', '["0","CASHIER"]', 1, 1, 30, 'SYSTEM');

INSERT IGNORE INTO `tbl_pos_role_permissions` (
  `role_id`,
  `permission_id`,
  `can_access`
)
SELECT
  r.`id`,
  p.`id`,
  CASE
    WHEN p.`is_developer_only` = 1 THEN 0
    WHEN p.`is_locked` = 1 THEN 1
    WHEN r.`role_value` = '2' THEN 1
    WHEN r.`role_value` = '1' THEN
      CASE
        WHEN p.`permission_group` = 'settings'
          AND p.`permission_key` = 'reportDatabase' THEN 0
        ELSE 1
      END
    WHEN r.`role_value` = '0' THEN
      CASE
        WHEN p.`permission_group` = 'routes'
          AND p.`permission_key` IN (
            'home',
            'productList',
            'openNewDay',
            'newTransaction',
            'billing',
            'payment',
            'registrySales',
            'posReports'
          ) THEN 1
        WHEN p.`permission_group` = 'reading'
          AND p.`permission_key` IN ('xReading', 'zReading') THEN 1
        WHEN p.`permission_group` = 'reports'
          AND p.`permission_key` IN (
            'dailySales',
            'hourlySales',
            'transactions',
            'salesPerItem',
            'zReadingReprint'
          ) THEN 1
        WHEN p.`permission_group` = 'settings'
          AND p.`permission_key` IN (
            'myAccount',
            'registrySales',
            'modeOfPayment',
            'connectedDevices',
            'printOptions',
            'pictureSettings',
            'pricingEngine'
          ) THEN 1
        ELSE 0
      END
    ELSE 0
  END AS `can_access`
FROM `tbl_pos_roles` r
CROSS JOIN `tbl_pos_permissions` p
WHERE r.`role_value` IN ('2', '1', '0')
  AND p.`is_active` = 1;

-- Developer-only capabilities are never assigned to a database-backed role.
-- This also corrects rows created by an earlier version of this migration.
UPDATE `tbl_pos_role_permissions` rp
INNER JOIN `tbl_pos_permissions` p ON p.`id` = rp.`permission_id`
SET rp.`can_access` = 0
WHERE p.`is_developer_only` = 1;
