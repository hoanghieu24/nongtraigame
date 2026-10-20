import { PLOT, plotPos, plotId, HOUSE, INTERIOR, interiorRoom, HOME_KITCHEN, REST, inRest, SPOTS, AREAS, areaAt, walkable, groundY, PENS } from '../data/layout.js';
import { expandCost } from '../farming/FarmingSystem.js';
import { FURN } from '../data/furniture.js';
import { footprint } from '../furniture/FurnitureSystem.js';
import { TOOLS } from './PlayerView.js';
import { dampAngle, damp, dist, fmt, timeInfo } from '../core/util.js';
import { ANIMALS } from '../data/animals.js';
import { ITEMS } from '../data/items.js';
import { NPCS, CUSTOMERS } from '../data/npcs.js';
import { RECIPES, RSC_CRATES } from '../data/recipes.js';
import { rscProgress } from '../restaurant/RestaurantSystem.js';
import { CFG } from '../core/Config.js';
import { WEATHER } from '../data/weather.js';

const pushRect = (p, r, q) => {
  const cx = Math.max(q.x0, Math.min(p.x, q.x1)), cz = Math.max(q.z0, Math.min(p.z, q.z1)), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return; if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; return; }
  const l = p.x - q.x0, rr = q.x1 - p.x, t = p.z - q.z0, b = q.z1 - p.z, m = Math.min(l, rr, t, b); if (m === l) p.x = q.x0 - r; else if (m === rr) p.x = q.x1 + r; else if (m === t) p.z = q.z0 - r; else p.z = q.z1 + r;
};
// Nhân vật của MÌNH: di chuyển (client-authoritative cho vị trí), nhảy 3D, chạy nhanh (sprint), dùng dụng cụ/tương tác
export class LocalPlayer {
  constructor(game) {
    this.g = game; this.x = SPOTS.spawn.x; this.z = SPOTS.spawn.z; this.rot = 0; this.vx = 0; this.vz = 0;
    this.area = 'out'; this.tool = 0; this.act = ''; this.actT = 0; this.emote = ''; this.emoteT = 0;
    this.stun = 0; this.kb = { x: 0, z: 0 }; this.stepT = 0; this.poseT = 0; this.warnT = 0;
    this.jumpY = 0; this.vy = 0; this.jumping = false; this.sprint = false; this.sprintHeld = false; this.dustT = 0;
    this.target = null; this.plot = null; this.animal = null; this.moved = 0; this.sitting = null; this.inBed = null;
    this.pose = { x: 0, z: 0, rot: 0, anim: 'idle', tool: 0, area: 'out', spd: 0 };
  }
  get me() { return this.g.store.state.players[this.g.myId]; }
  spawn() { const me = this.me; const s = me?.slot || 0; this.x = SPOTS.spawn.x + s * 1.4; this.z = SPOTS.spawn.z; this.area = 'out'; this.rot = Math.PI; this.vx = this.vz = 0; this.jumpY = 0; this.vy = 0; this.jumping = false; this.moved = 0; this.sitting = null; this.inBed = null; }
  play(name, dur = 0.5) { this.act = name; this.actT = dur; this.actDur = dur; }
  doEmote(name, dur = 2) { this.emote = name; this.emoteT = dur; }
  knock(dx, dz, power) { this.sitting = null; this.inBed = null; this.g.rig.sleeping = false; this.kb = { x: dx * power, z: dz * power }; this.stun = 0.7; this.g.fx.addShake(0.3); }
  send(cmd) { return this.g.session.send(cmd); }

  jump() {
    const g = this.g, me = this.me;
    if (!me || this.stun > 0 || g.fishGameOn || this.inBed || me.sleeping) return;
    if (this.sitting) this.standUp();
    if (this.jumpY > 0.05) return;
    this.vy = 7.6;
    this.jumping = true;
    this.jumpY = 0.06;
    const baseY = this.area === 'out' ? groundY(this.x, this.z) : 0;
    g.audio.sfx('pop');
    g.fx.burst('smoke', this.x, baseY + 0.12, this.z, 5);
  }

  toggleSprint(force) {
    this.sprint = force !== undefined ? !!force : !this.sprint;
    this.g.ui?.refreshSprint?.();
    this.g.audio.sfx('click');
  }

  canSleep(st = this.g.store.state) {
    const h = timeInfo(st.world.t, CFG).hour;
    const wx = st.world.weather;
    return h >= 18 || h < 5.5 || wx === 'rain' || wx === 'storm';
  }

  lieOnBed(bed) {
    const g = this.g, st = g.store.state;
    if (!this.canSleep(st)) {
      g.audio.sfx('fail');
      g.ui.toast('Chỉ có thể đi ngủ vào buổi tối (từ 18:00) hoặc khi trời đang mưa! 🌙🌧️', 'warn');
      return;
    }
    this.sitting = null; this.jumpY = 0; this.vy = 0; this.jumping = false;
    this.inBed = { id: bed.id, bx: bed.x, bz: bed.z, t: 0, dreaming: true, sleepCycle: st.world.sleepCycle || 0 };
    this.x = INTERIOR.ox + bed.x;
    this.z = INTERIOR.oz + bed.z + 0.72;
    this.rot = 0;
    this.vx = this.vz = 0;
    g.rig.sleeping = true;
    g.audio.sfx('sad');
    const el = document.getElementById('eyelids');
    if (el) { el.classList.remove('opening'); el.classList.add('closing'); }
    this.send({ type: 'clock.sleep' });
  }

