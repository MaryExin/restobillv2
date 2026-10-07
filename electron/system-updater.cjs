// Full-system releases run the setup package so the desktop app and PHP backend
// move together. Never use a desktop-only updater for these releases.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REMIND_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_INSTALLER_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;

function httpsUrl(value) {
  if (typeof value !== "string") throw new Error("The update URL is missing.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("The update URL is invalid.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new Error("Update URLs must use HTTPS without credentials or fragments.");
  }
  return parsed;
}

function buildNumber(value) {
  const text = String(value);
  if ((typeof value === "number" && !Number.isSafeInteger(value)) ||
      !/^[1-9]\d{0,19}$/.test(text)) {
    throw new Error("The release build ID must be a positive integer.");
  }
  return BigInt(text);
}

function versionParts(value) {
  if (typeof value !== "string" || !/^\d{1,9}\.\d{1,9}\.\d{1,9}$/.test(value)) {
    throw new Error("The release version must use major.minor.patch format.");
  }
  return value.split(".").map(Number);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

function validateIdentity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Release information is missing.");
  }
  versionParts(value.version);
  buildNumber(value.buildId);
  if (value.runtimeKind !== undefined && !['standalone','xampp'].includes(value.runtimeKind)) {
    throw new Error('The release runtime type is unsupported.');
  }
  if (!["win32", "darwin"].includes(value.platform) ||
      !["x64", "arm64", "universal"].includes(value.arch) ||
      (value.platform === "win32" && value.arch !== "x64")) {
    throw new Error("The release platform or architecture is unsupported.");
  }
  return value;
}

function validateLocalRelease(value, platform = process.platform, arch = process.arch) {
  validateIdentity(value);
  if (value.platform !== platform ||
      (value.arch !== arch && !(platform === "darwin" && value.arch === "universal"))) {
    throw new Error("Installed release information does not match this device.");
  }
  if (value.updateUrl) httpsUrl(value.updateUrl);
  return value;
}

function validateRelease(value) {
  validateIdentity(value);
  const url = httpsUrl(value.url);
  const extension = value.platform === "darwin" ? ".pkg" : ".exe";
  if (!url.pathname.toLowerCase().endsWith(extension)) {
    throw new Error("The update must point to a full-system setup package.");
  }
  if (!/^[a-fA-F0-9]{64}$/.test(value.sha256 || "")) {
    throw new Error("The update checksum is missing or invalid.");
  }
  if (!Number.isSafeInteger(value.size) || value.size <= 0 || value.size > MAX_INSTALLER_BYTES) {
    throw new Error("The update package size is invalid.");
  }
  return value;
}

function selectRelease(manifest, local, platform = process.platform, arch = process.arch) {
  validateLocalRelease(local, platform, arch);
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.releases) ||
      manifest.releases.length > 100) {
    throw new Error("The update feed format is invalid.");
  }
  const candidates = manifest.releases.map(validateRelease).filter((release) =>
    release.platform === platform &&
    (release.runtimeKind || 'xampp') === (local.runtimeKind || 'xampp') &&
    (release.arch === arch || (platform === "darwin" && release.arch === "universal")) &&
    buildNumber(release.buildId) > buildNumber(local.buildId) &&
    compareVersions(release.version, local.version) >= 0
  );
  candidates.sort((a, b) => {
    const byVersion = compareVersions(b.version, a.version);
    if (byVersion) return byVersion;
    const aBuild = buildNumber(a.buildId);
    const bBuild = buildNumber(b.buildId);
    if (aBuild !== bBuild) return bBuild > aBuild ? 1 : -1;
    return Number(b.arch === arch) - Number(a.arch === arch);
  });
  return candidates[0] || null;
}

function openHttpsResponse(url, { request = https.get, redirects = 0 } = {}) {
  const parsed = httpsUrl(String(url));
  return new Promise((resolve, reject) => {
    let timeout;
    const req = request(parsed, { headers: { "User-Agent": "Lightem-System-Updater/1", "Accept-Encoding": "identity" } }, (response) => {
      response.on("error", reject);
      response.once("close", () => clearTimeout(timeout));
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= 5 || !response.headers.location) {
          reject(new Error("The update server redirected too many times."));
          return;
        }
        try {
          const redirected = httpsUrl(new URL(response.headers.location, parsed).href);
          resolve(openHttpsResponse(redirected, { request, redirects: redirects + 1 }));
        } catch (error) {
          reject(error);
        }
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`The update server returned HTTP ${response.statusCode}.`));
        return;
      }
      if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
        response.resume();
        reject(new Error("The update server must provide uncompressed package bytes."));
        return;
      }
      resolve(response);
    });
    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error("The update request timed out.")));
    // Also bound servers that keep a connection alive with occasional bytes.
    timeout = setTimeout(() => req.destroy(new Error("The update download timed out.")), 60 * 60 * 1000);
    timeout.unref?.();
    req.once("error", () => clearTimeout(timeout));
  });
}

async function fetchManifest(url, { openStream = openHttpsResponse } = {}) {
  httpsUrl(url);
  const response = await openStream(url);
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response) {
      size += chunk.length;
      if (size > MAX_MANIFEST_BYTES) throw new Error("The update feed is too large.");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    response.destroy();
    throw error;
  }
}

async function verifyFile(filename, release) {
  const stat = await fsp.lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== release.size) return false;
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex") === release.sha256.toLowerCase();
}

