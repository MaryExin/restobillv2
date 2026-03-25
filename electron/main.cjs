// 1. MUST BE THE VERY FIRST LINE OF THE FILE
const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require("path");
const fs = require("fs");

// 2. Register 'asset' protocol as privileged BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'asset', 
    privileges: { 
      secure: true, 
      standard: true, 
      supportFetchAPI: true, 
      bypassCSP: true, 
      stream: true 
    } 
  }
]);

let win;

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
  // IPC Handlers
  ipcMain.handle("get-api-host", () => {
    try {
      const ipPath = path.join(process.resourcesPath, "ip.txt");
      return fs.readFileSync(ipPath, "utf8").trim();
    } catch (e) { return ""; }
  });

  ipcMain.on("close-app", () => app.quit());

  createWindow();
});

// Receipt printing logic
ipcMain.handle("print-receipt", async (event, html) => {
  const printWindow = new BrowserWindow({ show: false });
  await printWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  printWindow.webContents.print({ silent: false, printBackground: true });
  setTimeout(() => { if (!printWindow.isDestroyed()) printWindow.close(); }, 1000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});