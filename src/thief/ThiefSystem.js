import { uid, dist, clamp } from '../core/util.js';
import { SPOTS, plotPos, WORLD } from '../data/layout.js';
import { CROPS } from '../data/crops.js';
import { ITEMS } from '../data/items.js';
import { fail, ok } from '../core/result.js';
import { addTo, takeFrom } from '../inventory/Inventory.js';

const ENTRIES = [{ x: -26.5, z: 3 }, { x: 0, z: -29 }, { x: 31, z: 15.5 }];
const NAMES = ['Tên Trộm Dép Lê', 'Đạo Chích Vụng Về', 'Kẻ Trộm Ngái Ngủ', 'Bác Trộm Bánh Mì'];
const BONK = ['BỐP!', 'CHÁT!', 'ÚI DA!', 'BỊCH!', 'CỐP!'];

// Trộm bot: lẻn vào → ăn trộm → bỏ chạy. Người chơi đuổi, đánh (choáng + đẩy lùi) rồi bắt.
export class ThiefSystem {
  constructor(sim) { this.sim = sim; this.id = 'thief'; this.cmds = { grab: (p, c) => this.grab(p, c) }; }
  active() { return Object.values(this.sim.st.thieves).filter((t) => t.st !== 'caught' && t.st !== 'escaped'); }

