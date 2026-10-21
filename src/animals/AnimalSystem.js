import { ANIMALS, STARVE } from '../data/animals.js';
import { ITEMS } from '../data/items.js';
import { PENS, HOUSE, INTERIOR, interiorRoom } from '../data/layout.js';
import { uid, dist, clamp } from '../core/util.js';
import { CFG } from '../core/Config.js';
import { fail, ok } from '../core/result.js';
import { takeFrom } from '../inventory/Inventory.js';

const FARM_BOX = { x0: -23, x1: 35, z0: -27, z1: 11 };
// Thời gian ấp nở 1 quả trứng thành gà con / vịt con (40 giây)
export const INCUBATE_SECONDS = 40;

// Vật nuôi có "tính cách": gà đẻ trứng -> ấp trứng -> nở gà con, heo lăn bùn, dê húc người, bò nhìn camera, vịt bơi...
export class AnimalSystem {
  constructor(sim) {
    this.sim = sim; this.id = 'animal'; this.houseCd = 60;
    this.cmds = {
      gate: (p, c) => this.gate(p, c),
      use: (p, c) => this.use(p, c),
      feed: (p, c) => this.feed(p, c),
      catch: (p, c) => this.catchChicken(p, c),
      incubate: (p, c) => this.incubate(p, c),
    };
  }
  bootstrap() {
    this.spawn('dog', { x: 4, z: -9 });
    this.spawn('chicken', { pen: 'coop', name: 'Gà Bựa' }); this.spawn('chicken', { pen: 'coop', name: 'Cục Tác' });
  }
  spawn(type, { pen, baby = false, growth, owner = null, name, x, z, golden = false } = {}) {
    const { sim } = this, rng = sim.rng, def = ANIMALS[type], P = pen ? PENS[pen] : null;
    const id = uid('a');
    const a = {
      id, type, name: name || rng.pick(def.names), pen: pen || null, owner, golden, area: 'out',
      x: x ?? (P ? rng.range(P.x0 + 1.6, P.x1 - 1.6) : 4), z: z ?? (P ? rng.range(P.z0 + 1.6, P.z1 - 1.6) : -9),
      r: rng.range(-3, 3), st: 'idle', sub: '', timer: rng.range(0.5, 3),
      hunger: baby ? 0.15 : 0.35, happy: 0.65, growth: growth ?? (baby ? 0.38 : 1), ready: false, prodT: 0,
      _tx: 0, _tz: 0, _free: false, _out: false, _goal: '', _snd: rng.range(3, 12), _bump: 0, _cd: 0, _petCd: 0, _xpCd: 0, _charge: 0, _eggWait: 0,
    };
    a._tx = a.x; a._tz = a.z;
    sim.st.animals[id] = a; sim.touch('animals.' + id); return a;
  }
  remove(id) { delete this.sim.st.animals[id]; this.sim.touch('animals.' + id); }

  gate(pid, { pen }) {
    const { sim } = this, st = sim.st, P = PENS[pen];
    if (!P || !st.buildings[pen]?.owned) return fail('Chưa xây chuồng này');
    if (!sim.near(pid, P.gate.x, P.gate.z, 5.5)) return fail('Lại gần cổng chuồng nhé!');
    const b = st.buildings[pen]; b.open = !b.open;
    // Khi đóng cổng chuồng: thu hồi toàn bộ thú của chuồng đang đi lạc ngoài sân về lại trong chuồng ngay để không con nào kẹt bên ngoài
    if (!b.open) {
      for (const a of Object.values(st.animals)) {
        if (a.pen === pen && !a._party) {
          a._out = false; a._free = false; a._goal = ''; a.sub = '';
          if (a.area === 'house') a.area = 'out';
          a.x = clamp(a.x, P.x0 + 1.1, P.x1 - 1.1);
          a.z = clamp(a.z, P.z0 + 1.1, P.z1 - 1.1);
          a._tx = a.x; a._tz = a.z;
          sim.touch('animals.' + a.id);
        }
      }
    }
    sim.touch('buildings.' + pen); sim.fx({ k: 'sfx', name: 'place', x: P.gate.x, z: P.gate.z });
    sim.toast(pid, b.open ? `🚪 Cổng ${P.name} đang MỞ — thú có thể đi dạo quanh sân!` : `🔒 Đã đóng kín cổng ${P.name} — thú sẽ ở yên trong chuồng`, b.open ? 'warn' : 'good');
    return ok();
  }

