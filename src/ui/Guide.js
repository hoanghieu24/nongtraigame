import { CROPS } from '../data/crops.js';
import { ITEMS } from '../data/items.js';
import { ANIMALS, STARVE } from '../data/animals.js';
import { PLOT, plotPos, plotId, SPOTS, VILLAGE, PENS, REST, inRest } from '../data/layout.js';
import { RECIPES, RSC_CRATES } from '../data/recipes.js';
import { rscProgress } from '../restaurant/RestaurantSystem.js';
import { CFG } from '../core/Config.js';
import { HOUSE_LEVELS } from '../data/furniture.js';
import { expandCost } from '../farming/FarmingSystem.js';
import { fmt, timeInfo } from '../core/util.js';

const near = (list, x, z) => list.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
// "Bây giờ tôi có thể làm gì tiếp theo?" — luôn có gợi ý + mũi tên chỉ đường (kể cả từng bước nấu ăn trong Quán Ăn Ready, Set, Cook!).
export function guide(st, me, px, pz, wt) {
  const bag = st.inventory.players[me.id] || {}, crops = Object.values(st.crops), animals = Object.values(st.animals).filter((a) => a.type !== 'dog');
  const pos = (c) => plotPos(c.r, c.c), rain = st.world.weather === 'rain';
  const th = Object.values(st.thieves).filter((t) => t.st !== 'caught' && t.st !== 'escaped'); if (th.length) { const t = near(th, px, pz); return { icon: '🚨', text: 'Có trộm! Đuổi theo & đánh bằng dép (phím 6)', x: t.x, z: t.z }; }
  const zs = Object.values(st.zombies || {}).filter((z) => z.st !== 'dead' && z.st !== 'burn');
  if (me.sleeping) return { icon: '😴', text: 'Đang ngủ... đợi mọi người cùng ngủ để qua đêm, hoặc thức dậy' };
  if (zs.length) { const z = near(zs.map((a) => ({ x: a.x, z: a.z })), px, pz); return { icon: '🧟', text: 'Zombie! Đánh đuổi bằng dép (phím 6) hoặc vào nhà đi ngủ', x: z.x, z: z.z }; }
  const starving = animals.filter((a) => a.starving > 0).sort((a, b) => b.starving - a.starving)[0];
  if (starving) return { icon: '🍽️', text: `${starving.name} sắp chết đói! Cho ăn gấp (${Math.max(0, Math.ceil(STARVE.grace - starving.starving))}s)`, x: starving.x, z: starving.z, urgent: true };

  // Hướng dẫn trực quan từng bước khi người chơi đang ở trong Quán Ăn Làng hoặc đang trong Ca Làm Thêm "Ready, Set, Cook!"
  const r = st.restaurant;
  if (r.shift?.active || inRest(px, pz, 4)) {
    const carry = me.carry || '';
    const burning = Object.entries(r.stations || {}).find(([k, s]) => k !== 'home' && (s.state === 'burning' || s.state === 'burnt'));
    if (burning) {
      const sp = REST.stoves[burning[0]] || REST.counter;
      return { icon: '🧯', text: 'Bếp đang cháy! Chạy tới Bếp bấm Dập Lửa ngay!', x: sp.x, z: sp.z, urgent: true };
    }
    const seated = Object.values(r.guests || {}).filter((g) => g.state === 'seated').sort((a, b) => a.patience - b.patience);
    if (carry.startsWith('dish_')) {
      const dKey = carry.slice(5);
      const gMatch = seated.find((g) => g.dish === dKey);
      if (gMatch) {
        const tp = REST.table(gMatch.table);
        return { icon: RECIPES[dKey]?.icon || '🍽️', text: `Bưng ${RECIPES[dKey]?.name} ra Bàn Tiệc Oval phục vụ khách!`, x: tp.x, z: tp.z };
      }
      return { icon: '🛎️', text: 'Đặt món đã nấu lên Quầy Trả Món màu đỏ cam!', x: REST.passCounter.x, z: REST.passCounter.z };
    }
    if (carry === 'dirty_plate') {
      return { icon: '🚰', text: 'Đem đĩa bẩn tới Bồn Rửa Bát để rửa & nhận lương (+18🪙)', x: REST.sink.x, z: REST.sink.z };
    }
    const readyStove = Object.entries(r.stations || {}).find(([k, s]) => k !== 'home' && s.state === 'ready');
    if (readyStove) {
      const sp = REST.stoves[readyStove[0]] || REST.counter;
      return { icon: RECIPES[readyStove[1].recipe]?.icon || '🍳', text: `Món chín rồi! Lại ${REST.stoves[readyStove[0]]?.name || 'Bếp'} lấy ra đĩa kẻo cháy!`, x: sp.x, z: sp.z, urgent: !!readyStove[1].warned };
    }
    if (carry.startsWith('prep:')) {
      const ing = carry.slice(5);
      const targetStove = ['s0', 's1', 's2'].find((k) => r.stations[k]?.state === 'prep') || ['s0', 's1', 's2'].find((k) => !r.stations[k]) || 's0';
      const sp = REST.stoves[targetStove];
      return { icon: '🍳', text: `Đem ${RSC_CRATES[ing]?.name || ''} đã thái bỏ vào ${sp.name}`, x: sp.x, z: sp.z };
    }
    if (carry.startsWith('raw:')) {
      const ing = carry.slice(4);
      const bKey = !r.boards?.b0 ? 'b0' : 'b1';
      const bp = REST.boards[bKey];
      return { icon: '🔪', text: `Đem ${RSC_CRATES[ing]?.icon || ''} ra ${bp.name} để thái sơ chế`, x: bp.x, z: bp.z };
    }
    const readyBoard = Object.entries(r.boards || {}).find(([, b]) => b);
    if (readyBoard) {
      const bp = REST.boards[readyBoard[0]];
      return { icon: '🔪', text: `Lấy nguyên liệu trên ${bp.name} đem bỏ vào Bếp nấu`, x: bp.x, z: bp.z };
    }
    if (seated.length) {
      const g = seated[0], rec = RECIPES[g.dish];
      if (bag['dish_' + g.dish]) {
        const tp = REST.table(g.table);
        return { icon: rec.icon, text: `Phục vụ ${rec.name} cho khách ở Bàn Tiệc Oval`, x: tp.x, z: tp.z };
      }
      const passMatch = (r.pass || []).find((p) => p.recipe === g.dish);
      if (passMatch) {
        return { icon: rec.icon, text: `Lấy ${rec.name} trên Quầy Trả Món đem ra bàn khách`, x: REST.passCounter.x, z: REST.passCounter.z };
      }
      const prepStove = ['s0', 's1', 's2'].map((k) => r.stations[k]).find((s) => s?.state === 'prep' && s.recipe === g.dish)
        || ['s0', 's1', 's2'].map((k) => r.stations[k]).find((s) => s?.state === 'prep');
      const prog = rscProgress(prepStove || { recipe: g.dish, req: rec?.rsc || ['veg', 'veg'], added: [] });
      const missing = prog.find((x) => x.have < x.need);
      if (missing && REST.crates[missing.ing]) {
        const cr = REST.crates[missing.ing];
        return { icon: cr.icon, text: `Khách gọi ${rec.icon} ${rec.name}: Lấy ${cr.icon} ở ${cr.name} ➔ Thái 🔪 ➔ Nấu 🍳`, x: cr.x, z: cr.z };
      }
    }
    const dirtyKeys = Object.keys(r.dirtyTables || {});
    if (dirtyKeys.length) {
      const tp = REST.table(+dirtyKeys[0]);
      return { icon: '🪙', text: 'Lại Bàn Tiệc Oval thu tiền Tip & dọn đĩa bẩn đem rửa!', x: tp.x, z: tp.z };
    }
  }

  const ti = timeInfo(wt, CFG);
  if (ti.hour >= 19.5 || ti.hour < 5) return { icon: '🌙', text: 'Trời tối rồi — vào nhà đi ngủ kẻo zombie đến ăn cây!', x: 0, z: -12.2 };
  const og = Object.entries(PENS).find(([k, p]) => st.buildings[k]?.open && Math.hypot(px - p.gate.x, pz - p.gate.z) > 7);
  if (og) return { icon: '🚪', text: `Cổng ${og[1].name} đang mở — đóng lại kẻo thú chạy ra`, x: og[1].gate.x, z: og[1].gate.z };
  const t = st.meta.tut, feed = bag.feed || 0, hungry = animals.filter((a) => a.hunger > STARVE.hungry && a.area === 'out');
  const tilled = crops.filter((c) => c.s === 'tilled'), planted = crops.filter((c) => c.s === 'planted'), ripe = crops.filter((c) => c.s === 'ripe'), dry = planted.filter((c) => !(c.w > wt) && !rain);
  if (t < 6) {
    if (t === 0) return { icon: '📍', text: 'Di chuyển: joystick / WASD. Đi dạo quanh nhà nhé!' };
    if (t === 1) { if (tilled.length) { const c = near(tilled.map(pos).map((p, i) => ({ ...p, c: tilled[i] })), px, pz); return { icon: '🌱', text: 'Chọn 🌱 Hạt giống (phím 3) rồi bấm Hành động để gieo', x: c.x, z: c.z }; } const p = plotPos(0, 1); return { icon: '⛏️', text: 'Ra Khu Ruộng 3×3 (9 ô), chọn ⛏️ Cuốc (phím 1) và bấm Hành động', x: p.x, z: p.z }; }
    if (t === 2) { const c = dry[0] || planted[0]; if (c) { const p = pos(c); return { icon: '💧', text: 'Chọn 💧 Bình tưới (phím 2) rồi tưới cây', x: p.x, z: p.z }; } }
    if (t === 3) { const c = ripe[0] || planted[0]; if (c) { const p = pos(c); return { icon: '🧺', text: ripe.length ? 'Cây chín rồi! Bấm Hành động để thu hoạch' : 'Chờ cây lớn một chút...', x: p.x, z: p.z }; } }
    if (t === 4) return { icon: '🪙', text: 'Ra Quầy Cửa hàng cạnh nhà để bán nông sản', x: SPOTS.crate.x, z: SPOTS.crate.z };
    if (t === 5) { const a = animals.find((x) => x.type === 'chicken') || animals[0]; return { icon: '🐔', text: 'Chọn 🥣 (phím 4) rồi bấm Hành động để cho gà ăn', x: a?.x, z: a?.z }; }
  }
  if (ripe.length) { const c = near(ripe.map((r) => ({ ...pos(r), c: r })), px, pz); return { icon: '🧺', text: `Thu hoạch ${ripe.length} cây đã chín`, x: c.x, z: c.z }; }
  if (hungry.length) { if (feed > 0) { const a = near([...hungry], px, pz); return { icon: '🥣', text: `${a.name} đói rồi — cho ăn nào (phím 4)`, x: a.x, z: a.z }; } return { icon: '🧺', text: 'Hết thức ăn! Mua ở Tạp Hóa (Làng) hoặc Tí Shipper', x: VILLAGE.shops.general.x, z: VILLAGE.shops.general.z + 3 }; }
  const ready = animals.filter((a) => a.ready && a.area === 'out'); if (ready.length) { const a = near([...ready], px, pz); return { icon: ITEMS[ANIMALS[a.type].prod.item].icon, text: `Thu ${ITEMS[ANIMALS[a.type].prod.item].name} từ ${a.name}`, x: a.x, z: a.z }; }
  if (dry.length) { const c = near(dry.map((r) => ({ ...pos(r), c: r })), px, pz); return { icon: '💧', text: `Tưới ${dry.length} cây đang khô`, x: c.x, z: c.z }; }
  const seeds = Object.keys(bag).filter((k) => k.startsWith('seed_') && bag[k] > 0);
  if (tilled.length && seeds.length) { const c = near(tilled.map((r) => ({ ...pos(r), c: r })), px, pz); return { icon: '🌱', text: 'Gieo hạt vào ô đã cuốc', x: c.x, z: c.z }; }
  if (seeds.length && crops.length < st.farm.plotRows * PLOT.cols) {
    let targetP = plotPos(0, 0);
    for (let r = 0; r < st.farm.plotRows; r++) for (let c = 0; c < PLOT.cols; c++) if (!st.crops[plotId(r, c)]) { targetP = plotPos(r, c); break; }
    return { icon: '⛏️', text: 'Cuốc thêm đất để gieo tiếp', x: targetP.x, z: targetP.z };
  }
  const sell = Object.keys(bag).filter((k) => ITEMS[k] && ['crop', 'product', 'fish'].includes(ITEMS[k].cat)).reduce((n, k) => n + bag[k], 0);
  if (sell >= 4) return { icon: '🪙', text: `Bán ${sell} món ở Cửa hàng cạnh nhà (hoặc Quầy chợ +10%)`, x: SPOTS.crate.x, z: SPOTS.crate.z };
  if (!seeds.length && me.money >= 8) return { icon: '🌱', text: 'Hết hạt giống! Đi mua ở Cửa hàng Hạt Giống trong Làng', x: VILLAGE.shops.seed.x, z: VILLAGE.shops.seed.z + 3.4 };
  const fund = st.economy.fund + me.money, nextHouse = HOUSE_LEVELS[st.farm.houseLevel];
  if (st.farm.level >= CFG.RESTAURANT_LEVEL && !st.restaurant.unlocked) return { icon: '🍽️', text: `Mở quyền Làm Chủ Nhà Hàng (${fmt(CFG.RESTAURANT_COST)} 🪙) ở Làng`, x: REST.jobBoard.x, z: REST.jobBoard.z };
  if (nextHouse && st.farm.level >= nextHouse.lvl && fund >= nextHouse.cost) return { icon: '🏠', text: `Đủ tiền nâng cấp nhà: ${nextHouse.name} (${fmt(nextHouse.cost)} 🪙)`, x: SPOTS.houseUp.x, z: SPOTS.houseUp.z };
  const pen = Object.entries(PENS).find(([k, p]) => p.cost > 0 && !st.buildings[k]?.owned && st.farm.level >= p.lvl); if (pen) return { icon: pen[1].icon, text: `Xây ${pen[1].name} (${fmt(pen[1].cost)} 🪙 Quỹ Chung) ở Cửa Hàng Thú Cưng`, x: VILLAGE.shops.animal.x, z: VILLAGE.shops.animal.z + 3.4 };
  return { icon: '👨‍🍳', text: 'Qua Làng làm thêm tại Quán Ăn (Ready, Set, Cook!) kiếm lương & tip cao!', x: REST.jobBoard.x, z: REST.jobBoard.z + 1.2 };
}
