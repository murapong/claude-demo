const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const STATUSES = ['未対応', '対応中', 'レビュー中', '完了'];

const SEED = {
  nextId: 4,
  inquiries: [
    {
      id: 1,
      name: '山田 太郎',
      content: '商品が届きません。注文番号は 12345 です。',
      status: '未対応',
      createdAt: '2026-07-10T09:15:00.000Z',
    },
    {
      id: 2,
      name: '佐藤 花子',
      content: '請求書の宛名を変更してほしいです。',
      status: '対応中',
      createdAt: '2026-07-11T13:40:00.000Z',
    },
    {
      id: 3,
      name: '鈴木 一郎',
      content: 'パスワードの再設定方法を教えてください。',
      status: '完了',
      createdAt: '2026-07-12T08:05:00.000Z',
    },
  ],
};

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(SEED, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function toResponse(inquiry) {
  return { ...inquiry, number: `INQ-${inquiry.id}` };
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function validateCreate(body) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!name) errors.push('名前は必須です');
  else if (name.length > 100) errors.push('名前は100文字以内で入力してください');
  if (!content) errors.push('内容は必須です');
  else if (content.length > 2000) errors.push('内容は2000文字以内で入力してください');
  return { errors, name, content };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
    sendJson(res, 404, { error: 'ページが見つかりません' });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'ページが見つかりません' });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname === '/api/inquiries' && req.method === 'GET') {
    const db = loadDb();
    const list = [...db.inquiries].sort((a, b) => b.id - a.id).map(toResponse);
    sendJson(res, 200, list);
    return;
  }

  if (pathname === '/api/inquiries' && req.method === 'POST') {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      sendJson(res, 422, { errors: ['リクエストの形式が不正です'] });
      return;
    }
    const { errors, name, content } = validateCreate(body);
    if (errors.length > 0) {
      sendJson(res, 422, { errors });
      return;
    }
    const db = loadDb();
    const inquiry = {
      id: db.nextId,
      name,
      content,
      status: '未対応',
      createdAt: new Date().toISOString(),
    };
    db.nextId += 1;
    db.inquiries.push(inquiry);
    saveDb(db);
    sendJson(res, 201, toResponse(inquiry));
    return;
  }

  const statusMatch = pathname.match(/^\/api\/inquiries\/(\d+)$/);
  if (statusMatch && req.method === 'PATCH') {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      sendJson(res, 422, { errors: ['リクエストの形式が不正です'] });
      return;
    }
    if (!STATUSES.includes(body.status)) {
      sendJson(res, 422, { errors: ['ステータスは 未対応 / 対応中 / レビュー中 / 完了 のいずれかを指定してください'] });
      return;
    }
    const db = loadDb();
    const inquiry = db.inquiries.find((i) => i.id === Number(statusMatch[1]));
    if (!inquiry) {
      sendJson(res, 404, { error: 'お問い合わせが見つかりません' });
      return;
    }
    inquiry.status = body.status;
    saveDb(db);
    sendJson(res, 200, toResponse(inquiry));
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'APIが見つかりません' });
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res, pathname);
    return;
  }

  sendJson(res, 405, { error: '許可されていないメソッドです' });
});

server.listen(PORT, () => {
  loadDb();
  console.log(`お問い合わせ管理アプリを起動しました: http://localhost:${PORT}`);
});
