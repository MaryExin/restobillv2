const { app, BrowserWindow, ipcMain, protocol } = require("electron");
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

app.whenReady().then(() => {
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
