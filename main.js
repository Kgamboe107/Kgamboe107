/* Electron desktop shell */
const { app, BrowserWindow, shell } = require('electron');
const { start } = require('./server');

let win;
async function createWindow() {
  let url;
  try { ({ url } = await start()); }
  catch (e) { ({ url } = await start(0)); } // fall back to any free port
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, title: 'Ops Command Desk',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.removeMenu();
  // OAuth popups (Google, Microsoft) open as child windows; other links open in the browser
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com|docs\.google\.com\/picker|localhost/.test(target) || target.startsWith('blob:')) {
      return { action: 'allow' };
    }
    shell.openExternal(target);
    return { action: 'deny' };
  });
  win.loadURL(url);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
