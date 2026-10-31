/* Minimal static file server (no dependencies). Used by the desktop app and `npm run web`.
   Serving over http://localhost is required for Google Drive and Outlook sign-in. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.csv': 'text/csv', '.md': 'text/markdown'
};
const ALLOWED = ['index.html', 'css', 'js', 'vendor', 'samples', 'assets'];

function start(port = Number(process.env.PORT) || 5178) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT + path.sep) || !ALLOWED.includes(rel.split('/')[0])) { res.writeHead(404); return res.end('Not found'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://localhost:${port}/` }));
  });
}

module.exports = { start };

if (require.main === module) {
  start().then(({ url }) => console.log(`Ops Command Desk running at ${url}  (Ctrl+C to stop)`))
    .catch(e => { console.error(e.code === 'EADDRINUSE' ? 'Port 5178 is in use — set PORT=xxxx' : e); process.exit(1); });
}
