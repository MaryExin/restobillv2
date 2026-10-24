const fs = require("node:fs");

const STANDALONE_PACKAGE_NAME = "lightem_pos_standalone";

function configuredOrigin(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return "";
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) return "";
    return url.origin;
  } catch { return ""; }
}

function readStandaloneRoutingConfig({ isPackaged, platform, packageName, metadataPath, getLocalOrigin }) {
  if (!isPackaged || !["win32", "darwin"].includes(platform)) return { enabled: false };
  const standaloneIdentity = packageName === STANDALONE_PACKAGE_NAME;
  let metadata;
  try { metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")); }
  catch {
    return standaloneIdentity
      ? { enabled: true, origin: "", error: "Standalone release information is unavailable. Repair this installation before connecting." }
      : { enabled: false };
  }
  if (metadata?.runtimeKind !== "standalone") {
    return standaloneIdentity
      ? { enabled: true, origin: "", error: "Standalone release information is invalid. Repair this installation before connecting." }
      : { enabled: false };
  }
  if (metadata.platform !== platform) {
    return { enabled: true, origin: "", error: "Standalone release information belongs to a different platform." };
  }
  let origin = "";
  try { origin = configuredOrigin(getLocalOrigin()); } catch { /* Fail closed below. */ }
  return origin
    ? { enabled: true, origin }
    : { enabled: true, origin: "", error: "The standalone LOCAL server address is missing or invalid. Repair resources/ip.txt before connecting." };
}

function addConfiguredOriginToCsp(csp, config) {
  const origin = config?.enabled && configuredOrigin(config.origin);
  if (!origin) return csp;
  let result = csp;
  for (const directive of ["img-src", "connect-src"]) {
    const pattern = new RegExp(`(^|;)\\s*${directive}\\s+([^;]*)`, "i");
    if (pattern.test(result)) {
      result = result.replace(pattern, (match, prefix, sources) =>
        sources.trim().split(/\s+/).includes(origin) ? match : `${prefix} ${directive} ${sources.trim()} ${origin}`);
    } else result += `; ${directive} 'self' ${origin}`;
  }
  return result;
}

module.exports = { configuredOrigin, readStandaloneRoutingConfig, addConfiguredOriginToCsp };
