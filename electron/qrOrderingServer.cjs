const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf",
};

function normalizeConfig(input) {
  if (!input || typeof input !== "object") throw new Error("QR host settings are required.");
  let api;
  try { api = new URL(String(input.apiUrl || "")); } catch {
    throw new Error("Select a valid QR ordering API URL.");
  }
  if (!["http:", "https:"].includes(api.protocol) || api.username || api.password || api.hash || api.search || !api.pathname.endsWith("/qr-ordering.php")) {
    throw new Error("The QR API URL must end in /qr-ordering.php.");
  }
  const hostToken = String(input.hostToken || "").trim();
  const categoryCode = String(input.categoryCode || "").trim();
  const unitCode = String(input.unitCode || "").trim();
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(hostToken)) throw new Error("The QR host token is invalid. Run setup again.");
  if (!categoryCode || !unitCode || categoryCode.length > 150 || unitCode.length > 150) {
    throw new Error("Select the business category and business unit before enabling QR orders.");
  }
  return { apiUrl: api.href, hostToken, categoryCode, unitCode, businessName: String(input.businessName || "").trim().slice(0, 200) };
}

function ipv4Addresses(interfaces = os.networkInterfaces()) {
  return [...new Set(Object.values(interfaces).flat().filter((entry) =>
    entry && !entry.internal && (entry.family === "IPv4" || entry.family === 4)
  ).map((entry) => entry.address))];
}

function isLocalClient(address = "") {
  if (address === "::1") return true;
  const value = address.replace(/^::ffff:/, "");
  const parts = value.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (parts[0] === 127 || parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 169 && parts[1] === 254));
}

class QrOrderingServer {
  constructor({ distDirectory, configPath, port = DEFAULT_PORT, networkInterfaces = os.networkInterfaces } = {}) {
    this.distDirectory = path.resolve(distDirectory);
    this.configPath = configPath;
    this.port = port;
    this.networkInterfaces = networkInterfaces;
    this.server = null;
    this.startPromise = null;
    this.config = null;
    this.error = "";
    this.rateLimits = new Map();
    if (configPath && fs.existsSync(configPath)) {
      try { this.config = normalizeConfig(JSON.parse(fs.readFileSync(configPath, "utf8"))); }
      catch { this.error = "Saved QR host settings could not be loaded. Run QR setup again."; }
    }
  }

  status() {
    const running = Boolean(this.server?.listening);
    const port = this.server?.address()?.port || this.port;
    const assetsReady = fs.existsSync(path.join(this.distDirectory, "index.html"));
    return {
      running, configured: Boolean(this.config), assetsReady, port,
      urls: running ? ipv4Addresses(this.networkInterfaces()).map((ip) => `http://${ip}:${port}/#/qr-order`) : [],
      loopbackUrl: running ? `http://127.0.0.1:${port}/#/qr-order` : "",
      businessName: this.config?.businessName || "", categoryCode: this.config?.categoryCode || "",
      unitCode: this.config?.unitCode || "",
      error: this.error || (!assetsReady ? "Build the app with npm run build before opening QR ordering." : ""),
    };
  }

