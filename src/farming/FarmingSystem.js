import { CFG } from '../core/Config.js';
import { CROPS, canPlantIn, SEASONS } from '../data/crops.js';
import { PLOT, parsePlot, plotPos } from '../data/layout.js';
import { fail, ok } from '../core/result.js';
import { isWet } from '../data/weather.js';

// Chi phí mở rộng ruộng theo từng hàng (khởi đầu 3 hàng × 3 ô = 9 ô, nâng cấp thêm +3 ô mỗi lần lên tối đa 8 hàng = 24 ô)
const EXPAND_COST = [450, 850, 1400, 2200, 3400, 4800];
export const expandCost = (rows) => EXPAND_COST[rows - PLOT.rows0] ?? 5000;

// Cày đất → gieo hạt → tưới → chờ lớn → thu hoạch. Mọi thay đổi đi qua command để host quyết định.
export class FarmingSystem {
  constructor(sim) {
    this.sim = sim; this.id = 'farm';
    this.cmds = { till: (p, c) => this.till(p, c), water: (p, c) => this.water(p, c), plant: (p, c) => this.plant(p, c), harvest: (p, c) => this.harvest(p, c), expand: (p) => this.expand(p) };
  }
  plot(pid, id) {
    const st = this.sim.st, pp = parsePlot(id);
    if (!pp) return { err: 'Ô đất không hợp lệ' };
    if (pp.r >= st.farm.plotRows || pp.c >= PLOT.cols) return { err: 'Ô đất này chưa mở' };
    const pos = plotPos(pp.r, pp.c);
    if (!this.sim.near(pid, pos.x, pos.z, CFG.REACH + 1.8)) return { err: 'Đứng gần ô đất hơn nhé!' };
    return { pp, pos, c: st.crops[id] };
  }
  mark(c, pid) { if (!c.by.includes(pid)) c.by.push(pid); }
  stat(pid, k) { this.sim.st.players[pid].stats[k]++; }

