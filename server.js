const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const STATUSES = ['未対応', '対応中', '完了', '却下'];

const SEED = {
  nextId: 4,
  inquiries: [
    {
      id: 1,
      name: '山田 太郎',
      content: '請求書の宛名を変更したいのですが、手続き方法を教えてください。',
      status: '完了',
      createdAt: '2026-07-10T09:15:00.000Z',
    },
    {
      id: 2,
      name: '佐藤 花子',
      content: 'ログインしようとするとエラーが表示されます。パスワードリセットも届きません。',
      status: '対応中',
      createdAt: '2026-07-12T14:30:00.000Z',
    },
    {
      id: 3,
      name: '鈴木 一郎',
      content: '法人プランの料金と契約条件について資料をいただけますか。',
      status: '未対応',
      createdAt: '2026-07-13T01:05:00.000Z',
    },
  ],
};

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(SEED, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function receiptNumber(id) {
  return `INQ-${id}`;
}

function toJsonInquiry(inquiry) {
  return { ...inquiry, receiptNumber: receiptNumber(inquiry.id) };
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
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

function validateNewInquiry(body) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!name) errors.push('名前は必須です');
  if (name.length > 100) errors.push('名前は100文字以内で入力してください');
  if (!content) errors.push('お問い合わせ内容は必須です');
  if (content.length > 2000) errors.push('お問い合わせ内容は2000文字以内で入力してください');
  return { errors, name, content };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, relPath);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
    sendJson(res, 404, { error: 'ページが見つかりません' });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'ページが見つかりません' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  // GET /api/inquiries — 一覧
  if (pathname === '/api/inquiries' && req.method === 'GET') {
    const db = loadDb();
    const list = [...db.inquiries].sort((a, b) => b.id - a.id).map(toJsonInquiry);
    sendJson(res, 200, { inquiries: list });
    return;
  }

  // POST /api/inquiries — 新規登録
  if (pathname === '/api/inquiries' && req.method === 'POST') {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      sendJson(res, 422, { errors: ['リクエストの形式が不正です'] });
      return;
    }
    const { errors, name, content } = validateNewInquiry(body);
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
    sendJson(res, 201, { inquiry: toJsonInquiry(inquiry) });
    return;
  }

  // PATCH /api/inquiries/:id — ステータス変更
  const match = pathname.match(/^\/api\/inquiries\/(\d+)$/);
  if (match && req.method === 'PATCH') {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      sendJson(res, 422, { errors: ['リクエストの形式が不正です'] });
      return;
    }
    if (!STATUSES.includes(body.status)) {
      sendJson(res, 422, { errors: [`ステータスは ${STATUSES.join(' / ')} のいずれかを指定してください`] });
      return;
    }
    const db = loadDb();
    const inquiry = db.inquiries.find((i) => i.id === Number(match[1]));
    if (!inquiry) {
      sendJson(res, 404, { error: '指定されたお問い合わせが見つかりません' });
      return;
    }
    inquiry.status = body.status;
    saveDb(db);
    sendJson(res, 200, { inquiry: toJsonInquiry(inquiry) });
    return;
  }

  sendJson(res, 404, { error: 'APIが見つかりません' });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch(() => {
      sendJson(res, 500, { error: 'サーバーエラーが発生しました' });
    });
    return;
  }
  serveStatic(req, res, pathname);
});

loadDb();
server.listen(PORT, () => {
  console.log(`お問い合わせ管理アプリを起動しました: http://localhost:${PORT}`);
});
