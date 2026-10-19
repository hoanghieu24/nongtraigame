// Nhân vật 3D tỷ lệ cân đối, chân thực (stylized 3D hiện đại): đầu/thân/tay/chân hài hòa, tóc xếp lớp, áo khoác hoodie có cổ, quần dài, giày sneaker và ba lô.
import * as THREE from 'three';
import { bake, merge, B, S, Cy, Co, Ca, To, M, MAT, G, blobShadow } from './Kit.js';
import { damp } from '../core/util.js';
import { WEAPONS } from '../data/weapons.js';

const shade2 = (h, f = 0.72) => new THREE.Color(h).multiplyScalar(f).getHex();

const hairParts = (style, hair) => {
  const darkHair = shade2(hair, 0.85);
  const p = [
    bake(S(0.45, 16, 12), hair, [0, 0.08, -0.03], [0, 0, 0], [1.03, 0.96, 1.04]),
    bake(Ca(0.11, 0.22), darkHair, [-0.16, 0.22, 0.34], [0.3, 0.2, -0.95], [1, 1, 0.55]),
    bake(Ca(0.11, 0.22), hair, [0.14, 0.23, 0.35], [0.3, -0.2, 0.9], [1, 1, 0.55]),
    bake(Ca(0.09, 0.18), darkHair, [-0.36, 0.04, 0.14], [0.15, 0, -0.15], [0.6, 1, 0.8]),
    bake(Ca(0.09, 0.18), darkHair, [0.36, 0.04, 0.14], [0.15, 0, 0.15], [0.6, 1, 0.8]),
    bake(B(0.68, 0.28, 0.22, 0.08), darkHair, [0, -0.06, -0.32], [-0.15, 0, 0]),
  ];
  if (style === 'long') p.push(bake(Ca(0.28, 0.48), hair, [0, -0.22, -0.28], [0.1, 0, 0], [1.18, 1, 0.55]));
  if (style === 'bun') p.push(bake(S(0.2, 10, 8), hair, [0, 0.52, -0.12]));
  if (style === 'beard') {
    p.push(
      bake(S(0.28, 10, 8), hair, [0, -0.28, 0.24], [0, 0, 0], [1.1, 0.8, 0.75]),
      bake(S(0.08, 8, 6), hair, [-0.08, -0.1, 0.41], [0, 0, 0], [1.3, 0.5, 0.6]),
      bake(S(0.08, 8, 6), hair, [0.08, -0.1, 0.41], [0, 0, 0], [1.3, 0.5, 0.6])
    );
  }
  return p;
};