  // Đặt trứng vào Lò Ấp Trứng của Chuồng Gà ('coop') hoặc Ao Vịt ('duck') để ấp nở ra Gà Con / Vịt Con!
  incubate(pid, { pen = 'coop', animalId = null } = {}) {
    const { sim } = this, st = sim.st, P = PENS[pen], b = st.buildings[pen];
    if (!P || !b?.owned) return fail('Cần mở chuồng này trước!');
    if (!P.inc || !['coop', 'duck'].includes(pen)) return fail('Chuồng này không có ổ ấp trứng.');
    if (sim.pos(pid).area === 'house' || !sim.near(pid, P.inc.x, P.inc.z, CFG.REACH + 1.8)) return fail('Lại gần ổ ấp trứng trong chuồng nhé!');
    if (b.inc) return fail(`Lò ấp đang ấp 1 quả trứng rồi (còn ${Math.ceil(b.inc.t)}s)! 🐣`);
    const count = Object.values(st.animals).filter((a) => a.pen === pen).length;
    if (count >= P.cap) return fail(`${P.name} đã đầy (${count}/${P.cap} con)!`);

    let golden = false, usedSource = false;
    // 1. Ưu tiên lấy trứng vừa đẻ ngay trong chuồng (của con gà được chọn hoặc bất kỳ con gà nào đang có trứng `a.ready`)
    const canUseHen = (a) => a && a.pen === pen && P.kinds.includes(a.type) && a.ready;
    if (animalId && !canUseHen(st.animals[animalId])) return fail('Con vật này không có trứng trong chuồng đã chọn.');
    const readyHen = animalId ? st.animals[animalId] : Object.values(st.animals).find(canUseHen);
    if (readyHen) {
      golden = !!readyHen.golden;
      readyHen.ready = false;
      readyHen._eggWait = 0;
      readyHen.happy = Math.min(1, readyHen.happy + 0.15);
      sim.touch('animals.' + readyHen.id);
      usedSource = true;
    } else if (sim.takeItem(pid, 'egg', 1)) {
      usedSource = true;
    } else if (sim.takeItem(pid, 'golden_egg', 1)) {
      golden = true;
      usedSource = true;
    } else if (takeFrom(st.inventory.chest, 'egg', 1)) {
      sim.touch('inventory.chest');
      usedSource = true;
    } else if (takeFrom(st.inventory.chest, 'golden_egg', 1)) {
      sim.touch('inventory.chest');
      golden = true;
      usedSource = true;
    }
    if (!usedSource) return fail('Cần có 1 quả Trứng 🥚 (đợi gà đẻ hoặc lấy trong túi) để ấp nở gà con!');

    const kind = P.kinds[0] || 'chicken';
    b.inc = { type: kind, t: INCUBATE_SECONDS, max: INCUBATE_SECONDS, golden, hen: readyHen?.id || null };
    sim.touch('buildings.' + pen);
    const ix = P.inc?.x ?? (P.x0 + 2.2), iz = P.inc?.z ?? (P.z0 + 1.5);
    sim.fx({ k: 'burst', kind: 'hearts', x: ix, z: iz, y: 1.2, n: 8 });
    sim.fx({ k: 'sfx', name: 'pop', x: ix, z: iz });
    sim.toast(pid, `🐣 Đã đưa trứng vào ổ ấp ${P.name}! Trứng sẽ nở thành ${ANIMALS[kind].name} con sau ${INCUBATE_SECONDS} giây`, 'good');
    sim.sys('prog').addXp(pid, 5);
    return ok();
  }

