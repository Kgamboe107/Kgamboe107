/* Minimal static file server (no dependencies). Used by the desktop app and `npm run web`.
   Serving over http://localhost is required for Google Drive and Outlook sign-in. */
const http = require('http');
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

function handler(req, res) {
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
