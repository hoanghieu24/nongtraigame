// Combat hài hước: không máu me. reach: tầm đánh, arc: nửa góc quét, knock: lực đẩy, stun: giây choáng
export const WEAPONS = {
  slipper: { name: 'Dép Tổ Ong',       icon: '🩴', lvl: 1, reach: 2.5, arc: 0.9,  dmg: 1, knock: 5.0, stun: 1.1, cd: 0.42, sfx: 'bonk',  color: 0xff8a5c },
  broom:   { name: 'Chổi Lông Gà',     icon: '🧹', lvl: 2, reach: 3.3, arc: 1.0,  dmg: 1, knock: 4.2, stun: 1.0, cd: 0.5,  sfx: 'swish', color: 0xd9a441 },
  pan:     { name: 'Chảo Chống Dính',  icon: '🍳', lvl: 3, reach: 2.4, arc: 0.8,  dmg: 1, knock: 5.6, stun: 1.7, cd: 0.62, sfx: 'clang', color: 0x4a4a52 },
  mop:     { name: 'Cây Lau Nhà',      icon: '🪣', lvl: 4, reach: 3.6, arc: 1.35, dmg: 1, knock: 4.0, stun: 1.2, cd: 0.55, sfx: 'splat', color: 0x88c4e8 },
  shovel:  { name: 'Xẻng Thần Sầu',    icon: '⛏️', lvl: 5, reach: 2.8, arc: 0.85, dmg: 2, knock: 6.5, stun: 1.3, cd: 0.75, sfx: 'clang', color: 0x9aa4b0 },
  fish:    { name: 'Cá Tươi Vả Mặt',   icon: '🐟', lvl: 2, reach: 2.4, arc: 0.9,  dmg: 1, knock: 7.5, stun: 1.4, cd: 0.6,  sfx: 'slap',  color: 0x7cc4e8, consumes: 'fish' },
};
export const WEAPON_LIST = Object.keys(WEAPONS);
