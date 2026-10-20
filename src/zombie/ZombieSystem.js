import { uid, dist, wrapPi } from '../core/util.js';
import { plotPos, WORLD } from '../data/layout.js';
import { CROPS } from '../data/crops.js';

const SPAWNS = [{ x: -27, z: 3 }, { x: -26, z: -14 }, { x: 0, z: -30 }, { x: 31, z: 15 }, { x: 30, z: -8 }, { x: -12, z: 19 }];
const ALIVE = (z) => z.st !== 'dead' && z.st !== 'burn';
// Zombie ban đêm (kiểu hoạt hình, không máu me): ăn cây, cắn người chơi. Đi ngủ để tránh, bù nhìn doạ chạy, đánh bằng dép/chảo.
export class ZombieSystem {
  constructor(sim) { this.sim = sim; this.id = 'zombie'; this.cmds = {}; this.spawnT = 15; this.msgT = 0; }
  alive() { return Object.values(this.sim.st.zombies).filter(ALIVE); }
  spawn() {
    const { sim } = this, st = sim.st, rng = sim.rng, s = rng.pick(SPAWNS), id = uid('z'), hp = 2 + (st.farm.level >= 6 ? 1 : 0);
    st.zombies[id] = { id, x: s.x + rng.range(-1, 1), z: s.z + rng.range(-1, 1), r: 0, st: 'walk', hp, maxHp: hp, timer: 0, think: 0, bite: 0, tk: '', tid: '' };
    sim.touch('zombies.' + id); sim.fx({ k: 'sfx', name: 'zombie', x: s.x, z: s.z });
    if (this.alive().length === 1) sim.fx({ k: 'banner', text: '🧟 Zombie xuất hiện!', sub: 'Vào nhà đi ngủ, hoặc đánh đuổi chúng', tone: 'alarm' });
  }
  tick(dt) {
    const { sim } = this, st = sim.st, hour = sim.ti.hour, rng = sim.rng, zs = st.zombies, awake = sim.connected().filter((p) => !p.sleeping);
    const dark = hour >= 20.2 || hour < 5.2, spawnWin = hour >= 21 || hour < 4.8;
    if (!dark) for (const z of Object.values(zs)) if (ALIVE(z)) { z.st = 'burn'; z.timer = rng.range(1, 3.5); sim.touch('zombies.' + z.id); }
    if (spawnWin && awake.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = rng.range(14, 26); if (this.alive().length < Math.min(8, 2 + Math.floor(st.farm.level / 2) + awake.length)) this.spawn(); }
    }
    const scares = Object.values(st.furniture).filter((f) => f.item === 'scarecrow' && f.area === 'farm');
    const players = awake.map((p) => ({ id: p.id, ...sim.pos(p.id) })).filter((p) => p.area !== 'house');
    this.msgT -= dt;
    for (const id in zs) {
      const z = zs[id]; z.timer -= dt; z.bite -= dt;
      if (z.kb) { z.x += z.kb.vx * dt; z.z += z.kb.vz * dt; const f = Math.exp(-6 * dt); z.kb.vx *= f; z.kb.vz *= f; if ((z.kb.life -= dt) <= 0) z.kb = null; }
      if (z.st === 'dead' || z.st === 'burn') { if (z.timer <= 0) { delete zs[id]; sim.touch('zombies.' + id); } continue; }
      if (z.st === 'stun') { if (z.timer <= 0) { z.st = 'walk'; sim.touch('zombies.' + id); } continue; }
      const sc = scares.find((f) => dist(f.x, f.z, z.x, z.z) < 5.5);
      if (sc && z.st !== 'eat') { this.step(z, dt, 2.8, z.x + (z.x - sc.x), z.z + (z.z - sc.z)); continue; }
      if (z.st === 'eat') {
        if (z.timer <= 0) this.eat(z); continue;
      }
      z.think -= dt;
      if (z.think <= 0) { z.think = 1; this.choose(z, players, scares); }
      let tx = z.x, tz = z.z, sp = 2.1;
      if (z.tk === 'player') { const p = players.find((q) => q.id === z.tid); if (p) { tx = p.x; tz = p.z; sp = 2.7; } else z.tk = ''; }
      else if (z.tk === 'crop') { const c = st.crops[z.tid]; if (c && c.crop) { const pp = plotPos(c.r, c.c); tx = pp.x; tz = pp.z; if (dist(z.x, z.z, tx, tz) < 1.1) { z.st = 'eat'; z.timer = 2.4; sim.touch('zombies.' + id); continue; } } else z.tk = ''; }
      else { tx = z.wx ?? z.x; tz = z.wz ?? z.z; }
      this.step(z, dt, sp, tx, tz);
      if (z.bite <= 0) for (const p of players) if (dist(p.x, p.z, z.x, z.z) < 1.3) {
        z.bite = 2.4; const dx = p.x - z.x, dz = p.z - z.z, d = Math.hypot(dx, dz) || 1;
        sim.sys('vitals')?.damage(p.id, 18);
        sim.fx({ k: 'knock', to: p.id, dx: dx / d, dz: dz / d, power: 7 }); sim.fx({ k: 'float', x: p.x, z: p.z, y: 3, text: '🧟 Bị cắn!', color: '#9be26b' }); sim.fx({ k: 'sfx', name: 'zombie', x: p.x, z: p.z }); sim.toast(p.id, '🧟 Zombie cắn bạn! Đánh nó bằng dép (phím 6) hoặc chạy vào nhà ngủ', 'warn'); sim.game({ type: 'bitten', pid: p.id });
      }
      const r = Math.hypot(z.x, z.z); if (r > WORLD.R + 6) { z.x *= (WORLD.R + 6) / r; z.z *= (WORLD.R + 6) / r; }
    }
  }
  step(z, dt, sp, tx, tz) { const dx = tx - z.x, dz = tz - z.z, d = Math.hypot(dx, dz); if (d < 0.2) return; const s = Math.min(d, sp * dt); z.x += (dx / d) * s; z.z += (dz / d) * s; z.r = Math.atan2(dx, dz); }
  choose(z, players, scares) {
    const { sim } = this, st = sim.st, near = players.map((p) => ({ p, d: dist(p.x, p.z, z.x, z.z) })).sort((a, b) => a.d - b.d)[0];
    if (near && near.d < 9) { z.tk = 'player'; z.tid = near.p.id; return; }
    let best = null, bd = 1e9;
    for (const c of Object.values(st.crops)) {
      if (!c.crop) continue; const p = plotPos(c.r, c.c); if (scares.some((f) => dist(f.x, f.z, p.x, p.z) < 6)) continue;
      const d = dist(z.x, z.z, p.x, p.z) - (c.s === 'ripe' ? 12 : 0); if (d < bd) { bd = d; best = c; }
    }
    if (best) { z.tk = 'crop'; z.tid = best.id; } else { z.tk = ''; z.wx = z.x + sim.rng.range(-8, 8); z.wz = z.z + sim.rng.range(-8, 8); }
  }
  eat(z) {
    const { sim } = this, c = sim.st.crops[z.tid];
    if (c && c.crop) {
      const p = plotPos(c.r, c.c), name = CROPS[c.crop].name;
      if (CROPS[c.crop].regrow) { c.g = 0.15; c.s = 'planted'; } else { c.s = 'tilled'; delete c.crop; c.g = 0; delete c.fast; }
      c.by = []; sim.touch('crops.' + c.id); sim.fx({ k: 'burst', kind: 'leaf', x: p.x, z: p.z, y: 0.8, n: 10 }); sim.fx({ k: 'float', x: p.x, z: p.z, y: 2.4, text: '🧟 Ăm! mất cây', color: '#9be26b' }); sim.fx({ k: 'sfx', name: 'munch', x: p.x, z: p.z });
      if (this.msgT <= 0) { this.msgT = 25; sim.toast(undefined, `🧟 Zombie đang ăn ${name}! Đuổi nó đi hoặc đặt bù nhìn 🧟`, 'warn'); }
      sim.game({ type: 'zombie_ate', plot: c.id });
    }
    z.st = 'walk'; z.tk = ''; z.think = 0; sim.touch('zombies.' + z.id);
  }
  hit(z, pid, w, dir) {
    const { sim } = this; if (!ALIVE(z)) return;
    z.hp -= w.dmg || 1; z.kb = { vx: dir.dx * w.knock * 2.4, vz: dir.dz * w.knock * 2.4, life: 0.3 }; z.st = 'stun'; z.timer = w.stun * 0.8;
    sim.fx({ k: 'burst', kind: 'stars', x: z.x, z: z.z, y: 1.8, n: 8 }); sim.fx({ k: 'float', x: z.x, z: z.z, y: 2.8, text: sim.rng.pick(['BỐP!', 'CHÁT!', 'ÚI!']), color: '#ffe066' }); sim.fx({ k: 'sfx', name: w.sfx || 'bonk', x: z.x, z: z.z }); sim.fx({ k: 'shake', amt: 0.2, to: pid });
    if (z.hp <= 0) {
      z.st = 'dead'; z.timer = 1.6; const coins = 12 + sim.st.farm.level * 3; sim.sys('economy').earn(pid, coins); sim.sys('prog').addXp(pid, 8);
      sim.fx({ k: 'float', x: z.x, z: z.z, y: 3.4, text: `+${coins} 🪙`, color: '#ffc02e', to: pid }); sim.fx({ k: 'burst', kind: 'smoke', x: z.x, z: z.z, y: 1, n: 10 }); sim.game({ type: 'zombie_down', pid });
    }
    sim.touch('zombies.' + z.id);
  }
}
