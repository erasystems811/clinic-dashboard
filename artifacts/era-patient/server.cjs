const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = path.resolve(__dirname, 'dist', 'public');

console.log('__dirname:', __dirname);
console.log('ROOT:', ROOT);
console.log('ROOT exists:', fs.existsSync(ROOT));
if (fs.existsSync(ROOT)) {
  console.log('ROOT contents:', fs.readdirSync(ROOT));
} else {
  var parent = path.dirname(ROOT);
  console.log('parent dir exists:', fs.existsSync(parent));
  if (fs.existsSync(parent)) {
    console.log('parent contents:', fs.readdirSync(parent));
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
};

function sendFile(filePath, res) {
  fs.readFile(filePath, function (err, data) {
    if (err) {
      console.log('sendFile failed for:', filePath, err.message);
      fs.readFile(path.join(ROOT, 'index.html'), function (err2, html) {
        if (err2) {
          console.log('index.html fallback failed:', err2.message);
          res.writeHead(500); res.end('Error'); return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer(function (req, res) {
  var urlPath = req.url.split('?')[0];
  var filePath = path.join(ROOT, urlPath);

  fs.stat(filePath, function (err, stats) {
    if (err) {
      sendFile(path.join(ROOT, 'index.html'), res);
      return;
    }
    if (stats.isDirectory()) {
      sendFile(path.join(filePath, 'index.html'), res);
      return;
    }
    sendFile(filePath, res);
  });
}).listen(PORT, '0.0.0.0', function () {
  console.log('Listening on port ' + PORT);
});
