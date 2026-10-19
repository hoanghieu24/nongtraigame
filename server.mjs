// ============================================================================
// server.mjs — Production Server cho Farm Family Party (2 Máy / 2 Địa Điểm)
// - Phục vụ giao diện Web tĩnh từ thư mục ./dist
// - Cung cấp API Lưu Trữ Đám Mây (/api/farms, /api/save/:code) lưu thẳng xuống ổ cứng server
//   giúp 2 máy ở 2 nơi khác nhau luôn đồng bộ tiến độ nông trại lâu dài!
// ============================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const SAVE_DIR = process.env.SAVE_DIR || path.join(__dirname, 'data', 'saves');

fs.mkdirSync(SAVE_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sanitizeCode(raw = '') {
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function readBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'OPTIONS') {
      return sendJson(res, 200, { ok: true });
    }

    // 1. GET /api/farms — Danh sách các nông trại đã lưu trên Server
    if (pathname === '/api/farms' && req.method === 'GET') {
      const files = fs.readdirSync(SAVE_DIR).filter((f) => f.endsWith('.json') && !f.endsWith('.bak.json'));
      const farms = [];
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(SAVE_DIR, file), 'utf8');
          const parsed = JSON.parse(raw);
          const st = parsed.state || parsed;
          if (st?.meta?.roomCode) {
            farms.push({
              code: st.meta.roomCode,
              name: st.meta.farmName || 'Nông Trại Hạnh Phúc',
              role: 'host',
              day: st.world?.day || 1,
              worldT: st.world?.t || 0,
              savedAt: parsed.savedAt || Date.now(),
              players: Object.values(st.players || {})
                .map((p) => p.name)
                .filter(Boolean)
                .slice(0, 4),
            });
          }
        } catch {
          // Bỏ qua file lỗi nếu có
        }
      }
      farms.sort((a, b) => b.savedAt - a.savedAt);
      return sendJson(res, 200, { ok: true, farms });
    }

    // 2. /api/save/:code — Đọc / Ghi / Xoá bản lưu nông trại theo Mã Phòng
    if (pathname.startsWith('/api/save/')) {
      const code = sanitizeCode(pathname.slice('/api/save/'.length));
      if (!code || code.length < 4) {
        return sendJson(res, 400, { ok: false, error: 'Invalid room code' });
      }
      const filePath = path.join(SAVE_DIR, `${code}.json`);
      const bakPath = path.join(SAVE_DIR, `${code}.bak.json`);

      if (req.method === 'GET') {
        if (!fs.existsSync(filePath)) {
          return sendJson(res, 404, { ok: false, error: 'Not found' });
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return sendJson(res, 200, {
          ok: true,
          savedAt: parsed.savedAt || Date.now(),
          state: parsed.state || parsed,
        });
      }

      if (req.method === 'POST') {
        const bodyStr = await readBody(req);
        const payload = JSON.parse(bodyStr);
        const st = payload.state || payload;
        if (!st || !st.meta || !st.world) {
          return sendJson(res, 400, { ok: false, error: 'Invalid game state' });
        }
        st.meta.roomCode = code;

        // Giữ bản backup trước khi ghi đè
        if (fs.existsSync(filePath)) {
          try {
            fs.copyFileSync(filePath, bakPath);
          } catch {
            // ignore
          }
        }

        const record = {
          code,
          savedAt: Date.now(),
          state: st,
        };
        const tmpPath = `${filePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(record), 'utf8');
        fs.renameSync(tmpPath, filePath);
        return sendJson(res, 200, { ok: true, code, savedAt: record.savedAt });
      }

      if (req.method === 'DELETE') {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
        return sendJson(res, 200, { ok: true });
      }
    }

    // 3. Phục vụ file tĩnh từ ./dist
    let reqPath = pathname === '/' ? '/index.html' : pathname;
    let filePath = path.normalize(path.join(DIST_DIR, reqPath));
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Chưa build thư mục dist. Hãy chạy: npm run build');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isAsset = pathname.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌱 Farm Family Party Cloud Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`💾 Thư mục lưu dữ liệu nông trại lâu dài: ${SAVE_DIR}`);
});

