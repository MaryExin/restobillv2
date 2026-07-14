-- Loyalty Configuration defaults, seeded into the existing dynamic
-- key-value settings table (tbl_pos_settings), same approach already
-- used for Layout Mode / Service Charge / Discount Ceiling.
--
-- Category: "Loyalty"
--   - Loyalty Earning Rule (PHP per Point)      -> pesos spent per 1 point earned
--   - Loyalty Redemption Rule (PHP per Point)   -> peso discount value per 1 point redeemed
--   - Loyalty Minimum Points to Redeem          -> points balance required before redemption is allowed

INSERT INTO `tbl_pos_settings` (`ID`, `category`, `description`, `value`)
SELECT next_id, 'Loyalty', 'Loyalty Earning Rule (PHP per Point)', '100.00'
FROM (
  SELECT COALESCE(MAX(`ID`), 0) + 1 AS next_id FROM `tbl_pos_settings`
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_pos_settings`
  WHERE `category` = 'Loyalty' AND `description` = 'Loyalty Earning Rule (PHP per Point)'
);

INSERT INTO `tbl_pos_settings` (`ID`, `category`, `description`, `value`)
SELECT next_id, 'Loyalty', 'Loyalty Redemption Rule (PHP per Point)', '1.00'
FROM (
  SELECT COALESCE(MAX(`ID`), 0) + 1 AS next_id FROM `tbl_pos_settings`
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_pos_settings`
  WHERE `category` = 'Loyalty' AND `description` = 'Loyalty Redemption Rule (PHP per Point)'
);

INSERT INTO `tbl_pos_settings` (`ID`, `category`, `description`, `value`)
SELECT next_id, 'Loyalty', 'Loyalty Minimum Points to Redeem', '50'
FROM (
  SELECT COALESCE(MAX(`ID`), 0) + 1 AS next_id FROM `tbl_pos_settings`
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_pos_settings`
  WHERE `category` = 'Loyalty' AND `description` = 'Loyalty Minimum Points to Redeem'
);
