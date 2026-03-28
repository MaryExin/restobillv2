const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appConfig", {
  getApiHost: () => ipcRenderer.invoke("get-api-host"),
  getDefaultPrinterName: () => ipcRenderer.invoke("get-default-printer-name"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: (payload) => ipcRenderer.invoke("print-receipt", payload),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  quitApp: () => ipcRenderer.send("close-app"),
});