const hatGeo = (id, outfit) => {
  const P = [], top = 0.86;
  switch (id) {
    case 'straw': P.push(bake(Cy(0.62, 0.62, 0.06, 18), 0xf2d27a, [0, top - 0.04, 0]), bake(S(0.41, 12, 8), 0xf6dc8e, [0, top, 0], [0, 0, 0], [1, 0.72, 1]), bake(Cy(0.43, 0.43, 0.09, 14), 0xe05c4a, [0, top + 0.01, 0])); break;
    case 'cap': P.push(bake(S(0.48, 12, 8), outfit, [0, top - 0.1, 0], [0, 0, 0], [1, 0.72, 1.02]), bake(B(0.5, 0.05, 0.42, 0.025), shade2(outfit), [0, top - 0.16, 0.46], [0.15, 0, 0]), bake(S(0.06, 6, 5), 0xffffff, [0, top + 0.12, 0])); break;
    case 'beanie': P.push(bake(S(0.48, 12, 8), 0x6c8fd6, [0, top - 0.11, 0], [0, 0, 0], [1, 0.8, 1]), bake(To(0.44, 0.08, 6, 16), 0xe6efff, [0, top - 0.25, 0], [Math.PI / 2, 0, 0]), bake(S(0.13, 8, 6), 0xffffff, [0, top + 0.32, 0])); break;
    case 'flower': P.push(bake(To(0.46, 0.06, 6, 18), 0x6bbf4f, [0, top - 0.1, 0], [Math.PI / 2 - 0.1, 0, 0])); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; P.push(bake(S(0.11, 7, 5), [0xff7aa2, 0xffd24a, 0xffffff][i % 3], [Math.cos(a) * 0.46, top - 0.07 + Math.sin(i * 2) * 0.02, Math.sin(a) * 0.46])); } break;
    case 'chef': P.push(bake(Cy(0.4, 0.42, 0.38, 14), 0xffffff, [0, top + 0.08, 0]), bake(S(0.35, 10, 8), 0xffffff, [0, top + 0.4, 0], [0, 0, 0], [1.15, 0.8, 1.15]), bake(S(0.24, 8, 6), 0xffffff, [0.24, top + 0.34, 0.08]), bake(S(0.24, 8, 6), 0xffffff, [-0.24, top + 0.34, -0.08])); break;
    case 'cowboy': P.push(bake(Cy(0.78, 0.78, 0.05, 18), 0xb07a45, [0, top - 0.05, 0], [0, 0, 0.0], [1, 1, 0.82]), bake(Cy(0.32, 0.38, 0.42, 12), 0xc08a52, [0, top + 0.14, 0]), bake(Cy(0.39, 0.39, 0.07, 12), 0x6a3e20, [0, top - 0.02, 0])); break;
    case 'prop': P.push(bake(S(0.48, 12, 8), 0xff6f4d, [0, top - 0.1, 0], [0, 0, 0], [1, 0.72, 1]), bake(Cy(0.035, 0.035, 0.25, 6), 0x555, [0, top + 0.24, 0])); break;
    default: return null;
  }
  return merge(P);
};

