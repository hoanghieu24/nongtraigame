import { CROPS } from '../data/crops.js';
import { HATS } from '../data/characters.js';
import { WEAPONS } from '../data/weapons.js';
import { PRESETS } from '../data/characters.js';
import { FORAGE_POINTS, FORAGE_ITEM, SPOTS } from '../data/layout.js';
import { ITEMS } from '../data/items.js';
import { dist, uid } from '../core/util.js';
import { fail, ok } from '../core/result.js';
import { addTo, takeFrom } from './Inventory.js';

// Vật phẩm rơi trên đất, hái lượm, rương chung, chọn hạt/mũ/vũ khí, hồ sơ
export class WorldItemsSystem {
  constructor(sim) {
    this.sim = sim; this.id = 'items';
    this.cmds = {
      forage: (p, c) => this.forage(p, c), deposit: (p, c) => this.chest(p, c, true), withdraw: (p, c) => this.chest(p, c, false),
      seed: (p, c) => this.seed(p, c), hat: (p, c) => this.hat(p, c), weapon: (p, c) => this.weapon(p, c), profile: (p, c) => this.profile(p, c),
    };
  }
  bootstrap() { const st = this.sim.st; for (const f of FORAGE_POINTS) st.forage[f.id] = { ...f, ready: true }; }
  onNewDay() { const st = this.sim.st; for (const f of Object.values(st.forage)) if (!f.ready) { f.ready = true; this.sim.touch('forage.' + f.id); } }

  drop(item, qty, x, z, ttl = 240) {
    const id = uid('d'); this.sim.st.pickups[id] = { id, item, qty, x, z, ttl }; this.sim.touch('pickups.' + id); return id;
  }
  tick(dt) {
    const { sim } = this, st = sim.st, pk = st.pickups;
    for (const id in pk) {
      const d = pk[id]; d.ttl -= dt;
      if (d.ttl <= 0) { delete pk[id]; sim.touch('pickups.' + id); continue; }
      for (const pl of sim.activePlayers()) {
        if (pl.area === 'house') continue;
        if (dist(pl.x, pl.z, d.x, d.z) < 1.7) {
          sim.addItem(pl.id, d.item, d.qty); delete pk[id]; sim.touch('pickups.' + id);
          const it = ITEMS[d.item];
          sim.fx({ k: 'float', x: d.x, z: d.z, y: 1.6, text: `+${d.qty} ${it?.icon || ''}`, color: '#fff', to: pl.id });
          sim.fx({ k: 'burst', kind: 'sparkle', x: d.x, z: d.z, y: 0.6, n: 8 }); sim.fx({ k: 'sfx', name: 'pop', x: d.x, z: d.z });
          sim.game({ type: 'pickup', pid: pl.id, item: d.item, n: d.qty });
          break;
        }
      }
    }
  }
  forage(pid, { id }) {
    const { sim } = this, f = sim.st.forage[id];
    if (!f) return fail('Không tìm thấy');
    if (!f.ready) return fail('Đã hái rồi, mai quay lại nhé!');
    if (!sim.near(pid, f.x, f.z, 3.2)) return fail('Lại gần hơn chút');
    f.ready = false; sim.touch('forage.' + id);
    const item = FORAGE_ITEM[f.kind]; sim.addItem(pid, item, 1);
    sim.fx({ k: 'float', x: f.x, z: f.z, y: 1.4, text: `+1 ${ITEMS[item].icon}`, color: '#fff', to: pid });
    sim.fx({ k: 'burst', kind: 'leaf', x: f.x, z: f.z, y: 0.5, n: 8 }); sim.fx({ k: 'sfx', name: 'pop', x: f.x, z: f.z });
    sim.sys('prog').addXp(pid, 3); sim.game({ type: 'forage', pid, item });
    return ok();
  }
  chest(pid, { item, qty = 1 }, deposit) {
    const { sim } = this, st = sim.st;
    if (!sim.near(pid, SPOTS.chest.x, SPOTS.chest.z, 5)) return fail('Lại gần Rương Chung ở cửa nhà nhé!');
    const from = deposit ? sim.bag(pid) : st.inventory.chest, to = deposit ? st.inventory.chest : sim.bag(pid);
    const ids = item === 'all' ? Object.keys(from).filter((id) => ITEMS[id] && ITEMS[id].cat !== 'seed' && id !== 'feed') : [item];
    let moved = 0;
    for (const id of ids) {
      const n = item === 'all' ? from[id] : Math.min(qty === 'all' ? from[id] : qty | 0, from[id] || 0);
      if (n > 0 && takeFrom(from, id, n)) { addTo(to, id, n); moved += n; }
    }
    if (!moved) return fail(deposit ? 'Túi bạn không có món đó' : 'Rương không có món đó');
    sim.touch('inventory.players.' + pid); sim.touch('inventory.chest');
    sim.fx({ k: 'sfx', name: 'pop', x: SPOTS.chest.x, z: SPOTS.chest.z });
    sim.fx({ k: 'float', x: SPOTS.chest.x, z: SPOTS.chest.z, y: 2, text: deposit ? `📦 +${moved}` : `🎒 +${moved}`, color: '#fff', to: pid });
    sim.game({ type: deposit ? 'deposit' : 'withdraw', pid, n: moved });
    return ok();
  }
  seed(pid, { crop }) { if (!CROPS[crop]) return fail('Hạt không hợp lệ'); this.sim.st.players[pid].sel = crop; this.sim.touch('players.' + pid); return ok(); }
  hat(pid, { id }) { const p = this.sim.st.players[pid]; if (!HATS[id] || !p.hats.includes(id)) return fail('Bạn chưa có mũ này'); p.char.hat = id; this.sim.touch('players.' + pid); return ok(); }
  weapon(pid, { id }) { const p = this.sim.st.players[pid]; if (!WEAPONS[id] || !p.weapons.includes(id)) return fail('Chưa mở khoá vũ khí này'); p.weapon = id; this.sim.touch('players.' + pid); return ok(); }
  profile(pid, { name, preset }) {
    const p = this.sim.st.players[pid];
    if (name) p.name = String(name).slice(0, 14);
    if (preset !== undefined && PRESETS[preset]) { p.char.preset = preset; p.avatar = PRESETS[preset].avatar; }
    this.sim.touch('players.' + pid); return ok();
  }
}
