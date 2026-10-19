import { CROPS } from './crops.js';
import { ANIMALS } from './animals.js';
import { FISH } from './fish.js';
import { RECIPES } from './recipes.js';

// cat: seed | crop | product | fish | dish | material | special
export const ITEMS = {};
for (const [id, c] of Object.entries(CROPS)) {
  ITEMS[id] = { id, name: c.name, icon: c.icon, cat: 'crop', sell: c.sell, tags: ['crop'] };
  if (c.seed > 0 || c.rare || c.event) ITEMS['seed_' + id] = { id: 'seed_' + id, name: 'Hạt ' + c.name, icon: '🌱', sub: c.icon, cat: 'seed', sell: Math.floor(c.seed * 0.4), tags: ['seed'], crop: id };
}
const PRODUCTS = {
  egg:     { name: 'Trứng Gà',        icon: '🥚', sell: 12 },
  feather: { name: 'Lông Vịt',        icon: '🪶', sell: 20 },
  clover:  { name: 'Cỏ Bốn Lá',       icon: '🍀', sell: 34 },
  wool:    { name: 'Len Cừu',         icon: '🧶', sell: 40 },
  truffle: { name: 'Nấm Cục Của Heo', icon: '🌰', sell: 56 },
  cheese:  { name: 'Phô Mai Dê',      icon: '🧀', sell: 48 },
  milk:    { name: 'Sữa Tươi',        icon: '🥛', sell: 34 },
  golden_egg: { name: 'Trứng Vàng',   icon: '🥇', sell: 320 },
};
for (const [id, p] of Object.entries(PRODUCTS)) ITEMS[id] = { id, ...p, cat: 'product', tags: ['product'] };
for (const [id, f] of Object.entries(FISH)) ITEMS[id] = { id, name: f.name, icon: f.icon, cat: 'fish', sell: f.value, tags: ['fish'], rarity: f.rarity };
for (const [id, r] of Object.entries(RECIPES)) ITEMS['dish_' + id] = { id: 'dish_' + id, name: r.name, icon: r.icon, cat: 'dish', sell: Math.floor(r.price * 0.7), tags: ['dish', ...r.tags], recipe: id };
Object.assign(ITEMS, {
  feed:      { id: 'feed',      name: 'Thức Ăn Gia Súc',   icon: '🌽', sub: '🥣', cat: 'material', sell: 1,  desc: 'Cho vật nuôi ăn' },
  bait:      { id: 'bait',      name: 'Mồi Câu Thơm',      icon: '🪱', cat: 'material', sell: 2,  desc: 'Tăng tỉ lệ cá hiếm' },
  stardust:  { id: 'stardust',  name: 'Bụi Sao',           icon: '✨', cat: 'special',  sell: 90, desc: 'Rơi từ thiên thạch' },
  crystal:   { id: 'crystal',   name: 'Tinh Thể Núi',      icon: '💎', cat: 'special',  sell: 75 },
  shell:     { id: 'shell',     name: 'Vỏ Sò Xinh',        icon: '🐚', cat: 'special',  sell: 26 },
  flower:    { id: 'flower',    name: 'Hoa Dại',           icon: '🌼', cat: 'special',  sell: 14 },
  herb:      { id: 'herb',      name: 'Thảo Mộc Rừng',     icon: '🌿', cat: 'special',  sell: 22 },
  berry:     { id: 'berry',     name: 'Quả Rừng',          icon: '🍒', cat: 'special',  sell: 18 },
  alien_gift:{ id: 'alien_gift',name: 'Quà Người Ngoài Hành Tinh', icon: '🎁', cat: 'special', sell: 150 },
});
export const item = (id) => ITEMS[id] || { id, name: id, icon: '❔', cat: 'special', sell: 0 };
export const isSellable = (id) => { const i = ITEMS[id]; return !!i && i.cat !== 'seed' && i.id !== 'feed' && i.id !== 'bait' && (i.sell || 0) > 0; };
export const itemMatches = (id, key) => (key === 'fish' ? ITEMS[id]?.cat === 'fish' && id !== 'boot' : id === key);
export const PRODUCT_ITEMS = Object.keys(PRODUCTS);
export const CATS = [['all', 'Tất cả'], ['crop', 'Nông sản'], ['product', 'Sản phẩm'], ['fish', 'Cá'], ['dish', 'Món ăn'], ['seed', 'Hạt giống'], ['material', 'Vật liệu'], ['special', 'Đặc biệt']];
