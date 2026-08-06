-- Adds the configurable report database transaction skip interval.
-- 0 disables skipping. Values 2 and above skip every Nth source transaction.
-- If this installation uses a different archive database name, replace
-- reports_database below with the configured report_db name.

INSERT INTO reports_database.tbl_pos_settings (ID, category, description, `value`)
SELECT
    seed.next_id,
    _latin1'Report' COLLATE latin1_swedish_ci,
    _latin1'Report DB Skip Transaction Interval' COLLATE latin1_swedish_ci,
    _latin1'3' COLLATE latin1_swedish_ci
FROM (
    SELECT COALESCE(MAX(ID), 0) + 1 AS next_id
    FROM reports_database.tbl_pos_settings
) seed
WHERE NOT EXISTS (
    SELECT 1
    FROM reports_database.tbl_pos_settings
    WHERE category = _latin1'Report' COLLATE latin1_swedish_ci
      AND description = _latin1'Report DB Skip Transaction Interval' COLLATE latin1_swedish_ci
);
