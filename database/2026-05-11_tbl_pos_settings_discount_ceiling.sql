INSERT INTO tbl_pos_settings (ID, category, description, `value`)
SELECT
    next_id.ID,
    'Discount',
    'Discount Ceiling Amount',
    '0.00'
FROM (
    SELECT COALESCE(MAX(ID), 0) + 1 AS ID
    FROM tbl_pos_settings
) next_id
WHERE NOT EXISTS (
    SELECT 1
    FROM tbl_pos_settings existing
    WHERE existing.category = 'Discount'
      AND existing.description = 'Discount Ceiling Amount'
);
