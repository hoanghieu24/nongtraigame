// Bố cục thế giới dùng chung cho sim (host) và view (client). Thuần dữ liệu + hàm toán.
import { noise2, smooth, lerp, clamp, mulberry32 } from '../core/util.js';

export const WORLD = { R: 62 };
// Hình đảo hơi dẹt & lệch đông (để Làng nằm trọn trên đất liền)
export const islandR = (x, z) => Math.hypot((x - 4) / 1.12, z);
// Khu Ruộng riêng biệt nằm bên trái lối đi chính: khởi đầu 9 ô (3 hàng × 3 cột = 3×3), càng nâng cấp càng mở rộng to ra (tối đa 8 hàng = 24 ô)
export const PLOT = { cols: 3, sp: 2.25, x0: -7.5, z0: 1.2, rows0: 3, maxRows: 8 };
export const plotId = (r, c) => `p${r}_${c}`;
export const parsePlot = (id) => { const m = /^p(\d+)_(\d+)$/.exec(id); return m ? { r: +m[1], c: +m[2] } : null; };
export const plotPos = (r, c) => ({ x: PLOT.x0 + c * PLOT.sp, z: PLOT.z0 + r * PLOT.sp });

export const HOUSE = { x: 0, z: -17, door: { x: 0, z: -12.0 }, w: 11, d: 8 };
// Nội thất trong nhà nằm ở "phòng" riêng, rộng rãi và sang trọng hơn nhiều theo từng cấp nhà
export const INTERIOR = {
  ox: 0, oz: 400,
  rooms: [{ w: 12, d: 10 }, { w: 15, d: 12 }, { w: 18, d: 14 }, { w: 22, d: 16 }],
};
export const interiorRoom = (lvl) => INTERIOR.rooms[clamp(lvl, 1, 4) - 1];

export const SPOTS = {
  chest: { x: -4.6, z: -10.4 },      // Rương chung của gia đình
  crate: { x: 4.4, z: -11.2 },       // Quầy cửa hàng / Thùng bán hàng trước sân nhà
  homeNotice: { x: -3.6, z: -12.2 }, // Bảng nhiệm vụ ngay trước hiên nhà (như ảnh mẫu)
  houseUp: { x: 2.4, z: -12.2 },     // Biển nâng cấp & trang trí nhà trước hiên
  spawn: { x: 0, z: -8.6 },
  gateFarm: { x: 10, z: 6 },
  notice: { x: 51, z: 6.5 },         // Bảng nhiệm vụ ở làng
  market: { x: 46.6, z: 3.2 },       // Quầy chợ ở làng (giá bán +10%)
  well: { x: -11.8, z: 2.2 },        // Giếng nước nằm cạnh lối vào phía Tây Khu Ruộng
  merchant: { x: 9, z: 9 },
  dock: { x: 0, z: 23.2 },           // đầu cầu tàu
  homeKitchen: { x: -3.6, z: -4.1 }, // toạ độ local trong nhà (tương đối tâm phòng)
};

const rect = (x0, x1, z0, z1, extra = {}) => ({ x0, x1, z0, z1, ...extra });
// Mở khoá các chuồng sớm (Cấp 1-2) để người chơi dễ dàng mua trực tiếp ngay khi lại gần chuồng!
export const PENS = {
  coop:  rect(12, 22, -25, -17, { gate: { x: 12, z: -21 }, hut: { x: 17, z: -23.6 }, inc: { x: 14.2, z: -23.5 }, kinds: ['chicken'], cap: 8, cost: 0,    lvl: 1, name: 'Chuồng Gà',    icon: '🐔' }),
  barn:  rect(24, 34, -25, -17, { gate: { x: 24, z: -21 }, hut: { x: 29, z: -23.4 }, kinds: ['cow'],     cap: 4, cost: 900,  lvl: 1, name: 'Chuồng Bò',    icon: '🐄' }),
  pig:   rect(12, 22, -15, -7,  { gate: { x: 12, z: -11 }, hut: { x: 17, z: -13.4 }, kinds: ['pig'],     cap: 4, cost: 1200, lvl: 2, name: 'Chuồng Heo',   icon: '🐖', mud: { x: 18.2, z: -9.6, r: 2 } }),
  sheep: rect(24, 34, -15, -7,  { gate: { x: 24, z: -11 }, hut: { x: 29, z: -13.4 }, kinds: ['sheep'],   cap: 5, cost: 1000, lvl: 2, name: 'Đồng Cừu',     icon: '🐑' }),
  duck:  rect(12, 22, -5, 3,    { gate: { x: 12, z: -1 },  hut: { x: 14, z: -3.4 },  inc: { x: 13.8, z: -1.4 }, kinds: ['duck'], cap: 6, cost: 800, lvl: 1, name: 'Ao Vịt', icon: '🦆', pond: { x: 17.8, z: -0.2, r: 3.1 } }),
  goat:  rect(24, 34, -5, 3,    { gate: { x: 24, z: -1 },  hut: { x: 29, z: -3.4 },  kinds: ['goat'],    cap: 4, cost: 1500, lvl: 2, name: 'Đồi Dê',       icon: '🐐' }),
  hutch: rect(-17, -8, -15, -7, { gate: { x: -8, z: -11 }, hut: { x: -14, z: -13.4 }, kinds: ['rabbit'],  cap: 5, cost: 600,  lvl: 1, name: 'Chuồng Thỏ',   icon: '🐇' }),
};
export const penOfKind = (kind) => Object.keys(PENS).find((k) => PENS[k].kinds.includes(kind));