export function buildCharacter(look = {}) {
  const skin = look.skin ?? 0xf4c8a6, hair = look.hair ?? 0x2e2118, outfit = look.outfit ?? 0x3b7dc4, pants = 0x2a3546, scale = look.scale ?? 1;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const rig = { root, body, scale, pose: {}, t: Math.random() * 10, blinkT: 2 + Math.random() * 3, blink: 0, anim: 'idle', curTool: '', curHat: '' };
  // Chân dài cân đối + quần ống đứng + giày sneaker 2 màu
  const mkLeg = (sx) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.175, 0.76, 0);
    g.add(M(merge([
      bake(Ca(0.125, 0.34), pants, [0, -0.26, 0]),
      bake(Cy(0.135, 0.135, 0.07, 10), shade2(pants, 0.82), [0, -0.5, 0]),
      bake(B(0.25, 0.16, 0.38, 0.06), 0x343a44, [0, -0.6, 0.05]),
      bake(B(0.27, 0.065, 0.41, 0.025), 0xf6f6f6, [0, -0.69, 0.05]),
    ]), MAT.lit, { receive: false }));
    return g;
  };
  rig.legL = mkLeg(-1); rig.legR = mkLeg(1); body.add(rig.legL, rig.legR);

  // Thân áo hoodie / áo khoác có cổ mũ, dây kéo, gấu áo và ba lô đeo vai chân thực
  rig.torso = new THREE.Group(); rig.torso.position.set(0, 0.74, 0); body.add(rig.torso);
  rig.torso.add(M(merge([
    bake(Ca(0.32, 0.38), outfit, [0, 0.38, 0], [0, 0, 0], [1.04, 1, 0.84]),
    bake(Cy(0.33, 0.33, 0.1, 14), shade2(outfit, 0.82), [0, 0.1, 0], [0, 0, 0], [1.02, 1, 0.82]),
    bake(B(0.44, 0.24, 0.08, 0.04), shade2(outfit, 0.86), [0, 0.26, 0.25]),
    bake(To(0.24, 0.075, 7, 16), shade2(outfit, 0.88), [0, 0.68, -0.04], [Math.PI / 2 + 0.18, 0, 0]),
    bake(B(0.075, 0.54, 0.32, 0.02), 0x2b2623, [-0.21, 0.4, -0.02]),
    bake(B(0.075, 0.54, 0.32, 0.02), 0x2b2623, [0.21, 0.4, -0.02]),
    bake(B(0.48, 0.54, 0.25, 0.09), 0x38322e, [0, 0.38, -0.32]),
    bake(B(0.38, 0.26, 0.09, 0.04), 0x272320, [0, 0.27, -0.44]),
    bake(B(0.14, 0.06, 0.04, 0.01), 0xe6c878, [0, 0.46, -0.45]),
  ]), MAT.lit, { receive: false }));

  // Cánh tay + cổ tay áo + bàn tay
  const mkArm = (sx) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.41, 0.56, 0);
    g.add(M(merge([
      bake(Ca(0.105, 0.32), outfit, [0, -0.22, 0]),
      bake(Cy(0.11, 0.105, 0.07, 10), shade2(outfit, 0.82), [0, -0.42, 0]),
      bake(S(0.108, 9, 7), skin, [0, -0.5, 0], [0, 0, 0], [0.95, 1.05, 0.95]),
    ]), MAT.lit, { receive: false }));
    return g;
  };
  rig.armL = mkArm(-1); rig.armR = mkArm(1); rig.torso.add(rig.armL, rig.armR);
  rig.hand = new THREE.Group(); rig.hand.position.set(0, -0.5, 0.05); rig.armR.add(rig.hand);

  // Cổ & Đầu tỷ lệ tự nhiên, thanh thoát
  rig.neck = new THREE.Group(); rig.neck.position.set(0, 0.72, 0); rig.torso.add(rig.neck);
  rig.head = new THREE.Group(); rig.head.position.y = 0.46; rig.neck.add(rig.head);
  const earL = bake(S(0.09, 7, 5), skin, [-0.43, -0.02, 0], [0, 0, 0], [0.65, 1.1, 0.8]);
  const earR = bake(S(0.09, 7, 5), skin, [0.43, -0.02, 0], [0, 0, 0], [0.65, 1.1, 0.8]);
  rig.head.add(M(merge([
    bake(Cy(0.12, 0.14, 0.18, 10), shade2(skin, 0.92), [0, -0.42, 0]),
    bake(S(0.43, 18, 14), skin, [0, 0, 0], [0, 0, 0], [1.0, 0.98, 0.98]),
    earL, earR,
    bake(S(0.052, 7, 5), shade2(skin, 0.9), [0, -0.05, 0.42]),
    bake(S(0.075, 7, 5), 0xff94a2, [-0.26, -0.09, 0.35], [0, 0, 0], [1.1, 0.6, 0.5]),
    bake(S(0.075, 7, 5), 0xff94a2, [0.26, -0.09, 0.35], [0, 0, 0], [1.1, 0.6, 0.5]),
    ...hairParts(look.style || 'short', hair)
  ]), MAT.lit, { receive: false }));

  rig.eyes = new THREE.Group(); rig.eyes.position.set(0, 0.05, 0);
  rig.eyes.add(M(merge([
    bake(S(0.068, 8, 6), 0x231a12, [-0.155, 0, 0.39], [0, 0, 0], [0.92, 1.22, 0.55]),
    bake(S(0.068, 8, 6), 0x231a12, [0.155, 0, 0.39], [0, 0, 0], [0.92, 1.22, 0.55]),
    bake(S(0.024, 5, 4), 0xffffff, [-0.14, 0.038, 0.425]),
    bake(S(0.024, 5, 4), 0xffffff, [0.17, 0.038, 0.425])
  ]), MAT.lit, { cast: false, receive: false }));
  rig.head.add(rig.eyes);
  if (look.glasses) rig.head.add(M(merge([bake(To(0.105, 0.016, 5, 14), 0x6b5b4a, [-0.155, 0.05, 0.41]), bake(To(0.105, 0.016, 5, 14), 0x6b5b4a, [0.155, 0.05, 0.41]), bake(Cy(0.012, 0.012, 0.1, 4), 0x6b5b4a, [0, 0.06, 0.41], [0, 0, Math.PI / 2])]), MAT.lit, { cast: false, receive: false }));
  const brow = (sx) => { const m = M(bake(Ca(0.02, 0.08, 2, 5), 0x3a2a1a, [0, 0, 0], [0, 0, Math.PI / 2]), MAT.lit, { cast: false, receive: false }); m.position.set(sx * 0.155, 0.19, 0.39); return m; };
  rig.browL = brow(-1); rig.browR = brow(1); rig.head.add(rig.browL, rig.browR);
  const mouth = (geo, rotz, y = -0.17) => { const m = M(bake(geo, 0x7a2a2a, [0, 0, 0], [0, 0, rotz], 1), MAT.lit, { cast: false, receive: false }); m.position.set(0, y, 0.41); return m; };
  rig.mouthS = mouth(To(0.075, 0.018, 5, 12, Math.PI), Math.PI); rig.mouthF = mouth(To(0.065, 0.018, 5, 12, Math.PI), 0, -0.23); rig.mouthO = mouth(S(0.055, 8, 6), 0, -0.19); rig.mouthO.scale.set(1, 1.2, 0.5);
  rig.head.add(rig.mouthS, rig.mouthF, rig.mouthO);
  // mũ + dụng cụ + đồ bưng
  rig.hatSlot = new THREE.Group(); rig.head.add(rig.hatSlot); rig.setHat = (id) => { if (rig.curHat === id) return; rig.curHat = id; rig.hatSlot.clear(); const g = hatGeo(id, outfit); if (g) { const m = M(g, MAT.lit, { receive: false }); rig.hatSlot.add(m); if (id === 'prop') { rig.prop = new THREE.Group(); rig.prop.position.y = 1.15; rig.prop.add(M(merge([bake(B(0.8, 0.03, 0.13, 0.01), 0xffd23f), bake(B(0.13, 0.03, 0.8, 0.01), 0xffd23f)]), MAT.lit, { receive: false })); rig.hatSlot.add(rig.prop); } else rig.prop = null; } };
  rig.setHat(look.hat || 'none');
  rig.toolSlot = new THREE.Group(); rig.hand.add(rig.toolSlot);
  rig.carry = new THREE.Group(); rig.carry.position.set(0, 0.55, 0.62); rig.carry.visible = false; rig.torso.add(rig.carry);
  rig.carry.add(M(merge([bake(Cy(0.3, 0.26, 0.05, 14), 0xffffff), bake(S(0.2, 9, 7), 0xff9a4d, [0, 0.12, 0], [0, 0, 0], [1, 0.7, 1]), bake(S(0.09, 7, 5), 0x7bc96a, [0.08, 0.22, 0.05])]), MAT.lit, { receive: false }));
  rig.shadow = blobShadow(1.65); root.add(rig.shadow);
  root.scale.setScalar(scale); rig.height = 2.35 * scale;
  return rig;
}

