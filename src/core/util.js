// Toán + random dùng chung. KHÔNG phụ thuộc DOM/three (sim chạy được trên Node).
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
export const wrapPi = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const dampAngle = (a, b, l, dt) => a + wrapPi(b - a) * (1 - Math.exp(-l * dt));
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const round = (v, n = 2) => { const k = 10 ** n; return Math.round(v * k) / k; };
export const fmt = (n) => Math.floor(n).toLocaleString('vi-VN');

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Rng {
  constructor(seed = Date.now()) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  weighted(list, wf) {
    let tot = 0; for (const x of list) tot += wf(x);
    let r = this.f() * tot;
    for (const x of list) { r -= wf(x); if (r <= 0) return x; }
    return list[list.length - 1];
  }
}
export const rng = new Rng();

function hash2(ix, iz) { let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), u), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u), v) * 2 - 1;
}
let _uid = 0;
export const uid = (p = 'id') => `${p}${(++_uid).toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
export const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Thời gian trong game: tất cả DẪN XUẤT từ world.t (giây) => client tự ngoại suy mượt.
export function timeInfo(t, cfg) {
  const dayF = t / cfg.DAY_SECONDS + (cfg.START_HOUR - 5) / 24;   // ngày mới bắt đầu lúc 05:00
  const day = 1 + Math.floor(dayF);
  const hour = (cfg.START_HOUR + (t / cfg.DAY_SECONDS) * 24) % 24;
  const season = Math.floor((day - 1) / cfg.SEASON_DAYS) % 4;
  const night = hour >= 20 || hour < 5.5;
  return { day, hour, season, night };
}
export const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
