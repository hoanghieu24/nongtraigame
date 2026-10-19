// Thú vật procedural dễ thương (bóng, tròn) + Gà con lông vàng (chick) + Ổ rơm đẻ trứng / ấp trứng 3D.
import * as THREE from 'three';
import { bake, merge, S, Cy, Co, Ca, To, M, MAT, blobShadow, glowSprite } from './Kit.js';
import { damp } from '../core/util.js';

const E = (r, c, p = [0, 0, 0], s = [1, 1, 1], rot = [0, 0, 0]) => bake(S(r, 11, 8), c, p, rot, s);
const limb = (x, y, z, h, r, c, foot) => { const g = new THREE.Group(); g.position.set(x, y, z); g.add(M(merge([bake(Cy(r, r * 0.85, h, 6), c, [0, -h / 2, 0]), ...(foot ? [bake(S(r * 1.3, 7, 5), foot, [0, -h, r * 0.5], [0, 0, 0], [1, 0.55, 1.4])] : [])]), MAT.lit, { receive: false })); return g; };
const part = (geo) => M(geo, MAT.lit, { receive: false });
const grp = (x, y, z, ...kids) => { const g = new THREE.Group(); g.position.set(x, y, z); for (const k of kids) g.add(k); return g; };
const eyes = (z, y, x, r = 0.04, c = 0x222222) => [E(r, c, [-x, y, z], [1, 1.2, 0.7]), E(r, c, [x, y, z], [1, 1.2, 0.7])];

