export const WEATHER = {
  clear:  { icon: '☀️', name: 'Trời nắng',  msg: '' },
  cloudy: { icon: '☁️', name: 'Nhiều mây',  msg: '☁️ Trời nhiều mây' },
  rain:   { icon: '🌧️', name: 'Trời mưa',   msg: '🌧️ Trời mưa — cây được tưới miễn phí' },
  storm:  { icon: '⛈️', name: 'Giông bão',  msg: '⛈️ Giông bão! Cây được tưới, cẩn thận sấm sét' },
  fog:    { icon: '🌫️', name: 'Sương mù',   msg: '🌫️ Sương mù dày đặc' },
  snow:   { icon: '❄️', name: 'Tuyết rơi',  msg: '❄️ Tuyết rơi — cây lớn chậm hơn' },
};
export const isWet = (w) => w === 'rain' || w === 'storm';
// Xác suất thời tiết theo mùa: Xuân, Hạ, Thu, Đông
export const WEATHER_TABLE = [
  [['clear', 45], ['cloudy', 20], ['rain', 28], ['fog', 7]],
  [['clear', 52], ['cloudy', 14], ['rain', 12], ['storm', 17], ['fog', 5]],
  [['clear', 32], ['cloudy', 26], ['fog', 20], ['rain', 22]],
  [['clear', 32], ['cloudy', 24], ['snow', 38], ['fog', 6]],
];