export const VILLAGE = {
  arch: { x: 37.2, z: 6.0 },
  plaza: { x: 52, z: 2, r: 9.5 },
  shops: {
    seed:      { x: 42, z: -5, rot: 0,       name: 'Cửa Hàng Hạt Giống', icon: '🌱', color: 0x8ecf6d },
    animal:    { x: 62, z: -5, rot: 0,       name: 'Cửa Hàng Thú Cưng',  icon: '🐣', color: 0xffb37a },
    furniture: { x: 42, z: 9,  rot: Math.PI, name: 'Cửa Hàng Nội Thất',  icon: '🛋️', color: 0x9ec9f2 },
    general:   { x: 62, z: 9,  rot: Math.PI, name: 'Tạp Hóa Cô Mai',      icon: '🧺', color: 0xf3a6c4 },
  },
  cafeCart: { x: 57.4, z: 3.2 },
  flowerPergola: { x: 52, z: 13.5 },
  restaurant: { x: 52, z: -19.0, w: 19, d: 11 },
};

// Vùng khoá theo level nông trại
export const AREAS = {
  forest:   { lvl: 2, name: 'Khu Rừng',    icon: '🌲', test: (x, z) => x < -27 && z > -34, gate: { x: -26, z: 3 } },
  beach:    { lvl: 3, name: 'Bãi Biển',    icon: '🏖️', test: (x, z) => z > 37,           gate: { x: 30, z: 36 } },
  mountain: { lvl: 5, name: 'Núi Cao',     icon: '⛰️', test: (x, z) => z < -33 && x > -40, gate: { x: 0, z: -32 } },
};
export const areaAt = (x, z) => { for (const k in AREAS) if (AREAS[k].test(x, z)) return k; return null; };

// Sông chảy ngang phía nam nông trại
export const riverZ = (x) => 30 + 2.6 * Math.sin(x * 0.07 + 1.1) + 1.2 * Math.sin(x * 0.19);
export const DOCK = { x0: -2.2, x1: 2.2, z0: 22.6, z1: 32.4, y: 0.38 };
export const BRIDGE = { x0: 28.6, x1: 31.4, z0: 24, z1: 38, y: 0.42 };
export const FISH_SPOTS = [
  { id: 'dock', x: 0, z: 31.4, r: 3.6, water: 'river' },
  { id: 'bridge', x: 30, z: 31, r: 3.2, water: 'river' },
  { id: 'pond', x: 17.8, z: 3.4, r: 2.6, water: 'pond' },
  { id: 'beach', x: 6, z: 52, r: 8, water: 'sea' },
];

const farmRect = { x0: -26, x1: 38, z0: -30, z1: 14 };
const villRect = { x0: 36, x1: 66, z0: -28, z1: 20 };
const flatMask = (x, z, r, f = 6) => {
  const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
  return 1 - smooth(0, f, Math.hypot(dx, dz));
};

// Độ cao địa hình (dùng cho render + vị trí người/thú)
export function terrainH(x, z) {
  let h = 0.5 + noise2(x * 0.045 + 3, z * 0.045) * 0.5 + noise2(x * 0.12, z * 0.12 + 7) * 0.14;   // luôn > mặt nước, trừ chỗ cố ý đào
  const flat = Math.max(flatMask(x, z, farmRect, 7), flatMask(x, z, villRect, 7));
  h *= 1 - flat;
  // núi phía bắc
  const m = smooth(-31, -52, z) * (1 - smooth(46, 62, Math.abs(x)));
  h += m * (9 + 4 * noise2(x * 0.06, z * 0.06 + 40) + 4 * Math.max(0, noise2(x * 0.12 + 5, z * 0.12)));
  // rừng hơi gồ
  h += smooth(-26, -34, x) * 0.6 * noise2(x * 0.15, z * 0.15);
  // đảo: mép chìm dần xuống biển
  const r = islandR(x, z);
  h -= smooth(55, 70, r) * 4.6;
  // bãi biển dốc dần ra biển
  h -= smooth(40, 60, z) * 1.6;
  // sông
  const d = Math.abs(z - riverZ(x));
  h = lerp(h, -1.5, 1 - smooth(3.4, 7.2, d));
  // ao vịt
  const P = PENS.duck.pond, pd = Math.hypot(x - P.x, z - P.z);
  h = lerp(h, -0.95, 1 - smooth(P.r - 0.6, P.r + 1.6, pd));
  return h;
}
export function groundY(x, z) {
  if (x > DOCK.x0 && x < DOCK.x1 && z > DOCK.z0 && z < DOCK.z1) return DOCK.y;
  if (x > BRIDGE.x0 && x < BRIDGE.x1 && z > BRIDGE.z0 && z < BRIDGE.z1) return BRIDGE.y;
  return terrainH(x, z);
}
export const WATER_Y = -0.28;
export const walkable = (x, z) => groundY(x, z) > -0.42 && islandR(x, z) < 66;