  // ---------- command ----------
  reach(pid, a) {
    const p = this.sim.pos(pid);
    if ((a.area === 'house') !== (p.area === 'house')) return false;
    return dist(p.x, p.z, a.x, a.z) <= CFG.REACH + 1.8;
  }
  use(pid, { id }) {
    const { sim } = this, a = sim.st.animals[id], p = sim.st.players[pid];
    if (!a) return fail('Bạn bè chạy mất rồi!');
    if (!this.reach(pid, a)) return fail('Lại gần hơn xíu!');
    const def = ANIMALS[a.type];
    if (a.type === 'chicken' && a._party) return this.catchChicken(pid, { id });
    if (a.ready && def.prod) {
      const gold = a.golden, item = gold && a.type === 'chicken' ? 'golden_egg' : def.prod.item, qty = gold && a.type !== 'chicken' ? 3 : 1;
      sim.addItem(pid, item, qty); a.ready = false; a._eggWait = 0; a.happy = Math.min(1, a.happy + 0.1); p.stats.collect++;
      sim.touch('animals.' + id); sim.touch('players.' + pid);
      sim.fx({ k: 'float', x: a.x, z: a.z, y: 2.2, text: `+${qty} ${ITEMS[item].icon}`, color: '#fff', to: pid });
      sim.fx({ k: 'burst', kind: gold ? 'stars' : 'sparkle', x: a.x, z: a.z, y: 1, n: 10 }); sim.fx({ k: 'sfx', name: 'pop', x: a.x, z: a.z });
      sim.sys('prog').addXp(pid, gold ? 15 : 4); sim.game({ type: 'collect', pid, item, n: qty });
      return ok();
    }
    if (a._petCd > 0) return ok();
    a._petCd = 3; a.happy = Math.min(1, a.happy + 0.2); a.st = 'happy'; a.timer = 1.6; a.sub = ''; p.stats.pet++;
    if (a._xpCd <= 0) { sim.sys('prog').addXp(pid, 1); a._xpCd = 20; }
    sim.fx({ k: 'burst', kind: 'hearts', x: a.x, z: a.z, y: 1.5, n: 5 }); sim.fx({ k: 'sfx', name: def.sound, x: a.x, z: a.z });
    sim.game({ type: 'pet', pid, n: 1 });
    return ok();
  }
  feed(pid, { id }) {
    const { sim } = this, a = sim.st.animals[id];
    if (!a) return fail('Không thấy con vật nào');
    if (a.type === 'dog') return this.use(pid, { id });
    if (!this.reach(pid, a)) return fail('Lại gần con vật hơn nhé!');
    if (a.hunger < 0.12) return fail(`${a.name} no căng rồi!`);
    if (!sim.takeItem(pid, 'feed')) return fail('Hết thức ăn! Mua ở Tạp Hóa hoặc Tí Shipper 🥣');
    a.hunger = Math.max(0, a.hunger - 0.75); a.starving = 0; a._w1 = a._w2 = false; a.happy = Math.min(1, a.happy + 0.15); a.st = 'eat'; a.timer = 2.2; a.sub = '';
    // Cho gà con ăn giúp gà con lớn nhanh hơn (+18% độ trưởng thành)
    if (a.growth < 1) {
      a.growth = Math.min(1, a.growth + 0.18);
    }
    sim.st.players[pid].stats.feed++; sim.touch('players.' + pid); sim.touch('animals.' + a.id);
    sim.fx({ k: 'sfx', name: 'munch', x: a.x, z: a.z });
    sim.fx({ k: 'float', x: a.x, z: a.z, y: 2.2, text: a.growth < 1 ? 'Mau lớn! 🐣✨' : 'Ngon quá! 😋', color: '#fff', to: pid });
    sim.sys('prog').addXp(pid, 2); sim.game({ type: 'feed', pid, animal: a.type, n: 1 });
    return ok();
  }
  catchChicken(pid, { id }) {
    const { sim } = this, a = sim.st.animals[id], party = sim.st.events.party;
    if (!a || !a._party || !party) return fail('Không phải lúc bắt gà!');
    if (!this.reach(pid, a)) return fail('Gà chạy nhanh lắm, lại gần hơn!');
    a._party = false; a._goal = 'home'; a._free = true; a.st = 'happy'; a.timer = 1; a.happy = 1;
    party.scores[pid] = (party.scores[pid] || 0) + 1; sim.touch('events');
    const coins = 8 + sim.st.farm.level; sim.sys('economy').earn(pid, coins);
    sim.fx({ k: 'float', x: a.x, z: a.z, y: 2.4, text: `Bắt được! +${coins} 🪙`, color: '#ffe066', to: pid }); sim.fx({ k: 'burst', kind: 'feather', x: a.x, z: a.z, y: 1, n: 12 });
    sim.fx({ k: 'sfx', name: 'chicken', x: a.x, z: a.z }); sim.sys('prog').addXp(pid, 4);
    sim.game({ type: 'chicken_catch', pid, n: 1 }); return ok();
  }

