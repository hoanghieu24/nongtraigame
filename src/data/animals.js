export const ASTATE = ['idle', 'walk', 'run', 'eat', 'sleep', 'happy', 'scared', 'funny'];
export const ASUB = ['', 'bump', 'roll', 'charge', 'swim', 'party', 'house', 'stare', 'hop'];
export const ANIMALS = {
  chicken: { name: 'Gà',   icon: '🐔', pen: 'coop',  cost: 90,   prod: { item: 'egg',     every: 45 }, walk: 1.1, run: 4.4, r: 0.45, sound: 'chicken', names: ['Gà Bựa', 'Cục Tác', 'Gà Mờ', 'Mỡ Vàng', 'Gà Ngố', 'Tí Nị'] },
  duck:    { name: 'Vịt',  icon: '🦆', pen: 'duck',  cost: 120,  prod: { item: 'feather', every: 55 }, walk: 1.0, run: 3.0, r: 0.5,  sound: 'duck',    names: ['Vịt Lạc', 'Cạp Cạp', 'Vịt Bầu', 'Donald Mini'] },
  rabbit:  { name: 'Thỏ',  icon: '🐇', pen: 'hutch', cost: 150,  prod: { item: 'clover',  every: 70 }, walk: 1.2, run: 4.0, r: 0.45, sound: 'rabbit',  names: ['Thỏ Bông', 'Nhảy Nhót', 'Củ Cải', 'Thỏ Ngơ'] },
  sheep:   { name: 'Cừu',  icon: '🐑', pen: 'sheep', cost: 400,  prod: { item: 'wool',    every: 90 }, walk: 0.9, run: 3.4, r: 0.7,  sound: 'sheep',   names: ['Cừu Mây', 'Bông Gòn', 'Kẹo Bông', 'Cừu Lười'] },
  pig:     { name: 'Heo',  icon: '🐖', pen: 'pig',   cost: 500,  prod: { item: 'truffle', every: 100 }, walk: 0.95, run: 3.2, r: 0.75, sound: 'pig',     names: ['Heo Nhún Nhảy', 'Ủn Ỉn', 'Heo Mập', 'Bơ Sữa'] },
  goat:    { name: 'Dê',   icon: '🐐', pen: 'goat',  cost: 600,  prod: { item: 'cheese',  every: 85 }, walk: 1.2, run: 5.0, r: 0.65, sound: 'goat',    names: ['Dê Húc', 'Râu Xồm', 'Dê Cụ', 'Đại Ca Dê'] },
  cow:     { name: 'Bò',   icon: '🐄', pen: 'barn',  cost: 900,  prod: { item: 'milk',    every: 80 }, walk: 0.8, run: 2.8, r: 0.95, sound: 'cow',     names: ['Bò Sữa Quý Tộc', 'Đốm Đen', 'Bò Ngơ', 'Mộc Mạc'] },
  dog:     { name: 'Cún',  icon: '🐕', pen: null,    cost: 0,    prod: null, walk: 1.6, run: 6.5, r: 0.55, sound: 'dog', names: ['Cún Giữ Vườn'] },
};
export const BUYABLE_ANIMALS = ['chicken', 'duck', 'rabbit', 'sheep', 'pig', 'goat', 'cow'];

// Bán vật nuôi trưởng thành được khoảng 55% giá mua; thú con rẻ hơn,
// còn thú Vàng và vật nuôi được chăm tốt có giá cao hơn.
export const animalSalePrice = (animal) => {
  const def = animal && ANIMALS[animal.type];
  if (!def || animal.type === 'dog' || def.cost <= 0) return 0;
  const growth = Math.max(0, Math.min(1, animal.growth ?? 1));
  const maturity = 0.65 + growth * 0.35;
  const care = animal.happy >= 0.85 ? 1.1 : 1;
  const golden = animal.golden ? 3 : 1;
  const ready = animal.ready ? 1.12 : 1;
  return Math.max(1, Math.round(def.cost * 0.55 * maturity * care * golden * ready));
};

// Đói: đầy → đói lả mất ~7 phút; đói lả rồi còn `grace` giây để cho ăn, quá hạn thì vật nuôi chết đói.
export const STARVE = { hungry: 0.7, critical: 0.97, grace: 150, warn: 60, rate: 420 };
