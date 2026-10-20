import { CFG } from '../core/Config.js';
import { PLOT } from '../data/layout.js';
import { PRESETS, HATS } from '../data/characters.js';
import { WEAPONS } from '../data/weapons.js';

export const STARTER_FURNITURE = {
  f_bed0:       { id: 'f_bed0',       item: 'bed',       area: 'house', x: 4.5,  z: -3.0, rot: 0 },
  f_rug0:       { id: 'f_rug0',       item: 'rug',       area: 'house', x: 0,    z: 0,    rot: 0 },
  f_table0:     { id: 'f_table0',     item: 'table',     area: 'house', x: -3.6, z: 1.4,  rot: 0 },
  f_chair0:     { id: 'f_chair0',     item: 'chair',     area: 'house', x: -3.6, z: 0.0,  rot: 0 },
  f_chair1:     { id: 'f_chair1',     item: 'chair',     area: 'house', x: -3.6, z: 2.8,  rot: 2 },
  f_chair2:     { id: 'f_chair2',     item: 'chair',     area: 'house', x: -5.0, z: 1.4,  rot: 1 },
  f_chair3:     { id: 'f_chair3',     item: 'chair',     area: 'house', x: -2.2, z: 1.4,  rot: 3 },
  f_sofa0:      { id: 'f_sofa0',      item: 'sofa',      area: 'house', x: 3.6,  z: 1.8,  rot: 0 },
  f_tv0:        { id: 'f_tv0',        item: 'tv',        area: 'house', x: 3.6,  z: 3.3,  rot: 2 },
  f_bookshelf0: { id: 'f_bookshelf0', item: 'bookshelf', area: 'house', x: 1.4,  z: -4.4, rot: 0 },
  f_cabinet0:   { id: 'f_cabinet0',   item: 'cabinet',   area: 'house', x: -0.8, z: -4.4, rot: 0 },
  f_lamp0:      { id: 'f_lamp0',      item: 'lamp',      area: 'house', x: 3.0,  z: -4.2, rot: 0 },
  f_plant0:     { id: 'f_plant0',     item: 'plant',     area: 'house', x: -5.1, z: -3.1, rot: 0 },
  f_plant1:     { id: 'f_plant1',     item: 'plant',     area: 'house', x: 1.8,  z: 3.3,  rot: 0 },
  f_painting0:  { id: 'f_painting0',  item: 'painting',  area: 'house', x: 4.5,  z: -4.7, rot: 0 },
  f_clock0:     { id: 'f_clock0',     item: 'clock',     area: 'house', x: 2.7,  z: -4.7, rot: 0 },
};

// Toàn bộ trạng thái game: thuần JSON => save/load/đồng bộ mạng/đưa lên server đều dễ.
export function createGameState({ farmName = 'Nông Trại Gia Đình', hostId = '', roomCode = '' } = {}) {
  return {
    v: CFG.VERSION,
    meta: { farmName, hostId, roomCode, created: Date.now(), playTime: 0, tut: 0, fresh: true, seed: (Math.random() * 1e9) | 0 },
    world: { t: 0, day: 1, season: 0, weather: 'clear', weatherUntil: 150, sleepCycle: 0 },
    farm: { level: 1, xp: 0, houseLevel: 1, plotRows: PLOT.rows0, areas: { forest: false, beach: false, mountain: false } },
    players: {},
    crops: {},
    animals: {},
    buildings: { coop: { owned: true } },
    furniture: {},
    house: { floor: 'wood', wall: 'cream', light: 'warm' },
    inventory: { players: {}, chest: {}, stash: {} },
    economy: { fund: 0, hot: 'carrot', hotDay: 0 },
    quests: { day: 0, list: [] },
    daily: {
      streak: 1,
      claimedDay: 0,
      claimDate: '',
      calendarDate: '',
      spinTickets: 1,
      activity: 0,
      activityTicketClaimed: false,
      chests: [false, false, false],
      fortune: 0,
      lastPrize: '',
      lastWheelIdx: -1,
    },
    weekly: { week: '', progress: { harvest: 0, collect: 0, feed: 0 }, claimed: [], bonusClaimed: false },
    events: { active: [], next: 75, contest: null, party: null },
    restaurant: {
      unlocked: false, kitchen: 1, tables: 2, deco: 1, stars: 1, rep: 0,
      guests: {}, stations: {}, auto: true, nextGuest: 5,
      shift: { active: false, by: '', startedAt: 0, served: 0, earned: 0, combo: 0, lastServeAt: 0 },
      boards: {},
      pass: [],
      dirtyTables: {},
      cleanPlates: 6,
      maxPlates: 6,
      sink: null,
    },
    npcs: {}, thieves: {}, zombies: {}, pickups: {}, forage: {},
  };
}

