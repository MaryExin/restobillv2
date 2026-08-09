import {
  normalizePosRoleAccessConfig,
  POS_ROLE_ACCESS_SETTINGS_PATH,
  storePosRoleAccessConfig,
} from "./posRoleAccessConfig";

const DEFAULT_TIMEOUT_MS = 10_000;

export class PosRoleAccessRequestError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "PosRoleAccessRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export const normalizePosApiHost = (value) => {
  let host = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");

  // public/ip.txt in this project historically used `http:\\localhost`.
  host = host.replace(/^(https?):\/(?!\/)/i, "$1://");
  return host;
};

export const buildPosRoleAccessUrl = (apiHost) => {
  const host = normalizePosApiHost(
    apiHost ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("apiendpoint")
        : ""),
  );
  if (!host) return POS_ROLE_ACCESS_SETTINGS_PATH;
  return `${host}${POS_ROLE_ACCESS_SETTINGS_PATH}`;
};

export const securedPosFetch = (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("access_token")
      : "";
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
};

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const roleConfigFromPayload = (payload) => {
  const candidate = payload?.data || payload;
  return Array.isArray(candidate?.roles)
    ? normalizePosRoleAccessConfig(candidate)
    : null;
};

export const posRoleAccessRequest = async (
  apiHost,
  { method = "GET", body, signal, timeout = DEFAULT_TIMEOUT_MS } = {},
) => {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abortFromCaller();
    else signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = window.setTimeout(() => controller.abort(), timeout);
  try {
    const token = window.localStorage.getItem("access_token") || "";
    const headers = new Headers({ Accept: "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(buildPosRoleAccessUrl(apiHost), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await parseResponse(response);

    if (!response.ok || payload?.success === false) {
      throw new PosRoleAccessRequestError(
        payload?.message || `Role access request failed (${response.status}).`,
        response.status,
        payload,
      );
    }

    const currentRoleValue = payload?.data?.current_role_value;
    if (currentRoleValue !== undefined && currentRoleValue !== null) {
      const normalizedRoleValue = String(currentRoleValue).trim();
      if (
        normalizedRoleValue &&
        window.localStorage.getItem("user_classification") !==
          normalizedRoleValue
      ) {
        window.localStorage.setItem(
          "user_classification",
          normalizedRoleValue,
        );
        window.dispatchEvent(new Event("storage"));
      }
    }

    const normalized = roleConfigFromPayload(payload);
    if (normalized) {
      // Guard helpers read synchronously from this normalized cache. Keeping
      // this write in the fetch layer prevents a direct GET/POST from updating
      // the manager while leaving route/settings guards on stale permissions.
      storePosRoleAccessConfig(normalized, normalizePosApiHost(apiHost));
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new PosRoleAccessRequestError(
        signal?.aborted
          ? "Role access request was cancelled."
          : "Role access request timed out.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
};

export const fetchPosRoleAccessConfig = async (apiHost, options = {}) => {
  const payload = await posRoleAccessRequest(apiHost, {
    ...options,
    method: "GET",
  });
  return normalizePosRoleAccessConfig(payload?.data || payload);
};

export const savePosRoleAccessConfig = async (
  apiHost,
  config,
  options = {},
) => {
  const normalized = normalizePosRoleAccessConfig(config);
  const payload = await posRoleAccessRequest(apiHost, {
    ...options,
    method: "POST",
    body: { config: normalized },
  });
  return normalizePosRoleAccessConfig(payload?.data || normalized);
};