const SPEC = {
  chicken(gold, baby = false) {
    // Nếu là Gà Con mới nở (baby = true): lông vàng ươm tròn xoe như cục bông, mỏ cam nhỏ xinh, chưa mọc mào đỏ
    if (baby) {
      const yCol = gold ? 0xffd700 : 0xffe252, wCol = gold ? 0xffb700 : 0xffca28;
      const body = merge([
        E(0.32, yCol, [0, 0.48, 0], [1.02, 0.94, 1.12]),
        bake(Co(0.08, 0.22, 5), wCol, [0, 0.62, -0.34], [-0.8, 0, 0]),
      ]);
      const head = merge([
        E(0.22, yCol, [0, 0.16, 0.05]),
        bake(Co(0.05, 0.14, 5), yCol, [0, 0.38, 0.04], [-0.2, 0, 0]), // chỏm lông tơ trên đỉnh đầu gà con
        bake(Co(0.065, 0.16, 5), 0xff8c24, [0, 0.14, 0.27], [Math.PI / 2, 0, 0]),
        E(0.045, 0xff94a2, [-0.13, 0.11, 0.19], [1, 0.6, 0.5]),
        E(0.045, 0xff94a2, [0.13, 0.11, 0.19], [1, 0.6, 0.5]),
        ...eyes(0.22, 0.2, 0.1, 0.038),
      ]);
      const wing = (s) => grp(s * 0.3, 0.52, 0, part(E(0.15, wCol, [s * 0.03, -0.06, 0], [0.35, 0.9, 1.3])));
      return {
        body, bodyY: 0, head, headAt: [0, 0.68, 0.2],
        legs: [limb(-0.1, 0.22, 0.0, 0.22, 0.022, 0xff9a2e, 0xff9a2e), limb(0.1, 0.22, 0.0, 0.22, 0.022, 0xff9a2e, 0xff9a2e)],
        wings: [wing(-1), wing(1)], r: 0.34, hop: true
      };
    }
    const w = gold ? 0xffd34a : 0xfff7e8, c = gold ? 0xffa21c : 0xe8483a;
    const body = merge([E(0.4, w, [0, 0.62, 0], [1, 0.9, 1.2]), ...[-0.3, 0, 0.3].map((a, i) => bake(Co(0.1, 0.38, 5), gold ? 0xffc02e : 0xf3e6cf, [0, 0.82 + i * 0.03, -0.5], [-0.9 + a * 0.2, 0, a * 0.5]))]);
    const head = merge([E(0.22, w, [0, 0.2, 0.06]), bake(Co(0.075, 0.2, 5), 0xff9a2e, [0, 0.17, 0.3], [Math.PI / 2, 0, 0]), E(0.06, c, [0, 0.43, 0.05]), E(0.05, c, [0, 0.44, 0.15]), E(0.06, c, [0, 0.07, 0.24], [0.7, 1.2, 0.7]), ...eyes(0.24, 0.26, 0.11)]);
    const wing = (s) => grp(s * 0.38, 0.7, 0, part(E(0.2, gold ? 0xffc02e : 0xf3e6cf, [s * 0.04, -0.1, -0.02], [0.35, 1, 1.5])));
    return { body, bodyY: 0, head, headAt: [0, 0.86, 0.28], legs: [limb(-0.13, 0.27, 0.0, 0.27, 0.025, 0xf2a23a, 0xf2a23a), limb(0.13, 0.27, 0.0, 0.27, 0.025, 0xf2a23a, 0xf2a23a)], wings: [wing(-1), wing(1)], r: 0.4, hop: false };
  },
  duck(gold) { const y = gold ? 0xffc02e : 0xffe55c;
    return { body: merge([E(0.42, y, [0, 0.5, 0], [1, 0.85, 1.25]), bake(Co(0.14, 0.3, 5), y, [0, 0.72, -0.5], [-1.1, 0, 0])]), bodyY: 0, head: merge([E(0.24, y, [0, 0.2, 0.05]), E(0.12, 0xff9a2e, [0, 0.14, 0.3], [1.2, 0.5, 1.3]), ...eyes(0.22, 0.25, 0.12)]), headAt: [0, 0.78, 0.3],
      legs: [limb(-0.14, 0.2, 0.05, 0.2, 0.03, 0xff9a2e, 0xff9a2e), limb(0.14, 0.2, 0.05, 0.2, 0.03, 0xff9a2e, 0xff9a2e)], wings: [grp(-0.4, 0.58, 0, part(E(0.2, gold ? 0xffb020 : 0xffd23a, [-0.04, -0.05, 0], [0.35, 1, 1.5]))), grp(0.4, 0.58, 0, part(E(0.2, gold ? 0xffb020 : 0xffd23a, [0.04, -0.05, 0], [0.35, 1, 1.5])))], r: 0.45 }; },
  rabbit(gold) { const w = gold ? 0xffd34a : 0xf4ede2;
    return { body: merge([E(0.36, w, [0, 0.4, 0], [0.95, 0.9, 1.2]), E(0.16, 0xffffff, [0, 0.46, -0.45])]), bodyY: 0, head: merge([E(0.24, w, [0, 0.16, 0.05]), E(0.045, 0xff8fa0, [0, 0.12, 0.27]), E(0.09, 0xffc9d4, [-0.14, 0.0, 0.2], [1, 0.6, 0.6]), E(0.09, 0xffc9d4, [0.14, 0.0, 0.2], [1, 0.6, 0.6]), ...eyes(0.2, 0.2, 0.1)]), headAt: [0, 0.62, 0.3],
      ears: [grp(-0.1, 0.38, 0, part(bake(Ca(0.07, 0.34), w, [0, 0.2, 0], [0, 0, 0.12], [1, 1, 0.6]))), grp(0.1, 0.38, 0, part(bake(Ca(0.07, 0.34), w, [0, 0.2, 0], [0, 0, -0.12], [1, 1, 0.6])))],
      legs: [limb(-0.17, 0.2, 0.2, 0.2, 0.06, w, w), limb(0.17, 0.2, 0.2, 0.2, 0.06, w, w), limb(-0.2, 0.22, -0.2, 0.22, 0.08, w, w), limb(0.2, 0.22, -0.2, 0.22, 0.08, w, w)], r: 0.4 }; },
  sheep(gold) { const wc = gold ? 0xffd34a : 0xfffaf0, parts = [E(0.52, wc, [0, 0.82, 0], [1, 0.9, 1.25])]; for (let i = 0; i < 9; i++) { const a = i * 2.4; parts.push(E(0.3, wc, [Math.cos(a) * 0.42, 0.78 + Math.sin(i) * 0.15, Math.sin(a) * 0.55])); }
    return { body: merge(parts), bodyY: 0, head: merge([E(0.22, 0x5b5560, [0, 0.12, 0.1], [1, 1, 1.15]), E(0.2, wc, [0, 0.35, 0.0]), E(0.09, 0x4b4550, [-0.24, 0.17, 0.0], [1.3, 0.5, 0.6]), E(0.09, 0x4b4550, [0.24, 0.17, 0.0], [1.3, 0.5, 0.6]), ...eyes(0.3, 0.2, 0.1, 0.035, 0xffffff), ...eyes(0.33, 0.2, 0.1, 0.02)]), headAt: [0, 0.98, 0.58],
      legs: [-1, 1].flatMap((x) => [0.3, -0.3].map((z) => limb(x * 0.22, 0.5, z, 0.5, 0.06, 0x4b4550, 0x3b3540))), r: 0.7, tail: bake(S(0.14, 7, 5), wc, [0, 0.8, -0.72]) }; },
  pig(gold) { const p = gold ? 0xffd34a : 0xffb3c6, d = gold ? 0xffb020 : 0xff8fa8;
    return { body: merge([E(0.52, p, [0, 0.62, 0], [0.95, 0.9, 1.3]), bake(To(0.07, 0.025, 5, 10, Math.PI * 1.6), d, [0, 0.75, -0.72], [0, 1.4, 0])]), bodyY: 0, head: merge([E(0.3, p, [0, 0.1, 0.1]), bake(Cy(0.14, 0.15, 0.14, 10), d, [0, 0.02, 0.4], [Math.PI / 2, 0, 0]), E(0.025, 0x7a2a3a, [-0.05, 0.02, 0.48]), E(0.025, 0x7a2a3a, [0.05, 0.02, 0.48]), bake(Co(0.1, 0.18, 4), d, [-0.2, 0.34, 0.0], [0.4, 0, 0.5]), bake(Co(0.1, 0.18, 4), d, [0.2, 0.34, 0.0], [0.4, 0, -0.5]), ...eyes(0.34, 0.16, 0.14)]), headAt: [0, 0.68, 0.62],
      legs: [-1, 1].flatMap((x) => [0.4, -0.4].map((z) => limb(x * 0.26, 0.27, z, 0.27, 0.08, d))), r: 0.75 }; },
  goat(gold) { const b = gold ? 0xffd34a : 0xece0c8, h = gold ? 0xffb020 : 0xb89a6a;
    return { body: merge([E(0.42, b, [0, 0.82, 0], [0.85, 0.85, 1.35]), bake(Co(0.07, 0.25, 5), b, [0, 0.98, -0.62], [-0.8, 0, 0])]), bodyY: 0, head: merge([E(0.2, b, [0, 0.14, 0.12], [0.9, 1.05, 1.3]), bake(Co(0.045, 0.34, 5), h, [-0.1, 0.38, -0.02], [-0.7, 0, 0.2]), bake(Co(0.045, 0.34, 5), h, [0.1, 0.38, -0.02], [-0.7, 0, -0.2]), bake(Co(0.06, 0.2, 5), 0xf6efe0, [0, -0.17, 0.2], [Math.PI, 0, 0]), E(0.07, 0xd9b8a0, [-0.22, 0.2, 0], [1.4, 0.4, 0.7]), E(0.07, 0xd9b8a0, [0.22, 0.2, 0], [1.4, 0.4, 0.7]), ...eyes(0.27, 0.22, 0.1)]), headAt: [0, 1.05, 0.55],
      legs: [-1, 1].flatMap((x) => [0.35, -0.35].map((z) => limb(x * 0.2, 0.55, z, 0.55, 0.05, b, h))), r: 0.65 }; },
  cow(gold) { const w = gold ? 0xffe27a : 0xfdfbf6, k = gold ? 0xffb020 : 0x2f2a2a, spots = [[0.3, 1.2, 0.2, 0.28], [-0.4, 1.05, -0.3, 0.3], [0.1, 1.3, -0.55, 0.22], [-0.45, 1.2, 0.35, 0.2]].map(([x, y, z, r]) => E(r, k, [x, y, z], [1, 0.4, 1]));
    return { body: merge([E(0.7, w, [0, 1.0, 0], [0.85, 0.82, 1.4]), E(0.2, 0xffb3c6, [0, 0.58, -0.35], [1, 0.8, 1]), ...spots, bake(Cy(0.03, 0.03, 0.6, 5), w, [0, 1.0, -1.05], [0.3, 0, 0]), E(0.08, k, [0, 0.68, -1.18], [1, 1.4, 1])]), bodyY: 0, head: merge([E(0.32, w, [0, 0.1, 0.12], [0.95, 0.95, 1.2]), E(0.2, 0xffb3c6, [0, -0.06, 0.4], [1.1, 0.8, 0.8]), E(0.03, 0x6a2a3a, [-0.07, -0.05, 0.54]), E(0.03, 0x6a2a3a, [0.07, -0.05, 0.54]), bake(Co(0.06, 0.2, 5), 0xf0e6d0, [-0.22, 0.4, 0.0], [0, 0, 0.4]), bake(Co(0.06, 0.2, 5), 0xf0e6d0, [0.22, 0.4, 0.0], [0, 0, -0.4]), E(0.11, k, [-0.36, 0.2, 0.0], [1.5, 0.5, 0.8]), E(0.11, k, [0.36, 0.2, 0.0], [1.5, 0.5, 0.8]), ...eyes(0.3, 0.2, 0.17, 0.045)]), headAt: [0, 1.22, 0.9],
      legs: [-1, 1].flatMap((x) => [0.55, -0.55].map((z) => limb(x * 0.36, 0.6, z, 0.6, 0.1, w, 0x3a3030))), r: 1.0 }; },
  dog() { const t = 0xd9a066, d = 0x7a4a2a;
    return { body: merge([E(0.4, t, [0, 0.6, 0], [0.85, 0.85, 1.4]), bake(To(0.38, 0.06, 5, 12), 0xe03c3c, [0, 0.8, 0.35], [Math.PI / 2 - 0.3, 0, 0], [0.8, 0.7, 1]), bake(Ca(0.06, 0.4), t, [0, 0.9, -0.62], [0.6, 0, 0])]), bodyY: 0, head: merge([E(0.25, t, [0, 0.12, 0.1]), E(0.14, 0xf0d2a8, [0, 0.0, 0.32], [1, 0.8, 1.2]), E(0.05, 0x222222, [0, 0.04, 0.45]), E(0.1, d, [-0.24, 0.12, 0.0], [0.6, 1.4, 0.8]), E(0.1, d, [0.24, 0.12, 0.0], [0.6, 1.4, 0.8]), ...eyes(0.24, 0.2, 0.1)]), headAt: [0, 0.82, 0.5],
      legs: [-1, 1].flatMap((x) => [0.3, -0.3].map((z) => limb(x * 0.2, 0.4, z, 0.4, 0.065, t, 0xf0d2a8))), r: 0.55, tailAt: [0, 0.82, -0.62] }; },
  cat() { const c = 0xf0a050;
    return { body: E(0.3, c, [0, 0.35, 0], [0.85, 0.9, 1.3]), bodyY: 0, head: merge([E(0.22, c, [0, 0.1, 0.05]), bake(Co(0.09, 0.18, 4), c, [-0.14, 0.3, 0], [0, 0, 0.2]), bake(Co(0.09, 0.18, 4), c, [0.14, 0.3, 0], [0, 0, -0.2]), E(0.035, 0xff8fa0, [0, 0.07, 0.21]), ...eyes(0.19, 0.14, 0.09, 0.045, 0x2a6a2a)]), headAt: [0, 0.5, 0.25], legs: [-1, 1].flatMap((x) => [0.2, -0.2].map((z) => limb(x * 0.13, 0.22, z, 0.22, 0.05, c, 0xffffff))), r: 0.35, tail: bake(Ca(0.04, 0.5), c, [0, 0.55, -0.45], [0.5, 0, 0]) }; },
};