export function createPlayer(id, profile = {}, slot = 0, farmLevel = 1) {
  const preset = PRESETS[(profile.preset ?? 0) % PRESETS.length];
  const hat = profile.hat && HATS[profile.hat] ? profile.hat : preset.hat;
  return {
    id, slot, name: (profile.name || 'Nông Dân').slice(0, 14), avatar: preset.avatar,
    char: { preset: preset.id, hat },
    money: CFG.START_COINS, xp: 0, level: 1, food: 100, hp: 100,
    sel: 'carrot', weapon: 'slipper', weapons: Object.keys(WEAPONS).filter((k) => WEAPONS[k].lvl <= farmLevel && !WEAPONS[k].consumes || k === 'slipper'),
    hats: [...new Set(['straw', hat])],
    stats: { harvest: 0, water: 0, plant: 0, feed: 0, pet: 0, collect: 0, fish: 0, sell: 0, cook: 0, chase: 0, serve: 0 },
    dex: {}, connected: true, joined: Date.now(),
  };
}

// Điền các nhánh còn thiếu khi load save cũ (forward-compat)
export function migrate(st) {
  const d = createGameState();
  for (const k of Object.keys(d)) if (st[k] === undefined) st[k] = d[k];
  for (const k of ['meta', 'world', 'farm', 'economy', 'daily', 'events', 'restaurant', 'inventory', 'house'])
    for (const kk of Object.keys(d[k])) if (st[k][kk] === undefined) st[k][kk] = d[k][kk];
  if (!Array.isArray(st.daily.chests)) st.daily.chests = [false, false, false];
  if (!Array.isArray(st.weekly?.claimed)) st.weekly = { week: '', progress: { harvest: 0, collect: 0, feed: 0 }, claimed: [], bonusClaimed: false };
  if (!st.restaurant.shift) st.restaurant.shift = { active: false, by: '', startedAt: 0, served: 0, earned: 0, combo: 0, lastServeAt: 0 };
  if (!st.restaurant.boards) st.restaurant.boards = {};
  if (!Array.isArray(st.restaurant.pass)) st.restaurant.pass = [];
  if (!st.restaurant.dirtyTables) st.restaurant.dirtyTables = {};
  if (st.restaurant.cleanPlates === undefined) st.restaurant.cleanPlates = 6;
  if (st.restaurant.maxPlates === undefined) st.restaurant.maxPlates = 6;
  // Nâng cấp bản lưu cũ chưa có đủ nội thất trong nhà
  if (Object.keys(st.furniture || {}).length <= 1) {
    st.furniture = { ...JSON.parse(JSON.stringify(STARTER_FURNITURE)), ...(st.furniture || {}) };
    if (st.furniture.f_bed0 && st.furniture.f_bed0.x === 2.5 && st.furniture.f_bed0.z === -1) {
      st.furniture.f_bed0.x = 4.5; st.furniture.f_bed0.z = -3.0;
    }
  }
  // Tự động căn chỉnh lại Sofa, TV, Chậu cây, Tranh cho các bản lưu trước đây bị lệch
  if (st.furniture?.f_sofa0 && st.furniture?.f_tv0) {
    const sf = st.furniture.f_sofa0, tv = st.furniture.f_tv0;
    if (sf.rot === 2 || sf.x === 4.0 || sf.x === 3.5 || tv.x !== sf.x) {
      Object.assign(sf, STARTER_FURNITURE.f_sofa0);
      Object.assign(tv, STARTER_FURNITURE.f_tv0);
      if (st.furniture.f_plant0 && st.furniture.f_plant0.z === -1.8) Object.assign(st.furniture.f_plant0, STARTER_FURNITURE.f_plant0);
      if (st.furniture.f_plant1) Object.assign(st.furniture.f_plant1, STARTER_FURNITURE.f_plant1);
      if (st.furniture.f_painting0 && st.furniture.f_painting0.x === 0.3) Object.assign(st.furniture.f_painting0, STARTER_FURNITURE.f_painting0);
      if (st.furniture.f_clock0) Object.assign(st.furniture.f_clock0, STARTER_FURNITURE.f_clock0);
      if (st.furniture.f_bookshelf0) Object.assign(st.furniture.f_bookshelf0, STARTER_FURNITURE.f_bookshelf0);
    }
  }
  // Nếu save cũ đang ở mặc định 4 hàng nhưng chưa trồng quá hàng 2 và ở cấp 1, đồng bộ về 2 hàng (6 ô khởi đầu)
  if (!st.farm.plotRows || st.farm.plotRows < PLOT.rows0 || (st.farm.plotRows === 4 && st.farm.level === 1 && !Object.values(st.crops || {}).some((c) => c.r >= PLOT.rows0))) {
    st.farm.plotRows = PLOT.rows0;
  }
  for (const p of Object.values(st.players)) {
    if (!Number.isFinite(p.food)) p.food = 100;
    if (!Number.isFinite(p.hp)) p.hp = 100;
    p.food = Math.max(0, Math.min(100, p.food)); p.hp = Math.max(1, Math.min(100, p.hp));
    p.connected = false; delete p.fishing; delete p.carry;
  }
  st.v = CFG.VERSION;
  return st;
}
