const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");


function readIpTxt() {
  try {
    const ipPath = path.join(process.resourcesPath, "ip.txt");
    return fs.readFileSync(ipPath, "utf8").trim();
  } catch (e) {
    return ""; // no fallback, you can decide what to do
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("get-api-host", () => readIpTxt());
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("print-receipt", async (event, html) => {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await printWindow.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(html)
  );

  printWindow.webContents.print({
    silent: false,
    printBackground: true,
  });

  printWindow.close();
});