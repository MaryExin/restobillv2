-- Richwell (hotel): show the Billing permission as "Bill / Folio".
-- Room Service orders print as GUEST FOLIO, every other sales type as BILL.
-- Only the display name/description change; permission_key 'billing' stays,
-- so role assignments and access checks are unaffected.
UPDATE tbl_pos_permissions
SET permission_name = 'Bill / Folio',
    description = 'Bill / Folio page.'
WHERE permission_key = 'billing'
  AND permission_name IN ('Billing', 'Folio');
