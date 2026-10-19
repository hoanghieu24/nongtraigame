import { WEATHER, WEATHER_TABLE } from '../data/weather.js';
// Thời tiết đầy đủ theo mùa: nắng, nhiều mây, mưa, giông (sấm sét), sương mù, tuyết.
export class WeatherSystem {
  constructor(sim) { this.sim = sim; this.id = 'weather'; this.cmds = {}; this.bolt = 6; }
  set(type, dur, quiet = false) {
    const { sim } = this, w = sim.st.world;
    if (w.weather !== type) { w.weather = type; if (!quiet && WEATHER[type].msg) sim.toast(undefined, WEATHER[type].msg, 'info'); }
    w.weatherUntil = w.t + dur; sim.touch('world');
  }
  roll() { const { sim } = this; const tab = WEATHER_TABLE[sim.ti.season] || WEATHER_TABLE[0]; this.set(sim.rng.weighted(tab, (x) => x[1])[0], sim.rng.range(170, 340)); }
  tick(dt) {
    const { sim } = this, w = sim.st.world;
    if (w.t >= w.weatherUntil) this.roll();
    if (w.weather === 'storm' && (this.bolt -= dt) <= 0) { this.bolt = sim.rng.range(5, 14); sim.fx({ k: 'lightning' }); }
  }
}