  startDream() {
    if (!this.inBed) return;
    if (!this.canSleep(this.g.store.state)) {
      this.g.audio.sfx('fail');
      this.g.ui.toast('Chỉ có thể đi ngủ vào buổi tối (từ 18:00) hoặc khi trời đang mưa! 🌙🌧️', 'warn');
      this.wakeUp();
      return;
    }
    this.send({ type: 'clock.sleep' });
  }
  // Theo dõi trạng thái ngủ từ host: qua đêm xong (sleeping bị host tắt) thì mở mắt & đứng dậy
  watchSleep(me, st) {
    const b = this.inBed; if (!b) return;
    const el = document.getElementById('eyelids');
    const openEyes = () => { if (el) { el.classList.remove('closing'); el.classList.add('opening'); setTimeout(() => el.classList.remove('opening'), 1400); } };
    // Đồng hồ nhảy vọt hoặc host chuyển sleeping về false => đêm đã qua, chào buổi sáng!
    if ((st.world.sleepCycle || 0) !== b.sleepCycle || (b.confirmed && !me.sleeping)) {
      openEyes();
      this.wakeUp();
      return;
    }
    if (me.sleeping && !b.confirmed) {
      b.confirmed = true;
      openEyes();
    }
  }
  wakeUp() {
    if (!this.inBed && !this.me?.sleeping) return;
    const b = this.inBed || { bx: this.me?.bed?.x ?? 4.5, bz: this.me?.bed?.z ?? -3.0 };
    this.inBed = null;
    this.g.rig.sleeping = false;
    const el = document.getElementById('eyelids');
    if (el) { el.classList.remove('closing'); el.classList.add('opening'); setTimeout(() => el.classList.remove('opening'), 800); }
    if (this.me?.sleeping) this.send({ type: 'clock.wake' });
    this.x = INTERIOR.ox + b.bx - 1.35;
    this.z = INTERIOR.oz + b.bz + 0.4;
    this.rot = Math.PI;
    this.g.audio.sfx('pop');
  }

  sitOn(f) {
    const g = this.g, ox = f.area === 'house' ? INTERIOR.ox : 0, oz = f.area === 'house' ? INTERIOR.oz : 0;
    const rot = (f.rot || 0) * (Math.PI / 2);
    const offset = f.item === 'sofa' ? 0.12 : 0.05;
    const sx = ox + f.x + Math.sin(rot) * offset, sz = oz + f.z + Math.cos(rot) * offset;
    this.inBed = null; this.jumpY = 0; this.vy = 0; this.jumping = false; g.rig.sleeping = false;
    this.sitting = { id: f.id, item: f.item, x: sx, z: sz, rot, origX: this.x, origZ: this.z };
    this.x = sx; this.z = sz; this.rot = rot; this.vx = this.vz = 0;
    g.audio.sfx('pop');
    g.fx.burst('hearts', sx, (f.area === 'house' ? 0 : groundY(sx, sz)) + 1.9, sz, 6);
    g.ui.toast(`🛋️ Đang ngồi thư giãn trên ${FURN[f.item]?.name || 'ghế'} — đẩy Joystick hoặc bấm Nhảy để đứng dậy`, 'good');
  }
  standUp() {
    if (!this.sitting) return;
    const s = this.sitting; this.sitting = null;
    this.x = s.x + Math.sin(s.rot) * 0.85;
    this.z = s.z + Math.cos(s.rot) * 0.85;
    this.g.audio.sfx('click');
  }
  watchTv(f) {
    const g = this.g, st = g.store.state, wx = WEATHER[st.world.weather] || WEATHER.clear;
    const hot = ITEMS[st.economy.hot];
    g.audio.sfx('bell');
    g.fx.burst('sparkle', INTERIOR.ox + f.x, 1.5, INTERIOR.oz + f.z, 8);
    g.ui.toast(`📺 Bản tin Nông Trại: Thời tiết hiện tại ${wx.icon} ${wx.name} • Nông sản giá cao hôm nay: ${hot?.icon || '🥕'} ${hot?.name || 'Cà rốt'} (×1.5)!`, 'good');
  }

