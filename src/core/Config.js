export const CFG = {
  VERSION: 1,
  DAY_SECONDS: 1200,       // 1 ngày trong game = 20 phút thật (ban đêm ~6-7 phút)
  START_HOUR: 8,
  SEASON_DAYS: 4,
  MAX_PLAYERS: 4,
  NET: { POSE_HZ: 15, SNAP_HZ: 10, OPS_HZ: 10 },
  START_COINS: 120,
  FAMILY_BONUS: 0.15,      // mỗi lần bán hàng, quỹ chung nhận thêm 15% (không trừ người bán)
  REACH: 2.7,              // tầm với của công cụ
  WATER_SECONDS: 100,
  RESTAURANT_COST: 12000,
  RESTAURANT_LEVEL: 4,
  SAVE_KEY: 'ffp.save.main',
  PROFILE_KEY: 'ffp.profile.v1',
  AUTOSAVE_S: 20,
};

// Preset đồ hoạ (đã hạ độ phân giải, cỏ hoa, hạt hiệu ứng để chống giật trên máy yếu & điện thoại)
export const QUALITY = {
  low:    { pr: 1.0,  mobilePr: 1.0,  shadows: false, shadowMap: 512,  grass: 0.10, trees: 0.45, particles: 60,  clouds: 3, flowers: 0.12, cullDist: 28 },
  medium: { pr: 1.5,  mobilePr: 1.5,  shadows: false, shadowMap: 512,  grass: 0.25, trees: 0.60, particles: 120, clouds: 4, flowers: 0.28, cullDist: 34 },
  high:   { pr: 2.0,  mobilePr: 2.0,  shadows: true,  shadowMap: 1024, grass: 0.50, trees: 0.80, particles: 200, clouds: 6, flowers: 0.55, cullDist: 42 },
};

