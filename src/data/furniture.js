// w,d = kích thước ô (1 ô = 1 đơn vị). areas: nơi đặt được. wall = treo tường. flat = thảm (không chặn)
export const FURN_CATS = [['furniture', 'Nội thất', '🛋️'], ['decor', 'Trang trí', '🖼️'], ['outdoor', 'Ngoài trời', '🌳']];
export const FURN = {
  bed:       { name: 'Giường Ngủ Êm',     icon: '🛏️', cat: 'furniture', price: 180, lvl: 1, w: 2, d: 3, areas: ['house'] },
  sofa:      { name: 'Sofa Bông',         icon: '🛋️', cat: 'furniture', price: 220, lvl: 1, w: 3, d: 1, areas: ['house'] },
  table:     { name: 'Bàn Ăn Gỗ',         icon: '🪵', cat: 'furniture', price: 120, lvl: 1, w: 2, d: 2, areas: ['house'] },
  chair:     { name: 'Ghế Mây',           icon: '🪑', cat: 'furniture', price: 45,  lvl: 1, w: 1, d: 1, areas: ['house'] },
  cabinet:   { name: 'Tủ Gỗ',             icon: '🗄️', cat: 'furniture', price: 150, lvl: 1, w: 2, d: 1, areas: ['house'] },
  tv:        { name: 'TV Màn Hình Phẳng', icon: '📺', cat: 'furniture', price: 320, lvl: 2, w: 2, d: 1, areas: ['house'] },
  lamp:      { name: 'Đèn Bàn Ấm',        icon: '💡', cat: 'furniture', price: 60,  lvl: 1, w: 1, d: 1, areas: ['house'], glow: true },
  bookshelf: { name: 'Kệ Sách',           icon: '📚', cat: 'furniture', price: 170, lvl: 1, w: 2, d: 1, areas: ['house'] },
  plant:     { name: 'Chậu Cây Xanh',     icon: '🪴', cat: 'decor',     price: 40,  lvl: 1, w: 1, d: 1, areas: ['house', 'farm'] },
  painting:  { name: 'Tranh Đồng Quê',    icon: '🖼️', cat: 'decor',     price: 70,  lvl: 1, w: 1, d: 1, areas: ['house'], wall: true },
  rug:       { name: 'Thảm Len Tròn',     icon: '🟠', cat: 'decor',     price: 90,  lvl: 1, w: 3, d: 2, areas: ['house'], flat: true },
  clock:     { name: 'Đồng Hồ Cúc Cu',    icon: '🕰️', cat: 'decor',     price: 110, lvl: 2, w: 1, d: 1, areas: ['house'], wall: true },
  aquarium:  { name: 'Bể Cá Cảnh',        icon: '🐠', cat: 'decor',     price: 3200, lvl: 3, w: 2, d: 1, areas: ['house'] },
  toys:      { name: 'Hộp Đồ Chơi',       icon: '🧸', cat: 'decor',     price: 55,  lvl: 1, w: 1, d: 1, areas: ['house'] },
  gnome:     { name: 'Chú Lùn Vườn',      icon: '🎅', cat: 'decor',     price: 75,  lvl: 1, w: 1, d: 1, areas: ['farm'] },
  fence:     { name: 'Hàng Rào Gỗ',       icon: '🚧', cat: 'outdoor',   price: 20,  lvl: 1, w: 2, d: 1, areas: ['farm'] },
  bench:     { name: 'Ghế Đá Công Viên',  icon: '🪑', cat: 'outdoor',   price: 90,  lvl: 1, w: 2, d: 1, areas: ['farm'] },
  flowerpot: { name: 'Bồn Hoa',           icon: '🌷', cat: 'outdoor',   price: 35,  lvl: 1, w: 1, d: 1, areas: ['farm'] },
  streetlamp:{ name: 'Đèn Đường Cổ',      icon: '🏮', cat: 'outdoor',   price: 130, lvl: 2, w: 1, d: 1, areas: ['farm'], glow: true },
  lantern:   { name: 'Đèn Lồng Treo',     icon: '🎃', cat: 'outdoor',   price: 65,  lvl: 1, w: 1, d: 1, areas: ['farm'], glow: true },
  tree:      { name: 'Cây Bóng Mát',      icon: '🌳', cat: 'outdoor',   price: 100, lvl: 2, w: 2, d: 2, areas: ['farm'] },
  scarecrow: { name: 'Bù Nhìn Ngố',       icon: '🧟', cat: 'outdoor',   price: 150, lvl: 2, w: 1, d: 1, areas: ['farm'] },
  swing:     { name: 'Xích Đu Gỗ',        icon: '🎠', cat: 'outdoor',   price: 1800, lvl: 3, w: 2, d: 2, areas: ['farm'] },
  fountain:  { name: 'Đài Phun Nước',     icon: '⛲', cat: 'outdoor',   price: 6500, lvl: 4, w: 3, d: 3, areas: ['farm'] },
  pond:      { name: 'Hồ Cá Koi Mini',    icon: '🪷', cat: 'outdoor',   price: 2600, lvl: 3, w: 3, d: 3, areas: ['farm'] },
  gold_gnome:{ name: 'Chú Lùn Vàng (hiếm)', icon: '👑', cat: 'decor',   price: 12000, lvl: 5, w: 1, d: 1, areas: ['farm', 'house'], rare: true },
};
export const FURN_LIST = Object.keys(FURN);

