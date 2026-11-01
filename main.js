/* Electron desktop shell — with startup diagnostics and self-healing for blank windows */
const { app, BrowserWindow, shell, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { start } = require('./server');

/* ---------- Logging (userData/logs/main.log) ---------- */
const logDir = path.join(app.getPath('userData'), 'logs');
const logFile = path.join(logDir, 'main.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 2e6) fs.renameSync(logFile, logFile + '.old');
    fs.appendFileSync(logFile, line);
  } catch { /* ignore */ }
  if (!app.isPackaged) process.stdout.write(line);
}
process.on('uncaughtException', e => log('uncaughtException', e));
process.on('unhandledRejection', e => log('unhandledRejection', e));

/* ---------- GPU self-heal ----------
   If the previous launch never reached a rendered UI (or the GPU process crashed), start with
   hardware acceleration off. This fixes black windows on some drivers, VMs and remote desktops. */
const stateFile = path.join(app.getPath('userData'), 'launch-state.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return {}; } };
const writeState = s => { try { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(s)); } catch { /* ignore */ } };
const state = readState();
if (state.pending && !state.safeMode) { state.safeMode = true; log('Previous launch did not finish rendering; enabling safe graphics mode'); }
if (state.safeMode || process.argv.includes('--safe-mode')) app.disableHardwareAcceleration();
writeState({ ...state, pending: true, startedAt: Date.now() });

const DARK = { color: '#0f131d', symbolColor: '#c3c8d6', height: 60 };
const LIGHT = { color: '#ffffff', symbolColor: '#374151', height: 60 };
let win, appUrl;

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

function errorPage(title, detail) {
  const html = `<!doctype html><meta charset="utf-8"><title>Ops Command Desk</title>
  <body style="margin:0;height:100vh;display:grid;place-items:center;background:#07090f;color:#e8eaf2;font:14px system-ui,Segoe UI,sans-serif">
  <div style="max-width:560px;padding:32px;border:1px solid #283044;border-radius:16px;background:#0f131d">
  <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#d946ef);display:grid;place-items:center;font-weight:700;margin-bottom:16px">OC</div>
  <h2 style="margin:0 0 8px">${title}</h2><p style="color:#8790a8;line-height:1.5">${detail}</p>
  <p style="color:#8790a8;font-size:12px">Diagnostic log: ${logFile.replace(/\\/g, '\\\\')}</p>
  <button onclick="location.href='${appUrl || ''}'" style="padding:9px 16px;border-radius:10px;border:0;background:#6366f1;color:#fff;font:inherit;cursor:pointer">Try again</button>
  </div></body>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function createWindow() {
  const isMac = process.platform === 'darwin';
  const dark = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    width: 1480, height: 940, minWidth: 960, minHeight: 620,
    title: 'Ops Command Desk',
    show: false,
    backgroundColor: '#07090f',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 18, y: 18 },
    ...(isMac ? {} : { titleBarOverlay: dark ? DARK : LIGHT }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.removeMenu();

  // Always show the window, even if 'ready-to-show' never fires
  const reveal = () => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); };
  win.once('ready-to-show', reveal);
  setTimeout(reveal, 2500);

  const wc = win.webContents;
  wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = aborted (navigation replaced)
    log('did-fail-load', code, desc, url);
    wc.loadURL(errorPage('The app could not load', `Windows reported: <b>${desc} (${code})</b> while opening ${url}. This is usually security software blocking local connections. Click Try again, or restart the app.`));
  });
  wc.on('render-process-gone', (_e, d) => {
    log('render-process-gone', d);
    if (d.reason !== 'clean-exit') wc.loadURL(errorPage('The app stopped unexpectedly', `Reason: <b>${d.reason}</b>. Restart the app; it will open in safe graphics mode if this keeps happening.`));
  });
  wc.on('unresponsive', () => log('renderer unresponsive'));
  wc.on('console-message', (_e, level, message, line, source) => { if (level >= 3) log('renderer error:', message, `${source}:${line}`); });
  // Diagnostics: Ctrl/Cmd+Shift+I opens developer tools, F5 / Ctrl+R reloads
  wc.on('before-input-event', (e, input) => {
    const mod = input.control || input.meta;
    if (input.type !== 'keyDown') return;
    if (mod && input.shift && input.key.toLowerCase() === 'i') { wc.toggleDevTools(); e.preventDefault(); }
    if (input.key === 'F5' || (mod && !input.shift && input.key.toLowerCase() === 'r')) { wc.reload(); e.preventDefault(); }
  });

  // OAuth popups (Google, Microsoft) open as child windows; other links open in the browser
  wc.setWindowOpenHandler(({ url: target }) => {
    if (/accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com|docs\.google\.com\/picker|localhost|127\.0\.0\.1/.test(target) || target.startsWith('blob:')) {
      return { action: 'allow' };
    }
    shell.openExternal(target);
    return { action: 'deny' };
  });

  try {
    const s = await start();
    appUrl = s.url;
    log(`Started v${app.getVersion()} on ${process.platform} ${process.arch}; server ${appUrl}; safeMode=${!!readState().safeMode}`);
  } catch (e) {
    log('server start failed', e);
    win.loadURL(errorPage('The app could not start its local service', `Error: <b>${e.message}</b>. Restart your computer and try again.`));
    return;
  }
  win.loadURL(appUrl);
}

ipcMain.on('renderer-ready', () => {
  writeState({ ...readState(), pending: false, lastOk: Date.now() });
  log('renderer ready');
});
ipcMain.on('renderer-error', (_e, msg) => log('renderer reported:', msg));
ipcMain.on('open-logs', () => shell.openPath(logDir));
ipcMain.on('theme', (_e, theme) => {
  if (!win || process.platform === 'darwin') return;
  try { win.setTitleBarOverlay(theme === 'dark' ? DARK : LIGHT); } catch { /* older platforms */ }
});
app.on('child-process-gone', (_e, d) => {
  log('child-process-gone', d);
  if (d.type === 'GPU' && d.reason !== 'clean-exit') writeState({ ...readState(), safeMode: true });
});

app.whenReady().then(createWindow).catch(e => log('createWindow failed', e));
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
