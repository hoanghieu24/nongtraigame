import { FURN, HOUSE_LEVELS, FLOORS, WALLS, LIGHTS } from '../data/furniture.js';
import { buildableOutdoor, interiorRoom, INTERIOR, HOME_KITCHEN } from '../data/layout.js';
import { uid } from '../core/util.js';
import { fail, ok } from '../core/result.js';
import { addTo, takeFrom } from '../inventory/Inventory.js';

export const footprint = (def, rot) => (rot % 2 ? { w: def.d, d: def.w } : { w: def.w, d: def.d });
const snap = (v) => Math.round(v * 2) / 2;
// Kiểm tra hợp lệ đặt đồ (dùng chung cho host validate + client ghost preview)
export function furnValid(st, def, area, x, z, rot, ignoreId) {
  const fp = footprint(def, rot);
  if (area === 'house') {
    const r = interiorRoom(st.farm.houseLevel), kz = -r.d / 2 + 0.72;
    if (def.wall) { if (x < -r.w / 2 + 0.6 || x > r.w / 2 - 0.6) return false; }
    else if (x < -r.w / 2 + fp.w / 2 - 1e-6 || x > r.w / 2 - fp.w / 2 + 1e-6 || z < -r.d / 2 + fp.d / 2 - 1e-6 || z > r.d / 2 - 1.4 - fp.d / 2 + 1e-6) return false;
    // Không đặt đè lên Khu Bếp + Tủ lạnh (tường Bắc) và Lò sưởi (tường Tây)
    if (!def.wall && !def.flat) {
      if (x - fp.w / 2 < HOME_KITCHEN.x + 1.48 && z - fp.d / 2 < kz + 0.68) return false;
      if (x - fp.w / 2 < -r.w / 2 + 1.0 && z + fp.d / 2 > -2.78 && z - fp.d / 2 < -0.42) return false;
    }
  } else {
    for (const [dx, dz] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]])
      if (!buildableOutdoor(x + (dx * fp.w) / 2, z + (dz * fp.d) / 2, st.farm.plotRows)) return false;
  }
  for (const o of Object.values(st.furniture)) {
    if (o.id === ignoreId || o.area !== area) continue;
    const od = FURN[o.item]; if (!od) continue;
    if (!!def.wall !== !!od.wall) continue;
    if ((def.flat || od.flat) && !(def.flat && od.flat)) continue;      // thảm nằm dưới đồ khác được
    const ofp = footprint(od, o.rot);
    if (Math.abs(x - o.x) < (fp.w + ofp.w) / 2 - 0.05 && Math.abs(z - o.z) < (fp.d + ofp.d) / 2 - 0.05) return false;
  }
  return true;
}
export const wallZ = (lvl) => -interiorRoom(lvl).d / 2 + 0.3;