// Mô hình Ổ Rơm + Quả Trứng 3D hiển thị ngay dưới/cạnh gà khi gà đẻ trứng hoặc đang ấp trứng
export function buildEggNest(golden = false) {
  const g = new THREE.Group();
  const eggCol = golden ? 0xffd700 : 0xfff8ee;
  g.add(M(merge([
    bake(To(0.24, 0.07, 6, 12), 0xe2be66, [0, 0.06, 0], [Math.PI / 2, 0, 0]),
    bake(Cy(0.22, 0.24, 0.05, 10), 0xd4ad52, [0, 0.03, 0]),
    bake(S(0.13, 10, 8), eggCol, [0, 0.16, 0], [0, 0, 0], [0.85, 1.22, 0.85]),
  ]), MAT.lit, { receive: false }));
  return g;
}

export function buildAnimal(type, golden = false, baby = false) {
  const sp = SPEC[type](golden, baby), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const rig = { type, root, body, r: sp.r, legs: sp.legs || [], wings: sp.wings || [], ears: sp.ears || [], t: Math.random() * 10, scale: 1, golden, baby };
  body.add(part(sp.body)); rig.headPivot = grp(...sp.headAt, part(sp.head)); body.add(rig.headPivot);
  for (const l of rig.legs) body.add(l); for (const w of rig.wings) body.add(w); for (const e of rig.ears) rig.headPivot.add(e);
  if (sp.tail || sp.tailAt || type === 'chicken') { const g = new THREE.Group(); if (sp.tail) g.add(part(sp.tail)); if (sp.tailAt) { g.position.set(...sp.tailAt); g.add(part(bake(Ca(0.06, 0.4), 0xd9a066, [0, 0.2, -0.1], [0.6, 0, 0]))); } rig.tail = g; body.add(g); }
  // Ổ trứng 3D đi kèm cho gà và vịt khi đẻ trứng / ấp trứng
  if (type === 'chicken' || type === 'duck') {
    rig.nest = buildEggNest(golden);
    rig.nest.position.set(0, 0.01, -0.32);
    rig.nest.visible = false;
    root.add(rig.nest);
  }
  rig.shadow = blobShadow(sp.r * 3.2); root.add(rig.shadow);
  if (golden) { rig.glow = glowSprite(0xffd34a, sp.r * 5, 0.8); rig.glow.userData.glow = 0; rig.glow.position.y = sp.r * 1.2; root.add(rig.glow); }
  return rig;
}
// anim: idle walk run eat sleep happy scared funny(+sub)
export function animateAnimal(rig, st, sub, dt, speed, look) {
  rig.t += dt; const t = rig.t, p = rig.pose || (rig.pose = { y: 0, hx: 0, hy: 0, sx: 1, sy: 1, rz: 0, rx: 0, leg: 0, tail: 0 });
  let T = { y: 0, hx: 0, hy: 0, sx: 1, sy: 1, rz: 0, rx: 0, leg: 0, tail: Math.sin(t * 3) * 0.2, lw: 0 };
  const sw = Math.sin(t * (st === 'run' ? 16 : 9));
  const isBird = rig.type === 'chicken' || rig.type === 'duck';
  if (st === 'walk' || st === 'run') { T.leg = sw * (st === 'run' ? 0.95 : 0.6); T.y = Math.abs(sw) * (st === 'run' ? 0.12 : rig.baby ? 0.09 : 0.05); T.hx = isBird ? Math.sin(t * 9) * 0.3 : Math.sin(t * 5) * 0.08; T.tail = Math.sin(t * 12) * 0.5; if (rig.type === 'rabbit' || sub === 'hop') { T.y = Math.abs(Math.sin(t * 9)) * 0.38; T.leg = Math.sin(t * 9) * 0.5; } if ((st === 'run' || rig.baby) && isBird) T.lw = 1; }
  else if (st === 'eat') { T.hx = 0.9 + Math.sin(t * 9) * 0.25; T.y = -0.02; }
  else if (st === 'sleep' || sub === 'incubate') { T.y = -0.14; T.sy = 0.86; T.hx = 0.45; T.hy = Math.sin(t * 1.5) * 0.15; T.tail = 0; }
  else if (st === 'happy') { T.y = Math.abs(Math.sin(t * 10)) * 0.4; T.tail = Math.sin(t * 22) * 0.7; T.hx = -0.2; T.lw = 1; }
  else if (st === 'scared') { T.rz = Math.sin(t * 40) * 0.08; T.leg = Math.sin(t * 18) * 0.9; T.y = Math.abs(Math.sin(t * 18)) * 0.08; T.hx = -0.3; T.lw = 1; }
  else if (st === 'funny') {
    if (sub === 'roll') { T.rz = t * 9; T.y = 0.3; T.sy = 0.9; T.leg = Math.sin(t * 14) * 0.6; }
    else if (sub === 'charge') { T.hx = 0.7; T.rx = 0.18; T.leg = Math.sin(t * 22) * 1.0; T.y = Math.abs(Math.sin(t * 22)) * 0.1; }
    else if (sub === 'bump') { const k = Math.sin(t * 28) * 0.5; T.sx = 1.25 + k * 0.1; T.sy = 0.72 - k * 0.08; T.rz = k * 0.3; T.y = 0.1; }
    else if (sub === 'stare') { T.hx = -0.1; T.hy = look || 0; }
  }
  if (sub === 'swim') { T.y = -0.22 + Math.sin(t * 3) * 0.03; T.leg = Math.sin(t * 7) * 0.3; }
  const k = 14; for (const key in T) p[key] = damp(p[key] ?? T[key], T[key], key === 'rz' && st === 'funny' && sub === 'roll' ? 60 : k, dt);
  const sc = rig.scale; rig.body.position.y = p.y; rig.body.scale.set(p.sx, p.sy, p.sx); rig.body.rotation.z = p.rz; rig.body.rotation.x = p.rx;
  rig.headPivot.rotation.x = p.hx; rig.headPivot.rotation.y = p.hy;
  rig.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? -1 : 1) * p.leg * (rig.legs.length === 2 ? 1 : (i < 2 ? 1 : -1)); });
  rig.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (p.lw ? 0.9 + Math.sin(t * 30) * 0.5 : 0.1); });
  rig.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (st === 'scared' ? 0.9 : Math.sin(t * 2 + i) * 0.06); });
  if (rig.tail) rig.tail.rotation.y = p.tail;
  rig.shadow.scale.setScalar(Math.max(0.5, 1 - p.y * 0.8));
  rig.root.scale.setScalar(sc);
}
