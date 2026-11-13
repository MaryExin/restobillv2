-- Run against the local POS database after 2026-11-12_qr_ordering.sql.
-- A verified prior receipt authorizes additional batches; no customer token is copied.
SET @qr_continuation_column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_pos_qr_orders'
      AND COLUMN_NAME = 'continuation_order_id'
);
SET @qr_continuation_sql = IF(@qr_continuation_column_exists = 0,
    'ALTER TABLE tbl_pos_qr_orders ADD COLUMN continuation_order_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL AFTER request_id',
    'SELECT 1');
PREPARE qr_continuation_statement FROM @qr_continuation_sql;
EXECUTE qr_continuation_statement;
DEALLOCATE PREPARE qr_continuation_statement;
