/* App lock: passcode (PBKDF2-SHA256 hash, never stored in plain text) + auto-lock after inactivity.
   Keeps casual access out of personnel and financial data. Pair with OS disk encryption for real protection. */
(function (App) {
  const KEY = 'lock';
  const cfg = () => App.settings.get(KEY, null);
  const enabled = () => !!cfg()?.hash;
  const enc = new TextEncoder();
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

  async function derive(pass, saltHex, iter) {
    const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
  }
  async function set(pass, idleMin = 10) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const iter = 210000;
    App.settings.set(KEY, { hash: await derive(pass, salt, iter), salt, iter, idleMin: +idleMin || 0 });
  }
  async function check(pass) { const c = cfg(); return !!c && (await derive(pass, c.salt, c.iter)) === c.hash; }
  function disable() { App.settings.set(KEY, null); }
  function setIdle(min) { const c = cfg(); if (c) { c.idleMin = +min || 0; App.settings.set(KEY, c); } }

  let locked = false, timer = null, fails = 0, waitUntil = 0;
  function lock() {
    if (!enabled() || locked) return;
    locked = true;
    document.body.classList.add('locked');
    let el = document.getElementById('lockScreen');
    if (!el) { el = document.createElement('div'); el.id = 'lockScreen'; document.body.appendChild(el); }
    el.className = 'lock-screen';
    el.innerHTML = `<form class="lock-card" id="lockForm" autocomplete="off">
        <div class="onb-logo" style="margin:0 auto 14px">${App.fx ? App.fx.icon('lock') : '🔒'}</div>
        <h2>Ops Command Desk is locked</h2>
        <p class="muted small">Enter your passcode to continue.</p>
        <input type="password" id="lockPass" placeholder="Passcode" autofocus>
        <div class="small" id="lockMsg" style="min-height:18px;color:var(--bad)"></div>
        <button class="btn primary" type="submit" style="width:100%;justify-content:center">Unlock</button>
        <div class="muted tiny" style="margin-top:12px">Forgot it? The passcode can't be recovered. Restore your data from a backup on a fresh install.</div>
      </form>`;
    const inp = el.querySelector('#lockPass');
    setTimeout(() => inp.focus(), 50);
    el.querySelector('#lockForm').onsubmit = async e => {
      e.preventDefault();
      const msg = el.querySelector('#lockMsg');
      if (Date.now() < waitUntil) { msg.textContent = `Too many attempts. Wait ${Math.ceil((waitUntil - Date.now()) / 1000)}s.`; return; }
      if (await check(inp.value)) { fails = 0; unlock(); return; }
      fails++; inp.value = ''; el.querySelector('.lock-card').classList.add('shake'); setTimeout(() => el.querySelector('.lock-card')?.classList.remove('shake'), 400);
      if (fails >= 5) { waitUntil = Date.now() + 30000 * Math.pow(2, Math.min(4, fails - 5)); msg.textContent = 'Too many attempts. Locked for a while.'; }
      else msg.textContent = 'Incorrect passcode';
    };
  }
  function unlock() {
    locked = false;
    document.body.classList.remove('locked');
    document.getElementById('lockScreen')?.remove();
    App.compliance?.audit?.('App unlocked', '');
    arm();
  }
  function arm() {
    clearTimeout(timer);
    const c = cfg();
    if (!c?.hash || !c.idleMin || locked) return;
    timer = setTimeout(lock, c.idleMin * 60000);
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (!locked) arm(); }, { passive: true, capture: true }));

  /* Lock immediately on startup if a passcode is set */
  function boot() { if (enabled()) lock(); }

  App.lock = { enabled, set, check, disable, setIdle, lock, boot, cfg };
})(window.App);
