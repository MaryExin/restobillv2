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

            const activeBreakdown = Array.isArray(
              safeComputed?.discountBreakdown,
            )
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
            const netAfterDiscount = Number(
              safeComputed?.netAfterDiscount || 0,
            );
            const totalVatExemption = Number(
              safeComputed?.totalVatExemption || 0,
            );

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
            // chunks.push(doubleSizeOn);
            chunks.push(
              txt(
                escposSafeText(
                  business.companyName,
                  "CRABS N CRACK SEAFOOD HOUSE",
                ),
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
              chunks.push(
                txt(`VAT REG TIN: ${escposSafeText(business.tin, "N/A")}`),
              );
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
                    chunks.push(
                      txt(formatItemRow(`* ${entry}`, qtyText, amtText)),
                    );
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
            pushLR(
              "Total Customers:",
              String(safeComputed?.safeCustomerCount ?? 0),
            );
            pushLR("Total Qualified:", String(totalQualifiedAll));
            pushLR("Statutory Qualified:", String(statutoryQualifiedCount));

            activeBreakdown.forEach((entry) => {
              pushLR(
                `${entry.label} Count:`,
                String(entry?.qualifiedCount || 0),
              );
              pushLR(
                `${entry.label} Amount:`,
                peso(entry?.discountAmount || 0),
              );
            });

            pushLR(
              "Discountable Gross:",
              peso(safeComputed?.discountableGross),
            );
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
            chunks.push(nl());
            chunks.push(boldOff);

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

  ipcMain.handle("print-escposxzreading", async (_event, data) => {
    const host = getPrinterHost();
    const port = 9100;
    const LINE_WIDTH = 42;

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
            console.log(`[ESC/POS XZ] Connected to ${host}:${port}`);
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

            const escposRepeat = (char, count) =>
              String(char || "-").repeat(count);

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

            const splitAddressLines = (value) =>
              String(value || "")
                .split(/\r?\n|\|/)
                .map((line) => line.trim())
                .filter(Boolean);

            const companyName = String(
              safeData.companyName || "COMPANY",
            ).trim();
            const storeName = String(safeData.storeName || "STORE").trim();
            const corpName = String(safeData.corpName || "").trim();
            const storeAddress = splitAddressLines(
              safeData.address || "ADDRESS",
            );
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
              pushMetaRow(
                "Sales for the Day:",
                escposPeso(safeData.salesForTheDay),
              );

              pushDivider();

              chunks.push(boldOn);
              chunks.push(txt("BREAKDOWN OF SALES"));
              chunks.push(nl());
              chunks.push(boldOff);

              pushMetaRow("VATABLE SALES:", escposPeso(safeData.vatableSales));
              pushMetaRow("VAT AMOUNT:", escposPeso(safeData.vatAmount));
              pushMetaRow(
                "VAT-EXEMPT SALES:",
                escposPeso(safeData.vatExemptSales),
              );
              pushMetaRow("VAT EXEMPTION:", escposPeso(vatExemptionValue));
              pushMetaRow(
                "ZERO RATED SALES:",
                escposPeso(safeData.zeroRatedSales),
              );
              pushMetaRow("OTHER CHARGES:", escposPeso(safeData.otherCharges));

              pushDivider();

              pushMetaRow("Gross Amount:", escposPeso(safeData.grossAmount));
              pushMetaRow("Discount:", escposPeso(safeData.lessDiscount));
              pushMetaRow("VAT Exemption:", escposPeso(vatExemptionValue));
              pushMetaRow("Refund:", escposPeso(safeData.lessReturn));
              pushMetaRow("Void:", escposPeso(safeData.lessVoid));
              pushMetaRow(
                "VAT Adjustment:",
                escposPeso(safeData.lessVatAdjustment),
              );

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
              pushMetaRow(
                "Solo Parent Disc:",
                escposPeso(safeData.soloParentDisc),
              );
              pushMetaRow("Other Disc:", escposPeso(safeData.otherDisc));

              pushDivider();

              chunks.push(boldOn);
              chunks.push(txt("SALES ADJUSTMENT"));
              chunks.push(nl());
              chunks.push(boldOff);

              pushMetaRow("Void:", escposPeso(safeData.salesAdjustmentVoid));
              pushMetaRow(
                "Return:",
                escposPeso(safeData.salesAdjustmentReturn),
              );

              pushDivider();

              chunks.push(boldOn);
              chunks.push(txt("VAT ADJUSTMENT"));
              chunks.push(nl());
              chunks.push(boldOff);

              pushMetaRow(
                "SC Trans VAT Adj:",
                escposPeso(safeData.scTransVatAdj),
              );
              pushMetaRow(
                "PWD Trans VAT Adj:",
                escposPeso(safeData.pwdTransVatAdj),
              );
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
              pushMetaRow(
                "Other Payments:",
                escposPeso(safeData.otherPayments),
              );
              pushMetaRow("Opening Fund:", escposPeso(safeData.openingFund));
              pushMetaRow(
                "Less Withdrawal:",
                escposPeso(safeData.lessWithdrawal),
              );
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
              pushMetaRow(
                "Total Payments:",
                escposPeso(safeData.totalPayments),
              );
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
              pushMetaRow(
                "Credit Card:",
                escposPeso(safeData.summaryCreditCard),
              );
              pushMetaRow(
                "Other Payments:",
                escposPeso(safeData.summaryOtherPayments),
              );
              pushMetaRow(
                "Opening Fund:",
                escposPeso(safeData.summaryOpeningFund),
              );
              pushMetaRow(
                "Withdrawal:",
                escposPeso(safeData.summaryWithdrawal),
              );
              pushMetaRow(
                "Payments Received:",
                escposPeso(safeData.summaryPaymentsReceived),
              );

              chunks.push(boldOn);
              pushMetaRow(
                "Short / Over:",
                escposPeso(safeData.summaryShortOver),
              );
              chunks.push(boldOff);
            }

            chunks.push(nl(3));
            chunks.push(cutPaper);

            const finalPayload = Buffer.concat(chunks);

            client.write(finalPayload, (err) => {
              if (err) {
                console.error("[ESC/POS XZ] Write error:", err);
                return done({
                  success: false,
                  message:
                    err?.message || "Failed to write X/Z reading to printer",
                });
              }

              client.end();
            });
          } catch (error) {
            console.error("[ESC/POS XZ] Build/print error:", error);
            done({
              success: false,
              message: error?.message || "ESC/POS X/Z reading print failed",
            });
          }
        });

        client.on("timeout", () => {
          console.error("[ESC/POS XZ] Socket timeout");
          done({
            success: false,
            message: "X/Z reading printer socket timeout",
          });
        });

        client.on("error", (err) => {
          console.error("[ESC/POS XZ] Socket error:", err);
          done({
            success: false,
            message: err?.message || "X/Z reading printer connection error",
          });
        });

        client.on("close", () => {
          console.log("[ESC/POS XZ] Connection closed");
          done({
            success: true,
            message: "X/Z reading printed successfully",
          });
        });

        client.connect(port, host);
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
    const host = getPrinterHost();
    const port = 9100;
    const LINE_WIDTH = 42;

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
            console.log(
              `[ESC/POS SALES PER PRODUCT] Connected to ${host}:${port}`,
            );
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

            const escposRepeat = (char, count) =>
              String(char || "-").repeat(count);

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
            pushMetaRow(
              "GRAND TOTAL:",
              `P${escposPeso(safeTotals.amount || 0)}`,
            );

            pushDivider();

            chunks.push(alignCenter);
            chunks.push(txt(`DATE: ${printedAt || "-"}`));
            chunks.push(nl(3));
            chunks.push(cutPaper);

            const payload = Buffer.concat(chunks);

            client.write(payload, (err) => {
              if (err) {
                console.error("[ESC/POS SALES PER PRODUCT] Write error:", err);
                return done({
                  success: false,
                  message:
                    err?.message ||
                    "Failed to write sales per product report to printer",
                });
              }

              client.end();
            });
          } catch (error) {
            console.error(
              "[ESC/POS SALES PER PRODUCT] Build/print error:",
              error,
            );
            done({
              success: false,
              message:
                error?.message || "ESC/POS sales per product print failed",
            });
          }
        });

        client.on("timeout", () => {
          console.error("[ESC/POS SALES PER PRODUCT] Socket timeout");
          done({
            success: false,
            message: "Sales per product printer socket timeout",
          });
        });

        client.on("error", (err) => {
          console.error("[ESC/POS SALES PER PRODUCT] Socket error:", err);
          done({
            success: false,
            message:
              err?.message || "Sales per product printer connection error",
          });
        });

        client.on("close", () => {
          console.log("[ESC/POS SALES PER PRODUCT] Connection closed");
          done({
            success: true,
            message: "Sales per product report printed successfully",
          });
        });

        client.connect(port, host);
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
