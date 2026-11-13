-- Apply to the same LOCAL database used by backend/api/config.php.
-- Existing POS transaction/counter/log tables must use InnoDB for atomic acceptance.
-- For item notes also apply 2026-10-21_pos_order_item_instruction.sql.
CREATE TABLE IF NOT EXISTS tbl_pos_qr_hosts (
    category_code VARCHAR(100) NOT NULL,
    unit_code VARCHAR(100) NOT NULL,
    host_token CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (category_code, unit_code),
    UNIQUE KEY uq_qr_host_token (host_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tbl_pos_qr_orders (
    order_id CHAR(36) NOT NULL,
    category_code VARCHAR(100) NOT NULL,
    unit_code VARCHAR(100) NOT NULL,
    request_id CHAR(36) NOT NULL,
    continuation_order_id CHAR(36) NULL,
    request_hash CHAR(64) NOT NULL,
    tracking_token CHAR(64) NOT NULL,
    customer_name VARCHAR(120) NULL,
    customer_head_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    table_number VARCHAR(100) NULL,
    order_type VARCHAR(30) NOT NULL,
    notes VARCHAR(1000) NULL,
    subtotal_amount DECIMAL(14,2) NOT NULL,
    service_charge_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(14,2) NOT NULL,
    status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
    transaction_id BIGINT UNSIGNED NULL,
    order_slip_no BIGINT UNSIGNED NULL,
    terminal_number VARCHAR(30) NULL,
    processed_by VARCHAR(100) NULL,
    rejection_reason VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    processed_at DATETIME NULL,
    PRIMARY KEY (order_id),
    UNIQUE KEY uq_qr_request (category_code, unit_code, request_id),
    KEY ix_qr_pending (category_code, unit_code, status, created_at),
    KEY ix_qr_transaction (category_code, unit_code, transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS tbl_pos_qr_order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id CHAR(36) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_category VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    unit_cost DECIMAL(14,4) NOT NULL,
    selling_price DECIMAL(14,4) NOT NULL,
    vatable VARCHAR(20) NOT NULL,
    is_discountable VARCHAR(20) NOT NULL,
    item_instruction VARCHAR(500) NULL,
    PRIMARY KEY (id),
    KEY ix_qr_item_order (order_id),
    CONSTRAINT fk_qr_item_order FOREIGN KEY (order_id)
        REFERENCES tbl_pos_qr_orders (order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
