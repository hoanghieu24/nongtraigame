import { CROPS } from './crops.js';
import { ANIMALS } from './animals.js';
import { PENS, AREAS } from './layout.js';
import { FURN } from './furniture.js';
import { RECIPES } from './recipes.js';
import { HOUSE_LEVELS } from './furniture.js';
import { WEAPONS } from './weapons.js';
import { CFG } from '../core/Config.js';

export const LEVEL_XP = [0, 80, 220, 450, 800, 1300, 2000, 3000, 4400, 6200, 8600, 12000];
export const MAX_LEVEL = LEVEL_XP.length;
export const levelFromXp = (xp) => { let l = 1; for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) l = i + 1; return l; };
export const levelProgress = (xp) => {
  const l = levelFromXp(xp); if (l >= MAX_LEVEL) return { level: l, cur: 1, need: 1, pct: 1 };
  const a = LEVEL_XP[l - 1], b = LEVEL_XP[l]; return { level: l, cur: xp - a, need: b - a, pct: (xp - a) / (b - a) };
};

// Mở khoá theo Farm Level -> danh sách chữ hiển thị khi lên cấp
export function unlocksAt(level) {
  const out = [];
  for (const [id, c] of Object.entries(CROPS)) if (c.lvl === level && !c.rare && !c.event && !c.only) out.push(`${c.icon} Trồng ${c.name}`);
  for (const [id, c] of Object.entries(CROPS)) if (c.lvl === level && c.only) out.push(`${c.icon} ${c.name} (theo mùa)`);
  for (const [k, p] of Object.entries(PENS)) if (p.lvl === level && p.cost > 0) out.push(`${p.icon} Mở ${p.name}`);
  for (const [k, a] of Object.entries(AREAS)) if (a.lvl === level) out.push(`${a.icon} Khu vực: ${a.name}`);
  for (const [k, f] of Object.entries(FURN)) if (f.lvl === level && f.lvl > 1 && !f.rare) out.push(`${f.icon} ${f.name}`);
  for (const [k, r] of Object.entries(RECIPES)) if (r.lvl === level && r.lvl > 1) out.push(`${r.icon} Món: ${r.name}`);
  for (const [k, w] of Object.entries(WEAPONS)) if (w.lvl === level && w.lvl > 1) out.push(`${w.icon} Vũ khí: ${w.name}`);
  HOUSE_LEVELS.forEach((h, i) => { if (h.lvl === level && i > 0) out.push(`🏠 Nâng cấp: ${h.name}`); });
  if (level === CFG.RESTAURANT_LEVEL) out.push('🍽️ Mở khoá Nhà Hàng!');
  return out;
}
