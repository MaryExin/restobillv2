const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appConfig", {
  getApiHost: () => ipcRenderer.invoke("get-api-host"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: () => ipcRenderer.invoke("print-receipt"),
});