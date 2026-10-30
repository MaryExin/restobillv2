-- Preserve per-product instructions, including paired pizza flavor notes.
-- Apply once to each POS database that saves orders. Existing rows stay NULL.
ALTER TABLE tbl_pos_transactions_detailed
  ADD COLUMN item_instruction TEXT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci NULL AFTER order_status;
