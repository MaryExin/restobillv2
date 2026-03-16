const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appConfig", {
  getApiHost: () => ipcRenderer.invoke("get-api-host"),
});

contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: (html) => ipcRenderer.invoke("print-receipt", html),
  quitApp: () => ipcRenderer.send("close-app"), // Critical for exiting fullscreen
});