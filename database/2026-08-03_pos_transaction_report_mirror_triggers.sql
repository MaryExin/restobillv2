-- Report database rule:
-- 1) Drop the old "always mirror" triggers.
-- 2) Remove every 3rd POS transaction from reports_database.
-- 3) Keep reports_database transaction_id continuous for posted rows.
--
-- Run 2026-08-03_add_token_report_to_pos_transactions.sql first.

USE db_cnc_pos;

DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_ai;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_au;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_ad;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_detail_ai;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_detail_au;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_detail_ad;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_payment_ai;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_payment_au;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_payment_ad;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_discount_ai;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_discount_au;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_discount_ad;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_charge_ai;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_charge_au;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_charge_ad;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_customer_ai;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_customer_au;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_customer_ad;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_prod_disc_ai;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_prod_disc_au;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_txn_prod_disc_ad;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_loyalty_ai;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_loyalty_au;
DROP TRIGGER IF EXISTS db_cnc_pos.trg_report_mirror_pos_loyalty_ad;

DROP TEMPORARY TABLE IF EXISTS tmp_report_ranked_pos_transactions;
DROP TEMPORARY TABLE IF EXISTS tmp_report_skipped_pos_transactions;
DROP TEMPORARY TABLE IF EXISTS tmp_report_transaction_id_map;

CREATE TEMPORARY TABLE tmp_report_ranked_pos_transactions AS
SELECT
    ranked.ID,
    ranked.transaction_id,
    ranked.token_report,
    ranked.order_slip_no,
    ranked.invoice_no,
    ranked.Category_Code,
    ranked.Unit_Code,
    ranked.transaction_rank
FROM (
    SELECT
        p.ID,
        p.transaction_id,
        p.token_report,
        p.order_slip_no,
        p.invoice_no,
        p.Category_Code,
        p.Unit_Code,
        @pos_report_txn_rank := @pos_report_txn_rank + 1 AS transaction_rank
    FROM db_cnc_pos.tbl_pos_transactions p
    CROSS JOIN (SELECT @pos_report_txn_rank := 0) rank_init
    ORDER BY p.ID
) ranked;

CREATE TEMPORARY TABLE tmp_report_skipped_pos_transactions AS
SELECT
    ID,
    transaction_id,
    token_report,
    order_slip_no,
    invoice_no,
    Category_Code,
    Unit_Code
FROM tmp_report_ranked_pos_transactions
WHERE MOD(transaction_rank, 3) = 0;

DELETE child_row
FROM reports_database.tbl_pos_transactions_detailed child_row
JOIN reports_database.tbl_pos_transactions report_row
  ON child_row.transaction_id <=> report_row.transaction_id
 AND child_row.Category_Code <=> report_row.Category_Code
 AND child_row.Unit_Code <=> report_row.Unit_Code
JOIN tmp_report_skipped_pos_transactions skipped
  ON report_row.token_report <=> skipped.token_report;

DELETE child_row
FROM reports_database.tbl_pos_transactions_payments child_row
JOIN reports_database.tbl_pos_transactions report_row
  ON child_row.transaction_id <=> report_row.transaction_id
 AND child_row.Category_Code <=> report_row.Category_Code
 AND child_row.Unit_Code <=> report_row.Unit_Code
JOIN tmp_report_skipped_pos_transactions skipped
  ON report_row.token_report <=> skipped.token_report;

DELETE child_row
FROM reports_database.tbl_pos_transactions_discounts child_row
JOIN reports_database.tbl_pos_transactions report_row
  ON child_row.transaction_id <=> report_row.transaction_id
 AND child_row.Category_Code <=> report_row.Category_Code
 AND child_row.Unit_Code <=> report_row.Unit_Code
JOIN tmp_report_skipped_pos_transactions skipped
  ON report_row.token_report <=> skipped.token_report;

