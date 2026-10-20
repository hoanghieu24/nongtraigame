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
    this.acc += dt; if (this.acc >= 1) { this.acc = 0; this.sim.sys('quest')?.refreshCalendar(); this.sim.touch('world'); }
  }
  // Chỉ cho phép ngủ vào buổi tối (từ 18:00 đến 05:30 sáng) hoặc khi trời đang mưa / giông bão
  sleep(pid) {
    const { sim } = this, st = sim.st, p = st.players[pid], h = sim.ti.hour, wx = st.world.weather;
    const canSleep = h >= 18 || h < 5.5 || wx === 'rain' || wx === 'storm';
    if (!canSleep) return fail('Chỉ có thể đi ngủ vào buổi tối (từ 18:00) hoặc khi trời đang mưa! 🌙🌧️');
    const me = sim.pos(pid);
    const bed = Object.values(st.furniture).find((f) => f.item === 'bed' && f.area === 'house' && dist(INTERIOR.ox + f.x, INTERIOR.oz + f.z, me.x, me.z) < 4.8)
      || Object.values(st.furniture).find((f) => f.item === 'bed' && f.area === 'house');
    if (!bed) return fail('Cần có giường trong nhà để ngủ 🛏️');
    p.sleeping = true; p.bed = { x: bed.x, z: bed.z };
    sim.setPose(pid, { area: 'house', x: INTERIOR.ox + bed.x, z: INTERIOR.oz + bed.z + 0.72, anim: 'sleep' });
    sim.touch('players.' + pid); sim.fx({ k: 'sfx', name: 'sad', to: pid });
    const active = sim.connected();
    const sleepingCount = active.filter((x) => x.sleeping).length;
    if (sleepingCount < active.length) {
      sim.toast(undefined, `😴 ${p.name} đã lên giường ngủ (${sleepingCount}/${active.length} người đang ngủ) — hãy vào nhà lên giường để cùng qua đêm nhé! 🌙`, 'good');
    }
    this.checkSkip(); return ok();
  }
  wake(pid) { const p = this.sim.st.players[pid]; if (p?.sleeping) { p.sleeping = false; this.sim.touch('players.' + pid); } return ok(); }
  checkSkip() { const c = this.sim.connected(); if (c.length && c.every((p) => p.sleeping)) this.skipNight(); }
  skipNight() {
    const { sim } = this, st = sim.st, w = st.world, h = timeInfo(w.t, CFG).hour; let dh = 6 - h; if (dh <= 0) dh += 24;
    w.t += (dh / 24) * CFG.DAY_SECONDS;
    for (const p of sim.connected()) {
      if (p.sleeping) sim.sys('vitals')?.sleepRecovery(p.id);
      p.sleeping = false; sim.touch('players.' + p.id);
    }
    for (const a of Object.values(st.animals)) if (a.type !== 'dog') a.hunger = Math.min(0.95, a.hunger + 0.08);
    st.zombies = {}; sim.touch('zombies'); w.weatherUntil = w.t; st.events.next = w.t + 70;
    w.sleepCycle = (w.sleepCycle || 0) + 1; sim.touch('world');
    sim.fx({ k: 'banner', text: '☀️ Chào buổi sáng!', sub: 'Cả nhà đã ngủ ngon giấc, ngày mới bắt đầu!', tone: 'good' }); sim.fx({ k: 'sfx', name: 'win' });
  }
}
