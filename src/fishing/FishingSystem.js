import { FISH, FISH_LIST } from '../data/fish.js';
import { FISH_SPOTS } from '../data/layout.js';
import { dist } from '../core/util.js';
import { fail, ok } from '../core/result.js';

const XP = { junk: 1, common: 4, uncommon: 8, rare: 16, epic: 32, legend: 110 };
// Cast → chờ → cá cắn → kéo (mini-game ở client, host quyết cá gì + kết quả cuối).
export class FishingSystem {
  constructor(sim) { this.sim = sim; this.id = 'fish'; this.cmds = { cast: (p, c) => this.cast(p, c), reel: (p) => this.reel(p), finish: (p, c) => this.finish(p, c), cancel: (p) => this.cancel(p) }; }
  spotAt(pid) { const p = this.sim.pos(pid); return FISH_SPOTS.find((s) => dist(p.x, p.z, s.x, s.z) <= s.r) || null; }
  pickFish(spot, bait) {
    const { sim } = this, ti = sim.ti, rain = ['rain', 'storm'].includes(sim.st.world.weather);
    const pool = FISH_LIST.filter((id) => FISH[id].spots.includes(spot.water));
    return sim.rng.weighted(pool, (id) => {
      const f = FISH[id]; let w = f.w;
      if (bait && ['rare', 'epic', 'legend'].includes(f.rarity)) w *= 2.4;
      if (bait && f.rarity === 'junk') w *= 0.3;
      if (f.time === 'night') w *= ti.night ? 2 : 0.35;
      if (rain && f.rarity !== 'junk') w *= 1.25;
      if (sim.st.daily?.fortune === 2 && ['rare', 'epic', 'legend'].includes(f.rarity)) w *= 1.25;
      return w;
    });
  }
  cast(pid) {
    const { sim } = this, p = sim.st.players[pid];
    if (p.fishing) return fail('Đang câu rồi!');
    const spot = this.spotAt(pid); if (!spot) return fail('Ra cầu tàu / bờ sông để câu cá nhé! 🎣');
    const bait = sim.hasItem(pid, 'bait') && sim.takeItem(pid, 'bait');
    const fish = this.pickFish(spot, bait);
    p.fishing = { phase: 'wait', until: sim.st.world.t + sim.rng.range(2.2, 5.5), fish, spot: spot.id, bait: !!bait };
    sim.touch('players.' + pid);
    sim.fx({ k: 'sfx', name: 'cast', x: spot.x, z: spot.z }); sim.fx({ k: 'burst', kind: 'water', x: spot.x, z: spot.z + 1.5, y: 0.2, n: 8 });
    return ok();
  }
  reel(pid) {
    const { sim } = this, p = sim.st.players[pid], f = p.fishing;
    if (!f) return fail('Chưa thả câu!');
    if (f.phase === 'wait') { delete p.fishing; sim.touch('players.' + pid); return fail('Kéo sớm quá! Cá chưa cắn.'); }
    if (f.phase === 'bite') { f.phase = 'reel'; f.until = sim.st.world.t + 30; f.diff = FISH[f.fish].diff; sim.touch('players.' + pid); return ok(); }
    return ok();
  }
  finish(pid, { win }) {
    const { sim } = this, p = sim.st.players[pid], f = p.fishing;
    if (!f || f.phase !== 'reel') return fail('Không có cá nào đang kéo');
    delete p.fishing; sim.touch('players.' + pid);
    const def = FISH[f.fish], spot = FISH_SPOTS.find((s) => s.id === f.spot) || { x: 0, z: 30 };
    if (!win) { sim.toast(pid, 'Cá sổng mất rồi! 😭', 'warn'); sim.fx({ k: 'sfx', name: 'fail', to: pid }); return ok(); }
    sim.addItem(pid, f.fish, 1); p.stats.fish++; p.dex[f.fish] = (p.dex[f.fish] || 0) + 1; sim.touch('players.' + pid);
    sim.fx({ k: 'fishjump', x: spot.x, z: spot.z, icon: def.icon, pid });
    sim.fx({ k: 'float', x: spot.x, z: spot.z - 0.5, y: 2.2, text: `${def.icon} ${def.name}`, color: '#fff', to: pid });
    sim.fx({ k: 'sfx', name: def.rarity === 'legend' || def.rarity === 'epic' ? 'fanfare' : 'catch', x: spot.x, z: spot.z });
    if (['rare', 'epic', 'legend'].includes(def.rarity)) { sim.fx({ k: 'burst', kind: 'stars', x: spot.x, z: spot.z, y: 1.5, n: 16 }); sim.fx({ k: 'confetti', to: pid }); }
    if (def.rarity === 'legend') sim.fx({ k: 'banner', text: `${p.name} bắt được ${def.name}!!!`, sub: 'Huyền thoại có thật!', tone: 'level' });
    sim.sys('prog').addXp(pid, XP[def.rarity] || 3);
    sim.game({ type: 'fish', pid, item: f.fish, n: 1, value: def.value });
    return ok();
  }
  cancel(pid) { const p = this.sim.st.players[pid]; if (p.fishing) { delete p.fishing; this.sim.touch('players.' + pid); } return ok(); }
  tick() {
    const { sim } = this, st = sim.st, t = st.world.t;
    for (const p of Object.values(st.players)) {
      const f = p.fishing; if (!f) continue;
      if (f.phase === 'wait' && t >= f.until) {
        f.phase = 'bite'; f.until = t + 1.6; sim.touch('players.' + p.id);
        const s = FISH_SPOTS.find((x) => x.id === f.spot);
        sim.fx({ k: 'sfx', name: 'bite', x: s.x, z: s.z, to: p.id }); sim.toast(p.id, '❗ Cá cắn câu! Kéo ngay!', 'good');
      } else if (f.phase === 'bite' && t > f.until) { delete p.fishing; sim.touch('players.' + p.id); sim.toast(p.id, 'Cá chạy mất rồi... 🐟💨', 'warn'); }
      else if (f.phase === 'reel' && t > f.until) { delete p.fishing; sim.touch('players.' + p.id); }
    }
  }
}
