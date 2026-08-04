-- Adds a letters-only report token used to link db_cnc_pos transactions
-- to reports_database rows even when reports_database.transaction_id is remapped.

USE db_cnc_pos;

ALTER TABLE db_cnc_pos.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS token_report VARCHAR(32)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL
        AFTER transaction_id;

ALTER TABLE reports_database.tbl_pos_transactions
    ADD COLUMN IF NOT EXISTS token_report VARCHAR(32)
        CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL
        AFTER transaction_id;

DROP TEMPORARY TABLE IF EXISTS tmp_pos_report_tokens;

CREATE TEMPORARY TABLE tmp_pos_report_tokens AS
SELECT
    p.ID,
    CONCAT(
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26)),
        CHAR(65 + FLOOR(RAND() * 26))
    ) AS token_report
FROM db_cnc_pos.tbl_pos_transactions p
WHERE p.token_report IS NULL
   OR p.token_report = '';

UPDATE db_cnc_pos.tbl_pos_transactions p
JOIN tmp_pos_report_tokens t
  ON t.ID = p.ID
SET p.token_report = t.token_report
WHERE p.token_report IS NULL
   OR p.token_report = '';

UPDATE reports_database.tbl_pos_transactions r
JOIN db_cnc_pos.tbl_pos_transactions p
  ON p.ID = r.ID
SET r.token_report = p.token_report
WHERE r.token_report IS NULL
   OR r.token_report = '';

DROP TEMPORARY TABLE IF EXISTS tmp_pos_report_tokens;

CREATE INDEX IF NOT EXISTS idx_pos_transactions_token_report
    ON db_cnc_pos.tbl_pos_transactions (token_report);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_transactions_token_report
    ON db_cnc_pos.tbl_pos_transactions (token_report);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pos_transactions_token_report
    ON reports_database.tbl_pos_transactions (token_report);
