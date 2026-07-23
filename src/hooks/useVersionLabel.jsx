import { useEffect, useState } from "react";
import useApiHost from "./useApiHost";
import useZustandLayoutMode from "../context/useZustandLayoutMode";

const DEFAULT_VERSIONS = {
  restaurant_version: "1.0.1-1",
  retail_version: "2.0.1-1",
};

// Builds the "Restaurant (Version: x.x.x-x)" / "Retail (Version: x.x.x-x)"
// label shown on login and the POS header. The mode comes from the existing
// layout-mode store; the version numbers come from tbl_pos_settings
// (category "General", description "Restaurant Version" / "Retail Version")
// so neither is hardcoded in the UI.
export default function useVersionLabel() {
  const apiHost = useApiHost();
  const { layoutMode } = useZustandLayoutMode();
  const [versions, setVersions] = useState(DEFAULT_VERSIONS);

  useEffect(() => {
    if (!apiHost) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${apiHost}/api/pos_version_label.php`);
        const result = await res.json();
        if (!cancelled && result?.data) {
          setVersions({
            restaurant_version:
              result.data.restaurant_version || DEFAULT_VERSIONS.restaurant_version,
            retail_version:
              result.data.retail_version || DEFAULT_VERSIONS.retail_version,
          });
        }
      } catch (error) {
        // keep defaults
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  const isRetail = layoutMode === "Restaurant Version 2";
  const modeLabel = isRetail ? "Retail" : "Restaurant";
  const version = isRetail ? versions.retail_version : versions.restaurant_version;

  return `${modeLabel} (Version: ${version})`;
}
