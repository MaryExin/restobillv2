const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require("path");
const fs = require("fs");

const OPEN_DEVTOOLS_IN_PACKAGED = true; // set false in production if you do not want DevTools
const DEFAULT_PRINTER_NAME = "XP-80C";

const DEV_SERVER_URL = "http://localhost:5173";

// Register custom protocol before app is ready
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

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
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

function mapPrinterInfo(printer) {
  return {
    name: printer?.name || "",
    displayName: printer?.displayName || printer?.name || "",
    description: printer?.description || "",
    // newer Electron may no longer provide these
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
      return fs.readFileSync(ipPath, "utf8").trim();
    } catch (error) {
      console.error("Failed to read ip.txt:", error);
      return "";
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

      const resolvedPrinterName =
        String(printerName || "").trim() || DEFAULT_PRINTER_NAME;

      console.log("print-receipt payload:", {
        printerName,
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

      printWindow = new BrowserWindow({
        show: false,
        width: 420,
        height: 900,
        autoHideMenuBar: true,
        backgroundColor: "#ffffff",
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

      printWindow.webContents.on("dom-ready", () => {
        console.log("Print window dom-ready");
      });

      printWindow.webContents.on("did-finish-load", () => {
        console.log("Print window did-finish-load");
      });

      await printWindow.loadURL(
        "data:text/html;charset=utf-8," + encodeURIComponent(html),
      );

      // Give Chromium extra time to layout fonts/images/content.
      await new Promise((resolve) => setTimeout(resolve, 500));

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

      // Some receipt printers/drivers behave better with a slight delay before close.
      await new Promise((resolve) => setTimeout(resolve, 800));

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