  update(dt) {
    const g = this.g, st = g.store.state, me = this.me; if (!me) return;
    this.actT = Math.max(0, this.actT - dt); this.emoteT = Math.max(0, this.emoteT - dt); this.stun = Math.max(0, this.stun - dt); this.warnT -= dt;
    const ax = g.ui.typing() ? { x: 0, y: 0, run: false } : g.input.axis(), fishing = me.fishing;

    if (this.inBed || me.sleeping) {
      const bx = this.inBed?.bx ?? me.bed?.x ?? 4.5, bz = this.inBed?.bz ?? me.bed?.z ?? -3.0;
      this.watchSleep(me, st);
      if (!this.inBed && !me.sleeping) return;
      if (this.inBed) {
        this.inBed.t += dt;
        if (this.inBed.t > 1.2 && Math.hypot(ax.x, ax.y) > 0.85) {
          this.wakeUp();
          return;
        }
      }
      this.x = INTERIOR.ox + bx;
      this.z = INTERIOR.oz + bz + 0.72;
      this.rot = 0; this.vx = this.vz = 0; this.area = 'house';
      g.rig.sleeping = true;
      Object.assign(this.pose, { x: this.x, z: this.z, rot: 0, anim: 'sleep', tool: this.tool, area: 'house', spd: 0, y: 0.64 });
      this.poseT += dt; if (g.session.role === 'host' || this.poseT >= 1 / CFG.NET.POSE_HZ) { this.poseT = 0; g.session.sendPose(this.pose); }
      this.scan(st, me);
      return;
    }
    g.rig.sleeping = false;

    if (this.sitting) {
      if (Math.hypot(ax.x, ax.y) > 0.22) {
        this.standUp();
      } else {
        this.x = this.sitting.x; this.z = this.sitting.z;
        if (g.view !== 'FP') this.rot = this.sitting.rot;
        const baseY = this.area === 'out' ? groundY(this.x, this.z) : 0;
        Object.assign(this.pose, { x: this.x, z: this.z, rot: this.rot, anim: 'sit', tool: this.tool, area: this.area, spd: 0, y: baseY + 0.14 });
        this.poseT += dt; if (g.session.role === 'host' || this.poseT >= 1 / CFG.NET.POSE_HZ) { this.poseT = 0; g.session.sendPose(this.pose); }
        this.scan(st, me);
        return;
      }
    }
    if (fishing && (ax.x || ax.y) && fishing.phase !== 'reel') this.send({ type: 'fish.cancel' });
    const fp = g.view === 'FP', yaw = g.rig.yaw, F = fp ? { x: -Math.sin(yaw), z: -Math.cos(yaw) } : g.rig.forward(), R = fp ? { x: Math.cos(yaw), z: -Math.sin(yaw) } : g.rig.right();
    let wx = F.x * ax.y + R.x * ax.x, wz = F.z * ax.y + R.z * ax.x; const mag = Math.min(1, Math.hypot(wx, wz));
    const can = this.stun <= 0 && !fishing && !g.fishGameOn;
    const sprinting = ax.run || this.sprint || this.sprintHeld;
    const spd = can ? (sprinting ? 9.6 : 5.6) * mag : 0, l = Math.hypot(wx, wz) || 1;
    this.vx = damp(this.vx, (wx / l) * spd, 14, dt); this.vz = damp(this.vz, (wz / l) * spd, 14, dt);
    const kf = Math.exp(-5 * dt); this.kb.x *= kf; this.kb.z *= kf;
    const nx = this.x + (this.vx + this.kb.x) * dt, nz = this.z + (this.vz + this.kb.z) * dt;
    this.tryMove(nx, nz, st);

    const baseY = this.area === 'out' ? groundY(this.x, this.z) : 0;
    if (this.jumping || this.jumpY > 0) {
      this.jumpY += this.vy * dt;
      this.vy -= 21.5 * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.vy = 0;
        this.jumping = false;
        g.audio.step_();
      }
    }