// Ô đặt đồ ngoài trời hợp lệ? (không đè Khu Ruộng, chuồng, đường đi, nhà, làng, nước)
export function buildableOutdoor(x, z, plotRows = PLOT.rows0) {
  if (!walkable(x, z) || groundY(x, z) < -0.06) return false;
  if (x > PLOT.x0 - 2.2 && x < PLOT.x0 + PLOT.cols * PLOT.sp + 0.6 && z > PLOT.z0 - 2.2 && z < PLOT.z0 + plotRows * PLOT.sp + 1.2) return false;
  if (Math.abs(x - HOUSE.x) < HOUSE.w / 2 + 1.5 && z > HOUSE.z - 5.5 && z < HOUSE.z + 6) return false;
  for (const k in PENS) { const p = PENS[k]; if (x > p.x0 - 1.4 && x < p.x1 + 1.4 && z > p.z0 - 1.6 && z < p.z1 + 1.4) return false; }
  if (x > villRect.x0 && x < villRect.x1 && z > villRect.z0 && z < villRect.z1) return false;
  if (Math.abs(x - SPOTS.chest.x) < 1.4 && Math.abs(z - SPOTS.chest.z) < 1.4) return false;
  if (Math.abs(x - SPOTS.crate.x) < 1.4 && Math.abs(z - SPOTS.crate.z) < 1.4) return false;
  if (x < -26 || z < -30 || z > 21 || x > 36) return false;      // chỉ khu nông trại
  // đường chính (x=0 từ nhà xuống ruộng, z=6 sang làng)
  if (Math.abs(x) < 1.2 && z > -12 && z < 24) return false;
  if (Math.abs(z - 6) < 1.3 && x > 0 && x < 40) return false;
  return true;
}
export const inHouseRoom = (x, z, lvl, w = 1, d = 1) => {
  const r = interiorRoom(lvl);
  return Math.abs(x) <= r.w / 2 - w / 2 + 1e-6 && z >= -r.d / 2 + d / 2 - 1e-6 && z <= r.d / 2 - d / 2 - 1.2 + 1e-6;
};

// Quán Ăn Làng (cơ chế Ready, Set, Cook! trên Facebook):
// - Nửa trái (x: 42.5..51.5): KHU BẾP (6 thùng nguyên liệu, 2 thớt sơ chế, 3 bếp nấu chảo/nồi, bồn rửa bát, thùng rác, quầy trả món màu đỏ cam)
// - Nửa phải (x: 51.8..61.5): PHÒNG ĂN (Bàn tiệc Oval lớn ở trung tâm với 8 ghế ngồi quanh bàn để khách gọi món, ăn & để lại tiền tip + đĩa bẩn)
const OVAL_SEATS = [
  { x: 54.4, z: -20.6, seatX: 54.0, seatZ: -20.6, plateX: 55.4, plateZ: -20.4, face: Math.PI / 2 },
  { x: 54.4, z: -17.4, seatX: 54.0, seatZ: -17.4, plateX: 55.4, plateZ: -17.6, face: Math.PI / 2 },
  { x: 59.2, z: -20.6, seatX: 59.6, seatZ: -20.6, plateX: 58.2, plateZ: -20.4, face: -Math.PI / 2 },
  { x: 59.2, z: -17.4, seatX: 59.6, seatZ: -17.4, plateX: 58.2, plateZ: -17.6, face: -Math.PI / 2 },
  { x: 56.8, z: -22.2, seatX: 56.8, seatZ: -22.6, plateX: 56.8, plateZ: -21.4, face: 0 },
  { x: 56.8, z: -15.8, seatX: 56.8, seatZ: -15.4, plateX: 56.8, plateZ: -16.6, face: Math.PI },
  { x: 54.2, z: -19.0, seatX: 53.8, seatZ: -19.0, plateX: 55.2, plateZ: -19.0, face: Math.PI / 2 },
  { x: 59.4, z: -19.0, seatX: 59.8, seatZ: -19.0, plateX: 58.4, plateZ: -19.0, face: -Math.PI / 2 },
];

