import { CROPS } from './crops.js';
import { ITEMS } from './items.js';
import { NPCS } from './npcs.js';

export const QUEST_ICON = { harvest: '🧺', plant: '🌱', water: '💧', feed: '🥣', collect: '🥚', fish: '🎣', sell: '💰', cook: '🍳', deliver: '🎁', coop_water: '🤝', coop_harvest: '🤝', chase: '🚨', pet: '💗' };
export function questText(q) {
  const it = q.item ? (CROPS[q.item]?.name || ITEMS[q.item]?.name || q.item) : null;
  switch (q.kind) {
    case 'harvest': return it ? `Thu hoạch ${q.n} ${it}` : `Thu hoạch ${q.n} nông sản`;
    case 'plant': return `Gieo ${q.n} hạt giống`;
    case 'water': return `Tưới nước ${q.n} lần`;
    case 'feed': return `Cho thú ăn ${q.n} lần`;
    case 'pet': return `Vuốt ve thú cưng ${q.n} lần`;
    case 'collect': return `Thu ${q.n} sản phẩm từ vật nuôi`;
    case 'fish': return `Câu ${q.n} con cá`;
    case 'sell': return it ? `Bán ${q.n} ${it}` : `Bán ${q.n} món đồ`;
    case 'cook': return `Nấu ${q.n} món ăn`;
    case 'chase': return `Đuổi ${q.n} tên trộm`;
    case 'deliver': return `${NPCS[q.npc]?.name || 'Hàng xóm'} cần ${q.n} ${it}`;
    case 'coop_water': return `Hai người cùng tưới ${q.n} cây`;
    case 'coop_harvest': return `Cả nhà cùng thu hoạch ${q.n} cây`;
  }
  return q.kind;
}
