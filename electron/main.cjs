const { app, BrowserWindow, ipcMain, protocol } = require("electron");

const net = require("net");

const path = require("path");
const fs = require("fs");

const OPEN_DEVTOOLS_IN_PACKAGED = false;
const DEV_SERVER_URL = "http://localhost:5173";

const RECEIPT_WINDOW_WIDTH_PX = 420;
const MIN_PRINT_WINDOW_HEIGHT_PX = 1400;
const MAX_PRINT_WINDOW_HEIGHT_PX = 12000;
const EXTRA_RENDER_HEIGHT_PX = 120;
const EXTRA_PAGE_HEIGHT_PX = 80;
const RECEIPT_WIDTH_MICRONS = 80000;
const MIN_RECEIPT_HEIGHT_MICRONS = 50000;
const MAX_RECEIPT_HEIGHT_MICRONS = 1200000;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "asset",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
]);

let win = null;

const DEFAULT_BUSINESS_INFO = {
  companyName: "",
  storeName: "",
  corpName: "",
  address: "",
  tin: "",
  machineNumber: "",
  serialNumber: "",
  posProviderName: "LIGHTEM SOLUTIONS INCORPORATED",
  posProviderAddress: "1187, PARULAN, PLARIDEL|BULACAN, PHILIPPINES",
  posProviderTin: "626717559-000",
  posProviderBirAccreNo: "25A6267175592023091853",
  posProviderAccreDateIssued: "12/04/2023",
  posProviderPTUNo: "FP022026-25B0584602-00012",
  posProviderPTUDateIssued: "2/13/2026",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cssPxToMicrons(px) {
  return Math.ceil((Number(px) || 0) * (25400 / 96));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "icon.ico")
      : path.join(__dirname, "..", "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (!app.isPackaged) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  if (!app.isPackaged || OPEN_DEVTOOLS_IN_PACKAGED) {
    win.webContents.openDevTools();
  }

  win.on("closed", () => {
    win = null;
  });
}

function getIpFilePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "ip.txt")
    : path.join(__dirname, "..", "public", "ip.txt");
}

function getPrinterFilePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "printer.txt")
    : path.join(__dirname, "..", "public", "printer.txt");
}

function getBusinessInfoFilePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "businessInfo.json")
    : path.join(__dirname, "..", "public", "businessInfo.json");
}

function getBusinessInfoBackupDir() {
  const dir = app.isPackaged
    ? path.join(process.resourcesPath, "business-info-backups")
    : path.join(__dirname, "..", "public", "business-info-backups");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

function readTextFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch (error) {
    console.error(`Failed to read file: ${filePath}`, error);
    return "";
  }
}

function readJsonFileSafe(filePath, fallback = {}) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read JSON file: ${filePath}`, error);
    return fallback;
  }
}

function writeJsonFileSafe(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error(`Failed to write JSON file: ${filePath}`, error);
    return false;
  }
}

function normalizeBusinessInfo(payload = {}) {
  return {
    companyName: String(payload?.companyName || "").trim(),
    storeName: String(payload?.storeName || "").trim(),
    corpName: String(payload?.corpName || "").trim(),
    address: String(payload?.address || "").trim(),
    tin: String(payload?.tin || "").trim(),
    machineNumber: String(payload?.machineNumber || "").trim(),
    serialNumber: String(payload?.serialNumber || "").trim(),
    posProviderName: String(payload?.posProviderName || "").trim(),
    posProviderAddress: String(payload?.posProviderAddress || "").trim(),
    posProviderTin: String(payload?.posProviderTin || "").trim(),
    posProviderBirAccreNo: String(payload?.posProviderBirAccreNo || "").trim(),
    posProviderAccreDateIssued: String(
      payload?.posProviderAccreDateIssued || "",
    ).trim(),
    posProviderPTUNo: String(payload?.posProviderPTUNo || "").trim(),
    posProviderPTUDateIssued: String(
      payload?.posProviderPTUDateIssued || "",
    ).trim(),
  };
}

function createBusinessInfoBackup(data) {
  try {
    const backupDir = getBusinessInfoBackupDir();
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      "_",
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("");

    const backupPath = path.join(backupDir, `businessInfo_${stamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), "utf8");
    return backupPath;
  } catch (error) {
    console.error("Failed to create business info backup:", error);
    return "";
  }
}

function getDefaultPrinterNameFromFile() {
  const printerPath = getPrinterFilePath();
  console.log("Reading printer.txt from:", printerPath);
  return readTextFileSafe(printerPath);
}

function mapPrinterInfo(printer) {
  return {
    name: printer?.name || "",
    displayName: printer?.displayName || printer?.name || "",
    description: printer?.description || "",
    status: typeof printer?.status === "undefined" ? null : printer.status,
    isDefault:
      typeof printer?.isDefault === "undefined" ? null : printer.isDefault,
  };
}

async function getPrintersFromWindow(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return [];
  const printers = await targetWindow.webContents.getPrintersAsync();
  return Array.isArray(printers) ? printers : [];
}

