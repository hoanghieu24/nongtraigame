// rarity: common|uncommon|rare|epic|legend. diff: độ khó mini-game (0..1). w: trọng số xuất hiện
export const FISH = {
  boot:      { name: 'Chiếc Ủng Rách',       icon: '👢', rarity: 'junk',     value: 4,   w: 8,  diff: 0.05, spots: ['river', 'pond', 'sea'], desc: 'Ủng tổ ong của tên trộm rớt xuống sông!' },
  carp:      { name: 'Cá Chép Ngáp Ngủ',     icon: '🐟', rarity: 'common',   value: 24,  w: 40, diff: 0.15, spots: ['river', 'pond'],  desc: 'Vừa bơi vừa ngáp, siêu dễ dính câu.' },
  catfish:   { name: 'Cá Trê Râu Ria',       icon: '🐠', rarity: 'uncommon', value: 42,  w: 26, diff: 0.3,  spots: ['river', 'pond'],  time: 'night', desc: 'Thích đi đêm, râu dài như ông cụ.' },
  salmon:    { name: 'Cá Hồi Bơi Ngược',     icon: '🍣', rarity: 'uncommon', value: 70,  w: 18, diff: 0.4,  spots: ['river', 'sea'],   desc: 'Bơi ngược dòng cực gắt.' },
  funny:     { name: 'Cá Bựa Đội Nón',       icon: '🐡', rarity: 'rare',     value: 95,  w: 9,  diff: 0.55, spots: ['river', 'pond', 'sea'], desc: 'Phùng má trợn mắt, đội nguyên cái nón lá!' },
  golden:    { name: 'Cá Vàng Lấp Lánh',     icon: '⭐', rarity: 'epic',     value: 190, w: 4,  diff: 0.7,  spots: ['river', 'pond'],  desc: 'Vảy vàng thật. Đừng hỏi vì sao.' },
  legend:    { name: 'Cá Rồng Huyền Thoại',  icon: '🐉', rarity: 'legend',   value: 650, w: 1.1, diff: 0.92, spots: ['sea'],           desc: 'Truyền thuyết kể rằng ai bắt được sẽ được ăn thêm bánh.' },
};
export const FISH_LIST = Object.keys(FISH);
export const RARITY_COLOR = { junk: '#9aa0a6', common: '#7ecb6f', uncommon: '#5bb8e8', rare: '#b07cf0', epic: '#ffb547', legend: '#ff6b8b' };
export const RARITY_NAME = { junk: 'Đồ cũ', common: 'Phổ biến', uncommon: 'Khá hiếm', rare: 'Hiếm', epic: 'Cực hiếm', legend: 'Huyền thoại' };
