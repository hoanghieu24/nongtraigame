import { NPCS, NPC_LIST } from '../data/npcs.js';
import { dist } from '../core/util.js';

// NPC đi lại quanh nhà, chạy tán loạn khi có trộm (host mô phỏng, client nhận snapshot).
export class NpcSystem {
  constructor(sim) { this.sim = sim; this.id = 'npc'; this.cmds = {}; }
  bootstrap() {
    const st = this.sim.st, rng = this.sim.rng;
    for (const id of NPC_LIST) { const h = NPCS[id].home; st.npcs[id] = { id, x: h.x, z: h.z, r: rng.range(-3, 3), st: 'idle', timer: rng.range(0.5, 4), tx: h.x, tz: h.z }; }
  }
  tick(dt) {
    const { sim } = this, st = sim.st, rng = sim.rng, thief = sim.sys('thief').active()[0] || sim.sys('zombie').alive()[0];
    if (!Object.keys(st.npcs).length && st.meta.fresh === false) this.bootstrap();
    for (const id in st.npcs) {
      const n = st.npcs[id], def = NPCS[id]; if (!def) continue;
      n.timer -= dt;
      if (thief && dist(thief.x, thief.z, n.x, n.z) < 18 && n.st !== 'scared') { n.st = 'scared'; n.timer = 3.5; const a = Math.atan2(n.x - thief.x, n.z - thief.z); n._fx = def.home.x + Math.sin(a) * 2; n._fz = def.home.z + Math.cos(a) * 2; n.tx = n._fx; n.tz = n._fz; }
      if (n.st === 'idle') { if (n.timer <= 0) { const rr = def.wander; n.tx = def.home.x + rng.range(-rr, rr); n.tz = def.home.z + rng.range(-rr, rr); n.st = 'walk'; n.timer = 9; } }
      else if (n.st === 'walk' || n.st === 'scared') {
        const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz), sp = n.st === 'scared' ? 5.5 : id === 'kid' ? 3.4 : 1.5;
        if (d < 0.25 || (n.timer <= 0 && n.st === 'walk')) { n.st = 'idle'; n.timer = rng.range(2, 6); }
        else { const s = Math.min(d, sp * dt); n.x += (dx / d) * s; n.z += (dz / d) * s; n.r = Math.atan2(dx, dz); if (n.st === 'scared' && n.timer <= 0) { n.st = 'idle'; n.timer = 2; } }
      }
    }
  }
}
