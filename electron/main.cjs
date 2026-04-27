const { app, BrowserWindow, ipcMain, protocol, session } = require("electron");

const { spawn } = require("child_process");
const net = require("net");
const os = require("os");
function getSerialPort() {
  return require("serialport").SerialPort;
}

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

process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

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

function stripWindowsPrinterPrefix(value = "") {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  const prefixes = ["windows:", "win:", "system:", "spooler:", "printer:"];

  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      return raw.slice(prefix.length).trim();
    }
  }

  return raw;
}

function isEscposConnectionText(value = "") {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();

  return (
    lower.startsWith("network:") ||
    lower.startsWith("bt:") ||
    lower.startsWith("usb:") ||
    lower === "usb" ||
    /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(raw)
  );
}

function normalizeSystemPrinterName(value = "") {
  const raw = stripWindowsPrinterPrefix(value);
  return isEscposConnectionText(raw) ? "" : raw;
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

function getConfiguredPrinterTextFromFile() {
  const printerPath = getPrinterFilePath();
  console.log("Reading printer.txt from:", printerPath);
  return readTextFileSafe(printerPath);
}

function getDefaultPrinterNameFromFile() {
  return normalizeSystemPrinterName(getConfiguredPrinterTextFromFile());
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

async function resolveWindowsPrinterName(preferredPrinterName = "") {
  const candidates = [
    normalizeSystemPrinterName(preferredPrinterName),
    getDefaultPrinterNameFromFile(),
  ].filter(Boolean);

  let printers = [];
  try {
    const targetWindow = BrowserWindow.getFocusedWindow() || win;
    printers = await getPrintersFromWindow(targetWindow);
  } catch (error) {
    console.error("Failed to resolve Windows printer list:", error);
  }

  for (const candidate of candidates) {
    const matchedPrinter = printers.find(
      (printer) =>
        String(printer?.name || "").trim() === String(candidate || "").trim(),
    );

    if (matchedPrinter?.name) {
      return matchedPrinter.name;
    }
  }

  const defaultPrinter = printers.find((printer) => printer?.isDefault);
  if (defaultPrinter?.name) return defaultPrinter.name;

  return candidates[0] || "";
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
      return "192.168.100.83"; // fallback default
    }

    const host = fs.readFileSync(printerFilePath, "utf8").trim();

    if (!host) {
      console.warn(
        "[ESC/POS PRINT] printer.txt is empty. Using fallback host.",
      );
      return "192.168.100.83";
    }

    console.log(`[ESC/POS PRINT] Loaded printer host from file: ${host}`);
    return host;
  } catch (error) {
    console.error("[ESC/POS PRINT] Failed to read printer.txt:", error);
    return "192.168.100.83"; // fallback default
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
      host: "192.168.100.83",
      port: 9100,
    };
  }

  // supports:
  // "192.168.100.83"
  // "192.168.100.83:9100"
  // "EPSON@192.168.100.83:9100"
  const afterAt = raw.includes("@") ? raw.split("@").pop() : raw;
  const [hostPart, portPart] = String(afterAt).split(":");

  return {
    host: hostPart || "192.168.100.83",
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
function peso(value) {
  return Number(value || 0).toFixed(2);
}

function escposSafe(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[^\x20-\x7E\n]/g, "")
    .trim();
}

function wrapText(text, width = 32) {
  const input = escposSafe(text);
  if (!input) return [""];

  const words = input.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      if (word.length <= width) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
      }
      continue;
    }

    if ((current + " " + word).length <= width) {
      current += " " + word;
    } else {
      lines.push(current);
      if (word.length <= width) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += width) {
          const chunk = word.slice(i, i + width);
          if (chunk.length === width || i + width < word.length) {
            lines.push(chunk);
          } else {
            current = chunk;
          }
        }
      }
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function centerText(text, width = 32) {
  const str = escposSafe(text);
  if (str.length >= width) return str.slice(0, width);
  const pad = Math.floor((width - str.length) / 2);
  return " ".repeat(pad) + str;
}

function formatLeftRight(left, right, width = 32) {
  const l = escposSafe(left);
  const r = escposSafe(right);

  if (l.length + r.length + 1 <= width) {
    return l + " ".repeat(width - l.length - r.length) + r;
  }

  const leftWidth = Math.max(0, width - r.length - 1);
  return l.slice(0, leftWidth) + " " + r;
}

function line(width = 32) {
  return "-".repeat(width);
}

function txt(value) {
  return Buffer.from(String(value), "ascii");
}

function nl(count = 1) {
  return Buffer.from("\n".repeat(count), "ascii");
}

function pushRow(chunks, label, value, width = 32) {
  chunks.push(txt(formatLeftRight(label, value, width)));
  chunks.push(nl());
}

function pushWrappedRow(chunks, label, value, width = 32) {
  const right = escposSafe(value);
  const leftLines = wrapText(label, Math.max(8, width - right.length - 1));

  if (!leftLines.length) {
    pushRow(chunks, "", right, width);
    return;
  }

  pushRow(chunks, leftLines[0], right, width);

  for (let i = 1; i < leftLines.length; i++) {
    chunks.push(txt(leftLines[i]));
    chunks.push(nl());
  }
}

function pushCentered(chunks, value, width = 32, bold = false) {
  const lines = wrapText(value, width);
  if (bold) chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  lines.forEach((lineText) => {
    chunks.push(txt(centerText(lineText, width)));
    chunks.push(nl());
  });
  if (bold) chunks.push(Buffer.from([0x1b, 0x45, 0x00]));
}

function buildHeaderChunks(data, title, width = 32) {
  const chunks = [];

  pushCentered(chunks, data.companyName || "", width, true);
  pushCentered(chunks, data.storeName || "", width, false);
  pushCentered(chunks, data.corpName || "", width, false);
  pushCentered(chunks, data.address || "", width, false);
  pushCentered(chunks, `TIN: ${data.tin || ""}`, width, false);
  pushCentered(chunks, `MIN: ${data.machineNumber || ""}`, width, false);
  pushCentered(chunks, `S/N: ${data.serialNumber || ""}`, width, false);
  chunks.push(nl());
  pushCentered(chunks, title, width, true);
  chunks.push(txt(line(width)));
  chunks.push(nl());

  return chunks;
}

function buildXReadingEscposBuffer(data = {}) {
  const width = 32;
  const chunks = [];
  const otherPaymentsBreakdown = Array.isArray(data?.otherPaymentsBreakdown)
    ? data.otherPaymentsBreakdown
    : Array.isArray(data?.paymentBreakdown)
      ? data.paymentBreakdown
      : [];

  chunks.push(Buffer.from([0x1b, 0x40]));
  chunks.push(...buildHeaderChunks(data, "X-READING", width));

  pushRow(chunks, "Report Date", data.reportDate || "", width);
  pushRow(chunks, "Report Time", data.reportTime || "", width);
  pushWrappedRow(chunks, "Start Date/Time", data.startDateTime || "", width);
  pushWrappedRow(chunks, "End Date/Time", data.endDateTime || "", width);
  pushWrappedRow(chunks, "Cashier", data.cashier || "", width);
  pushRow(chunks, "Beg. INV.", data.begOR || "", width);
  pushRow(chunks, "End INV.", data.endOR || "", width);

  chunks.push(txt(line(width)));
  chunks.push(nl());

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  chunks.push(txt("PAYMENTS"));
  chunks.push(nl());
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  pushRow(chunks, "Opening Fund", peso(data.openingFund), width);
  pushRow(chunks, "Cash", peso(data.cash), width);
  pushRow(chunks, "Cheque", peso(data.cheque), width);
  pushRow(chunks, "Credit Card", peso(data.creditCard), width);
  pushRow(
    chunks,
    "Other Payments",
    peso(data.otherPaymentsTotal ?? data.otherPayments),
    width,
  );

  if (otherPaymentsBreakdown.length > 0) {
    otherPaymentsBreakdown.forEach((item) => {
      pushWrappedRow(
        chunks,
        `- ${item?.payment_method || "Other"}`,
        peso(item?.payment_amount || 0),
        width,
      );
    });
  } else {
    pushRow(chunks, "- None", peso(0), width);
  }

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  pushRow(chunks, "Total Payments", peso(data.totalPayments), width);
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  pushRow(chunks, "Void", peso(data.void), width);
  pushRow(chunks, "Refund", peso(data.refund), width);
  pushRow(chunks, "Withdrawal", peso(data.withdrawal), width);

  chunks.push(txt(line(width)));
  chunks.push(nl());

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  chunks.push(txt("SUMMARY"));
  chunks.push(nl());
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  pushRow(chunks, "Cash In Drawer", peso(data.summaryCashInDrawer), width);
  pushRow(chunks, "Cheque", peso(data.summaryCheque), width);
  pushRow(chunks, "Credit Card", peso(data.summaryCreditCard), width);
  pushRow(chunks, "Other Payments", peso(data.summaryOtherPayments), width);
  pushRow(chunks, "Opening Fund", peso(data.summaryOpeningFund), width);
  pushRow(chunks, "Withdrawal", peso(data.summaryWithdrawal), width);
  pushRow(
    chunks,
    "Payments Received",
    peso(data.summaryPaymentsReceived),
    width,
  );

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  pushRow(chunks, "Short / Over", peso(data.summaryShortOver), width);
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  chunks.push(nl(4));
  chunks.push(Buffer.from([0x1d, 0x56, 0x00]));

  return Buffer.concat(chunks);
}

