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
            <p class="muted small">Loads realistic example exports and sample Costco, Restaurant Depot and Sysco receipts: Harri timesheet & roster, CrunchTime sales & inventory variance, Webull positions & orders, a Dub portfolio, a P&L, an expense ledger, marketing campaigns, and an Anara research note — so you can explore every module.</p>
            <div class="row"><button class="btn primary" id="sLoad">Load sample data</button><button class="btn" id="sRemove">Remove sample data</button></div>
          </div>
          <div class="card stack"><h2>${App.hosted ? 'Phone version' : 'Use it on your iPhone'}</h2>
            ${App.hosted ? `<p class="muted small">${matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'Installed on this phone. ' : 'To install: in Safari tap <b>Share</b> → <b>Add to Home Screen</b>. '}Your data stays on this phone and keeps working offline.</p>
              <ol class="small" style="margin:0;padding-left:18px"><li>On your computer: Settings → <b>Export backup</b>, then AirDrop it or save it to iCloud Drive.</li><li>Here: <b>Restore backup</b> below and pick that file in Files.</li></ol>
              <p class="muted tiny">The phone and computer each keep their own copy; repeat the backup to bring the phone up to date. AI chat, live bank sync (Plaid, Square, Stripe), Google Drive and Outlook run in the desktop app.</p>`
            : `<ol class="small" style="margin:0;padding-left:18px"><li>On your iPhone, open <b>Safari</b> and go to <a href="https://kgamboe107.github.io/Kgamboe107/" target="_blank" rel="noopener">kgamboe107.github.io/Kgamboe107</a></li>
                <li>Tap <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>. It opens full screen like an app and works offline.</li>
                <li>To bring your data over: <b>Export backup</b> below, AirDrop it to the phone (or save to iCloud Drive), then on the phone open Settings → <b>Restore backup</b>.</li></ol>
              <p class="muted tiny">Data never goes to a server: the phone keeps its own copy on the phone. Repeat the backup when you want the phone up to date.</p>`}
          </div>
          <div class="card stack"><h2>Backup & restore</h2>
            <p class="muted small">Everything (files, tables, notes) is stored only on this ${App.hosted ? 'device' : 'computer'}. Export a backup file to archive it or move to another machine — store it somewhere secure, it includes personnel files.</p>
            <div class="row"><button class="btn primary" id="sExport">Export backup</button><label class="btn">Restore backup<input type="file" id="sImport" accept=".json" hidden></label></div>
            <div class="muted small">${files.length} files · ${usage}</div>
          </div>
          <div class="card stack"><h2>Security: app lock</h2>
            <p class="muted small">Require a passcode to open the app and lock it automatically when you step away. This protects personnel files, SSNs and financials from anyone who uses this computer. Also turn on BitLocker (Windows) or FileVault (Mac) disk encryption.</p>
            ${App.lock.enabled() ? `<div class="row"><span class="badge good">On</span><label class="row small">Auto-lock after <select id="lkIdle">${App.ui.options([{ value: 0, label: 'never' }, { value: 5, label: '5 min' }, { value: 10, label: '10 min' }, { value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 60, label: '1 hour' }], App.lock.cfg().idleMin)}</select></label></div>
              <div class="row"><button class="btn" id="lkNow">Lock now</button><button class="btn" id="lkChange">Change passcode</button><button class="btn danger" id="lkOff">Turn off</button></div>`
            : `<div class="row"><button class="btn primary" id="lkSet">Set a passcode</button></div>`}
          </div>
          <div class="card stack"><h2>Appearance</h2>
            <label class="field" style="max-width:280px">Your first name (for the dashboard greeting)<input id="sName" value="${App.esc(App.settings.get('userName', ''))}" placeholder="e.g. Alex" autocomplete="given-name"></label>
            <div class="seg" role="radiogroup" aria-label="Surface style">${[['glass', 'Liquid glass'], ['solid', 'Solid (faster on older PCs)']].map(([v, l]) => `<button data-surface="${v}" class="${(App.settings.get('surface', 'glass') === v) ? 'on' : ''}">${l}</button>`).join('')}</div>
            <div class="row"><button class="btn" id="sTheme">Switch light / dark mode</button></div>
          </div>
          ${window.desktop ? `<div class="card stack"><h2>Troubleshooting</h2>
            <p class="muted small">If the window ever opens blank, the app switches itself to safe graphics mode on the next launch. Developer tools: <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>I</kbd>. Reload: <kbd>F5</kbd>.</p>
            <div class="row"><button class="btn" onclick="window.desktop.openLogs()">Open diagnostic logs</button></div>
          </div>` : ''}
          <div class="card stack"><h2>Reset</h2>
            <p class="muted small">Permanently deletes all files, data tables, notes, and settings on this ${App.hosted ? 'device' : 'computer'}.</p>
            <div class="row"><button class="btn destructive" id="sClear">Erase all data…</button></div>
          </div>
        </div>`;
      view.querySelector('#sLoad').onclick = async () => { await App.samples.load(); App.go('dashboard'); };
      view.querySelector('#sRemove').onclick = async () => {
        const n = await App.samples.remove();
        App.ui.toast(`Removed ${n} sample files`); App.go('settings');
      };
      view.querySelector('#sExport').onclick = async () => {
        const data = await App.store.exportAll();
        data.settings = Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('ocd.') && !k.startsWith('ocd.secret.')).map(k => [k, localStorage.getItem(k)]));
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
      const passDialog = (title, after) => App.ui.modal(`<div class="card-head"><h2>${title}</h2><button class="btn small" data-close>Cancel</button></div>
        <div class="stack">${App.lock.enabled() ? '<label class="field">Current passcode<input type="password" id="lkCur"></label>' : ''}
          <label class="field">New passcode (at least 6 characters)<input type="password" id="lkA"></label><label class="field">Repeat<input type="password" id="lkB"></label>
          <div class="muted tiny">There is no way to recover a forgotten passcode. Keep a backup (Export backup) somewhere safe.</div>
          <div class="row"><button class="btn primary" id="lkSave">Save</button></div></div>`, (card, close) => {
          card.querySelector('#lkSave').onclick = async () => {
            if (App.lock.enabled() && !(await App.lock.check(card.querySelector('#lkCur').value))) return App.ui.toast('Current passcode is incorrect');
            const a = card.querySelector('#lkA').value, b = card.querySelector('#lkB').value;
            if (a.length < 6) return App.ui.toast('Use at least 6 characters'); if (a !== b) return App.ui.toast("Passcodes don't match");
            await App.lock.set(a, App.lock.cfg()?.idleMin ?? 10); App.compliance?.audit('App passcode set', ''); close(); App.ui.toast('App lock is on'); after?.();
          };
        });
      view.querySelector('#lkSet')?.addEventListener('click', () => passDialog('Set app passcode', () => App.go('settings')));
      view.querySelector('#lkChange')?.addEventListener('click', () => passDialog('Change passcode', () => App.go('settings')));
      view.querySelector('#lkNow')?.addEventListener('click', () => App.lock.lock());
      view.querySelector('#lkIdle')?.addEventListener('change', e => { App.lock.setIdle(+e.target.value); App.ui.toast('Auto-lock updated'); });
      view.querySelector('#lkOff')?.addEventListener('click', () => App.ui.modal(`<div class="card-head"><h2>Turn off app lock</h2><button class="btn small" data-close>Cancel</button></div><div class="stack"><label class="field">Passcode<input type="password" id="lkOffP"></label><div class="row"><button class="btn danger" id="lkOffGo">Turn off</button></div></div>`, (card, close) => {
        card.querySelector('#lkOffGo').onclick = async () => { if (!(await App.lock.check(card.querySelector('#lkOffP').value))) return App.ui.toast('Incorrect passcode'); App.lock.disable(); App.compliance?.audit('App passcode removed', ''); close(); App.go('settings'); };
      }));
      view.querySelector('#sName').onchange = e => { App.settings.set('userName', e.target.value.trim()); App.ui.toast('Name saved'); };
      view.querySelectorAll('[data-surface]').forEach(b => b.onclick = () => { App.ux.setSurface(b.dataset.surface); view.querySelectorAll('[data-surface]').forEach(x => x.classList.toggle('on', x === b)); });
      view.querySelector('#sTheme').onclick = () => App.fx.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      view.querySelector('#sClear').onclick = async () => {
        if (!await App.confirm({ title: `Erase all data on this ${App.hosted ? 'device' : 'computer'}?`, body: 'Every business, file, data table, receipt, note and setting is permanently deleted. Download a backup first if you might need it. This cannot be undone.', ok: 'Erase everything', cancel: 'Keep my data', danger: true })) return;
        for (const s of ['files', 'datasets', 'notes', 'purchases']) await App.store.clear(s);
        Object.keys(localStorage).filter(k => k.startsWith('ocd.')).forEach(k => localStorage.removeItem(k));
        App.ui.toast('All data deleted'); App.go('dashboard');
      };
    }
  };
})(window.App);
