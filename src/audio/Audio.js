// Âm thanh 100% procedural (không cần file): SFX + môi trường + nhạc nền lo-fi chill (đàn điện + bass + trống nhẹ + reverb).
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const CH_DAY = [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]];       // Cmaj7 Am7 Dm7 G7
const CH_NIGHT = [[57, 60, 64, 67, 71], [53, 57, 60, 64], [62, 65, 69, 72], [52, 56, 59, 62]];   // Am9 Fmaj7 Dm7 E7
const PENTA = [0, 2, 4, 7, 9];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.85, music: 0.5, sfx: 0.9 };
    this.listener = { x: 0, z: 0 };
    this.night = false;
    this.indoor = false;
    this.inK = 0;
    this.step = 0;
    this.birdT = 3;
    this.nextT = 0;
    this.musicOn = false;
    this.rain = 0;
    this.river = 0;
    this.lastSfx = {};
  }
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = (this.ctx = new AC());
    this.master = c.createGain(); const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master); this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    this.musicBus = c.createGain(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; this.musicBus.connect(lp); lp.connect(this.master);
    const rev = c.createConvolver(), len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; } rev.buffer = ir;
    const rg = c.createGain(); rg.gain.value = 0.38; lp.connect(rev); rev.connect(rg); rg.connect(this.master);
    const dl = c.createDelay(1); dl.delayTime.value = 0.43; const fb = c.createGain(); fb.gain.value = 0.32; const dg = c.createGain(); dg.gain.value = 0.22; lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(dg); dg.connect(this.master);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    this.loop = (hp, lpf) => {
      const s = c.createBufferSource(); s.buffer = nb; s.loop = true;
      const f1 = c.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp;
      const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lpf;
      const gn = c.createGain(); gn.gain.value = 0; gn.lp = f2; gn.hp = f1;
      s.connect(f1); f1.connect(f2); f2.connect(gn); gn.connect(this.ambBus); s.start(); return gn;
    };
    this.windG = this.loop(200, 800); this.riverG = this.loop(500, 2200); this.rainG = this.loop(1000, 5200);
    this.setVol(); this.startMusic();
    const resume = () => { if (c.state !== 'running') c.resume?.(); }; addEventListener('pointerdown', resume); addEventListener('keydown', resume); addEventListener('touchend', resume);
  }
  setVol(v) { if (v) Object.assign(this.vol, v); if (!this.ctx) return; this.master.gain.value = this.muted ? 0 : this.vol.master; this.sfxBus.gain.value = this.vol.sfx; this.musicBus.gain.value = this.vol.music * 0.42; this.ambBus.gain.value = this.vol.sfx * 0.85; }
  // ---------- nguyên liệu âm ----------
  tone(f, dur, o = {}) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + (o.delay || 0), osc = c.createOscillator(), g = c.createGain(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t); if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f + o.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime((o.vol ?? 0.25) * (o.gain || 1), t + (o.attack ?? 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = osc; if (o.lp) { const f1 = c.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = o.lp; osc.connect(f1); n = f1; } n.connect(g);
    let out = g; if (o.pan) { const p = c.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; } out.connect(o.bus || this.sfxBus); osc.start(t); osc.stop(t + dur + 0.05);
  }
  noise(dur, o = {}) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + (o.delay || 0), s = c.createBufferSource(); s.buffer = this.noiseBuf; const g = c.createGain(); g.gain.setValueAtTime((o.vol ?? 0.2) * (o.gain || 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = s; if (o.hp) { const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; n.connect(f); n = f; } if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; n.connect(f); n = f; } n.connect(g); g.connect(o.bus || this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // ---------- SFX ----------
  sfx(name, x, z) {
    if (!this.ctx || this.vol.sfx <= 0) return; const fn = SFX[name]; if (!fn) return; const now = this.ctx.currentTime; if (this.lastSfx[name] && now - this.lastSfx[name] < 0.05) return; this.lastSfx[name] = now;
    let g = 1; if (x !== undefined) { const d = Math.hypot(x - this.listener.x, z - this.listener.z); g = Math.max(0, 1 - d / 42); if (g < 0.04) return; }
    fn(this, g);
  }
  // ---------- nhạc nền ----------
  startMusic() { if (this.musicOn || !this.ctx) return; this.musicOn = true; this.nextT = this.ctx.currentTime + 0.3; this.step = 0; this.timer = setInterval(() => this.schedule(), 140); }
  schedule() {
    const c = this.ctx; if (!c) return; const spb = 60 / (this.night ? 64 : 74), st = spb / 2;
    while (this.nextT < c.currentTime + 0.6) { this.beat(this.step, this.nextT, spb); this.nextT += st; this.step++; }
  }
  beat(n, t, spb) {
    const c = this.ctx, i = n % 8, bar = Math.floor(n / 8) % 4, chord = (this.night ? CH_NIGHT : CH_DAY)[bar], M = this.musicBus, d = t - c.currentTime, swing = i % 2 ? spb * 0.07 : 0;
    if (i === 0) {
      chord.forEach((m, k) => { const f = mtof(m - 12); for (const [ty, det, v] of [['triangle', 0, 0.1], ['sine', 3, 0.09]]) this.tone(f * 2 ** (det / 1200), spb * 3.6, { type: ty, vol: v, attack: 0.05 + k * 0.012, bus: M, delay: d + k * 0.035, lp: 1800 }); });
      this.tone(mtof(chord[0] - 24), spb * 1.6, { type: 'sine', vol: 0.26, bus: M, delay: d, attack: 0.02 });
    }
    if (i === 4) this.tone(mtof(chord[0] - 24 + (bar === 3 ? 7 : 0)), spb * 1.2, { type: 'sine', vol: 0.2, bus: M, delay: d, attack: 0.02 });
    if (i === 0 || i === 5) { this.tone(130, 0.22, { type: 'sine', vol: 0.34, slide: -85, bus: M, delay: d }); }
    if (i === 4) this.noise(0.16, { vol: 0.07, hp: 1400, lp: 4200, bus: M, delay: d + swing });
    if (!this.night || i % 2 === 0) this.noise(0.04, { vol: this.night ? 0.012 : 0.022, hp: 7000, bus: M, delay: d + swing });
    if (i !== 0 && Math.random() < (this.night ? 0.2 : 0.3)) {
      const root = chord[0] % 12, deg = PENTA[(Math.random() * 5) | 0], oct = 5 + (Math.random() < 0.35 ? 1 : 0), m = 12 * oct + ((root + deg) % 12), f = mtof(m);
      this.tone(f, 1.4, { type: 'triangle', vol: 0.11, bus: M, delay: d + swing, attack: 0.012, pan: (Math.random() - 0.5) * 0.7 }); this.tone(f * 2, 0.5, { type: 'sine', vol: 0.03, bus: M, delay: d + swing });
    }
  }
  // ---------- môi trường (gọi mỗi frame) ----------
  tick(dt, { hour, rain, river, night, wind, indoor = false }) {
    if (!this.ctx || !this.windG) return;
    this.night = night;
    this.indoor = !!indoor;
    const k = 1 - Math.exp(-dt * 4), ik = 1 - Math.exp(-dt * 12);
    this.inK += ((indoor ? 1 : 0) - this.inK) * ik;
    this.rain += ((rain && !indoor ? 1 : 0) - this.rain) * k;
    this.river += ((indoor ? 0 : river) - this.river) * k;
    // Khi vào trong nhà (indoor = true): tắt 100% tiếng mưa, tiếng gió, tiếng suối và mọi tạp âm nền!
    const outFactor = indoor ? 0 : Math.max(0, 1 - this.inK);
    this.windG.gain.value = (wind ? 0.045 : 0) * outFactor;
    this.riverG.gain.value = this.river * 0.11 * outFactor;
    this.rainG.gain.value = this.rain * 0.16 * outFactor;
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = 2.5 + Math.random() * 6; const f = 2400 + Math.random() * 1600;
      if (!indoor && !night && !rain) { for (let i = 0; i < 2 + ((Math.random() * 3) | 0); i++) this.tone(f + Math.random() * 400, 0.09, { type: 'sine', vol: 0.05, slide: 700, delay: i * 0.13, bus: this.ambBus, pan: Math.random() - 0.5 }); }
      else if (!indoor && night && !rain) { for (let i = 0; i < 5; i++) this.tone(4300, 0.05, { type: 'sine', vol: 0.025, delay: i * 0.09, bus: this.ambBus }); }
    }
  }
  step_() {
    if (this.indoor) this.tone(145, 0.05, { type: 'triangle', vol: 0.07, slide: -40, lp: 420 });
    else this.noise(0.06, { vol: 0.07, lp: 650, hp: 120 });
  }
}
const SFX = {
  click: (a, g) => a.tone(700, 0.06, { type: 'triangle', vol: 0.13 * g }),
  pop: (a, g) => a.tone(500, 0.1, { slide: 380, vol: 0.2 * g }),
  door: (a, g) => { a.tone(240, 0.12, { type: 'triangle', slide: 80, vol: 0.16 * g, lp: 900 }); },
  till: (a, g) => { a.noise(0.16, { vol: 0.32 * g, lp: 700 }); a.tone(120, 0.14, { type: 'triangle', vol: 0.3 * g, slide: -50 }); },
  water: (a, g) => a.noise(0.4, { vol: 0.2 * g, hp: 1600, lp: 5200 }),
  plant: (a, g) => { a.noise(0.1, { vol: 0.2 * g, lp: 900 }); a.tone(300, 0.1, { slide: 200, vol: 0.12 * g }); },
  harvest: (a, g) => { a.noise(0.12, { vol: 0.2 * g, lp: 1000 }); [520, 660, 880].forEach((f, i) => a.tone(f, 0.14, { delay: 0.03 + i * 0.06, vol: 0.16 * g, type: 'triangle' })); },
  ripe: (a, g) => a.tone(1320, 0.18, { vol: 0.07 * g, type: 'sine' }),
  coin: (a, g) => { a.tone(988, 0.08, { type: 'square', vol: 0.08 * g }); a.tone(1319, 0.2, { type: 'square', vol: 0.08 * g, delay: 0.07 }); },
  buy: (a, g) => { a.tone(660, 0.08, { type: 'triangle', vol: 0.16 * g }); a.tone(880, 0.1, { delay: 0.07, type: 'triangle', vol: 0.16 * g }); a.tone(1175, 0.18, { delay: 0.14, type: 'triangle', vol: 0.16 * g }); },
  place: (a, g) => { a.noise(0.08, { vol: 0.22 * g, lp: 500 }); a.tone(180, 0.12, { type: 'triangle', slide: -60, vol: 0.25 * g }); },
  munch: (a, g) => { for (let i = 0; i < 3; i++) a.noise(0.06, { vol: 0.16 * g, delay: i * 0.1, hp: 300, lp: 1800 }); },
  ding: (a, g) => a.tone(1568, 0.5, { vol: 0.12 * g }), bell: (a, g) => { a.tone(1046, 0.6, { vol: 0.14 * g }); a.tone(1568, 0.5, { vol: 0.08 * g, delay: 0.02 }); },
  sizzle: (a, g) => a.noise(0.8, { vol: 0.1 * g, hp: 3000 }),
  swish: (a, g) => a.noise(0.14, { vol: 0.16 * g, hp: 900, lp: 5000 }),
  bonk: (a, g) => { a.tone(240, 0.16, { type: 'square', slide: -150, vol: 0.28 * g }); a.noise(0.08, { vol: 0.2 * g, lp: 1200 }); },
  clang: (a, g) => { a.tone(740, 0.3, { type: 'square', vol: 0.12 * g }); a.tone(1100, 0.25, { vol: 0.1 * g }); a.noise(0.05, { vol: 0.2 * g, hp: 2000 }); },
  slap: (a, g) => { a.noise(0.1, { vol: 0.3 * g, hp: 700, lp: 3000 }); a.tone(300, 0.08, { vol: 0.15 * g, slide: -200 }); }, splat: (a, g) => a.noise(0.2, { vol: 0.25 * g, lp: 1500 }),
  boing: (a, g) => a.tone(260, 0.34, { type: 'sine', slide: 380, vol: 0.28 * g, attack: 0.01 }),
  alarm: (a, g) => { for (let i = 0; i < 4; i++) { a.tone(880, 0.16, { type: 'square', vol: 0.1 * g, delay: i * 0.34 }); a.tone(660, 0.16, { type: 'square', vol: 0.1 * g, delay: i * 0.34 + 0.17 }); } },
  win: (a, g) => [523, 659, 784, 1046].forEach((f, i) => a.tone(f, 0.22, { type: 'triangle', delay: i * 0.1, vol: 0.18 * g })),
  fail: (a, g) => { a.tone(300, 0.25, { type: 'sawtooth', slide: -120, vol: 0.12 * g, lp: 1200 }); a.tone(220, 0.35, { type: 'sawtooth', slide: -100, vol: 0.12 * g, delay: 0.18, lp: 1200 }); },
  sad: (a, g) => { a.tone(392, 0.4, { type: 'triangle', vol: 0.16 * g }); a.tone(330, 0.4, { type: 'triangle', vol: 0.16 * g, delay: 0.3 }); a.tone(262, 0.7, { type: 'triangle', vol: 0.16 * g, delay: 0.6 }); },
  levelup: (a, g) => [392, 523, 659, 784, 1046].forEach((f, i) => a.tone(f, 0.3, { type: 'triangle', delay: i * 0.11, vol: 0.18 * g })),
  fanfare: (a, g) => { [523, 523, 659, 784, 1046].forEach((f, i) => a.tone(f, 0.28, { type: 'square', delay: i * 0.13, vol: 0.09 * g })); },
  quest: (a, g) => [659, 784, 988, 1319].forEach((f, i) => a.tone(f, 0.2, { delay: i * 0.08, vol: 0.15 * g, type: 'triangle' })),
  event: (a, g) => { a.tone(523, 0.16, { type: 'triangle', vol: 0.15 * g }); a.tone(784, 0.3, { type: 'triangle', delay: 0.14, vol: 0.15 * g }); },
  cast: (a, g) => { a.noise(0.25, { vol: 0.14 * g, hp: 1200 }); a.tone(600, 0.25, { slide: -350, vol: 0.1 * g }); }, bite: (a, g) => { a.tone(1200, 0.1, { vol: 0.2 * g, type: 'square' }); a.tone(1500, 0.14, { vol: 0.2 * g, type: 'square', delay: 0.1 }); },
  catch: (a, g) => { a.noise(0.2, { vol: 0.25 * g, hp: 800 }); [660, 880].forEach((f, i) => a.tone(f, 0.15, { delay: 0.1 + i * 0.09, vol: 0.16 * g })); },
  ufo: (a, g) => { a.tone(300, 2.2, { type: 'sine', slide: 500, vol: 0.12 * g, attack: 0.5 }); a.tone(310, 2.2, { type: 'sine', slide: 480, vol: 0.1 * g, attack: 0.5 }); },
  meteor: (a, g) => a.tone(1800, 3.6, { type: 'sine', slide: -1500, vol: 0.12 * g, attack: 0.3 }), boom: (a, g) => { a.noise(0.8, { vol: 0.5 * g, lp: 500 }); a.tone(70, 0.8, { vol: 0.5 * g, slide: -40 }); },
  bark: (a, g) => { a.tone(420, 0.1, { type: 'sawtooth', slide: -150, vol: 0.2 * g, lp: 1400 }); a.tone(380, 0.12, { type: 'sawtooth', slide: -140, vol: 0.2 * g, delay: 0.16, lp: 1400 }); },
  chicken: (a, g) => { for (let i = 0; i < 4; i++) a.tone(900 + Math.random() * 300, 0.07, { type: 'square', slide: 200, vol: 0.06 * g, delay: i * 0.09, lp: 3000 }); },
  duck: (a, g) => { for (let i = 0; i < 2; i++) a.tone(480, 0.14, { type: 'sawtooth', slide: -120, vol: 0.09 * g, delay: i * 0.18, lp: 1500 }); },
  rabbit: (a, g) => a.tone(1500, 0.05, { vol: 0.06 * g }), cat: (a, g) => a.tone(700, 0.4, { type: 'triangle', slide: -220, vol: 0.14 * g }),
  cow: (a, g) => { a.tone(150, 0.7, { type: 'sawtooth', slide: -45, vol: 0.18 * g, lp: 700, attack: 0.1 }); }, pig: (a, g) => { a.tone(200, 0.2, { type: 'sawtooth', slide: -60, vol: 0.14 * g, lp: 900 }); a.tone(180, 0.2, { type: 'sawtooth', slide: -50, vol: 0.14 * g, lp: 900, delay: 0.22 }); },
  sheep: (a, g) => { a.tone(480, 0.5, { type: 'sawtooth', slide: 40, vol: 0.1 * g, lp: 1500 }); }, goat: (a, g) => { a.tone(560, 0.5, { type: 'sawtooth', slide: -60, vol: 0.11 * g, lp: 1800 }); },
  dog: (a, g) => SFX.bark(a, g),
  zombie: (a, g) => { a.tone(95, 0.9, { type: 'sawtooth', slide: -35, vol: 0.2 * g, lp: 420, attack: 0.15 }); a.tone(112, 0.8, { type: 'sawtooth', slide: -40, vol: 0.12 * g, lp: 380, delay: 0.12, attack: 0.15 }); },
  thunder: (a, g) => { if (a.indoor) return; a.noise(1.8, { vol: 0.5 * g, lp: 260 }); a.tone(55, 1.6, { vol: 0.4 * g, slide: -20 }); },
};
