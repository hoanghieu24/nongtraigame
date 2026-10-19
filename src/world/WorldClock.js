import { CFG } from '../core/Config.js';
import { timeInfo, dist } from '../core/util.js';
import { INTERIOR } from '../data/layout.js';
import { fail, ok } from '../core/result.js';
export class ClockSystem {
  constructor(sim) { this.sim = sim; this.id = 'clock'; this.acc = 0; this.cmds = { sleep: (p, c) => this.sleep(p, c), wake: (p) => this.wake(p) }; }
  tick(dt) {
    const st = this.sim.st, w = st.world;
    w.t += dt; st.meta.playTime += dt;
    const ti = timeInfo(w.t, CFG);
    if (ti.day !== w.day) { w.day = ti.day; w.season = ti.season; this.sim.newDay(); this.sim.touch('world'); }
    this.acc += dt; if (this.acc >= 1) { this.acc = 0; this.sim.touch('world'); }
  }
  // Chỉ cho phép ngủ vào buổi tối (từ 18:00 đến 05:30 sáng) hoặc khi trời đang mưa / giông bão
  sleep(pid) {
    const { sim } = this, st = sim.st, p = st.players[pid], h = sim.ti.hour, wx = st.world.weather;
    const canSleep = h >= 18 || h < 5.5 || wx === 'rain' || wx === 'storm';
    if (!canSleep) return fail('Chỉ có thể đi ngủ vào buổi tối (từ 18:00) hoặc khi trời đang mưa! 🌙🌧️');
    const me = sim.pos(pid); if (me.area !== 'house') return fail('Vào nhà, lại gần giường để ngủ 🛏️');
    const bed = Object.values(st.furniture).find((f) => f.item === 'bed' && f.area === 'house' && dist(INTERIOR.ox + f.x, INTERIOR.oz + f.z, me.x, me.z) < 3.8);
    if (!bed) return fail('Lại gần giường để ngủ 🛏️ (mua giường ở 🔨 nếu chưa có)');
    p.sleeping = true; p.bed = { x: bed.x, z: bed.z }; sim.touch('players.' + pid); sim.fx({ k: 'sfx', name: 'sad', to: pid });
    sim.toast(undefined, `😴 ${p.name} đã lên giường đi ngủ`, 'info'); this.checkSkip(); return ok();
  }
  wake(pid) { const p = this.sim.st.players[pid]; if (p?.sleeping) { p.sleeping = false; this.sim.touch('players.' + pid); } return ok(); }
  checkSkip() { const c = this.sim.connected(); if (c.length && c.every((p) => p.sleeping)) this.skipNight(); }
  skipNight() {
    const { sim } = this, st = sim.st, w = st.world, h = timeInfo(w.t, CFG).hour; let dh = 6 - h; if (dh <= 0) dh += 24;
    w.t += (dh / 24) * CFG.DAY_SECONDS;
    for (const p of sim.connected()) { p.sleeping = false; sim.touch('players.' + p.id); }
    for (const a of Object.values(st.animals)) if (a.type !== 'dog') a.hunger = Math.min(0.95, a.hunger + 0.08);
    st.zombies = {}; sim.touch('zombies'); w.weatherUntil = w.t; st.events.next = w.t + 70; sim.touch('world');
    sim.fx({ k: 'banner', text: '☀️ Chào buổi sáng!', sub: 'Ngủ ngon chứ? Ngày mới bắt đầu rồi', tone: 'good' }); sim.fx({ k: 'sfx', name: 'win' });
  }
}
