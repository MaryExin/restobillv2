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
  win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Temporarily set to false if it STILL doesn't work to test, but keep true for security
      webSecurity: true 
    }
  });

  // 3. The Improved Protocol Handler
  protocol.registerFileProtocol('asset', (request, callback) => {
    // Remove 'asset://'
    let filePath = request.url.replace(/^asset:\/\//, '');
    
    // Decode the URL (handles spaces or special characters)
    filePath = decodeURIComponent(filePath);
    
    // Remove leading slashes that might be added by React/Vite
    if (filePath.startsWith('/')) {
      filePath = filePath.substring(1);
    }

    let fullPath;
    if (app.isPackaged) {
      // Looks in: [YourApp]/resources/images/login-visual.png
      fullPath = path.join(process.resourcesPath, 'images', filePath);
    } else {
      // Looks in: [YourProject]/public/login-visual.png
      fullPath = path.join(app.getAppPath(), 'public', filePath);
    }

    const normalizedPath = path.normalize(fullPath);

    // Final verification log (Visible in terminal/cmd)
    console.log(`[Asset Protocol] Loading: ${normalizedPath}`);
    
    callback({ path: normalizedPath });
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