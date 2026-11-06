/* Minimal static file server (no dependencies). Used by the desktop app and `npm run web`.
   Serving over http://localhost is required for Google Drive and Outlook sign-in. */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.csv': 'text/csv',
  '.md': 'text/markdown', '.woff2': 'font/woff2'
};
const ALLOWED = ['index.html', 'css', 'js', 'vendor', 'samples', 'assets', 'build'];
const MARKER = 'X-Ops-Command-Desk';

/* ---------- AI relay ----------
   Most AI providers don't allow direct browser calls (CORS), so the app sends requests here and
   this relays them. Only these exact endpoints are reachable, only from this machine, and only
   from the app's own pages (custom header + loopback Host/Origin checks block other websites). */
const AI_ROUTES = {
  perplexity: { host: 'api.perplexity.ai', paths: { 'POST /v1/agent': true } },
  xai: { host: 'api.x.ai', paths: { 'POST /v1/chat/completions': true, 'GET /v1/models': true } },
  groq: { host: 'api.groq.com', paths: { 'POST /openai/v1/chat/completions': true, 'GET /openai/v1/models': true } },
  gemini: { host: 'generativelanguage.googleapis.com', paths: { 'POST /v1beta/openai/chat/completions': true, 'GET /v1beta/openai/models': true } },
  // Ollama runs on this computer; no key, plain http to the local port only
  ollama: { local: true, host: '127.0.0.1', port: Number(process.env.OLLAMA_PORT) || 11434, paths: { 'POST /v1/chat/completions': true, 'GET /v1/models': true } }
};
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function aiRelay(req, res) {
  const deny = (code, msg) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: msg } })); };
  if (req.method !== 'POST') return deny(405, 'Method not allowed');
  if (req.headers['x-ocd-client'] !== '1' || !LOOPBACK.test(req.headers.host || '')) return deny(403, 'Forbidden');
  const origin = req.headers.origin;
  if (origin && !LOOPBACK.test(origin.replace(/^https?:\/\//, ''))) return deny(403, 'Forbidden origin');
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 4e6) { deny(413, 'Request too large'); req.destroy(); } });
  req.on('end', () => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return deny(400, 'Bad JSON'); }
    const route = AI_ROUTES[msg.provider];
    const method = msg.method === 'GET' ? 'GET' : 'POST';
    if (!route || !route.paths[`${method} ${msg.path}`]) return deny(400, 'Endpoint not allowed');
    if (!route.local && (!msg.key || typeof msg.key !== 'string')) return deny(401, 'Missing API key');
    const body = method === 'POST' ? JSON.stringify(msg.body || {}) : null;
    const up = (route.local ? http : https).request({
      host: route.host, port: route.port, path: msg.path, method, timeout: route.local ? 600000 : 180000,
      headers: { ...(route.local ? {} : { Authorization: 'Bearer ' + msg.key.trim() }), Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) }
    }, upRes => {
      res.writeHead(upRes.statusCode || 502, { 'Content-Type': upRes.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store' });
      upRes.pipe(res);
    });
    up.on('timeout', () => up.destroy(new Error('The AI provider took too long to respond')));
    up.on('error', e => {
      if (res.headersSent) return res.end();
      if (route.local && /ECONNREFUSED|ECONNRESET/.test(e.code || e.message)) return deny(503, 'Ollama is not running on this computer. Install it from ollama.com, open it, then run: ollama pull llama3.2');
      deny(502, e.message);
    });
    if (body) up.write(body);
    up.end();
  });
}

function handler(req, res) {
  if (req.url.split('?')[0] === '/api/ai') return aiRelay(req, res);
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'; }
  catch { res.writeHead(400); return res.end('Bad request'); }
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || !ALLOWED.includes(rel.split(/[\\/]/)[0])) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', [MARKER]: '1' });
    res.end(data);
  });
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onErr = e => { server.removeListener('listening', onOk); reject(e); };
    const onOk = () => { server.removeListener('error', onErr); resolve(server.address().port); };
    server.once('error', onErr);
    server.once('listening', onOk);
    server.listen(port, host);
  });
}

/**
 * Start on the preferred port (stable port = stable storage origin), falling back to the
 * next ports. Listens on IPv4 and, when available, IPv6 loopback so "localhost" always
 * resolves to us on every OS. Resolves { server, port, url }.
 */
async function start(preferred = Number(process.env.PORT) || 5178, attempts = 15) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const want = preferred === 0 ? 0 : preferred + i;
    const v4 = http.createServer(handler);
    try {
      const port = await listen(v4, want, '127.0.0.1');
      let v6 = null;
      try { v6 = http.createServer(handler); await listen(v6, port, '::1'); } catch { v6 = null; }
      return { server: v4, server6: v6, port, url: `http://localhost:${port}/` };
    } catch (e) { lastErr = e; if (e.code !== 'EADDRINUSE' && e.code !== 'EACCES') throw e; }
  }
  throw lastErr;
}

module.exports = { start };

if (require.main === module) {
  start().then(({ url }) => console.log(`Ops Command Desk running at ${url}  (Ctrl+C to stop)`))
    .catch(e => { console.error('Could not start server:', e.message); process.exit(1); });
}