function buildZReadingEscposBuffer(data = {}) {
  const width = 32;
  const chunks = [];
  const vatExemptionValue =
    data.vatExemption ?? data.lessVatExemption ?? data.vatExemptVat ?? 0;

  chunks.push(Buffer.from([0x1b, 0x40]));
  chunks.push(...buildHeaderChunks(data, "Z-READING", width));

  pushRow(chunks, "Date Issued", data.reportDate || "", width);
  pushRow(chunks, "Time", data.reportTime || "", width);
  pushRow(chunks, "Beg SI No.", data.begSI || "", width);
  pushRow(chunks, "End SI No.", data.endSI || "", width);
  pushRow(chunks, "Beg Void No.", data.begVoid || "", width);
  pushRow(chunks, "End Void No.", data.endVoid || "", width);
  pushRow(chunks, "Beg Return No.", data.begReturn || "", width);
  pushRow(chunks, "End Return No.", data.endReturn || "", width);
  pushRow(chunks, "Reset Counter No.", String(data.resetCounterNo || 0), width);
  pushRow(chunks, "Z Counter No.", String(data.zCounterNo || 0), width);

  chunks.push(txt(line(width)));
  chunks.push(nl());

  pushRow(
    chunks,
    "Present Accum. Sales",
    peso(data.presentAccumulatedSales),
    width,
  );
  pushRow(
    chunks,
    "Previous Accum. Sales",
    peso(data.previousAccumulatedSales),
    width,
  );
  pushRow(chunks, "Sales for the Day", peso(data.salesForTheDay), width);

  chunks.push(txt(line(width)));
  chunks.push(nl());

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  chunks.push(txt("BREAKDOWN OF SALES"));
  chunks.push(nl());
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  pushRow(chunks, "VATABLE SALES", peso(data.vatableSales), width);
  pushRow(chunks, "VAT AMOUNT", peso(data.vatAmount), width);
  pushRow(chunks, "VAT-EXEMPT SALES", peso(data.vatExemptSales), width);
  pushRow(chunks, "VAT EXEMPTION", peso(vatExemptionValue), width);
  pushRow(chunks, "ZERO RATED SALES", peso(data.zeroRatedSales), width);
  pushRow(chunks, "OTHER CHARGES", peso(data.otherCharges), width);

  chunks.push(txt(line(width)));
  chunks.push(nl());

  pushRow(chunks, "Gross Amount", peso(data.grossAmount), width);
  pushRow(chunks, "Discount", peso(data.lessDiscount), width);
  pushRow(chunks, "VAT Exemption", peso(vatExemptionValue), width);
  pushRow(chunks, "Refund", peso(data.lessReturn), width);
  pushRow(chunks, "Void", peso(data.lessVoid), width);
  pushRow(chunks, "VAT Adjustment", peso(data.lessVatAdjustment), width);

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  pushRow(chunks, "Net Amount", peso(data.netAmount), width);
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  chunks.push(txt(line(width)));
  chunks.push(nl());

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  chunks.push(txt("DISCOUNT SUMMARY"));
  chunks.push(nl());
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  pushRow(chunks, "SC Disc", peso(data.scDisc), width);
  pushRow(chunks, "PWD Disc", peso(data.pwdDisc), width);
  pushRow(chunks, "NAAC Disc", peso(data.naacDisc), width);
  pushRow(chunks, "Solo Parent Disc", peso(data.soloParentDisc), width);
  pushRow(chunks, "Other Disc", peso(data.otherDisc), width);

  chunks.push(txt(line(width)));
  chunks.push(nl());

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  chunks.push(txt("SALES ADJUSTMENT"));
  chunks.push(nl());
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  pushRow(chunks, "Void", peso(data.salesAdjustmentVoid), width);
  pushRow(chunks, "Return", peso(data.salesAdjustmentReturn), width);

  chunks.push(txt(line(width)));
  chunks.push(nl());

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  chunks.push(txt("VAT ADJUSTMENT"));
  chunks.push(nl());
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  pushRow(chunks, "SC Trans VAT Adj", peso(data.scTransVatAdj), width);
  pushRow(chunks, "PWD Trans VAT Adj", peso(data.pwdTransVatAdj), width);
  pushRow(
    chunks,
    "Reg Disc Trans VAT Adj",
    peso(data.regDiscTransVatAdj),
    width,
  );
  pushRow(
    chunks,
    "Zero Rated Trans VAT Adj",
    peso(data.zeroRatedTransVatAdj),
    width,
  );
  pushRow(chunks, "VAT on Return", peso(data.vatOnReturn), width);
  pushRow(chunks, "Other VAT Adj", peso(data.otherVatAdjustments), width);

  chunks.push(txt(line(width)));
  chunks.push(nl());

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  chunks.push(txt("TRANSACTION SUMMARY"));
  chunks.push(nl());
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  pushRow(chunks, "Cash In Drawer", peso(data.cashInDrawer), width);
  pushRow(chunks, "Cheque", peso(data.cheque), width);
  pushRow(chunks, "Credit Card", peso(data.creditCard), width);
  pushRow(chunks, "Other Payments", peso(data.otherPayments), width);
  pushRow(chunks, "Opening Fund", peso(data.openingFund), width);
  pushRow(chunks, "Less Withdrawal", peso(data.lessWithdrawal), width);
  pushRow(chunks, "Payments Received", peso(data.paymentsReceived), width);

  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  pushRow(chunks, "Short / Over", peso(data.shortOver), width);
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  chunks.push(nl(4));
  chunks.push(Buffer.from([0x1d, 0x56, 0x00]));

  return Buffer.concat(chunks);
}

function getEscposUsbAdapter() {
  return require("escpos-usb");
}

function formatUsbTarget(vendorId, productId) {
  if (vendorId === null || vendorId === undefined) return "first USB printer";

  const toHex = (value) =>
    `0x${Number(value || 0)
      .toString(16)
      .padStart(4, "0")}`;

  return `${toHex(vendorId)}:${toHex(productId)}`;
}

function closeEscposUsbDevice(device) {
  return new Promise((resolve) => {
    if (!device) return resolve();

    try {
      device.close(() => resolve());
    } catch {
      resolve();
    }
  });
}

function writeBufferToEscposUsb({
  vendorId = null,
  productId = null,
  buffer,
  timeout = 7000,
}) {
  return new Promise((resolve) => {
    let device = null;
    let finished = false;

    const target = formatUsbTarget(vendorId, productId);
    const timer = setTimeout(() => {
      done({
        success: false,
        type: "usb",
        message: `USB printer write timed out (${target}).`,
        vendorId,
        productId,
      });
    }, timeout);

    const done = async (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      await closeEscposUsbDevice(device);
      resolve(result);
    };

    try {
      const USB = getEscposUsbAdapter();
      device =
        vendorId !== null && productId !== null
          ? new USB(vendorId, productId)
          : new USB();

      device.open((openErr) => {
        if (openErr) {
          return done({
            success: false,
            type: "usb",
            message: `Cannot open USB ESC/POS printer (${target}).`,
            error: openErr.message,
            vendorId,
            productId,
          });
        }

        device.write(buffer, (writeErr) => {
          if (writeErr) {
            return done({
              success: false,
              type: "usb",
              message: `USB ESC/POS print write failed (${target}).`,
              error: writeErr.message,
              vendorId,
              productId,
            });
          }

          return done({
            success: true,
            type: "usb",
            message: `Printed successfully via USB ESC/POS (${target}).`,
            vendorId,
            productId,
          });
        });
      });
    } catch (error) {
      return done({
        success: false,
        type: "usb",
        message: `USB ESC/POS print failed (${target}).`,
        error: error.message,
        vendorId,
        productId,
      });
    }
  });
}

function checkEscposUsbConnection(vendorId = null, productId = null) {
  return writeBufferToEscposUsb({
    vendorId,
    productId,
    buffer: Buffer.from([0x1b, 0x40]),
    timeout: 5000,
  }).then((result) => ({
    ...result,
    message: result.success
      ? `USB ESC/POS printer reachable (${formatUsbTarget(vendorId, productId)}).`
      : result.message,
  }));
}

