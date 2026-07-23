import { useEffect, useState } from "react";
import useApiHost from "./useApiHost";

const EMPTY_PERMISSIONS = {
  transactions: false,
  x_reading: false,
  z_reading: false,
  create_user: false,
  edit_delete_user: false,
  view_reports: false,
  settings_my_account_only: false,
  open_settings: false,
  open_product_list: false,
  product_syncing: false,
  sales_record_syncing: false,
};

// Reads the logged-in user's saved function permissions
// (backend/api/pos_user_permissions.php, set from PosUserRoles.jsx).
// Missing/unassigned rows default to false (deny), not true -- callers that
// need an "admin always gets through" bypass should check that separately,
// same as PosSettings.jsx's existing UNGATED_USERNAME precedent.
export default function useCurrentUserPermissions() {
  const apiHost = useApiHost();
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const userUuid = localStorage.getItem("user_id") || "";
    if (!apiHost || !userUuid) {
      setIsLoaded(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${apiHost}/api/pos_user_permissions.php?user_uuid=${encodeURIComponent(userUuid)}`,
        );
        const result = await res.json();
        if (!cancelled) {
          setPermissions({
            ...EMPTY_PERMISSIONS,
            ...(result?.data?.permissions || {}),
          });
        }
      } catch (error) {
        // keep defaults (all denied) on failure
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  return { permissions, isLoaded };
}
