import { WEAPONS } from '../data/weapons.js';
import { wrapPi } from '../core/util.js';
import { fail, ok } from '../core/result.js';
import { takeKey } from '../inventory/Inventory.js';

// Combat hài hước: dép/chổi/chảo... Không máu me. Host phân xử cú đánh dựa trên pose người chơi. Đánh được cả trộm lẫn zombie.
export class CombatSystem {
  constructor(sim) { this.sim = sim; this.id = 'combat'; this.cd = {}; this.cmds = { swing: (p, c) => this.swing(p, c) }; }
  swing(pid, { rot }) {
    const { sim } = this, st = sim.st, p = st.players[pid], w = WEAPONS[p.weapon] || WEAPONS.slipper, now = st.world.t;
    if ((this.cd[pid] || 0) > now) return ok();
    this.cd[pid] = now + w.cd * 0.8;
    const me = sim.pos(pid), dir = rot ?? me.rot ?? 0;
    if (w.consumes && !takeKey([sim.bag(pid)], w.consumes, 1)) { p.weapon = 'slipper'; sim.touch('players.' + pid); return fail('Hết cá để vả rồi! Về dùng dép nhé 🩴'); }
    if (w.consumes) sim.touch('inventory.players.' + pid);
    let hit = 0;
    const targets = [...Object.values(st.thieves).map((t) => [t, 'thief']), ...Object.values(st.zombies).map((t) => [t, 'zombie'])];
    for (const [t, kind] of targets) {
      if (['caught', 'escaped', 'dead', 'burn'].includes(t.st)) continue;
      const dx = t.x - me.x, dz = t.z - me.z, d = Math.hypot(dx, dz);
      if (d > w.reach + 0.8) continue;
      if (Math.abs(wrapPi(Math.atan2(dx, dz) - dir)) > w.arc + 0.35 && d > 1.2) continue;
      sim.sys(kind).hit(t, pid, w, { dx: dx / (d || 1), dz: dz / (d || 1) }); hit++;
    }
    if (!hit) sim.fx({ k: 'sfx', name: 'swish', x: me.x, z: me.z });
    return ok({ hit });
  }
}