DELETE child_row
FROM reports_database.tbl_pos_transactions_other_charges child_row
JOIN reports_database.tbl_pos_transactions report_row
  ON child_row.transaction_id <=> report_row.transaction_id
 AND child_row.Category_Code <=> report_row.Category_Code
 AND child_row.Unit_Code <=> report_row.Unit_Code
JOIN tmp_report_skipped_pos_transactions skipped
  ON report_row.token_report <=> skipped.token_report;

DELETE child_row
FROM reports_database.tbl_pos_transactions_customers child_row
JOIN reports_database.tbl_pos_transactions report_row
  ON child_row.transaction_id <=> report_row.transaction_id
 AND child_row.Category_Code <=> report_row.Category_Code
 AND child_row.Unit_Code <=> report_row.Unit_Code
JOIN tmp_report_skipped_pos_transactions skipped
  ON report_row.token_report <=> skipped.token_report;

DELETE child_row
FROM reports_database.tbl_pos_transactions_discounts_per_product child_row
JOIN reports_database.tbl_pos_transactions report_row
  ON child_row.transaction_id <=> report_row.transaction_id
 AND child_row.category_code <=> report_row.Category_Code
 AND child_row.unit_code <=> report_row.Unit_Code
JOIN tmp_report_skipped_pos_transactions skipped
  ON report_row.token_report <=> skipped.token_report;

DELETE child_row
FROM reports_database.tbl_pos_loyalty_discounts child_row
JOIN reports_database.tbl_pos_transactions report_row
  ON child_row.transaction_id <=> report_row.transaction_id
 AND child_row.Category_Code <=> report_row.Category_Code
 AND child_row.Unit_Code <=> report_row.Unit_Code
JOIN tmp_report_skipped_pos_transactions skipped
  ON report_row.token_report <=> skipped.token_report;

DELETE report_row
FROM reports_database.tbl_pos_transactions report_row
JOIN tmp_report_skipped_pos_transactions skipped
  ON report_row.token_report <=> skipped.token_report;

SET @report_txn_base := COALESCE((
    SELECT MIN(CAST(transaction_id AS UNSIGNED))
    FROM reports_database.tbl_pos_transactions
), 0);
SET @report_order_slip_base := COALESCE((
    SELECT MIN(CAST(order_slip_no AS UNSIGNED))
    FROM reports_database.tbl_pos_transactions
    WHERE order_slip_no > 0
), (
    SELECT MIN(CAST(order_slip_no AS UNSIGNED))
    FROM tmp_report_ranked_pos_transactions
    WHERE MOD(transaction_rank, 3) <> 0
      AND order_slip_no > 0
), 0);
SET @report_invoice_base := COALESCE((
    SELECT MIN(CAST(invoice_no AS UNSIGNED))
    FROM reports_database.tbl_pos_transactions
    WHERE invoice_no > 0
), (
    SELECT MIN(CAST(invoice_no AS UNSIGNED))
    FROM tmp_report_ranked_pos_transactions
    WHERE MOD(transaction_rank, 3) <> 0
      AND invoice_no > 0
), 0);
SET @report_row_rank := 0;
SET @report_invoice_rank := 0;

CREATE TEMPORARY TABLE tmp_report_transaction_id_map AS
SELECT
    numbered.token_report,
    numbered.Category_Code,
    numbered.Unit_Code,
    numbered.old_report_transaction_id,
    @report_txn_base + numbered.report_row_rank - 1 AS new_report_transaction_id,
    @report_order_slip_base + numbered.report_row_rank - 1 AS new_report_order_slip_no,
    CASE
        WHEN numbered.source_invoice_no > 0 OR numbered.old_report_invoice_no > 0
            THEN @report_invoice_base + (@report_invoice_rank := @report_invoice_rank + 1) - 1
        ELSE 0
    END AS new_report_invoice_no