async function waitForReceiptLayout(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;

  await targetWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const finish = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      };

      const start = () => {
        const fontPromise = document.fonts?.ready
          ? document.fonts.ready.then(() => undefined).catch(() => undefined)
          : Promise.resolve();

        Promise.resolve(fontPromise).then(() => {
          setTimeout(finish, 60);
        });
      };

      if (document.readyState === "complete") {
        start();
      } else {
        window.addEventListener("load", start, { once: true });
      }
    });
  `);

  await delay(120);
}

async function getReceiptMetrics(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) {
    return {
      bodyScrollHeight: 0,
      bodyOffsetHeight: 0,
      docScrollHeight: 0,
      docOffsetHeight: 0,
      bodyScrollWidth: 0,
      docScrollWidth: 0,
      bodyRectHeight: 0,
      bodyRectWidth: 0,
      devicePixelRatio: 1,
    };
  }

  return targetWindow.webContents.executeJavaScript(`
    (() => {
      const body = document.body;
      const doc = document.documentElement;
      const bodyRect = body ? body.getBoundingClientRect() : { height: 0, width: 0 };

      return {
        bodyScrollHeight: body ? body.scrollHeight : 0,
        bodyOffsetHeight: body ? body.offsetHeight : 0,
        docScrollHeight: doc ? doc.scrollHeight : 0,
        docOffsetHeight: doc ? doc.offsetHeight : 0,
        bodyScrollWidth: body ? body.scrollWidth : 0,
        docScrollWidth: doc ? doc.scrollWidth : 0,
        bodyRectHeight: Math.ceil(bodyRect.height || 0),
        bodyRectWidth: Math.ceil(bodyRect.width || 0),
        devicePixelRatio: window.devicePixelRatio || 1,
      };
    })();
  `);
}

async function resizePrintWindowToContent(targetWindow, contentHeightPx) {
  if (!targetWindow || targetWindow.isDestroyed()) return;

  const targetHeight = clamp(
    Math.ceil((Number(contentHeightPx) || 0) + EXTRA_RENDER_HEIGHT_PX),
    MIN_PRINT_WINDOW_HEIGHT_PX,
    MAX_PRINT_WINDOW_HEIGHT_PX,
  );

  targetWindow.setContentSize(RECEIPT_WINDOW_WIDTH_PX, targetHeight);
  await delay(250);
}

async function printWithOptions(targetWindow, options) {
  return new Promise((resolve) => {
    try {
      targetWindow.webContents.print(options, (success, failureReason) => {
        resolve({
          success,
          failureReason: failureReason || "",
        });
      });
    } catch (error) {
      resolve({
        success: false,
        failureReason: error?.message || "Print call threw an error.",
      });
    }
  });
}

function getPrinterHost() {
  try {
    // Packaged app:
    // C:\...\win-unpacked\resources\printer.txt
    //
    // Dev fallback:
    // <project root>\printer.txt
    const printerFilePath = app.isPackaged
      ? path.join(process.resourcesPath, "printer.txt")
      : path.join(app.getAppPath(), "printer.txt");

    if (!fs.existsSync(printerFilePath)) {
      console.warn(
        `[ESC/POS PRINT] printer.txt not found at: ${printerFilePath}`,
      );
      return "192.168.100.126"; // fallback default
    }

    const host = fs.readFileSync(printerFilePath, "utf8").trim();

    if (!host) {
      console.warn(
        "[ESC/POS PRINT] printer.txt is empty. Using fallback host.",
      );
      return "192.168.100.126";
    }

    console.log(`[ESC/POS PRINT] Loaded printer host from file: ${host}`);
    return host;
  } catch (error) {
    console.error("[ESC/POS PRINT] Failed to read printer.txt:", error);
    return "192.168.100.126"; // fallback default
  }
}

function escposRepeat(char, length) {
  return String(char || "").repeat(length || 0);
}

function escposWrapText(text, width) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const words = raw.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const testLine = current ? `${current} ${word}` : word;

    if (testLine.length <= width) {
      current = testLine;
    } else {
      if (current) lines.push(current);

      if (word.length > width) {
        let chunk = word;
        while (chunk.length > width) {
          lines.push(chunk.slice(0, width));
          chunk = chunk.slice(width);
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  });

  if (current) lines.push(current);
  return lines;
}

function escposPeso(v) {
  return Number(v || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escposPadRight(text, width) {
  const raw = String(text || "");
  if (raw.length >= width) return raw.slice(0, width);
  return raw + " ".repeat(width - raw.length);
}

function escposPadLeft(text, width) {
  const raw = String(text || "");
  if (raw.length >= width) return raw.slice(0, width);
  return " ".repeat(width - raw.length) + raw;
}

function escposFormatLeftRight(left, right, lineWidth = 32) {
  const leftText = String(left || "");
  const rightText = String(right || "");
  const space = lineWidth - leftText.length - rightText.length;
  return leftText + " ".repeat(space > 0 ? space : 1) + rightText;
}

function escposSafeNumber(value) {
  return Number(value || 0);
}

function escposSafeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function escposPickBusinessInfo(data = {}) {
  const payloadBusinessInfo = data?.businessInfo || {};
  return {
    companyName:
      payloadBusinessInfo.companyName ||
      payloadBusinessInfo.businessName ||
      payloadBusinessInfo.Company_Name ||
      DEFAULT_BUSINESS_INFO.companyName ||
      "CRABS N CRACK SEAFOOD HOUSE",

    storeName:
      payloadBusinessInfo.storeName ||
      payloadBusinessInfo.branchName ||
      payloadBusinessInfo.Store_Name ||
      DEFAULT_BUSINESS_INFO.storeName ||
      "AND SHAKING CRABS - GUIGUINTO",

    corpName:
      payloadBusinessInfo.corpName ||
      payloadBusinessInfo.Corp_Name ||
      DEFAULT_BUSINESS_INFO.corpName ||
      "ARU FOOD CORP.",

    address:
      payloadBusinessInfo.address ||
      payloadBusinessInfo.Address ||
      DEFAULT_BUSINESS_INFO.address ||
      "PLARIDEL BYPASS ROAD TIAONG GUIGUINTO BULACAN",

    tin:
      payloadBusinessInfo.tin ||
      payloadBusinessInfo.TIN ||
      DEFAULT_BUSINESS_INFO.tin ||
      "634-742-586-00013",

    machineNumber:
      payloadBusinessInfo.machineNumber ||
      payloadBusinessInfo.MIN ||
      DEFAULT_BUSINESS_INFO.machineNumber ||
      "N/A",

    serialNumber:
      payloadBusinessInfo.serialNumber ||
      payloadBusinessInfo.SN ||
      DEFAULT_BUSINESS_INFO.serialNumber ||
      "N/A",
  };
}

function escposResolvePrinterTarget(printerNameFromPayload = "") {
  const raw = String(printerNameFromPayload || "").trim();

  if (!raw) {
    return {
      host: "192.168.100.126",
      port: 9100,
    };
  }

  // supports:
  // "192.168.100.126"
  // "192.168.100.126:9100"
  // "EPSON@192.168.100.126:9100"
  const afterAt = raw.includes("@") ? raw.split("@").pop() : raw;
  const [hostPart, portPart] = String(afterAt).split(":");

  return {
    host: hostPart || "192.168.100.126",
    port: Number(portPart || 9100),
  };
}

function escposYesNoToBool(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase() === "yes"
  );
}

function escposSplitLines(value) {
  return String(value || "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function escposSignedNegativePeso(value) {
  return `- ${escposPeso(value)}`;
}

function escposBuildPaymentBreakdown(payments = []) {
  const safePayments = Array.isArray(payments) ? payments : [];

  return Object.entries(
    safePayments.reduce((acc, payment) => {
      const method = String(payment?.payment_method || "Cash").trim() || "Cash";
      const amount = Number(payment?.payment_amount || 0);

      if (!acc[method]) acc[method] = 0;
      acc[method] += amount;

      return acc;
    }, {}),
  ).map(([method, amount]) => ({
    method,
    amount,
  }));
}

function escposGetDiscountCountLabel(entry) {
  if (entry?.key === "senior") return "Senior Citizen Discount Count:";
  if (entry?.key === "pwd") return "PWD Discount Count:";
  if (entry?.key === "manual") return "Manual Discount Count:";
  return `${entry?.label || "Discount"} Count:`;
}

function escposGetDiscountAmountLabel(entry) {
  if (entry?.key === "senior") return "Senior Citizen Discount Amount:";
  if (entry?.key === "pwd") return "PWD Discount Amount:";
  if (entry?.key === "manual") return "Manual Discount Amount:";
  return `${entry?.label || "Discount"} Amount:`;
}

app.whenReady().then(() => {
  ipcMain.handle("test-escpos", async () => {
    const host = getPrinterHost();
    const port = 9100;

    return await new Promise((resolve) => {
      const client = new net.Socket();
      let finished = false;

      const done = (result) => {
        if (finished) return;
        finished = true;
        try {
          client.destroy();
        } catch {}
        resolve(result);
      };

      client.setTimeout(5000);

      client.on("connect", () => {
        console.log(`[ESC/POS TEST] Connected to ${host}:${port}`);
        done({
          success: true,
          message: `Printer reachable at ${host}:${port}`,
        });
      });

      client.on("timeout", () => {
        console.error("[ESC/POS TEST] Socket timeout");
        done({
          success: false,
          message: "Printer socket timeout",
        });
      });

      client.on("error", (err) => {
        console.error("[ESC/POS TEST] Socket error:", err);
        done({
          success: false,
          message: err?.message || "Printer connection failed",
        });
      });

      client.connect(port, host);
    });
  });

  let lastWarmupAt = 0;

  ipcMain.handle("warmup-escpos", async () => {
    const host = getPrinterHost();
    const port = 9100;

    if (Date.now() - lastWarmupAt < 30000) {
      return {
        success: true,
        message: "Printer already warmed up recently",
      };
    }

    try {
      return await new Promise((resolve) => {
        const client = new net.Socket();
        let finished = false;

        const done = (result) => {
          if (finished) return;
          finished = true;

          try {
            client.destroy();
          } catch {}

          resolve(result);
        };

        client.setTimeout(5000);

        client.on("connect", () => {
          const initPrinter = Buffer.from([0x1b, 0x40]);

          client.write(initPrinter, (err) => {
            if (err) {
              return done({
                success: false,
                message: err?.message || "Warm-up write failed",
              });
            }

            lastWarmupAt = Date.now();

            done({
              success: true,
              message: "Printer connection warmed up",
            });
          });
        });

        client.on("timeout", () => {
          done({
            success: false,
            message: "Printer warm-up timeout",
          });
        });

        client.on("error", (err) => {
          done({
            success: false,
            message: err?.message || "Printer warm-up connection error",
          });
        });

        client.connect(port, host);
      });
    } catch (error) {
      return {
        success: false,
        message: error?.message || "Printer warm-up failed",
      };
    }
  });

  ipcMain.handle("print-escpos", async (_event, data) => {
    const host = getPrinterHost();
    const port = 9100;
    const LINE_WIDTH = 42;

    const repeat = (char, length) => String(char || "").repeat(length || 0);

    const formatLeftRight = (left, right) => {
      const leftText = String(left || "");
      const rightText = String(right || "");
      const space = LINE_WIDTH - leftText.length - rightText.length;
      return leftText + " ".repeat(space > 0 ? space : 1) + rightText;
    };

    const wrapText = (text, width) => {
      const raw = String(text || "").trim();
      if (!raw) return [];

      const words = raw.split(/\s+/);
      const lines = [];
      let current = "";

      words.forEach((word) => {
        const testLine = current ? `${current} ${word}` : word;

        if (testLine.length <= width) {
          current = testLine;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      });

      if (current) lines.push(current);
      return lines;
    };

    const peso = (v) =>
      Number(v || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    try {
      return await new Promise((resolve) => {
        const client = new net.Socket();
        let finished = false;

        const done = (result) => {
          if (finished) return;
          finished = true;
          try {
            client.destroy();
          } catch {}
          resolve(result);
        };

        client.setTimeout(10000);

        client.on("connect", () => {
          try {
            console.log(`[ESC/POS PRINT] Connected to ${host}:${port}`);
            console.log("[ESC/POS PRINT] Payload:", data);

            const chunks = [];
            const {
              table,
              items,
              total,
              instructions,
              printMode,
              transactionId,
            } = data || {};

            const initPrinter = Buffer.from([0x1b, 0x40]);
            const alignLeft = Buffer.from([0x1b, 0x61, 0x00]);
            const alignCenter = Buffer.from([0x1b, 0x61, 0x01]);
            const alignRight = Buffer.from([0x1b, 0x61, 0x02]);
            const boldOn = Buffer.from([0x1b, 0x45, 0x01]);
            const boldOff = Buffer.from([0x1b, 0x45, 0x00]);
            const doubleSizeOn = Buffer.from([0x1d, 0x21, 0x11]);
            const normalSize = Buffer.from([0x1d, 0x21, 0x00]);
            const cutPaper = Buffer.from([0x1d, 0x56, 0x00]);
            const nl = (count = 1) => Buffer.from("\n".repeat(count), "ascii");
            const txt = (value) => Buffer.from(String(value || ""), "ascii");

            let status = "NEW ORDER";
            if (printMode === "duplicate") {
              status = "DUPLICATE COPY";
            } else if (printMode === "additional") {
              status = "ADDITIONAL ORDER";
            } else if (printMode === "new") {
              status = "NEW ORDER";
            } else if (transactionId) {
              status = "ADDITIONAL ORDER";
            }

            chunks.push(initPrinter);

            // Header
            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(txt("ORDER SUMMARY"));
            chunks.push(nl());
            chunks.push(boldOff);

            chunks.push(normalSize);
            chunks.push(txt(`Table: ${table || "-"}`));
            chunks.push(nl());
            chunks.push(txt(new Date().toLocaleString()));
            chunks.push(nl());

            chunks.push(txt(repeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // Column header
            chunks.push(alignLeft);
            chunks.push(boldOn);
            chunks.push(txt(formatLeftRight("Item", "Qty  Price")));
            chunks.push(nl());
            chunks.push(boldOff);

            chunks.push(txt(repeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // Items
            if (!Array.isArray(items) || items.length === 0) {
              chunks.push(alignCenter);
              chunks.push(txt("Cart is empty"));
              chunks.push(nl());
            } else {
              chunks.push(alignLeft);

              items.forEach((item) => {
                const nameLines = wrapText(
                  String(item?.name || "").toUpperCase(),
                  20,
                );
                const qty = String(item?.quantity || 0);
                const lineTotal =
                  Number(item?.price || 0) * Number(item?.quantity || 0);
                const price = `P${peso(lineTotal)}`;

                nameLines.forEach((line, index) => {
                  if (index === 0) {
                    chunks.push(txt(formatLeftRight(line, `${qty} ${price}`)));
                  } else {
                    chunks.push(txt(line));
                  }
                  chunks.push(nl());
                });

                if (item?.itemInstruction) {
                  wrapText(`Note: ${item.itemInstruction}`, LINE_WIDTH).forEach(
                    (line) => {
                      chunks.push(txt(line));
                      chunks.push(nl());
                    },
                  );
                }

                if (item?.code) {
                  chunks.push(txt(String(item.code)));
                  chunks.push(nl());
                }
              });
            }

            chunks.push(txt(repeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // Total
            chunks.push(alignRight);
            chunks.push(boldOn);
            chunks.push(doubleSizeOn);
            chunks.push(txt(`TOTAL: P${peso(total)}`));
            chunks.push(nl());
            chunks.push(normalSize);
            chunks.push(boldOff);

            // Instructions
            if (instructions) {
              chunks.push(alignLeft);
              chunks.push(txt(repeat("-", LINE_WIDTH)));
              chunks.push(nl());
              chunks.push(txt("INSTRUCTIONS"));
              chunks.push(nl());

              wrapText(instructions, LINE_WIDTH).forEach((line) => {
                chunks.push(txt(line));
                chunks.push(nl());
              });
            }

            // Status
            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(doubleSizeOn);

            wrapText(status, 16).forEach((line) => {
              chunks.push(txt(line));
              chunks.push(nl());
            });

            chunks.push(normalSize);
            chunks.push(boldOff);

            // Footer
            chunks.push(txt("Thank you for your order!"));
            chunks.push(nl());
            chunks.push(txt("Please present this to the counter."));
            chunks.push(nl(3));
            chunks.push(cutPaper);

            const payload = Buffer.concat(chunks);

            client.write(payload, (err) => {
              if (err) {
                console.error("[ESC/POS PRINT] Write error:", err);
                return done({
                  success: false,
                  message: err?.message || "Failed to write to printer",
                });
              }

              client.end();
            });
          } catch (error) {
            console.error("[ESC/POS PRINT] Build/print error:", error);
            done({
              success: false,
              message: error?.message || "ESC/POS print failed",
            });
          }
        });

        client.on("timeout", () => {
          console.error("[ESC/POS PRINT] Socket timeout");
          done({
            success: false,
            message: "Printer socket timeout",
          });
        });

        client.on("error", (err) => {
          console.error("[ESC/POS PRINT] Socket error:", err);
          done({
            success: false,
            message: err?.message || "Printer connection error",
          });
        });

        client.on("close", () => {
          console.log("[ESC/POS PRINT] Connection closed");
          done({
            success: true,
            message: "Printed successfully",
          });
        });

        client.connect(port, host);
      });
    } catch (error) {
      console.error("ESC/POS print error:", error);
      return {
        success: false,
        message: error?.message || "ESC/POS print failed",
      };
    }
  });

  ipcMain.handle("print-escposdiscount", async (_event, data) => {
    const host = getPrinterHost();
    const port = 9100;
    const LINE_WIDTH = 42;

    // const { host, port } = escposResolvePrinterTarget(data?.printerName);

    try {
      return await new Promise((resolve) => {
        const client = new net.Socket();
        let finished = false;

        const done = (result) => {
          if (finished) return;
          finished = true;
          try {
            client.destroy();
          } catch {}
          resolve(result);
        };

        client.setTimeout(10000);

        client.on("connect", () => {
          try {
            console.log(`[ESC/POS DISCOUNT] Connected to ${host}:${port}`);
            console.log("[ESC/POS DISCOUNT] Payload:", data);

            const chunks = [];
            const {
              transaction = {},
              items = [],
              computed = {},
              dateFrom,
            } = data || {};
            const business = escposPickBusinessInfo(data);

            const initPrinter = Buffer.from([0x1b, 0x40]);
            const alignLeft = Buffer.from([0x1b, 0x61, 0x00]);
            const alignCenter = Buffer.from([0x1b, 0x61, 0x01]);
            const alignRight = Buffer.from([0x1b, 0x61, 0x02]);
            const boldOn = Buffer.from([0x1b, 0x45, 0x01]);
            const boldOff = Buffer.from([0x1b, 0x45, 0x00]);
            const doubleSizeOn = Buffer.from([0x1d, 0x21, 0x11]);
            const normalSize = Buffer.from([0x1d, 0x21, 0x00]);
            const cutPaper = Buffer.from([0x1d, 0x56, 0x00]);
            const nl = (count = 1) => Buffer.from("\n".repeat(count), "ascii");
            const txt = (value) => Buffer.from(String(value || ""), "ascii");

            const safeItems = Array.isArray(items) ? items : [];

            const computedTotalSales = safeItems.reduce((total, item) => {
              const price = escposSafeNumber(
                item?.selling_price ?? item?.price ?? item?.unit_price,
              );
              const quantity = escposSafeNumber(
                item?.sales_quantity ?? item?.quantity ?? item?.qty,
              );
              return total + price * quantity;
            }, 0);

            const discount =
              escposSafeNumber(
                computed?.discountAmount ??
                  computed?.discount ??
                  transaction?.Discount ??
                  transaction?.discount,
              ) || 0;

            const amountDue =
              escposSafeNumber(
                computed?.amountDue ??
                  computed?.netAmount ??
                  computed?.totalAfterDiscount,
              ) || computedTotalSales - discount;

            const customerName =
              transaction?.customer_name || transaction?.customerName || "";
            const customerId =
              transaction?.customer_id || transaction?.customerId || "";
            const customerTin =
              transaction?.customer_tin || transaction?.customerTin || "";
            const customerAddress =
              transaction?.customer_address ||
              transaction?.customerAddress ||
              "";

            const billingRows = [
              ["Trans No", transaction?.transaction_id || "N/A"],
              ["Billing No", transaction?.billing_no || "N/A"],
              ["Invoice No", transaction?.invoice_no || "N/A"],
              [
                "Trans Date",
                transaction?.transaction_date || dateFrom || "N/A",
              ],
              ["Trans Time", transaction?.transaction_time || "N/A"],
              ["Terminal No", transaction?.terminal_number || "N/A"],
              ["Order Type", transaction?.order_type || "N/A"],
              ["Ref Tag", transaction?.table_number || "N/A"],
              ["Cashier", transaction?.cashier || "N/A"],
            ];

            const formatItemRow = (name, qty, amt) => {
              const nameWidth = 21;
              const qtyWidth = 7;
              const amtWidth = 14;

              return (
                escposPadRight(name, nameWidth) +
                escposPadRight(qty, qtyWidth) +
                escposPadLeft(amt, amtWidth)
              );
            };

            chunks.push(initPrinter);

            // HEADER
            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(
              txt(
                escposSafeText(
                  business.companyName,
                  "CRABS N CRACK SEAFOOD HOUSE",
                ),
              ),
            );
            chunks.push(nl());
            chunks.push(
              txt(
                escposSafeText(
                  business.storeName,
                  "AND SHAKING CRABS - GUIGUINTO",
                ),
              ),
            );
            chunks.push(nl());
            chunks.push(boldOff);

            if (business.corpName) {
              chunks.push(txt(business.corpName));
              chunks.push(nl());
            }

            escposWrapText(business.address, LINE_WIDTH).forEach((line) => {
              chunks.push(txt(line));
              chunks.push(nl());
            });

            chunks.push(
              txt(`VAT REG TIN: ${escposSafeText(business.tin, "N/A")}`),
            );
            chunks.push(nl());
            chunks.push(
              txt(`MIN: ${escposSafeText(business.machineNumber, "N/A")}`),
            );
            chunks.push(nl());
            chunks.push(
              txt(`S/N: ${escposSafeText(business.serialNumber, "N/A")}`),
            );
            chunks.push(nl());

            chunks.push(txt(escposRepeat("-", LINE_WIDTH)));
            chunks.push(nl());

            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(doubleSizeOn);
            chunks.push(txt("DISCOUNT"));
            chunks.push(nl());
            chunks.push(normalSize);
            chunks.push(boldOff);

            // BILLING INFO
            chunks.push(alignLeft);
            billingRows.forEach(([label, value]) => {
              const printedValue = escposSafeText(value, "N/A");
              const line = `${label}:`;
              if (line.length + printedValue.length <= LINE_WIDTH) {
                chunks.push(
                  txt(escposFormatLeftRight(line, printedValue, LINE_WIDTH)),
                );
                chunks.push(nl());
              } else {
                chunks.push(txt(line));
                chunks.push(nl());
                escposWrapText(printedValue, LINE_WIDTH).forEach((wrapped) => {
                  chunks.push(txt(wrapped));
                  chunks.push(nl());
                });
              }
            });

            chunks.push(txt(escposRepeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // ITEMS HEADER
            chunks.push(boldOn);
            chunks.push(txt(formatItemRow("Item", "Qty", "Amt")));
            chunks.push(nl());
            chunks.push(boldOff);
            chunks.push(txt(escposRepeat("-", LINE_WIDTH)));
            chunks.push(nl());

            if (!safeItems.length) {
              chunks.push(alignCenter);
              chunks.push(txt("No items"));
              chunks.push(nl());
              chunks.push(alignLeft);
            } else {
              chunks.push(alignLeft);

              safeItems.forEach((item) => {
                const itemName =
                  item?.item_name ||
                  item?.product_name ||
                  item?.name ||
                  "Unnamed Item";

                const qtyValue =
                  item?.sales_quantity ?? item?.quantity ?? item?.qty ?? 0;

                const unitOfMeasure = item?.unit_of_measure || item?.uom || "";

                const qtyText =
                  `${qtyValue}${unitOfMeasure ? ` ${unitOfMeasure}` : ""}`.trim();

                const lineTotal = escposSafeNumber(
                  item?.line_total ??
                    item?.total ??
                    escposSafeNumber(
                      item?.selling_price ?? item?.price ?? item?.unit_price,
                    ) * escposSafeNumber(qtyValue),
                );

                const amtText = escposPeso(lineTotal);

                const nameLines = escposWrapText(String(itemName), 15);

                nameLines.forEach((line, index) => {
                  if (index === 0) {
                    chunks.push(txt(formatItemRow(line, qtyText, amtText)));
                  } else {
                    chunks.push(txt(line));
                  }
                  chunks.push(nl());
                });
              });
            }

            chunks.push(txt(escposRepeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // TOTALS
            chunks.push(
              txt(
                escposFormatLeftRight(
                  "Total Sales:",
                  escposPeso(computedTotalSales),
                  LINE_WIDTH,
                ),
              ),
            );
            chunks.push(nl());

            chunks.push(
              txt(
                escposFormatLeftRight(
                  "Discount:",
                  escposPeso(discount),
                  LINE_WIDTH,
                ),
              ),
            );
            chunks.push(nl());

            chunks.push(boldOn);
            chunks.push(doubleSizeOn);
            chunks.push(
              txt(
                escposFormatLeftRight(
                  "Amount Due:",
                  escposPeso(amountDue),
                  LINE_WIDTH,
                ),
              ),
            );
            chunks.push(nl());
            chunks.push(normalSize);
            chunks.push(boldOff);

            chunks.push(txt(escposRepeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // CUSTOMER SECTION
            chunks.push(alignLeft);
            chunks.push(txt(`Customer Name: ${customerName}`));
            chunks.push(nl());
            chunks.push(txt(`Customer ID: ${customerId}`));
            chunks.push(nl());
            chunks.push(txt(`TIN: ${customerTin}`));
            chunks.push(nl());

            if (customerAddress) {
              const addressLines = escposWrapText(
                `Address: ${customerAddress}`,
                LINE_WIDTH,
              );
              addressLines.forEach((line) => {
                chunks.push(txt(line));
                chunks.push(nl());
              });
            } else {
              chunks.push(txt("Address:"));
              chunks.push(nl());
            }

            chunks.push(txt("Customer Signature:"));
            chunks.push(nl());
            chunks.push(txt("_______________________________"));
            chunks.push(nl(3));

            chunks.push(cutPaper);

            const payload = Buffer.concat(chunks);

            client.write(payload, (err) => {
              if (err) {
                console.error("[ESC/POS DISCOUNT] Write error:", err);
                return done({
                  success: false,
                  message:
                    err?.message ||
                    "Failed to write discount receipt to printer",
                });
              }

              client.end();
            });
          } catch (error) {
            console.error("[ESC/POS DISCOUNT] Build/print error:", error);
            done({
              success: false,
              message: error?.message || "ESC/POS discount print failed",
            });
          }
        });

        client.on("timeout", () => {
          console.error("[ESC/POS DISCOUNT] Socket timeout");
          done({
            success: false,
            message: "Discount printer socket timeout",
          });
        });

        client.on("error", (err) => {
          console.error("[ESC/POS DISCOUNT] Socket error:", err);
          done({
            success: false,
            message: err?.message || "Discount printer connection error",
          });
        });

        client.on("close", () => {
          console.log("[ESC/POS DISCOUNT] Connection closed");
          done({
            success: true,
            message: "Discount receipt printed successfully",
          });
        });

        client.connect(port, host);
      });
    } catch (error) {
      console.error("ESC/POS discount print error:", error);
      return {
        success: false,
        message: error?.message || "ESC/POS discount print failed",
      };
    }
  });

  ipcMain.handle("print-escpospospaymentreceipt", async (_event, data) => {
    const host = getPrinterHost();
    const port = 9100;
    const LINE_WIDTH = 42;

    // const { host, port } = escposResolvePrinterTarget(data?.printerName);

    try {
      return await new Promise((resolve) => {
        const client = new net.Socket();
        let finished = false;

        const done = (result) => {
          if (finished) return;
          finished = true;
          try {
            client.destroy();
          } catch {}
          resolve(result);
        };

        client.setTimeout(10000);

        client.on("connect", () => {
          try {
            console.log(`[ESC/POS PAYMENT] Connected to ${host}:${port}`);
            console.log("[ESC/POS PAYMENT] Payload:", data);

            const chunks = [];
            const {
              transaction = {},
              items = [],
              computed = {},
              payments = [],
              otherCharges = [],
              customerCards = [],
              isDuplicateCopy = false,
              terminalConfig = {},
              businessInfo = {},
            } = data || {};

            const safeTransaction = transaction || {};
            const safeComputed = computed || {};
            const safeItems = Array.isArray(items) ? items : [];
            const safePayments = Array.isArray(payments) ? payments : [];
            const safeOtherCharges = Array.isArray(otherCharges)
              ? otherCharges
              : [];
            const safeCustomerCards = Array.isArray(customerCards)
              ? customerCards
              : [];

            const paymentLabel =
              safePayments.length > 0
                ? [
                    ...new Set(
                      safePayments
                        .map((p) => String(p?.payment_method || "").trim())
                        .filter(Boolean),
                    ),
                  ].join(", ")
                : safeTransaction?.payment_method || "Cash";

            const activeBreakdown = Array.isArray(
              safeComputed?.discountBreakdown,
            )
              ? safeComputed.discountBreakdown.filter(
                  (entry) =>
                    Number(entry?.qualifiedCount || 0) > 0 ||
                    Number(entry?.discountAmount || 0) > 0,
                )
              : [];

            const paymentBreakdown = escposBuildPaymentBreakdown(safePayments);

            const shouldShowDiscountSummary =
              Number(safeComputed?.safeCustomerCount || 0) > 0 ||
              Number(
                safeComputed?.totalQualifiedCount ||
                  safeComputed?.totalQualifiedAll ||
                  0,
              ) > 0 ||
              Number(safeComputed?.statutoryQualifiedCount || 0) > 0 ||
              activeBreakdown.length > 0;

            const splitAddressLines = (value) =>
              String(value || "")
                .split(/\r?\n|\|/)
                .map((line) => line.trim())
                .filter(Boolean);

            const companyName = String(
              businessInfo?.companyName || "COMPANY",
            ).trim();

            const storeName = String(businessInfo?.storeName || "STORE").trim();

            const corpName = String(
              businessInfo?.corpName || "CORPORATION",
            ).trim();

            const storeAddress = splitAddressLines(
              businessInfo?.address || terminalConfig?.unitAddress || "ADDRESS",
            );

            const storeTin = String(
              businessInfo?.tin || terminalConfig?.vatTin || "STORE TIN",
            ).trim();

            const machineNumber = String(
              businessInfo?.machineNumber ||
                terminalConfig?.machineNumber ||
                "MACHINE NUMBER",
            ).trim();

            const serialNumber = String(
              businessInfo?.serialNumber ||
                terminalConfig?.serialNumber ||
                "SERIAL NUMBER",
            ).trim();

            const posProviderName = String(
              businessInfo?.posProviderName || "POS PROVIDER NAME",
            ).trim();

            const posProviderAddress = splitAddressLines(
              businessInfo?.posProviderAddress || "POS PROVIDER ADDRESS",
            );

            const posProviderTin = String(
              businessInfo?.posProviderTin || "POS PROVIDER TIN",
            ).trim();

            const posProviderBirAccreNo = String(
              businessInfo?.posProviderBirAccreNo || "POS PROVIDER ACCRE NO.",
            ).trim();

            const posProviderAccreDateIssued = String(
              businessInfo?.posProviderAccreDateIssued || "ACCRE DATE ISSUED",
            ).trim();

            const posProviderPTUNo = String(
              businessInfo?.posProviderPTUNo || "PTU No.",
            ).trim();

            const posProviderPTUDateIssued = String(
              businessInfo?.posProviderPTUDateIssued || "PTU DATE ISSUED",
            ).trim();

            const initPrinter = Buffer.from([0x1b, 0x40]);
            const alignLeft = Buffer.from([0x1b, 0x61, 0x00]);
            const alignCenter = Buffer.from([0x1b, 0x61, 0x01]);
            const boldOn = Buffer.from([0x1b, 0x45, 0x01]);
            const boldOff = Buffer.from([0x1b, 0x45, 0x00]);
            const doubleSizeOn = Buffer.from([0x1d, 0x21, 0x11]);
            const doubleWidthOn = Buffer.from([0x1d, 0x21, 0x10]);
            const normalSize = Buffer.from([0x1d, 0x21, 0x00]);
            const cutPaper = Buffer.from([0x1d, 0x56, 0x00]);
            const nl = (count = 1) => Buffer.from("\n".repeat(count), "ascii");
            const txt = (value) => Buffer.from(String(value || ""), "ascii");

            const pushWrapped = (value, width = LINE_WIDTH) => {
              escposWrapText(String(value || ""), width).forEach((line) => {
                chunks.push(txt(line));
                chunks.push(nl());
              });
            };

            const pushDivider = () => {
              chunks.push(txt(escposRepeat("-", LINE_WIDTH)));
              chunks.push(nl());
            };

            const pushMetaRow = (label, value) => {
              const left = `${label}`;
              const right = escposSafeText(value, "-");

              if (left.length + right.length <= LINE_WIDTH) {
                chunks.push(
                  txt(escposFormatLeftRight(left, right, LINE_WIDTH)),
                );
                chunks.push(nl());
              } else {
                chunks.push(txt(left));
                chunks.push(nl());
                escposWrapText(right, LINE_WIDTH).forEach((line) => {
                  chunks.push(txt(line));
                  chunks.push(nl());
                });
              }
            };

            const formatItemRow = (name, qty, amt) => {
              const nameWidth = 21;
              const qtyWidth = 7;
              const amtWidth = 14;

              return (
                escposPadRight(name, nameWidth) +
                escposPadRight(qty, qtyWidth) +
                escposPadLeft(amt, amtWidth)
              );
            };

            chunks.push(initPrinter);

            // HEADER
            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(txt(companyName));
            chunks.push(nl());
            chunks.push(txt(String(storeName).toUpperCase()));
            chunks.push(nl());

            if (corpName) {
              chunks.push(txt(String(corpName).toUpperCase()));
              chunks.push(nl());
            }

            chunks.push(boldOff);

            storeAddress.forEach((line) => {
              chunks.push(txt(line));
              chunks.push(nl());
            });

            if (storeTin) {
              chunks.push(txt(`VAT REG TIN: ${storeTin}`));
              chunks.push(nl());
            }

            chunks.push(txt(`MIN: ${machineNumber || "-"}`));
            chunks.push(nl());
            chunks.push(txt(`S/N: ${serialNumber || "-"}`));
            chunks.push(nl());

            pushDivider();

            // INVOICE TITLE
            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(doubleWidthOn);
            chunks.push(txt("INVOICE"));
            chunks.push(nl());
            chunks.push(normalSize);
            chunks.push(boldOff);

            if (isDuplicateCopy) {
              chunks.push(boldOn);
              chunks.push(txt("DUPLICATE INVOICE COPY"));
              chunks.push(nl());
              chunks.push(boldOff);
            }

            // META
            chunks.push(alignLeft);
            pushMetaRow("Trans. No.:", safeTransaction?.transaction_id || "-");
            pushMetaRow("INV#:", safeTransaction?.invoice_no || "-");
            pushMetaRow(
              "Trans. Date:",
              safeTransaction?.transaction_date || "-",
            );
            pushMetaRow(
              "Trans. Time:",
              safeTransaction?.transaction_time || "-",
            );
            pushMetaRow(
              "Terminal No.:",
              safeTransaction?.terminal_number ||
                terminalConfig?.terminalNumber ||
                "-",
            );
            pushMetaRow("Order Type:", safeTransaction?.order_type || "-");
            pushMetaRow("Ref./Tag #:", safeTransaction?.table_number || "-");
            pushMetaRow("Cashier:", safeTransaction?.cashier || "-");

            pushDivider();

            // ITEMS
            chunks.push(boldOn);
            chunks.push(txt(formatItemRow("Item", "Qty", "Amt")));
            chunks.push(nl());
            chunks.push(boldOff);

            safeItems.forEach((item, index) => {
              const qty = Number(item?.sales_quantity || 0);
              const price = Number(item?.selling_price || 0);
              const lineTotal = qty * price;
              const isDiscountable = escposYesNoToBool(item?.isDiscountable);
              const itemLabel = String(
                item?.item_name || item?.product_id || "-",
              ).toUpperCase();

              const nameWithFlags = `• ${itemLabel}${isDiscountable ? " (D)" : ""}`;
              const nameLines = escposWrapText(nameWithFlags, 15);
              const qtyText = `${qty}${item?.unit_of_measure ? ` ${item.unit_of_measure}` : ""}`;
              const amtText = `${escposPeso(lineTotal)}${item?.vatable === "Yes" ? "V" : ""}`;

              nameLines.forEach((line, lineIndex) => {
                if (lineIndex === 0) {
                  chunks.push(txt(formatItemRow(line, qtyText, amtText)));
                } else {
                  chunks.push(txt(line));
                }
                chunks.push(nl());
              });
            });

            pushDivider();

            // TOTAL SALES / DISCOUNTS / OTHER CHARGES
            pushMetaRow("TOTAL SALES:", escposPeso(safeComputed?.grossTotal));

            activeBreakdown.forEach((entry) => {
              if (Number(entry?.discountAmount || 0) > 0) {
                pushMetaRow(
                  `${String(entry?.label || "DISCOUNT").toUpperCase()}:`,
                  escposSignedNegativePeso(entry?.discountAmount),
                );
              }
            });

            if (Number(safeComputed?.totalVatExemption || 0) > 0) {
              pushMetaRow(
                "VAT EXEMPTION:",
                escposSignedNegativePeso(safeComputed?.totalVatExemption),
              );
            }

            safeOtherCharges.forEach((charge) => {
              pushMetaRow(
                `${String(charge?.particulars || "OTHER CHARGE").toUpperCase()}:`,
                escposPeso(charge?.amount),
              );
            });

            pushDivider();

            // AMOUNT DUE
            chunks.push(boldOn);
            chunks.push(doubleSizeOn);
            chunks.push(
              txt(
                escposFormatLeftRight(
                  "AMOUNT DUE:",
                  escposPeso(safeComputed?.totalAmountDue),
                  LINE_WIDTH,
                ),
              ),
            );
            chunks.push(nl());
            chunks.push(normalSize);
            chunks.push(boldOff);

            pushDivider();

            // PAYMENT
            if (paymentBreakdown.length > 0) {
              pushMetaRow("PAYMENT:", "");

              paymentBreakdown.forEach((payment, index) => {
                pushMetaRow(
                  index === paymentBreakdown.length - 1
                    ? `(${payment.method}):`
                    : `${payment.method}:`,
                  escposPeso(payment.amount),
                );
              });

              pushMetaRow(
                "TOTAL PAYMENT:",
                escposPeso(safeComputed?.totalPaid),
              );
            } else {
              pushMetaRow(
                `PAYMENT (${paymentLabel}):`,
                escposPeso(safeComputed?.totalPaid),
              );
            }

            pushMetaRow("CHANGE:", escposPeso(safeComputed?.changeAmount));

            pushDivider();

            // VAT SUMMARY
            pushMetaRow(
              "VATABLE SALES:",
              escposPeso(safeComputed?.vatableSales),
            );
            pushMetaRow(
              "VAT AMOUNT:",
              escposPeso(safeComputed?.vatableSalesVat),
            );
            pushMetaRow(
              "VAT EXEMPT SALES:",
              escposPeso(safeComputed?.vatExemptSales),
            );
            pushMetaRow(
              "VAT EXEMPTION:",
              escposPeso(safeComputed?.totalVatExemption),
            );
            pushMetaRow(
              "ZERO RATED SALES:",
              escposPeso(safeComputed?.vatZeroRatedSales),
            );

            if (shouldShowDiscountSummary) {
              pushDivider();

              pushMetaRow(
                "Total Customers:",
                Number(safeComputed?.safeCustomerCount || 0),
              );

              pushMetaRow(
                "Total Qualified:",
                Number(
                  safeComputed?.totalQualifiedCount ||
                    safeComputed?.totalQualifiedAll ||
                    0,
                ),
              );

              activeBreakdown.forEach((entry) => {
                pushMetaRow(
                  escposGetDiscountCountLabel(entry),
                  Number(entry?.qualifiedCount || 0),
                );

                pushMetaRow(
                  escposGetDiscountAmountLabel(entry),
                  escposPeso(entry?.discountAmount),
                );
              });

              pushMetaRow(
                "Discountable Gross:",
                escposPeso(safeComputed?.discountableGross),
              );

              pushMetaRow(
                "Discountable Base:",
                escposPeso(safeComputed?.discountableBase),
              );
            }

            if (safeCustomerCards.length > 0) {
              pushDivider();

              chunks.push(boldOn);
              chunks.push(txt("DISCOUNT CUSTOMER DETAILS"));
              chunks.push(nl());
              chunks.push(boldOff);

              safeCustomerCards.forEach((card, index) => {
                if (index > 0) {
                  chunks.push(nl());
                }

                pushMetaRow("Name:", card?.customer_name || "");
                pushMetaRow("ID:", card?.customer_exclusive_id || "");
                pushMetaRow("Signature:", "");
              });
            }

            pushDivider();

            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(txt("Thank you"));
            chunks.push(nl());
            chunks.push(txt("Please come again."));
            chunks.push(nl());
            chunks.push(boldOff);

            chunks.push(nl());

            if (posProviderName) {
              chunks.push(boldOn);
              pushWrapped(`SUPPLIER: ${posProviderName}`, LINE_WIDTH);
              chunks.push(boldOff);
            }

            posProviderAddress.forEach((line) => pushWrapped(line, LINE_WIDTH));

            if (posProviderTin)
              pushWrapped(`TIN: ${posProviderTin}`, LINE_WIDTH);
            if (posProviderBirAccreNo)
              pushWrapped(`BIR ACC#: ${posProviderBirAccreNo}`, LINE_WIDTH);
            if (posProviderAccreDateIssued)
              pushWrapped(
                `DATE ISSUED: ${posProviderAccreDateIssued}`,
                LINE_WIDTH,
              );
            if (posProviderPTUNo)
              pushWrapped(`PTU: ${posProviderPTUNo}`, LINE_WIDTH);
            if (posProviderPTUDateIssued)
              pushWrapped(
                `PTU DATE ISSUED: ${posProviderPTUDateIssued}`,
                LINE_WIDTH,
              );

            chunks.push(nl(3));
            chunks.push(cutPaper);

            const payload = Buffer.concat(chunks);

            client.write(payload, (err) => {
              if (err) {
                console.error("[ESC/POS PAYMENT] Write error:", err);
                return done({
                  success: false,
                  message:
                    err?.message ||
                    "Failed to write payment receipt to printer",
                });
              }

              client.end();
            });
          } catch (error) {
            console.error("[ESC/POS PAYMENT] Build/print error:", error);
            done({
              success: false,
              message: error?.message || "ESC/POS payment print failed",
            });
          }
        });

        client.on("timeout", () => {
          console.error("[ESC/POS PAYMENT] Socket timeout");
          done({
            success: false,
            message: "Payment printer socket timeout",
          });
        });

        client.on("error", (err) => {
          console.error("[ESC/POS PAYMENT] Socket error:", err);
          done({
            success: false,
            message: err?.message || "Payment printer connection error",
          });
        });

        client.on("close", () => {
          console.log("[ESC/POS PAYMENT] Connection closed");
          done({
            success: true,
            message: "POS payment receipt printed successfully",
          });
        });

        client.connect(port, host);
      });
    } catch (error) {
      console.error("ESC/POS POS payment print error:", error);
      return {
        success: false,
        message: error?.message || "ESC/POS POS payment print failed",
      };
    }
  });

  ipcMain.handle("print-escposbilling", async (_event, data) => {
    const host = getPrinterHost();
    const port = 9100;
    const LINE_WIDTH = 42;

    const repeat = (char, length) => String(char || "").repeat(length || 0);

    const wrapText = (text, width) => {
      const raw = String(text || "").trim();
      if (!raw) return [];

      const words = raw.split(/\s+/);
      const lines = [];
      let current = "";

      words.forEach((word) => {
        const testLine = current ? `${current} ${word}` : word;

        if (testLine.length <= width) {
          current = testLine;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      });

      if (current) lines.push(current);
      return lines;
    };

    const peso = (v) =>
      Number(v || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const padRight = (text, width) => {
      const raw = String(text || "");
      if (raw.length >= width) return raw.slice(0, width);
      return raw + " ".repeat(width - raw.length);
    };

    const padLeft = (text, width) => {
      const raw = String(text || "");
      if (raw.length >= width) return raw.slice(0, width);
      return " ".repeat(width - raw.length) + raw;
    };

    const formatLeftRight = (left, right) => {
      const leftText = String(left || "");
      const rightText = String(right || "");
      const space = LINE_WIDTH - leftText.length - rightText.length;
      return leftText + " ".repeat(space > 0 ? space : 1) + rightText;
    };

    const formatItemRow = (name, qty, amt) => {
      const nameWidth = 21;
      const qtyWidth = 7;
      const amtWidth = 14;

      return (
        padRight(name, nameWidth) +
        padRight(qty, qtyWidth) +
        padLeft(amt, amtWidth)
      );
    };

    const safeNumber = (value) => Number(value || 0);

    try {
      return await new Promise((resolve) => {
        const client = new net.Socket();
        let finished = false;

        const done = (result) => {
          if (finished) return;
          finished = true;
          try {
            client.destroy();
          } catch {}
          resolve(result);
        };

        client.setTimeout(10000);

        client.on("connect", () => {
          try {
            console.log(`[ESC/POS BILLING] Connected to ${host}:${port}`);
            console.log("[ESC/POS BILLING] Payload:", data);

            const chunks = [];
            const { transaction, detailedproduct } = data || {};

            const initPrinter = Buffer.from([0x1b, 0x40]);
            const alignLeft = Buffer.from([0x1b, 0x61, 0x00]);
            const alignCenter = Buffer.from([0x1b, 0x61, 0x01]);
            const alignRight = Buffer.from([0x1b, 0x61, 0x02]);
            const boldOn = Buffer.from([0x1b, 0x45, 0x01]);
            const boldOff = Buffer.from([0x1b, 0x45, 0x00]);
            const doubleSizeOn = Buffer.from([0x1d, 0x21, 0x11]);
            const normalSize = Buffer.from([0x1d, 0x21, 0x00]);
            const cutPaper = Buffer.from([0x1d, 0x56, 0x00]);
            const nl = (count = 1) => Buffer.from("\n".repeat(count), "ascii");
            const txt = (value) => Buffer.from(String(value || ""), "ascii");

            const items = Array.isArray(detailedproduct) ? detailedproduct : [];

            const computedTotalSales = items.reduce((total, item) => {
              const price = safeNumber(item?.selling_price);
              const quantity = safeNumber(item?.sales_quantity);
              return total + price * quantity;
            }, 0);

            const discount = safeNumber(transaction?.Discount);
            const amountDue = computedTotalSales - discount;

            const billingRows = [
              ["Trans No", transaction?.transaction_id || "N/A"],
              ["Billing No", transaction?.billing_no || "N/A"],
              ["Trans Date", transaction?.transaction_date || "N/A"],
              ["Trans Time", transaction?.transaction_time || "N/A"],
              ["Terminal No", transaction?.terminal_number || "N/A"],
              ["Order Type", transaction?.order_type || "N/A"],
              ["Ref Tag", transaction?.table_number || "N/A"],
              ["Cashier", transaction?.cashier || "N/A"],
            ];

            chunks.push(initPrinter);

            // Header
            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(txt("CRABS N CRACK SEAFOOD HOUSE"));
            chunks.push(nl());
            chunks.push(txt("AND SHAKING CRABS - GUIGUINTO"));
            chunks.push(nl());
            chunks.push(boldOff);

            chunks.push(txt("ARU FOOD CORP."));
            chunks.push(nl());
            chunks.push(txt("PLARIDEL BYPASS ROAD TIAONG GUIGUINTO"));
            chunks.push(nl());
            chunks.push(txt("BULACAN"));
            chunks.push(nl());
            chunks.push(txt("VAT REG TIN: 634-742-586-00013"));
            chunks.push(nl());
            chunks.push(txt("MIN: 26032413224205435"));
            chunks.push(nl());
            chunks.push(txt("S/N: 2510AI5508128156WL24026"));
            chunks.push(nl());

            chunks.push(txt(repeat("-", LINE_WIDTH)));
            chunks.push(nl());

            chunks.push(alignCenter);
            chunks.push(boldOn);
            chunks.push(doubleSizeOn);
            chunks.push(txt("BILLING"));
            chunks.push(nl());
            chunks.push(normalSize);
            chunks.push(boldOff);

            // Billing details
            chunks.push(alignLeft);
            billingRows.forEach(([label, value]) => {
              chunks.push(txt(formatLeftRight(`${label}:`, value)));
              chunks.push(nl());
            });

            chunks.push(txt(repeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // Items table
            chunks.push(boldOn);
            chunks.push(txt(formatItemRow("Item", "Qty", "Amt")));
            chunks.push(nl());
            chunks.push(boldOff);

            if (!items.length) {
              chunks.push(alignCenter);
              chunks.push(txt("No items"));
              chunks.push(nl());
              chunks.push(alignLeft);
            } else {
              items.forEach((item) => {
                const name = String(item?.item_name || "");
                const qty =
                  `${item?.sales_quantity || 0} ${item?.unit_of_measure || ""}`.trim();
                const lineTotal =
                  safeNumber(item?.selling_price) *
                  safeNumber(item?.sales_quantity);
                const amt = peso(lineTotal);

                const nameLines = wrapText(name, 16);

                nameLines.forEach((line, index) => {
                  if (index === 0) {
                    chunks.push(txt(formatItemRow(line, qty, amt)));
                  } else {
                    chunks.push(txt(line));
                  }
                  chunks.push(nl());
                });
              });
            }

            chunks.push(txt(repeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // Totals
            chunks.push(
              txt(formatLeftRight("Total Sales:", peso(computedTotalSales))),
            );
            chunks.push(nl());
            chunks.push(txt(formatLeftRight("Discount:", peso(discount))));
            chunks.push(nl());

            chunks.push(boldOn);
            chunks.push(doubleSizeOn);
            chunks.push(txt(formatLeftRight("Amount Due:", peso(amountDue))));
            chunks.push(nl());
            chunks.push(normalSize);
            chunks.push(boldOff);

            chunks.push(txt(repeat("-", LINE_WIDTH)));
            chunks.push(nl());

            // Customer section
            chunks.push(txt("Customer Name:"));
            chunks.push(nl());
            chunks.push(txt("Customer ID:"));
            chunks.push(nl());
            chunks.push(txt("TIN:"));
            chunks.push(nl());
            chunks.push(txt("Address:"));
            chunks.push(nl());
            chunks.push(txt("Customer Signature:"));
            chunks.push(nl());
            chunks.push(txt("_______________________________"));
            chunks.push(nl(3));

            chunks.push(cutPaper);

            const payload = Buffer.concat(chunks);

            client.write(payload, (err) => {
              if (err) {
                console.error("[ESC/POS BILLING] Write error:", err);
                return done({
                  success: false,
                  message: err?.message || "Failed to write billing to printer",
                });
              }

              client.end();
            });
          } catch (error) {
            console.error("[ESC/POS BILLING] Build/print error:", error);
            done({
              success: false,
              message: error?.message || "ESC/POS billing print failed",
            });
          }
        });

        client.on("timeout", () => {
          console.error("[ESC/POS BILLING] Socket timeout");
          done({
            success: false,
            message: "Billing printer socket timeout",
          });
        });

        client.on("error", (err) => {
          console.error("[ESC/POS BILLING] Socket error:", err);
          done({
            success: false,
            message: err?.message || "Billing printer connection error",
          });
        });

        client.on("close", () => {
          console.log("[ESC/POS BILLING] Connection closed");
          done({
            success: true,
            message: "Billing printed successfully",
          });
        });

        client.connect(port, host);
      });
    } catch (error) {
      console.error("ESC/POS billing print error:", error);
      return {
        success: false,
        message: error?.message || "ESC/POS billing print failed",
      };
    }
  });

  ipcMain.handle("get-api-host", () => {
    try {
      const ipPath = getIpFilePath();
      console.log("Reading ip.txt from:", ipPath);
      return readTextFileSafe(ipPath);
    } catch (error) {
      console.error("Failed to read ip.txt:", error);
      return "";
    }
  });

  ipcMain.handle("get-default-printer-name", () => {
    try {
      return getDefaultPrinterNameFromFile();
    } catch (error) {
      console.error("Failed to read printer.txt:", error);
      return "";
    }
  });

  ipcMain.handle("get-business-info", () => {
    try {
      const businessInfoPath = getBusinessInfoFilePath();
      console.log("Reading businessInfo.json from:", businessInfoPath);
      return readJsonFileSafe(businessInfoPath, DEFAULT_BUSINESS_INFO);
    } catch (error) {
      console.error("Failed to read businessInfo.json:", error);
      return DEFAULT_BUSINESS_INFO;
    }
  });

  ipcMain.handle("save-business-info", async (_event, payload) => {
    try {
      const businessInfoPath = getBusinessInfoFilePath();
      const previousData = readJsonFileSafe(
        businessInfoPath,
        DEFAULT_BUSINESS_INFO,
      );
      const safePayload = normalizeBusinessInfo(payload);

      const backupPath = createBusinessInfoBackup(previousData);
      const ok = writeJsonFileSafe(businessInfoPath, safePayload);

      if (!ok) {
        return {
          success: false,
          message: "Failed to save businessInfo.json",
        };
      }

      return {
        success: true,
        message: "Business information saved successfully.",
        data: safePayload,
        backupPath,
      };
    } catch (error) {
      console.error("Failed to save businessInfo.json:", error);
      return {
        success: false,
        message: error?.message || "Failed to save business info.",
      };
    }
  });

  ipcMain.handle("reset-business-info-defaults", async () => {
    try {
      const businessInfoPath = getBusinessInfoFilePath();
      const previousData = readJsonFileSafe(
        businessInfoPath,
        DEFAULT_BUSINESS_INFO,
      );

      const backupPath = createBusinessInfoBackup(previousData);
      const ok = writeJsonFileSafe(businessInfoPath, DEFAULT_BUSINESS_INFO);

      if (!ok) {
        return {
          success: false,
          message: "Failed to reset business info defaults.",
        };
      }

      return {
        success: true,
        message: "Business information reset to defaults.",
        data: DEFAULT_BUSINESS_INFO,
        backupPath,
      };
    } catch (error) {
      console.error("Failed to reset business info:", error);
      return {
        success: false,
        message: error?.message || "Failed to reset business info.",
      };
    }
  });

  ipcMain.handle("get-printers", async () => {
    try {
      const targetWindow = BrowserWindow.getFocusedWindow() || win;
      const printers = await getPrintersFromWindow(targetWindow);

      console.log(
        "Electron printers from main:",
        printers.map((p) => ({
          name: p.name,
          displayName: p.displayName,
        })),
      );

      return printers.map(mapPrinterInfo);
    } catch (error) {
      console.error("Failed to get printers:", error);
      return [];
    }
  });

  ipcMain.handle("print-receipt", async (_event, payload) => {
    let printWindow = null;

    try {
      const {
        html = "",
        printerName = "",
        silent = true,
        copies = 1,
      } = payload || {};

      const printerFromFile = getDefaultPrinterNameFromFile();

      const resolvedPrinterName =
        String(printerName || "").trim() ||
        String(printerFromFile || "").trim();

      console.log("print-receipt payload:", {
        printerName,
        printerFromFile,
        resolvedPrinterName,
        silent,
        copies,
        hasHtml: Boolean(html),
      });

      if (!html || typeof html !== "string") {
        return {
          success: false,
          message: "Missing receipt HTML.",
        };
      }

      if (!resolvedPrinterName) {
        return {
          success: false,
          message: "No printer name provided and printer.txt is empty.",
        };
      }

      printWindow = new BrowserWindow({
        show: false,
        width: RECEIPT_WINDOW_WIDTH_PX,
        height: MIN_PRINT_WINDOW_HEIGHT_PX,
        autoHideMenuBar: true,
        backgroundColor: "#ffffff",
        icon: app.isPackaged
          ? path.join(process.resourcesPath, "icon.ico")
          : path.join(__dirname, "..", "build", "icon.ico"),
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });

      printWindow.webContents.on(
        "did-fail-load",
        (_event2, errorCode, errorDescription, validatedURL) => {
          console.error("Print window did-fail-load:", {
            errorCode,
            errorDescription,
            validatedURL,
          });
        },
      );

      await printWindow.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(html),
      );

      await waitForReceiptLayout(printWindow);

      const metricsBeforeResize = await getReceiptMetrics(printWindow);

      const measuredContentHeightBeforeResize = Math.max(
        metricsBeforeResize.bodyScrollHeight,
        metricsBeforeResize.bodyOffsetHeight,
        metricsBeforeResize.docScrollHeight,
        metricsBeforeResize.docOffsetHeight,
        metricsBeforeResize.bodyRectHeight,
      );

      await resizePrintWindowToContent(
        printWindow,
        measuredContentHeightBeforeResize,
      );

      await waitForReceiptLayout(printWindow);

      const metricsAfterResize = await getReceiptMetrics(printWindow);

      const measuredContentHeightPx =
        Math.max(
          metricsBeforeResize.bodyScrollHeight,
          metricsBeforeResize.bodyOffsetHeight,
          metricsBeforeResize.docScrollHeight,
          metricsBeforeResize.docOffsetHeight,
          metricsBeforeResize.bodyRectHeight,
          metricsAfterResize.bodyScrollHeight,
          metricsAfterResize.bodyOffsetHeight,
          metricsAfterResize.docScrollHeight,
          metricsAfterResize.docOffsetHeight,
          metricsAfterResize.bodyRectHeight,
        ) + EXTRA_PAGE_HEIGHT_PX;

      const customPageHeightMicrons = clamp(
        cssPxToMicrons(measuredContentHeightPx),
        MIN_RECEIPT_HEIGHT_MICRONS,
        MAX_RECEIPT_HEIGHT_MICRONS,
      );

      console.log("Receipt layout metrics:", {
        before: metricsBeforeResize,
        after: metricsAfterResize,
        measuredContentHeightPx,
        customPageHeightMicrons,
      });

      await delay(300);

      const visiblePrinters = await getPrintersFromWindow(printWindow);
      const visiblePrinterNames = visiblePrinters.map((p) => p.name);

      console.log("Printers visible from printWindow:", visiblePrinterNames);

      const matchedPrinter = visiblePrinters.find(
        (p) => p.name === resolvedPrinterName,
      );

      if (!matchedPrinter) {
        return {
          success: false,
          message: `Printer not found in print window: ${resolvedPrinterName}`,
          availablePrinters: visiblePrinterNames,
        };
      }

      const customPrintOptions = {
        silent,
        deviceName: resolvedPrinterName,
        copies,
        printBackground: true,
        margins: {
          marginType: "none",
        },
        pageSize: {
          width: RECEIPT_WIDTH_MICRONS,
          height: customPageHeightMicrons,
        },
      };

      let result = await printWithOptions(printWindow, customPrintOptions);

      console.log("Custom print result:", {
        result,
        customPrintOptions,
      });

      if (!result.success) {
        const fallbackPrintOptions = {
          silent,
          deviceName: resolvedPrinterName,
          copies,
          printBackground: true,
          margins: {
            marginType: "none",
          },
          usePrinterDefaultPageSize: true,
        };

        await delay(250);

        result = await printWithOptions(printWindow, fallbackPrintOptions);

        console.log("Fallback print result:", {
          result,
          fallbackPrintOptions,
        });
      }

      if (!result.success) {
        return {
          success: false,
          message: result.failureReason || "Print failed.",
        };
      }

      await delay(1000);

      return {
        success: true,
        message: "Printed successfully.",
        printerName: resolvedPrinterName,
      };
    } catch (error) {
      console.error("Print receipt error:", error);
      return {
        success: false,
        message: error?.message || "Unexpected print error.",
      };
    } finally {
      try {
        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.close();
        }
      } catch (closeError) {
        console.error("Error while closing print window:", closeError);
      }
    }
  });

  ipcMain.on("close-app", () => {
    app.quit();
  });

  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
