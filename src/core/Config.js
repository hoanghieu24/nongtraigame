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

// Preset đồ hoạ tối ưu chuyên sâu cho Mobile Web & PC: ưu tiên độ nét ở cự ly gần, cắt giảm vật thể thừa ở xa để đạt 60 FPS mượt mà
export const QUALITY = {
  low:    { pr: 1.4,  mobilePr: 1.4,  shadows: false, shadowMap: 512,  grass: 0.18, trees: 0.50, particles: 110, clouds: 4, flowers: 0.22, cullDist: 30 },
  medium: { pr: 2.0,  mobilePr: 2.0,  shadows: false, shadowMap: 512,  grass: 0.38, trees: 0.70, particles: 220, clouds: 6, flowers: 0.45, cullDist: 36 },
  high:   { pr: 3.0,  mobilePr: 2.85, shadows: true,  shadowMap: 1024, grass: 0.65, trees: 0.85, particles: 360, clouds: 8, flowers: 0.75, cullDist: 44 },
};

