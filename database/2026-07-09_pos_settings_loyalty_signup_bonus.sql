-- Loyalty Signup Bonus Points: points a customer starts with upon registration.
-- Same dynamic key-value approach as the other Loyalty settings.

INSERT INTO `tbl_pos_settings` (`ID`, `category`, `description`, `value`)
SELECT next_id, 'Loyalty', 'Loyalty Signup Bonus Points', '0.00'
FROM (
  SELECT COALESCE(MAX(`ID`), 0) + 1 AS next_id FROM `tbl_pos_settings`
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_pos_settings`
  WHERE `category` = 'Loyalty' AND `description` = 'Loyalty Signup Bonus Points'
);
