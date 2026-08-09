import { useEffect, useMemo, useState } from "react";
import useApiHost from "./useApiHost";
import useZustandLoginCred from "../context/useZustandLoginCred";
import {
  getActivePosRoleOptions,
  getStoredPosRoleAccessConfig,
  POS_ROLE_ACCESS_CHANGE_EVENT,
} from "../utils/posRoleAccessConfig";
import {
  fetchPosRoleAccessConfig,
  normalizePosApiHost,
} from "../utils/posRoleFetch";
import {
  getPosDeveloperSessionExpiry,
  isPosDeveloperSession,
} from "../utils/posRoleAccess";

const ROLE_ACCESS_HYDRATION_TTL_MS = 60 * 1000;
const roleAccessHydrationByHost = new Map();

export const hydratePosRoleAccessForHost = (apiHost, { force = false } = {}) => {
  const host = normalizePosApiHost(apiHost);
  if (!host) return Promise.resolve(getStoredPosRoleAccessConfig());

  const now = Date.now();
  const existing = roleAccessHydrationByHost.get(host);
  if (existing?.promise) return existing.promise;
  if (
    !force &&
    existing?.loadedAt &&
    now - existing.loadedAt < ROLE_ACCESS_HYDRATION_TTL_MS
  ) {
    return Promise.resolve(getStoredPosRoleAccessConfig(host));
  }

  const promise = fetchPosRoleAccessConfig(host)
    .then((config) => {
      roleAccessHydrationByHost.set(host, {
        loadedAt: Date.now(),
        promise: null,
      });
      return config;
    })
    .catch((error) => {
      roleAccessHydrationByHost.set(host, {
        loadedAt: 0,
        promise: null,
      });
      throw error;
    });

  roleAccessHydrationByHost.set(host, {
    loadedAt: existing?.loadedAt || 0,
    promise,
  });
  return promise;
};

export const usePosRoleAccessVersion = () => {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);
    window.addEventListener(POS_ROLE_ACCESS_CHANGE_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(POS_ROLE_ACCESS_CHANGE_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  return version;
};

export const usePosDeveloperSession = () => {
  const [, setVersion] = useState(0);
  const expiresAt = getPosDeveloperSessionExpiry();

  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  useEffect(() => {
    if (!expiresAt) return undefined;

    const remainingMs = expiresAt * 1000 - Date.now();
    if (remainingMs <= 0) return undefined;

    const timeoutId = window.setTimeout(
      () => setVersion((value) => value + 1),
      remainingMs + 25,
    );
    return () => window.clearTimeout(timeoutId);
  }, [expiresAt]);

  return isPosDeveloperSession();
};

export const usePosRoleAccessConfig = () => {
  usePosRoleAccessVersion();
  return getStoredPosRoleAccessConfig();
};

export const usePosRoleOptions = () => {
  const apiHost = useApiHost();
  const config = usePosRoleAccessConfig();

  useEffect(() => {
    if (!apiHost) return undefined;
    let cancelled = false;

    hydratePosRoleAccessForHost(apiHost).catch(() => {
      if (cancelled) return;
      // Normalized cached/default roles remain available while offline.
    });

    return () => {
      cancelled = true;
    };
  }, [apiHost]);

  return useMemo(() => getActivePosRoleOptions(config), [config]);
};

export const useHydratePosRoleAccessSettings = () => {
  const apiHost = useApiHost();
  const { isAuthenticated } = useZustandLoginCred();

  useEffect(() => {
    const hasStoredSession = Boolean(localStorage.getItem("access_token"));
    if ((!isAuthenticated && !hasStoredSession) || !apiHost) return undefined;

    let cancelled = false;
    const refresh = (force = false) => {
      hydratePosRoleAccessForHost(apiHost, { force }).catch(() => {
        if (cancelled) return;
        // The last normalized cache remains available while temporarily offline.
      });
    };

    const handleFocus = () => refresh(true);
    refresh();
    window.addEventListener("focus", handleFocus);
    const intervalId = window.setInterval(() => refresh(true), 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(intervalId);
    };
  }, [apiHost, isAuthenticated]);
};
