ALTER TABLE tbl_pos_transactions_discounts
  ADD COLUMN vat_exemption DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER discount_amount;