// ---- dụng cụ cầm tay ----
const toolCache = {};
export function toolMesh(id, weapon) {
  const key = id === 'weapon' ? 'w_' + weapon : id; if (toolCache[key]) return toolCache[key].clone();
  let g;
  switch (id) {
    case 'hoe': g = merge([bake(Cy(0.04, 0.04, 1.5, 6), 0x9a6b44, [0, -0.05, 0.0]), bake(B(0.42, 0.1, 0.07, 0.02), 0x9aa4b0, [0, -0.8, 0.13], [0.5, 0, 0]), bake(Cy(0.03, 0.03, 0.3, 5), 0x9aa4b0, [0, -0.72, 0.05], [0.5, 0, 0])]); break;
    case 'can': g = merge([bake(Cy(0.2, 0.22, 0.32, 12), 0x5aa7e0, [0, -0.1, 0.12]), bake(Cy(0.04, 0.05, 0.4, 6), 0x4b94cc, [0, 0.02, 0.38], [1.0, 0, 0]), bake(S(0.07, 6, 5), 0x4b94cc, [0, 0.16, 0.56]), bake(To(0.13, 0.03, 5, 12, Math.PI), 0x4b94cc, [0, 0.12, -0.02], [0, 0, 0])]); break;
    case 'seeds': g = merge([bake(S(0.2, 9, 7), 0xc99a6a, [0, -0.12, 0.1], [0, 0, 0], [1, 1.1, 0.9]), bake(Co(0.1, 0.14, 7), 0xc99a6a, [0, 0.06, 0.1]), bake(To(0.09, 0.02, 5, 10), 0x8a5a3a, [0, 0.0, 0.1], [Math.PI / 2, 0, 0]), bake(S(0.05, 5, 4), 0x7bc96a, [0.05, 0.12, 0.1])]); break;
    case 'feed': g = merge([bake(Cy(0.22, 0.16, 0.28, 12), 0xd9a441, [0, -0.14, 0.1]), bake(Cy(0.19, 0.19, 0.03, 12), 0xffe08a, [0, -0.01, 0.1]), bake(To(0.2, 0.02, 4, 12, Math.PI), 0x6b4a2b, [0, -0.01, 0.1], [0, 0, 0])]); break;
    case 'rod': g = merge([bake(Cy(0.025, 0.04, 2.1, 6), 0x9a6b44, [0, 0.3, 0.55], [1.15, 0, 0]), bake(Cy(0.08, 0.08, 0.1, 8), 0x8a8f99, [0, 0.0, 0.02], [0, 0, Math.PI / 2]), bake(S(0.04, 5, 4), 0xff5a5a, [0, 1.15, 1.45])]); break;
    default: { const w = WEAPONS[weapon] || WEAPONS.slipper;
      if (weapon === 'broom') g = merge([bake(Cy(0.035, 0.035, 1.5, 6), 0x9a6b44, [0, 0.3, 0.1]), bake(Cy(0.04, 0.3, 0.45, 8), 0xe0b24a, [0, -0.55, 0.1]), bake(To(0.14, 0.03, 4, 10), 0x6b4a2b, [0, -0.3, 0.1], [Math.PI / 2, 0, 0])]);
      else if (weapon === 'pan') g = merge([bake(Cy(0.04, 0.04, 0.7, 6), 0x3a3a40, [0, 0, 0.05]), bake(Cy(0.42, 0.42, 0.07, 16), 0x4a4a52, [0, -0.5, 0.1], [0, 0, 0]), bake(Cy(0.34, 0.34, 0.05, 16), 0x2f2f35, [0, -0.5, 0.12])]);
      else if (weapon === 'mop') g = merge([bake(Cy(0.03, 0.03, 1.6, 6), 0xb0b4ba, [0, 0.25, 0.05]), ...[0, 1, 2, 3, 4, 5].map((i) => bake(Ca(0.04, 0.3), 0xf2f2f2, [Math.cos(i) * 0.12, -0.7, 0.05 + Math.sin(i) * 0.12], [0.2 * Math.cos(i), 0, 0.2 * Math.sin(i)])), bake(S(0.16, 8, 6), 0x88c4e8, [0, -0.56, 0.05])]);
      else if (weapon === 'shovel') g = merge([bake(Cy(0.035, 0.035, 1.4, 6), 0x9a6b44, [0, 0.2, 0.05]), bake(B(0.36, 0.5, 0.05, 0.03), 0x9aa4b0, [0, -0.7, 0.05]), bake(To(0.1, 0.03, 4, 8, Math.PI), 0x6b4a2b, [0, 0.9, 0.05])]);
      else if (weapon === 'fish') g = merge([bake(S(0.2, 10, 8), 0x7cc4e8, [0, -0.3, 0.1], [0, 0, 0], [0.6, 1.6, 0.4]), bake(Co(0.2, 0.3, 4), 0x5aa7d0, [0, -0.78, 0.1], [Math.PI, 0, 0], [1, 1, 0.3]), bake(S(0.04, 5, 4), 0x222222, [0.06, -0.12, 0.2])]);
      else g = merge([bake(S(0.2, 10, 8), w.color, [0, -0.3, 0.1], [0, 0, 0], [0.9, 1.9, 0.35]), bake(Cy(0.03, 0.03, 0.35, 5), 0xffffff, [0, -0.1, 0.1], [0, 0, 0]), bake(S(0.16, 7, 5), 0xffffff, [0, 0.0, 0.1], [0, 0, 0], [1, 0.6, 0.5])]);   // dép tổ ong
    }
  }
  const m = M(g, MAT.lit, { receive: false }); toolCache[key] = m; return m.clone();
}
export function setTool(rig, tool, weapon) {
  const key = tool + ':' + (tool === 'weapon' ? weapon : '');
  if (rig.curTool === key) return; rig.curTool = key; rig.toolSlot.clear(); if (tool && tool !== 'none' && tool !== 'build') rig.toolSlot.add(toolMesh(tool, weapon));
}

