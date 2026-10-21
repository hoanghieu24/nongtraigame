import { levelFromXp, unlocksAt } from '../data/levels.js';
import { AREAS } from '../data/layout.js';
import { WEAPONS } from '../data/weapons.js';
import { CFG } from '../core/Config.js';

const HAT_REWARDS = { 3: 'cap', 5: 'flower', 8: 'cowboy' };
export class ProgressionSystem {
  constructor(sim) { this.sim = sim; this.id = 'prog'; this.cmds = {}; }
  // XP cộng cho người chơi VÀ cho cả nông trại (cấp nông trại là của cả nhà)
  addXp(pid, amt) {
    const { sim } = this, st = sim.st, p = st.players[pid]; if (!p || !Number.isFinite(amt) || amt <= 0) return;
    const pb = levelFromXp(p.xp); p.xp += amt; const pa = levelFromXp(p.xp);
    if (pa > pb) {
      p.level = pa;
      for (const [level, hat] of Object.entries(HAT_REWARDS)) {
        if (+level > pb && +level <= pa && !p.hats.includes(hat)) { p.hats.push(hat); sim.toast(pid, `🎁 Nhận mũ mới: ${hat}!`, 'good'); }
      }
      sim.fx({ k: 'banner', to: pid, text: `Bạn lên Cấp ${pa}!`, sub: '⭐ Người chơi', tone: 'level' });
      sim.fx({ k: 'sfx', name: 'levelup', to: pid });
    }
    sim.touch('players.' + pid);
    const f = st.farm, fb = levelFromXp(f.xp); f.xp += amt; const fa = levelFromXp(f.xp);
    if (fa > fb) this.farmLevelUp(fa);
    sim.touch('farm');
  }
  farmLevelUp(level) {
    const { sim } = this, st = sim.st; st.farm.level = level;
    for (const k in AREAS) if (level >= AREAS[k].lvl && !st.farm.areas[k]) { st.farm.areas[k] = true; sim.fx({ k: 'areaUnlock', area: k }); }
    for (const p of Object.values(st.players)) {
      for (const [w, d] of Object.entries(WEAPONS)) if (d.lvl <= level && !d.consumes && !p.weapons.includes(w)) p.weapons.push(w);
      if (level >= 2 && !p.weapons.includes('fish')) p.weapons.push('fish');
      sim.touch('players.' + p.id);
    }
    const list = unlocksAt(level);
    sim.fx({ k: 'banner', text: `NÔNG TRẠI LÊN CẤP ${level}!`, sub: list.slice(0, 4).join('  •  ') || 'Cả nhà giỏi quá!', tone: 'level' });
    sim.fx({ k: 'confetti' }); sim.fx({ k: 'sfx', name: 'levelup' });
    sim.game({ type: 'farmLevel', level });
    if (level === CFG.RESTAURANT_LEVEL) sim.toast(undefined, '🍽️ Nhà Hàng đã sẵn sàng mở khoá ở Làng!', 'good');
  }
}
