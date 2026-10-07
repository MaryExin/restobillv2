const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { EventEmitter } = require("node:events");
const {
  compareVersions, validateLocalRelease, validateRelease, selectRelease,
  fetchManifest, openHttpsResponse, downloadRelease, registerSystemUpdater,
} = require("../../electron/system-updater.cjs");

const bytes = Buffer.from("test full-system setup package");
const local = { version: "1.2.3", buildId: "20260926010000", platform: "win32", arch: "x64" };
function release(overrides = {}) {
  return {
    ...local, version: "1.2.4", buildId: "20260927010000",
    url: "https://downloads.example.test/lightem-setup.exe",
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"), size: bytes.length,
    ...overrides,
  };
}
const manifest = (...releases) => ({ schemaVersion: 1, releases });
function stream(contents = bytes, headers = {}) {
  const value = Readable.from([contents]);
  value.headers = headers;
  return value;
}
async function temp(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lightem-updater-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("release selection compares numeric versions and never selects a downgrade", () => {
  assert.equal(compareVersions("1.10.0", "1.9.9"), 1);
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
  assert.equal(compareVersions("2.0.1", "3.0.0"), -1);
  assert.throws(() => compareVersions("latest", "1.0.0"));
  assert.equal(selectRelease(manifest(release({ version: "1.1.9" })), local, "win32", "x64"), null);
  assert.equal(selectRelease(manifest(release({ buildId: local.buildId })), local, "win32", "x64"), null);
  assert.equal(selectRelease(manifest(release({ buildId: "1" })), local, "win32", "x64"), null);
  assert.equal(selectRelease(manifest(release({ version: local.version })), local, "win32", "x64").buildId, "20260927010000");
  assert.equal(selectRelease(manifest(release(), release({ version: "1.10.0", buildId: "20260928010000" })), local, "win32", "x64").version, "1.10.0");
});

test("release selection requires matching platform and device architecture", () => {
  const mac = release({ platform: "darwin", arch: "universal", url: "https://example.test/setup.pkg" });
  assert.equal(selectRelease(manifest(mac), local, "win32", "x64"), null);
  assert.equal(selectRelease(manifest(mac), { ...local, platform: "darwin", arch: "universal" }, "darwin", "arm64"), mac);
  assert.throws(() => validateLocalRelease(local, "darwin", "arm64"), /match this device/);
  assert.throws(() => validateLocalRelease({ ...local, arch: "arm64" }, "win32", "arm64"), /unsupported/);
  assert.throws(() => selectRelease({ releases: [] }, local, "win32", "x64"), /format/);
});

test('standalone and XAMPP update channels cannot replace each other', () => {
  const standalone = release({runtimeKind:'standalone'});
  const legacy = release({version:'8.0.0',buildId:'20290927010000'});
  const all = manifest(standalone,legacy);
  assert.equal(selectRelease(all,{...local,runtimeKind:'standalone'},'win32','x64'),standalone);
  assert.equal(selectRelease(all,local,'win32','x64'),legacy);
  assert.equal(selectRelease(manifest(legacy),{...local,runtimeKind:'standalone'},'win32','x64'),null);
  assert.equal(selectRelease(manifest(standalone),local,'win32','x64'),null);
  assert.throws(() => validateRelease(release({runtimeKind:'unknown'})));
  assert.throws(() => validateLocalRelease({...local,runtimeKind:'unknown'},'win32','x64'));
});

test("release validation rejects executable inputs that bypass package requirements", () => {
  for (const url of ["http://example.test/setup.exe", "file:///tmp/setup.exe", "https://user:password@example.test/setup.exe", "https://example.test/setup.zip", "https://example.test/setup.exe#fragment"]) {
    assert.throws(() => validateRelease(release({ url })));
  }
  for (const size of [0, -1, 0.1, 4 * 1024 ** 3 + 1, "12"]) {
    assert.throws(() => validateRelease(release({ size })), /size/);
  }
  for (const buildId of ["../bad", "-1", "1.2", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateRelease(release({ buildId })), /build ID/);
  }
  assert.throws(() => validateRelease(release({ sha256: "bad" })), /checksum/);
});

test("feed parsing is bounded and rejects malformed JSON", async () => {
  assert.deepEqual(await fetchManifest("https://example.test/latest.json", { openStream: async () => stream(Buffer.from(JSON.stringify(manifest()))) }), manifest());
  await assert.rejects(fetchManifest("http://example.test/latest.json"), /HTTPS/);
  await assert.rejects(fetchManifest("https://example.test/latest.json", { openStream: async () => stream(Buffer.alloc(1024 * 1024 + 1)) }), /too large/);
  await assert.rejects(fetchManifest("https://example.test/latest.json", { openStream: async () => stream(Buffer.from("<html>")) }), SyntaxError);
});

test("HTTPS transport rejects insecure redirects and excessive redirect loops", async () => {
  let requests = 0;
  function redirect(location) {
    return (url, options, callback) => {
      requests += 1;
      const request = new EventEmitter();
      request.setTimeout = () => {};
      request.destroy = (error) => request.emit("error", error);
      process.nextTick(() => {
        const response = stream(Buffer.alloc(0), { location });
        response.statusCode = 302;
        callback(response);
      });
      return request;
    };
  }
  await assert.rejects(openHttpsResponse("https://example.test/setup.exe", { request: redirect("http://example.test/setup.exe") }), /HTTPS/);
  assert.equal(requests, 1);
  requests = 0;
  await assert.rejects(openHttpsResponse("https://example.test/setup.exe", { request: redirect("/setup.exe") }), /too many/);
  assert.equal(requests, 6);
});

test("downloads become installable only after matching exact bytes and checksum", async (t) => {
  const directory = await temp(t);
  let requests = 0;
  const progresses = [];
  const download = () => downloadRelease(release(), directory, {
    openStream: async () => { requests += 1; return stream(bytes, { "content-length": String(bytes.length) }); },
    onProgress: (value) => progresses.push(value),
  });
  const filename = await download();
  assert.deepEqual(await fs.readFile(filename), bytes);
  assert.equal(path.basename(filename), "lightem-system-20260927010000-x64.exe");
  assert.deepEqual(progresses, [1]);
  assert.equal(await download(), filename);
  assert.equal(requests, 1, "a verified cached package can be reused");
  await fs.writeFile(filename, Buffer.alloc(bytes.length));
  await download();
  assert.equal(requests, 2, "tampered cached bytes are downloaded again");
  assert.equal((await fs.readdir(directory)).length, 1);
});

test("size, checksum, and interrupted transfer failures remove partial packages", async (t) => {
  const directory = await temp(t);
  const cases = [
    { source: () => stream(bytes, { "content-length": "1" }), message: /size/ },
    { source: () => stream(bytes.subarray(0, -1)), message: /integrity/ },
    { source: () => stream(Buffer.concat([bytes, bytes])), message: /exceeded/ },
    { source: () => stream(Buffer.alloc(bytes.length)), message: /integrity/ },
    { source: () => Readable.from((async function* () { yield bytes.subarray(0, 3); throw new Error("Connection lost"); })()), message: /Connection lost/ },
  ];
  for (const item of cases) {
    await assert.rejects(downloadRelease(release(), directory, { openStream: async () => item.source() }), item.message);
    assert.deepEqual(await fs.readdir(directory), [], "no completed or partial installer survives a failed verification");
  }
});

test("missing release metadata never triggers an update and gives manual setup guidance", async (t) => {
  const directory = await temp(t);
  const messages = [];
  const app = new EventEmitter();
  app.getPath = () => directory;
  app.quit = () => { throw new Error("must not quit"); };
  const updater = registerSystemUpdater({ app, dialog: { showMessageBox: async (options) => { messages.push(options); return { response: 1 }; } }, shell: { openPath: () => { throw new Error("must not launch"); } }, metadataPath: path.join(directory, "absent.json") });
  t.after(updater.dispose);
  await updater.check();
  assert.equal(messages.length, 0);
  await updater.check({ interactive: true });
  assert.match(messages[0].message, /no valid system release/);
});

test("unconfigured installs stay offline and provide a useful manual result", async (t) => {
  const directory = await temp(t);
  const metadataPath = path.join(directory, "release.json");
  await fs.writeFile(metadataPath, JSON.stringify(local));
  const messages = [];
  const app = new EventEmitter();
  const updater = registerSystemUpdater({
    app, platform: "win32", arch: "x64", metadataPath,
    dialog: { showMessageBox: async (options) => { messages.push(options); return { response: 1 }; } },
    shell: {}, openStream: async () => { throw new Error("Must not request the network"); },
  });
  t.after(updater.dispose);
  await updater.check();
  assert.equal(messages.length, 0);
  await updater.check({ interactive: true });
  assert.match(messages[0].message, /not been configured/);
});

test("downloaded updates require explicit install confirmation and launch before quitting", async (t) => {
  const directory = await temp(t);
  const metadataPath = path.join(directory, "release.json");
  await fs.writeFile(metadataPath, JSON.stringify({ ...local, updateUrl: "https://example.test/latest.json" }));
  const messages = [];
  const actions = [];
  const responses = [0, 1, 0, 0]; // Download, Later; then download cached, Install.
  let packageDownloads = 0;
  const app = new EventEmitter();
  app.getPath = () => directory;
  app.quit = () => actions.push("quit");
  const updater = registerSystemUpdater({
    app, platform: "win32", arch: "x64", metadataPath,
    dialog: { showMessageBox: async (options) => { messages.push(options); return { response: responses.shift() }; } },
    shell: { openPath: async (filename) => { assert.deepEqual(await fs.readFile(filename), bytes); actions.push("launch"); return ""; } },
    openStream: async (url) => {
      if (url.endsWith("latest.json")) return stream(Buffer.from(JSON.stringify(manifest(release()))));
      packageDownloads += 1;
      return stream();
    },
  });
  t.after(updater.dispose);
  await updater.check();
  assert.equal(messages.length, 2);
  assert.deepEqual(actions, [], "Later never launches or closes the app");
  await updater.check();
  assert.equal(messages.length, 2, "automatic repeated checks suppress declined prompts");
  await updater.check({ interactive: true });
  assert.deepEqual(actions, ["launch", "quit"]);
  assert.equal(packageDownloads, 1, "the second attempt uses its verified cached package");
});
