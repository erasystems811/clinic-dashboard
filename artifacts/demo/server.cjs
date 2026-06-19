const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT || '3002', 10);
const ROOT = path.resolve(__dirname, 'dist', 'public');
const API_URL = (process.env.API_URL || '').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

function proxyToApi(req, res) {
  if (!API_URL) { res.writeHead(502); res.end('No API_URL'); return; }
  const parsed = new url.URL(API_URL);
  const isHttps = parsed.protocol === 'https:';
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: parsed.hostname },
  };
  const proxy = (isHttps ? https : http).request(options, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res);
  });
  proxy.on('error', () => { res.writeHead(502); res.end('Proxy error'); });
  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) { proxyToApi(req, res); return; }
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, 'index.html');
  }
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`[demo] listening on ${PORT}`));
