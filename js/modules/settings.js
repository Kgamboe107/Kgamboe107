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
          <div class="card stack"><h2>Backup & restore</h2>
            <p class="muted small">Everything (files, tables, notes) is stored only on this computer. Export a backup file to archive it or move to another machine — store it somewhere secure, it includes personnel files.</p>
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
        for (const pr of await App.store.all('purchases')) if (pr.sample) await App.store.del('purchases', pr.id);
        await App.purchasing.syncDataset();
        for (const k of ['cmp.licenses', 'cmp.cpay', 'cmp.custom', 'legal.incidents', 'legal.signed']) App.bsettings.set(k, App.bsettings.get(k, []).filter(x => !x.sample));
        const dn = App.bsettings.get('cmp.done', {}); Object.keys(dn).forEach(k => { if (dn[k].sample) delete dn[k]; }); App.bsettings.set('cmp.done', dn);
        if (App.bsettings.get('cmp.setup', {}).sample) App.bsettings.set('cmp.setup', null);
        if (App.bsettings.get('legal.profile', {})?.sample) App.bsettings.set('legal.profile', null);
        App.ui.toast(`Removed ${fs.length} sample files`); App.go('settings');
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
      view.querySelector('#sTheme').onclick = () => document.getElementById('themeToggle').click();
      view.querySelector('#sClear').onclick = async () => {
        if (!confirm('Delete ALL data on this computer? This cannot be undone.')) return;
        for (const s of ['files', 'datasets', 'notes', 'purchases']) await App.store.clear(s);
        Object.keys(localStorage).filter(k => k.startsWith('ocd.')).forEach(k => localStorage.removeItem(k));
        App.ui.toast('All data deleted'); App.go('dashboard');
      };
    }
  };
})(window.App);
