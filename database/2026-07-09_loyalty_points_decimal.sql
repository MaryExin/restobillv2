-- Loyalty points must support fractional values (earning rate can produce
-- amounts like 1.40 pts). Redeeming still happens in whole points (cashier
-- types an integer), but the running balance is a mix of whole redemptions
-- and fractional earnings, so it has to be stored as a decimal, not an INT
-- (which would silently truncate 81.40 down to 81).

ALTER TABLE `lkp_loyalty_cs_name`
  MODIFY COLUMN `loyalty_points` DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Ledger table gets a points_earned column so a reprint of a paid
-- transaction can show the exact points earned at that time, instead of
-- recomputing against whatever the earning rule is set to today.
ALTER TABLE `tbl_pos_loyalty_discounts`
  ADD COLUMN `points_earned` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `points_redeemed`;
