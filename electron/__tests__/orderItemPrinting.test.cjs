const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { test } = require("node:test");
const vm = require("node:vm");

const electronDirectory = path.resolve(__dirname, "..");
const mainFilename = path.join(electronDirectory, "main.cjs");
const mainSource = fs.readFileSync(mainFilename, "utf8");

async function loadPrinting({ categories = {}, printerConfig = "" } = {}) {
  const handlers = new Map();
  const printed = [];
  const errors = [];
  const app = new EventEmitter();
  Object.assign(app, {
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    quit() {},
  });
  class Window extends EventEmitter {
    constructor() { super(); this.webContents = { openDevTools() {} }; }
    maximize() {}
    loadURL() {}
    static getAllWindows() { return []; }
  }
  const electron = {
    app, BrowserWindow: Window,
    ipcMain: { handle: (name, handler) => handlers.set(name, handler), on() {} },
    protocol: { registerSchemesAsPrivileged() {} },
    session: { defaultSession: { webRequest: { onHeadersReceived() {} } } },
    screen: {}, dialog: {},
  };
  const context = vm.createContext({
    require: (name) => {
      if (name === "electron") return electron;
      if (name === "fs") return {
        existsSync: () => true,
        readFileSync: (filename) => filename.endsWith("printer_categories.json")
          ? JSON.stringify(categories)
          : filename.endsWith("printer.txt") ? printerConfig : "{}",
      };
      if (name === "net") return { Socket: class {
        constructor() { throw new Error("Tests must not contact a printer"); }
      } };
      if (name === "serialport" || name === "escpos-usb") {
        throw new Error("Tests must not contact a printer");
      }
      return require(name);
    },
    process: { platform: "win32", resourcesPath: "/test-resources", on() {} },
    __dirname: electronDirectory,
    Buffer, setTimeout, clearTimeout,
    console: { log() {}, error: (...args) => errors.push(args), warn() {} },
    capturePrint: async (buffer, options) => {
      assert(Buffer.isBuffer(buffer), "print transport receives rendered bytes, not a Promise");
      printed.push({ text: buffer.toString("ascii"), buffer, options });
      return { success: true };
    },
  });
  // Use Node's actual module loader so the cached CJS -> ESM import resolves
  // the same shared formatter used by the app. All printer/file I/O is isolated.
  vm.runInContext(mainSource, context, {
    filename: mainFilename,
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  });
  vm.runInContext("writeEscposBuffer = capturePrint;", context);
  await new Promise((resolve) => setImmediate(resolve));
  return { handlers, printed, errors, context };
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function orderItem(name, id, price = 267.5) {
  return {
    name, item_name: name, product_id: id, code: id,
    item_category: "CHICKEN WINGS PLATTER", quantity: 2, sales_quantity: 2,
    qty: 2, price, selling_price: price, amount: price * 2,
    unit_of_measure: "PCS", isDiscountable: "Yes", vatable: "Yes",
    itemInstruction: "Sauce on side", qrValue: `QR:${id}`,
  };
}

test("every itemized ESC/POS receipt labels combinations without changing raw items or amounts", async () => {
  const { handlers, printed, errors, context } = await loadPrinting();
  const items = [
    orderItem('5 CHEESE 12" HALF', "PIZZA-HALF"),
    orderItem("5 ALARM HALF", "WINGS-HALF"),
    orderItem("HALF FRIED CHICKEN", "CHICKEN", 429),
    orderItem('5 CHEESE 12"', "WHOLE", 700),
  ];
  const data = deepFreeze({
    items, detailedproduct: items, table: "TEST", total: 3328,
    transaction: { transaction_id: "TEST-ONLY", Discount: 0 },
    computed: { grossTotal: 3328, netAfterDiscount: 3328, amountDue: 3328 },
    totals: { qty: 8, amount: 3328 },
  });
  const before = JSON.stringify(data);
  const firstImport = vm.runInContext("loadOrderItemDisplayName()", context);
  assert.equal(firstImport, vm.runInContext("loadOrderItemDisplayName()", context));
  await firstImport;

  const channels = [
    "print-escpos", "print-escpos-duplicate", "print-escposdiscount",
    "print-escpospospaymentreceipt", "print-escpossalesperproduct",
    "print-escposbilling", "print-escpos-void-refund",
  ];
  for (const channel of channels) {
    const result = await handlers.get(channel)({}, data);
    assert.equal(result.success, true, `${channel}: ${JSON.stringify(errors)}`);
    const text = printed.at(-1).text.toUpperCase();
    assert.equal((text.match(/\(COMBINE/g) || []).length, 2, `${channel} labels both original half SKUs`);
    assert.equal((text.match(/\bHALF\b/g) || []).length, 1, `${channel} retains only the unrelated Half chicken name`);
    if (channel === "print-escpos" || channel === "print-escpos-duplicate") {
      assert.equal((text.match(/2X/g) || []).length, 4, "kitchen quantities remain intact");
      assert.match(text, /SAUCE ON SIDE/);
    } else {
      assert.equal((text.match(/535\.00/g) || []).length, 2, `${channel} preserves each half row's quantity times price`);
      assert.match(text, /858\.00/);
      assert.match(text, /1,400\.00/);
    }
    assert.equal(JSON.stringify(data), before, `${channel} does not mutate the original print payload`);
  }
  assert.equal(printed.length, channels.length);
  assert.equal(errors.length, 0);
});

test("category-routed kitchen printing retains routing and formats every printer buffer", async () => {
  const { handlers, printed, errors } = await loadPrinting({ categories: {
    newTransaction: {
      lan: { categories: ["PIZZA HALF"], connection: "network:192.0.2.1:9100" },
      usb: { categories: ["CHICKEN WINGS PLATTER"], connection: "usb:auto" },
    },
  } });
  const pizza = { ...orderItem('5 CHEESE HALF 12"', "PIZZA-HALF"), item_category: "PIZZA HALF" };
  const data = deepFreeze({ items: [pizza, orderItem("5 ALARM HALF", "WINGS-HALF")] });
  const result = await handlers.get("print-escpos")({}, data);
  assert.equal(result.success, true, JSON.stringify(errors));
  assert.equal(printed.length, 2);
  assert.match(printed[0].text, /ORDER SUMMARY - PIZZA \(COMBINE FLAVOR\)/);
  assert.match(printed[0].text, /-- PIZZA \(COMBINE FLAVOR\) --/);
  assert.match(printed[1].text.replace(/\s+/g, " "), /ORDER SUMMARY - CHICKEN WINGS PLATTER/);
  assert.doesNotMatch(printed[0].text, /PIZZA HALF/);
  for (const output of printed) {
    assert.match(output.text, /\(COMBINE/);
    assert.match(output.text, /FLAVOR\)/);
  }
  assert.equal(data.items[0].name, '5 CHEESE HALF 12"');
  assert.equal(data.items[0].item_category, "PIZZA HALF");
  assert.equal(errors.length, 0);
});

test("shared printer headings format each category while preserving raw group identities", async () => {
  const { handlers, printed, errors } = await loadPrinting({ categories: {
    newTransaction: {
      lan: { categories: ["PIZZA HALF", "CHICKEN WINGS PLATTER HALF"], connection: "network:192.0.2.1:9100" },
    },
  } });
  const data = deepFreeze({ items: [
    { ...orderItem('5 CHEESE 12" HALF', "PIZZA-HALF"), item_category: "PIZZA HALF" },
    { ...orderItem("5 ALARM HALF", "WINGS-HALF"), item_category: "CHICKEN WINGS PLATTER HALF" },
  ] });
  const result = await handlers.get("print-escpos")({}, data);
  assert.equal(result.success, true, JSON.stringify(errors));
  assert.equal(printed.length, 1, "both raw categories retain their shared printer routing");
  const text = printed[0].text.replace(/\s+/g, " ");
  assert.match(text, /ORDER SUMMARY - PIZZA \(COMBINE FLAVOR\) \/ CHICKEN WINGS PLATTER \(COMBINE FLAVOR\)/);
  assert.match(text, /-- PIZZA \(COMBINE FLAVOR\) --/);
  assert.match(text, /-- CHICKEN WINGS PLATTER \(COMBINE FLAVOR\) --/);
  assert.doesNotMatch(text, /\bHALF\b/);
  assert.equal(data.items[1].item_category, "CHICKEN WINGS PLATTER HALF");
});

test("long kitchen instructions keep the full combination name above the separate note", async () => {
  const { handlers, printed, errors } = await loadPrinting();
  const item = orderItem('5 CHEESE HALF 12"', "PIZZA-HALF");
  item.itemInstruction = "Please put all extra sauce into a separate container on the side";
  const data = deepFreeze({ items: [item] });
  const result = await handlers.get("print-escpos")({}, data);
  assert.equal(result.success, true, JSON.stringify(errors));
  assert.match(printed[0].text, /5 CHEESE 12" \(COMBINE FLAVOR\)/);
  assert.match(printed[0].text, /2X/);
  assert.match(printed[0].text, /Please put all extra sauce/);
  assert.equal(item.name, '5 CHEESE HALF 12"');
});

test("both QR label formats display the combination label while preserving QR codes and prices", async () => {
  for (const language of ["escpos", "tspl"]) {
    const { handlers, printed, errors } = await loadPrinting({
      printerConfig: `qr_language: ${language}\nqr: network:192.0.2.1:9100`,
    });
    const item = orderItem("5 ALARM HALF", "WINGS-HALF");
    const data = deepFreeze({ items: [item], table: "TEST" });
    const result = await handlers.get("print-escposqr")({}, data);
    assert.equal(result.success, true, JSON.stringify(errors));
    assert.equal(printed.length, 1);
    assert.match(printed[0].text.toUpperCase(), /5 ALARM \(COMBINE FLAVOR\)/);
    assert.match(printed[0].text, /QR:WINGS-HALF/);
    assert.match(printed[0].text, /267\.50/);
    assert.equal(item.name, "5 ALARM HALF");
    assert.equal(errors.length, 0);
  }
});

test("ESC/POS QR titles wrap long flavor names without truncating the combination label", async () => {
  const { handlers, printed, errors } = await loadPrinting({
    printerConfig: "qr_language: escpos\nqr: network:192.0.2.1:9100",
  });
  const item = orderItem('PEPPERONI W/ JALAPENO AND ANCHOVY 16" HALF', "LONG-PIZZA-HALF");
  const data = deepFreeze({ items: [item] });
  const result = await handlers.get("print-escposqr")({}, data);
  assert.equal(result.success, true, JSON.stringify(errors));
  const text = printed[0].text.replace(/\s+/g, " ");
  assert.match(text, /PEPPERONI W\/ JALAPENO AND ANCHOVY 16" \(COMBINE FLAVOR\)/);
  assert.match(text, /QR:LONG-PIZZA-HALF/);
  assert.equal(item.name, 'PEPPERONI W/ JALAPENO AND ANCHOVY 16" HALF');
});
