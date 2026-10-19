import { itemMatches, ITEMS } from '../data/items.js';
// Túi đồ là map {itemId: qty}. Các hàm thuần, dùng cho túi cá nhân, rương chung, kho nội thất.
export const addTo = (b, id, n = 1) => { b[id] = (b[id] || 0) + n; return b[id]; };
export const takeFrom = (b, id, n = 1) => { if ((b[id] || 0) < n) return false; b[id] -= n; if (b[id] <= 0) delete b[id]; return true; };
export const has = (b, id, n = 1) => (b[id] || 0) >= n;
export const totalItems = (b) => Object.values(b).reduce((a, n) => a + n, 0);
// Nguyên liệu 'fish' = bất kỳ loại cá (trừ ủng)
export const countKey = (bags, key) => { let n = 0; for (const b of bags) for (const id in b) if (itemMatches(id, key)) n += b[id]; return n; };
export function takeKey(bags, key, n) {
  if (countKey(bags, key) < n) return false;
  let need = n;
  for (const b of bags) {
    const ids = Object.keys(b).filter((id) => itemMatches(id, key)).sort((a, c) => (ITEMS[a]?.sell || 0) - (ITEMS[c]?.sell || 0));
    for (const id of ids) { const t = Math.min(need, b[id]); takeFrom(b, id, t); need -= t; if (!need) return true; }
  }
  return need === 0;
}
export const canCook = (recipe, bags) => Object.entries(recipe.ing).every(([k, n]) => countKey(bags, k) >= n);
