/* Exposes a tiny, safe API to the page (no Node access) */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  setTheme: theme => ipcRenderer.send('theme', theme)
});
