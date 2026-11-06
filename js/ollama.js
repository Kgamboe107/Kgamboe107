/* One-click Ollama setup: detect it, download a model with progress, turn it on. No terminal needed. */
(function (App) {
  const { esc } = App;
  const gb = b => (b / 1e9).toFixed(b > 1e10 ? 0 : 1) + ' GB';

  /* Renders into `el`. onReady(models) fires once Ollama is running with a model and switched on. */
  function setup(el, { onReady, compact = false } = {}) {
    let timer = null, alive = true;
    const stop = () => { alive = false; clearTimeout(timer); };
    const gone = () => !el.isConnected;

    async function check(auto) {
      if (gone()) return stop();
      if (!auto) el.innerHTML = `<div class="ol-step"><span class="task-spin"></span><span class="small">Looking for Ollama on this computer…</span></div>`;
      const st = await App.ai.ollamaStatus();
      if (gone() || !alive) return;
      if (!st.running) return notRunning(st);
      if (!st.models.length) return noModel();
      await App.ai.setKey('ollama', 'on');
      ready(st);
    }

    function notRunning(st) {
      const notWeb = /not opened as a file|desktop app/i.test(st.error || '');
      el.innerHTML = `<div class="stack ol-box">
        <div class="ol-steps small"><span class="on">1. Install Ollama</span><span>2. Download a model</span><span>3. Ask away</span></div>
        <div class="small">${notWeb ? esc(st.error) : 'Ollama isn’t installed or isn’t running yet. It’s a free app that runs AI models on this computer.'}</div>
        <div class="row"><a class="btn primary small" href="https://ollama.com/download" target="_blank" rel="noopener">${App.fx.icon('download')} Download Ollama (free)</a><button class="btn small" data-olcheck>I installed it: check again</button></div>
        <div class="muted tiny">Run the installer, then open Ollama once (on Windows it starts by itself and sits by the clock). This page checks again automatically every few seconds.</div>
      </div>`;
      el.querySelector('[data-olcheck]').onclick = () => check(false);
      clearTimeout(timer);
      timer = setTimeout(() => check(true), 4000);
    }

    function noModel() {
      clearTimeout(timer);
      const M = App.ai.OLLAMA_MODELS;
      el.innerHTML = `<div class="stack ol-box">
        <div class="ol-steps small"><span class="done">1. Ollama found ✓</span><span class="on">2. Download a model</span><span>3. Ask away</span></div>
        <div class="small">Pick the AI model to download. This happens once; after that it works offline.</div>
        <div class="stack ol-models">${M.map((m, i) => `<label class="ol-model"><input type="radio" name="olm" value="${m.id}" ${i ? '' : 'checked'}>
          <span><b>${esc(m.label)}</b> <span class="muted tiny">${esc(m.size)} download · needs ${esc(m.ram)} memory</span><br><span class="muted tiny">${esc(m.note)}</span></span></label>`).join('')}</div>
        <div class="row"><button class="btn primary small" data-olpull>${App.fx.icon('download')} Download model</button></div>
        <div data-olprog></div>
      </div>`;
      el.querySelector('[data-olpull]').onclick = async e => {
        const model = el.querySelector('input[name=olm]:checked').value;
        e.target.disabled = true;
        const prog = el.querySelector('[data-olprog]');
        const show = p => {
          const pct = isNaN(p.pct) ? 0 : Math.round(p.pct * 100);
          prog.innerHTML = `<div class="small">${esc(/pulling|download/i.test(p.status) || p.total ? `Downloading ${model}${p.total ? ` · ${gb(p.done)} of ${gb(p.total)}` : ''}` : (p.status || 'Starting…').replace(/^./, c => c.toUpperCase()))}</div>
            <div class="task-bar" style="margin-top:6px"><i style="width:${pct}%"></i></div><div class="muted tiny" style="margin-top:4px">${pct}% · you can keep using the app; don’t close it until this finishes.</div>`;
        };
        show({ status: 'starting', pct: 0 });
        try {
          await App.ai.ollamaPull(model, show);
          App.settings.set(App.ai.modelKey('ollama'), model);
          App.ui.toast(`${model} is ready`);
          check(false);
        } catch (err) {
          prog.innerHTML = `<div class="alert bad small">Download failed: ${esc(err.message)}. Check your internet connection and free disk space, then try again.</div>`;
          e.target.disabled = false;
        }
      };
    }

    function ready(st) {
      clearTimeout(timer);
      const cur = App.settings.get(App.ai.modelKey('ollama'), '');
      const using = st.models.includes(cur) ? cur : st.models[0];
      if (compact) { el.innerHTML = ''; stop(); onReady?.(st.models); return; }
      el.innerHTML = `<div class="stack ol-box">
        <div class="ol-steps small"><span class="done">1. Ollama found ✓</span><span class="done">2. Model ready ✓</span><span class="done">3. Ask away ✓</span></div>
        <div class="small">Connected${st.version ? ` (Ollama ${esc(st.version)})` : ''} · using <b>${esc(using)}</b>${st.models.length > 1 ? ` · ${st.models.length} models installed` : ''}. Ollama is now your default AI.</div>
        <div class="row"><button class="btn small" data-olmore>Download another model</button><button class="btn small danger" data-oloff>Turn off Ollama</button></div>
      </div>`;
      el.querySelector('[data-olmore]').onclick = () => noModel();
      el.querySelector('[data-oloff]').onclick = async () => { await App.ai.setKey('ollama', ''); App.ui.toast('Ollama turned off'); App.go(location.hash.slice(1) || 'integrations'); };
      onReady?.(st.models);
    }

    check(false);
    return { stop, check };
  }

  App.ollamaSetup = setup;
})(window.App);
