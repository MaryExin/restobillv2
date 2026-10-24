const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lightemSetup', Object.freeze({
  status: () => ipcRenderer.invoke('lightem-setup:status'),
  install: (platform, options) => ipcRenderer.invoke('lightem-setup:install', platform, options),
  saveInstaller: (platform) => ipcRenderer.invoke('lightem-setup:save', platform),
  checkForUpdates: () => ipcRenderer.invoke('lightem-setup:updates'),
}));