  till(pid, { plot }) {
    const { err, pp, pos, c } = this.plot(pid, plot); if (err) return fail(err);
    if (c) return fail('Ô này cuốc rồi!');
    this.sim.st.crops[plot] = { id: plot, r: pp.r, c: pp.c, s: 'tilled', w: 0, by: [pid] };
    this.sim.touch('crops.' + plot);
    this.sim.fx({ k: 'sfx', name: 'till', x: pos.x, z: pos.z });
    this.sim.sys('prog').addXp(pid, 1); this.sim.game({ type: 'till', pid, plot });
    return ok();
  }
  water(pid, { plot }) {
    const { err, pos, c } = this.plot(pid, plot); if (err) return fail(err);
    if (!c) return fail('Cần cuốc đất trước đã 🔨');
    const t = this.sim.st.world.t;
    if (c.w > t + CFG.WATER_SECONDS * 0.6) return fail('Đất còn ướt mà!');
    c.w = t + CFG.WATER_SECONDS; this.mark(c, pid); this.stat(pid, 'water');
    this.sim.touch('crops.' + plot);
    this.sim.fx({ k: 'sfx', name: 'water', x: pos.x, z: pos.z });
    this.sim.sys('prog').addXp(pid, 1); this.sim.game({ type: 'water', pid, plot, n: 1 });
    return ok();
  }
  plant(pid, { plot, crop }) {
    const { sim } = this, st = sim.st, def = CROPS[crop];
    if (!def) return fail('Hạt giống không hợp lệ');
    const { err, pos, c } = this.plot(pid, plot); if (err) return fail(err);
    if (!c) return fail('Cuốc đất trước khi gieo nhé!');
    if (c.s !== 'tilled') return fail('Ô này đã có cây!');
    if (def.lvl > st.farm.level) return fail(`${def.name} mở ở Cấp ${def.lvl}`);
    if (!canPlantIn(crop, st.world.season)) return fail(`${def.name} chỉ trồng được mùa ${def.only.map((s) => SEASONS[s]).join('/')}`);
    if (!sim.takeItem(pid, 'seed_' + crop)) return fail('Hết hạt giống rồi! Mua thêm ở Làng 🌱');
    c.s = 'planted'; c.crop = crop; c.g = 0; this.mark(c, pid); this.stat(pid, 'plant');
    if (st.meta.tut <= 3) c.fast = 1;                      // cây đầu tiên lớn nhanh cho phần hướng dẫn
    sim.touch('crops.' + plot);
    sim.fx({ k: 'sfx', name: 'plant', x: pos.x, z: pos.z });
    sim.sys('prog').addXp(pid, 1); sim.game({ type: 'plant', pid, plot, crop, n: 1 });
    return ok();
  }
  harvest(pid, { plot }) {
    const { sim } = this, { err, pos, c } = this.plot(pid, plot); if (err) return fail(err);
    if (!c || c.s !== 'ripe') return fail('Chưa chín đâu!');
    const cropId = c.crop, def = CROPS[cropId], team = c.by.length >= 2, lucky = sim.rng.chance(0.06);
    const fortuneBonus = sim.st.daily?.fortune === 0 && sim.rng.chance(0.25);
    const qty = 1 + (team ? 1 : 0) + (lucky ? 1 : 0) + (fortuneBonus ? 1 : 0);
    sim.addItem(pid, cropId, qty); this.stat(pid, 'harvest');
    if (def.regrow) { c.s = 'planted'; c.g = 0.45; } else { c.s = 'tilled'; delete c.crop; c.g = 0; }
    delete c.fast; // tốc độ hướng dẫn chỉ áp dụng vụ đầu, kể cả cây mọc lại
    c.by = [];
    sim.touch('crops.' + plot);
    sim.fx({ k: 'sfx', name: 'harvest', x: pos.x, z: pos.z });
    sim.fx({ k: 'float', x: pos.x, z: pos.z, y: 1.8, text: `+${qty} ${def.icon}`, color: '#fff', to: pid });
    if (team) { sim.fx({ k: 'float', x: pos.x, z: pos.z, y: 2.6, text: '🤝 Teamwork +1!', color: '#ffd166' }); }
    else if (lucky) { sim.fx({ k: 'float', x: pos.x, z: pos.z, y: 2.6, text: '🍀 May mắn +1!', color: '#9be26b' }); }
    if (fortuneBonus) sim.fx({ k: 'float', x: pos.x, z: pos.z, y: 3.2, text: '🌟 Quẻ Đại Cát +1!', color: '#ffe066', to: pid });
    sim.sys('prog').addXp(pid, def.xp * qty);
    sim.game({ type: 'harvest', pid, plot, item: cropId, n: qty, team });
    return ok();
  }
  expand(pid) {
    const { sim } = this, st = sim.st, rows = st.farm.plotRows;
    if (rows >= PLOT.maxRows) return fail('Ruộng đã mở rộng tối đa rồi!');
    const cost = expandCost(rows), eco = sim.sys('economy');
    if (!eco.pay(pid, cost, 'fund')) return eco.noMoney(cost, 'fund');
    st.farm.plotRows++; sim.touch('farm');
    const totalPlots = st.farm.plotRows * PLOT.cols;
    sim.fx({ k: 'banner', text: `🌾 Đã mở rộng Khu Ruộng lên ${totalPlots} ô!`, sub: `Thêm +${PLOT.cols} ô đất canh tác mới`, tone: 'good' }); sim.fx({ k: 'confetti' }); sim.fx({ k: 'sfx', name: 'levelup' });
    sim.sys('prog').addXp(pid, 15);
    return ok();
  }
  tick(dt) {
    const { sim } = this, st = sim.st, t = st.world.t, rain = isWet(st.world.weather), snow = st.world.weather === 'snow', ti = sim.ti;
    for (const id in st.crops) {
      const c = st.crops[id];
      if (rain && c.w < t + 15) c.w = t + 15;
      if (c.s !== 'planted') continue;
      const def = CROPS[c.crop]; if (!def) continue;
      let rate = (1 / def.grow) * (c.w > t ? 1 : 0.3);
      if (def.seasons) rate *= def.seasons.includes(ti.season) ? 1.2 : 0.75;
      if (def.shade) rate *= ti.night || rain ? 1.6 : 0.6;
      if (snow) rate *= 0.6;
      if (c.fast) rate *= 6;
      const g0 = c.g; c.g = Math.min(1, c.g + dt * rate);
      if (c.g >= 1) {
        c.s = 'ripe'; sim.touch('crops.' + id);
        sim.fx({ k: 'sfx', name: 'ripe' });
        sim.game({ type: 'ripe', plot: id });
      } else if (Math.floor(c.g * 12) !== Math.floor(g0 * 12)) sim.touch('crops.' + id);
    }
  }
}