export class FurnitureSystem {
  constructor(sim) {
    this.sim = sim; this.id = 'furn';
    this.cmds = { place: (p, c) => this.place(p, c), move: (p, c) => this.move(p, c), remove: (p, c) => this.remove(p, c), style: (p, c) => this.style(p, c), upgradeHouse: (p) => this.upgradeHouse(p) };
  }
  reachArea(pid, area, x, z) {
    const me = this.sim.pos(pid);
    if (area === 'house') return me.area === 'house';
    return me.area !== 'house' && Math.hypot(me.x - x, me.z - z) < 22;
  }
  place(pid, { item, area, x, z, rot = 0 }) {
    const { sim } = this, st = sim.st, def = FURN[item];
    if (!def || !def.areas.includes(area)) return fail('Món này không đặt ở đây được');
    if (!this.reachArea(pid, area, x, z)) return fail(area === 'house' ? 'Vào trong nhà mới đặt đồ nội thất được' : 'Đứng gần chỗ đặt hơn nhé!');
    rot = ((rot % 4) + 4) % 4; x = snap(x); z = def.wall && area === 'house' ? wallZ(st.farm.houseLevel) : snap(z);
    if (!furnValid(st, def, area, x, z, rot)) return fail('Chỗ này vướng rồi, thử chỗ khác nhé!');
    if (Object.keys(st.furniture).length >= 160) return fail('Nhà đầy đồ rồi!');
    const fromStash = (st.inventory.stash[item] || 0) > 0;
    if (!fromStash) {
      if (def.lvl > st.farm.level) return fail(`Mở khoá ở Cấp ${def.lvl}`);
      const eco = sim.sys('economy'); if (!eco.pay(pid, def.price, 'self')) return eco.noMoney(def.price, 'self');
    } else { takeFrom(st.inventory.stash, item, 1); sim.touch('inventory.stash'); }
    const id = uid('f'); st.furniture[id] = { id, item, area, x, z, rot }; sim.touch('furniture.' + id);
    sim.fx({ k: 'burst', kind: 'sparkle', x: area === 'house' ? INTERIOR.ox + x : x, z: area === 'house' ? INTERIOR.oz + z : z, y: 0.8, n: 10 }); sim.fx({ k: 'sfx', name: 'place', to: pid });
    sim.sys('prog').addXp(pid, 3); sim.game({ type: 'furn_place', pid, item, area });
    return ok({ id });
  }
  move(pid, { id, x, z, rot = 0 }) {
    const { sim } = this, st = sim.st, f = st.furniture[id]; if (!f) return fail('Không thấy món đồ');
    const def = FURN[f.item]; rot = ((rot % 4) + 4) % 4; x = snap(x); z = def.wall && f.area === 'house' ? wallZ(st.farm.houseLevel) : snap(z);
    if (!this.reachArea(pid, f.area, x, z)) return fail('Lại gần hơn nhé!');
    if (!furnValid(st, def, f.area, x, z, rot, id)) return fail('Chỗ này vướng rồi!');
    Object.assign(f, { x, z, rot }); sim.touch('furniture.' + id); sim.fx({ k: 'sfx', name: 'place', to: pid }); return ok();
  }
  remove(pid, { id }) {
    const { sim } = this, st = sim.st, f = st.furniture[id]; if (!f) return fail('Không thấy món đồ');
    if (!this.reachArea(pid, f.area, f.x, f.z)) return fail('Lại gần hơn nhé!');
    addTo(st.inventory.stash, f.item, 1); delete st.furniture[id]; sim.touch('furniture.' + id); sim.touch('inventory.stash');
    sim.toast(pid, `${FURN[f.item].icon} Cất vào Kho Nội Thất`, 'info'); return ok();
  }
  style(pid, { kind, value }) {
    const { sim } = this, st = sim.st, table = { floor: FLOORS, wall: WALLS, light: LIGHTS }[kind];
    if (!table || !table[value]) return fail('Không hợp lệ');
    if (this.sim.pos(pid).area !== 'house') return fail('Vào trong nhà để trang trí nhé!');
    if (st.house[kind] === value) return ok();
    const price = table[value].price, eco = sim.sys('economy');
    if (price > 0 && !eco.pay(pid, price, 'self')) return eco.noMoney(price, 'self');
    st.house[kind] = value; sim.touch('house'); sim.fx({ k: 'sfx', name: 'place', to: pid }); sim.game({ type: 'house_style', pid }); return ok();
  }
  upgradeHouse(pid) {
    const { sim } = this, st = sim.st, next = HOUSE_LEVELS[st.farm.houseLevel];
    if (!next) return fail('Nhà đã là Biệt Thự rồi!');
    if (st.farm.level < next.lvl) return fail(`${next.name} mở ở Cấp ${next.lvl}`);
    const eco = sim.sys('economy'); if (!eco.pay(pid, next.cost, 'fund')) return eco.noMoney(next.cost, 'fund');
    st.farm.houseLevel++; sim.touch('farm');
    sim.fx({ k: 'banner', text: `🏠 Nâng cấp: ${next.name}!`, sub: 'Phòng rộng hơn để đặt thêm đồ', tone: 'level' }); sim.fx({ k: 'confetti' }); sim.fx({ k: 'sfx', name: 'levelup' });
    sim.sys('prog').addXp(pid, 40); return ok();
  }
}
