import { EVENTS, EVENT_GAP } from '../data/events.js';
import { buildableOutdoor, SPOTS } from '../data/layout.js';
import { ANIMALS } from '../data/animals.js';
import { uid } from '../core/util.js';
import { fail, ok } from '../core/result.js';

const HEAVY = ['thief', 'chicken_party', 'fishing_contest'];
// Sự kiện ngẫu nhiên: UFO, Tiệc Gà, Mưa, Thú Vàng, Thương Nhân, Thiên Thạch, Trộm, Thi Câu Cá.
export class EventSystem {
  constructor(sim) {
    this.sim = sim; this.id = 'event';
    this.cmds = { debug: (p, c) => this.debug(p, c) };
    sim.bus.on('game', (e) => { if (e.type === 'fish') this.onFish(e); });
  }
  debug(pid, { ev: type }) {
    const { sim } = this; if (pid !== sim.st.meta.hostId) return fail('Chỉ chủ nông trại mới thử sự kiện');
    if (!EVENTS[type]) return fail('Sự kiện không tồn tại');
    this.start(type, true); return ok();
  }
  roll() {
    const { sim } = this, st = sim.st, lvl = st.farm.level, ev = st.events;
    const has = (k) => ev.active.some((e) => e.type === k);
    const busyHeavy = ev.active.some((e) => HEAVY.includes(e.type));
    const hasChicken = Object.values(st.animals).some((a) => a.type === 'chicken'), hasAnimal = Object.values(st.animals).some((a) => a.type !== 'dog');
    const pool = Object.keys(EVENTS).filter((k) => {
      const d = EVENTS[k]; if (d.minLvl > lvl || has(k)) return false;
      if (HEAVY.includes(k) && busyHeavy) return false;
      if (d.needs === 'chicken' && !hasChicken) return false; if (d.needs === 'animal' && !hasAnimal) return false;
      if (k === 'rain' && ['rain', 'storm', 'snow'].includes(st.world.weather)) return false;
      return true;
    });
    if (pool.length) this.start(sim.rng.weighted(pool, (k) => EVENTS[k].weight));
  }
  start(type, force = false) {
    const { sim } = this, st = sim.st, rng = sim.rng, d = EVENTS[type], t = st.world.t;
    const dur = Array.isArray(d.dur) ? rng.range(d.dur[0], d.dur[1]) : d.dur;
    const e = { id: uid('e'), type, t0: t, until: t + dur };
    const banner = (tone = 'event') => sim.fx({ k: 'banner', text: `${d.icon} ${d.banner}`, sub: d.name, tone });
    switch (type) {
      case 'rain': sim.sys('weather').set(sim.ti.season === 3 ? 'snow' : sim.ti.season === 1 && rng.chance(0.45) ? 'storm' : 'rain', dur, true); banner(); sim.fx({ k: 'sfx', name: 'event' }); break;
      case 'ufo': e.y0 = rng.range(-18, 8); e.y1 = rng.range(-18, 8); e.gift = false; banner(); sim.fx({ k: 'sfx', name: 'ufo' }); break;
      case 'chicken_party': st.events.party = { until: e.until, scores: {} }; banner(); sim.fx({ k: 'sfx', name: 'event' }); sim.fx({ k: 'sfx', name: 'chicken' }); break;
      case 'golden_animal': {
        const list = Object.values(st.animals).filter((a) => a.type !== 'dog' && a.area === 'out'); const a = rng.pick(list); if (!a) return;
        a.golden = true; a._goldenUntil = e.until; a.ready = !!ANIMALS[a.type].prod; e.animal = a.id; sim.touch('animals.' + a.id);
        sim.fx({ k: 'banner', text: `✨ ${a.name} biến thành VÀNG!`, sub: 'Thu sản phẩm nhanh để nhận gấp ba!', tone: 'event' }); sim.fx({ k: 'sfx', name: 'event' }); break;
      }
      case 'merchant': banner(); sim.fx({ k: 'sfx', name: 'event' }); break;
      case 'meteor': {
        let x = 0, z = 0; for (let i = 0; i < 40; i++) { x = rng.range(-20, 32); z = rng.range(-24, 20); if (buildableOutdoor(x, z, 8)) break; }
        e.x = x; e.z = z; e.impact = t + 4.4; e.landed = false; banner(); sim.fx({ k: 'sfx', name: 'meteor' }); break;
      }
      case 'thief': sim.sys('thief').spawn(sim.rng.chance(0.25) && st.farm.level >= 5 ? 2 : 1); break;
      case 'fishing_contest': st.events.contest = { until: e.until, scores: {} }; banner(); sim.fx({ k: 'sfx', name: 'event' }); break;
    }
    st.events.active.push(e); sim.touch('events'); sim.game({ type: 'event_start', ev: type });
  }
  end(e) {
    const { sim } = this, st = sim.st, ev = st.events;
    ev.active = ev.active.filter((x) => x !== e); sim.touch('events');
    if (e.type === 'rain') { st.world.weatherUntil = st.world.t; sim.touch('world'); }
    if (e.type === 'merchant') sim.toast(undefined, '🧳 Thương nhân đã rời đi, hẹn gặp lại!', 'info');
    if (e.type === 'chicken_party') { this.results(ev.party, 'Tiệc Gà', 'gà'); ev.party = null; }
    if (e.type === 'fishing_contest') { this.results(ev.contest, 'Thi Câu Cá', 'điểm'); ev.contest = null; }
    sim.touch('events');
  }
  results(c, name, unit) {
    const { sim } = this, st = sim.st, rank = Object.entries(c?.scores || {}).sort((a, b) => b[1] - a[1]);
    if (!rank.length) { sim.toast(undefined, `${name} kết thúc. Chưa ai ghi điểm — thua cuộc là cả nhà 😆`, 'info'); return; }
    const [wid, score] = rank[0], w = st.players[wid];
    if (w) { sim.sys('economy').earn(wid, 120 + st.farm.level * 20); sim.sys('prog').addXp(wid, 40); }
    for (const [pid] of rank) { sim.sys('prog').addXp(pid, 15); if (pid !== wid) sim.sys('economy').earn(pid, 40, { bonus: false }); }
    sim.fx({ k: 'banner', text: `🏆 ${w?.name || '???'} thắng ${name}!`, sub: rank.map(([p, s]) => `${st.players[p]?.name}: ${s} ${unit}`).join('  •  '), tone: 'level' }); sim.fx({ k: 'confetti' }); sim.fx({ k: 'sfx', name: 'fanfare' });
  }
  onFish(e) {
    const c = this.sim.st.events.contest; if (!c || this.sim.st.world.t > c.until) return;
    c.scores[e.pid] = (c.scores[e.pid] || 0) + e.value; this.sim.touch('events');
  }
  tick(dt) {
    const { sim } = this, st = sim.st, ev = st.events, t = st.world.t;
    for (const e of [...ev.active]) {
      if (e.type === 'thief') { if (t > e.t0 + 3 && !sim.sys('thief').active().length) this.end(e); continue; }
      if (t >= e.until) { this.end(e); continue; }
      if (e.type === 'ufo' && !e.gift && t > e.t0 + 8) {
        e.gift = true; sim.touch('events');
        const gx = sim.rng.range(-12, 8), gz = sim.rng.range(-6, 14);
        sim.sys('items').drop('alien_gift', 1, gx, gz, 300); if (sim.rng.chance(0.4)) sim.sys('items').drop('seed_moonberry', 2, gx + 1.4, gz + 0.8, 300);
        sim.fx({ k: 'banner', text: '🎁 UFO thả quà xuống ruộng!', sub: 'Chạy ra nhặt đi!', tone: 'event' });
      }
      if (e.type === 'meteor' && !e.landed && t >= e.impact) {
        e.landed = true; sim.touch('events');
        const n = 3 + sim.rng.int(0, 2);
        for (let i = 0; i < n; i++) sim.sys('items').drop('stardust', 1, e.x + Math.cos(i * 1.9) * 2.2, e.z + Math.sin(i * 1.9) * 2.2, 150);
        if (sim.rng.chance(0.5)) sim.sys('items').drop('seed_starfruit', 1, e.x, e.z + 0.6, 150);
        sim.fx({ k: 'burst', kind: 'stars', x: e.x, z: e.z, y: 1, n: 28 }); sim.fx({ k: 'shake', amt: 0.6 }); sim.fx({ k: 'sfx', name: 'boom', x: e.x, z: e.z });
        sim.fx({ k: 'banner', text: '☄️ Thiên thạch đã rơi!', sub: 'Chạy tới nhặt Bụi Sao & hạt Khế Sao Băng', tone: 'event' });
      }
    }
    if (t >= ev.next && sim.connected().length) { this.roll(); ev.next = t + sim.rng.range(EVENT_GAP[0], EVENT_GAP[1]); sim.touch('events'); }
  }
}
