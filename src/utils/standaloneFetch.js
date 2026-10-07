// Resolve legacy localhost URLs before fetch creates a network request. An
// HTTP redirect would strip Authorization when changing the server's port.
const isDefaultLoopback = (value) => {
  if (typeof value !== "string" || !/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::80)?(?:[/?#]|$)/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && !url.port && !url.username && !url.password &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch { return false; }
};

export function resolveStandaloneRequestUrl(value, config) {
  if (!isDefaultLoopback(value)) return value;
  if (!config || typeof config.enabled !== "boolean") {
    throw new Error("Standalone server routing could not be read. No request was sent.");
  }
  if (!config.enabled) return value;
  let target;
  try {
    if (typeof config.origin !== "string" || !/^https?:\/\//i.test(config.origin)) throw new Error();
    target = new URL(config.origin);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password ||
        target.pathname !== "/" || target.search || target.hash) throw new Error();
  } catch {
    throw new Error(config.error || "The standalone server address is missing or invalid. No request was sent.");
  }
  const source = new URL(value);
  return target.origin + source.pathname + source.search + source.hash;
}

export function createStandaloneFetch({ fetchImpl, getConfig }) {
  return async (input, options) => {
    const value = typeof input === "string" ? input : input?.url || String(input);
    if (!isDefaultLoopback(value)) return fetchImpl(input, options);
    const target = resolveStandaloneRequestUrl(value, await getConfig());
    if (target === value) return fetchImpl(input, options);
    const request = typeof Request !== "undefined" && input instanceof Request
      ? new Request(target, input)
      : target;
    return fetchImpl(request, options);
  };
}

export async function readStandaloneRoutingConfig({
  bridge = typeof window !== "undefined" ? window.appConfig : undefined,
  documentRef = typeof document !== "undefined" ? document : undefined,
} = {}) {
  const runtime = documentRef?.querySelector?.('meta[name="lightem-runtime"]')?.getAttribute("content");
  const standalone = ["windows-standalone", "macos-standalone"].includes(runtime);
  if (typeof bridge?.getStandaloneBackend !== "function") {
    if (standalone) throw new Error("The standalone server connection is unavailable. Repair this installation before connecting.");
    return { enabled: false };
  }
  const config = await bridge.getStandaloneBackend();
  if (standalone && config?.enabled !== true) {
    throw new Error("The standalone server connection could not be verified. No request was sent.");
  }
  return config;
}

export const standaloneFetch = createStandaloneFetch({
  fetchImpl: (input, options) => fetch(input, options),
  getConfig: () => readStandaloneRoutingConfig(),
});