// ---- animation (procedural, damp để mượt) ----
const P0 = { bx: 0, y: 0, tx: 0, tz: 0, hx: 0, hz: 0, alx: 0, alz: 0.08, arx: 0, arz: -0.08, ll: 0, lr: 0, tool: 0, ty: 0 };
const ANIMS = {
  idle: (t) => ({ y: Math.sin(t * 2) * 0.018, alx: Math.sin(t * 1.7) * 0.045, arx: -Math.sin(t * 1.7) * 0.045, hx: Math.sin(t * 1.3) * 0.03, hz: Math.sin(t * 0.9) * 0.02 }),
  walk: (t) => { const w = Math.sin(t * 9); return { y: Math.abs(Math.cos(t * 9)) * 0.065, ll: w * 0.78, lr: -w * 0.78, alx: -w * 0.72, arx: w * 0.72, tz: w * 0.035, tx: 0.05 }; },
  run: (t) => { const w = Math.sin(t * 14.5); return { y: Math.abs(Math.cos(t * 14.5)) * 0.12, ll: w * 1.15, lr: -w * 1.15, alx: -w * 1.2, arx: w * 1.2, tx: 0.24, tz: w * 0.06 }; },
  jump: () => ({ y: 0.06, tx: -0.08, alx: -2.15, arx: -1.95, alz: 0.35, arz: -0.35, ll: -0.65, lr: 0.42, hx: -0.14 }),
  till: (t) => { const k = (t * 2.6) % 1, up = k < 0.5 ? k * 2 : 1 - (k - 0.5) * 3.4; return { tx: 0.2 + up * 0.2, arx: -2.4 + (1 - Math.max(0, up)) * 2.6, alx: -2.0 + (1 - Math.max(0, up)) * 2.0, tool: 0.2, hx: 0.2 }; },
  water: (t) => ({ arx: -1.25, alx: -0.2, tool: 0.4 + Math.sin(t * 4) * 0.18, tx: 0.12, hx: 0.12 }),
  plant: (t) => ({ tx: 0.7, hx: 0.2, arx: -0.9 + Math.sin(t * 8) * 0.4, alx: -0.7 - Math.sin(t * 8) * 0.4, ll: -0.2, lr: 0.2, y: -0.06 }),
  harvest: (t) => { const k = (t * 3) % 1; return { tx: 0.75 - k * 0.55, hx: 0.15, arx: -1.0 - k * 1.2, alx: -1.0 - k * 1.2, y: -0.05 + k * 0.1 }; },
  pet: (t) => ({ tx: 0.55, hx: 0.2, arx: -1.0 + Math.sin(t * 7) * 0.3, alx: -1.0 - Math.sin(t * 7) * 0.3, y: -0.12, ll: -0.35, lr: 0.35 }),
  feed: (t) => ({ arx: -0.9 - Math.sin(t * 7) * 0.5, alx: -0.4, tool: 0.3, tx: 0.15, hx: 0.1 }),
  attack: (t) => { const k = (t * 3.3) % 1, sw = k < 0.28 ? k / 0.28 : 1 - (k - 0.28) / 0.72 * 0.7; return { arx: -2.6 + sw * 3.0, tx: -0.1 + sw * 0.35, tool: -0.3 + sw * 0.9, ty: sw * 0.3, ll: -sw * 0.5, lr: sw * 0.5, alx: 0.4, hx: 0.05 }; },
  cast: (t) => { const k = Math.min(1, t * 2.4 % 2); return { arx: -2.4 + k * 1.6, tool: 0.1, tx: -0.1 + k * 0.25, hx: -0.1 }; },
  fish: (t) => ({ arx: -1.25, alx: -0.5, tool: 0.1, tx: -0.04, hx: 0.12 + Math.sin(t * 1.4) * 0.04, y: Math.sin(t * 1.4) * 0.01 }),
  reel: (t) => ({ arx: -1.2 + Math.sin(t * 9) * 0.15, alx: -0.9 + Math.sin(t * 9 + 1) * 0.2, tool: 0.0, tx: -0.2, ll: 0.3, lr: -0.3, y: Math.sin(t * 9) * 0.03 }),
  carry: (t) => ({ arx: -1.25, alx: -1.25, arz: -0.35, alz: 0.35, y: Math.sin(t * 2) * 0.015, hx: -0.05 }),
  celebrate: (t) => ({ y: Math.abs(Math.sin(t * 7)) * 0.45, arx: -2.9 + Math.sin(t * 14) * 0.3, alx: -2.9 - Math.sin(t * 14) * 0.3, arz: -0.5, alz: 0.5, hx: -0.15, ll: Math.sin(t * 7) * 0.3, lr: -Math.sin(t * 7) * 0.3 }),
  sad: (t) => ({ hx: 0.55, tx: 0.18, arx: 0.05, alx: 0.05, y: -0.04, hz: Math.sin(t * 1.2) * 0.05 }),
  surprised: (t) => ({ y: 0.12 + Math.sin(t * 20) * 0.01, arz: -1.4, alz: 1.4, arx: -0.3, alx: -0.3, hx: -0.25, tx: -0.12, ll: -0.15, lr: 0.15 }),
  sit: (t) => ({ y: -0.34, ll: -1.42, lr: -1.42, tx: -0.06, arx: -0.32, alx: -0.32, hx: Math.sin(t * 1.1) * 0.04 }),
  stumble: (t) => ({ tx: -0.35, y: Math.abs(Math.sin(t * 16)) * 0.1, arz: -1.1, alz: 1.1, arx: -0.4 * Math.sin(t * 18), alx: 0.4 * Math.sin(t * 18), hx: -0.3, ll: Math.sin(t * 14) * 0.6, lr: -Math.sin(t * 14) * 0.6 }),
  wave: (t) => ({ arx: -2.8, arz: -0.6 + Math.sin(t * 10) * 0.4, alx: 0.0 }),
  scared: (t) => ({ y: Math.abs(Math.sin(t * 16)) * 0.14, ll: Math.sin(t * 18) * 0.9, lr: -Math.sin(t * 18) * 0.9, arx: -2.5, alx: -2.5, arz: -0.5, alz: 0.5, tx: 0.2 }),
  zombie: (t) => ({ alx: -1.45 + Math.sin(t * 2) * 0.12, arx: -1.45 + Math.sin(t * 2 + 1) * 0.12, tx: 0.18, hx: 0.25 + Math.sin(t * 1.3) * 0.1, hz: Math.sin(t * 1.7) * 0.18, ll: Math.sin(t * 5) * 0.5, lr: -Math.sin(t * 5) * 0.5, y: Math.abs(Math.sin(t * 5)) * 0.04 }),
  // Tư thế nằm trên giường: lưng đặt êm trên đệm, đầu tựa gối nhẹ, ngực thở đều, hai tay đặt nhẹ trên bụng
  sleep: (t) => ({ bx: -1.52, y: 0.04 + Math.sin(t * 1.8) * 0.014, tx: Math.sin(t * 1.8) * 0.025, hx: 0.14, hz: 0.04, alx: -0.18, arx: -0.18, alz: -0.18, arz: 0.18, ll: 0.04, lr: 0.04 }),
  think: (t) => ({ hz: 0.2, hx: -0.1, arx: -1.9, arz: 0.1, alx: 0.0 }),
};
export const ANIM_NAMES = Object.keys(ANIMS);
const MOOD = { sad: 'sad', surprised: 'surprised', celebrate: 'happy', jump: 'happy', attack: 'angry', scared: 'surprised', stumble: 'surprised', pet: 'happy', harvest: 'happy', reel: 'angry', wave: 'happy', sit: 'happy' };
export function poseCharacter(rig, anim, dt, speed = 0, airY = 0) {
  rig.t += dt; const t = rig.t;
  const fn = ANIMS[anim] || ANIMS.idle, tgt = { ...P0, ...fn(t, speed) }, p = rig.pose, k = 14;
  for (const key in tgt) p[key] = p[key] === undefined ? tgt[key] : damp(p[key], tgt[key], k, dt);
  rig.body.position.y = p.y; rig.body.rotation.x = p.bx; rig.torso.rotation.x = p.tx; rig.torso.rotation.z = p.tz; rig.neck.rotation.x = p.hx; rig.neck.rotation.z = p.hz;
  rig.armL.rotation.x = p.alx; rig.armL.rotation.z = p.alz; rig.armR.rotation.x = p.arx; rig.armR.rotation.z = p.arz; rig.legL.rotation.x = p.ll; rig.legR.rotation.x = p.lr;
  rig.toolSlot.rotation.x = p.tool; rig.toolSlot.rotation.y = p.ty;
  rig.toolSlot.visible = anim !== 'sleep';
  rig.shadow.position.y = 0.05 - p.y - airY;
  rig.shadow.scale.setScalar(anim === 'sleep' ? 0.01 : Math.max(0.38, 1 - Math.min(0.55, (Math.abs(p.y) + airY * 0.38) * 0.8)));
  // nét mặt + nhắm mắt khi ngủ (anim === 'sleep' -> mắt khép kín 0.07)
  const mood = MOOD[anim] || (anim === 'idle' || anim === 'walk' || anim === 'run' ? 'smile' : 'neutral');
  rig.blinkT -= dt; if (rig.blinkT <= 0) { rig.blink = 0.12; rig.blinkT = 2.5 + Math.random() * 3; } rig.blink = Math.max(0, rig.blink - dt);
  const targetEyeY = anim === 'sleep' ? 0.07 : rig.blink > 0 ? 0.12 : mood === 'happy' ? 0.65 : 1;
  rig.eyes.scale.y = damp(rig.eyes.scale.y, targetEyeY, 18, dt);
  const by = mood === 'sad' ? 0.22 : mood === 'surprised' ? 0.26 : 0.19;
  rig.browL.position.y = rig.browR.position.y = by; rig.browL.rotation.z = mood === 'sad' ? -0.35 : mood === 'angry' ? 0.35 : 0; rig.browR.rotation.z = mood === 'sad' ? 0.35 : mood === 'angry' ? -0.35 : 0;
  rig.mouthS.visible = mood === 'smile' || mood === 'happy' || mood === 'neutral' || anim === 'sleep'; rig.mouthF.visible = mood === 'sad' || mood === 'angry'; rig.mouthO.visible = mood === 'surprised' || anim === 'celebrate' || anim === 'jump';
  if (rig.prop) rig.prop.rotation.y += dt * (8 + speed * 14);
  rig.carry.visible = anim === 'carry';
}
