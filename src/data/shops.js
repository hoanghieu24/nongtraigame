import { CROPS, SEASONS, fmtGrow } from './crops.js';
import { ANIMALS, BUYABLE_ANIMALS, animalSalePrice } from './animals.js';
import { FURN, FURN_LIST } from './furniture.js';
import { PENS } from './layout.js';
import { HATS } from './characters.js';
import { ITEMS } from './items.js';

export const SHOPS = {
  seed:      { name: 'Cửa Hàng Hạt Giống', icon: '🌱', tabs: [['seeds', 'Hạt giống']] },
  animal:    { name: 'Cửa Hàng Thú Cưng',  icon: '🐣', tabs: [['pens', 'Chuồng trại'], ['animals', 'Vật nuôi'], ['sell', 'Bán vật nuôi']] },
  furniture: { name: 'Cửa Hàng Nội Thất',  icon: '🛋️', tabs: [['furniture', 'Nội thất'], ['decor', 'Trang trí'], ['outdoor', 'Ngoài trời'], ['luxury', 'Hàng xa xỉ']] },
  general:   { name: 'Tạp Hóa Cô Mai',     icon: '🧺', tabs: [['goods', 'Vật dụng'], ['hats', 'Mũ nón']] },
  delivery:  { name: 'Giao Hàng Tận Nơi',  icon: '🛵', tabs: [['seeds', 'Hạt giống'], ['goods', 'Thức ăn']] },
  merchant:  { name: 'Thương Nhân Du Hành', icon: '🧳', tabs: [['rare', 'Hàng hiếm']] },
};

// Nguồn sự thật duy nhất cho catalog: dùng cho UI (render) và ShopSystem (validate/thanh toán)
const LUXURY_FURN = ['swing', 'pond', 'aquarium', 'fountain', 'gold_gnome'];

