ALTER TABLE tbl_pos_transactions_discounts
  ADD COLUMN Category_Code VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL AFTER transaction_id,
  ADD COLUMN Unit_Code VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL AFTER Category_Code;

UPDATE tbl_pos_transactions_discounts d
INNER JOIN tbl_pos_transactions t
  ON t.transaction_id = d.transaction_id
SET
  d.Category_Code = t.Category_Code,
  d.Unit_Code = t.Unit_Code
WHERE (d.Category_Code IS NULL OR d.Category_Code = '')
  AND (d.Unit_Code IS NULL OR d.Unit_Code = '');
