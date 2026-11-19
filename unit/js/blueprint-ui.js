/* Blueprint: the Master Skill Tree of running a business. Four phases on graph paper; every node is a framework
   that is working somewhere in the app, with what it says about you right now. */
(function (UC) {
  const { esc } = App;
  UC.screens = UC.screens || {};
  const PH = [
    ['foundations', 'Phase 1', 'The foundations', 'The tools to take in, process and keep information.', 'var(--bp-1)'],
    ['mechanics', 'Phase 2', 'Core mechanics', 'The numbers: normal ranges, cause and effect, the books.', 'var(--bp-2)'],
    ['human', 'Phase 3', 'The human experience', 'People: how they learn, communicate and judge right from wrong.', 'var(--bp-3)'],
    ['applied', 'Phase 4', 'Applied systems', 'Putting it to work: management, growth, security, legal.', 'var(--bp-4)']
  ];
  /* Hub-and-tracks tree (SVG) */
  function tree(st) {
    const W = 1000, rowH = 118, H = 40 + PH.length * rowH, hx = 70, hy = H / 2;
    let svg = `<svg class="uc-bptree" viewBox="0 0 ${W} ${H}" role="img" aria-label="Master skill tree"><defs><pattern id="bpg" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--bp-grid)" stroke-width=".6"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#bpg)"/>`;
    svg += `<circle cx="${hx}" cy="${hy}" r="30" fill="var(--bp-paper)" stroke="var(--label)" stroke-width="2"/><text x="${hx}" y="${hy - 3}" class="bpt-h">Your</text><text x="${hx}" y="${hy + 12}" class="bpt-h">business</text>`;
    PH.forEach(([k, p, name, , col], i) => {
      const y = 40 + i * rowH + rowH / 2 - 10, x0 = hx + 30, xs = 150 + i * 10, xb = 400;
      svg += `<path d="M${x0} ${hy} H${xs} V${y} H${xb}" fill="none" stroke="${col}" stroke-width="3"/><circle cx="${xs}" cy="${hy}" r="4" fill="var(--bp-paper)" stroke="${col}" stroke-width="2"/>`;
      svg += `<text x="${xs + 16}" y="${y - 10}" class="bpt-p" fill="${col}">${p.toUpperCase()}: ${name.toUpperCase()}</text><circle cx="${xb}" cy="${y}" r="5" fill="var(--bp-paper)" stroke="${col}" stroke-width="2.5"/>`;
      const nodes = st[k]; let lines = '', boxes = '';
      const short = t => (t.length > 30 && t.includes('(') ? t.slice(0, t.indexOf('(')).trim() : t).toUpperCase();
      nodes.forEach((n, j) => {
        const col2 = j % 2, row2 = Math.floor(j / 2), nx = 460 + col2 * 270, ny = y - 26 + row2 * 52;
        if (!col2) lines += `<path d="M${xb + 5} ${y} C ${xb + 30} ${y}, ${nx - 30} ${ny + 16}, ${nx} ${ny + 16}" fill="none" stroke="${col}" stroke-width="2"/>`;
        else lines += `<path d="M${nx - 20} ${ny + 16} H${nx}" fill="none" stroke="${col}" stroke-width="2"/><circle cx="${nx - 10}" cy="${ny + 16}" r="3" fill="var(--bp-paper)" stroke="${col}" stroke-width="1.6"/>`;
        boxes += `<g class="bpt-n" data-node="${n[0]}" tabindex="0" role="button" aria-label="${esc(n[1])}"><rect x="${nx}" y="${ny}" width="250" height="32" rx="6" fill="var(--bp-paper)" stroke="${col}" stroke-width="2"/><text x="${nx + 125}" y="${ny + 21}" class="bpt-t">${esc(short(n[1]))}</text></g>`;
      });
      svg += lines + boxes;
    });
    return svg + '</svg>';
  }
  UC.screens.blueprint = async (view) => {
    view.innerHTML = '<div class="card"><span class="task-spin"></span> Drawing the blueprint…</div>';
    const st = await UC.science.status();
    view.innerHTML = `<section class="card uc-bp"><div class="uc-qk">JUDGMENT / STRUCTURE / SYSTEMS</div><h2 class="uc-qh" style="font-size:30px;margin:8px 0 4px">The architecture of running a business</h2>
        <p class="muted" style="max-width:66ch">Human thought and structure as a management science: four phases, each made of frameworks that are already working inside Unit Command. Tap a box to see what it says about your business right now.</p>
        <div class="uc-bpwrap">${tree(st)}</div></section>
      <div class="uc-bpgrid">${PH.map(([k, p, name, about, col]) => `<section class="card uc-bpph" style="--c:${col}"><div class="uc-qk" style="color:${col}">${p} / ${esc(name)}</div><p class="muted small" style="margin:6px 0 10px">${esc(about)}</p>
        <div class="uc-alist">${st[k].map(n => `<button class="uc-arow" data-node="${n[0]}"><span class="uc-dot" style="background:${col}"></span><span><b>${esc(n[1])}</b><span class="muted tiny">${esc(n[2])}</span></span></button>`).join('')}</div></section>`).join('')}</div>
      <section class="card uc-bp"><div class="uc-qk">THE INTERSECTIONS MAP</div><h3 class="uc-qh">Knowledge isn’t a set of silos.</h3><div class="uc-inter">${[
        ['Statistics + Psychology', 'Labor coaching', 'An unusual labor day is a conversation, not a reprimand: start with the cause.'],
        ['Communication + Law', 'Clean records', 'Facts-only incident reports and clear emails are your best defense.'],
        ['Ethics + Commerce', 'Deals you’re proud of', 'Every acquisition brief weighs outcome, duty and character.'],
        ['Learning + Operations', 'Teaching SOPs', 'Review cards turn your SOPs into habits for every manager.']].map(([a, t, d]) => `<div><span class="uc-chipt">${esc(a)}</span><b>${esc(t)}</b><span class="muted small">${esc(d)}</span></div>`).join('')}</div></section>`;
    const open = id => {
      const n = Object.values(st).flat().find(x => Array.isArray(x) && x[0] === id), info = UC.science.INFO[id]; if (!n || !info) return;
      App.ui.modal(`<div class="row spread"><div class="uc-qk">${esc(info[0].toUpperCase())}</div><button class="btn ghost small" data-close aria-label="Close">✕</button></div>
        <h3 class="uc-qh">${esc(n[1])}</h3><p class="uc-qp">${esc(info[1])}</p>
        <div class="uc-bpnow"><span class="uc-qk">RIGHT NOW</span><div>${esc(n[2])}</div></div>
        <ul class="small" style="margin-top:12px">${info[2].map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        ${id === 'stats' && st.unusual.length ? `<div class="uc-alist">${st.unusual.map(x => `<div class="uc-arow"><span class="uc-dot" style="background:var(--gold)"></span><span><b>${esc(x.u.name)}</b><span class="muted tiny">${esc(UC.science.describe(x))}</span></span></div>`).join('')}</div>` : ''}
        ${n[3] ? `<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" id="bpGo">Open</button></div>` : ''}`, (c, close) => {
        c.querySelector('#bpGo')?.addEventListener('click', () => { close(); UC.go(n[3], n[4] || {}); });
      });
    };
    view.querySelectorAll('[data-node]').forEach(el => { el.addEventListener('click', () => open(el.dataset.node)); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el.dataset.node); } }); });
  };
})(window.UC);