export const REST = {
  x: 52, z: -19.0, x0: 42.5, x1: 61.5, z0: -24.5, z1: -13.5,
  entrance: { x: 56.8, z: -13.0 },
  jobBoard: { x: 51.5, z: -12.8 },
  counter: { x: 49.6, z: -19.0 },
  chef: { x: 49.2, z: -22.2 },
  door: { x: 56.8, z: -13.8 },
  ovalTable: { x: 56.8, z: -19.0, rx: 1.85, rz: 3.1 },
  passCounter: {
    x: 51.4, z: -19.0,
    slots: [
      { x: 51.4, z: -21.1 },
      { x: 51.4, z: -19.7 },
      { x: 51.4, z: -18.3 },
      { x: 51.4, z: -16.9 },
    ],
  },
  crates: {
    veg:     { id: 'veg',     x: 45.2, z: -23.6, icon: '🥦', name: 'Thùng Rau Cải' },
    meat:    { id: 'meat',    x: 47.6, z: -23.6, icon: '🍗', name: 'Thùng Thịt & Trứng' },
    seafood: { id: 'seafood', x: 50.0, z: -23.6, icon: '🦐', name: 'Thùng Tôm Cá' },
    tomato:  { id: 'tomato',  x: 45.2, z: -14.4, icon: '🍅', name: 'Thùng Cà Chua' },
    dough:   { id: 'dough',   x: 47.6, z: -14.4, icon: '🧀', name: 'Thùng Bột & Phô Mai' },
    potato:  { id: 'potato',  x: 50.0, z: -14.4, icon: '🥔', name: 'Thùng Khoai & Nấm' },
  },
  boards: {
    b0: { id: 'b0', x: 43.6, z: -21.8, icon: '🔪', name: 'Thớt Sơ Chế 1' },
    b1: { id: 'b1', x: 47.6, z: -19.0, icon: '🔪', name: 'Bàn Đảo Sơ Chế 2' },
  },
  stoves: {
    s0: { id: 's0', x: 43.6, z: -19.8, icon: '🍳', name: 'Bếp Chảo 1' },
    s1: { id: 's1', x: 43.6, z: -17.9, icon: '🍲', name: 'Bếp Nồi 2' },
    s2: { id: 's2', x: 43.6, z: -16.0, icon: '🔥', name: 'Bếp Chảo 3' },
  },
  sink:   { x: 50.2, z: -21.8, icon: '🚰', name: 'Bồn Rửa Bát' },
  plates: { x: 51.4, z: -22.3, icon: '🍽️', name: 'Chồng Đĩa Sạch' },
  trash:  { x: 43.6, z: -14.3, icon: '🗑️', name: 'Thùng Rác Bếp' },
  table: (i) => OVAL_SEATS[i % OVAL_SEATS.length],
};
export const inRest = (x, z, pad = 1.2) => x >= REST.x0 - pad && x <= REST.x1 + pad && z >= REST.z0 - pad && z <= REST.z1 + pad;

// Bếp trong nhà (toạ độ local của phòng)
export const HOME_KITCHEN = { x: -3.6, z: -4.1 };

// Điểm hái lượm cố định (sinh xác định để sim & view dùng chung, cây cối tránh các điểm này)
function genForage() {
  const r = mulberry32(777), out = [];
  const R = (a, b) => a + (b - a) * r();
  const spec = [['mushroom', 5, [-58, -31], [-24, 24], 'forest'], ['berry', 6, [-58, -31], [-24, 24], 'forest'], ['herb', 5, [-58, -31], [-24, 24], 'forest'],
    ['flower', 7, [-25, -13], [-24, 12], null], ['shell', 9, [-30, 30], [41, 56], 'beach'], ['crystal', 6, [-28, 28], [-52, -37], 'mountain']];
  for (const [kind, n, xr, zr, area] of spec) {
    let made = 0, tries = 0;
    while (made < n && tries++ < 400) {
      const x = R(xr[0], xr[1]), z = R(zr[0], zr[1]);
      if (!walkable(x, z) || terrainH(x, z) < 0.12 || terrainH(x, z) > 6) continue;
      if (area && areaAt(x, z) !== area) continue;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 3)) continue;
      out.push({ id: `f${out.length}`, kind, x: +x.toFixed(2), z: +z.toFixed(2) }); made++;
    }
  }
  return out;
}
export const FORAGE_POINTS = genForage();
export const FORAGE_ITEM = { mushroom: 'mushroom', berry: 'berry', herb: 'herb', flower: 'flower', shell: 'shell', crystal: 'crystal' };
