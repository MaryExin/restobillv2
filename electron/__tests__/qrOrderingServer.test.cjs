const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { QrOrderingServer, normalizeConfig, ipv4Addresses, isLocalClient } = require("../qrOrderingServer.cjs");

const token = "a".repeat(64);
const networkInterfaces = () => ({ wifi: [{ family: "IPv4", internal: false, address: "192.168.1.10" }] });
const config = (apiUrl) => ({ apiUrl, hostToken: token, categoryCode: "Category", unitCode: "BU-1", businessName: "Test Restaurant" });

function request(port, pathname, { method = "GET", body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: pathname, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString(), headers: res.headers }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(body);
  });
}

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "restobill-qr-test-"));
  const dist = path.join(directory, "dist");
  fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
  fs.writeFileSync(path.join(dist, "index.html"), "<html><head></head><body>QR menu</body></html>");
  fs.writeFileSync(path.join(dist, "assets", "app.js"), "window.loaded = true;");
  fs.writeFileSync(path.join(dist, "ip.txt"), "PRIVATE HOST");
  fs.writeFileSync(path.join(dist, "pos-config.json"), '{"private":true}');
  fs.writeFileSync(path.join(directory, "private.js"), "PRIVATE FILE");
  fs.symlinkSync(path.join(directory, "private.js"), path.join(dist, "assets", "escape.js"));
  const calls = [];
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({ method: req.method, url: new URL(req.url, "http://localhost"), headers: req.headers, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null });
    res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "private=yes" });
    res.end(JSON.stringify({ success: true, data: { order_id: "order-1", status: "PENDING" } }));
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const apiUrl = `http://127.0.0.1:${upstream.address().port}/backend/api/qr-ordering.php`;
  const configPath = path.join(directory, "config", "qr-ordering.json");
  const host = new QrOrderingServer({ distDirectory: dist, configPath, port: 0, networkInterfaces });
  await host.start();
  t.after(async () => {
    await host.stop();
    await new Promise((resolve) => { upstream.close(resolve); upstream.closeAllConnections?.(); });
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { host, port: host.status().port, configPath, dist, apiUrl, calls, upstream };
}

test("config requires an explicit QR endpoint and validated private credentials", () => {
  assert.equal(normalizeConfig(config("http://localhost/api/qr-ordering.php")).unitCode, "BU-1");
  for (const apiUrl of ["file:///tmp/qr-ordering.php", "http://user:pass@localhost/qr-ordering.php", "http://localhost/private.php", "http://localhost/qr-ordering.php?token=secret"]) {
    assert.throws(() => normalizeConfig(config(apiUrl)));
  }
  assert.throws(() => normalizeConfig({ ...config("http://localhost/api/qr-ordering.php"), hostToken: "short" }));
});

test("LAN addresses include only external IPv4 and local client filtering rejects public addresses", () => {
  assert.deepEqual(ipv4Addresses({ wifi: [...networkInterfaces().wifi, ...networkInterfaces().wifi, { family: "IPv6", internal: false, address: "::1" }] }), ["192.168.1.10"]);
  for (const value of ["::1", "::ffff:127.0.0.1", "192.168.0.1", "10.2.3.4", "172.16.0.1", "169.254.1.2"]) assert.equal(isLocalClient(value), true);
  for (const value of ["8.8.8.8", "172.32.1.1", "192.169.1.1", "garbage"]) assert.equal(isLocalClient(value), false);
});

test("unconfigured host serves guest assets without exposing bundled POS settings or escaping dist", async (t) => {
  const { port } = await fixture(t);
  const index = await request(port, "/");
  assert.equal(index.status, 200);
  assert.match(index.text, /#\/qr-order/);
  assert.match(index.text, /<meta name="restobill-qr-guest" content="true">/);
  assert.equal((await request(port, "/assets/app.js")).status, 200);
  for (const pathname of ["/ip.txt", "/pos-config.json", "/backend/.env", "/assets/../../private.js", "/assets/%2e%2e/%2e%2e/private.js", "/assets/escape.js", "/assets/app.js.map", "/qr-api/setup", "/qr-api/accept", "/qr-api/pending"]) {
    const result = await request(port, pathname);
    assert.equal(result.status, 404, pathname);
    assert.doesNotMatch(result.text, /PRIVATE/);
  }
  assert.equal((await request(port, "/qr-api/menu")).status, 503);
});

test("configured host persists secrets privately and exposes only safe status data", async (t) => {
  const { host, apiUrl, configPath, dist, port } = await fixture(t);
  const status = await host.configure(config(apiUrl));
  assert.equal(status.configured, true);
  assert.deepEqual(status.urls, [`http://192.168.1.10:${port}/#/qr-order`]);
  assert.doesNotMatch(JSON.stringify(status), new RegExp(`${token}|qr-ordering.php`));
  assert.equal(JSON.parse(fs.readFileSync(configPath)).hostToken, token);
  if (process.platform !== "win32") assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
  const restored = new QrOrderingServer({ distDirectory: dist, configPath, port: 0, networkInterfaces });
  assert.equal(restored.status().configured, true);
  const health = await request(port, "/qr-api/health");
  assert.equal(JSON.parse(health.text).data.business_name, "Test Restaurant");
  assert.doesNotMatch(health.text, new RegExp(`${token}|apiUrl|hostToken`));
});

test("menu and status proxy only approved fields, scope and private server header", async (t) => {
  const { host, apiUrl, port, calls } = await fixture(t);
  await host.configure(config(apiUrl));
  const result = await request(port, "/qr-api/menu?order_type=TAKE%20OUT&action=setup&category_code=EVIL&unit_code=EVIL&url=http://example.com", { headers: { Authorization: "Bearer customer-value", "X-QR-Host-Token": "bad" } });
  assert.equal(result.status, 200);
  assert.equal(result.headers["set-cookie"], undefined);
  assert.equal(calls[0].headers["x-qr-host-token"], token);
  assert.equal(calls[0].headers.authorization, undefined);
  assert.equal(calls[0].url.pathname, "/backend/api/qr-ordering.php");
  assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), { order_type: "TAKE OUT", action: "menu", category_code: "Category", unit_code: "BU-1" });
  await request(port, "/qr-api/status?order_id=order-1&tracking_token=tracking&action=accept");
  assert.deepEqual(Object.fromEntries(calls[1].url.searchParams), { order_id: "order-1", tracking_token: "tracking", action: "status", category_code: "Category", unit_code: "BU-1" });
  await request(port, "/qr-api/menu?order_type=DINE%20IN&continuation_order_id=prior-order&continuation_tracking_token=guest-proof&transaction_id=123&available=true");
  assert.deepEqual(Object.fromEntries(calls[2].url.searchParams), {
    order_type: "DINE IN", continuation_order_id: "prior-order", continuation_tracking_token: "guest-proof",
    action: "menu", category_code: "Category", unit_code: "BU-1",
  });
});