  spawn(n = 1) {
    const { sim } = this, st = sim.st, rng = sim.rng;
    const players = sim.connected().length, base = 2 + (players >= 3 ? 1 : 0) + (st.farm.level >= 6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const entry = rng.pick(ENTRIES), id = uid('t');
      const t = { id, name: rng.pick(NAMES), hp: base, maxHp: base, x: entry.x + i * 1.2, z: entry.z, r: 0, st: 'sneak', timer: 0, loot: {}, coins: 0, exit: entry, kind: 'junk', tx: 0, tz: 0 };
      this.pickTarget(t); st.thieves[id] = t; sim.touch('thieves.' + id);
    }
    sim.fx({ k: 'banner', text: '🚨 CÓ TRỘM VÀO FARM!!!', sub: 'Cầm dép lên! Đuổi theo, đánh cho choáng rồi bắt!', tone: 'alarm' });
    sim.fx({ k: 'sfx', name: 'alarm' }); sim.fx({ k: 'shake', amt: 0.4 });
    sim.game({ type: 'thief_spawn' });
  }
  pickTarget(t) {
    const { sim } = this, st = sim.st;
    const chestN = Object.values(st.inventory.chest).reduce((a, b) => a + b, 0);
    const ripe = Object.values(st.crops).filter((c) => c.s === 'ripe');
    const opts = [];
    if (chestN > 0) opts.push({ k: 'chest', w: 3, x: SPOTS.chest.x, z: SPOTS.chest.z });
    if (ripe.length) { const c = sim.rng.pick(ripe), p = plotPos(c.r, c.c); opts.push({ k: 'crops', w: 3, x: p.x, z: p.z }); }
    if (st.economy.fund >= 60) opts.push({ k: 'fund', w: 2, x: SPOTS.crate.x, z: SPOTS.crate.z });
    const o = opts.length ? sim.rng.weighted(opts, (q) => q.w) : { k: 'junk', x: SPOTS.crate.x, z: SPOTS.crate.z };
    t.kind = o.k; t.tx = o.x; t.tz = o.z;
  }
  step(t, dt, speed, tx, tz) {
    const dx = tx - t.x, dz = tz - t.z, d = Math.hypot(dx, dz);
    if (d < 0.35) return true;
    const s = Math.min(d, speed * dt); t.x += (dx / d) * s; t.z += (dz / d) * s; t.r = Math.atan2(dx, dz);
    return false;
  }
  doSteal(t) {
    const { sim } = this, st = sim.st; let got = false;
    if (t.kind === 'chest') {
      const ch = st.inventory.chest; let budget = 6;
      for (const id of Object.keys(ch).sort(() => sim.rng.next() - 0.5)) { if (budget <= 0) break; const n = Math.min(ch[id], budget); takeFrom(ch, id, n); addTo(t.loot, id, n); budget -= n; got = true; }
      if (got) sim.touch('inventory.chest');
    } else if (t.kind === 'crops') {
      let n = 0;
      for (const c of Object.values(st.crops)) if (c.s === 'ripe' && n < 4) {
        addTo(t.loot, c.crop, 1); n++;
        if (CROPS[c.crop].regrow) { c.s = 'planted'; c.g = 0.3; } else { c.s = 'tilled'; delete c.crop; c.g = 0; }
        sim.touch('crops.' + c.id);
      }
      got = n > 0;
    } else if (t.kind === 'fund') {
      const amt = Math.min(st.economy.fund, 80 + st.farm.level * 25);
      if (amt > 0) { st.economy.fund -= amt; t.coins = amt; sim.touch('economy'); got = true; }
    }
    if (!got) { t.kind = 'junk'; t.loot = {}; }
    t.st = 'flee'; t.dash = 0;
    sim.fx({ k: 'banner', text: '😱 Trộm đã chôm đồ và đang chạy trốn!', sub: 'Đuổi theo ngay!', tone: 'alarm' }); sim.fx({ k: 'sfx', name: 'alarm' });
    sim.touch('thieves.' + t.id);
  }
  tick(dt) {
    const { sim } = this, st = sim.st;
    for (const id in st.thieves) {
      const t = st.thieves[id]; t.timer -= dt;
      if (t.kb) { t.x += t.kb.vx * dt; t.z += t.kb.vz * dt; const f = Math.exp(-6 * dt); t.kb.vx *= f; t.kb.vz *= f; if ((t.kb.life -= dt) <= 0) t.kb = null; }
      switch (t.st) {
        case 'sneak': if (this.step(t, dt, 3.8, t.tx, t.tz)) { t.st = 'steal'; t.timer = 2.2; sim.touch('thieves.' + id); } break;
        case 'steal': if (t.timer <= 0) this.doSteal(t); break;
        case 'flee': {
          t.dash = (t.dash || 0) - dt; if (t.dash < -2.5 && sim.rng.chance(dt * 0.6)) t.dash = 0.8;       // thỉnh thoảng nước rút
          const sp = (t.kind === 'junk' ? 6.2 : 5.5) * (t.dash > 0 ? 1.35 : 1);
          if (this.step(t, dt, sp, t.exit.x, t.exit.z)) {
            t.st = 'escaped'; t.timer = 1.2; sim.touch('thieves.' + id);
            if (Object.keys(t.loot).length || t.coins) sim.toast(undefined, '😤 Trộm chạy thoát cùng đồ của cả nhà!', 'warn');
            else sim.toast(undefined, 'Trộm chạy mất rồi, lần sau nhớ canh chừng nhé!', 'info');
            sim.fx({ k: 'sfx', name: 'fail' });
          }
          break;
        }
        case 'stun': if (t.timer <= 0) { t.st = t.prev === 'steal' ? 'flee' : t.prev || 'flee'; t.dash = 0; sim.touch('thieves.' + id); } break;
        case 'caught': case 'escaped': if (t.timer <= 0) { delete st.thieves[id]; sim.touch('thieves.' + id); if (!this.active().length) sim.game({ type: 'thief_end' }); } break;
      }
      const r = Math.hypot(t.x, t.z); if (r > WORLD.R + 3) { t.x *= (WORLD.R + 3) / r; t.z *= (WORLD.R + 3) / r; }
    }
  }
  hit(t, pid, w, dir) {
    const { sim } = this;
    if (t.st === 'caught' || t.st === 'escaped') return;
    t.hp -= w.dmg || 0;
    t.kb = { vx: dir.dx * w.knock * 2.4, vz: dir.dz * w.knock * 2.4, life: 0.3 };
    if (t.st !== 'stun') t.prev = t.st === 'steal' ? 'flee' : t.st;
    t.st = 'stun'; t.timer = w.stun;
    sim.fx({ k: 'burst', kind: 'stars', x: t.x, z: t.z, y: 1.8, n: 10 }); sim.fx({ k: 'float', x: t.x, z: t.z, y: 2.8, text: sim.rng.pick(BONK), color: '#ffe066' });
    sim.fx({ k: 'sfx', name: w.sfx || 'bonk', x: t.x, z: t.z }); if (pid) sim.fx({ k: 'shake', amt: 0.25, to: pid });
    if (t.hp <= 0) this.catchThief(t, pid); else sim.touch('thieves.' + t.id);
  }
  dogBite(t) { if (t.st === 'flee' || t.st === 'sneak') this.hit(t, null, { dmg: 0, knock: 2.5, stun: 1.0, sfx: 'bark' }, { dx: Math.sin(t.r), dz: Math.cos(t.r) }); }
  grab(pid, { id }) {
    const t = this.sim.st.thieves[id];
    if (!t || t.st !== 'stun') return fail('Đánh cho choáng rồi mới bắt được!');
    if (!this.sim.near(pid, t.x, t.z, 3.4)) return fail('Lại gần hơn nữa!');
    this.catchThief(t, pid); return ok();
  }
  catchThief(t, pid) {
    const { sim } = this, st = sim.st;
    t.st = 'caught'; t.timer = 2.0; t.hp = 0;
    let k = 0;
    for (const [id, n] of Object.entries(t.loot)) sim.sys('items').drop(id, n, t.x + Math.cos(k * 2.1) * 1.6, t.z + Math.sin(k++ * 2.1) * 1.6);
    if (t.coins) { sim.sys('economy').toFund(t.coins); sim.fx({ k: 'float', x: t.x, z: t.z, y: 3.4, text: `+${t.coins} 🪙 quỹ`, color: '#ffc02e' }); }
    t.loot = {}; t.coins = 0;
    const reward = 50 + 20 * st.farm.level;
    if (pid) { sim.sys('economy').earn(pid, reward); st.players[pid].stats.chase++; sim.touch('players.' + pid); sim.toast(pid, `Bắt được trộm! Thưởng ${reward} 🪙`, 'good'); }
    for (const p of sim.connected()) sim.sys('prog').addXp(p.id, p.id === pid ? 35 : 12);
    sim.fx({ k: 'banner', text: '🎉 BẮT ĐƯỢC TRỘM!', sub: pid ? `${st.players[pid].name} là anh hùng nông trại!` : 'Cún Giữ Vườn ra tay!', tone: 'good' });
    sim.fx({ k: 'confetti' }); sim.fx({ k: 'sfx', name: 'win' }); sim.fx({ k: 'burst', kind: 'stars', x: t.x, z: t.z, y: 1.5, n: 20 });
    sim.game({ type: 'chase', pid, n: 1 });
    sim.touch('thieves.' + t.id);
  }
}
