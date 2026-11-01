/* Exposes a tiny, safe API to the page (no Node access) */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  setTheme: theme => ipcRenderer.send('theme', theme),
  ready: () => ipcRenderer.send('renderer-ready'),
  reportError: msg => ipcRenderer.send('renderer-error', String(msg).slice(0, 2000)),
  openLogs: () => ipcRenderer.send('open-logs')
});
