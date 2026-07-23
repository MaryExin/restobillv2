import { useEffect, useState } from "react";
import useApiHost from "./useApiHost";

// Hidden kill-switch: reads the "Enable Billing" flag from tbl_pos_settings.
// There is no Settings UI for this on purpose -- it's flipped directly in
// the database. Defaults to enabled (both while loading and if the fetch
// fails) so a missing row or a network hiccup never hides the feature.
export default function useBillingEnabled() {
  const apiHost = useApiHost();
  const [billingEnabled, setBillingEnabled] = useState(true);

  useEffect(() => {
    if (!apiHost) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${apiHost}/api/pos_billing_settings.php`);
        const result = await res.json();
        if (!cancelled) {
          setBillingEnabled(result?.data?.billing_enabled !== false);
        }
      } catch (error) {
        if (!cancelled) setBillingEnabled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  return billingEnabled;
}