export function shopCatalog(shop, st) {
  const lvl = st.farm.level, season = st.world.season || 0, rows = [];
  const mk = (r) => { r.locked = r.lvl > lvl; if (r.locked) r.reason = `Cần Cấp ${r.lvl}`; rows.push(r); return r; };
  if (shop === 'seed' || shop === 'delivery') {
    const mult = shop === 'delivery' ? 1.25 : 1;
    for (const [id, c] of Object.entries(CROPS)) {
      if (c.rare || c.event || c.seed <= 0) continue;
      if (shop === 'delivery' && c.lvl > 2) continue;
      const r = mk({ tab: 'seeds', key: `seed:${id}`, kind: 'seed', ref: id, name: `Hạt ${c.name}`, icon: c.icon, price: Math.ceil(c.seed * mult), lvl: c.lvl, pay: 'self',
        desc: `⏱️ Chín: ${fmtGrow(c.grow)} • bán ${c.sell}🪙${c.regrow ? ' • mọc lại' : ''}${c.only ? ` • chỉ mùa ${c.only.map((s) => SEASONS[s]).join('/')}` : ''}` });
      if (c.only && !c.only.includes(season)) r.note = `Ngoài mùa (${SEASONS[c.only[0]]})`;
    }
  }
  if (shop === 'animal') {
    for (const [k, p] of Object.entries(PENS)) {
      if (p.cost <= 0) continue;
      const owned = !!st.buildings[k]?.owned;
      mk({ tab: 'pens', key: `pen:${k}`, kind: 'pen', ref: k, name: p.name, icon: p.icon, price: p.cost, lvl: p.lvl, pay: 'fund', owned, desc: `Sức chứa ${p.cap} con • trả bằng Quỹ Chung` });
    }
    for (const id of BUYABLE_ANIMALS) {
      const a = ANIMALS[id], pen = a.pen, owned = !!st.buildings[pen]?.owned;
      const r = mk({ tab: 'animals', key: `animal:${id}`, kind: 'animal', ref: id, name: a.name, icon: a.icon, price: a.cost, lvl: PENS[pen].lvl, pay: 'self', desc: `Cho ${ITEMS[a.prod.item].name} mỗi ~${a.prod.every}s` });
      if (!owned && !r.locked) { r.locked = true; r.reason = `Cần ${PENS[pen].name}`; }
    }
    for (const a of Object.values(st.animals)) {
      if (a.type === 'dog') continue;
      const price = animalSalePrice(a);
      if (!price) continue;
      mk({ tab: 'sell', key: `animalSell:${a.id}`, kind: 'animalSell', ref: a.id, name: a.name, icon: ANIMALS[a.type].icon, price, lvl: 1, pay: 'self', desc: `${ANIMALS[a.type].name}${a.golden ? ' Vàng ✨' : ''}${a.growth < 1 ? ' • Thú con' : ''}${a.ready ? ' • Đang có sản phẩm' : ''}` });
    }
  }
  if (shop === 'furniture') {
    for (const id of FURN_LIST) { const f = FURN[id]; if (f.rare || LUXURY_FURN.includes(id)) continue; mk({ tab: f.cat, key: `furn:${id}`, kind: 'furn', ref: id, name: f.name, icon: f.icon, price: f.price, lvl: f.lvl, pay: 'self', desc: `${f.w}×${f.d} ô` }); }
    for (const id of LUXURY_FURN) { const f = FURN[id]; mk({ tab: 'luxury', key: `furn:${id}`, kind: 'furn', ref: id, name: f.name, icon: f.icon, price: f.price, lvl: f.lvl, pay: 'self', desc: `${f.w}×${f.d} ô • Hàng xa xỉ` }); }
  }
  if (shop === 'general' || shop === 'delivery') {
    const m = shop === 'delivery' ? 1.3 : 1;
    mk({ tab: 'goods', key: 'goods:feed1', kind: 'goods', ref: 'feed', qty: 1, name: 'Thức Ăn Gia Súc', icon: '🥣', price: Math.ceil(3 * m), lvl: 1, pay: 'self', desc: 'Cho thú ăn' });
    mk({ tab: 'goods', key: 'goods:feed10', kind: 'goods', ref: 'feed', qty: 10, name: 'Thức Ăn ×10', icon: '🥣', price: Math.ceil(26 * m), lvl: 1, pay: 'self', desc: 'Gói tiết kiệm' });
    if (shop === 'general') {
      mk({ tab: 'goods', key: 'goods:bait5', kind: 'goods', ref: 'bait', qty: 5, name: 'Mồi Câu ×5', icon: '🪱', price: 30, lvl: 2, pay: 'self', desc: 'Cá hiếm dễ cắn hơn' });
      for (const [id, h] of Object.entries(HATS)) if (h.price > 0) mk({ tab: 'hats', key: `hat:${id}`, kind: 'hat', ref: id, name: h.name, icon: h.icon, price: h.price, lvl: 1, pay: 'self', desc: 'Đội là đẹp!' });
    }
  }
  if (shop === 'merchant') {
    mk({ tab: 'rare', key: 'seed:moonberry', kind: 'seed', ref: 'moonberry', name: 'Hạt Dâu Trăng (hiếm)', icon: '🌙', price: 260, lvl: 1, pay: 'self', desc: `⏱️ Chín: ${fmtGrow(CROPS.moonberry.grow)} • Bán 420🪙 • mọc lại` });
    mk({ tab: 'rare', key: 'furn:gold_gnome', kind: 'furn', ref: 'gold_gnome', name: 'Chú Lùn Vàng', icon: '👑', price: FURN.gold_gnome.price, lvl: FURN.gold_gnome.lvl, pay: 'self', desc: 'Vật phẩm xa xỉ • Khoe với hàng xóm' });
    mk({ tab: 'rare', key: 'goods:bait5', kind: 'goods', ref: 'bait', qty: 5, name: 'Mồi Câu Thượng Hạng ×5', icon: '🪱', price: 20, lvl: 1, pay: 'self', desc: 'Giá hời!' });
  }
  return rows;
}
