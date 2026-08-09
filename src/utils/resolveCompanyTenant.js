const MASTER_RESOLVER_URL =
  import.meta.env.VITE_SALES_SYNC_TENANT_RESOLVER_ENDPOINT || "";

const inFlightTenantRequests = new Map();

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const resolverResponseError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const normalizeHost = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const parseJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) return null;

  if (/sgcaptcha/i.test(text)) {
    throw resolverResponseError(
      "Tenant resolver is blocked by SiteGround CAPTCHA. Exclude /api/mutationgetapiendpoint.php from bot protection.",
      "TEMPORARY_RESOLVER_HTML",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (/text\/html/i.test(contentType) || /^\s*</.test(text)) {
    throw resolverResponseError(
      "Tenant resolver returned HTML instead of JSON. Check the resolver PHP and hosting protection.",
      "TEMPORARY_RESOLVER_HTML",
    );
  }

  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Invalid response from the company resolver.");
  }
};

const requestCompanyTenant = async (code) => {
  const response = await fetch(MASTER_RESOLVER_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companycode: code }),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload?.message || "Unable to resolve the company code.");
  }

  const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const tenant = rows[0] || {};
  const apiEndpoint = normalizeHost(
    tenant.api || tenant.API || tenant.endpoint || "",
  );

  if (!/^https?:\/\//i.test(apiEndpoint)) {
    throw new Error("Company not found.");
  }

  return {
    companyCode: code,
    apiEndpoint,
    raw: tenant,
  };
};

export async function resolveCompanyTenant(companyCode) {
  const code = String(companyCode || "")
    .trim()
    .toUpperCase();

  if (!code) {
    throw new Error("Please enter your company code.");
  }

  if (!MASTER_RESOLVER_URL) {
    throw new Error("Sales-sync company resolver is not configured.");
  }

  if (inFlightTenantRequests.has(code)) {
    return inFlightTenantRequests.get(code);
  }

  const request = (async () => {
    try {
      return await requestCompanyTenant(code);
    } catch (error) {
      if (error?.code !== "TEMPORARY_RESOLVER_HTML") {
        throw error;
      }

      await wait(1500);
      return requestCompanyTenant(code);
    }
  })().finally(() => {
    inFlightTenantRequests.delete(code);
  });

  inFlightTenantRequests.set(code, request);
  return request;
}