const WINDOWS_RAW_PRINT_SCRIPT = `
$ErrorActionPreference = "Stop"

$printerName = $env:RAW_PRINT_PRINTER
$filePath = $env:RAW_PRINT_FILE

if ([string]::IsNullOrWhiteSpace($printerName)) {
  throw "RAW_PRINT_PRINTER is empty."
}

if ([string]::IsNullOrWhiteSpace($filePath) -or -not (Test-Path -LiteralPath $filePath)) {
  throw "Raw print file not found: $filePath"
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)]
    public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)]
    public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)]
    public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

  public static void SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter;

    if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero)) {
      throw new Exception("OpenPrinter failed: " + Marshal.GetLastWin32Error());
    }

    DOCINFOA di = new DOCINFOA();
    di.pDocName = "ESC/POS Receipt";
    di.pDataType = "RAW";

    IntPtr pUnmanagedBytes = IntPtr.Zero;

    try {
      if (!StartDocPrinter(hPrinter, 1, di)) {
        throw new Exception("StartDocPrinter failed: " + Marshal.GetLastWin32Error());
      }

      try {
        if (!StartPagePrinter(hPrinter)) {
          throw new Exception("StartPagePrinter failed: " + Marshal.GetLastWin32Error());
        }

        pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

        Int32 dwWritten = 0;
        if (!WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten)) {
          throw new Exception("WritePrinter failed: " + Marshal.GetLastWin32Error());
        }

        if (dwWritten != bytes.Length) {
          throw new Exception("Only wrote " + dwWritten + " of " + bytes.Length + " bytes.");
        }

        EndPagePrinter(hPrinter);
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      if (pUnmanagedBytes != IntPtr.Zero) {
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
      }

      ClosePrinter(hPrinter);
    }
  }
}
"@

[byte[]]$bytes = [System.IO.File]::ReadAllBytes($filePath)
[RawPrinterHelper]::SendBytes($printerName, $bytes)
`;

const WINDOWS_RAW_PRINT_ENCODED_COMMAND = Buffer.from(
  WINDOWS_RAW_PRINT_SCRIPT,
  "utf16le",
).toString("base64");

function writeBufferToWindowsRawPrinter({
  printerName,
  buffer,
  timeout = 20000,
}) {
  return new Promise((resolve) => {
    const rawPrinterName = normalizeSystemPrinterName(printerName);

    if (process.platform !== "win32") {
      return resolve({
        success: false,
        type: "windows-raw",
        message: "Windows RAW printer fallback is only available on Windows.",
      });
    }

    if (!rawPrinterName) {
      return resolve({
        success: false,
        type: "windows-raw",
        message: "No Windows printer name is available for USB fallback.",
      });
    }

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return resolve({
        success: false,
        type: "windows-raw",
        message: "No ESC/POS data was provided for Windows RAW printing.",
      });
    }

    const tempDir = (() => {
      try {
        return app.getPath("temp");
      } catch {
        return os.tmpdir();
      }
    })();
    const rawFilePath = path.join(
      tempDir,
      `restobill-escpos-${process.pid}-${Date.now()}.bin`,
    );

    let child = null;
    let finished = false;
    let stdout = "";
    let stderr = "";

    const cleanup = () => {
      try {
        fs.unlinkSync(rawFilePath);
      } catch {}
    };

    const done = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };

    const timer = setTimeout(() => {
      try {
        child?.kill();
      } catch {}

      done({
        success: false,
        type: "windows-raw",
        printerName: rawPrinterName,
        message: `Windows RAW print timed out (${rawPrinterName}).`,
      });
    }, timeout);

    try {
      fs.writeFileSync(rawFilePath, buffer);

      child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-EncodedCommand",
          WINDOWS_RAW_PRINT_ENCODED_COMMAND,
        ],
        {
          windowsHide: true,
          env: {
            ...process.env,
            RAW_PRINT_FILE: rawFilePath,
            RAW_PRINT_PRINTER: rawPrinterName,
          },
        },
      );

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        done({
          success: false,
          type: "windows-raw",
          printerName: rawPrinterName,
          message: `Windows RAW print failed (${rawPrinterName}).`,
          error: error.message,
        });
      });

      child.on("close", (code) => {
        if (code === 0) {
          return done({
            success: true,
            type: "windows-raw",
            printerName: rawPrinterName,
            message: `Printed successfully via Windows USB printer (${rawPrinterName}).`,
          });
        }

        return done({
          success: false,
          type: "windows-raw",
          printerName: rawPrinterName,
          message:
            stderr.trim() ||
            stdout.trim() ||
            `Windows RAW print failed with exit code ${code}.`,
        });
      });
    } catch (error) {
      return done({
        success: false,
        type: "windows-raw",
        printerName: rawPrinterName,
        message: `Windows RAW print failed (${rawPrinterName}).`,
        error: error.message,
      });
    }
  });
}

function writeBufferToEscposTcp({ host, port = 9100, buffer, timeout = 5000 }) {
  return new Promise((resolve) => {
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

    client.setTimeout(timeout);

    client.on("connect", () => {
      client.write(buffer, (err) => {
        if (err) {
          return done({
            success: false,
            message: err.message || "Failed to write ESC/POS buffer.",
          });
        }

        client.end();
      });
    });

    client.on("timeout", () => {
      done({
        success: false,
        message: `Printer connection timed out (${host}:${port}).`,
      });
    });

    client.on("error", (err) => {
      done({
        success: false,
        message: err.message || "Printer connection failed.",
      });
    });

    client.on("close", () => {
      done({
        success: true,
        message: "Printed successfully.",
      });
    });

    client.connect(port, host);
  });
}

function parseEscposUsbId(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^0x[0-9a-f]+$/i.test(raw)) {
    return parseInt(raw, 16);
  }

  if (/^[0-9a-f]+$/i.test(raw) && /[a-f]/i.test(raw)) {
    return parseInt(raw, 16);
  }

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

// printer.txt rules:
//   192.168.100.83              -> WiFi/network printer on port 9100
//   network:192.168.100.83:9100 -> WiFi/network printer with explicit port
//   bt:COM3                     -> Bluetooth serial printer on COM3
//   usb:auto                    -> first USB ESC/POS printer discovered
//   usb:VID=0x0483,PID=0x070b   -> USB ESC/POS printer by vendor/product ID
//   windows:POS-80C             -> Windows-installed USB printer queue
function parsePrinterConnection(value = "") {
  const raw = String(value || "").trim();

  if (!raw) {
    return {
      type: "network",
      host: "192.168.100.83",
      port: 9100,
    };
  }

  const lower = raw.toLowerCase();

  if (lower === "usb") {
    return {
      type: "usb",
      vendorId: null,
      productId: null,
    };
  }

  const prefixedWindowsPrinterName = [
    "windows:",
    "win:",
    "system:",
    "spooler:",
    "printer:",
  ].find((prefix) => lower.startsWith(prefix));

  if (prefixedWindowsPrinterName) {
    const printerName = raw.slice(prefixedWindowsPrinterName.length).trim();

    if (!printerName) {
      throw new Error(
        "Invalid Windows printer format. Example: windows:POS-80C",
      );
    }

    return {
      type: "windows-raw",
      printerName,
    };
  }

  if (raw.toLowerCase().startsWith("network:")) {
    const payload = raw.slice("network:".length).trim();
    const [host, port] = payload.split(":");

    return {
      type: "network",
      host: host || "192.168.100.83",
      port: Number(port || 9100),
    };
  }

  if (raw.toLowerCase().startsWith("bt:")) {
    const portName = raw.slice("bt:".length).trim();

    if (!portName) {
      throw new Error("Invalid Bluetooth format. Example: bt:COM3");
    }

    return {
      type: "bluetooth",
      portName,
      baudRate: 9600,
    };
  }

  if (raw.toLowerCase().startsWith("usb:")) {
    const payload = raw.slice("usb:".length).trim();

    if (!payload || ["auto", "default", "first"].includes(payload.toLowerCase())) {
      return {
        type: "usb",
        vendorId: null,
        productId: null,
      };
    }

    const vidMatch = payload.match(/VID\s*=\s*(0x[0-9a-f]+|\d+)/i);
    const pidMatch = payload.match(/PID\s*=\s*(0x[0-9a-f]+|\d+)/i);
    const pairMatch = payload.match(
      /^\s*(0x[0-9a-f]+|[0-9a-f]+)\s*[:/,]\s*(0x[0-9a-f]+|[0-9a-f]+)\s*$/i,
    );

    const vendorId = parseEscposUsbId(vidMatch?.[1] || pairMatch?.[1]);
    const productId = parseEscposUsbId(pidMatch?.[1] || pairMatch?.[2]);

    if (vendorId === null || productId === null) {
      throw new Error(
        "Invalid USB format. Example: usb:VID=0x0483,PID=0x070b or usb:auto",
      );
    }

    return {
      type: "usb",
      vendorId,
      productId,
    };
  }

  const [host, port] = raw.split(":");
  return {
    type: "network",
    host: host || "192.168.100.83",
    port: Number(port || 9100),
  };
}

