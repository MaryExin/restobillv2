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
  printEscPosDuplicate: (data) =>
    ipcRenderer.invoke("print-escpos-duplicate", data),
  printEscposXzReading: (payload) =>
    ipcRenderer.invoke("print-escposxzreading", payload),
  printEscposSalesPerProduct: (payload) =>
    ipcRenderer.invoke("print-escpossalesperproduct", payload),
  warmupEscPos: () => ipcRenderer.invoke("warmup-escpos"),
  readBusinessInfo: () => ipcRenderer.invoke("read-business-info"),
  checkEscposPrinter: () => ipcRenderer.invoke("check-escpos-printer"),
  printEscPos: (data) => ipcRenderer.invoke("print-escpos", data),
  printEscPosQr: (data) => ipcRenderer.invoke("print-escposqr", data),
  printEscPosVoidRefund: (data) => ipcRenderer.invoke("print-escpos-void-refund", data),
  printEscPosBilling: (data) => ipcRenderer.invoke("print-escposbilling", data),
  printEscposDiscount: (data) =>
    ipcRenderer.invoke("print-escposdiscount", data),
  pospaymentreceipt: (data) =>
    ipcRenderer.invoke("print-escpospospaymentreceipt", data),
  testPrinterConnection: (payload) =>
    ipcRenderer.invoke("test-printer-connection", payload),
  testEscpos: () => ipcRenderer.invoke("test-escpos"),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  readPrinterConfig: () => ipcRenderer.invoke("read-printer-config"),
  savePrinterConfig: (payload) =>
    ipcRenderer.invoke("save-printer-config", payload),
  readPrinterCategories: () => ipcRenderer.invoke("read-printer-categories"),
  savePrinterCategories: (payload) =>
    ipcRenderer.invoke("save-printer-categories", payload),
  scanComPorts: () => ipcRenderer.invoke("scan-com-ports"),
  scanLanPrinters: () => ipcRenderer.invoke("scan-lan-printers"),
  quitApp: () => ipcRenderer.send("close-app"),
});

contextBridge.exposeInMainWorld("kioskAPI", {
  getScreens: () => ipcRenderer.invoke("kiosk:get-screens"),
  openSecondScreen: () => ipcRenderer.invoke("kiosk:open-second-screen"),
  closeSecondScreen: () => ipcRenderer.invoke("kiosk:close-second-screen"),
  setFullScreen: (value) => ipcRenderer.invoke("kiosk:set-fullscreen", value),
  updateCart: (data) => ipcRenderer.invoke("kiosk:update-cart", data),
  onCartUpdate: (cb) =>
    ipcRenderer.on("kiosk:cart-updated", (_event, data) => cb(data)),
  offCartUpdate: (cb) =>
    ipcRenderer.removeListener("kiosk:cart-updated", cb),
});
