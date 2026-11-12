-- =====================================================================
-- POS customer registry (2026-11-11)
-- Every guest the POS meets is saved once in tbl_pos_customers: the optional
-- guest details asked when an order is started (walk-ins), reservations, and
-- discount customer cards. Orders link to the customer through
-- tbl_pos_transactions.guest_customer_code so Reports > Customers lists each
-- customer with their visits, transactions and amount spent.
--
-- MariaDB (XAMPP) syntax. Run after 2026-11-11_pos_reservations.sql.
-- backend/api/pos_customers.php also creates the table and the link column
-- on first use; run this file to add them up front and to register the
-- guests already saved on existing orders and reservations. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS db_cnc_pos.tbl_pos_customers (
  `ID` INT NOT NULL AUTO_INCREMENT,
  `customer_code` VARCHAR(20) NOT NULL,
  `Category_Code` VARCHAR(255) NOT NULL DEFAULT '',
  `Unit_Code` VARCHAR(255) NOT NULL DEFAULT '',
  `full_name` VARCHAR(150) NOT NULL DEFAULT '',
  `contact_number` VARCHAR(30) NOT NULL DEFAULT '',
  `contact_digits` VARCHAR(30) NOT NULL DEFAULT '',
  `email` VARCHAR(150) NOT NULL DEFAULT '',
  `address` VARCHAR(255) NOT NULL DEFAULT '',
  `notes` VARCHAR(500) NOT NULL DEFAULT '',
  `source` VARCHAR(20) NOT NULL DEFAULT 'walk-in',
  `first_visit` DATETIME NULL,
  `last_visit` DATETIME NULL,
  `visit_count` INT NOT NULL DEFAULT 0,
  `last_transaction_id` BIGINT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
  `created_by` VARCHAR(100) NOT NULL DEFAULT '',
  `date_recorded` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_updated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `uniq_pos_customers_code` (`customer_code`),
  KEY `idx_pos_customers_contact` (`Category_Code`, `Unit_Code`, `contact_digits`),
  KEY `idx_pos_customers_name` (`Category_Code`, `Unit_Code`, `full_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Link column on orders (the guest detail columns are repeated here so this
-- file also works on a database that never ran the guest-details file).
ALTER TABLE db_cnc_pos.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150) NULL AFTER customer_count_for_discount,
    ADD COLUMN IF NOT EXISTS guest_contact VARCHAR(30) NULL AFTER guest_name,
    ADD COLUMN IF NOT EXISTS guest_request VARCHAR(500) NULL AFTER guest_contact,
    ADD COLUMN IF NOT EXISTS guest_customer_code VARCHAR(20) NULL AFTER guest_request;

ALTER TABLE reports_database.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150) NULL AFTER customer_count_for_discount,
    ADD COLUMN IF NOT EXISTS guest_contact VARCHAR(30) NULL AFTER guest_name,
    ADD COLUMN IF NOT EXISTS guest_request VARCHAR(500) NULL AFTER guest_contact,
    ADD COLUMN IF NOT EXISTS guest_customer_code VARCHAR(20) NULL AFTER guest_request;

-- Link column on reservations.
ALTER TABLE db_cnc_pos.tbl_pos_reservations
    ADD COLUMN IF NOT EXISTS customer_code VARCHAR(20) NULL AFTER pre_order_json;

-- ---------------------------------------------------------------------
-- Backfill 1: guests from existing reservations (one customer per contact
-- number; the earliest reservation supplies the name and request).
-- ---------------------------------------------------------------------
INSERT INTO db_cnc_pos.tbl_pos_customers
    (customer_code, Category_Code, Unit_Code, full_name, contact_number, contact_digits,
     notes, source, created_by, date_recorded)
SELECT
    CONCAT('CU-', LOWER(SUBSTRING(MD5(CONCAT('reservation:', r.ID)), 1, 12))),
    r.category_code,
    r.unit_code,
    r.guest_name,
    r.contact_number,
    REGEXP_REPLACE(r.contact_number, '[^0-9]', ''),
    LEFT(IFNULL(r.special_request, ''), 500),
    'reservation',
    IFNULL(r.created_by, ''),
    r.date_recorded
FROM db_cnc_pos.tbl_pos_reservations r
WHERE r.ID = (
        SELECT MIN(r2.ID)
        FROM db_cnc_pos.tbl_pos_reservations r2
        WHERE r2.category_code = r.category_code
          AND r2.unit_code = r.unit_code
          AND REGEXP_REPLACE(r2.contact_number, '[^0-9]', '') = REGEXP_REPLACE(r.contact_number, '[^0-9]', '')
    )
  AND NOT EXISTS (
        SELECT 1
        FROM db_cnc_pos.tbl_pos_customers c
        WHERE c.Category_Code = r.category_code
          AND c.Unit_Code = r.unit_code
          AND c.contact_digits = REGEXP_REPLACE(r.contact_number, '[^0-9]', '')
    );

UPDATE db_cnc_pos.tbl_pos_reservations r
JOIN db_cnc_pos.tbl_pos_customers c
  ON c.Category_Code = r.category_code
 AND c.Unit_Code = r.unit_code
 AND c.contact_digits = REGEXP_REPLACE(r.contact_number, '[^0-9]', '')
SET r.customer_code = c.customer_code
WHERE r.customer_code IS NULL OR r.customer_code = '';

-- ---------------------------------------------------------------------
-- Backfill 2: guests saved on existing orders (guest_name / guest_contact)
-- that are not in the registry yet. Matched by contact number when the
-- order has one, otherwise by name.
-- ---------------------------------------------------------------------
INSERT INTO db_cnc_pos.tbl_pos_customers
    (customer_code, Category_Code, Unit_Code, full_name, contact_number, contact_digits,
     notes, source, created_by, date_recorded)
SELECT
    CONCAT('CU-', LOWER(SUBSTRING(MD5(CONCAT('order:', g.Category_Code, '|', g.Unit_Code, '|', g.match_key)), 1, 12))),
    g.Category_Code,
    g.Unit_Code,
    IFNULL(g.full_name, ''),
    IFNULL(g.contact_number, ''),
    CASE WHEN LENGTH(g.contact_digits) >= 5 THEN g.contact_digits ELSE '' END,
    LEFT(IFNULL(g.notes, ''), 500),
    'walk-in',
    IFNULL(g.cashier, ''),
    g.first_visit
FROM (
    SELECT
        t.Category_Code,
        t.Unit_Code,
        CASE WHEN LENGTH(REGEXP_REPLACE(IFNULL(t.guest_contact, ''), '[^0-9]', '')) >= 5
             THEN CONCAT('c:', REGEXP_REPLACE(t.guest_contact, '[^0-9]', ''))
             ELSE CONCAT('n:', UPPER(TRIM(t.guest_name))) END AS match_key,
        MAX(NULLIF(TRIM(t.guest_name), '')) AS full_name,
        MAX(NULLIF(TRIM(t.guest_contact), '')) AS contact_number,
        MAX(REGEXP_REPLACE(IFNULL(t.guest_contact, ''), '[^0-9]', '')) AS contact_digits,
        MAX(NULLIF(TRIM(t.guest_request), '')) AS notes,
        MIN(t.date_recorded) AS first_visit,
        MAX(t.cashier) AS cashier
    FROM db_cnc_pos.tbl_pos_transactions t
    WHERE (IFNULL(t.guest_name, '') <> ''
           OR LENGTH(REGEXP_REPLACE(IFNULL(t.guest_contact, ''), '[^0-9]', '')) >= 5)
      AND (t.guest_customer_code IS NULL OR t.guest_customer_code = '')
    GROUP BY t.Category_Code, t.Unit_Code, match_key
) g
WHERE NOT EXISTS (
    SELECT 1
    FROM db_cnc_pos.tbl_pos_customers c
    WHERE c.Category_Code = g.Category_Code
      AND c.Unit_Code = g.Unit_Code
      AND ((LENGTH(g.contact_digits) >= 5 AND c.contact_digits = g.contact_digits)
           OR (LENGTH(g.contact_digits) < 5 AND c.full_name = IFNULL(g.full_name, '')))
);

-- Link the orders to their customer.
UPDATE db_cnc_pos.tbl_pos_transactions t
JOIN db_cnc_pos.tbl_pos_customers c
  ON c.Category_Code = t.Category_Code
 AND c.Unit_Code = t.Unit_Code
 AND ((c.contact_digits <> ''
       AND c.contact_digits = REGEXP_REPLACE(IFNULL(t.guest_contact, ''), '[^0-9]', ''))
      OR (LENGTH(REGEXP_REPLACE(IFNULL(t.guest_contact, ''), '[^0-9]', '')) < 5
          AND c.full_name <> ''
          AND c.full_name = TRIM(IFNULL(t.guest_name, ''))))
SET t.guest_customer_code = c.customer_code
WHERE t.guest_customer_code IS NULL OR t.guest_customer_code = '';

-- Visit statistics from the linked orders (also repairs them on a re-run).
UPDATE db_cnc_pos.tbl_pos_customers c
JOIN (
    SELECT guest_customer_code,
           COUNT(*) AS visits,
           MIN(date_recorded) AS first_visit,
           MAX(date_recorded) AS last_visit,
           MAX(transaction_id) AS last_transaction_id
    FROM db_cnc_pos.tbl_pos_transactions
    WHERE guest_customer_code IS NOT NULL AND guest_customer_code <> ''
    GROUP BY guest_customer_code
) s ON s.guest_customer_code = c.customer_code
SET c.visit_count = s.visits,
    c.first_visit = s.first_visit,
    c.last_visit = s.last_visit,
    c.last_transaction_id = s.last_transaction_id;

-- ---------------------------------------------------------------------
-- Reports > Customers is only granted to Super Admin by default; let the
-- Admin / Supervisor role open it too (Settings > Role Access can change it).
-- ---------------------------------------------------------------------
UPDATE db_cnc_pos.tbl_pos_role_permissions rp
JOIN db_cnc_pos.tbl_pos_permissions p
  ON p.id = rp.permission_id
 AND p.permission_group = 'reports'
 AND p.permission_key = 'customers'
JOIN db_cnc_pos.tbl_pos_roles r
  ON r.id = rp.role_id
 AND r.role_key = 'admin'
SET rp.can_access = 1;

INSERT INTO db_cnc_pos.tbl_pos_role_permissions (role_id, permission_id, can_access)
SELECT r.id, p.id, 1
FROM db_cnc_pos.tbl_pos_roles r
JOIN db_cnc_pos.tbl_pos_permissions p
  ON p.permission_group = 'reports'
 AND p.permission_key = 'customers'
WHERE r.role_key = 'admin'
  AND NOT EXISTS (
        SELECT 1 FROM db_cnc_pos.tbl_pos_role_permissions x
        WHERE x.role_id = r.id AND x.permission_id = p.id
  );
