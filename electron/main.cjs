const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require("path");
const fs = require("fs");

const OPEN_DEVTOOLS_IN_PACKAGED = false;
const DEV_SERVER_URL = "http://localhost:5173";

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
        width: 500,
        height: 3000,
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

      const metrics = await printWindow.webContents.executeJavaScript(`
      ({
        bodyScrollHeight: document.body ? document.body.scrollHeight : 0,
        bodyClientHeight: document.body ? document.body.clientHeight : 0,
        docScrollHeight: document.documentElement ? document.documentElement.scrollHeight : 0,
        docClientHeight: document.documentElement ? document.documentElement.clientHeight : 0
      })
    `);

      console.log("Receipt layout metrics:", metrics);

      await new Promise((resolve) => setTimeout(resolve, 1200));

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

      const result = await new Promise((resolve) => {
        printWindow.webContents.print(
          {
            silent,
            deviceName: resolvedPrinterName,
            copies,
            printBackground: true,
            margins: {
              marginType: "none",
            },
            usePrinterDefaultPageSize: true,
            pageRanges: [],
          },
          (success, failureReason) => {
            resolve({
              success,
              failureReason: failureReason || "",
            });
          },
        );
      });

      console.log("Print result from main:", result);

      if (!result.success) {
        return {
          success: false,
          message: result.failureReason || "Print failed.",
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

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