FROM (
    SELECT
        posted.token_report,
        posted.Category_Code,
        posted.Unit_Code,
        CAST(posted.invoice_no AS UNSIGNED) AS source_invoice_no,
        CAST(report_row.transaction_id AS UNSIGNED) AS old_report_transaction_id,
        CAST(report_row.invoice_no AS UNSIGNED) AS old_report_invoice_no,
        @report_row_rank := @report_row_rank + 1 AS report_row_rank
    FROM tmp_report_ranked_pos_transactions posted
    JOIN reports_database.tbl_pos_transactions report_row
      ON report_row.token_report <=> posted.token_report
    WHERE MOD(posted.transaction_rank, 3) <> 0
    ORDER BY posted.ID
) numbered
ORDER BY numbered.report_row_rank;

UPDATE reports_database.tbl_pos_transactions_detailed child_row
JOIN tmp_report_transaction_id_map mapped
  ON child_row.transaction_id <=> mapped.old_report_transaction_id
 AND child_row.Category_Code <=> mapped.Category_Code
 AND child_row.Unit_Code <=> mapped.Unit_Code
SET child_row.transaction_id = mapped.new_report_transaction_id;

UPDATE reports_database.tbl_pos_transactions_payments child_row
JOIN tmp_report_transaction_id_map mapped
  ON child_row.transaction_id <=> mapped.old_report_transaction_id
 AND child_row.Category_Code <=> mapped.Category_Code
 AND child_row.Unit_Code <=> mapped.Unit_Code
SET child_row.transaction_id = mapped.new_report_transaction_id;

UPDATE reports_database.tbl_pos_transactions_discounts child_row
JOIN tmp_report_transaction_id_map mapped
  ON child_row.transaction_id <=> mapped.old_report_transaction_id
 AND child_row.Category_Code <=> mapped.Category_Code
 AND child_row.Unit_Code <=> mapped.Unit_Code
SET child_row.transaction_id = mapped.new_report_transaction_id;

UPDATE reports_database.tbl_pos_transactions_other_charges child_row
JOIN tmp_report_transaction_id_map mapped
  ON child_row.transaction_id <=> mapped.old_report_transaction_id
 AND child_row.Category_Code <=> mapped.Category_Code
 AND child_row.Unit_Code <=> mapped.Unit_Code
SET child_row.transaction_id = mapped.new_report_transaction_id;

UPDATE reports_database.tbl_pos_transactions_customers child_row
JOIN tmp_report_transaction_id_map mapped
  ON child_row.transaction_id <=> mapped.old_report_transaction_id
 AND child_row.Category_Code <=> mapped.Category_Code
 AND child_row.Unit_Code <=> mapped.Unit_Code
SET child_row.transaction_id = mapped.new_report_transaction_id;

UPDATE reports_database.tbl_pos_transactions_discounts_per_product child_row
JOIN tmp_report_transaction_id_map mapped
  ON child_row.transaction_id <=> mapped.old_report_transaction_id
 AND child_row.category_code <=> mapped.Category_Code
 AND child_row.unit_code <=> mapped.Unit_Code
SET child_row.transaction_id = mapped.new_report_transaction_id;

UPDATE reports_database.tbl_pos_loyalty_discounts child_row
JOIN tmp_report_transaction_id_map mapped
  ON child_row.transaction_id <=> mapped.old_report_transaction_id
 AND child_row.Category_Code <=> mapped.Category_Code
 AND child_row.Unit_Code <=> mapped.Unit_Code
SET child_row.transaction_id = mapped.new_report_transaction_id;

UPDATE reports_database.tbl_pos_transactions report_row
JOIN tmp_report_transaction_id_map mapped
  ON report_row.token_report <=> mapped.token_report
SET report_row.transaction_id = mapped.new_report_transaction_id,
    report_row.order_slip_no = mapped.new_report_order_slip_no,
    report_row.invoice_no = mapped.new_report_invoice_no;

DROP TEMPORARY TABLE IF EXISTS tmp_report_transaction_id_map;
DROP TEMPORARY TABLE IF EXISTS tmp_report_skipped_pos_transactions;
DROP TEMPORARY TABLE IF EXISTS tmp_report_ranked_pos_transactions;
