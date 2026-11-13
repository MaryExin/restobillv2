const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");
const vm = require("node:vm");

const electronDirectory = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(electronDirectory, "main.cjs"), "utf8");
const preloadSource = fs.readFileSync(path.join(electronDirectory, "preload.cjs"), "utf8");

async function loadMain({ packaged = true, lock = true, network = true } = {}) {
  const metrics = {
    windows: [], attempts: [], live: 0, peak: 0, quits: 0, locks: 0, loaded: [],
  };
  const app = new EventEmitter();
  Object.assign(app, {
    isPackaged: packaged,
    requestSingleInstanceLock: () => { metrics.locks++; return lock; },
    quit: () => { metrics.quits++; },
    whenReady: () => Promise.resolve(),
    getPath: () => "/fake-user-data",
  });

  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.minimized = true;
      this.webContents = { openDevTools() {} };
      metrics.windows.push(this);
    }
    maximize() {}
    loadURL() {}
    loadFile() {}
    isDestroyed() { return false; }
    isMinimized() { return this.minimized; }
    restore() { this.minimized = false; this.restored = true; }
    show() { this.shown = true; }
    focus() { this.focused = true; }
    static getAllWindows() { return metrics.windows; }
  }

  class Socket extends EventEmitter {
    setTimeout(timeout) { assert.equal(timeout, 300); }
    connect(port, ip) {
      assert.equal(port, 9100);
      metrics.attempts.push(ip);
      metrics.live++;
      this.active = true;
      metrics.peak = Math.max(metrics.peak, metrics.live);
      const host = Number(ip.split(".").pop());
      if (host === 42) throw new Error("socket setup failed");
      setImmediate(() => {
        if ([3, 200].includes(host)) this.emit("connect");
        else if (host % 3 === 0) this.emit("error", new Error("not listening"));
        else if (host % 3 === 1) this.emit("close");
        else this.emit("timeout");
      });
    }
    destroy() {
      if (this.active) {
        this.active = false;
        metrics.live--;
      }
      this.emit("close");
    }
  }

  const handlers = new Map();
  const electron = {
    app,
    BrowserWindow: Window,
    ipcMain: { handle: (name, callback) => handlers.set(name, callback), on() {} },
    protocol: { registerSchemesAsPrivileged() {} },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} } } },
    screen: {},
    dialog: {},
  };
  vm.runInNewContext(mainSource, {
    require: (name) => {
      metrics.loaded.push(name);
      if (name === "electron") return electron;
      if (name === "./qrOrderingServer.cjs") return { QrOrderingServer: class {
        start() { metrics.qrStarted = true; return Promise.resolve({ running: true }); }
        stop() { metrics.qrStopped = true; return Promise.resolve({ running: false }); }
        status() { return { running: true }; }
      } };
      if (name === "net") return { Socket };
      if (name === "os") return {
        networkInterfaces: () => network
          ? { eth0: [{ family: "IPv4", internal: false, address: "192.168.1.99" }] }
          : {},
      };
      return require(name);
    },
    process: { platform: "win32", resourcesPath: "/resources", on() {} },
    __dirname: electronDirectory,
    Buffer, console, setTimeout, clearTimeout,
  });
  await new Promise((resolve) => setImmediate(resolve));
  return { app, handlers, metrics };
}

function loadPreload() {
  const ipcRenderer = new EventEmitter();
  const exposed = {};
  vm.runInNewContext(preloadSource, {
    require: () => ({
      ipcRenderer,
      contextBridge: {
        exposeInMainWorld: (key, api) => { exposed[key] = api; },
      },
    }),
  });
  return { api: exposed.kioskAPI, ipcRenderer };
}

test("a duplicate packaged launch quits without creating a window or IPC handlers", async () => {
  const { app, handlers, metrics } = await loadMain({ lock: false });
  assert.equal(metrics.quits, 1);
  assert.equal(metrics.windows.length, 0);
  assert.equal(handlers.size, 0);
  app.emit("activate");
  assert.equal(metrics.windows.length, 0);
});

