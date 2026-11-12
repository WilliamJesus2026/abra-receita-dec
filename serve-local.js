// Servidor local de teste: serve public/ (somente leitura). http://localhost:8821/
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = parseInt(process.env.PORT || '8821', 10);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(__dirname, 'public', path.normalize(u).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('404'); return; } res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(b); });
}).listen(PORT, '127.0.0.1', () => console.log('http://localhost:' + PORT + '/'));
