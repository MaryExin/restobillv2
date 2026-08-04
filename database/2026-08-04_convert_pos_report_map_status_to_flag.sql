-- Converts report_status from text to a numeric flag.
-- 0 = posted to reports_database.tbl_pos_transactions
-- 1 = not posted / skipped

USE reports_database;

UPDATE reports_database.tbl_pos_report_transaction_map
SET report_status = CASE
    WHEN UPPER(CAST(report_status AS CHAR)) = 'SKIPPED' THEN '1'
    WHEN CAST(report_status AS CHAR) = '1' THEN '1'
    ELSE '0'
END;

ALTER TABLE reports_database.tbl_pos_report_transaction_map
    MODIFY COLUMN report_status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=posted, 1=not posted';