  async configure(input) {
    const config = normalizeConfig(input);
    if (this.configPath) {
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true, mode: 0o700 });
      const temporaryPath = `${this.configPath}.tmp`;
      try {
        fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), { mode: 0o600 });
        fs.renameSync(temporaryPath, this.configPath);
      } catch {
        try { fs.unlinkSync(temporaryPath); } catch { /* The temporary file may not exist. */ }
        throw new Error("QR settings could not be saved on this computer.");
      }
    }
    this.config = config;
    this.error = "";
    return this.start();
  }

  async start() {
    if (this.server?.listening) return this.status();
    if (this.startPromise) return this.startPromise;
    this.startPromise = new Promise((resolve) => {
      const server = http.createServer((request, response) => {
        this.handle(request, response).catch(() => {
          if (!response.headersSent) this.json(response, 500, { success: false, message: "QR ordering could not process this request." });
          else response.destroy();
        });
      });
      this.server = server;
      server.requestTimeout = 20000;
      server.headersTimeout = 10000;
      server.keepAliveTimeout = 5000;
      server.on("upgrade", (_request, socket) => socket.destroy());
      server.on("error", (error) => {
        this.error = error.code === "EADDRINUSE"
          ? `Port ${this.port} is in use. Close the other QR server, then retry setup.`
          : "The QR server could not start. Check this computer's network permissions.";
        resolve(this.status());
      });
      server.listen(this.port, "0.0.0.0", () => resolve(this.status()));
    }).finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  async stop() {
    const server = this.server;
    this.server = null;
    this.rateLimits.clear();
    if (server) {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections?.();
      });
    }
    return this.status();
  }

  json(response, code, body) {
    response.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(JSON.stringify(body));
  }

  allowedRequest(request) {
    if (!isLocalClient(request.socket.remoteAddress)) return false;
    const port = this.server.address().port;
    const hosts = ["localhost", "127.0.0.1", ...ipv4Addresses(this.networkInterfaces())].map((host) => `${host}:${port}`);
    if (!hosts.includes(request.headers.host)) return false;
    return !request.headers.origin || request.headers.origin === `http://${request.headers.host}`;
  }

  rateLimited(request, action) {
    const now = Date.now();
    for (const [key, value] of this.rateLimits) if (value.expires <= now) this.rateLimits.delete(key);
    const key = `${request.socket.remoteAddress}:${action === "submit" ? "submit" : "read"}`;
    const current = this.rateLimits.get(key) || { count: 0, expires: now + 60000 };
    if (this.rateLimits.size >= 2000 && !this.rateLimits.has(key)) return true;
    this.rateLimits.set(key, current);
    return ++current.count > (action === "submit" ? 20 : 180);
  }

  async readJson(request) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] || "")) {
      throw Object.assign(new Error("Send orders as JSON."), { status: 415 });
    }
    if (Number(request.headers["content-length"]) > MAX_BODY_BYTES) {
      request.resume();
      throw Object.assign(new Error("This order is too large."), { status: 413 });
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw Object.assign(new Error("This order is too large."), { status: 413 });
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch {
      throw Object.assign(new Error("The order JSON is invalid."), { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw Object.assign(new Error("The order must be a JSON object."), { status: 400 });
    }
    return body;
  }

  async proxy(request, response, action, incomingUrl) {
    if (!this.config) return this.json(response, 503, { success: false, message: "QR ordering is not set up yet. Please ask the cashier." });
    if (this.rateLimited(request, action)) return this.json(response, 429, { success: false, message: "Too many requests. Please wait a minute and try again." });
    const config = this.config;
    const upstream = new URL(config.apiUrl);
    const scoped = { action, category_code: config.categoryCode, unit_code: config.unitCode };
    let body;
    if (action === "submit") {
      try { body = JSON.stringify({ ...await this.readJson(request), ...scoped }); }
      catch (error) { return this.json(response, error.status || 400, { success: false, message: error.message }); }
    } else {
      for (const key of action === "menu"
        ? ["order_type", "continuation_order_id", "continuation_tracking_token"]
        : ["order_id", "tracking_token"]) {
        if (incomingUrl.searchParams.has(key)) upstream.searchParams.set(key, incomingUrl.searchParams.get(key));
      }
    }
    for (const [key, value] of Object.entries(scoped)) upstream.searchParams.set(key, value);
    await new Promise((resolve) => {
      const client = upstream.protocol === "https:" ? https : http;
      const outgoing = client.request(upstream, {
        method: action === "submit" ? "POST" : "GET",
        headers: { Accept: "application/json", "X-QR-Host-Token": config.hostToken,
          ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}) },
        timeout: 15000,
      }, (upstreamResponse) => {
        const chunks = [];
        let size = 0;
        upstreamResponse.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) outgoing.destroy(new Error("Response too large"));
          else chunks.push(chunk);
        });
        upstreamResponse.on("error", () => outgoing.destroy(new Error("Response unavailable")));
        upstreamResponse.on("end", () => {
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            // Public PHP actions return JSON only; never forward upstream headers/cookies or redirects.
            this.json(response, upstreamResponse.statusCode >= 200 && upstreamResponse.statusCode < 600 ? upstreamResponse.statusCode : 502, payload);
          } catch {
            this.json(response, 502, { success: false, message: "The POS database service returned an invalid response. Please ask the cashier." });
          }
          resolve();
        });
      });
      outgoing.on("timeout", () => outgoing.destroy(new Error("Timeout")));
      outgoing.on("error", () => {
        if (!response.headersSent) this.json(response, 502, { success: false, message: "The POS database service is unavailable. Please ask the cashier or retry shortly." });
        resolve();
      });
      outgoing.end(body);
    });
  }

  async handle(request, response) {
    if (!this.allowedRequest(request)) return this.json(response, 403, { success: false, message: "Open the QR link while connected to the restaurant Wi-Fi." });
    let pathname;
    try { pathname = decodeURIComponent(request.url.split("?")[0]); }
    catch { return this.json(response, 400, { success: false, message: "Invalid URL." }); }
    if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").some((part) => part === ".." || part === ".")) {
      return this.json(response, 404, { success: false, message: "Not found." });
    }
    const incomingUrl = new URL(request.url, `http://${request.headers.host}`);
    if (pathname.startsWith("/qr-api/")) {
      const action = pathname.slice("/qr-api/".length);
      if (action === "health" && request.method === "GET") return this.json(response, 200, {
        success: true, data: { configured: Boolean(this.config), running: true, business_name: this.config?.businessName || "" },
      });
      const methods = { menu: "GET", submit: "POST", status: "GET" };
      if (!methods[action]) return this.json(response, 404, { success: false, message: "Not found." });
      if (request.method !== methods[action]) return this.json(response, 405, { success: false, message: "Method not allowed." });
      return this.proxy(request, response, action, incomingUrl);
    }
    if (!["GET", "HEAD"].includes(request.method)) return this.json(response, 405, { success: false, message: "Method not allowed." });
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const extension = path.extname(relative).toLowerCase();
    const isBundleAsset = relative.startsWith("assets/") || relative.startsWith("fonts/");
    const isImageOrFont = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".otf"].includes(extension);
    if (relative !== "index.html" && !(MIME_TYPES[extension] && (isBundleAsset || isImageOrFont))) {
      return this.json(response, 404, { success: false, message: "Not found." });
    }
    let file;
    try {
      const root = fs.realpathSync(this.distDirectory);
      file = fs.realpathSync(path.resolve(this.distDirectory, relative));
      if (!file.startsWith(`${root}${path.sep}`) || !fs.statSync(file).isFile()) throw new Error("Not found");
    } catch {
      return this.json(response, relative === "index.html" ? 503 : 404, { success: false, message: relative === "index.html" ? "QR ordering assets are missing. Build or reinstall the POS app." : "Not found." });
    }
    response.writeHead(200, { "Content-Type": MIME_TYPES[extension], "X-Content-Type-Options": "nosniff", "Cache-Control": relative === "index.html" ? "no-store" : "public, max-age=300", "Referrer-Policy": "no-referrer" });
    if (request.method === "HEAD") return response.end();
    if (relative === "index.html") {
      const html = fs.readFileSync(file, "utf8").replace("<head>", '<head><meta name="restobill-qr-guest" content="true">').replace("</head>", "<script>if (!location.hash || location.hash === '#/') location.replace('#/qr-order');</script></head>");
      return response.end(html);
    }
    const stream = fs.createReadStream(file);
    stream.on("error", () => response.destroy());
    stream.pipe(response);
  }
}

module.exports = { QrOrderingServer, normalizeConfig, ipv4Addresses, isLocalClient, DEFAULT_PORT };
