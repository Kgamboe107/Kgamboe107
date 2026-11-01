/* Settings: sample data, backup/restore, storage, reset */
(function (App) {
  App.modules.settings = {
    async render(view) {
      let usage = '';
      try { const e = await navigator.storage.estimate(); usage = `${App.fmt.bytes(e.usage || 0)} used of ~${App.fmt.bytes(e.quota || 0)} available`; } catch { /* not supported */ }
      const files = await App.store.files();
      view.innerHTML = `
        <div class="grid c2">
          <div class="card stack"><h2>Sample data</h2>
            <p class="muted small">Loads realistic example exports — Harri timesheet & roster, CrunchTime sales & inventory variance, Webull positions & orders, a Dub portfolio, a P&L, an expense ledger, marketing campaigns, and an Anara research note — so you can explore every module.</p>
            <div class="row"><button class="btn primary" id="sLoad">Load sample data</button><button class="btn" id="sRemove">Remove sample data</button></div>
          </div>
          <div class="card stack"><h2>Backup & restore</h2>
            <p class="muted small">Everything (files, tables, notes) is stored only on this computer. Export a backup file to archive it or move to another machine — store it somewhere secure, it includes personnel files.</p>
            <div class="row"><button class="btn primary" id="sExport">Export backup</button><label class="btn">Restore backup<input type="file" id="sImport" accept=".json" hidden></label></div>
            <div class="muted small">${files.length} files · ${usage}</div>
          </div>
          <div class="card stack"><h2>Appearance</h2>
            <div class="row"><button class="btn" id="sTheme">Toggle light / dark</button></div>
          </div>
          ${window.desktop ? `<div class="card stack"><h2>Troubleshooting</h2>
            <p class="muted small">If the window ever opens blank, the app switches itself to safe graphics mode on the next launch. Developer tools: <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>I</kbd>. Reload: <kbd>F5</kbd>.</p>
            <div class="row"><button class="btn" onclick="window.desktop.openLogs()">Open diagnostic logs</button></div>
          </div>` : ''}
          <div class="card stack"><h2>Reset</h2>
            <p class="muted small">Permanently deletes all files, data tables, notes, and settings on this computer.</p>
            <div class="row"><button class="btn danger" id="sClear">Delete all data</button></div>
          </div>
        </div>`;
      view.querySelector('#sLoad').onclick = async () => { await App.samples.load(); App.go('dashboard'); };
      view.querySelector('#sRemove').onclick = async () => {
        const fs = (await App.store.files()).filter(f => (f.tags || []).includes('Sample'));
        for (const f of fs) await App.store.deleteFile(f.id);
        for (const n of await App.store.all('notes')) if (fs.some(f => f.id === n.fileId)) await App.store.del('notes', n.id);
        App.ui.toast(`Removed ${fs.length} sample files`); App.go('settings');
      };
      view.querySelector('#sExport').onclick = async () => {
        const data = await App.store.exportAll();
        data.settings = Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('ocd.')).map(k => [k, localStorage.getItem(k)]));
        App.download(`ops-desk-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data), 'application/json');
      };
      view.querySelector('#sImport').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const data = JSON.parse(await f.text());
          await App.store.importAll(data);
          Object.entries(data.settings || {}).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } });
          App.ui.toast('Backup restored'); App.go('dashboard');
        } catch (err) { App.ui.toast('Restore failed: ' + err.message); }
      };
      view.querySelector('#sTheme').onclick = () => document.getElementById('themeToggle').click();
      view.querySelector('#sClear').onclick = async () => {
        if (!confirm('Delete ALL data on this computer? This cannot be undone.')) return;
        for (const s of ['files', 'datasets', 'notes']) await App.store.clear(s);
        Object.keys(localStorage).filter(k => k.startsWith('ocd.')).forEach(k => localStorage.removeItem(k));
        App.ui.toast('All data deleted'); App.go('dashboard');
      };
    }
  };
})(window.App);
