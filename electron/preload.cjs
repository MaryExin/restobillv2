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
  printEscposXzReading: (payload) =>
    ipcRenderer.invoke("print-escposxzreading", payload),
  printEscposSalesPerProduct: (payload) =>
    ipcRenderer.invoke("print-escpossalesperproduct", payload),
  warmupEscPos: () => ipcRenderer.invoke("warmup-escpos"),
  printEscPos: (data) => ipcRenderer.invoke("print-escpos", data),
  printEscPosBilling: (data) => ipcRenderer.invoke("print-escposbilling", data), // NEW
  printEscposDiscount: (data) =>
    ipcRenderer.invoke("print-escposdiscount", data),
  pospaymentreceipt: (data) =>
    ipcRenderer.invoke("print-escpospospaymentreceipt", data),
  testEscPos: () => ipcRenderer.invoke("test-escpos"),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  quitApp: () => ipcRenderer.send("close-app"),
});
