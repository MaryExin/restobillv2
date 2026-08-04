-- Stores the stable CNC-to-report transaction mapping.
-- Skipped CNC rows stay visible here with report_status = 1,
-- while posted rows keep the gapless report-side transaction/order/invoice numbers.

USE reports_database;

CREATE TABLE IF NOT EXISTS reports_database.tbl_pos_report_transaction_map (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token_report VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    source_pos_id DOUBLE NOT NULL,
    source_rank INT NOT NULL DEFAULT 0,
    source_transaction_id DOUBLE NOT NULL,
    source_order_slip_no DOUBLE NOT NULL DEFAULT 0,
    source_invoice_no DOUBLE NOT NULL DEFAULT 0,
    report_transaction_id DOUBLE NULL DEFAULT NULL,
    report_order_slip_no DOUBLE NULL DEFAULT NULL,
    report_invoice_no DOUBLE NULL DEFAULT NULL,
    Category_Code VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    Unit_Code VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
    report_status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=posted, 1=not posted',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY ux_pos_report_map_token (token_report),
    UNIQUE KEY ux_pos_report_map_source_pos (source_pos_id),
    UNIQUE KEY ux_pos_report_map_source_txn (source_transaction_id, Category_Code, Unit_Code),
    UNIQUE KEY ux_pos_report_map_report_txn (report_transaction_id, Category_Code, Unit_Code),
    KEY idx_pos_report_map_status (report_status),
    KEY idx_pos_report_map_source_rank (source_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

DROP TEMPORARY TABLE IF EXISTS tmp_pos_report_map_ranked;

CREATE TEMPORARY TABLE tmp_pos_report_map_ranked AS
SELECT
    ranked.ID,
    ranked.transaction_id,
    ranked.token_report,
    ranked.order_slip_no,
    ranked.invoice_no,
    ranked.Category_Code,
    ranked.Unit_Code,
    ranked.source_rank
FROM (
    SELECT
        p.ID,
        p.transaction_id,
        p.token_report,
        p.order_slip_no,
        p.invoice_no,
        p.Category_Code,
        p.Unit_Code,
        @pos_report_map_rank := @pos_report_map_rank + 1 AS source_rank
    FROM db_cnc_pos.tbl_pos_transactions p
    CROSS JOIN (SELECT @pos_report_map_rank := 0) rank_init
    ORDER BY p.ID
) ranked;

INSERT INTO reports_database.tbl_pos_report_transaction_map (
    token_report,
    source_pos_id,
    source_rank,
    source_transaction_id,
    source_order_slip_no,
    source_invoice_no,
    report_transaction_id,
    report_order_slip_no,
    report_invoice_no,
    Category_Code,
    Unit_Code,
    report_status
)
SELECT
    ranked.token_report,
    ranked.ID,
    ranked.source_rank,
    ranked.transaction_id,
    COALESCE(ranked.order_slip_no, 0),
    COALESCE(ranked.invoice_no, 0),
    CASE WHEN MOD(ranked.source_rank, 3) = 0 THEN NULL ELSE report_row.transaction_id END,
    CASE WHEN MOD(ranked.source_rank, 3) = 0 THEN NULL ELSE report_row.order_slip_no END,
    CASE WHEN MOD(ranked.source_rank, 3) = 0 THEN NULL ELSE report_row.invoice_no END,
    COALESCE(ranked.Category_Code, ''),
    COALESCE(ranked.Unit_Code, ''),
    CASE WHEN MOD(ranked.source_rank, 3) = 0 THEN 1 ELSE 0 END
FROM tmp_pos_report_map_ranked ranked
LEFT JOIN reports_database.tbl_pos_transactions report_row
  ON report_row.token_report <=> ranked.token_report
WHERE ranked.token_report IS NOT NULL
  AND ranked.token_report <> ''
ON DUPLICATE KEY UPDATE
    source_pos_id = VALUES(source_pos_id),
    source_rank = VALUES(source_rank),
    source_transaction_id = VALUES(source_transaction_id),
    source_order_slip_no = VALUES(source_order_slip_no),
    source_invoice_no = VALUES(source_invoice_no),
    report_transaction_id = CASE
        WHEN VALUES(report_status) = 1 THEN NULL
        WHEN VALUES(report_transaction_id) IS NOT NULL THEN VALUES(report_transaction_id)
        ELSE report_transaction_id
    END,
    report_order_slip_no = CASE
        WHEN VALUES(report_status) = 1 THEN NULL
        WHEN VALUES(report_order_slip_no) IS NOT NULL THEN VALUES(report_order_slip_no)
        ELSE report_order_slip_no
    END,
    report_invoice_no = CASE
        WHEN VALUES(report_status) = 1 THEN NULL
        WHEN VALUES(report_invoice_no) IS NOT NULL THEN VALUES(report_invoice_no)
        ELSE report_invoice_no
    END,
    Category_Code = VALUES(Category_Code),
    Unit_Code = VALUES(Unit_Code),
    report_status = VALUES(report_status),
    updated_at = CURRENT_TIMESTAMP;

DROP TEMPORARY TABLE IF EXISTS tmp_pos_report_map_ranked;
