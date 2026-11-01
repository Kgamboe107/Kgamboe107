/* Electron desktop shell */
const { app, BrowserWindow, shell, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { start } = require('./server');

const DARK = { color: '#00000000', symbolColor: '#c3c8d6' };
const LIGHT = { color: '#00000000', symbolColor: '#374151' };
let win;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

async function createWindow() {
  let url;
  try { ({ url } = await start()); }
  catch { ({ url } = await start(0)); } // port busy: fall back to any free port

  const isMac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1480, height: 940, minWidth: 960, minHeight: 620,
    title: 'Ops Command Desk',
    show: false,
    backgroundColor: '#07090f',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 18, y: 18 },
    ...(isMac ? {} : { titleBarOverlay: { ...(nativeTheme.shouldUseDarkColors ? DARK : LIGHT), height: 60 } }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());

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

ipcMain.on('theme', (_e, theme) => {
  if (!win || process.platform === 'darwin') return;
  try { win.setTitleBarOverlay({ ...(theme === 'dark' ? DARK : LIGHT), height: 60 }); } catch { /* older platforms */ }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