test("submit preserves retry identity and overrides guest action and branch", async (t) => {
  const { host, apiUrl, port, calls } = await fixture(t);
  await host.configure(config(apiUrl));
  const body = JSON.stringify({ request_id: "same-retry-key", action: "accept", category_code: "EVIL", unit_code: "EVIL", items: [{ product_id: "P1", quantity: 2 }] });
  for (let i = 0; i < 2; i++) {
    assert.equal((await request(port, "/qr-api/submit", { method: "POST", body, headers: { "Content-Type": "application/json" } })).status, 200);
  }
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { request_id: "same-retry-key", action: "submit", category_code: "Category", unit_code: "BU-1", items: [{ product_id: "P1", quantity: 2 }] });
  assert.equal(calls[0].body.request_id, calls[1].body.request_id);
});

test("rejects cross-origin, unexpected host, method, content type and invalid JSON", async (t) => {
  const { host, apiUrl, port, calls } = await fixture(t);
  await host.configure(config(apiUrl));
  assert.equal((await request(port, "/qr-api/menu", { headers: { Host: "evil.example" } })).status, 403);
  assert.equal((await request(port, "/qr-api/menu", { headers: { Origin: "https://evil.example" } })).status, 403);
  assert.equal((await request(port, "/qr-api/submit")).status, 405);
  assert.equal((await request(port, "/qr-api/submit", { method: "POST", body: "{}" })).status, 415);
  for (const body of ["[1]", "null", "{"]) assert.equal((await request(port, "/qr-api/submit", { method: "POST", body, headers: { "Content-Type": "application/json" } })).status, 400);
  assert.equal((await request(port, "/qr-api/submit", { method: "POST", body: " ".repeat(65537), headers: { "Content-Type": "application/json", "Content-Length": 65537 } })).status, 413);
  assert.equal(calls.length, 0);
});

test("upstream network errors do not leak the database address or credentials", async (t) => {
  const { host, apiUrl, port, upstream } = await fixture(t);
  await host.configure(config(apiUrl));
  await new Promise((resolve) => upstream.close(resolve));
  const result = await request(port, "/qr-api/menu");
  assert.equal(result.status, 502);
  assert.match(JSON.parse(result.text).message, /unavailable/);
  assert.doesNotMatch(result.text, new RegExp(`${token}|127.0.0.1|qr-ordering.php`));
});

test("port collision is reported without stopping the POS or existing host", async (t) => {
  const { host, port, dist } = await fixture(t);
  const duplicate = new QrOrderingServer({ distDirectory: dist, port, networkInterfaces });
  t.after(() => duplicate.stop());
  const status = await duplicate.start();
  assert.equal(status.running, false);
  assert.match(status.error, /in use/);
  assert.equal(host.status().running, true);
});
