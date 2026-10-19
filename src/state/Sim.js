// SIM: logic game thuần (không three/DOM). Host chạy Sim; client chỉ gửi command.
// Sau này chuyển sang server: chạy đúng file này trên Node + transport WebSocket.
import { EventBus } from '../core/EventBus.js';
import { Rng, dist, timeInfo } from '../core/util.js';
import { CFG } from '../core/Config.js';
import { SPOTS } from '../data/layout.js';
import { createPlayer, migrate, STARTER_FURNITURE } from './GameState.js';
import { addTo, takeFrom, has } from '../inventory/Inventory.js';
import { ClockSystem } from '../world/WorldClock.js';
import { ProgressionSystem } from '../progression/Progression.js';
import { EconomySystem } from '../economy/Economy.js';
import { ShopSystem } from '../shop/ShopSystem.js';
import { FarmingSystem } from '../farming/FarmingSystem.js';
import { AnimalSystem } from '../animals/AnimalSystem.js';
import { FishingSystem } from '../fishing/FishingSystem.js';
import { ThiefSystem } from '../thief/ThiefSystem.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { RestaurantSystem } from '../restaurant/RestaurantSystem.js';
import { FurnitureSystem } from '../furniture/FurnitureSystem.js';
import { QuestSystem } from '../quests/QuestSystem.js';
import { EventSystem } from '../events/EventSystem.js';
import { NpcSystem } from '../npc/NpcSystem.js';
import { WorldItemsSystem } from '../inventory/WorldItemsSystem.js';
import { WeatherSystem } from '../world/WeatherSystem.js';
import { ZombieSystem } from '../zombie/ZombieSystem.js';

export class Sim {
  constructor(store, opts = {}) {
    this.store = store;
    this.bus = new EventBus();         // 'fx' (hiệu ứng) và 'game' (sự kiện gameplay cho quest/tutorial)
    this.rng = new Rng(opts.seed ?? store.state.meta.seed ?? Date.now());
    this.poses = {};                   // pid -> {x,z,rot,area,anim,tool} (tạm thời, không lưu)
    this.systems = {}; this.handlers = {};
    this.ti = timeInfo(store.state.world.t, CFG);
    const list = [ClockSystem, WeatherSystem, ZombieSystem, ProgressionSystem, EconomySystem, ShopSystem, FarmingSystem, AnimalSystem, FishingSystem, ThiefSystem, CombatSystem, RestaurantSystem, FurnitureSystem, QuestSystem, EventSystem, NpcSystem, WorldItemsSystem];
    for (const C of list) {
      const s = new C(this); this.systems[s.id] = s;
      for (const [name, fn] of Object.entries(s.cmds || {})) this.handlers[`${s.id}.${name}`] = fn.bind(s);
    }
    if (store.state.meta.fresh) this.bootstrap();
  }
  get st() { return this.store.state; }
  sys(id) { return this.systems[id]; }

  bootstrap() {
    const st = this.st; st.meta.fresh = false;
    this.systems.animal.bootstrap(); this.systems.npc.bootstrap(); this.systems.items.bootstrap();
    this.systems.quest.newDay(); this.systems.economy.newDay();
    // Trang bị sẵn nội thất đầy đủ, ấm cúng và cân đối từ STARTER_FURNITURE
    Object.assign(st.furniture, JSON.parse(JSON.stringify(STARTER_FURNITURE)));
  }
  reload() { migrate(this.st); this.ti = timeInfo(this.st.world.t, CFG); }   // sau khi load save

  // ---- người chơi ----
  addPlayer(profile) {
    const st = this.st; let p = st.players[profile.id];
    if (p) { p.connected = true; if (profile.name) p.name = profile.name.slice(0, 14); }
    else {
      const used = new Set(Object.values(st.players).map((x) => x.slot));
      let slot = 0; while (used.has(slot)) slot++;
      p = st.players[profile.id] = createPlayer(profile.id, profile, slot, st.farm.level);
      st.inventory.players[profile.id] = { seed_carrot: 9, seed_potato: 3, feed: 10 };
      if (!st.meta.hostId) st.meta.hostId = profile.id;
    }
    this.poses[profile.id] = this.poses[profile.id] || { x: SPOTS.spawn.x + p.slot * 1.4 - 2, z: SPOTS.spawn.z, rot: 0, area: 'out', anim: 'idle', tool: 0 };
    this.touch('players.' + p.id); this.touch('inventory.players.' + p.id);
    return p;
  }
  removePlayer(pid) {
    const p = this.st.players[pid]; if (!p) return;
    p.connected = false; p.sleeping = false; delete p.fishing; this.touch('players.' + pid); delete this.poses[pid]; this.systems.clock.checkSkip();
  }
  connected() { return Object.values(this.st.players).filter((p) => p.connected); }
  setPose(pid, pose) { const c = this.poses[pid] || (this.poses[pid] = {}); Object.assign(c, pose); }
  pos(pid) { return this.poses[pid] || SPOTS.spawn; }
  near(pid, x, z, r) { const p = this.pos(pid); return dist(p.x, p.z, x, z) <= r; }
  activePlayers() { return this.connected().map((p) => ({ id: p.id, ...this.pos(p.id) })); }

  // ---- inventory helpers (có touch) ----
  bag(pid) { return (this.st.inventory.players[pid] ??= {}); }
  addItem(pid, id, n = 1) { addTo(this.bag(pid), id, n); this.touch('inventory.players.' + pid); }
  takeItem(pid, id, n = 1) { const ok = takeFrom(this.bag(pid), id, n); if (ok) this.touch('inventory.players.' + pid); return ok; }
  hasItem(pid, id, n = 1) { return has(this.bag(pid), id, n); }

  // ---- phát sự kiện ----
  touch(path) { this.store.touch(path); }
  fx(o) { this.bus.emit('fx', o); }
  toast(pid, text, tone = 'info') { this.fx({ k: 'toast', to: pid, text, tone }); }
  game(e) { this.bus.emit('game', e); }
  eventActive(type) { return this.st.events.active.find((e) => e.type === type) || null; }

  // ---- command ----
  exec(pid, cmd) {
    const h = this.handlers[cmd?.type];
    if (!h) return { ok: false, msg: 'Lệnh không hợp lệ' };
    if (!this.st.players[pid]) return { ok: false, msg: 'Người chơi không tồn tại' };
    let r;
    try { r = h(pid, cmd) || { ok: true }; } catch (e) { console.warn('[sim] lỗi lệnh', cmd.type, e); r = { ok: false, msg: 'Có lỗi nhỏ, thử lại nhé' }; }
    if (r.ok === false && r.msg) this.toast(pid, r.msg, 'warn');
    return r;
  }

  tick(dt) {
    this.ti = timeInfo(this.st.world.t, CFG);
    this.systems.clock.tick(dt);
    this.systems.weather.tick(dt);
    this.systems.farm.tick(dt);
    this.systems.animal.tick(dt);
    this.systems.fish.tick(dt);
    this.systems.thief.tick(dt);
    this.systems.zombie.tick(dt);
    this.systems.rest.tick(dt);
    this.systems.event.tick(dt);
    this.systems.npc.tick(dt);
    this.systems.items.tick(dt);
  }
  newDay() {
    for (const k in this.systems) this.systems[k].newDay?.();
    this.game({ type: "new_day", day: this.st.world.day, season: this.st.world.season });
  }
}
