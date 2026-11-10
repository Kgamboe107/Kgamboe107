/* Accounts & cloud sync (Supabase).
   - Opening page: sign in, or create an account. New accounts wait for the admin's approval: the admin approves
     them in Settings → Accounts and gives them a 6-digit verification code, which they enter to get in.
   - Sync: everything you add on one device appears on your others automatically. Data is encrypted on the device
     with a key made from your password (AES-256-GCM); the server only ever stores encrypted blobs.
   - "Use on this device only" keeps the app fully local, as before. */
(function (App) {
  const CFG = {
    url: 'https://tatfzakpmpmgaijhwcob.supabase.co',
    key: 'sb_publishable_Pbv3uD6blYU5VWPAzN1Jtw_BdAV3lju',
    admin: 'koen@gamboeconsulting.com'
  };
  const STORES = ['files', 'datasets', 'notes', 'purchases', 'spending', 'giving', 'gigs', 'work'];
  const ATT = ['purchases', 'spending', 'giving', 'gigs', 'work']; // stores whose records carry an attachment (receipt photo / PDF)
  // Settings that stay on each device: sign-in, sync state, app lock, API-key markers, window state
  const LOCAL_ONLY = /^(cloud\.|sync\.|lock|secret\.|onboarded$|theme$|surface$|rail$|activeBiz$|ai\.ollama)/;
  const BIG = 700000; // encrypted records larger than this go to file storage instead of the table

  const S = {
    get: k => App.settings.get('cloud.' + k, null),
    set: (k, v) => v == null ? localStorage.removeItem('ocd.cloud.' + k) : App.settings.set('cloud.' + k, v)
  };
  const session = () => S.get('session');
  const user = () => session()?.user || null;
  const mode = () => S.get('mode'); // 'account' | 'local' | null (not chosen yet)

  /* ---------- HTTP ---------- */
  async function refresh() {
    const s = session();
    if (!s?.refresh_token) throw new Error('Signed out');
    const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { if (r.status === 400 || r.status === 401) S.set('session', null); throw new Error(j.error_description || j.msg || 'Your session expired. Sign in again.'); }
    saveSession(j);
    return j.access_token;
  }
  function saveSession(j) { S.set('session', { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: { id: j.user.id, email: j.user.email } }); }
  async function token() {
    const s = session();
    if (!s) throw new Error('Not signed in');
    if (s.expires_at - 60 < Date.now() / 1000) return refresh();
    return s.access_token;
  }
  async function api(path, { method = 'GET', body, headers = {}, raw = false, auth = true } = {}) {
    const go = async () => fetch(CFG.url + path, { method, headers: { apikey: CFG.key, ...(auth ? { Authorization: 'Bearer ' + await token() } : {}), ...(body !== undefined && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body) });
    let r = await go();
    if (r.status === 401 && auth) { await refresh(); r = await go(); }
    if (raw) return r;
    const text = await r.text();
    let j; try { j = text ? JSON.parse(text) : null; } catch { j = text; }
    if (!r.ok) throw new Error(j?.message || j?.error_description || j?.error || j?.msg || `Cloud request failed (${r.status})`);
    return j;
  }

  /* ---------- Encryption (key never leaves the device) ---------- */
  const kdb = () => new Promise((res, rej) => { const q = indexedDB.open('ocd-sync', 1); q.onupgradeneeded = () => { q.result.createObjectStore('keys'); q.result.createObjectStore('prints'); }; q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  async function kget(store, k) { const db = await kdb(); return new Promise(res => { const q = db.transaction(store).objectStore(store).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); }
  async function kset(store, k, v) { const db = await kdb(); return new Promise(res => { const t = db.transaction(store, 'readwrite'); v === undefined ? t.objectStore(store).delete(k) : t.objectStore(store).put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }); }
  async function deriveKey(password, uid) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new TextEncoder().encode('ops-command-desk:vault:' + uid), iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  let KEY = null;
  const vaultKey = async () => KEY || (KEY = await kget('keys', user()?.id));
  const b64 = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function seal(bytes) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await vaultKey(), bytes); const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return out; }
  async function open(bytes) { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await vaultKey(), bytes.slice(12))); }
  const sealText = async s => b64(await seal(new TextEncoder().encode(s)));
  const openText = async s => new TextDecoder().decode(await open(unb64(s)));

  /* ---------- Account actions ---------- */
  async function signIn(email, password) {
    const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(/invalid/i.test(j.error_description || j.msg || '') ? 'Wrong email or password.' : (j.error_description || j.msg || 'Could not sign in. Check your connection.'));
    saveSession(j);
    S.set('lastEmail', j.user.email);
    KEY = await deriveKey(password, j.user.id);
    await kset('keys', j.user.id, KEY);
    S.set('mode', 'account');
    return j.user;
  }
  async function signUp(name, email, password) {
    const r = await fetch(`${CFG.url}/functions/v1/signup`, { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not create the account.');
    return signIn(email, password);
  }
  async function signOut() {
    try { await api('/auth/v1/logout', { method: 'POST', raw: true }); } catch { /* offline */ }
    const id = user()?.id;
    S.set('session', null); S.set('mode', null); KEY = null;
    if (id) await kset('keys', id, undefined);
    stop();
  }
  const profile = async () => (await api(`/rest/v1/profiles?id=eq.${user().id}&select=*`))?.[0] || null;
  const redeem = code => api('/rest/v1/rpc/redeem_code', { method: 'POST', body: { code } });
  const admin = {
    list: () => api('/rest/v1/profiles?select=id,email,name,role,status,created_at,approved_at,code_expires&order=created_at.desc'),
    approve: id => api('/rest/v1/rpc/approve_user', { method: 'POST', body: { target: id } }),
    revoke: id => api('/rest/v1/rpc/revoke_user', { method: 'POST', body: { target: id } })
  };

  /* ---------- Sync ---------- */
  const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; };
  let prints = null, busy = false, timer = null, poll = null, applying = false, lastError = '', lastSync = 0;
  const printKey = () => 'p:' + user().id;
  async function loadPrints() { if (!prints) prints = (await kget('prints', printKey())) || {}; return prints; }
  const savePrints = () => kset('prints', printKey(), prints);
  const fileMeta = f => { const { blob, ...m } = f; return { ...m, __blob: blob ? { size: blob.size, type: blob.type } : null }; };
  const attMeta = p => p.attachment?.blob ? { ...p, attachment: { ...p.attachment, blob: undefined, __blob: { size: p.attachment.blob.size, type: p.attachment.blob.type } } } : p;
  const metaOf = (store, rec) => store === 'files' ? fileMeta(rec) : ATT.includes(store) ? attMeta(rec) : rec;

  const isSample = r => r && (r.sample === true || (Array.isArray(r.tags) && r.tags.includes('Sample')));
  async function snapshot() {
    const out = new Map();
    const sampleFiles = new Set((await App.store.all('files', { raw: true })).filter(isSample).map(f => f.id));
    for (const st of STORES) for (const r of await App.store.all(st, { raw: true })) {
      if (isSample(r) || (r.fileId && sampleFiles.has(r.fileId))) continue; // demo data stays on the device it was loaded on
      const meta = metaOf(st, r);
      out.set(`${st}/${r.id}`, { store: st, id: r.id, rec: r, json: JSON.stringify(meta) });
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith('ocd.')) continue;
      const id = k.slice(4);
      if (LOCAL_ONLY.test(id)) continue;
      out.set(`settings/${id}`, { store: 'settings', id, json: localStorage.getItem(k) });
    }
    return out;
  }
  async function putObject(path, bytes) {
    const r = await api(`/storage/v1/object/vault/${path}`, { method: 'POST', body: new Blob([bytes], { type: 'application/octet-stream' }), headers: { 'x-upsert': 'true' }, raw: true });
    if (!r.ok) throw new Error(`Upload failed (${r.status})`);
  }
  async function getObject(path) {
    const r = await api(`/storage/v1/object/authenticated/vault/${path}`, { raw: true });
    if (!r.ok) throw new Error(`Download failed (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  }
  const enc = s => encodeURIComponent(s).replace(/%2F/g, '_');

  async function push() {
    await loadPrints();
    const snap = await snapshot();
    const rows = [];
    for (const [k, v] of snap) {
      const h = fnv(v.json);
      if (prints[k] === h) continue;
      const row = { store: v.store, id: String(v.id), deleted: false, data: null, blob_path: null };
      let payload = await sealText(v.json);
      if (payload.length > BIG) { row.blob_path = `${user().id}/rec/${v.store}/${enc(String(v.id))}`; await putObject(row.blob_path, unb64(payload)); payload = null; }
      row.data = payload;
      // File contents (PDFs, images, receipt photos) go to storage, encrypted
      const blob = v.store === 'files' ? v.rec.blob : ATT.includes(v.store) ? v.rec.attachment?.blob : null;
      if (blob) await putObject(`${user().id}/blob/${v.store}/${enc(String(v.id))}`, await seal(new Uint8Array(await blob.arrayBuffer())));
      rows.push({ row, k, h });
    }
    for (const k of Object.keys(prints)) if (!snap.has(k)) { const [store, ...rest] = k.split('/'); rows.push({ row: { store, id: rest.join('/'), deleted: true, data: null, blob_path: null }, k, h: null }); }
    for (let i = 0; i < rows.length; i += 25) {
      const batch = rows.slice(i, i + 25);
      await api('/rest/v1/records?on_conflict=user_id,store,id', { method: 'POST', body: batch.map(b => b.row), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, raw: false });
      for (const b of batch) { if (b.h) prints[b.k] = b.h; else delete prints[b.k]; }
      await savePrints();
    }
    return rows.length;
  }

  /* ---------- Linked devices ---------- */
  const deviceId = () => S.get('device') || (S.set('device', (crypto.randomUUID?.() || String(Math.random()).slice(2))), S.get('device'));
  function deviceName() {
    if (window.desktop) return window.desktop.platform === 'darwin' ? 'Mac (desktop app)' : window.desktop.platform === 'win32' ? 'Windows laptop (desktop app)' : 'Computer (desktop app)';
    if (App.isIOS) return /iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone';
    if (/Android/i.test(navigator.userAgent)) return 'Android phone';
    return /Mac/.test(navigator.platform) ? 'Mac browser' : /Win/.test(navigator.platform) ? 'Windows browser' : 'Web browser';
  }
  async function beat(force = false) {
    if (!force && Date.now() - (S.get('beat') || 0) < 10 * 60e3) return;
    const me = { name: deviceName(), app: window.desktop ? 'desktop app' : App.hosted ? 'phone / web app' : 'browser', seen: Date.now() };
    await api('/rest/v1/records?on_conflict=user_id,store,id', { method: 'POST', body: [{ store: 'devices', id: deviceId(), deleted: false, data: await sealText(JSON.stringify(me)), blob_path: null }], headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    S.set('beat', Date.now());
    S.set('devlist', { ...(S.get('devlist') || {}), [deviceId()]: me });
  }
  async function idbPut(store, rec) { await App.store.raw(store, 'put', rec); }
  async function idbDel(store, id) { await App.store.raw(store, 'delete', id); }
  async function pull() {
    await loadPrints();
    let cursor = S.get('cursor.' + user().id) || '1970-01-01T00:00:00Z', changed = 0, guard = 0;
    for (;;) {
      const list = await api(`/rest/v1/records?select=store,id,updated_at,deleted,data,blob_path&updated_at=gt.${encodeURIComponent(cursor)}&order=updated_at.asc&limit=200`);
      if (!list?.length) break;
      for (const r of list) {
        const k = `${r.store}/${r.id}`;
        try {
          if (r.store === 'devices') { if (!r.deleted) S.set('devlist', { ...(S.get('devlist') || {}), [r.id]: JSON.parse(await openText(r.data)) }); cursor = r.updated_at; continue; }
          if (r.deleted) {
            if (prints[k] !== undefined) { applying = true; if (r.store === 'settings') localStorage.removeItem('ocd.' + r.id); else await idbDel(r.store, r.id); delete prints[k]; changed++; }
          } else {
            const json = r.blob_path ? new TextDecoder().decode(await open(await getObject(r.blob_path))) : await openText(r.data);
            const h = fnv(json);
            if (prints[k] !== h) {
              applying = true;
              if (r.store === 'settings') localStorage.setItem('ocd.' + r.id, json);
              else {
                const rec = JSON.parse(json);
                const bm = r.store === 'files' ? rec.__blob : ATT.includes(r.store) ? rec.attachment?.__blob : null;
                if (bm) {
                  const bytes = await open(await getObject(`${user().id}/blob/${r.store}/${enc(String(r.id))}`));
                  const blob = new Blob([bytes], { type: bm.type });
                  if (r.store === 'files') rec.blob = blob; else rec.attachment = { ...rec.attachment, blob };
                }
                if (rec.__blob !== undefined) delete rec.__blob;
                if (rec.attachment?.__blob) delete rec.attachment.__blob;
                await idbPut(r.store, rec);
              }
              prints[k] = h; changed++;
            }
          }
        } catch (e) { console.warn('Sync: could not apply', k, e); lastError = 'Some items could not be read. Sign out and back in on this device.'; }
        cursor = r.updated_at;
      }
      S.set('cursor.' + user().id, cursor);
      await savePrints();
      applying = false;
      if (list.length < 200 || ++guard > 200) break;
    }
    return changed;
  }

  async function syncNow({ quiet = true } = {}) {
    if (mode() !== 'account' || !session() || busy || !navigator.onLine) return;
    busy = true; status('syncing');
    try {
      const got = await pull();
      const sent = await push();
      await beat();
      lastSync = Date.now(); lastError = ''; S.set('last', lastSync);
      status('ok');
      if (got) { App.bus.emit('data-changed', 'sync'); App.bus.emit('biz-changed'); if (App.currentRoute) App.go(App.currentRoute()); }
      if (!quiet) App.ui.toast(got || sent ? `Synced · ${got} in, ${sent} out` : 'Everything is up to date');
      return { got, sent };
    } catch (e) {
      lastError = e.message; status('error');
      if (/Signed out|session expired/i.test(e.message)) { stop(); gate(true); }
      if (!quiet) App.ui.toast('Sync: ' + e.message, 5000);
    } finally { busy = false; applying = false; }
  }
  const soon = () => { if (applying || mode() !== 'account') return; clearTimeout(timer); timer = setTimeout(() => syncNow(), 2500); };
  function start() {
    stop();
    App.bus.on('data-changed', soon);
    poll = setInterval(() => syncNow(), 30000);
    window.addEventListener('online', soon);
    document.addEventListener('visibilitychange', onVis);
    syncNow();
  }
  const onVis = () => { if (document.visibilityState === 'visible') syncNow(); };
  function stop() { clearInterval(poll); clearTimeout(timer); poll = null; document.removeEventListener('visibilitychange', onVis); }
  // Settings changes (targets, calendar items, units…) sync too
  const origSet = App.settings.set.bind(App.settings);
  App.settings.set = (k, v) => { origSet(k, v); if (!LOCAL_ONLY.test(k)) soon(); };

  /* Sync indicator in the sidebar footer */
  function status(s) {
    const el = document.getElementById('syncDot'); if (!el) return;
    el.dataset.state = s;
    el.title = s === 'syncing' ? 'Syncing…' : s === 'error' ? 'Sync problem: ' + lastError : `Synced ${lastSync ? new Date(lastSync).toLocaleTimeString() : ''}`;
    const lbl = el.querySelector('.lbl'); if (lbl) lbl.textContent = s === 'syncing' ? 'Syncing…' : s === 'error' ? 'Sync paused' : 'Synced to cloud';
  }

  /* ---------- Opening page ---------- */
  const esc = s => App.esc(s);
  let gateResolve = null;
  function screen(html, dir = 0) {
    let el = document.getElementById('authGate'), fresh = false;
    if (!el) {
      fresh = true;
      el = document.createElement('div'); el.id = 'authGate'; el.className = 'auth-gate';
      // Liquid backdrop: slow-moving blurred blobs and light streaks behind the glass card
      el.innerHTML = `<div class="ag-bg" aria-hidden="true"><i class="ag-blob b1"></i><i class="ag-blob b2"></i><i class="ag-blob b3"></i><i class="ag-blob b4"></i>
        <svg class="ag-streaks" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="agS" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#c4b5fd" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
        <path d="M-100 620 C 200 420, 420 760, 720 520 S 1150 300, 1320 420"/><path d="M-120 700 C 260 520, 520 820, 820 600 S 1180 420, 1320 520"/><path d="M-80 180 C 240 60, 520 300, 820 160 S 1160 40, 1320 120"/></svg></div>
        <div class="auth-card"><div class="ag-sheen" aria-hidden="true"></div><div class="ag-body"></div></div>`;
      document.body.appendChild(el);
    }
    const card = el.querySelector('.auth-card'), body = el.querySelector('.ag-body');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const h0 = card.getBoundingClientRect().height;
    body.innerHTML = html;
    App.fx?.hydrateIcons?.(body);
    enhance(body);
    if (!fresh && !reduce && card.animate) {
      // The card morphs to its new height while the new content slides in
      const h1 = card.getBoundingClientRect().height;
      card.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      [...body.children].forEach((c, i) => c.animate([{ opacity: 0, transform: `translateX(${dir * 26}px) translateY(${dir ? 0 : 8}px)`, filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: 380, delay: 40 + i * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    }
    document.getElementById('splash')?.remove();
    return el;
  }
  /* Field icons, show/hide password, strength meter, 6-box code */
  const IC = {
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a10.6 10.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };
  const fld = (id, label, type, ac, icon, extra = '') => `<label class="ag-field"><span class="ag-lbl">${label}</span><span class="ag-in"><span class="ag-ic">${IC[icon]}</span>
    <input id="${id}" type="${type}" autocomplete="${ac}" placeholder=" " ${extra}>${type === 'password' ? `<button type="button" class="ag-eye" aria-label="Show password" data-eye="${id}">${IC.eye}</button>` : ''}</span></label>`;
  function enhance(root) {
    root.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => {
      const i = root.querySelector('#' + b.dataset.eye), show = i.type === 'password';
      i.type = show ? 'text' : 'password'; b.innerHTML = show ? IC.eyeOff : IC.eye; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); i.focus();
    });
    root.querySelectorAll('.ag-in input').forEach(i => { const up = () => i.closest('.ag-in').classList.toggle('filled', !!i.value); i.addEventListener('input', up); up(); });
    const meter = root.querySelector('.ag-meter');
    if (meter) {
      const pw = root.querySelector('#agPw');
      pw.addEventListener('input', () => {
        const v = pw.value, s = !v ? 0 : (v.length >= 10) + (v.length >= 14) + (/[A-Z]/.test(v) && /[a-z]/.test(v)) + /\d/.test(v) + /[^A-Za-z0-9]/.test(v);
        const lvl = !v ? 0 : v.length < 10 ? 1 : s <= 2 ? 2 : s <= 3 ? 3 : 4;
        meter.dataset.l = lvl; meter.querySelector('span').textContent = ['', 'Too short (10+ characters)', 'Fair', 'Good', 'Strong'][lvl];
      });
    }
    const otp = root.querySelector('.ag-otp');
    if (otp) {
      const inp = otp.querySelector('input'), cells = [...otp.querySelectorAll('.ag-cell')];
      const draw = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); const v = inp.value; cells.forEach((c, i) => { c.textContent = v[i] || ''; c.classList.toggle('on', document.activeElement === inp && i === Math.min(v.length, 5)); c.classList.toggle('done', !!v[i]); }); };
      ['input', 'focus', 'blur', 'keyup'].forEach(ev => inp.addEventListener(ev, draw)); draw();
    }
  }
  const setBusy = (b, on, label) => { b.disabled = on; b.classList.toggle('loading', on); b.querySelector('.ag-go-t').textContent = label; };
  const shake = el => el.querySelector('.auth-card')?.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 420, easing: 'ease-out' });
  const goBtn = label => `<button class="btn primary auth-go" type="submit"><span class="ag-spin" aria-hidden="true"></span><span class="ag-go-t">${label}</span>${IC.arrow}</button>`;
  const done = () => {
    const el = document.getElementById('authGate'); const r = gateResolve; gateResolve = null;
    if (el && el.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('leaving'); setTimeout(() => el.remove(), 360); } else el?.remove();
    r?.();
  };
  const brand = `<div class="auth-brand"><div class="brand-mark">OC</div><div><div class="auth-name">Ops Command Desk</div><div class="muted small">Operations Manager</div></div></div>`;

  function showSignIn(msg = '', dir = 0) {
    const el = screen(`${brand}
      <div class="ag-head"><h1>Welcome <span class="ag-grad">back</span></h1><p class="muted small">Sign in to see your data on every device. It updates automatically.</p></div>
      <form id="agIn" class="ag-form" autocomplete="on">
        ${fld('agEmail', 'Email address', 'email', 'username', 'mail', 'required')}
        ${fld('agPw', 'Password', 'password', 'current-password', 'lock', 'required')}
        <label class="ag-check"><input type="checkbox" id="agRemember" ${S.get('rememberEmail') === false ? '' : 'checked'}><span class="ag-box"></span>Remember my email on this device</label>
        <div class="alert bad small" id="agErr" ${msg ? '' : 'hidden'}>${esc(msg)}</div>
        ${goBtn('Sign in')}
      </form>
      <div class="auth-alt">New here? <button class="linkish" id="agToUp">Create an account</button></div>
      <div class="auth-foot"><button class="linkish muted small" id="agLocal">Use on this device only, without an account</button></div>`, dir);
    const err = m => { const e = el.querySelector('#agErr'); e.hidden = !m; e.textContent = m; if (m) shake(el); };
    el.querySelector('#agIn').onsubmit = async e => {
      e.preventDefault(); const b = el.querySelector('.auth-go'); setBusy(b, true, 'Signing in…'); err('');
      const remember = el.querySelector('#agRemember').checked; S.set('rememberEmail', remember);
      try { await signIn(el.querySelector('#agEmail').value, el.querySelector('#agPw').value); if (!remember) S.set('lastEmail', ''); await afterSignIn(); }
      catch (x) { setBusy(b, false, 'Sign in'); err(x.message); }
    };
    el.querySelector('#agToUp').onclick = () => showSignUp(1);
    el.querySelector('#agLocal').onclick = () => { S.set('mode', 'local'); done(); };
    const pre = new URLSearchParams(location.search).get('email') || (S.get('rememberEmail') === false ? '' : S.get('lastEmail'));
    if (pre) { const i = el.querySelector('#agEmail'); i.value = pre; i.dispatchEvent(new Event('input')); setTimeout(() => el.querySelector('#agPw')?.focus(), 60); }
    else setTimeout(() => el.querySelector('#agEmail')?.focus(), 50);
  }
  function showSignUp(dir = 0) {
    const el = screen(`${brand}
      <div class="ag-head"><h1>Create <span class="ag-grad">account</span></h1><p class="muted small">After you sign up, the administrator approves your account and gives you a 6-digit verification code.</p></div>
      <form id="agUp" class="ag-form" autocomplete="on">
        ${fld('agName', 'Your name', 'text', 'name', 'user', 'required')}
        ${fld('agEmail', 'Email address', 'email', 'username', 'mail', 'required')}
        <div class="ag-two">${fld('agPw', 'Password', 'password', 'new-password', 'lock', 'minlength="10" required')}${fld('agPw2', 'Confirm password', 'password', 'new-password', 'lock', 'minlength="10" required')}</div>
        <div class="ag-meter" data-l="0"><i></i><i></i><i></i><i></i><span>10+ characters</span></div>
        <div class="muted tiny">Your data is encrypted with this password before it leaves your device. There is no way to recover data if you forget it.</div>
        <div class="alert bad small" id="agErr" hidden></div>
        ${goBtn('Create account')}
      </form>
      <div class="auth-alt">Have an account? <button class="linkish" id="agToIn">Sign in</button></div>`, dir);
    const err = m => { const e = el.querySelector('#agErr'); e.hidden = !m; e.textContent = m; if (m) shake(el); };
    el.querySelector('#agUp').onsubmit = async e => {
      e.preventDefault(); err('');
      const pw = el.querySelector('#agPw').value;
      if (pw !== el.querySelector('#agPw2').value) return err('The passwords don’t match.');
      const b = el.querySelector('.auth-go'); setBusy(b, true, 'Creating…');
      try { await signUp(el.querySelector('#agName').value.trim(), el.querySelector('#agEmail').value, pw); await afterSignIn(); }
      catch (x) { setBusy(b, false, 'Create account'); err(x.message); }
    };
    el.querySelector('#agToIn').onclick = () => showSignIn('', -1);
    setTimeout(() => el.querySelector('#agName')?.focus(), 50);
  }
  function showPending(p, msg = '') {
    const revoked = p?.status === 'revoked';
    const el = screen(`${brand}
      <div class="ag-head"><div class="ag-badge ${revoked ? 'bad' : ''}">${revoked ? IC.lock : '<span class="ag-pulse"></span>'}${revoked ? 'Access removed' : 'Waiting for approval'}</div>
      <h1>${revoked ? 'Ask for a new <span class="ag-grad">code</span>' : 'Enter your <span class="ag-grad">code</span>'}</h1>
      <p class="muted small">${revoked ? 'The administrator removed access for this account. Ask them to approve it again, then enter the new code.' : `Your account <b>${esc(user()?.email || '')}</b> was created. Ask the administrator for your 6-digit verification code and enter it here.`}</p></div>
      <form id="agCode" class="ag-form">
        <label class="ag-otp" aria-label="6-digit verification code"><input id="agC" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>
          <span class="ag-cells" aria-hidden="true">${'<span class="ag-cell"></span>'.repeat(6)}</span></label>
        <div class="alert bad small" id="agErr" ${msg ? '' : 'hidden'}>${esc(msg)}</div>
        ${goBtn('Verify')}
      </form>
      <div class="auth-alt"><button class="linkish" id="agOut">Sign out</button></div>`);
    if (msg) shake(el);
    el.querySelector('#agCode').onsubmit = async e => {
      e.preventDefault(); const b = el.querySelector('.auth-go'); setBusy(b, true, 'Checking…');
      try { const ok = await redeem(el.querySelector('#agC').value.trim()); if (ok) return afterSignIn(); showPending(await profile(), 'That code isn’t right or has expired. Check it with the administrator (5 tries per code).'); }
      catch (x) { showPending(p, x.message); }
    };
    el.querySelector('#agOut').onclick = async () => { await signOut(); showSignIn('', -1); };
    setTimeout(() => el.querySelector('#agC')?.focus(), 50);
  }
  async function afterSignIn() {
    let p;
    try { p = await profile(); } catch (e) { if (!navigator.onLine && session()) { done(); start(); return; } return showSignIn(e.message); }
    if (!p) return showSignIn('Account not found.');
    if (p.status !== 'approved') return showPending(p);
    S.set('profile', { email: p.email, name: p.name, role: p.role });
    // A different account signed in on this device: remove the previous account's copy (it's safe in that account)
    const owner = S.get('owner');
    if (owner && owner !== p.id) {
      for (const st of STORES) await App.store.clear(st);
      for (const k of Object.keys(localStorage)) if (k.startsWith('ocd.') && !LOCAL_ONLY.test(k.slice(4))) localStorage.removeItem(k);
      prints = null;
    }
    S.set('owner', p.id);
    done();
    start();
    if (p.role === 'admin') admin.list().then(l => { const n = l.filter(x => x.status === 'pending').length; if (n) App.ui.toast(`${n} account${n > 1 ? 's' : ''} waiting for your approval (Settings → Accounts)`, 6000); }).catch(() => {});
  }
  const ask = () => new Promise(res => { gateResolve = res; showSignIn(); });
  /* Called at start-up; resolves when the app may open */
  function gate(force = false) {
    return new Promise(resolve => {
      gateResolve = resolve;
      if (mode() === 'local' && !force) return done();
      if (session() && !force) {
        // Open right away with local data; check approval in the background (works offline)
        vaultKey().then(k => { if (!k) { S.set('session', null); return showSignIn('Sign in again on this device to unlock your synced data.'); } afterSignIn(); });
        return;
      }
      showSignIn(force ? 'Your session ended. Sign in again.' : '');
    });
  }

  /* ---------- Settings → Accounts & sync ---------- */
  async function settingsCard() {
    if (mode() !== 'account' || !session()) {
      return `<div class="card stack"><h2>Account &amp; sync</h2><p class="muted small">You're using the app on this device only. Sign in to keep your data on all your devices, updated automatically and encrypted.</p>
        <div class="row"><button class="btn primary" id="acSignIn">Sign in or create an account</button></div></div>`;
    }
    const p = S.get('profile') || {};
    let people = '';
    if (p.role === 'admin') {
      try {
        const l = await admin.list();
        const st = s => s === 'approved' ? '<span class="badge good">approved</span>' : s === 'pending' ? '<span class="badge warn">waiting</span>' : '<span class="badge bad">removed</span>';
        people = `<div class="rv-h">Accounts (you approve new ones)</div><div class="stack">${l.map(x => `<div class="bk-item"><div><b>${esc(x.name || x.email)}</b> ${st(x.status)}${x.role === 'admin' ? ' <span class="badge">admin</span>' : ''}<div class="muted tiny">${esc(x.email)} · signed up ${esc(App.fmt.date(x.created_at))}${x.status === 'pending' && x.code_expires ? ' · code sent, expires ' + esc(App.fmt.date(x.code_expires)) : ''}</div></div>
          ${x.role === 'admin' ? '' : `<div class="row">${x.status !== 'approved' ? `<button class="btn small primary" data-acok="${x.id}">${x.code_expires ? 'New code' : 'Approve'}</button>` : ''}${x.status !== 'revoked' ? `<button class="btn small danger" data-acno="${x.id}">${x.status === 'pending' ? 'Decline' : 'Remove access'}</button>` : ''}</div>`}</div>`).join('')}</div>`;
      } catch (e) { people = `<div class="alert bad small">${esc(e.message)}</div>`; }
    }
    const last = S.get('last');
    const devs = Object.entries(S.get('devlist') || {}).sort((a, b) => b[1].seen - a[1].seen);
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'active now' : m < 90 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
    const phoneUrl = `https://kgamboe107.github.io/Kgamboe107/?email=${encodeURIComponent(user()?.email || '')}`;
    let qr = '';
    try { if (window.qrcode) { const q = window.qrcode(0, 'M'); q.addData(phoneUrl); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } } catch { qr = ''; }
    const devicesHtml = `<div class="rv-h">Your linked devices</div>
      <div class="stack">${devs.map(([id, d]) => `<div class="bk-item"><div><b>${esc(d.name)}</b>${id === deviceId() ? ' <span class="badge accent">this device</span>' : ''}<div class="muted tiny">${esc(d.app || '')} · ${esc(ago(d.seen))}</div></div></div>`).join('') || '<div class="muted small">Only this device so far.</div>'}</div>
      ${App.hosted ? `<div class="muted small">To link your laptop: open the Ops Command Desk desktop app (or this same address in a browser) and sign in with <b>${esc(user()?.email || '')}</b>.</div>`
      : `<div class="link-phone"><div class="link-qr">${qr || ''}</div><div class="stack" style="gap:6px"><b>Link your iPhone</b>
          <ol class="small" style="margin:0;padding-left:18px"><li>Point the iPhone camera at this code and tap the link (or open <a href="${phoneUrl}" target="_blank" rel="noopener">kgamboe107.github.io/Kgamboe107</a> in Safari).</li>
          <li>Tap <b>Share → Add to Home Screen</b>, open the new icon.</li><li>Sign in with this same email and password. Your data appears in a few seconds.</li></ol></div></div>`}`;
    return `<div class="card stack"><h2>Account &amp; sync</h2>
      <div class="row spread"><div><b>${esc(p.name || user()?.email)}</b><div class="muted small">${esc(user()?.email)}${p.role === 'admin' ? ' · administrator' : ''}</div></div><span class="badge ${lastError ? 'bad' : 'good'}">${lastError ? 'sync paused' : 'syncing on'}</span></div>
      <div class="muted small">Last synced ${last ? esc(new Date(last).toLocaleString()) : 'not yet'}. Changes upload within seconds and other devices pick them up within 30 seconds (or when opened). Data is encrypted on this device before upload.${lastError ? ' <span style="color:var(--bad)">' + esc(lastError) + '</span>' : ''}</div>
      <div class="row"><button class="btn" id="acSync">Sync now</button><button class="btn" id="acOut">Sign out of this device</button></div>
      ${devicesHtml}
      ${people}</div>`;
  }
  function bindSettings(view) {
    if (mode() === 'account' && session()) beat(true).catch(() => {});
    view.querySelector('#acSignIn')?.addEventListener('click', () => { S.set('mode', null); ask().then(() => App.go('settings')); });
    view.querySelector('#acSync')?.addEventListener('click', () => syncNow({ quiet: false }).then(() => App.go('settings')));
    view.querySelector('#acOut')?.addEventListener('click', async () => {
      if (!await App.confirm({ title: 'Sign out of this device?', body: 'Your data stays on this device and in your account. To use the app here again, sign in or choose “this device only”.', ok: 'Sign out' })) return;
      await signOut(); ask().then(() => App.go('dashboard'));
    });
    view.querySelectorAll('[data-acok]').forEach(b => b.onclick = async () => {
      try {
        const code = await admin.approve(b.dataset.acok);
        App.ui.modal(`<div class="row spread"><h2>Verification code</h2><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
          <p class="muted small">Give this code to the person (text or tell them). They enter it on the “Waiting for approval” screen. It works for 7 days and 5 tries.</p>
          <div class="auth-show-code">${esc(code)}</div>
          <div class="row" style="justify-content:flex-end"><button class="btn" id="cpCode">Copy</button>${navigator.share ? '<button class="btn primary" id="shCode">Share…</button>' : ''}</div>`, (c, close) => {
          c.querySelector('#cpCode').onclick = () => navigator.clipboard?.writeText(code).then(() => App.ui.toast('Code copied'));
          c.querySelector('#shCode')?.addEventListener('click', () => navigator.share({ text: `Your Ops Command Desk verification code: ${code}` }).catch(() => {}));
          c.querySelectorAll('[data-close]').forEach(x => x.addEventListener('click', () => App.go('settings')));
        });
      } catch (e) { App.ui.toast(e.message, 5000); }
    });
    view.querySelectorAll('[data-acno]').forEach(b => b.onclick = async () => {
      if (!await App.confirm({ title: 'Remove access?', body: 'They can’t sign in to synced data until you approve them again.', ok: 'Remove access', danger: true })) return;
      try { await admin.revoke(b.dataset.acno); App.go('settings'); } catch (e) { App.ui.toast(e.message, 5000); }
    });
  }

  App.cloud = { CFG, gate, signIn, signUp, signOut, syncNow, start, stop, profile, admin, settingsCard, bindSettings, mode, user, status: () => ({ lastSync, lastError, busy }), _seal: sealText, _open: openText };
})(window.App);
