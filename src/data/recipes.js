// Nguyên liệu: key là item id, hoặc 'fish' = bất kỳ loại cá. sweet/fish tag => hợp gu khách.
// rsc: danh sách nguyên liệu tại Quán Ăn Làm Thêm (cơ chế Ready, Set, Cook!: lấy từ thùng -> thái trên thớt -> bỏ vào bếp chảo/nồi -> bưng ra bàn)
export const RSC_CRATES = {
  veg:     { id: 'veg',     name: 'Rau Cải & Bông Cải', icon: '🥦', prepIcon: '🥗', color: 0x5bbd4f },
  meat:    { id: 'meat',    name: 'Thịt Đùi & Trứng',   icon: '🍗', prepIcon: '🥩', color: 0xe57373 },
  seafood: { id: 'seafood', name: 'Tôm & Hải Sản',      icon: '🦐', prepIcon: '🍤', color: 0xff8a65 },
  tomato:  { id: 'tomato',  name: 'Cà Chua & Ớt',       icon: '🍅', prepIcon: '🥫', color: 0xef5350 },
  dough:   { id: 'dough',   name: 'Bột Bánh & Phô Mai', icon: '🧀', prepIcon: '🥟', color: 0xffca28 },
  potato:  { id: 'potato',  name: 'Khoai Tây & Nấm',    icon: '🥔', prepIcon: '🍟', color: 0xd4a359 },
};
export const RSC_CRATE_LIST = Object.keys(RSC_CRATES);

export const RECIPES = {
  fries:         { name: 'Khoai Tây Chiên',        icon: '🍟', ing: { potato: 2 },                                time: 6,  price: 78,  lvl: 1, tags: ['fast'],          rsc: ['potato', 'potato'],          pot: 'pan' },
  broccoli_stir: { name: 'Bông Cải Xào Tỏi',       icon: '🥦', ing: { carrot: 1, potato: 1 },                     time: 6,  price: 96,  lvl: 1, tags: ['veg', 'fast'],   rsc: ['veg', 'veg'],                pot: 'pan' },
  steak_pan:     { name: 'Đùi Gà Áp Chảo Bơ',      icon: '🍗', ing: { egg: 1, potato: 1 },                        time: 7,  price: 135, lvl: 1, tags: ['fast'],          rsc: ['meat', 'potato'],            pot: 'pan' },
  shrimp_pot:    { name: 'Tôm Sốt Bơ Tỏi',         icon: '🍤', ing: { fish: 1, wheat: 1 },                        time: 7,  price: 148, lvl: 1, tags: ['fish', 'fast'],  rsc: ['seafood', 'dough'],          pot: 'pot' },
  tomato_pasta:  { name: 'Mì Ý Sốt Cà Phô Mai',    icon: '🍝', ing: { tomato: 1, wheat: 1 },                      time: 7,  price: 132, lvl: 1, tags: ['veg'],           rsc: ['tomato', 'dough'],           pot: 'pan' },
  pancake:       { name: 'Bánh Kếp Trứng Sữa',     icon: '🥞', ing: { egg: 1, milk: 1, wheat: 1 },                time: 8,  price: 150, lvl: 1, tags: ['sweet'],         rsc: ['dough', 'meat'],             pot: 'pan' },
  salad:         { name: 'Salad Rau Củ Tươi',      icon: '🥗', ing: { carrot: 2, tomato: 1 },                     time: 6,  price: 110, lvl: 2, tags: ['veg'],           rsc: ['veg', 'tomato'],             pot: 'pan' },
  soup:          { name: 'Súp Cà Chua Kem Nấm',    icon: '🍲', ing: { tomato: 1, corn: 1 },                       time: 8,  price: 128, lvl: 2, tags: ['veg'],           rsc: ['tomato', 'potato'],          pot: 'pot' },
  popcorn:       { name: 'Bắp Rang Bơ Phô Mai',    icon: '🍿', ing: { corn: 2, milk: 1 },                         time: 7,  price: 170, lvl: 2, tags: ['sweet'],         rsc: ['potato', 'dough'],           pot: 'pan' },
  omelette:      { name: 'Trứng Cuộn Thịt Cà Chua',icon: '🍳', ing: { egg: 2, chili: 1 },                         time: 7,  price: 160, lvl: 3, tags: ['egg'],           rsc: ['meat', 'tomato'],            pot: 'pan' },
  cake:          { name: 'Bánh Kem Phô Mai Dâu',   icon: '🍰', ing: { wheat: 2, egg: 1, milk: 1, strawberry: 2 }, time: 12, price: 380, lvl: 3, tags: ['sweet'],         rsc: ['dough', 'dough', 'tomato'],  pot: 'pan' },
  fishbowl:      { name: 'Cơm Hải Sản Tôm Cá',     icon: '🍱', ing: { fish: 1, rice: 1 },                         time: 9,  price: 190, lvl: 4, tags: ['fish'],          rsc: ['seafood', 'veg'],            pot: 'pot' },
  pie:           { name: 'Bánh Nướng Thịt Phô Mai',icon: '🥧', ing: { pumpkin: 1, wheat: 1, egg: 1 },             time: 12, price: 330, lvl: 4, tags: ['sweet'],         rsc: ['dough', 'meat', 'potato'],   pot: 'pan' },
  risotto:       { name: 'Cơm Nấm Phô Mai Sữa',    icon: '🍛', ing: { rice: 1, mushroom: 2, milk: 1 },            time: 12, price: 400, lvl: 4, tags: ['veg'],           rsc: ['potato', 'veg', 'dough'],    pot: 'pot' },
  cheeseplate:   { name: 'Đĩa Phô Mai Đút Lò',     icon: '🧀', ing: { cheese: 2, blueberry: 1 },                  time: 9,  price: 300, lvl: 4, tags: ['fancy'],         rsc: ['dough', 'dough'],            pot: 'pan' },
  smoothie:      { name: 'Súp Tôm Hùm Hoàng Gia',  icon: '🥤', ing: { blueberry: 2, strawberry: 1, milk: 1 },     time: 9,  price: 420, lvl: 5, tags: ['sweet'],         rsc: ['seafood', 'tomato', 'veg'],  pot: 'pot' },
  hotpot:        { name: 'Lẩu Hải Sản Thập Cẩm',   icon: '🫕', ing: { pumpkin: 1, fish: 1, mushroom: 1 },         time: 16, price: 560, lvl: 5, tags: ['fancy', 'fish'], rsc: ['seafood', 'meat', 'veg'],    pot: 'pot' },
};
export const RECIPE_LIST = Object.keys(RECIPES);
// Các món tiêu chuẩn xuất hiện trong ca làm thêm Ready, Set, Cook! ngay từ Cấp 1
export const RSC_MENU = ['broccoli_stir', 'steak_pan', 'shrimp_pot', 'tomato_pasta', 'fries', 'pancake', 'salad', 'soup', 'omelette', 'fishbowl', 'hotpot'];
