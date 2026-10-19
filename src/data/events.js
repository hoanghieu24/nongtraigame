export const EVENTS = {
  rain:            { name: 'Trời Mưa',            icon: '🌧️', weight: 3,   dur: [70, 110], minLvl: 1, banner: 'Trời mưa rồi! Cây được tưới miễn phí ☔' },
  ufo:             { name: 'UFO Ghé Thăm',        icon: '🛸', weight: 2,   dur: 18,        minLvl: 1, banner: 'UFO đang bay qua nông trại!' },
  chicken_party:   { name: 'Tiệc Gà Điên',        icon: '🐔', weight: 2.4, dur: 30,        minLvl: 1, needs: 'chicken', banner: 'TIỆC GÀ! Chạy đi bắt gà càng nhiều càng tốt!' },
  golden_animal:   { name: 'Thú Vàng Xuất Hiện',  icon: '✨', weight: 1.6, dur: 180,       minLvl: 1, needs: 'animal', banner: 'Một con thú đang phát sáng vàng!' },
  merchant:        { name: 'Thương Nhân Du Hành', icon: '🧳', weight: 1.6, dur: 300,       minLvl: 2, banner: 'Thương nhân du hành ghé nông trại 5 phút! Hàng hiếm đây!' },
  meteor:          { name: 'Thiên Thạch Rơi',     icon: '☄️', weight: 1.8, dur: 120,       minLvl: 1, banner: 'Thiên thạch rơi! Chạy đi nhặt bụi sao!' },
  thief:           { name: 'Trộm Đột Nhập',       icon: '🚨', weight: 4,   dur: 70,        minLvl: 1, banner: 'CÓ TRỘM VÀO FARM!!!' },
  fishing_contest: { name: 'Thi Câu Cá',          icon: '🎣', weight: 1.5, dur: 90,        minLvl: 2, banner: 'THI CÂU CÁ 90 giây! Ra cầu tàu ngay!' },
};
export const EVENT_GAP = [70, 140];      // giây giữa hai sự kiện
