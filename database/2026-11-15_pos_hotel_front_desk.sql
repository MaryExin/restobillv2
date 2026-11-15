-- =====================================================================
-- Hotel front desk (no PMS): in-house guests / folios, Charge to Room,
-- City Ledger (charge to company), Complimentary, collections.
--
-- The API creates these on first use (backend/api/pos_hotel_ledger.php,
-- posHotelEnsureSchema), so running this file is optional. Safe to re-run.
--
-- Accounting: the sale is recorded once at the outlet when the bill is paid
-- with Charge to Room / City Ledger / Complimentary. Room nights (night audit)
-- are POS invoices too (product HOTEL-ROOM-NIGHT, order type ROOM). Settling
-- the balance later is a collection (tbl_pos_ar_collections), not a sale;
-- cash collections count in the X / Z reading short/over.
-- =====================================================================

-- Marks the hotel modes of payment: ROOM_CHARGE, CITY_LEDGER, COMPLIMENTARY.
ALTER TABLE tbl_mode_of_payment
    ADD COLUMN IF NOT EXISTS mop_kind VARCHAR(30) NULL AFTER MOP_On_Off;

CREATE TABLE IF NOT EXISTS tbl_pos_hotel_counters (
    Category_Code VARCHAR(100) NOT NULL,
    Unit_Code VARCHAR(100) NOT NULL,
    counter_key VARCHAR(30) NOT NULL,
    next_value INT NOT NULL DEFAULT 1,
    PRIMARY KEY (Category_Code, Unit_Code, counter_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tbl_pos_hotel_stays (
    ID INT NOT NULL AUTO_INCREMENT,
    folio_no VARCHAR(20) NOT NULL,
    Category_Code VARCHAR(100) NOT NULL,
    Unit_Code VARCHAR(100) NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    guest_name VARCHAR(150) NOT NULL,
    guest_contact VARCHAR(30) NULL,
    guest_count INT NOT NULL DEFAULT 1,
    check_in_at DATETIME NOT NULL,
    expected_check_out DATE NULL,
    room_rate DECIMAL(12,2) NULL,
    check_out_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'In-House',
    notes VARCHAR(500) NULL,
    created_by VARCHAR(150) NOT NULL DEFAULT '',
    checked_out_by VARCHAR(150) NULL,
    date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    UNIQUE KEY uq_pos_hotel_stays_folio (Category_Code, Unit_Code, folio_no),
    KEY idx_pos_hotel_stays_status (Category_Code, Unit_Code, status),
    KEY idx_pos_hotel_stays_room (room_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tbl_pos_city_ledger_accounts (
    ID INT NOT NULL AUTO_INCREMENT,
    account_code VARCHAR(20) NOT NULL,
    Category_Code VARCHAR(100) NOT NULL,
    Unit_Code VARCHAR(100) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(150) NULL,
    contact_number VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    address VARCHAR(300) NULL,
    tin VARCHAR(30) NULL,
    credit_limit DECIMAL(12,2) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_by VARCHAR(150) NOT NULL DEFAULT '',
    date_recorded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (ID),
    UNIQUE KEY uq_pos_city_ledger_code (Category_Code, Unit_Code, account_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tbl_pos_ar_charges (
    ID INT NOT NULL AUTO_INCREMENT,
    ledger_type VARCHAR(20) NOT NULL,
    stay_id INT NULL,
    account_id INT NULL,
    Category_Code VARCHAR(100) NOT NULL,
    Unit_Code VARCHAR(100) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'SALE',
    transaction_id VARCHAR(100) NULL,
    invoice_no BIGINT NULL,
    collection_no VARCHAR(20) NULL,
    service_date DATE NULL,
    description VARCHAR(300) NOT NULL DEFAULT '',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    reversed_reason VARCHAR(300) NULL,
    reversed_at DATETIME NULL,
    posted_by VARCHAR(150) NOT NULL DEFAULT '',
    charged_at DATETIME NOT NULL,
    PRIMARY KEY (ID),
    KEY idx_pos_ar_charges_stay (stay_id),
    KEY idx_pos_ar_charges_account (account_id),
    KEY idx_pos_ar_charges_txn (transaction_id, Category_Code, Unit_Code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tbl_pos_ar_collections (
    ID INT NOT NULL AUTO_INCREMENT,
    collection_no VARCHAR(20) NOT NULL,
    ledger_type VARCHAR(20) NOT NULL,
    stay_id INT NULL,
    account_id INT NULL,
    Category_Code VARCHAR(100) NOT NULL,
    Unit_Code VARCHAR(100) NOT NULL,
    payment_method VARCHAR(60) NOT NULL,
    payment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_reference VARCHAR(100) NULL,
    terminal_number VARCHAR(20) NULL,
    cashier VARCHAR(150) NOT NULL DEFAULT '',
    remarks VARCHAR(300) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    void_reason VARCHAR(300) NULL,
    voided_by VARCHAR(150) NULL,
    voided_at DATETIME NULL,
    collected_at DATETIME NOT NULL,
    PRIMARY KEY (ID),
    KEY idx_pos_ar_collections_no (Category_Code, Unit_Code, collection_no),
    KEY idx_pos_ar_collections_stay (stay_id),
    KEY idx_pos_ar_collections_account (account_id),
    KEY idx_pos_ar_collections_date (collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tbl_pos_complimentary (
    ID INT NOT NULL AUTO_INCREMENT,
    Category_Code VARCHAR(100) NOT NULL,
    Unit_Code VARCHAR(100) NOT NULL,
    transaction_id VARCHAR(100) NOT NULL,
    invoice_no BIGINT NULL,
    comp_type VARCHAR(40) NOT NULL,
    reason VARCHAR(300) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    guest_name VARCHAR(150) NULL,
    approved_by VARCHAR(100) NOT NULL,
    approved_by_name VARCHAR(150) NOT NULL DEFAULT '',
    cashier VARCHAR(150) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    date_recorded DATETIME NOT NULL,
    PRIMARY KEY (ID),
    KEY idx_pos_complimentary_date (Category_Code, Unit_Code, date_recorded),
    KEY idx_pos_complimentary_txn (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Columns added after the first version of these tables (for databases that
-- already created them).
ALTER TABLE tbl_pos_hotel_stays
    ADD COLUMN IF NOT EXISTS room_rate DECIMAL(12,2) NULL AFTER expected_check_out;
ALTER TABLE tbl_pos_ar_charges
    ADD COLUMN IF NOT EXISTS service_date DATE NULL AFTER collection_no;
ALTER TABLE tbl_pos_ar_collections
    ADD COLUMN IF NOT EXISTS void_reason VARCHAR(300) NULL AFTER status,
    ADD COLUMN IF NOT EXISTS voided_by VARCHAR(150) NULL AFTER void_reason,
    ADD COLUMN IF NOT EXISTS voided_at DATETIME NULL AFTER voided_by;

-- The three modes of payment (turned ON). The Front Desk page adds them
-- automatically; an existing mode with the same name is tagged instead.
UPDATE tbl_mode_of_payment SET mop_kind = 'ROOM_CHARGE'
 WHERE LOWER(TRIM(mop)) = 'charge to room' AND (mop_kind IS NULL OR mop_kind = '');
UPDATE tbl_mode_of_payment SET mop_kind = 'CITY_LEDGER'
 WHERE LOWER(TRIM(mop)) = 'city ledger' AND (mop_kind IS NULL OR mop_kind = '');
UPDATE tbl_mode_of_payment SET mop_kind = 'COMPLIMENTARY'
 WHERE LOWER(TRIM(mop)) = 'complimentary' AND (mop_kind IS NULL OR mop_kind = '');

INSERT INTO tbl_mode_of_payment (mop_id, mop, sl_code, reference_On_Off, MOP_On_Off, mop_kind)
SELECT CONCAT('MP-', LEFT(REPLACE(UUID(), '-', ''), 12)), 'Charge to Room', '', 0, 1, 'ROOM_CHARGE'
 WHERE NOT EXISTS (SELECT 1 FROM tbl_mode_of_payment WHERE mop_kind = 'ROOM_CHARGE');
INSERT INTO tbl_mode_of_payment (mop_id, mop, sl_code, reference_On_Off, MOP_On_Off, mop_kind)
SELECT CONCAT('MP-', LEFT(REPLACE(UUID(), '-', ''), 12)), 'City Ledger', '', 0, 1, 'CITY_LEDGER'
 WHERE NOT EXISTS (SELECT 1 FROM tbl_mode_of_payment WHERE mop_kind = 'CITY_LEDGER');
INSERT INTO tbl_mode_of_payment (mop_id, mop, sl_code, reference_On_Off, MOP_On_Off, mop_kind)
SELECT CONCAT('MP-', LEFT(REPLACE(UUID(), '-', ''), 12)), 'Complimentary', '', 0, 1, 'COMPLIMENTARY'
 WHERE NOT EXISTS (SELECT 1 FROM tbl_mode_of_payment WHERE mop_kind = 'COMPLIMENTARY');
