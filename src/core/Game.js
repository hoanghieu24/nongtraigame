import * as THREE from 'three';
import { Gfx } from './Graphics.js'; import { CameraRig } from './CameraRig.js'; import { Input } from './Input.js'; import { CFG } from './Config.js'; import { timeInfo, clamp } from './util.js';
import { Store } from '../state/Store.js'; import { createGameState } from '../state/GameState.js'; import { Sim } from '../state/Sim.js';
import { VP } from './Viewport.js';
import { FX } from '../art/FX.js'; import { toolMesh } from '../art/Characters.js'; import { World } from '../world/World.js';
import { CropView } from '../farming/CropView.js'; import { AnimalView } from '../animals/AnimalView.js'; import { PlayerView, TOOLS } from '../player/PlayerView.js'; import { LocalPlayer } from '../player/LocalPlayer.js';
import { ZombieView } from '../zombie/ZombieView.js'; import { NpcView } from '../npc/NpcView.js'; import { ThiefView } from '../thief/ThiefView.js'; import { FurnitureView } from '../furniture/FurnitureView.js'; import { RestaurantView } from '../restaurant/RestaurantView.js'; import { EventView } from '../events/EventView.js';
import { ReadySetCook2D } from '../restaurant/ReadySetCook2D.js';
import { Session } from '../multiplayer/Session.js'; import { SaveSystem } from '../save/SaveSystem.js'; import { AudioSys } from '../audio/Audio.js';
import { furnValid, wallZ } from '../furniture/FurnitureSystem.js'; import { FURN } from '../data/furniture.js'; import { INTERIOR, HOUSE, REST, AREAS, groundY, riverZ, interiorRoom } from '../data/layout.js';

