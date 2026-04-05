const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appConfig", {
  getApiHost: () => ipcRenderer.invoke("get-api-host"),
  getDefaultPrinterName: () => ipcRenderer.invoke("get-default-printer-name"),
  getBusinessInfo: () => ipcRenderer.invoke("get-business-info"),
  saveBusinessInfo: (payload) =>
    ipcRenderer.invoke("save-business-info", payload),
  resetBusinessInfoDefaults: () =>
    ipcRenderer.invoke("reset-business-info-defaults"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: (payload) => ipcRenderer.invoke("print-receipt", payload),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  quitApp: () => ipcRenderer.send("close-app"),
});