function getPrinterConnectionConfig() {
  const printerPath = getPrinterFilePath();
  const raw = readTextFileSafe(printerPath);
  return parsePrinterConnection(raw);
}

function checkEscposNetworkConnection(host, port = 9100, timeout = 5000) {
  return new Promise((resolve) => {
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

    client.setTimeout(timeout);

    client.on("connect", () => {
      done({
        success: true,
        type: "network",
        message: `WiFi/network ESC/POS printer reachable at ${host}:${port}`,
      });
    });

    client.on("timeout", () => {
      done({
        success: false,
        type: "network",
        message: `WiFi/network printer connection timed out (${host}:${port}).`,
      });
    });

    client.on("error", (err) => {
      done({
        success: false,
        type: "network",
        message: err.message || `WiFi/network printer connection failed (${host}:${port}).`,
      });
    });

    client.connect(port, host);
  });
}

function checkEscposBluetoothConnection(portName, baudRate = 9600) {
  return new Promise((resolve) => {
    let port;
    let finished = false;

    const done = (result) => {
      if (finished) return;
      finished = true;

      try {
        if (port?.isOpen) {
          return port.close(() => resolve(result));
        }
      } catch {}

      resolve(result);
    };

    try {
      const SerialPort = getSerialPort();
      port = new SerialPort({
        path: portName,
        baudRate,
        autoOpen: false,
      });

      port.open((openErr) => {
        if (openErr) {
          return done({
            success: false,
            type: "bluetooth",
            message: `Cannot open Bluetooth port ${portName}`,
            error: openErr.message,
          });
        }

        const initCommand = Buffer.from([0x1b, 0x40]);

        port.write(initCommand, (writeErr) => {
          if (writeErr) {
            return done({
              success: false,
              type: "bluetooth",
              message: `Bluetooth port opened but ESC/POS init failed on ${portName}`,
              error: writeErr.message,
            });
          }

          port.drain((drainErr) => {
            if (drainErr) {
              return done({
                success: false,
                type: "bluetooth",
                message: `Bluetooth port opened but drain failed on ${portName}`,
                error: drainErr.message,
              });
            }

            return done({
              success: true,
              type: "bluetooth",
              message: `Bluetooth ESC/POS printer reachable on ${portName}`,
            });
          });
        });
      });
    } catch (error) {
      return done({
        success: false,
        type: "bluetooth",
        message: `Bluetooth printer check failed for ${portName}`,
        error: error.message,
      });
    }
  });
}

function writeBufferToEscposBluetooth(portName, buffer, baudRate = 9600) {
  return new Promise((resolve) => {
    let port;
    let finished = false;

    const done = (result) => {
      if (finished) return;
      finished = true;

      try {
        if (port?.isOpen) {
          return port.close(() => resolve(result));
        }
      } catch {}

      resolve(result);
    };

    try {
      const SerialPort = getSerialPort();
      port = new SerialPort({
        path: portName,
        baudRate,
        autoOpen: false,
      });

      port.open((openErr) => {
        if (openErr) {
          return done({
            success: false,
            type: "bluetooth",
            message: `Cannot open Bluetooth port ${portName}`,
            error: openErr.message,
          });
        }

        port.write(buffer, (writeErr) => {
          if (writeErr) {
            return done({
              success: false,
              type: "bluetooth",
              message: `Bluetooth print write failed on ${portName}`,
              error: writeErr.message,
            });
          }

          port.drain((drainErr) => {
            if (drainErr) {
              return done({
                success: false,
                type: "bluetooth",
                message: `Bluetooth print drain failed on ${portName}`,
                error: drainErr.message,
              });
            }

            return done({
              success: true,
              type: "bluetooth",
              message: `Printed successfully via Bluetooth on ${portName}`,
            });
          });
        });
      });
    } catch (error) {
      return done({
        success: false,
        type: "bluetooth",
        message: `Bluetooth print failed on ${portName}`,
        error: error.message,
      });
    }
  });
}

async function writeEscposBufferToConfiguredTarget(config, buffer, options = {}) {
  if (config.type === "bluetooth") {
    return await writeBufferToEscposBluetooth(
      config.portName,
      buffer,
      config.baudRate,
    );
  }

  if (config.type === "usb") {
    return await writeBufferToEscposUsb({
      vendorId: config.vendorId,
      productId: config.productId,
      buffer,
    });
  }

  if (config.type === "windows-raw") {
    const printerName = await resolveWindowsPrinterName(
      config.printerName || options.printerName,
    );
    return await writeBufferToWindowsRawPrinter({
      printerName,
      buffer,
    });
  }

  return await writeBufferToEscposTcp({
    host: config.host,
    port: config.port,
    buffer,
  });
}

function formatPrintAttempt(label, result) {
  return `${label}: ${result?.message || result?.error || "failed"}`;
}

function buildPrintFailureMessage(primaryResult, fallbackResults) {
  const messages = [
    formatPrintAttempt("Primary ESC/POS", primaryResult),
    ...fallbackResults.map((result) => formatPrintAttempt("Fallback", result)),
  ];

  return messages.join(" | ");
}

async function writeEscposBuffer(buffer, options = {}) {
  const config = getPrinterConnectionConfig();
  const fallbackResults = [];
  const primaryResult = await writeEscposBufferToConfiguredTarget(
    config,
    buffer,
    options,
  );

  if (primaryResult?.success) return primaryResult;

  if (config.type !== "usb" && options.tryUsbFallback !== false) {
    const usbResult = await writeBufferToEscposUsb({ buffer });

    if (usbResult?.success) {
      return {
        ...usbResult,
        fallback: true,
        primaryType: config.type,
        primaryMessage: primaryResult?.message || "",
      };
    }

    fallbackResults.push(usbResult);
  }

  if (options.tryWindowsFallback !== false) {
    const printerName = await resolveWindowsPrinterName(options.printerName);
    const windowsResult = await writeBufferToWindowsRawPrinter({
      printerName,
      buffer,
    });

    if (windowsResult?.success) {
      return {
        ...windowsResult,
        fallback: true,
        primaryType: config.type,
        primaryMessage: primaryResult?.message || "",
      };
    }

    fallbackResults.push(windowsResult);
  }

  return {
    ...primaryResult,
    success: false,
    message: buildPrintFailureMessage(primaryResult, fallbackResults),
    fallbackResults,
  };
}

async function checkWindowsRawPrinterConnection(preferredPrinterName = "") {
  const printerName = await resolveWindowsPrinterName(preferredPrinterName);

  if (!printerName) {
    return {
      success: false,
      type: "windows-raw",
      message: "No Windows printer queue is available for USB fallback.",
    };
  }

  return {
    success: true,
    type: "windows-raw",
    printerName,
    message: `Windows USB printer fallback is available (${printerName}).`,
  };
}

async function checkConfiguredEscposConnection(config) {
  if (config.type === "bluetooth") {
    return await checkEscposBluetoothConnection(
      config.portName,
      config.baudRate,
    );
  }

  if (config.type === "usb") {
    return await checkEscposUsbConnection(config.vendorId, config.productId);
  }

  if (config.type === "windows-raw") {
    return await checkWindowsRawPrinterConnection(config.printerName);
  }

  return await checkEscposNetworkConnection(config.host, config.port);
}