async function downloadRelease(release, directory, { openStream = openHttpsResponse, onProgress = () => {} } = {}) {
  validateRelease(release);
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  const extension = release.platform === "darwin" ? ".pkg" : ".exe";
  const filename = path.join(directory, `lightem-system-${buildNumber(release.buildId)}-${release.arch}${extension}`);
  try {
    if (await verifyFile(filename, release)) return filename;
    await fsp.unlink(filename);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const partial = `${filename}.${crypto.randomBytes(8).toString("hex")}.partial`;
  let response;
  try {
    response = await openStream(release.url);
    const declaredLength = response.headers?.["content-length"];
    if (declaredLength !== undefined && (!/^\d+$/.test(String(declaredLength)) || Number(declaredLength) !== release.size)) {
      throw new Error("The update package size does not match its release information.");
    }
    const hash = crypto.createHash("sha256");
    let received = 0;
    const verifier = new Transform({
      transform(chunk, encoding, callback) {
        received += chunk.length;
        if (received > release.size) {
          callback(new Error("The update download exceeded its expected size."));
          return;
        }
        hash.update(chunk);
        onProgress(received / release.size);
        callback(null, chunk);
      },
    });
    await pipeline(response, verifier, fs.createWriteStream(partial, { flags: "wx", mode: 0o600 }));
    if (received !== release.size || hash.digest("hex") !== release.sha256.toLowerCase()) {
      throw new Error("The update package failed its integrity check. Download it again.");
    }
    await fsp.rename(partial, filename);
    return filename;
  } catch (error) {
    response?.destroy();
    await fsp.rm(partial, { force: true });
    throw error;
  }
}

function registerSystemUpdater({ app, dialog, shell, BrowserWindow,
  metadataPath = path.join(process.resourcesPath || "", "system-release.json"),
  platform = process.platform, arch = process.arch, openStream = openHttpsResponse,
}) {
  let busy = false;
  let disposed = false;
  let declinedBuild = "";
  let declinedAt = 0;
  const title = "Lightem Pos Updates";
  function progress(value) {
    for (const window of BrowserWindow?.getAllWindows() || []) {
      if (!window.isDestroyed()) window.setProgressBar(value);
    }
  }
  function show(options) {
    return dialog.showMessageBox({ title, ...options });
  }
  async function check({ interactive = false } = {}) {
    if (disposed) return;
    if (busy) {
      if (interactive) await show({ type: "info", message: "An update check or download is already in progress." });
      return;
    }
    busy = true;
    let showErrors = interactive;
    try {
      let local;
      try {
        local = validateLocalRelease(JSON.parse(await fsp.readFile(metadataPath, "utf8")), platform, arch);
      } catch {
        if (interactive) await show({ type: "info", message: "This installation has no valid system release information.", detail: "Install the current full-system setup package to enable online updates." });
        return;
      }
      if (!local.updateUrl) {
        if (interactive) await show({ type: "info", message: "Online updates have not been configured.", detail: "A release server URL must be included when building the full-system installer." });
        return;
      }
      const release = selectRelease(await fetchManifest(local.updateUrl, { openStream }), local, platform, arch);
      if (!release) {
        if (interactive) await show({ type: "info", message: "Your system is up to date.", detail: `Version ${local.version} · Build ${local.buildId}` });
        return;
      }
      const releaseKey = `${release.version}:${release.buildId}`;
      if (!interactive && declinedBuild === releaseKey && Date.now() - declinedAt < REMIND_INTERVAL_MS) return;
      const notes = typeof release.notes === "string" ? release.notes.slice(0, 3000) : "";
      const answer = await show({
        type: "info", message: `Lightem Pos ${release.version} is available.`,
        detail: `Installed build: ${local.buildId}\nNew build: ${release.buildId}\n\nThis setup updates the desktop application and backend together.${notes ? `\n\n${notes}` : ""}`,
        buttons: ["Download Update", "Later"], defaultId: 0, cancelId: 1,
      });
      declinedBuild = releaseKey;
      declinedAt = Date.now();
      if (answer.response !== 0 || disposed) return;
      showErrors = true;
      progress(0);
      const filename = await downloadRelease(release, path.join(app.getPath("userData"), "system-updates"), { openStream, onProgress: progress });
      progress(-1);
      if (disposed) return;
      const install = await show({
        type: "question", message: "The system update is ready to install.",
        detail: "Finish any active sale before continuing. Lightem Pos will close and the system installer will open. Follow the installer to update the application and backend.",
        buttons: ["Install and Close App", "Later"], defaultId: 1, cancelId: 1,
      });
      if (install.response !== 0 || disposed) return;
      // Recheck the cached bytes immediately before handing them to the OS.
      if (!await verifyFile(filename, release)) throw new Error("The downloaded update has changed. Check for updates to download it again.");
      const launchError = await shell.openPath(filename);
      if (launchError) throw new Error(`The system installer could not open: ${launchError}`);
      app.quit();
    } catch (error) {
      if (showErrors && !disposed) await show({ type: "error", message: "The system update could not be completed.", detail: error.message });
      else console.warn("System update check failed:", error.message);
    } finally {
      progress(-1);
      busy = false;
    }
  }
  const timer = setInterval(() => { void check(); }, CHECK_INTERVAL_MS);
  timer.unref?.();
  function dispose() {
    disposed = true;
    clearInterval(timer);
    progress(-1);
  }
  app.once("before-quit", dispose);
  return { check, dispose };
}

module.exports = {
  registerSystemUpdater,
  compareVersions,
  validateLocalRelease,
  validateRelease,
  selectRelease,
  fetchManifest,
  openHttpsResponse,
  downloadRelease,
};
