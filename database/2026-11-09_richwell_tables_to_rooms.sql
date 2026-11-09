-- =====================================================================
-- Richwell: rename "Table" -> "Room" and "Room" (group) -> "Floor"
-- Run when there are NO open orders (all rows in tbl_pos_tables Available).
-- Safe to re-run: CREATE uses IF NOT EXISTS, UPDATEs only touch old names.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tables (CREATE IF NOT EXISTS)
-- ---------------------------------------------------------------------

-- Master list of rooms (formerly tables).
-- NOTE: no CREATE statement existed in the repo for this table; columns are
-- taken from database/tbl_pos_tables.csv and backend/api/pos_manage_tables.php.
CREATE TABLE IF NOT EXISTS tbl_pos_tables (
    ID INT NOT NULL AUTO_INCREMENT,
    category_code VARCHAR(100) NOT NULL,
    unit_code VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    transaction_reference VARCHAR(100) NOT NULL DEFAULT '0',
    status VARCHAR(50) NOT NULL DEFAULT 'Available',
    PRIMARY KEY (ID),
    KEY idx_pos_tables_scope (category_code, unit_code),
    KEY idx_pos_tables_name (table_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Floors (formerly "rooms"): groups of rooms for the floor layout.
CREATE TABLE IF NOT EXISTS tbl_pos_table_rooms (
    ID INT NOT NULL AUTO_INCREMENT,
    category_code VARCHAR(100) NOT NULL,
    unit_code VARCHAR(100) NOT NULL,
    room_key VARCHAR(120) NOT NULL,
    room_name VARCHAR(160) NOT NULL,
    tables_json LONGTEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    UNIQUE KEY uq_pos_table_rooms_scope (category_code, unit_code, room_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Drag-and-drop floor layout positions.
CREATE TABLE IF NOT EXISTS tbl_pos_table_layout (
    ID INT NOT NULL AUTO_INCREMENT,
    category_code VARCHAR(100) NOT NULL,
    unit_code VARCHAR(100) NOT NULL,
    layout_key VARCHAR(100) NOT NULL DEFAULT 'ordering',
    positions_json LONGTEXT NULL,
    groups_json LONGTEXT NULL,
    date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    UNIQUE KEY uq_pos_table_layout_scope (category_code, unit_code, layout_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------
-- 2) Rename existing data
-- ---------------------------------------------------------------------
START TRANSACTION;

-- "Table 01" -> "Room 01"
UPDATE tbl_pos_tables
SET table_name = CONCAT('Room ', SUBSTRING(table_name, 7))
WHERE table_name LIKE 'Table %';

-- Room names stored inside each floor's JSON list
UPDATE tbl_pos_table_rooms
SET tables_json = REPLACE(tables_json, '"Table ', '"Room ')
WHERE tables_json LIKE '%"Table %';

-- Default floor name
UPDATE tbl_pos_table_rooms
SET room_name = 'Main Floor'
WHERE room_name = 'Main Room';

-- Auto-named floors: "Room 2" -> "Floor 2"
UPDATE tbl_pos_table_rooms
SET room_name = CONCAT('Floor ', SUBSTRING(room_name, 6))
WHERE room_name REGEXP '^Room [0-9]+$';

-- Room names stored inside the layout JSON
UPDATE tbl_pos_table_layout
SET positions_json = REPLACE(positions_json, '"Table ', '"Room '),
    groups_json    = REPLACE(groups_json, '"Table ', '"Room ')
WHERE positions_json LIKE '%"Table %'
   OR groups_json LIKE '%"Table %';

-- Role-access label (backend also re-syncs this on load)
UPDATE tbl_pos_permissions
SET permission_name = 'Room Layout'
WHERE permission_name = 'Table Layout';

COMMIT;