    const sp = Math.hypot(this.vx, this.vz); this.moved += sp * dt;
    if (fp) this.rot = yaw + Math.PI; else if (sp > 0.35) this.rot = dampAngle(this.rot, Math.atan2(this.vx, this.vz), 15, dt);
    if (st.meta.tut === 0 && this.moved > 4) { this.send({ type: 'quest.tut', step: 1 }); this.moved = -999; }
    if (sp > 1 && this.jumpY <= 0.02) {
      this.stepT += sp * dt;
      if (this.stepT > (sprinting ? 1.85 : 2.3)) { this.stepT = 0; g.audio.step_(); }
    }
    if (sprinting && sp > 6.8 && this.jumpY <= 0.02) {
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = 0.14;
      }
    }
    let anim = 'idle';
    if (this.stun > 0) anim = 'stumble';
    else if (this.jumpY > 0.08) anim = 'jump';
    else if (this.emoteT > 0) anim = this.emote;
    else if (this.actT > 0) anim = this.act;
    else if (fishing) anim = fishing.phase === 'reel' ? 'reel' : 'fish';
    else if (sp > 6.4) anim = 'run';
    else if (sp > 0.6) anim = 'walk';
    const y = baseY + this.jumpY;
    Object.assign(this.pose, { x: this.x, z: this.z, rot: this.rot, anim, tool: this.tool, area: this.area, spd: Math.min(1, sp / 8.8), y });
    this.poseT += dt; if (g.session.role === 'host' || this.poseT >= 1 / CFG.NET.POSE_HZ) { this.poseT = 0; g.session.sendPose(this.pose); }
    this.scan(st, me);
  }
  okOut(x, z, st) {
    if (!walkable(x, z)) return false; const a = areaAt(x, z);
    if (a && !st.farm.areas[a]) { if (this.warnT <= 0) { this.warnT = 3; this.g.ui.toast(`🔒 ${AREAS[a].name} mở ở Cấp nông trại ${AREAS[a].lvl}`, 'warn'); this.g.audio.sfx('fail'); } return false; }
    return true;
  }
  okIn(x, z, st) { const r = interiorRoom(st.farm.houseLevel), lx = x - INTERIOR.ox, lz = z - INTERIOR.oz; return Math.abs(lx) <= r.w / 2 - 0.5 && lz >= -r.d / 2 + 0.5 && lz <= r.d / 2 - 0.3; }
  tryMove(nx, nz, st) {
    const out = this.area === 'out', ok = (px, pz) => (out ? this.okOut(px, pz, st) : this.okIn(px, pz, st));
    let x = this.x, z = this.z; if (ok(nx, nz)) { x = nx; z = nz; } else if (ok(nx, z)) x = nx; else if (ok(x, nz)) z = nz;
    const p = { x, z }; if (out) this.g.world.resolve(p, 0.45); this.furnResolve(p, st);
    this.x = p.x; this.z = p.z;
    if (out && this.g.mode === "play" && !this.g.rsc2d?.active && inRest(this.x, this.z, -0.3)) {
      this.g.rsc2d?.open();
    }
  }
  furnResolve(p, st) {
    if (this.sitting || this.inBed) return;
    const area = this.area === 'house' ? 'house' : 'farm', ox = area === 'house' ? INTERIOR.ox : 0, oz = area === 'house' ? INTERIOR.oz : 0;
    if (area === 'house') {
      const r = interiorRoom(st.farm.houseLevel), kz = -r.d / 2 + 0.72;
      pushRect(p, 0.42, {
        x0: ox + HOME_KITCHEN.x - 2.65,
        x1: ox + HOME_KITCHEN.x + 1.50,
        z0: oz - r.d / 2 - 0.25,
        z1: oz + kz + 0.68,
      });
      pushRect(p, 0.42, {
        x0: ox - r.w / 2 - 0.25,
        x1: ox - r.w / 2 + 1.02,
        z0: oz - 2.8,
        z1: oz - 0.4,
      });
    } else {
      if (this.jumpY < 0.35) {
        const rows = st.farm.plotRows;
        const x0 = PLOT.x0 - 1.52, x1 = PLOT.x0 + (PLOT.cols - 1) * PLOT.sp + 1.52;
        const z0 = PLOT.z0 - 1.52, z1 = PLOT.z0 + (rows - 1) * PLOT.sp + 1.52;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, gateHalf = 1.25;
        pushRect(p, 0.38, { x0, x1: cx - gateHalf, z0: z0 - 0.12, z1: z0 + 0.12 });
        pushRect(p, 0.38, { x0: cx + gateHalf, x1, z0: z0 - 0.12, z1: z0 + 0.12 });
        pushRect(p, 0.38, { x0, x1, z0: z1 - 0.12, z1: z1 + 0.12 });
        pushRect(p, 0.38, { x0: x0 - 0.12, x1: x0 + 0.12, z0, z1 });
        pushRect(p, 0.38, { x0: x1 - 0.12, x1: x1 + 0.12, z0, z1: cz - 1.05 });
        pushRect(p, 0.38, { x0: x1 - 0.12, x1: x1 + 0.12, z0: cz + 1.05, z1 });
      }
    }
    for (const f of Object.values(st.furniture)) {
      if (f.area !== area) continue; const d = FURN[f.item]; if (!d || d.flat || d.wall) continue;
      if (Math.abs(ox + f.x - p.x) > 3.5 || Math.abs(oz + f.z - p.z) > 3.5) continue;
      const fp = footprint(d, f.rot); pushRect(p, 0.4, { x0: ox + f.x - fp.w / 2 + 0.08, x1: ox + f.x + fp.w / 2 - 0.08, z0: oz + f.z - fp.d / 2 + 0.08, z1: oz + f.z + fp.d / 2 - 0.08 });
    }
  }
  // ---------- quét mục tiêu tương tác ----------
  scan(st, me) {
    const g = this.g, bag = st.inventory.players[me.id] || {}, px = this.x, pz = this.z, inHouse = this.area === 'house';
    const lookAng = g.view === 'FP' ? g.rig.yaw + Math.PI : this.rot;
    const dx = Math.sin(lookAng), dz = Math.cos(lookAng);
    let best = null; const cand = (pri, d, o) => { if (!best || pri < best.pri || (pri === best.pri && d < best.d)) best = { pri, d, ...o }; };
    this.plot = null; this.animal = null;
    if (this.inBed || me.sleeping) {
      cand(1, 0.1, { icon: '🌙', label: 'Nhắm mắt ngủ qua đêm', run: () => this.startDream() });
      this.target = best;
      return;
    }
    if (this.sitting) {
      cand(1, 0.1, { icon: '🧍', label: 'Đứng dậy', run: () => this.standUp() });
      this.target = best;
      return;
    }
    if (!inHouse) {
      const fx = px + dx * 1.4, fz = pz + dz * 1.4;
      let bestPlot = null, bestPD = 99;
      for (let r = 0; r < st.farm.plotRows; r++) for (let c = 0; c < PLOT.cols; c++) {
        const p = plotPos(r, c), dPlayer = Math.hypot(p.x - px, p.z - pz), dFront = Math.hypot(p.x - fx, p.z - fz);
        const score = Math.min(dPlayer, dFront);
        if (dPlayer < CFG.REACH + 1.5 && score < 2.25 && score < bestPD) { bestPD = score; bestPlot = { id: plotId(r, c), x: p.x, z: p.z, c: st.crops[plotId(r, c)] }; }
      }
      if (bestPlot) {
        this.plot = bestPlot;
        if (this.plot.c?.s === 'ripe') cand(2, 0.5, { icon: '🧺', label: 'Thu hoạch', run: () => { this.play('harvest', 0.55); this.send({ type: 'farm.harvest', plot: bestPlot.id }); } });
      }
      for (const t of Object.values(st.thieves)) if (t.st === 'stun') { const d = dist(px, pz, t.x, t.z); if (d < 3.8) cand(0, d, { icon: '🧤', label: 'BẮT TRỘM!', run: () => this.send({ type: 'thief.grab', id: t.id }) }); }

      // ---------- QUÉT CÁC TRẠM BẾP & BÀN KHÁCH "READY, SET, COOK!" ----------
      const rest = st.restaurant, carry = me.carry || '';
      if (inRest(px, pz, 5.5)) {
        // 1. Phục vụ khách đang ngồi quanh Bàn Tiệc Oval
        for (const gu of Object.values(rest.guests)) {
          if (gu.state !== 'seated') continue;
          const tp = REST.table(gu.table), d = dist(px, pz, tp.x, tp.z);
          const hasDish = bag['dish_' + gu.dish] || carry === 'dish_' + gu.dish;
          if (d < 5.0 && hasDish) {
            cand(1, d, {
              icon: RECIPES[gu.dish]?.icon || '🍽️',
              label: `Phục vụ ${CUSTOMERS[gu.kind].name} (${RECIPES[gu.dish]?.name})`,
              run: () => { this.play('carry', 0.6); this.send({ type: 'rest.serve', guest: gu.id }); },
            });
          }
        }
        // 2. Dọn đĩa bẩn & nhận tiền Tip trên Bàn Tiệc Oval
        for (const [tk, info] of Object.entries(rest.dirtyTables || {})) {
          const tp = REST.table(+tk), d = dist(px, pz, tp.x, tp.z);
          if (d < 4.5 && !carry) {
            cand(1, d, {
              icon: '🪙',
              label: `Thu Tip +${info.tip}🪙 & Dọn đĩa bẩn`,
              run: () => { this.play('harvest', 0.5); this.send({ type: 'rest.clearTable', table: +tk }); },
            });
          }
        }
        // 3. 3 Bếp Nấu Chảo/Nồi (s0, s1, s2)
        for (const [sk, stv] of Object.entries(REST.stoves)) {
          const d = dist(px, pz, stv.x, stv.z);
          if (d >= 3.2) continue;
          const sObj = rest.stations[sk];
          if (sObj && (sObj.state === 'burning' || sObj.state === 'burnt')) {
            cand(0, d, { icon: '🧯', label: `DẬP LỬA ${stv.name}!`, run: () => { this.play('water', 0.5); this.send({ type: 'rest.useStove', station: sk }); } });
          } else if (sObj && sObj.state === 'ready') {
            cand(1, d, { icon: RECIPES[sObj.recipe]?.icon || '🍽️', label: `Lấy ${RECIPES[sObj.recipe]?.name} ra đĩa`, run: () => { this.play('carry', 0.5); this.send({ type: 'rest.useStove', station: sk }); } });
          } else if (carry.startsWith('prep:') || carry.startsWith('raw:')) {
            const ing = carry.split(':')[1];
            cand(1, d, { icon: '🍳', label: `Cho ${RSC_CRATES[ing]?.icon || ''} vào ${stv.name}`, run: () => { this.play('plant', 0.45); this.send({ type: 'rest.useStove', station: sk }); } });
          } else if (sObj && sObj.state === 'prep') {
            const prog = rscProgress(sObj).map((p) => `${p.icon}${p.have}/${p.need}`).join(' ');
            cand(3, d, { icon: RECIPES[sObj.recipe]?.icon || '🍲', label: `${stv.name}: ${prog}`, run: () => this.send({ type: 'rest.useStove', station: sk }) });
          }
        }
        // 4. 2 Bàn Thớt Sơ Chế (b0, b1)
        for (const [bk, bd] of Object.entries(REST.boards)) {
          const d = dist(px, pz, bd.x, bd.z);
          if (d >= 3.1) continue;
          const bObj = rest.boards?.[bk];
          if (bObj) {
            const def = RSC_CRATES[bObj.ing];
            cand(1, d, {
              icon: bObj.state === 'ready' ? (def?.prepIcon || '🥗') : '🔪',
              label: bObj.state === 'ready' ? `Lấy ${def?.name} đã thái` : `Thái nhanh ${def?.name}`,
              run: () => { this.play('till', 0.45); this.send({ type: 'rest.useBoard', board: bk }); },
            });
          } else if (carry.startsWith('raw:')) {
            const def = RSC_CRATES[carry.slice(4)];
            cand(1, d, {
              icon: '🔪',
              label: `Thái ${def?.icon || ''} ${def?.name} trên Thớt`,
              run: () => { this.play('till', 0.5); this.send({ type: 'rest.useBoard', board: bk }); },
            });
          }
        }
        // 5. 6 Thùng Nguyên Liệu (Ingredient Crates)
        for (const [ck, cr] of Object.entries(REST.crates)) {
          const d = dist(px, pz, cr.x, cr.z);
          if (d < 2.65) {
            cand(carry ? 3 : 1, d, {
              icon: cr.icon,
              label: `Lấy ${cr.name}`,
              run: () => { this.play('harvest', 0.45); this.send({ type: 'rest.grabCrate', crate: ck }); },
            });
          }
        }
        // 6. Quầy Trả Món màu đỏ cam (Pass Counter)
        const dPass = dist(px, pz, REST.passCounter.x, REST.passCounter.z);
        if (dPass < 3.4) {
          if (carry.startsWith('dish_')) {
            const rKey = carry.slice(5);
            cand(1, dPass, {
              icon: '🛎️',
              label: `Đặt ${RECIPES[rKey]?.name || 'món'} lên Quầy Trả Món`,
              run: () => { this.play('carry', 0.45); this.send({ type: 'rest.usePass' }); },
            });
          } else if ((rest.pass || []).length > 0) {
            const topDish = rest.pass[0].recipe;
            cand(1, dPass, {
              icon: RECIPES[topDish]?.icon || '🍽️',
              label: `Bưng ${RECIPES[topDish]?.name || 'món'} đi phục vụ`,
              run: () => { this.play('carry', 0.45); this.send({ type: 'rest.usePass' }); },
            });
          }
        }
        // 7. Bồn Rửa Bát (Sink) & Thùng Rác (Trash)
        const dSink = dist(px, pz, REST.sink.x, REST.sink.z);
        if (dSink < 2.9 && (carry === 'dirty_plate' || (rest.cleanPlates ?? 6) < (rest.maxPlates ?? 6))) {
          cand(1, dSink, {
            icon: '🚰',
            label: 'Rửa đĩa bẩn (+18🪙)',
            run: () => { this.play('water', 0.55); this.send({ type: 'rest.useSink' }); },
          });
        }
        const dTrash = dist(px, pz, REST.trash.x, REST.trash.z);
        if (dTrash < 2.4 && carry) {
          cand(2, dTrash, {
            icon: '🗑️',
            label: 'Bỏ đồ đang cầm vào Thùng Rác',
            run: () => { this.play('plant', 0.4); this.send({ type: 'rest.useTrash' }); },
          });
        }
      }
    }
    for (const a of Object.values(st.animals)) {
      if ((a.area === 'house') !== inHouse) continue; const d = dist(px, pz, a.x, a.z); if (d > 3.6) continue;
      if (!this.animal || d < this.animal.d) this.animal = { id: a.id, d, a };
      const def = ANIMALS[a.type], party = a.type === 'chicken' && st.events.party && a._party;
      cand(a.ready || party ? 2 : 6, d, { icon: a.ready ? ITEMS[def.prod.item].icon : party ? '🐔' : '💗', label: party ? 'Bắt gà!' : a.ready ? `Thu ${ITEMS[def.prod.item].name}` : `Vuốt ve ${a.name}`, run: () => { this.play(a.ready ? 'harvest' : 'pet', 0.6); this.send({ type: 'animal.use', id: a.id }); } });
      // Nút "Cho ăn" hiện thẳng trên màn hình khi đứng gần con vật đang đói (không cần đổi sang dụng cụ 🥣)
      if (a.type !== 'dog' && !party && a.hunger >= 0.3) {
        const feedN = bag.feed || 0;
        cand(a.hunger > 0.6 ? 1 : 3, d, { icon: '🥣', label: feedN ? `Cho ${a.name} ăn (còn ${feedN})` : 'Hết thức ăn 🥣 • Mua ở Tạp Hóa', run: () => { this.play('feed', 0.7); this.send({ type: 'animal.feed', id: a.id }); } });
      }
    }
    const curArea = inHouse ? 'house' : 'farm', ox = inHouse ? INTERIOR.ox : 0, oz = inHouse ? INTERIOR.oz : 0;
    for (const f of Object.values(st.furniture)) {
      if (f.area !== curArea) continue;
      const d = dist(px, pz, ox + f.x, oz + f.z);
      if (f.item === 'sofa' && d < 2.6) cand(4, d, { icon: '🛋️', label: 'Ngồi nghỉ trên Sofa', run: () => this.sitOn(f) });
      else if ((f.item === 'chair' || f.item === 'bench') && d < 2.1) cand(4, d, { icon: '🪑', label: `Ngồi ${FURN[f.item].name}`, run: () => this.sitOn(f) });
      else if (f.item === 'tv' && d < 2.6) cand(5, d, { icon: '📺', label: 'Xem TV', run: () => this.watchTv(f) });
    }
    if (!inHouse) {
      for (const n of Object.values(st.npcs)) { const d = dist(px, pz, n.x, n.z); if (d < 3.4) cand(3, d, { icon: NPCS[n.id]?.icon || '💬', label: `Trò chuyện: ${NPCS[n.id]?.name}`, run: () => g.ui.openDialog(n.id) }); }
      for (const f of Object.values(st.forage)) if (f.ready) { const d = dist(px, pz, f.x, f.z); if (d < 2.8) cand(4, d, { icon: ITEMS[f.kind]?.icon || '🌿', label: 'Hái', run: () => { this.play('pet', 0.5); this.send({ type: 'items.forage', id: f.id }); } }); }
      for (const it of g.world.interactables) {
        if (it.kind === 'hint' || it.off) continue; const d = dist(px, pz, it.x, it.z); if (d >= it.r) continue;
        let label = it.label, icon = it.icon, run = () => g.openInteractable(it);
        if (it.kind === 'gate') {
          const P = PENS[it.pen], b = st.buildings[it.pen];
          if (!b?.owned) {
            label = `Mua ${P.name} (${fmt(P.cost)}🪙)`;
            icon = '🏗️';
            run = () => {
              if (st.economy.fund + me.money >= P.cost && st.farm.level >= P.lvl) {
                this.send({ type: 'shop.buy', shop: 'animal', key: 'pen:' + it.pen });
                setTimeout(() => g.ui.open('shop', { shop: 'animal', tab: 'animals' }), 150);
              } else {
                g.ui.open('shop', { shop: 'animal', tab: 'pens' });
              }
            };
          } else {
            label = `${b.open ? 'Đóng' : 'Mở'} cổng ${P.name}`;
            icon = b.open ? '🔒' : '🚪';
            run = () => this.send({ type: 'animal.gate', pen: it.pen });
          }
        } else if (it.kind === 'penManage') {
          const P = PENS[it.pen], b = st.buildings[it.pen];
          if (!b?.owned) {
            label = `Mua ${P.name} (${fmt(P.cost)}🪙)`;
            icon = '🏗️';
            run = () => g.ui.open('shop', { shop: 'animal', tab: 'pens' });
          } else {
            label = `Mua thú / Quản lý ${P.name}`;
            icon = P.icon;
            run = () => g.ui.open('shop', { shop: 'animal', tab: 'animals' });
          }
        } else if (it.kind === 'incubate') {
          const P = PENS[it.pen], b = st.buildings[it.pen];
          if (!b?.owned) continue;
          if (b.inc) {
            label = `Đang ấp trứng (${Math.ceil(b.inc.t)}s) • Xem chuồng`;
            icon = '🐣';
            run = () => g.ui.open('shop', { shop: 'animal', tab: 'animals' });
          } else {
            label = `Ấp trứng nở ${ANIMALS[P.kinds[0]].name} con (40s)`;
            icon = '🐣';
            run = () => this.send({ type: 'animal.incubate', pen: it.pen });
          }
        } else if (it.kind === 'expand') {
          if (st.farm.plotRows >= PLOT.maxRows) continue;
          label = `Mở rộng Khu Ruộng (+${PLOT.cols} ô • ${fmt(expandCost(st.farm.plotRows))}🪙)`;
          icon = '🌾';
          run = () => this.send({ type: 'farm.expand' });
        } else if (it.kind === 'restShift' || it.kind === 'rest2d') {
          label = 'Vào Quán';
          icon = '👨‍🍳';
          run = () => g.rsc2d?.open();
        }
        cand(5, d, { icon, label, run });
      }
    } else {
      const r = interiorRoom(st.farm.houseLevel);
      const door = { x: INTERIOR.ox, z: INTERIOR.oz + r.d / 2 }, kit = { x: INTERIOR.ox + HOME_KITCHEN.x, z: INTERIOR.oz - r.d / 2 + 1.4 };
      let d = dist(px, pz, door.x, door.z); if (d < 2.6) cand(3, d, { icon: '🚪', label: 'Ra ngoài sân', run: () => this.exitHouse() });
      d = dist(px, pz, kit.x, kit.z); if (d < 3.2) cand(4, d, { icon: '🍳', label: 'Nấu ăn ở bếp nhà', run: () => g.ui.open('kitchen', { station: 'home' }) });
      const bed = Object.values(st.furniture).find((f) => f.item === 'bed' && f.area === 'house' && dist(px, pz, INTERIOR.ox + f.x, INTERIOR.oz + f.z) < 3.4);
      if (bed) {
        const sleepOk = this.canSleep(st);
        cand(3, 0.5, { icon: sleepOk ? '🛏️' : '🌞', label: sleepOk ? 'Lên giường nằm ngủ' : 'Giường ngủ (chỉ ngủ tối/trời mưa)', run: () => this.lieOnBed(bed) });
      }
      cand(7, 20, { icon: '🏠', label: 'Nâng cấp / Trang trí Nhà', run: () => g.ui.open('house') });
    }
    this.target = best;
  }
  interact() { const t = this.target; if (!t || this.stun > 0) return; t.run(); }
  enterHouse() { this.sitting = null; this.inBed = null; this.jumpY = 0; this.vy = 0; this.jumping = false; this.g.rig.sleeping = false; const g = this.g, st = g.store.state, r = interiorRoom(st.farm.houseLevel); this.area = 'house'; this.x = INTERIOR.ox; this.z = INTERIOR.oz + r.d / 2 - 1.2; this.rot = Math.PI; this.vx = this.vz = 0; g.setArea('house'); }
  exitHouse() { this.sitting = null; this.inBed = null; this.jumpY = 0; this.vy = 0; this.jumping = false; this.g.rig.sleeping = false; this.area = 'out'; this.x = HOUSE.x; this.z = HOUSE.door.z + 0.2; this.rot = 0; this.vx = this.vz = 0; this.g.setArea('out'); }
  // ---------- hành động theo dụng cụ (có hỗ trợ thông minh cho Mobile Web & Quán Ăn Ready, Set, Cook!) ----------
  action() {
    const g = this.g, st = g.store.state, me = this.me;
    if (!me || this.stun > 0) return;
    if (this.inBed || me.sleeping) { this.startDream(); return; }
    if (this.sitting) { this.standUp(); return; }
    // Khi đang đứng trong Quán Ăn Làng (Ready, Set, Cook!), bấm nút Hành Động (Space / nút xanh) cũng tương tác ngay với Trạm Bếp / Bàn Khách!
    if (this.area === 'out' && inRest(this.x, this.z, 3.0) && this.target && this.target.pri <= 3) {
      this.target.run();
      return;
    }
    if (this.area === 'house' && TOOLS[this.tool] !== 'feed' && TOOLS[this.tool] !== 'weapon') {
      if (this.target) this.target.run();
      else g.ui.open('house');
      return;
    }
    const tool = TOOLS[this.tool], pt = this.plot, c = pt?.c, plant = st.players[me.id].sel;
    if (g.fishGameOn) return;
    switch (tool) {
      case 'hoe':
        if (pt && c?.s === 'ripe') { this.play('harvest', 0.55); this.send({ type: 'farm.harvest', plot: pt.id }); }
        else if (pt && !c) { this.play('till', 0.55); g.audio.sfx('swish'); this.send({ type: 'farm.till', plot: pt.id }); }
        else if (pt && c?.s === 'tilled') {
          this.tool = 2; g.ui.refreshHotbar(); this.play('plant', 0.55); this.send({ type: 'farm.plant', plot: pt.id, crop: plant });
        } else if (pt && c?.s === 'planted' && !(c.w > st.world.t)) {
          this.tool = 1; g.ui.refreshHotbar(); this.play('water', 0.7); this.send({ type: 'farm.water', plot: pt.id });
        } else { this.play('till', 0.55); g.audio.sfx('swish'); }
        break;
      case 'can':
        if (pt && c?.s === 'ripe') { this.play('harvest', 0.55); this.send({ type: 'farm.harvest', plot: pt.id }); }
        else if (pt && c) { this.play('water', 0.7); this.send({ type: 'farm.water', plot: pt.id }); }
        else if (pt && !c) {
          this.tool = 0; g.ui.refreshHotbar(); this.play('till', 0.55); g.audio.sfx('swish'); this.send({ type: 'farm.till', plot: pt.id });
        } else this.play('water', 0.5);
        break;
      case 'seeds':
        if (pt && c?.s === 'ripe') { this.play('harvest', 0.55); this.send({ type: 'farm.harvest', plot: pt.id }); }
        else if (pt && c?.s === 'tilled') { this.play('plant', 0.55); this.send({ type: 'farm.plant', plot: pt.id, crop: plant }); }
        else if (pt && !c) {
          this.tool = 0; g.ui.refreshHotbar(); this.play('till', 0.55); g.audio.sfx('swish'); this.send({ type: 'farm.till', plot: pt.id });
        } else if (pt && c?.s === 'planted' && !(c.w > st.world.t)) {
          this.tool = 1; g.ui.refreshHotbar(); this.play('water', 0.7); this.send({ type: 'farm.water', plot: pt.id });
        } else this.play('plant', 0.4);
        break;
      case 'feed': if (this.animal) { this.play('feed', 0.7); this.send({ type: 'animal.feed', id: this.animal.id }); } else g.ui.toast('Lại gần con vật rồi cho ăn 🥣', 'info'); break;
      case 'rod': { const f = me.fishing; if (!f) { this.play('cast', 0.7); this.send({ type: 'fish.cast' }); } else if (f.phase === 'bite') { this.send({ type: 'fish.reel' }); } else if (f.phase === 'wait') this.send({ type: 'fish.reel' }); break; }
      case 'weapon': this.play('attack', 0.45); g.audio.sfx('swish'); this.send({ type: 'combat.swing', rot: this.rot }); break;
    }
  }
}
