import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const SAVE_DIR = path.resolve('data', 'saves');
fs.mkdirSync(SAVE_DIR, { recursive: true });

function cloudSavePlugin() {
  return {
    name: 'ffp-cloud-save-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();

        const sendJson = (status, data) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(data));
        };

        if (url.startsWith('/api/farms') && req.method === 'GET') {
          const files = fs.readdirSync(SAVE_DIR).filter((f) => f.endsWith('.json') && !f.endsWith('.bak.json'));
          const farms = [];
          for (const file of files) {
            try {
              const parsed = JSON.parse(fs.readFileSync(path.join(SAVE_DIR, file), 'utf8'));
              const st = parsed.state || parsed;
              if (st?.meta?.roomCode) {
                farms.push({
                  code: st.meta.roomCode,
                  name: st.meta.farmName || 'Nông Trại Hạnh Phúc',
                  role: 'host',
                  day: st.world?.day || 1,
                  worldT: st.world?.t || 0,
                  savedAt: parsed.savedAt || Date.now(),
                  players: Object.values(st.players || {}).map((p) => p.name).filter(Boolean).slice(0, 4),
                });
              }
            } catch { /* ignore */ }
          }
          farms.sort((a, b) => b.savedAt - a.savedAt);
          return sendJson(200, { ok: true, farms });
        }

        if (url.startsWith('/api/save/')) {
          const code = url.slice('/api/save/'.length).split('?')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
          if (!code || code.length < 4) return sendJson(400, { ok: false });
          const filePath = path.join(SAVE_DIR, `${code}.json`);
          if (req.method === 'GET') {
            if (!fs.existsSync(filePath)) return sendJson(404, { ok: false });
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return sendJson(200, { ok: true, savedAt: parsed.savedAt || Date.now(), state: parsed.state || parsed });
          }
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const st = payload.state || payload;
                if (!st?.meta || !st?.world) return sendJson(400, { ok: false });
                st.meta.roomCode = code;
                const record = { code, savedAt: Date.now(), state: st };
                fs.writeFileSync(filePath, JSON.stringify(record), 'utf8');
                return sendJson(200, { ok: true, code, savedAt: record.savedAt });
              } catch (e) {
                return sendJson(500, { ok: false, error: e.message });
              }
            });
            return;
          }
          if (req.method === 'DELETE') {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return sendJson(200, { ok: true });
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [cloudSavePlugin()],
  build: { chunkSizeWarningLimit: 1200, target: 'es2020' },
  server: { host: true },
});
