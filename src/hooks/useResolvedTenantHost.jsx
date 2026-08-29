import { useCallback, useEffect, useState } from "react";
import { resolveCompanyTenant } from "../utils/resolveCompanyTenant";
import { parseIpConfigText } from "../utils/parseIpConfig";

const normalizeCompanyCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const readConfiguredTenantCode = async () => {
  if (window.appConfig?.getSalesSyncTenant) {
    try {
      const electronTenant = normalizeCompanyCode(
        await window.appConfig.getSalesSyncTenant(),
      );

      if (electronTenant) {
        return electronTenant;
      }
    } catch (error) {
      console.warn("Unable to read TENANT through Electron IPC:", error);
    }
  }

  const ipConfigUrl = new URL("./ip.txt", window.location.href);
  const response = await fetch(ipConfigUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to read ip.txt.");
  }

  const config = parseIpConfigText(await response.text());
  return normalizeCompanyCode(config.TENANT || "");
};

// Resolves the WEB API host by looking up the TENANT (from ip.txt) against
// the master tenant registry, instead of relying on a static WEB: line in
// ip.txt. Mirrors the resolution used by SyncOfflineSalesToWeb.jsx.
export default function useResolvedTenantHost() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [companyCode, setCompanyCode] = useState("");
  const [resolvedCompanyCode, setResolvedCompanyCode] = useState("");
  const [webApiHost, setWebApiHost] = useState("");
  const [isResolvingTenant, setIsResolvingTenant] = useState(false);
  const [tenantError, setTenantError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveConfiguredTenant = async () => {
      setIsResolvingTenant(true);
      setTenantError("");
      setCompanyCode("");
      setResolvedCompanyCode("");
      setWebApiHost("");

      try {
        const configuredCompanyCode = await readConfiguredTenantCode();

        if (!configuredCompanyCode) {
          throw new Error("TENANT is missing from ip.txt.");
        }

        if (cancelled) return;

        setCompanyCode(configuredCompanyCode);

        if (!isOnline) {
          throw new Error(
            "Connect to the internet to resolve the TENANT from ip.txt.",
          );
        }

        const resolvedTenant = await resolveCompanyTenant(
          configuredCompanyCode,
        );

        if (cancelled) return;

        setResolvedCompanyCode(resolvedTenant.companyCode);
        setWebApiHost(resolvedTenant.apiEndpoint);
      } catch (error) {
        if (!cancelled) {
          setTenantError(
            error?.message || "Unable to resolve the TENANT from ip.txt.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsResolvingTenant(false);
        }
      }
    };

    void resolveConfiguredTenant();

    return () => {
      cancelled = true;
    };
  }, [isOnline, reloadKey]);

  const reloadTenant = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  const isTenantResolved = Boolean(webApiHost && resolvedCompanyCode);

  return {
    isOnline,
    companyCode,
    resolvedCompanyCode,
    webApiHost,
    isResolvingTenant,
    tenantError,
    isTenantResolved,
    reloadTenant,
  };
}
