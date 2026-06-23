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
