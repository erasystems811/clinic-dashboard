const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT || '3001', 10);
const ROOT = path.resolve(__dirname, 'dist', 'public');
const API_URL = (process.env.API_URL || '').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.webp': 'image/webp', '.txt': 'text/plain',
};

function proxyToApi(req, res) {
  if (!API_URL) { res.writeHead(502); res.end(JSON.stringify({ error: 'API_URL not configured' })); return; }
  const target = url.parse(API_URL);
  const isHttps = target.protocol === 'https:';
  const options = {
    hostname: target.hostname, port: target.port || (isHttps ? 443 : 80),
    path: req.url, method: req.method,
    headers: Object.assign({}, req.headers, { host: target.hostname }),
  };
  const proxy = (isHttps ? https : http).request(options, function(apiRes) {
    res.writeHead(apiRes.statusCode, apiRes.headers);
    apiRes.pipe(res, { end: true });
  });
  proxy.on('error', function(err) { res.writeHead(502); res.end(JSON.stringify({ error: 'Bad gateway' })); });
  req.pipe(proxy, { end: true });
}

function sendFile(filePath, res) {
  fs.readFile(filePath, function(err, data) {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), function(err2, html) {
        if (err2) { res.writeHead(500); res.end('Error'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
      });
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' }); res.end(data);
  });
}

http.createServer(function(req, res) {
  var urlPath = req.url.split('?')[0];
  if (urlPath.startsWith('/api/')) { proxyToApi(req, res); return; }
  var filePath = path.join(ROOT, urlPath);
  fs.stat(filePath, function(err, stats) {
    if (err) { sendFile(path.join(ROOT, 'index.html'), res); return; }
    if (stats.isDirectory()) { sendFile(path.join(filePath, 'index.html'), res); return; }
    sendFile(filePath, res);
  });
}).listen(PORT, '0.0.0.0', function() {
  console.log('ERA Me listening on port ' + PORT);
  console.log('API proxy target:', API_URL || '(none — set API_URL env var)');
});
