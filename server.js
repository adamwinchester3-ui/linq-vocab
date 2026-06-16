const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DEEPL_KEY = '44b58617-72a9-4d52-a88f-a481a9c886c2:fx';
const PORT = process.env.PORT || 3333;
const DATA_FILE = path.join(__dirname, 'vocab_data.json');

// 데이터 파일 초기화
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch(e) { return {}; }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const HTML_FILE = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // HTML 서빙
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(HTML_FILE, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html); return;
  }

  // DeepL 번역
  if (req.method === 'POST' && req.url === '/translate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { texts } = JSON.parse(body);
      const payload = JSON.stringify({ text: texts, target_lang: 'KO', source_lang: 'FR' });
      const options = {
        hostname: 'api-free.deepl.com',
        path: '/v2/translate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'DeepL-Auth-Key ' + DEEPL_KEY,
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      const proxyReq = https.request(options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });
      proxyReq.on('error', e => { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); });
      proxyReq.write(payload);
      proxyReq.end();
    });
    return;
  }

  // 단어장 불러오기
  if (req.method === 'GET' && req.url.startsWith('/vocab/')) {
    const user = decodeURIComponent(req.url.split('/vocab/')[1]);
    const data = loadData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data[user] || {}));
    return;
  }

  // 단어장 저장
  if (req.method === 'POST' && req.url.startsWith('/vocab/')) {
    const user = decodeURIComponent(req.url.split('/vocab/')[1]);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = loadData();
      data[user] = JSON.parse(body);
      saveData(data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log('서버 실행 중: http://localhost:' + PORT));