async function checkEscposConnectionWithFallback() {
  const config = getPrinterConnectionConfig();
  const primaryResult = await checkConfiguredEscposConnection(config);

  if (primaryResult?.success) return primaryResult;

  const fallbackResults = [];

  if (config.type !== "usb") {
    const usbResult = await checkEscposUsbConnection();

    if (usbResult?.success) {
      return {
        ...usbResult,
        fallback: true,
        primaryType: config.type,
        primaryMessage: primaryResult?.message || "",
      };
    }

    fallbackResults.push(usbResult);
  }

  if (config.type !== "windows-raw") {
    const windowsResult = await checkWindowsRawPrinterConnection();

    if (windowsResult?.success) {
      return {
        ...windowsResult,
        fallback: true,
        primaryType: config.type,
        primaryMessage: primaryResult?.message || "",
      };
    }

    fallbackResults.push(windowsResult);
  }

  return {
    ...primaryResult,
    success: false,
    message: buildPrintFailureMessage(primaryResult, fallbackResults),
    fallbackResults,
  };
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const existingHeaders = details.responseHeaders || {};
    const existingCspHeader =
      existingHeaders["Content-Security-Policy"] ||
      existingHeaders["content-security-policy"];

    const cspValue =
      Array.isArray(existingCspHeader) && existingCspHeader.length > 0
        ? existingCspHeader[0]
        : "";

    const hasImgSrc = /(^|;)\s*img-src\s/i.test(cspValue);
    const hasConnectSrc = /(^|;)\s*connect-src\s/i.test(cspValue);

    let nextCsp = cspValue || "default-src 'self'";

    if (hasImgSrc) {
      nextCsp = nextCsp.replace(
        /(^|;)\s*img-src\s+([^;]*)/i,
        (match, prefix, sources) => {
          let nextSources = sources;
          if (!/\bhttp:\/\/localhost\b/i.test(nextSources)) {
            nextSources += " http://localhost";
          }
          if (!/\bhttp:\/\/127\.0\.0\.1\b/i.test(nextSources)) {
            nextSources += " http://127.0.0.1";
          }
          return `${prefix} img-src ${nextSources.trim()}`;
        },
      );
    } else {
      nextCsp +=
        "; img-src 'self' data: asset: https: http://localhost http://127.0.0.1";
    }

    if (hasConnectSrc) {
      nextCsp = nextCsp.replace(
        /(^|;)\s*connect-src\s+([^;]*)/i,
        (match, prefix, sources) => {
          let nextSources = sources;
          if (!/\bhttp:\/\/localhost\b/i.test(nextSources)) {
            nextSources += " http://localhost";
          }
          if (!/\bhttp:\/\/127\.0\.0\.1\b/i.test(nextSources)) {
            nextSources += " http://127.0.0.1";
          }
          return `${prefix} connect-src ${nextSources.trim()}`;
        },
      );
    } else {
      nextCsp +=
        "; connect-src 'self' https: http://localhost http://127.0.0.1 ws: wss:";
    }

    callback({
      responseHeaders: {
        ...existingHeaders,
        "Content-Security-Policy": [nextCsp],
      },
    });
  });

  ipcMain.handle("test-escpos", async () => {
    try {
      const payload = Buffer.concat([
        Buffer.from([0x1b, 0x40]),
        Buffer.from("ESC/POS TEST PRINT\n\nHELLO\n\n\n", "ascii"),
        Buffer.from([0x1d, 0x56, 0x00]),
      ]);

      return await writeEscposBuffer(payload);
    } catch (error) {
      return {
        success: false,
        message: error.message || "Test print failed",
      };
    }
  });

  // ipcMain.handle("test-escpos", async () => {
  //   const host = getPrinterHost();
  //   const port = 9100;

  //   return await new Promise((resolve) => {
  //     const client = new net.Socket();
  //     let finished = false;

  //     const done = (result) => {
  //       if (finished) return;
  //       finished = true;
  //       try {
  //         client.destroy();
  //       } catch {}
  //       resolve(result);
  //     };

  //     client.setTimeout(5000);

  //     client.on("connect", () => {
  //       console.log(`[ESC/POS TEST] Connected to ${host}:${port}`);
  //       done({
  //         success: true,
  //         message: `Printer reachable at ${host}:${port}`,
  //       });
  //     });

  //     client.on("timeout", () => {
  //       console.error("[ESC/POS TEST] Socket timeout");
  //       done({
  //         success: false,
  //         message: "Printer socket timeout",
  //       });
  //     });

  //     client.on("error", (err) => {
  //       console.error("[ESC/POS TEST] Socket error:", err);
  //       done({
  //         success: false,
  //         message: err?.message || "Printer connection failed",
  //       });
  //     });

  //     client.connect(port, host);
  //   });
  // });

  ipcMain.handle("read-business-info", async () => {
    try {
      const filePath = app.isPackaged
        ? path.join(process.resourcesPath, "businessInfo.json")
        : path.join(__dirname, "businessInfo.json");

      if (!fs.existsSync(filePath)) {
        return { success: false, message: "businessInfo.json not found" };
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to read businessInfo.json",
      };
    }
  });

  let lastWarmupAt = 0;

  ipcMain.handle("warmup-escpos", async () => {
    if (Date.now() - lastWarmupAt < 30000) {
      return {
        success: true,
        message: "Printer already warmed up recently",
      };
    }

    try {
      const result = await writeEscposBuffer(Buffer.from([0x1b, 0x40]), {
        tryWindowsFallback: false,
      });

      if (result?.success) {
        lastWarmupAt = Date.now();
        return {
          ...result,
          message: result.message || "Printer connection warmed up",
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: error?.message || "Printer warm-up failed",
      };
    }
  });

  ipcMain.handle("print-escpos", async (_event, data) => {
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
      console.log("[ESC/POS PRINT] Payload:", data);

      const chunks = [];
      const { table, items, total, instructions, printMode, transactionId } =
        data || {};

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
      chunks.push(txt(`Transaction ID: ${transactionId || "-"}`));
      chunks.push(nl());
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

          // if (item?.code) {
          //   chunks.push(Buffer.from([0x1b, 0x4d, 0x01]));
          //   chunks.push(txt(String(item.code)));
          //   chunks.push(nl());
          //   chunks.push(Buffer.from([0x1b, 0x4d, 0x00])); // back to normal font
          // }
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
      chunks.push(nl(3));
      chunks.push(cutPaper);

      const payload = Buffer.concat(chunks);
      return await writeEscposBuffer(payload, {
        printerName: data?.printerName,
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
    const LINE_WIDTH = 42;

    try {
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
      const boldOn = Buffer.from([0x1b, 0x45, 0x01]);
      const boldOff = Buffer.from([0x1b, 0x45, 0x00]);
      const doubleSizeOn = Buffer.from([0x1d, 0x21, 0x11]);
      const normalSize = Buffer.from([0x1d, 0x21, 0x00]);
      const cutPaper = Buffer.from([0x1d, 0x56, 0x00]);
      const nl = (count = 1) => Buffer.from("\n".repeat(count), "ascii");
      const txt = (value) => Buffer.from(String(value || ""), "ascii");

      const safeItems = Array.isArray(items) ? items : [];
      const safeComputed = computed || {};

      const peso = (value) =>
        Number(value || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      const signedNegativePeso = (value) => `- ${peso(value)}`;

      const line = () => {
        chunks.push(txt(escposRepeat("-", LINE_WIDTH)));
        chunks.push(nl());
      };

      const pushWrapped = (value, width = LINE_WIDTH) => {
        escposWrapText(String(value || ""), width).forEach((wrapped) => {
          chunks.push(txt(wrapped));
          chunks.push(nl());
        });
      };

      const pushLR = (label, value, width = LINE_WIDTH) => {
        chunks.push(
          txt(
            escposFormatLeftRight(
              String(label || ""),
              String(value || ""),
              width,
            ),
          ),
        );
        chunks.push(nl());
      };

      const activeBreakdown = Array.isArray(safeComputed?.discountBreakdown)
        ? safeComputed.discountBreakdown.filter(
            (entry) =>
              Number(entry?.qualifiedCount || 0) > 0 ||
              Number(entry?.discountAmount || 0) > 0,
          )
        : [];

      const totalQualifiedAll = Number(
        safeComputed?.totalQualifiedAll ||
          safeComputed?.totalQualifiedCount ||
          0,
      );

      const statutoryQualifiedCount = Number(
        safeComputed?.statutoryQualifiedCount || 0,
      );

      const grossTotal = Number(safeComputed?.grossTotal || 0);
      const netAfterDiscount = Number(safeComputed?.netAfterDiscount || 0);
      const totalVatExemption = Number(safeComputed?.totalVatExemption || 0);

      const billingRows = [
        ["Trans. No.", transaction?.transaction_id || "-"],
        [
          "Billing No.",
          transaction?.billing_no || transaction?.billingNo || "-",
        ],
        [
          "Invoice No.",
          transaction?.invoice_no || transaction?.invoiceNo || "-",
        ],
        ["Trans. Date", transaction?.transaction_date || dateFrom || "-"],
        ["Trans. Time", transaction?.transaction_time || "-"],
        ["Terminal No.", transaction?.terminal_number || "-"],
        ["Order Type", transaction?.order_type || "-"],
        ["Ref./Tag #", transaction?.table_number || "-"],
        ["Cashier", transaction?.cashier || "-"],
      ];

      const formatItemRow = (name, qty, amt) => {
        const nameWidth = 20;
        const qtyWidth = 8;
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
          escposSafeText(business.companyName, "CRABS N CRACK SEAFOOD HOUSE"),
        ),
      );
      chunks.push(nl());
      chunks.push(normalSize);
      chunks.push(txt(escposSafeText(business.storeName, "STORE")));
      chunks.push(nl());

      if (business.corpName) {
        chunks.push(txt(escposSafeText(business.corpName, "")));
        chunks.push(nl());
      }

      chunks.push(boldOff);

      if (business.address) {
        pushWrapped(business.address);
      }

      if (business.tin) {
        chunks.push(txt(`VAT REG TIN: ${escposSafeText(business.tin, "N/A")}`));
        chunks.push(nl());
      }

      if (business.machineNumber) {
        chunks.push(
          txt(`MIN: ${escposSafeText(business.machineNumber, "N/A")}`),
        );
        chunks.push(nl());
      }

      if (business.serialNumber) {
        chunks.push(
          txt(`S/N: ${escposSafeText(business.serialNumber, "N/A")}`),
        );
        chunks.push(nl());
      }

      line();

      // TITLE
      chunks.push(alignCenter);
      chunks.push(boldOn);
      chunks.push(doubleSizeOn);
      chunks.push(txt("BILLING"));
      chunks.push(nl());
      chunks.push(normalSize);
      chunks.push(boldOff);

      line();

      // BILLING INFO
      chunks.push(alignLeft);
      billingRows.forEach(([label, value]) => {
        pushLR(`${label}:`, value);
      });

      line();

      // ITEMS
      chunks.push(boldOn);
      chunks.push(txt(formatItemRow("Item", "Qty", "Amt")));
      chunks.push(nl());
      chunks.push(boldOff);
      line();

      if (!safeItems.length) {
        chunks.push(alignCenter);
        chunks.push(txt("No items"));
        chunks.push(nl());
        chunks.push(alignLeft);
      } else {
        safeItems.forEach((item) => {
          const qty = Number(item?.sales_quantity || 0);
          const price = Number(item?.selling_price || 0);
          const lineTotal = qty * price;

          const isDiscountable =
            String(item?.isDiscountable || "")
              .trim()
              .toLowerCase() === "yes";

          const itemLabel = String(
            item?.item_name || item?.product_id || item?.name || "-",
          ).toUpperCase();

          const itemText = `${itemLabel}${isDiscountable ? " (D)" : ""}`;
          const qtyText = `${qty} ${item?.unit_of_measure || ""}`.trim();
          const amtText = peso(lineTotal);

          const nameLines = escposWrapText(itemText, 20);

          nameLines.forEach((entry, index) => {
            if (index === 0) {
              chunks.push(txt(formatItemRow(`* ${entry}`, qtyText, amtText)));
            } else {
              chunks.push(txt(entry));
            }
            chunks.push(nl());
          });
        });
      }

      line();

      // SALES / DISCOUNT SECTION
      pushLR("TOTAL SALES:", peso(grossTotal));

      activeBreakdown.forEach((entry) => {
        if (Number(entry?.discountAmount || 0) > 0) {
          pushLR(
            `${String(entry?.label || "DISCOUNT").toUpperCase()}:`,
            signedNegativePeso(entry.discountAmount),
          );
        }
      });

      if (totalVatExemption > 0) {
        pushLR("VAT EXEMPTION:", signedNegativePeso(totalVatExemption));
      }

      line();

      // AMOUNT DUE
      chunks.push(boldOn);
      chunks.push(doubleSizeOn);
      pushLR("AMOUNT DUE:", peso(netAfterDiscount));
      chunks.push(normalSize);
      chunks.push(boldOff);

      line();

      // VAT SECTION
      pushLR("VATABLE SALES:", peso(safeComputed?.vatableSales));
      pushLR("VAT AMOUNT:", peso(safeComputed?.vatableSalesVat));
      pushLR("VAT EXEMPT SALES:", peso(safeComputed?.vatExemptSales));
      pushLR("VAT EXEMPTION:", peso(safeComputed?.totalVatExemption));
      pushLR("ZERO RATED SALES:", peso(safeComputed?.vatZeroRatedSales));

      line();

      // QUALIFIED / BREAKDOWN SECTION
      pushLR("Total Customers:", String(safeComputed?.safeCustomerCount ?? 0));
      pushLR("Total Qualified:", String(totalQualifiedAll));
      pushLR("Statutory Qualified:", String(statutoryQualifiedCount));

      activeBreakdown.forEach((entry) => {
        pushLR(`${entry.label} Count:`, String(entry?.qualifiedCount || 0));
        pushLR(`${entry.label} Amount:`, peso(entry?.discountAmount || 0));
      });

      pushLR("Discountable Gross:", peso(safeComputed?.discountableGross));
      pushLR("Discountable Base:", peso(safeComputed?.discountableBase));

      line();

      // SIGNATURE
      chunks.push(txt("Customer Signature:"));
      chunks.push(nl());
      chunks.push(txt("________________________________"));
      chunks.push(nl(2));

      line();

      // FOOTER
      chunks.push(alignCenter);
      chunks.push(boldOn);
      chunks.push(txt("Thank you"));
      chunks.push(nl());
      chunks.push(txt("Please come again."));
      chunks.push(nl(3));
      chunks.push(boldOff);

      chunks.push(nl(3));
      chunks.push(cutPaper);

      const payload = Buffer.concat(chunks);

      return await writeEscposBuffer(payload, {
        printerName: data?.printerName,
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
    const LINE_WIDTH = 42;

    try {
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
      const safeOtherCharges = Array.isArray(otherCharges) ? otherCharges : [];
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

      const activeBreakdown = Array.isArray(safeComputed?.discountBreakdown)
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

      const companyName = String(businessInfo?.companyName || "COMPANY").trim();

      const storeName = String(businessInfo?.storeName || "STORE").trim();

      const corpName = String(businessInfo?.corpName || "CORPORATION").trim();

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
          chunks.push(txt(escposFormatLeftRight(left, right, LINE_WIDTH)));
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
      pushMetaRow("Trans. Date:", safeTransaction?.transaction_date || "-");
      pushMetaRow("Trans. Time:", safeTransaction?.transaction_time || "-");
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

        const nameWithFlags = `* ${itemLabel}${isDiscountable ? " (D)" : ""}`;
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

        pushMetaRow("TOTAL PAYMENT:", escposPeso(safeComputed?.totalPaid));
      } else {
        pushMetaRow(
          `PAYMENT (${paymentLabel}):`,
          escposPeso(safeComputed?.totalPaid),
        );
      }

      pushMetaRow("CHANGE:", escposPeso(safeComputed?.changeAmount));

      pushDivider();

      // VAT SUMMARY
      pushMetaRow("VATABLE SALES:", escposPeso(safeComputed?.vatableSales));
      pushMetaRow("VAT AMOUNT:", escposPeso(safeComputed?.vatableSalesVat));
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

      if (posProviderTin) pushWrapped(`TIN: ${posProviderTin}`, LINE_WIDTH);
      if (posProviderBirAccreNo)
        pushWrapped(`BIR ACC#: ${posProviderBirAccreNo}`, LINE_WIDTH);
      if (posProviderAccreDateIssued)
        pushWrapped(`DATE ISSUED: ${posProviderAccreDateIssued}`, LINE_WIDTH);
      if (posProviderPTUNo) pushWrapped(`PTU: ${posProviderPTUNo}`, LINE_WIDTH);
      if (posProviderPTUDateIssued)
        pushWrapped(`PTU DATE ISSUED: ${posProviderPTUDateIssued}`, LINE_WIDTH);

      chunks.push(nl(3));
      chunks.push(nl(3));
      chunks.push(cutPaper);

      const payload = Buffer.concat(chunks);
      return await writeEscposBuffer(payload, {
        printerName: data?.printerName,
      });
    } catch (error) {
      console.error("ESC/POS POS payment print error:", error);
      return {
        success: false,
        message: error?.message || "ESC/POS POS payment print failed",
      };
    }
  });

  ipcMain.handle("print-escposxzreading", async (_event, data) => {
    const LINE_WIDTH = 42;

    try {
      console.log("[ESC/POS XZ] Payload:", data);

      const { payload = {}, isZReading = false } = data || {};
      const safeData = payload || {};
      const chunks = [];

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

      const escposSafeText = (value, fallback = "") => {
        const str = String(value ?? fallback ?? "");
        return str.replace(/[^\x20-\x7E]/g, " ").trim() || fallback;
      };

      const escposPeso = (value) =>
        Number(value || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      const escposRepeat = (char, count) => String(char || "-").repeat(count);

      const escposPadRight = (value, width) => {
        const str = String(value || "");
        if (str.length >= width) return str.slice(0, width);
        return str + " ".repeat(width - str.length);
      };

      const escposPadLeft = (value, width) => {
        const str = String(value || "");
        if (str.length >= width) return str.slice(0, width);
        return " ".repeat(width - str.length) + str;
      };

      const escposFormatLeftRight = (left, right, width = LINE_WIDTH) => {
        const l = String(left || "");
        const r = String(right || "");
        if (l.length + r.length >= width) {
          return `${l} ${r}`;
        }
        return l + " ".repeat(width - l.length - r.length) + r;
      };

      const escposWrapText = (value, width = LINE_WIDTH) => {
        const text = String(value || "").trim();
        if (!text) return [""];
        const words = text.split(/\s+/);
        const lines = [];
        let current = "";

        for (const word of words) {
          if (!current) {
            current = word;
            continue;
          }

          if ((current + " " + word).length <= width) {
            current += " " + word;
          } else {
            lines.push(current);
            current = word;
          }
        }

        if (current) lines.push(current);

        return lines.length ? lines : [text];
      };

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
          chunks.push(txt(escposFormatLeftRight(left, right, LINE_WIDTH)));
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

      const splitAddressLines = (value) =>
        String(value || "")
          .split(/\r?\n|\|/)
          .map((line) => line.trim())
          .filter(Boolean);

      const companyName = String(safeData.companyName || "COMPANY").trim();
      const storeName = String(safeData.storeName || "STORE").trim();
      const corpName = String(safeData.corpName || "").trim();
      const storeAddress = splitAddressLines(safeData.address || "ADDRESS");
      const storeTin = String(safeData.tin || "").trim();
      const machineNumber = String(safeData.machineNumber || "").trim();
      const serialNumber = String(safeData.serialNumber || "").trim();

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
        chunks.push(txt(`TIN: ${storeTin}`));
        chunks.push(nl());
      }

      chunks.push(txt(`MIN: ${machineNumber || "-"}`));
      chunks.push(nl());
      chunks.push(txt(`S/N: ${serialNumber || "-"}`));
      chunks.push(nl());

      pushDivider();

      // TITLE
      chunks.push(alignCenter);
      chunks.push(boldOn);
      chunks.push(doubleWidthOn);
      chunks.push(txt(isZReading ? "Z-READING" : "X-READING"));
      chunks.push(nl());
      chunks.push(normalSize);
      chunks.push(boldOff);

      if (safeData.reprintDateTime) {
        chunks.push(alignCenter);
        chunks.push(txt(`Reprint Date: ${safeData.reprintDateTime}`));
        chunks.push(nl());
      }

      chunks.push(alignLeft);

      if (isZReading) {
        const vatExemptionValue =
          safeData.vatExemption ??
          safeData.lessVatExemption ??
          safeData.vatExemptVat ??
          0;

        pushMetaRow("Date Issued:", safeData.reportDate || "-");
        pushMetaRow("Time:", safeData.reportTime || "-");
        pushMetaRow("Beg SI No.:", safeData.begSI || "-");
        pushMetaRow("End SI No.:", safeData.endSI || "-");
        pushMetaRow("Beg Void No.:", safeData.begVoid || "-");
        pushMetaRow("End Void No.:", safeData.endVoid || "-");
        pushMetaRow("Beg Return No.:", safeData.begReturn || "-");
        pushMetaRow("End Return No.:", safeData.endReturn || "-");
        pushMetaRow("Reset Counter No.:", safeData.resetCounterNo || 0);
        pushMetaRow("Z Counter No.:", safeData.zCounterNo || 0);

        pushDivider();

        pushMetaRow(
          "Present Accum. Sales:",
          escposPeso(safeData.presentAccumulatedSales),
        );
        pushMetaRow(
          "Previous Accum. Sales:",
          escposPeso(safeData.previousAccumulatedSales),
        );
        pushMetaRow("Sales for the Day:", escposPeso(safeData.salesForTheDay));

        pushDivider();

        chunks.push(boldOn);
        chunks.push(txt("BREAKDOWN OF SALES"));
        chunks.push(nl());
        chunks.push(boldOff);

        pushMetaRow("VATABLE SALES:", escposPeso(safeData.vatableSales));
        pushMetaRow("VAT AMOUNT:", escposPeso(safeData.vatAmount));
        pushMetaRow("VAT-EXEMPT SALES:", escposPeso(safeData.vatExemptSales));
        pushMetaRow("VAT EXEMPTION:", escposPeso(vatExemptionValue));
        pushMetaRow("ZERO RATED SALES:", escposPeso(safeData.zeroRatedSales));
        pushMetaRow("OTHER CHARGES:", escposPeso(safeData.otherCharges));

        pushDivider();

        pushMetaRow("Gross Amount:", escposPeso(safeData.grossAmount));
        pushMetaRow("Discount:", escposPeso(safeData.lessDiscount));
        pushMetaRow("VAT Exemption:", escposPeso(vatExemptionValue));
        pushMetaRow("Refund:", escposPeso(safeData.lessReturn));
        pushMetaRow("Void:", escposPeso(safeData.lessVoid));
        pushMetaRow("VAT Adjustment:", escposPeso(safeData.lessVatAdjustment));

        chunks.push(boldOn);
        pushMetaRow("Net Amount:", escposPeso(safeData.netAmount));
        chunks.push(boldOff);

        pushDivider();

        chunks.push(boldOn);
        chunks.push(txt("DISCOUNT SUMMARY"));
        chunks.push(nl());
        chunks.push(boldOff);

        pushMetaRow("SC Disc:", escposPeso(safeData.scDisc));
        pushMetaRow("PWD Disc:", escposPeso(safeData.pwdDisc));
        pushMetaRow("NAAC Disc:", escposPeso(safeData.naacDisc));
        pushMetaRow("Solo Parent Disc:", escposPeso(safeData.soloParentDisc));
        pushMetaRow("Other Disc:", escposPeso(safeData.otherDisc));

        pushDivider();

        chunks.push(boldOn);
        chunks.push(txt("SALES ADJUSTMENT"));
        chunks.push(nl());
        chunks.push(boldOff);

        pushMetaRow("Void:", escposPeso(safeData.salesAdjustmentVoid));
        pushMetaRow("Return:", escposPeso(safeData.salesAdjustmentReturn));

        pushDivider();

        chunks.push(boldOn);
        chunks.push(txt("VAT ADJUSTMENT"));
        chunks.push(nl());
        chunks.push(boldOff);

        pushMetaRow("SC Trans VAT Adj:", escposPeso(safeData.scTransVatAdj));
        pushMetaRow("PWD Trans VAT Adj:", escposPeso(safeData.pwdTransVatAdj));
        pushMetaRow(
          "Reg Disc Trans VAT Adj:",
          escposPeso(safeData.regDiscTransVatAdj),
        );
        pushMetaRow(
          "Zero Rated Trans VAT Adj:",
          escposPeso(safeData.zeroRatedTransVatAdj),
        );
        pushMetaRow("VAT on Return:", escposPeso(safeData.vatOnReturn));
        pushMetaRow(
          "Other VAT Adjustments:",
          escposPeso(safeData.otherVatAdjustments),
        );

        pushDivider();

        chunks.push(boldOn);
        chunks.push(txt("TRANSACTION SUMMARY"));
        chunks.push(nl());
        chunks.push(boldOff);

        pushMetaRow("Cash In Drawer:", escposPeso(safeData.cashInDrawer));
        pushMetaRow("Cheque:", escposPeso(safeData.cheque));
        pushMetaRow("Credit Card:", escposPeso(safeData.creditCard));
        pushMetaRow("Other Payments:", escposPeso(safeData.otherPayments));
        pushMetaRow("Opening Fund:", escposPeso(safeData.openingFund));
        pushMetaRow("Less Withdrawal:", escposPeso(safeData.lessWithdrawal));
        pushMetaRow(
          "Payments Received:",
          escposPeso(safeData.paymentsReceived),
        );

        chunks.push(boldOn);
        pushMetaRow("Short / Over:", escposPeso(safeData.shortOver));
        chunks.push(boldOff);
      } else {
        const otherPaymentsBreakdown = Array.isArray(
          safeData?.otherPaymentsBreakdown,
        )
          ? safeData.otherPaymentsBreakdown
          : Array.isArray(safeData?.paymentBreakdown)
            ? safeData.paymentBreakdown
            : [];

        pushMetaRow("Report Date:", safeData.reportDate || "-");
        pushMetaRow("Report Time:", safeData.reportTime || "-");
        pushMetaRow("Start Date/Time:", safeData.startDateTime || "-");
        pushMetaRow("End Date/Time:", safeData.endDateTime || "-");
        pushMetaRow("Cashier:", safeData.cashier || "-");
        pushMetaRow("Beg. INV.:", safeData.begOR || "-");
        pushMetaRow("End INV.:", safeData.endOR || "-");

        pushDivider();

        chunks.push(boldOn);
        chunks.push(txt("PAYMENTS"));
        chunks.push(nl());
        chunks.push(boldOff);

        pushMetaRow("Opening Fund:", escposPeso(safeData.openingFund));
        pushMetaRow("Cash:", escposPeso(safeData.cash));
        pushMetaRow("Cheque:", escposPeso(safeData.cheque));
        pushMetaRow("Credit Card:", escposPeso(safeData.creditCard));
        pushMetaRow(
          "Other Payments:",
          escposPeso(
            safeData.otherPaymentsTotal ?? safeData.otherPayments ?? 0,
          ),
        );

        if (otherPaymentsBreakdown.length > 0) {
          otherPaymentsBreakdown.forEach((item) => {
            pushMetaRow(
              `- ${item?.payment_method || "Other"}:`,
              escposPeso(item?.payment_amount || 0),
            );
          });
        } else {
          pushMetaRow("- None:", escposPeso(0));
        }

        chunks.push(boldOn);
        pushMetaRow("Total Payments:", escposPeso(safeData.totalPayments));
        chunks.push(boldOff);

        pushMetaRow("Void:", escposPeso(safeData.void));
        pushMetaRow("Refund:", escposPeso(safeData.refund));
        pushMetaRow("Withdrawal:", escposPeso(safeData.withdrawal));

        pushDivider();

        chunks.push(boldOn);
        chunks.push(txt("SUMMARY"));
        chunks.push(nl());
        chunks.push(boldOff);

        pushMetaRow(
          "Cash In Drawer:",
          escposPeso(safeData.summaryCashInDrawer),
        );
        pushMetaRow("Cheque:", escposPeso(safeData.summaryCheque));
        pushMetaRow("Credit Card:", escposPeso(safeData.summaryCreditCard));
        pushMetaRow(
          "Other Payments:",
          escposPeso(safeData.summaryOtherPayments),
        );
        pushMetaRow("Opening Fund:", escposPeso(safeData.summaryOpeningFund));
        pushMetaRow("Withdrawal:", escposPeso(safeData.summaryWithdrawal));
        pushMetaRow(
          "Payments Received:",
          escposPeso(safeData.summaryPaymentsReceived),
        );

        chunks.push(boldOn);
        pushMetaRow("Short / Over:", escposPeso(safeData.summaryShortOver));
        chunks.push(boldOff);
      }

      chunks.push(nl(3));
      chunks.push(nl(3));
      chunks.push(cutPaper);

      const finalPayload = Buffer.concat(chunks);
      return await writeEscposBuffer(finalPayload, {
        printerName: data?.printerName,
      });
    } catch (error) {
      console.error("ESC/POS X/Z reading print error:", error);
      return {
        success: false,
        message: error?.message || "ESC/POS X/Z reading print failed",
      };
    }
  });

  ipcMain.handle("print-escpossalesperproduct", async (_event, data) => {
    const LINE_WIDTH = 42;

    try {
      console.log("[ESC/POS SALES PER PRODUCT] Payload:", data);

      const chunks = [];
      const {
        title = "SALES REPORT",
        dateFrom = "",
        dateTo = "",
        printedAt = "",
        items = [],
        totals = {},
      } = data || {};

      const safeItems = Array.isArray(items) ? items : [];
      const safeTotals = totals || {};

      const initPrinter = Buffer.from([0x1b, 0x40]);
      const alignLeft = Buffer.from([0x1b, 0x61, 0x00]);
      const alignCenter = Buffer.from([0x1b, 0x61, 0x01]);
      const boldOn = Buffer.from([0x1b, 0x45, 0x01]);
      const boldOff = Buffer.from([0x1b, 0x45, 0x00]);
      const doubleWidthOn = Buffer.from([0x1d, 0x21, 0x10]);
      const normalSize = Buffer.from([0x1d, 0x21, 0x00]);
      const cutPaper = Buffer.from([0x1d, 0x56, 0x00]);

      const nl = (count = 1) => Buffer.from("\n".repeat(count), "ascii");
      const txt = (value) => Buffer.from(String(value || ""), "ascii");

      const escposSafeText = (value, fallback = "") => {
        const str = String(value ?? fallback ?? "");
        return str.replace(/[^\x20-\x7E]/g, " ").trim() || fallback;
      };

      const escposPeso = (value) =>
        Number(value || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

      const escposRepeat = (char, count) => String(char || "-").repeat(count);

      const escposPadRight = (value, width) => {
        const str = String(value || "");
        if (str.length >= width) return str.slice(0, width);
        return str + " ".repeat(width - str.length);
      };

      const escposPadLeft = (value, width) => {
        const str = String(value || "");
        if (str.length >= width) return str.slice(0, width);
        return " ".repeat(width - str.length) + str;
      };

      const escposWrapText = (value, width = LINE_WIDTH) => {
        const text = String(value || "").trim();
        if (!text) return [""];

        const words = text.split(/\s+/);
        const lines = [];
        let current = "";

        for (const word of words) {
          if (!current) {
            current = word;
            continue;
          }

          if ((current + " " + word).length <= width) {
            current += " " + word;
          } else {
            lines.push(current);
            current = word;
          }
        }

        if (current) lines.push(current);
        return lines.length ? lines : [text];
      };

      const escposFormatLeftRight = (left, right, width = LINE_WIDTH) => {
        const l = String(left || "");
        const r = String(right || "");

        if (l.length + r.length >= width) {
          return `${l} ${r}`;
        }

        return l + " ".repeat(width - l.length - r.length) + r;
      };

      const pushDivider = () => {
        chunks.push(txt(escposRepeat("-", LINE_WIDTH)));
        chunks.push(nl());
      };

      const pushWrappedCentered = (value, width = LINE_WIDTH) => {
        escposWrapText(value, width).forEach((line) => {
          chunks.push(txt(line));
          chunks.push(nl());
        });
      };

      const pushMetaRow = (label, value) => {
        const left = String(label || "");
        const right = escposSafeText(value, "-");

        if (left.length + right.length <= LINE_WIDTH) {
          chunks.push(txt(escposFormatLeftRight(left, right, LINE_WIDTH)));
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
        const nameWidth = 22;
        const qtyWidth = 6;
        const amtWidth = 14;

        return (
          escposPadRight(name, nameWidth) +
          escposPadRight(qty, qtyWidth) +
          escposPadLeft(amt, amtWidth)
        );
      };

      chunks.push(initPrinter);

      chunks.push(alignCenter);
      chunks.push(boldOn);
      chunks.push(doubleWidthOn);
      pushWrappedCentered(String(title || "SALES REPORT").toUpperCase());
      chunks.push(normalSize);
      chunks.push(boldOff);

      chunks.push(txt(`${dateFrom || "-"} - ${dateTo || "-"}`));
      chunks.push(nl());

      pushDivider();

      chunks.push(alignLeft);
      chunks.push(boldOn);
      chunks.push(txt(formatItemRow("ITEM", "QTY", "TOTAL")));
      chunks.push(nl());
      chunks.push(boldOff);

      safeItems.forEach((item) => {
        const itemName = String(item?.name || "-").toUpperCase();
        const qtyText = String(Number(item?.qty || 0));
        const amtText = escposPeso(item?.amount || 0);

        const nameLines = escposWrapText(itemName, 22);

        nameLines.forEach((line, index) => {
          if (index === 0) {
            chunks.push(txt(formatItemRow(line, qtyText, amtText)));
          } else {
            chunks.push(txt(line));
          }
          chunks.push(nl());
        });

        if (nameLines.length > 1) {
          chunks.push(nl());
        }

        // if (item?.code) {
        //   const codeLines = escposWrapText(
        //     `CODE: ${String(item.code).toUpperCase()}`,
        //     LINE_WIDTH,
        //   );
        //   codeLines.forEach((line) => {
        //     chunks.push(txt(line));
        //     chunks.push(nl());
        //   });
        // }
      });

      pushDivider();

      pushMetaRow("TOTAL QTY:", Number(safeTotals.qty || 0));
      pushMetaRow("GRAND TOTAL:", `P${escposPeso(safeTotals.amount || 0)}`);

      pushDivider();

      chunks.push(alignCenter);
      chunks.push(txt(`DATE: ${printedAt || "-"}`));
      chunks.push(nl(3));
      chunks.push(nl(3));
      chunks.push(cutPaper);

      const payload = Buffer.concat(chunks);
      return await writeEscposBuffer(payload, {
        printerName: data?.printerName,
      });
    } catch (error) {
      console.error("ESC/POS sales per product print error:", error);
      return {
        success: false,
        message: error?.message || "ESC/POS sales per product print failed",
      };
    }
  });

  ipcMain.handle("print-escposbilling", async (_event, data) => {
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
            safeNumber(item?.selling_price) * safeNumber(item?.sales_quantity);
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
      chunks.push(nl(3));

      chunks.push(cutPaper);

      const payload = Buffer.concat(chunks);
      return await writeEscposBuffer(payload, {
        printerName: data?.printerName,
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
        normalizeSystemPrinterName(printerName) ||
        normalizeSystemPrinterName(printerFromFile) ||
        (await resolveWindowsPrinterName(""));

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
          message: "No Windows printer is available.",
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

  ipcMain.handle("check-escpos-printer", async () => {
    try {
      return await checkEscposConnectionWithFallback();
    } catch (error) {
      return {
        success: false,
        message: error.message || "Printer check failed",
      };
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