  // ---------- AI ----------
  step(a, dt, speed) {
    const dx = a._tx - a.x, dz = a._tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.3) return true;
    const s = Math.min(d, speed * dt); a.x += (dx / d) * s; a.z += (dz / d) * s; a.r = Math.atan2(dx, dz);
    return false;
  }
  go(a, x, z, run = false, goal = '') {
    a._tx = x; a._tz = z; a.st = run ? 'run' : 'walk'; a.timer = run ? this.sim.rng.range(1.2, 2.4) : 14; if (goal) a._goal = goal;
  }
  scare(a, fx, fz, secs = 3) {
    if (a.type === 'dog') return;
    const ang = Math.atan2(a.x - fx, a.z - fz) + this.sim.rng.range(-0.5, 0.5);
    const P = a.pen ? PENS[a.pen] : null;
    const open = P && this.sim.st.buildings[a.pen]?.open;
    let tx = a.x + Math.sin(ang) * 7, tz = a.z + Math.cos(ang) * 7;
    if (P && !open && !a._party) {
      tx = clamp(tx, P.x0 + 1.0, P.x1 - 1.0);
      tz = clamp(tz, P.z0 + 1.0, P.z1 - 1.0);
    }
    a._tx = tx; a._tz = tz; a.st = 'scared'; a.timer = secs; a.sub = '';
  }
  rand(a) {
    const rng = this.sim.rng, P = a.pen ? PENS[a.pen] : null;
    const open = P && this.sim.st.buildings[a.pen]?.open;
    if (a._out && open) return { x: clamp(a.x + rng.range(-8, 8), FARM_BOX.x0, FARM_BOX.x1), z: clamp(a.z + rng.range(-8, 8), FARM_BOX.z0, FARM_BOX.z1) };
    if (P) return { x: rng.range(P.x0 + 1.2, P.x1 - 1.2), z: rng.range(P.z0 + 1.2, P.z1 - 1.2) };
    return { x: clamp(a.x + rng.range(-9, 9), FARM_BOX.x0, FARM_BOX.x1), z: clamp(a.z + rng.range(-9, 9), FARM_BOX.z0, FARM_BOX.z1) };
  }
  pick(a, ctx) {
    const { sim } = this, rng = sim.rng, P = a.pen ? PENS[a.pen] : null, night = ctx.night;
    a.sub = '';
    const open = !!(P && sim.st.buildings[a.pen]?.open); // CHỈ khi cổng chuồng MỞ thì thú mới được bước ra ngoài hoặc vào nhà!
    if (!open && a.pen && !a._party) {
      a._out = false; a._free = false;
    }
    if (open && !a._out && a.type !== 'dog' && rng.chance(0.3)) { const g = P.gate; a._out = true; a._free = true; a._wp = [[g.x - 2.5 - rng.range(0, 3), g.z + rng.range(-3, 3)]]; this.go(a, g.x + 0.8, g.z, false, 'out'); return; }
    if (open && a._out && rng.chance(0.5)) { const g = P.gate; a._wp = [[g.x + 1.5, g.z], [(P.x0 + P.x1) / 2, (P.z0 + P.z1) / 2]]; this.go(a, g.x - 1.6, g.z, false, 'home'); return; }
    if (a.type !== 'dog' && night && rng.chance(0.5) && a.hunger < 0.9) { a.st = 'sleep'; a.timer = rng.range(15, 35); return; }
    const r = rng.next(), q = this.rand(a);
    const idle = (t = rng.range(1.5, 4)) => { a.st = 'idle'; a.timer = t; };
    const eat = () => { a.st = 'eat'; a.timer = rng.range(2, 4.5); };
    switch (a.type) {
      case 'chicken':
        if (r < 0.46) this.go(a, q.x, q.z); else if (r < 0.62) idle(); else if (r < 0.82) this.go(a, q.x, q.z, true); else if (r < 0.92) eat();
        // CHỈ khi cổng chuồng gà ĐANG MỞ (`open === true`) thì gà mới có thể chạy sang thăm nhà!
        else if (open && !night && this.houseCd <= 0 && ctx.houseOpen && rng.chance(0.7)) { this.houseCd = rng.range(110, 170); a._free = true; a._out = true; this.go(a, HOUSE.door.x, HOUSE.door.z + 1.2, true, 'house'); a.timer = 40; a.sub = 'house'; }
        else idle();
        break;
      case 'cow':
        if (r < 0.3) this.go(a, q.x, q.z); else if (r < 0.58) eat(); else if (r < 0.74) { a.st = 'funny'; a.sub = 'stare'; a.timer = rng.range(4, 7); } else idle(rng.range(2, 5));
        break;
      case 'pig':
        if (P?.mud && r < 0.3) this.go(a, P.mud.x + rng.range(-0.6, 0.6), P.mud.z + rng.range(-0.6, 0.6), false, 'mud');
        else if (r < 0.52) this.go(a, q.x, q.z); else if (r < 0.66) eat(); else if (r < 0.74) { a.st = 'sleep'; a.timer = rng.range(14, 24); } else idle();
        break;
      case 'sheep': if (r < 0.32) this.go(a, q.x, q.z); else if (r < 0.74) eat(); else idle(); break;
      case 'goat': {
        const near = ctx.players.filter((p) => p.area !== 'house' && dist(p.x, p.z, a.x, a.z) < 10 && P && p.x > P.x0 - 2 && p.x < P.x1 + 2 && p.z > P.z0 - 2 && p.z < P.z1 + 2).sort((u, v) => dist(u.x, u.z, a.x, a.z) - dist(v.x, v.z, a.x, a.z))[0];
        if (near && a._charge <= 0 && r < 0.65) { a._tx = near.x; a._tz = near.z; a.st = 'funny'; a.sub = 'charge'; a.timer = 1.5; a.r = Math.atan2(near.x - a.x, near.z - a.z); sim.fx({ k: 'sfx', name: 'goat', x: a.x, z: a.z }); }
        else if (r < 0.4) this.go(a, q.x, q.z); else if (r < 0.65) eat(); else idle();
        break;
      }
      case 'duck': {
        const pd = P?.pond;
        if (pd && r < 0.55) { const ang = rng.range(0, 6.28), rr = rng.range(0, pd.r - 0.8); this.go(a, pd.x + Math.cos(ang) * rr, pd.z + Math.sin(ang) * rr); }
        else if (r < 0.75) this.go(a, q.x, q.z); else if (r < 0.88) eat(); else idle();
        break;
      }
      case 'rabbit': if (r < 0.5) { this.go(a, q.x, q.z, rng.chance(0.4)); a.sub = 'hop'; } else if (r < 0.78) idle(rng.range(1, 3)); else eat(); break;
      case 'dog': {
        const near = ctx.players.filter((p) => p.area !== 'house').sort((u, v) => dist(u.x, u.z, a.x, a.z) - dist(v.x, v.z, a.x, a.z))[0];
        if (near && r < 0.45) this.go(a, near.x + rng.range(-2, 2), near.z + rng.range(-2, 2), dist(near.x, near.z, a.x, a.z) > 8);
        else if (r < 0.7) this.go(a, q.x, q.z); else idle(rng.range(2, 6));
        break;
      }
    }
  }
  tick(dt) {
    const { sim } = this, st = sim.st, ti = sim.ti, t = st.world.t, rng = sim.rng;
    const players = sim.activePlayers(), thieves = sim.sys('thief').active(), zombs = sim.sys('zombie').alive(), party = st.events.party && t < st.events.party.until ? st.events.party : null;
    const ufo = sim.eventActive('ufo');
    const ctx = { night: ti.night, players, houseOpen: true };
    this.houseCd -= dt;

    // ---- Tiến trình Lò Ấp Trứng (Incubator) ở Chuồng Gà & Ao Vịt ----
    for (const pen of ['coop', 'duck']) {
      const b = st.buildings[pen], P = PENS[pen];
      if (!b?.inc || !P) continue;
      b.inc.t -= dt;
      if (b.inc.t <= 0) {
        const count = Object.values(st.animals).filter((a) => a.pen === pen).length;
        // Bản lưu cũ có thể đã mua kín chuồng trong lúc ấp: giữ trứng cho tới khi có chỗ.
        if (count >= P.cap) {
          b.inc.t = 0;
          if (!b.inc.waiting) { b.inc.waiting = true; sim.touch('buildings.' + pen); sim.toast(undefined, `🐣 ${P.name} đã đầy. Bán bớt vật nuôi để trứng nở nhé!`, 'warn'); }
          continue;
        }
        const kind = P.kinds.includes(b.inc.type) ? b.inc.type : P.kinds[0], golden = !!b.inc.golden;
        delete b.inc;
        sim.touch('buildings.' + pen);
        if (count < P.cap) {
          const ix = P.inc?.x ?? (P.x0 + 2.4), iz = P.inc?.z ?? (P.z0 + 2.0);
          const baby = this.spawn(kind, { pen, baby: true, growth: 0.36, golden, x: ix + 0.4, z: iz + 0.6 });
          sim.fx({ k: 'burst', kind: 'feather', x: baby.x, z: baby.z, y: 0.9, n: 14 });
          sim.fx({ k: 'burst', kind: 'stars', x: baby.x, z: baby.z, y: 1.2, n: 10 });
          sim.fx({ k: 'sfx', name: 'win', x: baby.x, z: baby.z });
          sim.fx({ k: 'float', x: baby.x, z: baby.z, y: 2.2, text: `🐣 Chiếp chiếp! ${baby.name} nở rồi!`, color: '#ffe066' });
          sim.toast(undefined, `🐣 Trứng trong ${P.name} đã nở thành công! Chào đón bé ${baby.name} (${ANIMALS[kind].name} con)!`, 'good');
        }
      } else if (Math.floor((b.inc.t + dt) * 2) !== Math.floor(b.inc.t * 2)) {
        sim.touch('buildings.' + pen);
      }
    }

    const list = Object.values(st.animals);
    for (const a of list) {
      const def = ANIMALS[a.type];
      // ---- nhu cầu & sản phẩm ----
      if (a.type !== 'dog') {
        a.hunger = Math.min(1, a.hunger + dt / STARVE.rate);
        if (a.hunger >= STARVE.critical) { if (this.starve(a, dt)) continue; } else if (a.starving) { a.starving = 0; a._w1 = a._w2 = false; }
      }
      if (a.growth < 1) {
        const g0 = a.growth;
        a.growth = Math.min(1, a.growth + dt / 95);
        if (a.growth >= 1 && g0 < 1) {
          sim.touch('animals.' + a.id);
          sim.fx({ k: 'burst', kind: 'sparkle', x: a.x, z: a.z, y: 1.0, n: 10 });
          sim.fx({ k: 'float', x: a.x, z: a.z, y: 2.1, text: `🐔 ${a.name} đã trưởng thành!`, color: '#9ef07a' });
        } else if (Math.floor(a.growth * 20) !== Math.floor(g0 * 20)) {
          sim.touch('animals.' + a.id);
        }
      }
      a.happy = a.hunger > 0.6 ? Math.max(0, a.happy - dt / 240) : Math.min(1, a.happy + dt / 600);
      if (def.prod && a.growth >= 1 && !a.ready) {
        if (a.hunger < 0.8) a.prodT += dt * (0.6 + 0.8 * a.happy) * (a.golden ? 1.5 : 1) * (st.daily?.fortune === 3 ? 1.2 : 1);
        if (a.prodT >= def.prod.every) {
          a.ready = true; a.prodT = 0; a._eggWait = 0;
          sim.touch('animals.' + a.id); sim.fx({ k: 'sfx', name: 'ding', x: a.x, z: a.z });
          if (a.type === 'chicken') sim.fx({ k: 'float', x: a.x, z: a.z, y: 2.0, text: '🥚 Cục tác! Đẻ trứng!', color: '#fff8dc' });
        }
      }
      // Giữ sản phẩm tới khi người chơi thu hoặc chủ động đưa trứng vào ổ ấp.
      if (a.golden && a._goldenUntil && t > a._goldenUntil) { a.golden = false; sim.touch('animals.' + a.id); }
      a._petCd -= dt; a._xpCd -= dt; a._charge -= dt; a._cd -= dt; a._bump -= dt;
      // ---- âm thanh ngẫu nhiên khi có người ở gần ----
      if ((a._snd -= dt) <= 0) {
        a._snd = rng.range(9, 24);
        if (a.st !== 'sleep' && players.some((p) => dist(p.x, p.z, a.x, a.z) < 26)) sim.fx({ k: 'sfx', name: def.sound, x: a.x, z: a.z });
      }
      // ---- sự kiện làm thú hoảng/loạn ----
      if (a.type === 'chicken' && party && !a._party && a.area === 'out') { a._party = true; a._free = true; a.st = 'run'; a.sub = 'party'; a._ang = rng.range(0, 6.28); a._rad = rng.range(8, 13); }
      if (a.type === 'chicken' && !party && a._party) { a._party = false; this.go(a, PENS.coop.x0 + 4, (PENS.coop.z0 + PENS.coop.z1) / 2, true, 'home'); a._free = true; a.sub = ''; }
      if (a.type !== 'dog' && a.st !== 'scared' && a.area === 'out' && !a._party) {
        const th = [...thieves, ...zombs].find((x) => x.st !== 'stun' && dist(x.x, x.z, a.x, a.z) < 6);
        if (th && a._cd <= 0) { this.scare(a, th.x, th.z, 2.5); a._cd = 4; }
        if (ufo && a._cd <= 0 && sim.rng.chance(dt * 2)) { this.scare(a, 0, 0, 3); a._cd = 5; }
      }
      // ---- state machine ----
      a.timer -= dt;
      if (a.area === 'house') this.tickHouse(a, dt);
      else if (a._party) { a._ang += dt * 1.5; a._tx = 3 + Math.cos(a._ang) * a._rad; a._tz = 5 + Math.sin(a._ang) * a._rad * 0.7; a.st = 'run'; this.step(a, dt, def.run * 1.1); }
      else this.tickState(a, dt, ctx, thieves);
      // ---- KHOÁ CHẶT TRONG CHUỒNG KHI CỔNG ĐÓNG ----
      const P = a.pen ? PENS[a.pen] : null;
      const gateOpen = !!(P && st.buildings[a.pen]?.open);
      if (a.area === 'out' && P && !gateOpen && !a._party) {
        a._free = false; a._out = false;
        a.x = clamp(a.x, P.x0 + 0.85, P.x1 - 0.85);
        a.z = clamp(a.z, P.z0 + 0.85, P.z1 - 0.85);
      } else if (a.area === 'out' && !a._free) {
        const B = P ? { x0: P.x0 + 0.85, x1: P.x1 - 0.85, z0: P.z0 + 0.85, z1: P.z1 - 0.85 } : FARM_BOX;
        a.x = clamp(a.x, B.x0, B.x1); a.z = clamp(a.z, B.z0, B.z1);
      } else if (a._out && a.area === 'out') {
        a.x = clamp(a.x, FARM_BOX.x0, FARM_BOX.x1); a.z = clamp(a.z, FARM_BOX.z0, FARM_BOX.z1);
      } else if (a._free && P && a._goal !== 'house' && a.area === 'out') {
        if (a.x > P.x0 + 1 && a.x < P.x1 - 1 && a.z > P.z0 + 1 && a.z < P.z1 - 1 && !a._party) a._free = false;
      }
    }
    // ---- va chạm hài hước giữa các con vật ----
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.area !== b.area || a.st === 'sleep' || b.st === 'sleep' || a._bump > 0 || b._bump > 0) continue;
      const rr = (ANIMALS[a.type].r + ANIMALS[b.type].r) * 0.8, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < rr && d > 1e-4) {
        const push = (rr - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push;
        if ((a.st === 'run' || b.st === 'run' || a.sub === 'charge') && !a._free) {
          for (const x of [a, b]) { x.st = 'funny'; x.sub = 'bump'; x.timer = 0.7; x._bump = 4; }
          sim.fx({ k: 'burst', kind: 'stars', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: 1.3, n: 6 }); sim.fx({ k: 'sfx', name: 'boing', x: a.x, z: a.z });
        }
      }
    }
  }
  tickState(a, dt, ctx, thieves) {
    const { sim } = this, rng = sim.rng, def = ANIMALS[a.type], P = a.pen ? PENS[a.pen] : null;
    // chó đuổi trộm
    if (a.type === 'dog' && thieves.length) {
      const th = thieves.sort((u, v) => dist(u.x, u.z, a.x, a.z) - dist(v.x, v.z, a.x, a.z))[0];
      a._tx = th.x; a._tz = th.z; a.st = 'run'; a.sub = '';
      this.step(a, dt, def.run); a._free = true;
      if (dist(a.x, a.z, th.x, th.z) < 1.3 && a._cd <= 0) { a._cd = 3; sim.sys('thief').dogBite(th); sim.fx({ k: 'sfx', name: 'bark', x: a.x, z: a.z }); }
      return;
    }
    switch (a.st) {
      case 'idle': case 'happy': if (a.timer <= 0) this.pick(a, ctx); break;
      case 'eat': if (a.timer <= 0) { a.st = 'idle'; a.timer = rng.range(1, 3); } break;
      case 'walk': case 'run': {
        const sp = a.st === 'run' ? def.run : def.walk;
        if (this.step(a, dt, sp)) { if (a._wp?.length) { const w = a._wp.shift(); a._tx = w[0]; a._tz = w[1]; } else this.arrive(a, ctx); }
        else if (a.timer <= 0) { if (a._goal === 'house' || a._goal === 'home' || a._goal === 'mud') { a.timer = 6; } else { a.st = 'idle'; a.timer = rng.range(1, 3); } }
        if (a.type === 'duck' && P?.pond) a.sub = dist(a.x, a.z, P.pond.x, P.pond.z) < P.pond.r - 0.2 ? 'swim' : '';
        break;
      }
      case 'sleep': if (a.timer <= 0 || ctx.players.some((p) => p.area !== 'house' && dist(p.x, p.z, a.x, a.z) < 2)) { a.st = 'idle'; a.timer = 1; if (a.type === 'pig') sim.fx({ k: 'sfx', name: 'pig', x: a.x, z: a.z }); } break;
      case 'scared': this.step(a, dt, def.run * 1.1); if (a.timer <= 0) { a.st = 'idle'; a.timer = 1.5; } break;
      case 'funny':
        if (a.sub === 'charge') {
          this.step(a, dt, 8);
          for (const p of ctx.players) if (p.area !== 'house' && dist(p.x, p.z, a.x, a.z) < 1.7 && a._charge <= 0) {
            a._charge = 14; a.timer = 0.2;
            const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz) || 1;
            sim.fx({ k: 'knock', to: p.id, dx: dx / d, dz: dz / d, power: 9 }); sim.fx({ k: 'float', x: p.x, z: p.z, y: 3, text: 'Dê húc! 🐐💥', color: '#ffb347' });
            sim.fx({ k: 'burst', kind: 'stars', x: p.x, z: p.z, y: 1.4, n: 8 }); sim.fx({ k: 'sfx', name: 'boing', x: p.x, z: p.z });
          }
          if (a.timer <= 0 || dist(a.x, a.z, a._tx, a._tz) < 0.4) { a.st = 'idle'; a.sub = ''; a.timer = rng.range(2, 4); a._charge = Math.max(a._charge, 8); }
        } else if (a.timer <= 0) {
          if (a.sub === 'roll') { a.st = 'happy'; a.timer = 1.5; a.happy = Math.min(1, a.happy + 0.1); sim.fx({ k: 'burst', kind: 'mud', x: a.x, z: a.z, y: 0.6, n: 10 }); }
          else { a.st = 'idle'; a.timer = rng.range(1, 3); }
          a.sub = '';
        }
        break;
    }
  }
  arrive(a, ctx) {
    const { sim } = this, rng = sim.rng;
    if (a._goal === 'house') {                       // chui vào nhà!
      a._goal = ''; a.area = 'house'; a.sub = 'house';
      const room = interiorRoom(sim.st.farm.houseLevel);
      a.x = INTERIOR.ox + rng.range(-1, 1); a.z = INTERIOR.oz + room.d / 2 - 1.1; a._goal = 'inhouse'; a.timer = rng.range(9, 13); a.st = 'run'; a._tx = a.x; a._tz = a.z - 2;
      sim.touch('animals.' + a.id);
      sim.fx({ k: 'float', x: HOUSE.door.x, z: HOUSE.door.z + 0.5, y: 2.6, text: '🐔 Cục tác! Vào nhà!', color: '#fff' }); sim.fx({ k: 'sfx', name: 'chicken', x: HOUSE.door.x, z: HOUSE.door.z });
      return;
    }
    if (a._goal === 'mud') { a._goal = ''; a.st = 'funny'; a.sub = 'roll'; a.timer = rng.range(4, 6); sim.fx({ k: 'burst', kind: 'mud', x: a.x, z: a.z, y: 0.5, n: 8 }); sim.fx({ k: 'sfx', name: 'pig', x: a.x, z: a.z }); return; }
    if (a._goal === 'home') { a._goal = ''; a.st = 'idle'; a.timer = 1; if (a.pen) { const P = PENS[a.pen]; if (a.x > P.x0 && a.x < P.x1 && a.z > P.z0 && a.z < P.z1) { a._free = false; a._out = false; } } return; }
    a.st = 'idle'; a.timer = rng.range(1, 3.5); a.sub = ''; if (a._goal === 'out') a._goal = '';
  }
  tickHouse(a, dt) {
    const { sim } = this, rng = sim.rng, room = interiorRoom(sim.st.farm.houseLevel), def = ANIMALS[a.type];
    if (a._goal === 'inhouse' && a.timer > 0) {
      if (this.step(a, dt, def.run)) { a._tx = INTERIOR.ox + rng.range(-room.w / 2 + 1, room.w / 2 - 1); a._tz = INTERIOR.oz + rng.range(-room.d / 2 + 1.5, room.d / 2 - 1.8); }
    } else {
      a._goal = 'leaving'; a._tx = INTERIOR.ox; a._tz = INTERIOR.oz + room.d / 2 - 0.3;
      if (this.step(a, dt, def.run)) {                        // chạy ra khỏi nhà
        a.area = 'out'; a.x = HOUSE.door.x + rng.range(-0.8, 0.8); a.z = HOUSE.door.z + 1.6; a.sub = ''; a._goal = 'home'; a._free = true;
        const P = PENS[a.pen]; this.go(a, (P.x0 + P.x1) / 2, (P.z0 + P.z1) / 2, true, 'home'); a.timer = 30;
        sim.touch('animals.' + a.id);
      }
    }
  }
  // Đói lả quá lâu => chết. Cảnh báo 2 lần để người chơi kịp cho ăn.
  starve(a, dt) {
    const { sim } = this, def = ANIMALS[a.type]; a.starving = (a.starving || 0) + dt;
    if (!a._w1) { a._w1 = true; sim.touch('animals.' + a.id); sim.toast(undefined, `🍽️ ${a.name} (${def.name}) đói lả rồi! Cho ăn gấp kẻo chết đói (còn ${STARVE.grace}s)`, 'warn'); sim.fx({ k: 'sfx', name: def.sound, x: a.x, z: a.z }); }
    if (!a._w2 && a.starving >= STARVE.warn) { a._w2 = true; sim.toast(undefined, `🚨 ${a.name} sắp chết đói! Còn ${Math.ceil(STARVE.grace - a.starving)}s!`, 'warn'); sim.fx({ k: 'sfx', name: 'alarm' }); }
    if (a.starving >= STARVE.grace) { this.die(a); return true; }
    return false;
  }
  die(a) {
    const { sim } = this; sim.fx({ k: 'float', x: a.x, z: a.z, y: 2.6, text: '💀 chết đói...', color: '#ffb0b0' }); sim.fx({ k: 'burst', kind: 'smoke', x: a.x, z: a.z, y: 1, n: 8 }); sim.fx({ k: 'sfx', name: 'sad', x: a.x, z: a.z });
    sim.toast(undefined, `😢 ${a.name} (${ANIMALS[a.type].name}) đã chết đói. Nhớ cho ăn đều nhé!`, 'warn'); this.remove(a.id); sim.st.meta.deaths = (sim.st.meta.deaths || 0) + 1; sim.touch('meta'); sim.game({ type: 'animal_died', animal: a.type });
  }
  onNewDay() { /* thú ngủ dậy sớm */ for (const a of Object.values(this.sim.st.animals)) if (a.st === 'sleep') { a.st = 'idle'; a.timer = 1; } }
}