test("relaunch restores and focuses the existing operator window", async () => {
  const { app, metrics } = await loadMain();
  assert.equal(metrics.windows.length, 1);
  assert.equal(metrics.qrStarted, true);
  assert(!metrics.loaded.includes("serialport"));
  app.emit("second-instance");
  const window = metrics.windows[0];
  assert(window.restored && window.focused && window.shown);
  assert.equal(metrics.windows.length, 1);
});

test("closing the app shuts down the local QR host", async () => {
  const { app, metrics } = await loadMain();
  app.emit("before-quit");
  assert.equal(metrics.qrStopped, true);
});

test("QR host controls accept only the trusted main POS frame", async () => {
  const { handlers, metrics } = await loadMain();
  const operator = metrics.windows[0].webContents;
  const frame = { url: require("node:url").pathToFileURL(path.join(electronDirectory, "..", "dist", "index.html")).href + "#/poscorehomescreen" };
  operator.mainFrame = frame;
  const status = handlers.get("qr-ordering:status");
  assert.equal(status({ sender: operator, senderFrame: frame }).running, true);
  assert.throws(() => status({ sender: {}, senderFrame: frame }), /main POS window/);
  assert.throws(() => status({ sender: operator, senderFrame: { ...frame } }), /main POS window/);
  frame.url = "https://untrusted.example/";
  assert.throws(() => status({ sender: operator, senderFrame: frame }), /main POS window/);
});

test("development launches do not acquire the packaged app lock", async () => {
  const { metrics } = await loadMain({ packaged: false });
  assert.equal(metrics.locks, 0);
  assert.equal(metrics.windows.length, 1);
});

test("LAN scan covers the subnet with bounded sockets and cleans up every outcome", async () => {
  const { handlers, metrics } = await loadMain();
  const scan = handlers.get("scan-lan-printers");
  assert.deepEqual(Array.from(await scan()), ["192.168.1.3", "192.168.1.200"]);
  assert.equal(new Set(metrics.attempts).size, 254);
  assert.equal(metrics.attempts.length, 254);
  assert(metrics.peak <= 16);
  assert.equal(metrics.live, 0);
});

test("overlapping LAN scans share work and a later scan can run again", async () => {
  const { handlers, metrics } = await loadMain();
  const scan = handlers.get("scan-lan-printers");
  const first = scan();
  const overlapping = scan();
  assert.equal(first, overlapping);
  await Promise.all([first, overlapping]);
  assert.equal(metrics.attempts.length, 254);
  await scan();
  assert.equal(metrics.attempts.length, 508);
  assert.equal(metrics.live, 0);
});

test("LAN scan returns an empty array without sockets when offline", async () => {
  const { handlers, metrics } = await loadMain({ network: false });
  assert.deepEqual(Array.from(await handlers.get("scan-lan-printers")()), []);
  assert.equal(metrics.attempts.length, 0);
});

test("kiosk unsubscribe releases all listeners across repeated mounts", () => {
  const { api, ipcRenderer } = loadPreload();
  let calls = 0;
  const handler = (...args) => {
    assert.deepEqual(args, [{ total: 10 }]);
    calls++;
  };
  for (let i = 0; i < 100; i++) {
    const unsubscribe = api.onCartUpdate(handler);
    assert.equal(ipcRenderer.listenerCount("kiosk:cart-updated"), 1);
    ipcRenderer.emit("kiosk:cart-updated", { privateEvent: true }, { total: 10 });
    unsubscribe();
    unsubscribe();
    assert.equal(ipcRenderer.listenerCount("kiosk:cart-updated"), 0);
  }
  assert.equal(calls, 100);
});

test("kiosk cleanup removes only its own subscription and supports legacy off", () => {
  const { api, ipcRenderer } = loadPreload();
  let firstCalls = 0;
  let secondCalls = 0;
  const first = () => { firstCalls++; };
  const second = () => { secondCalls++; };
  const stopFirst = api.onCartUpdate(first);
  const stopSecond = api.onCartUpdate(second);
  stopFirst();
  ipcRenderer.emit("kiosk:cart-updated", {}, {});
  assert.equal(firstCalls, 0);
  assert.equal(secondCalls, 1);
  stopSecond();
  api.onCartUpdate(first);
  api.offCartUpdate(first);
  assert.equal(ipcRenderer.listenerCount("kiosk:cart-updated"), 0);
});