export const FLOORS = {
  wood:   { name: 'Gỗ sồi',      color: 0xd9ad72, price: 0 },
  plank:  { name: 'Gỗ tối',      color: 0x9a6b45, price: 60 },
  tile:   { name: 'Gạch kem',    color: 0xefe6d2, price: 80 },
  check:  { name: 'Ô caro',      color: 0xf0c9c9, price: 100 },
  carpet: { name: 'Thảm xanh',   color: 0x8fc7b8, price: 120 },
};
export const WALLS = {
  cream:  { name: 'Kem',         color: 0xfff1d6, price: 0 },
  mint:   { name: 'Bạc hà',      color: 0xcdeedd, price: 50 },
  pink:   { name: 'Hồng phấn',   color: 0xffd6de, price: 50 },
  sky:    { name: 'Xanh trời',   color: 0xcfe6fa, price: 50 },
  wood:   { name: 'Ván gỗ',      color: 0xc99a6a, price: 90 },
};
export const LIGHTS = {
  warm:   { name: 'Vàng ấm',     color: 0xffd9a0, int: 1.0, price: 0 },
  cool:   { name: 'Trắng mát',   color: 0xdfeaff, int: 1.0, price: 40 },
  pink:   { name: 'Hồng mơ',     color: 0xffc4dc, int: 1.05, price: 60 },
  night:  { name: 'Đèn ngủ',     color: 0xa8b7ff, int: 0.7, price: 60 },
};
export const HOUSE_LEVELS = [
  { name: 'Nhà Nhỏ',            cost: 0,     lvl: 1 },
  { name: 'Nhà Gia Đình',       cost: 2500,  lvl: 2 },
  { name: 'Nhà Nông Trại Lớn',  cost: 9000,  lvl: 4 },
  { name: 'Biệt Thự Nông Trại', cost: 24000, lvl: 6 },
];
export const RESTAURANT_UPGRADES = {
  kitchen: { name: 'Bếp Xịn',       icon: '🍳', max: 3, cost: [1500, 4000],  desc: 'Nấu nhanh hơn. Cấp 2 thuê Bếp trưởng tự nấu.' },
  tables:  { name: 'Thêm Bàn',      icon: '🪑', max: 4, cost: [900, 2200, 4500], desc: 'Nhiều khách cùng lúc hơn.' },
  deco:    { name: 'Trang Trí',     icon: '🌸', max: 3, cost: [1200, 3200],  desc: 'Khách tip nhiều hơn.' },
};