const DEF_SET = { gfx: 'auto', master: 0.85, music: 0.5, sfx: 0.9, view: '3D', fov: 54, sens: 1.0, smooth: 0.8 };
const _focusV = new THREE.Vector3();
export class Game {
  constructor(canvas) {
    this.canvas = canvas; this.params = new URLSearchParams(location.search); this.debug = this.params.has('debug');
    let s = {}; try { s = JSON.parse(localStorage.getItem('ffp.settings')) || {}; } catch { /* ignore */ }
    if (s.fov === 64) s.fov = 54;
    this.settings = { ...DEF_SET, ...s }; if (this.params.get('q')) this.settings.gfx = this.params.get('q');
    this.gfx = new Gfx(canvas, this.settings.gfx); this.rig = new CameraRig(innerWidth / innerHeight); this.rig.applyPrefs(this.settings); this.gfx.scene.add(this.rig.persp);
    this.store = new Store(createGameState()); this.sim = new Sim(this.store, { seed: 11 });   // sim "nền" cho màn hình menu
    this.audio = new AudioSys(); this.audio.setVol(this.settings); this.save = new SaveSystem(); this.session = new Session(this);
    this.mode = 'menu'; this.view = '3D'; this.myId = ''; this.area = 'out'; this.t = 0; this.last = performance.now(); this.lastStep = this.last; this.autosaveT = 0; this.fishGameOn = false; this.build = { on: false, item: null, sel: null, rot: 0, pin: null, valid: false, moving: null }; this.interior = false;
  }
  init(ui) {
    this.ui = ui; this.fx = new FX(this.gfx.scene, ui); this.world = new World(this.gfx, this.fx);
    this.ctx = { scene: this.gfx.scene, store: this.store, gfx: this.gfx, fx: this.fx, world: this.world, localPos: { x: 0, z: 0 } };
    const c = this.ctx; this.views = { crop: new CropView(c), animal: new AnimalView(c), player: new PlayerView(c), npc: new NpcView(c), thief: new ThiefView(c), zombie: new ZombieView(c), furn: new FurnitureView(c), rest: new RestaurantView(c), ev: new EventView(c) };
    this.input = new Input(this.canvas); this.local = new LocalPlayer(this); this.rsc2d = new ReadySetCook2D(this); this.hookInput(); this.setupInteractables();
    this.fpTool = new THREE.Group(); this.rig.persp.add(this.fpTool); this.fpTool.visible = false; this.fpKey = '';
    this.resize();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(true); }); addEventListener('beforeunload', () => { this.persist(true); this.session.stop(); });
    setInterval(() => { if (document.hidden) this.stepSession(); }, 250);       // host vẫn chạy khi tab nền
    if (this.debug) window.__ffp = this;
    requestAnimationFrame(this.loop);
  }
  setupInteractables() {
    const w = this.world; w.interactables.push(
      { id: 'house', kind: 'house', x: HOUSE.x, z: -12.3, r: 2.5, icon: '🏠', label: 'Vào nhà' },
      { id: 'rest', kind: 'rest2d', x: REST.entrance.x, z: REST.entrance.z + 0.6, r: 4.5, icon: '👨‍🍳', label: 'Bước vào Quán Ăn (Ready, Set, Cook!)' },
      { id: 'rest2', kind: 'rest2d', x: REST.counter.x, z: REST.counter.z + 2.3, r: 3.8, icon: '🍳', label: 'Vào Bếp Ready, Set, Cook!' }
    );
  }
  openInteractable(it) {
    const u = this.ui;
    switch (it.kind) {
      case 'chest': u.open('chest'); break;
      case 'sell': u.open('sell', { at: it.at }); break;
      case 'shop': u.open('shop', { shop: it.shop }); break;
      case 'quests': u.open('quests'); break;
      case 'house': this.local.enterHouse(); break;
      case 'houseUp': u.open('house'); break;
      case 'rest2d':
      case 'restShift': this.rsc2d.open(); break;
      case 'rest': u.open('kitchen', { station: 'rest' }); break;
    }
  }
  // ---------- nhập liệu ----------
  hookInput() {
    const i = this.input, g = this;
    i.cb.action = () => g.mode === 'play' && !g.rsc2d?.active && (g.build.on ? g.placeBuild() : g.local.action());
    i.cb.space = () => g.mode === 'play' && !g.rsc2d?.active && (g.build.on ? g.placeBuild() : g.local.jump());
    i.cb.interact = () => g.mode === 'play' && !g.rsc2d?.active && g.local.interact();
    i.cb.tool = (n) => !g.rsc2d?.active && g.setTool(n);
    i.cb.rotate = () => g.rotateBuild(); i.cb.view = () => g.cycleView(); i.cb.build = () => g.toggleBuild(); i.cb.panel = (n) => g.ui.toggle(n); i.cb.chat = () => g.ui.focusChat(); i.cb.escape = () => g.escape(); i.cb.fullscreen = () => g.fullscreen();
    i.cb.zoom = (f) => g.rig.zoomBy(f); i.cb.dragLook = () => !g.build.on && !g.rsc2d?.active; i.cb.buildActive = () => g.build.on; i.cb.touchFree = () => false;
    i.cb.tap = (x, y, type, btn) => g.onTap(x, y, type, btn);
    this.canvas.addEventListener('pointermove', (e) => { if (g.build.on && g.build.item && e.pointerType === 'mouse' && e.buttons === 0) g.pinFromScreen(e.clientX, e.clientY); });
  }
  onTap(x, y, type, btn) {
    if (this.mode !== 'play' || this.rsc2d?.active) return; const b = this.build;
    if (b.on) {
      if (b.item) { this.pinFromScreen(x, y); if (type === 'mouse' && btn === 0) this.placeBuild(); }
      else { const p = this.rig.groundPoint(x, y, VP.vw, VP.vh, 0); if (p) this.selectFurnAt(p.x, p.z); }
      return;
    }
    if (type === 'touch' && this.view !== 'FP') {
      const p = this.rig.groundPoint(x, y, VP.vw, VP.vh, 0);
      if (!p) return;
      const l = this.local;
      if (l.plot && Math.hypot(p.x - l.plot.x, p.z - l.plot.z) < 2.1) { l.action(); return; }
      if (l.target && l.target.pri < 7 && Math.hypot(p.x - l.x, p.z - l.z) < 4.5) { l.interact(); }
    }
  }
  pinFromScreen(x, y) { if (this.view === 'FP') return; const p = this.rig.groundPoint(x, y, VP.vw, VP.vh, 0); if (p) this.build.pin = { x: p.x, z: p.z }; }
  setTool(n) {
    const l = this.local, me = l.me; if (!me || this.mode !== 'play') return;
    if (l.tool === n && n === 2) this.ui.open('seeds'); else if (l.tool === n && n === 5) { const w = me.weapons, k = (w.indexOf(me.weapon) + 1) % w.length; this.session.send({ type: 'items.weapon', id: w[k] }); }
    l.tool = n; this.audio.sfx('click'); this.ui.refreshHotbar(); this.ui.flashTool(n); if (this.build.on) this.closeBuild();
  }
  escape() { if (this.rsc2d?.active) { this.rsc2d.close(); return; } if (this.build.on && (this.build.item || this.build.sel)) { this.cancelBuild(); return; } if (this.ui.panel) this.ui.close(); else if (this.build.on) this.closeBuild(); else if (document.pointerLockElement) document.exitPointerLock(); }
  fullscreen() { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.().catch(() => {}); }
  resize() { if (!this.gfx) return; const { w, h } = this.gfx.resize(); this.rig.resize(w / h); this.fx?.update(0, this.rig.cam); }
  // ---------- camera/view ----------
  setView(v) {
    if (v === this.view && this.rig.mode === v) return; this.view = v; this.settings.view = v; this.rig.setMode(v); this.gfx.setMode2D(v === '2D'); this.world.applyMode(v === '2D'); this.views.player.hideLocal = v === 'FP'; this.input.fp = v === 'FP';
    if (v === 'FP') { this.rig.fpPitch = this.rig.tFpPitch = 0; this.rig.tYaw = this.rig.yaw = this.local.rot - Math.PI; } else if (this.rig.persp.parent && document.pointerLockElement) document.exitPointerLock();
    if (v === '3D') this.rig.tYaw = this.rig.yaw = this.local.rot - Math.PI;
    this.fpTool.visible = v === 'FP'; this.ui.refreshView(); this.persistSettings();
  }
  cycleView() { this.setView(this.view === '3D' ? 'FP' : this.view === 'FP' ? '2D' : '3D'); this.ui.toast({ '3D': '🎥 Góc nhìn 3D cận cảnh HD', FP: '👁️ Góc nhìn FPS (vừa đi vừa xoay màn hình)', '2D': '🗺️ Chế độ 2D siêu nhẹ' }[this.view], 'info'); }
  cycleZoom() {
    if (this.view !== '3D') this.setView('3D');
    const msg = this.rig.cycleZoomPreset();
    this.ui.toast(msg, 'info');
  }
  setArea(a) {
    this.area = a; this.rig.interior = a === 'house';
    this.audio.indoor = a === 'house';
    if (this.view === 'FP') { this.rig.fpPitch = this.rig.tFpPitch = 0; this.rig.tYaw = this.rig.yaw = this.local.rot - Math.PI; }
    this.ui.fade(); this.audio.sfx('door');
    if (a === 'out') this.ui.close();
  }
  setQuality(v) { this.settings.gfx = v; this.gfx.setPref(v); this.persistSettings(); }
  setCamPref(k, v) {
    this.settings[k] = v;
    this.rig.applyPrefs(this.settings);
    this.persistSettings();
  }
  resetCamPrefs() {
    Object.assign(this.settings, { fov: 54, sens: 1.0, smooth: 0.8 });
    this.rig.applyPrefs(this.settings);
    this.persistSettings();
  }
  persistSettings() { try { localStorage.setItem('ffp.settings', JSON.stringify(this.settings)); } catch { /* ignore */ } }
  // ---------- xây dựng / trang trí ----------
  toggleBuild() { if (this.mode !== 'play') return; this.build.on ? this.closeBuild() : this.openBuild(); }
  openBuild() { this.build.on = true; this.build.item = this.build.sel = this.build.moving = null; this.build.pin = null; this.local.tool = 5; this.ui.open('build'); this.ui.refreshHotbar(); }
  closeBuild() { Object.assign(this.build, { on: false, item: null, sel: null, moving: null, pin: null }); this.views.furn.hideGhost(); this.views.furn.clearHighlight(); if (this.ui.panel === 'build') this.ui.close(); }
  pickBuildItem(item) { Object.assign(this.build, { item, sel: null, moving: null, rot: 0, pin: null }); this.views.furn.clearHighlight(); this.ui.render(); }
  cancelBuild() { Object.assign(this.build, { item: null, sel: null, moving: null, pin: null }); this.views.furn.hideGhost(); this.views.furn.clearHighlight(); this.ui.render(); }
  rotateBuild() { const b = this.build; if (!b.on) return; if (b.item) b.rot = (b.rot + 1) % 4; else if (b.sel) { const f = this.store.state.furniture[b.sel]; if (f) this.session.send({ type: 'furn.move', id: b.sel, x: f.x, z: f.z, rot: (f.rot + 1) % 4 }); } }
  selectFurnAt(x, z) {
    const st = this.store.state, area = this.area === 'house' ? 'house' : 'farm', ox = area === 'house' ? INTERIOR.ox : 0, oz = area === 'house' ? INTERIOR.oz : 0; let best = null, bd = 99;
    for (const f of Object.values(st.furniture)) { if (f.area !== area) continue; const d = Math.hypot(ox + f.x - x, oz + f.z - z), r = Math.max(FURN[f.item].w, FURN[f.item].d) / 2 + 0.6; if (d < r && d < bd) { best = f; bd = d; } }
    this.build.sel = best?.id || null; this.ui.render(); if (!best) this.views.furn.clearHighlight();
  }
  moveSel() { const b = this.build, f = this.store.state.furniture[b.sel]; if (!f) return; const ox = f.area === 'house' ? INTERIOR.ox : 0, oz = f.area === 'house' ? INTERIOR.oz : 0; Object.assign(b, { item: f.item, moving: f.id, rot: f.rot, pin: { x: ox + f.x, z: oz + f.z }, sel: null }); this.views.furn.clearHighlight(); this.ui.render(); }
  removeSel() { const b = this.build; if (b.sel) { this.session.send({ type: 'furn.remove', id: b.sel }); b.sel = null; this.views.furn.clearHighlight(); this.ui.render(); } }
  placeBuild() {
    const b = this.build; if (!b.on || !b.item) return; if (!b.valid) { this.ui.toast('Chỗ này vướng rồi — thử chỗ khác nhé!', 'warn'); this.audio.sfx('fail'); return; }
    const c = b.cur; this.session.send(b.moving ? { type: 'furn.move', id: b.moving, x: c.x, z: c.z, rot: b.rot } : { type: 'furn.place', item: b.item, area: c.area, x: c.x, z: c.z, rot: b.rot });
    if (b.moving) { b.moving = null; b.item = null; b.pin = null; this.views.furn.hideGhost(); this.ui.render(); }
  }
  updateBuild(st) {
    const b = this.build, fv = this.views.furn; if (!b.on) return;
    if (b.sel) fv.highlight(b.sel);
    if (!b.item) { fv.hideGhost(); return; }
    const def = FURN[b.item], l = this.local, area = this.area === 'house' ? 'house' : 'farm', ox = area === 'house' ? INTERIOR.ox : 0, oz = area === 'house' ? INTERIOR.oz : 0;
    let wx, wz; if (b.pin && this.view !== 'FP') { wx = b.pin.x; wz = b.pin.z; } else { wx = l.x + Math.sin(l.rot) * 3.2; wz = l.z + Math.cos(l.rot) * 3.2; }
    let x = Math.round((wx - ox) * 2) / 2, z = Math.round((wz - oz) * 2) / 2; if (def.wall && area === 'house') z = wallZ(st.farm.houseLevel);
    const areaOk = def.areas.includes(area); b.valid = areaOk && furnValid(st, def, area, x, z, b.rot, b.moving); b.cur = { x, z, area };
    fv.showGhost(b.item, area, x, z, b.rot, b.valid);
  }
  // ---------- luồng chơi ----------
  stepSession() {
    const now = performance.now(), el = Math.min(1, (now - this.lastStep) / 1000); this.lastStep = now;
    if (this.mode !== 'play') return;
    this.session.tick(el);
    if (document.hidden) {
      if (this.session.isHost && this.rsc2d?.active) {
        // Keep the shared kitchen running when the host switches tabs, without drawing.
        for (let left = el; left > 1e-6;) { const step = Math.min(0.1, left); this.rsc2d.update(step, false); left -= step; }
      }
      this.autosaveT += el;
      if (this.autosaveT >= CFG.AUTOSAVE_S) { this.autosaveT = 0; this.persist(false); }
    }
  }
  async startFarm({ profile, farmName, state }) {
    this.myId = profile.id; this.session.startHost({ profile, farmName, state }); this.afterStart(); this.persist(false);
  }
  async joinFarm(code, profile) { this.myId = profile.id; await this.session.join(code, profile); }
  onJoined() { this.afterStart(); this.ui.toast('🎉 Đã vào nông trại của bạn bè! Tiến độ được lưu trên máy bạn', 'good'); setTimeout(() => this.persist(false), 1500); }
  afterStart() {
    this.myId = this.session.myId; this.mode = 'play'; this.local.spawn(); this.audio.init();
    this.rsc2d?.resetState();
    this.rig.applyPrefs(this.settings);
    this.setView(this.settings.view === 'FP' ? '3D' : this.settings.view);
    this.ui.enterGame();
    this.rig.tYaw = this.rig.yaw = 0.08;
    this.rig.tPitch = this.rig.pitch = this.input.mobile ? 0.56 : 0.58;
    this.rig.tDist = this.rig.dist = this.input.mobile ? 13.8 : 15.0;
    this.autosaveT = 0; this.lastStep = performance.now();
  }
  onDisconnected() { this.ui.toast('Mất kết nối với chủ farm 😢', 'warn'); this.backToMenu(); }
  backToMenu() { if (this.rsc2d?.active) this.rsc2d.close(); this.persist(false); this.session.stop(); this.mode = 'menu'; this.store.replace(createGameState()); this.sim = new Sim(this.store, { seed: 11 }); this.closeBuild(); this.setView('3D'); this.area = 'out'; this.rig.interior = false; this.rig.sleeping = false; this.ui.exitGame(); }
  persist(sync) { if (this.mode !== 'play' || this.session.role === 'none') return; const role = this.session.role === 'host' ? 'host' : 'guest'; if (sync) this.save.saveSync(this.store.state, role); else this.save.save(this.store.state, role); }
  onChat(m) { this.ui.chatAdd(m); this.views.player.say(m.from, m.text); if (/^(😘|💋|❤️|🥰|😍|💕|🤗|🫂)$/.test(m.text)) { const ps = this.poses()[m.from]; if (ps) { this.fx.burst('hearts', ps.x, 2.8, ps.z, 5); this.audio.sfx('pop', ps.x, ps.z); } } }
  startFishGame(f) { if (this.fishGameOn) return; this.fishGameOn = true; this.ui.fish.start(f.diff ?? 0.3, (win) => { this.fishGameOn = false; this.session.send({ type: 'fish.finish', win }); }); }
  async confetti() { try { const { default: c } = await import('canvas-confetti'); c({ particleCount: 40, spread: 70, origin: { y: 0.55 }, disableForReducedMotion: true, ticks: 120 }); } catch { /* ignore */ } }
  handleFx(f) {
    const a = this.audio, fx = this.fx;
    switch (f.k) {
      case 'toast': this.ui.toast(f.text, f.tone); break; case 'float': fx.float(f.x, f.y ?? 2, f.z, f.text, f.color); break; case 'burst': fx.burst(f.kind, f.x, f.y ?? 1, f.z, f.n); break;
      case 'sfx': a.sfx(f.name, f.x, f.z); break; case 'banner': this.ui.banner(f.text, f.sub, f.tone); if (f.tone === 'level') a.sfx('levelup'); break; case 'confetti': this.confetti(); break; case 'lightning': if (this.area !== 'house') this.world.sky.flash = 1; setTimeout(() => this.audio.sfx('thunder'), 250 + Math.random() * 1100); break; case 'shake': fx.addShake(f.amt); break;
      case 'knock': this.local.knock(f.dx, f.dz, f.power); break; case 'say': fx.float(f.x, 3.8, f.z, f.text, '#fff'); break; case 'fishjump': fx.burst('splash', f.x, 0.4, f.z + 2, 10); break;
      case 'areaUnlock': this.ui.banner('🗝️ Khu vực mới mở khoá!', AREAS[f.area].name, 'good'); this.world.gates?.[f.area] && (this.world.gates[f.area].visible = false); break;
    }
  }
  poses() { if (this.session.role === 'host') return this.sim.poses; return { ...this.session.remotePoses, [this.myId]: this.local.pose }; }
  // ---------- vòng lặp ----------
  loop = (now) => {
    const frameDt = Math.max(0, (now - this.last) / 1000); this.last = now;
    // Hidden tabs keep their shared simulation alive via stepSession's background timer.
    if (!document.hidden) {
      if (this.debug) window.__frames = (window.__frames || 0) + 1;
      try { this.update(Math.min(0.1, frameDt), frameDt); }
      catch (e) { if (!this._err) { this._err = 1; console.error('[game]', e); } }
    }
    requestAnimationFrame(this.loop);
  };
  update(dt, frameDt = dt) {
    this.t += dt; const st = this.store.state, rig = this.rig, play = this.mode === 'play';
    if (play) this.stepSession(); else this.sim.tick(dt);
    const ti = timeInfo(st.world.t, CFG);
    if (play) {
      this.autosaveT += dt;
      if (this.autosaveT >= CFG.AUTOSAVE_S) { this.autosaveT = 0; this.persist(false); }
    }
    if (play && this.rsc2d?.active) {
      this.rsc2d.update(dt);
      this.audio.tick(dt, { hour: ti.hour, rain: false, wind: false, river: 0, night: ti.night, indoor: true });
      this.ui.update(dt, ti);
      return;
    }
    const l = this.local; if (play) { l.update(dt); this.ctx.localPos = l.pose; }
    const lk = this.input.consumeLook();
    if ((lk.x || lk.y) && play) rig.look(lk.x, lk.y);
    if (play && this.view === '3D' && !this.input.mobile) { const ck = this.input.camKeys(); if (ck) rig.rotate(ck * dt * 1.9); }
    if (play) {
      const fz = l.inBed ? INTERIOR.oz + l.inBed.bz : l.z;
      const baseY = l.area === 'out' ? groundY(l.x, l.z) : 0;
      _focusV.set(l.x, baseY + (rig.mode === 'FP' ? (l.jumpY || 0) : (l.jumpY || 0) * 0.45), fz);
    } else {
      rig.tYaw += dt * 0.045; rig.tDist = 19.5; rig.tPitch = 0.56; _focusV.set(1, 0, -5); rig.interior = false; rig.sleeping = false;
    }
    rig.update(dt, _focusV, this.fx.shake, play ? l.pose.spd : 0);
    const area = play ? l.area : 'out', f2 = rig.target;
    this.world.sync(st); this.world.update(dt, ti.hour, st.world.weather, rig.mode === 'FP' ? _focusV : f2, rig.cam, rig.mode === '2D', this.t);
    const v = this.views; v.crop.update(dt, st, this.t); v.animal.update(dt, st, this.t, f2, rig.cam); v.player.update(dt, st, play ? this.poses() : {}, this.myId, area, this.t);
    v.npc.update(dt, st, this.t, f2, rig.cam, area); v.thief.update(dt, st, this.t, area); v.zombie.update(dt, st, this.t, area); v.furn.update(dt, st, this.t, area, f2); v.rest.update(dt, st, this.t, area); v.ev.update(dt, st, this.t, f2, area);
    if (play) { v.crop.setTarget(l.plot && area === 'out' && TOOLS[l.tool] !== 'feed' && TOOLS[l.tool] !== 'rod' && TOOLS[l.tool] !== 'weapon' ? l.plot.x : null, l.plot?.z, l.plot?.c?.s === 'ripe' ? 0xffe066 : TOOLS[l.tool] === 'can' ? 0x7fd0ff : 0xffffff); this.updateBuild(st); this.fpToolUpdate(dt, st); } else v.crop.setTarget(null);
    this.fx.update(dt, rig.cam); this.gfx.governor(frameDt);
    this.audio.listener.x = f2.x; this.audio.listener.z = f2.z;
    const rd = play && area === 'out' ? Math.abs(l.z - riverZ(l.x)) : 99;
    this.audio.tick(dt, {
      hour: ti.hour,
      rain: ['rain', 'storm'].includes(st.world.weather),
      wind: ['storm', 'snow'].includes(st.world.weather),
      river: rd < 22 ? 1 - rd / 22 : 0,
      night: ti.night,
      indoor: area === 'house',
    });
    if (play) { const me = l.me; if (me?.fishing?.phase === 'reel' && !this.fishGameOn) this.startFishGame(me.fishing); if (!me?.fishing && this.fishGameOn) { this.fishGameOn = false; this.ui.fish.stop(); } }
    this.ui.update(dt, ti);
    this.gfx.renderer.render(this.gfx.scene, rig.cam);
  }
  fpToolUpdate(dt, st) {
    if (this.view !== 'FP') return; const l = this.local, me = l.me; if (!me) return;
    if (l.inBed || me.sleeping) { this.fpTool.visible = false; return; }
    this.fpTool.visible = true;
    const tool = TOOLS[l.tool], key = tool + me.weapon;
    if (key !== this.fpKey) { this.fpKey = key; this.fpTool.clear(); if (tool !== 'none') { const m = toolMesh(tool, me.weapon); m.scale.setScalar(0.5); this.fpTool.add(m); } }
    const sw = l.actT > 0 ? Math.sin((1 - l.actT / (l.actDur || 0.5)) * Math.PI) : 0, bob = Math.sin(this.t * 9) * 0.02 * l.pose.spd;
    this.fpTool.position.set(0.55, -0.55 + bob - sw * 0.1, -1.0 + sw * -0.25); this.fpTool.rotation.set(-0.6 - sw * 1.1, -0.35, 0.1);
  }
}
