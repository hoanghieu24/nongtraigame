export const SEASONS = ['Xuân', 'Hạ', 'Thu', 'Đông'];
export const SEASON_ICONS = ['🌸', '☀️', '🍂', '❄️'];
// shape: dùng để dựng model 3D procedural (art/CropModels.js). c = [màu quả, màu lá]
// grow: thời gian chín chuẩn (giây) khi được tưới nước đầy đủ (từ 1 phút đến 4 phút 30 giây tuỳ loại cây)
export const CROPS = {
  carrot:     { name: 'Cà Rốt',        icon: '🥕', seed: 8,  sell: 16,  grow: 60,  lvl: 1, xp: 4,  shape: 'root',     c: [0xff8a3d, 0x5fbf4a], seasons: [0, 2] },
  wheat:      { name: 'Lúa Mì',        icon: '🌾', seed: 10, sell: 22,  grow: 75,  lvl: 1, xp: 4,  shape: 'grain',    c: [0xf0cf62, 0x9bcf5a], seasons: [0, 1, 2] },
  potato:     { name: 'Khoai Tây',     icon: '🥔', seed: 12, sell: 26,  grow: 90,  lvl: 1, xp: 5,  shape: 'root',     c: [0xc9a06a, 0x5aa844], seasons: [0, 2] },
  tomato:     { name: 'Cà Chua',       icon: '🍅', seed: 22, sell: 50,  grow: 120, lvl: 2, xp: 8,  shape: 'bush',     c: [0xf24b3b, 0x4fae48], seasons: [1], regrow: true },
  corn:       { name: 'Bắp Ngô',       icon: '🌽', seed: 20, sell: 46,  grow: 135, lvl: 2, xp: 8,  shape: 'corn',     c: [0xffd23f, 0x4fae48], seasons: [1] },
  chili:      { name: 'Ớt Cay',        icon: '🌶️', seed: 24, sell: 60,  grow: 150, lvl: 3, xp: 10, shape: 'chili',    c: [0xe03131, 0x3f9e46], seasons: [1], regrow: true },
  mushroom:   { name: 'Nấm',           icon: '🍄', seed: 35, sell: 90,  grow: 165, lvl: 3, xp: 12, shape: 'mushroom', c: [0xe8593f, 0xf4ead2], seasons: [2], shade: true },
  strawberry: { name: 'Dâu Tây',       icon: '🍓', seed: 30, sell: 72,  grow: 180, lvl: 3, xp: 11, shape: 'berry',    c: [0xff4d6d, 0x55b04a], seasons: [0], regrow: true },
  rice:       { name: 'Lúa Gạo',       icon: '🍚', seed: 28, sell: 64,  grow: 195, lvl: 4, xp: 12, shape: 'grain',    c: [0xf4e6a0, 0x7fc14f], seasons: [2] },
  pumpkin:    { name: 'Bí Ngô',        icon: '🎃', seed: 45, sell: 120, grow: 210, lvl: 4, xp: 16, shape: 'gourd',    c: [0xff9a2e, 0x4f9d3f], seasons: [2] },
  blueberry:  { name: 'Việt Quất',     icon: '🫐', seed: 50, sell: 130, grow: 240, lvl: 5, xp: 18, shape: 'berry',    c: [0x5b6cf2, 0x3f9e5a], seasons: [1], regrow: true },
  watermelon: { name: 'Dưa Hấu',       icon: '🍉', seed: 60, sell: 190, grow: 270, lvl: 5, xp: 22, shape: 'gourd',    c: [0x3fae5a, 0x2f7d3a], only: [1], stripes: true },        // theo mùa: chỉ trồng mùa Hạ
  moonberry:  { name: 'Dâu Trăng',     icon: '🌙', seed: 0,  sell: 420, grow: 210, lvl: 1, xp: 40, shape: 'berry',    c: [0xa78bfa, 0xb8d4ff], rare: true, glow: true, regrow: true }, // HIẾM
  starfruit:  { name: 'Khế Sao Băng',  icon: '⭐', seed: 0,  sell: 520, grow: 180, lvl: 1, xp: 50, shape: 'star',     c: [0xffe066, 0x6fd18a], event: true, glow: true },           // từ event Thiên Thạch
};
export const CROP_LIST = Object.keys(CROPS);
export const canPlantIn = (id, season) => { const d = CROPS[id]; return !d.only || d.only.includes(season); };

// Định dạng thời gian chín chuẩn của hạt giống (ví dụ: 60 -> "1 phút", 90 -> "1p 30s")
export function fmtGrow(sec) {
  const s = Math.max(1, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  if (m === 0) return `${r}s`;
  return r === 0 ? `${m} phút` : `${m}p ${r}s`;
}

// Định dạng đồng hồ đếm ngược thời gian còn lại tới khi chín (ví dụ: "1p 24s" hoặc "38s")
export function fmtEta(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60), r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}p ${String(r).padStart(2, '0')}s`;
}

// Tốc độ lớn thực tế của cây (phần trăm / giây) dựa trên nước tưới, mùa và thời tiết
export function cropRate(c, st, ti) {
  const def = CROPS[c?.crop];
  if (!def) return 0;
  const t = st.world.t, wx = st.world.weather;
  const rain = wx === 'rain' || wx === 'storm', snow = wx === 'snow';
  const wet = (c.w > t) || rain;
  let rate = (1 / def.grow) * (wet ? 1 : 0.3);
  if (def.seasons && ti) rate *= def.seasons.includes(ti.season) ? 1.2 : 0.75;
  if (def.shade && ti) rate *= ti.night || rain ? 1.6 : 0.6;
  if (snow) rate *= 0.6;
  if (c.fast) rate *= 6;
  return rate;
}

// Số giây thực tế còn lại cho tới khi cây chín 100%
export function cropEtaSec(c, st, ti) {
  if (!c || !c.crop || c.s === 'ripe' || (c.g ?? 0) >= 1) return 0;
  const rate = cropRate(c, st, ti);
  if (rate <= 0) return 0;
  return Math.max(1, Math.ceil((1 - (c.g || 0)) / rate));
}
