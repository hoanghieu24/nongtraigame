// Công trình procedural chi tiết cao: mái ngói xếp lớp, tường kem ấm áp, chuồng trại chuyên nghiệp, Làng Hạnh Phúc rực rỡ và Quán Ăn Làm Thêm "Ready, Set, Cook!".
import * as THREE from 'three';
import { bake, merge, B, S, Cy, Co, Ca, To, M, MAT, signTexture, glowSprite } from './Kit.js';
import { DOCK, BRIDGE, VILLAGE, REST } from '../data/layout.js';
import { RSC_CRATES } from '../data/recipes.js';
import { buildFurniture } from './FurnitureModels.js';

const W = 0xc8955f, W2 = 0x8f5e38, CREAM = 0xfef0d4, SQ = Math.SQRT2;
const dk = (h, f = 0.78) => new THREE.Color(h).multiplyScalar(f).getHex();

// Mái ngói xếp tầng chân thực
const roof = (w, d, h, c, ov = 0.62, y = 0) => {
  const parts = [
    bake(B(w + ov * 2 + 0.16, 0.22, d + ov * 2 + 0.16, 0.08), dk(c, 0.76), [0, y + 0.1, 0]),
    bake(Co(1, 1, 4), c, [0, y + 0.18 + h / 2, 0], [0, Math.PI / 4, 0], [(w + ov * 2) / SQ, h, (d + ov * 2) / SQ]),
  ];
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, ty = y + 0.26 + t * (h * 0.82), s = 1 - t * 0.78;
    const tw = (w + ov * 2) * s + 0.08, td = (d + ov * 2) * s + 0.08;
    parts.push(bake(B(tw, 0.11, td, 0.04), i % 2 ? c : dk(c, 0.9), [0, ty, 0]));
  }
  parts.push(
    bake(B(Math.max(1.2, (w - d) * 0.45 + 1.1), 0.24, 0.34, 0.08), dk(c, 0.72), [0, y + h + 0.14, 0]),
    bake(S(0.22, 7, 5), dk(c, 0.68), [0, y + h + 0.26, 0])
  );
  return parts;
};

const wall = (w, h, d, c, y = 0, x = 0, z = 0) => bake(B(w, h, d, 0.14), c, [x, y + h / 2, z]);
const sign = (text, icon, w, h, bg, fg) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, { bg, fg, icon, w: 512, h: Math.round((512 * h) / w) }), transparent: true, side: THREE.DoubleSide })); m.castShadow = false; return m; };
const winAt = (P, Win, x, y, z, ry = 0, flowers = true) => {
  const c = Math.cos(ry), s = Math.sin(ry), rot = [0, ry, 0], pos = (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c];
  P.push(
    bake(B(1.06, 1.08, 0.12, 0.05), 0x8f5e38, pos(0, 0, 0), rot),
    bake(B(0.92, 0.94, 0.14, 0.04), 0xffffff, pos(0, 0, 0.01), rot),
    bake(B(0.07, 0.92, 0.16, 0.02), 0x8f5e38, pos(0, 0, 0.03), rot),
    bake(B(0.92, 0.07, 0.16, 0.02), 0x8f5e38, pos(0, 0.04, 0.03), rot)
  );
  Win.push(bake(B(0.82, 0.84, 0.08, 0.03), 0xfff5d6, pos(0, 0, 0.05), rot));
  if (flowers) {
    P.push(
      bake(B(1.12, 0.2, 0.28, 0.05), W2, pos(0, -0.58, 0.16), rot),
      ...[-0.36, -0.18, 0, 0.18, 0.36].map((dx, i) => bake(S(0.13, 6, 5), i % 2 ? 0x5ab84c : 0x4ca240, pos(dx, -0.44, 0.17), rot)),
      ...[-0.32, 0, 0.32].map((dx, i) => bake(S(0.11, 6, 5), [0xffffff, 0xffd23f, 0xff7aa2][i], pos(dx, -0.38, 0.2), rot))
    );
  }
};
const build = (P, Win = [], rects = []) => { const g = new THREE.Group(); g.add(M(merge(P), MAT.lit)); if (Win.length) g.add(M(merge(Win), MAT.window, { cast: false, receive: false })); g.userData.rects = rects; return g; };
const rectOf = (x, z, w, d, m = 0.2) => ({ x0: x - w / 2 - m, x1: x + w / 2 + m, z0: z - d / 2 - m, z1: z + d / 2 + m });
const door = (P, w, d, c = 0x7c4b2b, y = 0) => P.push(
  bake(B(1.42, 2.08, 0.16, 0.05), 0xd8cbb8, [0, y + 1.04, d / 2 + 0.02]),
  bake(B(1.12, 1.88, 0.18, 0.05), c, [0, y + 0.96, d / 2 + 0.04]),
  bake(B(0.38, 0.68, 0.2, 0.03), dk(c, 0.84), [-0.24, y + 1.35, d / 2 + 0.05]),
  bake(B(0.38, 0.68, 0.2, 0.03), dk(c, 0.84), [0.24, y + 1.35, d / 2 + 0.05]),
  bake(B(0.38, 0.62, 0.2, 0.03), dk(c, 0.84), [-0.24, y + 0.56, d / 2 + 0.05]),
  bake(B(0.38, 0.62, 0.2, 0.03), dk(c, 0.84), [0.24, y + 0.56, d / 2 + 0.05]),
  bake(S(0.065, 6, 5), 0xffd23f, [0.38, y + 0.92, d / 2 + 0.15]),
  bake(B(2.1, 0.18, 0.95, 0.05), 0xa89f91, [0, y + 0.09, d / 2 + 0.42]),
  bake(B(1.75, 0.14, 0.65, 0.04), 0xbab1a2, [0, y + 0.2, d / 2 + 0.28])
);

export function house(level) {
  const P = [], Win = [], rects = [], L = Math.max(1, Math.min(4, level));
  const w = [6.8, 8.4, 9.4, 10.6][L - 1], d = [5.4, 6.2, 7.0, 7.4][L - 1], h = [2.75, 2.85, 2.95, 3.0][L - 1];
  const wc = [CREAM, 0xffeed2, 0xffe6dc, 0xfff7ec][L - 1], rc = [0xd84b37, 0xc84332, 0x457bc4, 0x389c96][L - 1];
  P.push(
    wall(w, h, d, wc),
    bake(B(w + 0.36, 0.38, d + 0.36, 0.09), 0xa69b8c, [0, 0.19, 0]),
    bake(B(0.24, h, 0.24, 0.04), W2, [-w / 2 + 0.04, h / 2, d / 2 - 0.04]),
    bake(B(0.24, h, 0.24, 0.04), W2, [w / 2 - 0.04, h / 2, d / 2 - 0.04]),
    bake(B(0.24, h, 0.24, 0.04), W2, [-w / 2 + 0.04, h / 2, -d / 2 + 0.04]),
    bake(B(0.24, h, 0.24, 0.04), W2, [w / 2 - 0.04, h / 2, -d / 2 + 0.04]),
    ...roof(w, d, 2.35 + L * 0.18, rc, 0.68, h)
  );
  door(P, w, d);
  P.push(
    bake(B(0.12, 0.26, 0.22, 0.03), 0x3b3530, [-0.95, 1.75, d / 2 + 0.08]),
    bake(Co(0.22, 0.18, 4), 0x3b3530, [-0.95, 1.92, d / 2 + 0.18], [0, Math.PI / 4, 0])
  );
  Win.push(bake(Cy(0.11, 0.09, 0.26, 6), 0xffe89e, [-0.95, 1.72, d / 2 + 0.18]));
  winAt(P, Win, -w / 2 + 1.45, 1.62, d / 2 + 0.02);
  winAt(P, Win, w / 2 - 1.45, 1.62, d / 2 + 0.02);
  winAt(P, Win, -w / 2 - 0.02, 1.62, 0, -Math.PI / 2);
  winAt(P, Win, w / 2 + 0.02, 1.62, 0, Math.PI / 2);
  P.push(
    wall(0.82, 2.2, 0.82, 0x9e8f80, h + 0.2, w / 2 - 1.35, -d / 5),
    bake(B(1.04, 0.22, 1.04, 0.05), 0x7a6e62, [w / 2 - 1.35, h + 2.45, -d / 5]),
    bake(B(0.96, 0.14, 0.96, 0.04), 0x8a7d70, [w / 2 - 1.35, h + 1.5, -d / 5])
  );
  if (L >= 2) { P.push(wall(3.2, 2.4, 3.6, wc, 0, -w / 2 - 1.3, -0.6), ...roof(3.2, 3.6, 1.7, rc, 0.45, 2.4)); winAt(P, Win, -w / 2 - 1.3, 1.5, 1.2 + 0.02); rects.push(rectOf(-w / 2 - 1.3, -0.6, 3.2, 3.6)); }
  if (L >= 3) { P.push(wall(2.8, 1.7, 2.4, wc, h + 0.2, 0, 0.8), ...roof(2.8, 2.4, 1.35, rc, 0.35, h + 1.9)); winAt(P, Win, 0, h + 1.05, 2.02, 0, false); }
  if (L >= 4) { P.push(wall(2.5, 6.2, 2.5, 0xf2e6d0, 0, w / 2 + 1.1, -1.2), bake(Co(2.0, 2.5, 10), 0xe0a040, [w / 2 + 1.1, 7.4, -1.2]), ...[-1, 1].map((x) => bake(Cy(0.17, 0.2, h, 8), 0xffffff, [x * (w / 2 - 0.4), h / 2, d / 2 + 0.9])), bake(B(w - 0.2, 0.2, 1.4, 0.06), 0xdccfb8, [0, h, d / 2 + 0.8])); winAt(P, Win, w / 2 + 1.1, 4.5, 0.02, 0, false); }
  rects.push(rectOf(0, 0, w, d, 0.1)); const g = build(P, Win, rects);
  const smoke = new THREE.Object3D(); smoke.position.set(w / 2 - 1.35, h + 2.8, -d / 5); g.add(smoke); g.userData.smoke = smoke; g.userData.dims = { w, d };
  const doorGlow = glowSprite(0xffd074, 3.2, 0.85); doorGlow.position.set(-0.95, 1.72, d / 2 + 0.45); g.add(doorGlow);
  g.userData.glows = [doorGlow];
  for (const x of [-w / 2 + 1.45, w / 2 - 1.45]) { const gl = glowSprite(0xffd27a, 2.8, 0.65); gl.position.set(x, 1.62, d / 2 + 0.55); g.add(gl); g.userData.glows.push(gl); }
  return g;
}

export function windmill() {
  const P = [
    bake(Cy(1.1, 1.75, 6.2, 10), 0xf5ead6, [0, 3.1, 0]),
    bake(Cy(1.82, 1.88, 1.2, 10), 0xa69b8c, [0, 0.6, 0]),
    bake(Co(1.35, 1.8, 10), 0xc84b37, [0, 7.0, 0]),
    bake(B(0.7, 1.1, 0.2, 0.04), 0x7c4b2b, [0, 0.65, 1.72]),
  ];
  const g = new THREE.Group(); g.add(M(merge(P), MAT.lit));
  const blades = new THREE.Group(); blades.position.set(0, 5.6, 1.25);
  const BP = [bake(Cy(0.24, 0.24, 0.5, 8), 0x6b442a, [0, 0, 0], [Math.PI / 2, 0, 0])];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    BP.push(
      bake(Cy(0.06, 0.07, 3.4, 6), 0x7c4b2b, [Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0.12], [0, 0, a - Math.PI / 2]),
      bake(B(0.55, 2.6, 0.04, 0.01), 0xfff5e0, [Math.cos(a) * 2.0, Math.sin(a) * 2.0, 0.16], [0, 0, a - Math.PI / 2])
    );
  }
  blades.add(M(merge(BP), MAT.lit));
  g.add(blades); g.userData.blades = blades;
  return g;
}

const PEN_COL = {
  coop:  [0xfff3dc, 0xc84632],
  barn:  [0xd9473a, 0x7a332a],
  pig:   [0xf5e1c8, 0xb86b43],
  sheep: [0xf7eed8, 0x7c5c3e],
  duck:  [0xe6f4ff, 0x3b7cb8],
  goat:  [0xede3d2, 0x6e655b],
  hutch: [0xf4e3c6, 0x9a643a],
};

// Nhà chuồng chuyên nghiệp theo phong cách Stardew Valley / Hay Day
export function hut(kind) {
  const [c, rc] = PEN_COL[kind] || PEN_COL.coop, P = [], Win = [], big = kind === 'barn';
  const w = big ? 6.2 : kind === 'hutch' ? 3.0 : 4.0;
  const d = big ? 5.0 : kind === 'hutch' ? 2.0 : 3.1;
  const h = big ? 3.5 : kind === 'hutch' ? 1.35 : 2.35;
  const y0 = kind === 'hutch' ? 0.55 : kind === 'coop' ? 0.22 : 0;

  if (kind === 'hutch' || kind === 'coop') {
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      P.push(bake(B(0.24, y0 + 0.1, 0.24, 0.04), kind === 'coop' ? 0x9a9186 : W2, [x * (w / 2 - 0.22), y0 / 2, z * (d / 2 - 0.22)]));
    }
    P.push(bake(B(w + 0.2, 0.14, d + 0.2, 0.04), W2, [0, y0, 0]));
  } else {
    P.push(bake(B(w + 0.32, 0.26, d + 0.32, 0.06), 0xa4998b, [0, 0.13, 0]));
  }

  P.push(
    wall(w, h, d, c, y0),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => bake(B(0.2, h, 0.2, 0.03), big ? 0xffffff : W2, [sx * (w / 2 - 0.04), y0 + h / 2, sz * (d / 2 - 0.04)]))),
    ...roof(w, d, big ? 2.25 : 1.45, rc, 0.46, y0 + h)
  );

  if (kind === 'coop' || kind === 'barn') {
    const cy = y0 + h + (big ? 1.85 : 1.15);
    P.push(
      bake(B(0.85, 0.55, 0.85, 0.04), 0xffffff, [0, cy, 0]),
      bake(Co(0.72, 0.5, 4), rc, [0, cy + 0.45, 0], [0, Math.PI / 4, 0])
    );
  }

  if (big) {
    P.push(
      bake(B(2.4, 2.45, 0.14, 0.04), 0xffffff, [0, 1.25, d / 2 + 0.02]),
      bake(B(2.1, 2.25, 0.16, 0.04), 0xb8382c, [0, 1.2, d / 2 + 0.04]),
      bake(B(0.1, 2.3, 0.18, 0.02), 0xffffff, [-0.52, 1.2, d / 2 + 0.06], [0, 0, 0.42]),
      bake(B(0.1, 2.3, 0.18, 0.02), 0xffffff, [-0.52, 1.2, d / 2 + 0.06], [0, 0, -0.42]),
      bake(B(0.1, 2.3, 0.18, 0.02), 0xffffff, [0.52, 1.2, d / 2 + 0.06], [0, 0, 0.42]),
      bake(B(0.1, 2.3, 0.18, 0.02), 0xffffff, [0.52, 1.2, d / 2 + 0.06], [0, 0, -0.42]),
      bake(B(1.1, 0.85, 0.16, 0.04), 0xffffff, [0, 3.05, d / 2 + 0.04]),
      bake(B(0.9, 0.68, 0.18, 0.03), 0x3b2618, [0, 3.05, d / 2 + 0.06]),
      bake(B(0.75, 0.25, 0.24, 0.04), 0xf2cb56, [0, 2.82, d / 2 + 0.1]),
      bake(Cy(0.24, 0.28, 0.72, 10), 0xd8dee6, [-1.75, 0.38, d / 2 + 0.48]),
      bake(Cy(0.18, 0.24, 0.15, 10), 0xb8c2cc, [-1.75, 0.8, d / 2 + 0.48]),
      bake(Cy(0.22, 0.26, 0.65, 10), 0xd8dee6, [-2.3, 0.34, d / 2 + 0.45])
    );
    winAt(P, Win, -w / 2 - 0.02, 1.65, 0, -Math.PI / 2, false);
    winAt(P, Win, w / 2 + 0.02, 1.65, 0, Math.PI / 2, false);
  } else {
    const dw = kind === 'hutch' ? 0.75 : 1.05, dh = kind === 'hutch' ? 0.85 : 1.35;
    P.push(
      bake(B(dw + 0.18, dh + 0.14, 0.14, 0.04), 0xffffff, [0, y0 + dh / 2, d / 2 + 0.02]),
      bake(B(dw, dh, 0.16, 0.04), 0x382214, [0, y0 + dh / 2 - 0.02, d / 2 + 0.04]),
      bake(B(0.95, 0.1, 1.55, 0.03), W, [0, y0 * 0.5 + 0.18, d / 2 + 0.75], [0.28, 0, 0]),
      ...[-0.45, -0.1, 0.25, 0.55].map((rz) => bake(B(0.88, 0.05, 0.07, 0.01), W2, [0, y0 * 0.5 + 0.22 - rz * 0.26, d / 2 + 0.75 + rz]))
    );
    if (kind !== 'hutch') {
      winAt(P, Win, -w * 0.28, y0 + 1.32, d / 2 + 0.02, 0, true);
    }
  }

  if (kind === 'coop') {
    P.push(
      bake(B(0.85, 0.72, 2.1, 0.05), W, [w / 2 + 0.38, y0 + 0.55, 0]),
      bake(B(0.95, 0.12, 2.25, 0.03), rc, [w / 2 + 0.4, y0 + 0.96, 0], [0, 0, -0.22]),
      ...[-0.62, 0, 0.62].flatMap((nz) => [
        bake(B(0.65, 0.16, 0.52, 0.03), 0xe8c86b, [w / 2 + 0.42, y0 + 0.42, nz]),
        bake(S(0.11, 8, 6), 0xfff8ee, [w / 2 + 0.48, y0 + 0.54, nz], [0, 0, 0], [0.85, 1.2, 0.85]),
      ])
    );
  } else if (kind === 'goat') {
    P.push(
      bake(Cy(1.35, 1.65, 0.55, 8), 0x9e9a90, [w / 2 + 1.5, 0.28, 0.5]),
      bake(Cy(0.95, 1.2, 0.55, 8), 0x8d8980, [w / 2 + 1.6, 0.78, 0.35]),
      bake(Cy(0.6, 0.8, 0.45, 7), 0xa8a49a, [w / 2 + 1.55, 1.22, 0.25])
    );
  }

  const g = build(P, Win, [rectOf(0, 0, w, d)]);
  g.userData.dims = { w, d };
  return g;
}

export function penFence(p, color = W) {
  const P = [], Bulbs = [], rects = [], gate = p.gate, gap = 1.35;
  const add = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.2) return;
    const n = Math.max(1, Math.round(len / 2.0)), a = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      P.push(
        bake(B(0.24, 0.18, 0.24, 0.04), 0x9e9589, [x, 0.09, z]),
        bake(B(0.18, 1.08, 0.18, 0.05), color, [x, 0.56, z]),
        bake(B(0.23, 0.09, 0.23, 0.03), 0xfff5e4, [x, 1.12, z])
      );
    }
    for (const yy of [0.38, 0.78]) {
      P.push(bake(B(0.08, 0.12, len, 0.03), dk(color, 0.88), [(x0 + x1) / 2, yy, (z0 + z1) / 2], [0, a, 0]));
    }
    rects.push({ x0: Math.min(x0, x1) - 0.18, x1: Math.max(x0, x1) + 0.18, z0: Math.min(z0, z1) - 0.18, z1: Math.max(z0, z1) + 0.18 });
  };

  add(p.x0, p.z0, p.x1, p.z0);
  add(p.x0, p.z1, p.x1, p.z1);
  if (Math.abs(gate.x - p.x0) < 0.1) {
    add(p.x0, p.z0, p.x0, gate.z - gap);
    add(p.x0, gate.z + gap, p.x0, p.z1);
    add(p.x1, p.z0, p.x1, p.z1);
  } else if (Math.abs(gate.x - p.x1) < 0.1) {
    add(p.x0, p.z0, p.x0, p.z1);
    add(p.x1, p.z0, p.x1, gate.z - gap);
    add(p.x1, gate.z + gap, p.x1, p.z1);
  } else {
    add(p.x0, p.z0, p.x0, p.z1);
    add(p.x1, p.z0, p.x1, p.z1);
  }

  P.push(
    bake(B(0.28, 2.65, 0.28, 0.05), W2, [gate.x, 1.32, gate.z - gap]),
    bake(B(0.28, 2.65, 0.28, 0.05), W2, [gate.x, 1.32, gate.z + gap]),
    bake(B(0.36, 0.22, gap * 2 + 0.65, 0.05), W2, [gate.x, 2.68, gate.z]),
    bake(B(0.46, 0.14, gap * 2 + 0.9, 0.04), W, [gate.x, 2.82, gate.z])
  );
  Bulbs.push(
    bake(S(0.13, 7, 5), 0xffe699, [gate.x, 2.42, gate.z - gap]),
    bake(S(0.13, 7, 5), 0xffe699, [gate.x, 2.42, gate.z + gap])
  );

  const isRightGate = Math.abs(gate.x - p.x1) < 0.1;
  const fx = isRightGate ? p.x0 + 1.45 : p.x1 - 1.45;
  const fz = p.z1 - 1.15;
  P.push(
    bake(B(2.1, 0.42, 0.72, 0.06), W2, [fx, 0.21, fz]),
    bake(B(1.9, 0.16, 0.54, 0.04), 0xf2c94c, [fx, 0.42, fz]),
    bake(B(1.35, 0.38, 0.72, 0.06), 0x8d959e, [fx - (isRightGate ? -1.9 : 1.9), 0.19, fz]),
    bake(B(1.18, 0.08, 0.56, 0.02), 0x4fc3f7, [fx - (isRightGate ? -1.9 : 1.9), 0.36, fz]),
    bake(Cy(0.42, 0.42, 0.75, 10), 0xe5be55, [isRightGate ? p.x0 + 1.1 : p.x1 - 1.1, 0.38, p.z0 + 1.1], [0, 0, Math.PI / 2]),
    bake(Cy(0.38, 0.38, 0.7, 10), 0xd8b048, [isRightGate ? p.x0 + 1.1 : p.x1 - 1.1, 0.35, p.z0 + 1.85], [0.2, 0.4, Math.PI / 2])
  );

  if (p.mud) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      P.push(bake(S(0.24, 6, 5), 0x9a948c, [p.mud.x + Math.cos(a) * (p.mud.r + 0.1), 0.08, p.mud.z + Math.sin(a) * (p.mud.r + 0.1)], [0, a, 0], [1.2, 0.55, 0.9]));
    }
  }

  if (p.inc) {
    const ix = p.inc.x, iz = p.inc.z;
    P.push(
      bake(Cy(0.46, 0.52, 0.42, 12), W2, [ix, 0.21, iz]),
      bake(To(0.42, 0.08, 7, 14), 0xe6c260, [ix, 0.44, iz], [Math.PI / 2, 0, 0]),
      bake(Cy(0.05, 0.05, 0.75, 6), W2, [ix, 0.75, iz - 0.38]),
      bake(Co(0.36, 0.26, 10), 0xc84632, [ix, 1.12, iz])
    );
    Bulbs.push(bake(S(0.14, 8, 6), 0xffb74d, [ix, 0.96, iz]));
  }

  const g = new THREE.Group();
  g.add(M(merge(P), MAT.lit));
  if (Bulbs.length) g.add(M(merge(Bulbs), MAT.bulb, { cast: false, receive: false }));

  if (p.name) {
    const s = sign(p.name, p.icon || '🐾', 2.65, 0.68, '#fff5e0', '#5c3c20');
    s.position.set(gate.x + (isRightGate ? 0.22 : -0.22), 2.32, gate.z);
    s.rotation.y = isRightGate ? Math.PI / 2 : -Math.PI / 2;
    g.add(s);
  }

  g.userData.rects = rects;
  return g;
}

export function forSale(pen, icon = '🏷️') {
  const g = new THREE.Group(); g.add(M(merge([bake(Cy(0.08, 0.1, 2.0, 6), W2, [0, 1.0, 0]), bake(B(0.12, 0.12, 0.9, 0.03), W2, [0, 1.85, 0.0], [0, 0, 0])]), MAT.lit));
  const s = sign(`${pen.name}`, icon, 2.8, 0.92, '#fff5e0', '#5c3c20'); s.position.set(0, 2.35, 0.1); g.add(s);
  if (pen.cost > 0) {
    const s2 = sign(`Mua: ${pen.cost.toLocaleString('vi-VN')} 🪙${pen.lvl > 1 ? ` • Cấp ${pen.lvl}` : ''}`, '🏗️', 2.8, 0.74, '#ffe9a8', '#5c3c20'); s2.position.set(0, 1.52, 0.1); g.add(s2);
  }
  return g;
}

// Cửa hàng ở Làng được nâng cấp kiến trúc mái ngói, hiên gỗ, thùng trưng bày và đèn lồng rực rỡ
export function shop(kind) {
  const def = VILLAGE.shops[kind], c = def.color, P = [], Win = [], w = 7.2, d = 5.2, h = 2.95;
  const wallCol = new THREE.Color(c).lerp(new THREE.Color(0xfff8ec), 0.62).getHex();
  P.push(
    wall(w, h, d, wallCol),
    bake(B(w + 0.42, 0.34, d + 0.42, 0.1), 0xa89b89, [0, 0.17, 0]),
    // Cột gỗ trang trí 4 góc & hiên gỗ trước cửa
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => bake(B(0.22, h, 0.22, 0.04), W2, [sx * (w / 2 - 0.04), h / 2, sz * (d / 2 - 0.04)]))),
    bake(B(w + 0.4, 0.16, 1.6, 0.05), 0xd8cab4, [0, 0.08, d / 2 + 0.72]),
    ...[-3.1, 3.1].map((px) => bake(Cy(0.09, 0.11, 2.55, 6), W2, [px, 1.32, d / 2 + 1.25])),
    ...roof(w, d, 1.55, dk(c, 0.9), 0.52, h)
  );
  door(P, w, d, 0x7a4a2b);
  winAt(P, Win, -2.15, 1.55, d / 2 + 0.02, 0, true);
  winAt(P, Win, 2.15, 1.55, d / 2 + 0.02, 0, true);
  for (let i = 0; i < 8; i++) {
    P.push(bake(B(0.92, 0.1, 1.6, 0.03), i % 2 ? 0xffffff : c, [-3.22 + i * 0.92, 2.6 - 0.02, d / 2 + 0.76], [0.42, 0, 0]));
  }
  const deco = {
    seed: () => [
      bake(B(1.1, 0.6, 0.75, 0.08), W, [-2.55, 0.35, d / 2 + 1.1]),
      bake(S(0.22, 6, 5), 0xff8a3d, [-2.8, 0.75, d / 2 + 1.1]),
      bake(S(0.22, 6, 5), 0xe84a3a, [-2.4, 0.75, d / 2 + 1.1]),
      bake(S(0.22, 6, 5), 0x5ec248, [-2.6, 0.82, d / 2 + 0.95]),
      bake(S(0.42, 8, 6), 0xd9b88a, [2.65, 0.45, d / 2 + 1.1], [0, 0, 0], [1, 1.15, 0.9]),
      bake(Cy(0.32, 0.26, 0.55, 8), 0xb87a45, [1.85, 0.34, d / 2 + 1.15]),
    ],
    animal: () => [
      bake(Cy(0.55, 0.55, 0.82, 10), 0xe0c060, [-2.7, 0.45, d / 2 + 1.1], [0, 0, Math.PI / 2]),
      bake(Cy(0.46, 0.46, 0.74, 10), 0xd4b250, [-2.5, 0.98, d / 2 + 1.05], [0, 0.2, Math.PI / 2]),
      bake(S(0.22, 6, 5), 0xfff7e8, [2.6, 0.28, d / 2 + 1.1], [0, 0, 0], [1, 0.85, 1.2]),
      bake(Cy(0.22, 0.26, 0.65, 10), 0xd8dee6, [1.95, 0.38, d / 2 + 1.15]),
    ],
    furniture: () => [
      bake(B(0.9, 0.52, 0.82, 0.1), 0xe8837c, [-2.65, 0.32, d / 2 + 1.1]),
      bake(B(0.9, 0.64, 0.18, 0.05), 0xe8837c, [-2.65, 0.72, d / 2 + 0.75]),
      bake(Cy(0.55, 0.55, 0.06, 12), 0xf09a7a, [2.55, 0.12, d / 2 + 1.18]),
      bake(Cy(0.06, 0.08, 1.2, 6), W2, [2.55, 0.72, d / 2 + 1.18]),
      bake(Co(0.38, 0.35, 8), 0xffe4a0, [2.55, 1.35, d / 2 + 1.18]),
    ],
    general: () => [
      bake(Cy(0.42, 0.42, 0.82, 10), W, [-2.7, 0.45, d / 2 + 1.1]),
      bake(Cy(0.4, 0.4, 0.8, 10), W2, [-1.95, 0.45, d / 2 + 1.1]),
      bake(B(0.88, 0.54, 0.65, 0.08), 0xd0a060, [2.55, 0.32, d / 2 + 1.1]),
      bake(S(0.22, 6, 5), 0xe86a6a, [2.45, 0.7, d / 2 + 1.1]),
      bake(S(0.22, 6, 5), 0xffd23f, [2.75, 0.7, d / 2 + 1.1]),
    ],
  }[kind]();
  P.push(...deco);
  const g = build(P, Win, [rectOf(0, 0, w, d + 0.3, 0.1)]);
  const s = sign(def.name, def.icon, 4.8, 1.22, '#fff4dc', '#6b3e20');
  s.position.set(0, h + 0.68, d / 2 + 1.22); s.rotation.x = -0.32; g.add(s);
  const gl = glowSprite(0xffd27a, 3.4, 0.65); gl.position.set(0, 1.6, d / 2 + 1.65); g.add(gl);
  g.userData.glows = [gl]; g.userData.dims = { w, d };
  return g;
}

// Cổng Chào Làng Hạnh Phúc hoành tráng ở lối vào Làng (x = 37.2, z = 6)
export function villageArch() {
  const span = 5.4, h = 4.6, P = [], Bulbs = [];
  for (const sz of [-span / 2, span / 2]) {
    P.push(
      bake(B(0.75, 0.65, 0.75, 0.08), 0x9a9186, [0, 0.32, sz]),
      bake(Cy(0.24, 0.28, h, 8), 0xb84634, [0, h / 2 + 0.2, sz]),
      bake(B(0.55, 0.24, 0.55, 0.04), W2, [0, h + 0.25, sz])
    );
    // Đèn lồng đỏ vàng treo hai bên cổng làng
    P.push(bake(Cy(0.04, 0.04, 0.4, 5), W2, [0, h - 0.55, sz + (sz < 0 ? 0.55 : -0.55)]));
    Bulbs.push(bake(S(0.22, 8, 6), 0xffb74d, [0, h - 0.82, sz + (sz < 0 ? 0.55 : -0.55)], [0, 0, 0], [0.9, 1.25, 0.9]));
    // Bồn hoa dưới chân trụ cổng
    P.push(
      bake(B(0.95, 0.35, 0.95, 0.06), W, [0, 0.18, sz + (sz < 0 ? -0.75 : 0.75)]),
      bake(S(0.24, 6, 5), 0x5ab84c, [0, 0.48, sz + (sz < 0 ? -0.75 : 0.75)]),
      bake(S(0.16, 6, 5), 0xff7aa2, [0.12, 0.64, sz + (sz < 0 ? -0.75 : 0.75)]),
      bake(S(0.16, 6, 5), 0xffd23f, [-0.12, 0.62, sz + (sz < 0 ? -0.75 : 0.75)])
    );
  }
  // Xà ngang & mái ngói cổng chào
  P.push(
    bake(B(0.45, 0.32, span + 1.8, 0.06), W2, [0, h - 0.25, 0]),
    bake(B(0.52, 0.36, span + 2.4, 0.06), 0xb84634, [0, h + 0.35, 0]),
    ...roof(1.4, span + 2.6, 1.1, 0xc84332, 0.35, h + 0.5)
  );
  const g = new THREE.Group();
  g.add(M(merge(P), MAT.lit));
  g.add(M(merge(Bulbs), MAT.bulb, { cast: false, receive: false }));
  const s1 = sign('LÀNG HẠNH PHÚC • PHỐ ẨM THỰC', '🏘️', 4.6, 0.95, '#fff4dc', '#8f2d1e');
  s1.position.set(-0.32, h + 0.05, 0); s1.rotation.y = -Math.PI / 2;
  const s2 = sign('LÀNG HẠNH PHÚC • PHỐ ẨM THỰC', '🍳', 4.6, 0.95, '#fff4dc', '#8f2d1e');
  s2.position.set(0.32, h + 0.05, 0); s2.rotation.y = Math.PI / 2;
  g.add(s1, s2);
  const gl = glowSprite(0xffc864, 5.5, 0.65); gl.position.set(0, h - 0.6, 0); g.add(gl);
  g.userData.glows = [gl];
  g.userData.rects = [
    { x0: -0.45, x1: 0.45, z0: -span / 2 - 0.45, z1: -span / 2 + 0.45 },
    { x0: -0.45, x1: 0.45, z0: span / 2 - 0.45, z1: span / 2 + 0.45 },
  ];
  return g;
}

// Xe Trà Chanh & Kem Tươi ở Quảng Trường Làng
export function cafeCart() {
  const P = [
    bake(B(2.4, 0.92, 1.35, 0.08), 0xfff3dc, [0, 0.52, 0]),
    bake(B(2.52, 0.14, 1.48, 0.04), 0xf49242, [0, 1.0, 0]),
    ...[-0.9, 0.9].flatMap((x) => [-0.68, 0.68].map((z) => bake(To(0.28, 0.06, 6, 12), W2, [x, 0.28, z]))),
    bake(Cy(0.06, 0.07, 2.3, 6), W2, [0, 2.1, 0]),
    bake(Co(1.95, 0.78, 10), 0xff7aa2, [0, 3.15, 0]),
    bake(S(0.18, 6, 5), 0xffd23f, [0, 3.58, 0]),
    // Bình trà chanh, ly kem trên quầy
    bake(Cy(0.18, 0.18, 0.42, 8), 0xffe066, [-0.6, 1.28, 0.1]),
    bake(Cy(0.18, 0.18, 0.42, 8), 0x7be066, [-0.15, 1.28, 0.1]),
    bake(Co(0.14, 0.28, 7), 0xd8a060, [0.45, 1.2, 0.15], [Math.PI, 0, 0]),
    bake(S(0.15, 7, 5), 0xff9ebb, [0.45, 1.38, 0.15]),
  ];
  const g = new THREE.Group();
  g.add(M(merge(P), MAT.lit));
  const s = sign('Trà Chanh & Kem Làng', '🍦', 2.5, 0.68, '#fff0f6', '#b83260');
  s.position.set(0, 2.55, 0.55); g.add(s);
  g.userData.rects = [{ x0: -1.3, x1: 1.3, z0: -0.8, z1: 0.8 }];
  return g;
}

// Giàn Hoa Giấy & Cổng Vòm Hoa ở Quảng Trường Làng
export function flowerPergola() {
  const P = [], w = 4.6, d = 2.6, h = 2.8;
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) {
    P.push(bake(Cy(0.11, 0.13, h, 6), W2, [x, h / 2, z]));
  }
  P.push(
    bake(B(w + 0.6, 0.14, 0.18, 0.03), W, [0, h, -d / 2]),
    bake(B(w + 0.6, 0.14, 0.18, 0.03), W, [0, h, d / 2]),
    ...[-2.0, -1.0, 0, 1.0, 2.0].map((x) => bake(B(0.14, 0.12, d + 0.6, 0.02), W, [x, h + 0.1, 0]))
  );
  for (let i = 0; i < 14; i++) {
    const px = -2.1 + (i % 7) * 0.7, pz = (i < 7 ? -0.75 : 0.75) + (i % 2) * 0.25;
    P.push(
      bake(S(0.32, 6, 5), 0x4ca644, [px, h + 0.22, pz], [0, 0, 0], [1.2, 0.55, 1.2]),
      bake(S(0.2, 6, 5), i % 2 ? 0xff6fa5 : 0xff9ec4, [px + 0.1, h + 0.34, pz])
    );
  }
  const g = new THREE.Group();
  g.add(M(merge(P), MAT.lit));
  return g;
}

export function dock() {
  const P = [], len = DOCK.z1 - DOCK.z0, w = DOCK.x1 - DOCK.x0;
  for (let z = DOCK.z0; z < DOCK.z1; z += 0.42) P.push(bake(B(w, 0.1, 0.38, 0.03), (Math.floor(z * 2.4) % 2) ? 0xb88a58 : 0xc89a68, [0, DOCK.y - 0.06, z + 0.2]));
  for (let z = DOCK.z0 + 0.4; z <= DOCK.z1; z += 2.2) for (const x of [DOCK.x0 + 0.1, DOCK.x1 - 0.1]) P.push(bake(Cy(0.1, 0.12, 1.8, 6), W2, [x, DOCK.y - 0.5, z]), bake(S(0.12, 5, 4), W2, [x, DOCK.y + 0.45, z]));
  for (const x of [DOCK.x0 + 0.1, DOCK.x1 - 0.1]) P.push(bake(B(0.07, 0.07, len, 0.02), W2, [x, DOCK.y + 0.4, (DOCK.z0 + DOCK.z1) / 2]));
  P.push(bake(Cy(0.3, 0.3, 0.5, 8), 0xe0a040, [DOCK.x1 - 0.5, DOCK.y + 0.3, DOCK.z1 - 0.7]), bake(B(0.8, 0.6, 0.6, 0.08), W, [DOCK.x0 + 0.7, DOCK.y + 0.35, DOCK.z1 - 1.5]));
  const g = new THREE.Group(); g.add(M(merge(P), MAT.lit)); const s = sign('Cầu tàu câu cá', '🎣', 2.8, 0.8, '#e6f6ff', '#2a6a9a'); s.position.set(0, 2.1, DOCK.z0 + 0.2); const pole = M(merge([bake(Cy(0.06, 0.07, 2, 5), W2, [-1.5, 1, DOCK.z0 + 0.1]), bake(Cy(0.06, 0.07, 2, 5), W2, [1.5, 1, DOCK.z0 + 0.1])])); s.position.x = 0; g.add(s, pole); return g;
}
export function bridge() {
  const P = [], len = BRIDGE.z1 - BRIDGE.z0, w = BRIDGE.x1 - BRIDGE.x0, cz = (BRIDGE.z0 + BRIDGE.z1) / 2;
  for (let z = BRIDGE.z0; z < BRIDGE.z1; z += 0.5) P.push(bake(B(w, 0.12, 0.45, 0.03), (Math.floor(z * 2) % 2) ? 0xb88a58 : 0xc89a68, [0, BRIDGE.y - 0.08, z + 0.25]));
  for (const x of [BRIDGE.x0 + 0.1, BRIDGE.x1 - 0.1]) { P.push(bake(B(0.1, 0.1, len, 0.03), W2, [x, BRIDGE.y + 0.9, cz]), bake(B(0.08, 0.08, len, 0.03), W2, [x, BRIDGE.y + 0.45, cz])); for (let z = BRIDGE.z0; z <= BRIDGE.z1; z += 2) P.push(bake(Cy(0.08, 0.1, 1.1, 5), W2, [x, BRIDGE.y + 0.45, z])); }
  for (const z of [BRIDGE.z0 + 5, cz, BRIDGE.z1 - 5]) for (const x of [BRIDGE.x0 + 0.2, BRIDGE.x1 - 0.2]) P.push(bake(Cy(0.14, 0.16, 2.2, 6), W2, [x, BRIDGE.y - 1.0, z]));
  const g = new THREE.Group(); g.add(M(merge(P), MAT.lit)); return g;
}
export function well() { const g = new THREE.Group(); g.add(M(merge([bake(Cy(0.8, 0.9, 0.9, 14), 0xb8bcc2, [0, 0.45, 0]), bake(Cy(0.62, 0.62, 0.05, 12), 0x3a8fc0, [0, 0.86, 0]), bake(Cy(0.07, 0.08, 1.9, 5), W2, [-0.75, 1.5, 0]), bake(Cy(0.07, 0.08, 1.9, 5), W2, [0.75, 1.5, 0]), ...roof(2.2, 1.6, 0.9, 0xd9604c, 0.3, 2.35), bake(Cy(0.04, 0.04, 1.6, 5), W2, [0, 2.2, 0], [0, 0, Math.PI / 2]), bake(Cy(0.22, 0.18, 0.28, 8), W, [0, 1.5, 0])]), MAT.lit)); g.userData.rects = [{ x0: -0.9, x1: 0.9, z0: -0.9, z1: 0.9 }]; return g; }

export function sellCrate() {
  const g = new THREE.Group();
  g.add(M(merge([
    bake(B(1.85, 0.95, 1.28, 0.08), W2, [0, 0.48, 0]),
    bake(B(1.96, 0.16, 1.38, 0.06), W, [0, 0.98, 0], [0.12, 0, 0]),
    bake(B(1.75, 0.12, 0.08, 0.02), 0xe0a040, [0, 0.52, 0.64]),
    bake(Cy(0.32, 0.32, 0.08, 14), 0xffc02e, [0, 1.08, 0.05], [0.12, 0, 0]),
    ...[0, 1, 2, 3, 4, 5].map((i) => bake(S(0.09, 5, 4), 0xffe08a, [Math.cos(i) * 0.16, 1.14, Math.sin(i) * 0.16])),
    bake(Cy(0.06, 0.07, 1.6, 6), W2, [-0.65, 1.35, -0.45]),
    bake(Cy(0.06, 0.07, 1.6, 6), W2, [0.65, 1.35, -0.45]),
  ]), MAT.lit));
  const s = sign('Cửa hàng', '🪙', 2.45, 0.78, '#fff5e0', '#5c3c20'); s.position.set(0, 2.05, -0.4); g.add(s);
  g.userData.rects = [{ x0: -0.95, x1: 0.95, z0: -0.7, z1: 0.7 }]; return g;
}

export function chest() { const g = new THREE.Group(); g.add(M(merge([bake(B(1.5, 0.8, 1.0, 0.12), W2, [0, 0.4, 0]), bake(Cy(0.5, 0.5, 1.5, 12), 0xb07a45, [0, 0.85, 0], [0, 0, Math.PI / 2], [1, 1, 0.8]), bake(B(0.2, 0.3, 0.06, 0.02), 0xffd23f, [0, 0.75, 0.52]), bake(B(0.12, 1.0, 1.05, 0.02), 0xe0a040, [-0.5, 0.55, 0]), bake(B(0.12, 1.0, 1.05, 0.02), 0xe0a040, [0.5, 0.55, 0])]), MAT.lit)); const s = sign('Rương chung', '📦', 2.2, 0.7, '#fff5e0', '#5c3c20'); s.position.set(0, 1.9, 0); g.add(s); g.userData.rects = [{ x0: -0.8, x1: 0.8, z0: -0.6, z1: 0.6 }]; return g; }

export function noticeBoard(label = 'Nhiệm vụ', icon = '📜', bg = '#fff5e0', fg = '#5c3c20') {
  const g = new THREE.Group();
  g.add(M(merge([
    bake(Cy(0.1, 0.11, 2.3, 6), W2, [-1.02, 1.15, 0]),
    bake(Cy(0.1, 0.11, 2.3, 6), W2, [1.02, 1.15, 0]),
    bake(B(2.35, 1.42, 0.16, 0.05), W2, [0, 1.48, 0]),
    bake(B(2.12, 1.2, 0.18, 0.04), 0xd8b278, [0, 1.48, 0.02]),
    bake(B(2.6, 0.2, 0.55, 0.05), W2, [0, 2.22, 0.04], [0.15, 0, 0]),
    bake(B(0.55, 0.45, 0.02, 0.01), 0xffffff, [-0.58, 1.62, 0.12]),
    bake(B(0.55, 0.45, 0.02, 0.01), 0xfff2a0, [0.15, 1.42, 0.12], [0, 0, 0.08]),
    bake(B(0.48, 0.4, 0.02, 0.01), 0xffd6e0, [0.68, 1.68, 0.12]),
    bake(S(0.055, 4, 3), 0xe84a3a, [-0.58, 1.8, 0.14]),
  ]), MAT.lit));
  const s = sign(label, icon, 2.65, 0.78, bg, fg); s.position.set(0, 2.68, 0.06); g.add(s);
  g.userData.rects = [{ x0: -1.2, x1: 1.2, z0: -0.35, z1: 0.35 }]; return g;
}

export function marketStall() { const P = [bake(B(3.2, 0.9, 1.4, 0.08), W, [0, 0.45, 0]), ...[-1.5, 1.5].map((x) => bake(Cy(0.07, 0.08, 2.6, 5), W2, [x, 1.3, -0.6]))]; for (let i = 0; i < 8; i++) P.push(bake(B(0.5, 0.07, 1.8, 0.03), i % 2 ? 0xffffff : 0xe86a8a, [-1.75 + i * 0.5, 2.7, 0], [0.25, 0, 0])); ['🥕', 0, 1, 2, 3].forEach((_, i) => P.push(bake(S(0.2, 6, 5), [0xff8a3d, 0xe84a3a, 0xffd23f, 0x7bc96a][i % 4], [-1.2 + i * 0.6, 1.05, 0.1]))); const g = new THREE.Group(); g.add(M(merge(P), MAT.lit)); const s = sign('Quầy chợ (+10%)', '🛒', 2.8, 0.7, '#fff4dc', '#7a4a2b'); s.position.set(0, 3.25, 0.4); g.add(s); g.userData.rects = [{ x0: -1.7, x1: 1.7, z0: -0.8, z1: 0.8 }]; return g; }
export function merchantCart() { const P = [bake(B(2.6, 0.5, 1.5, 0.1), 0x7a4a9a, [0, 0.8, 0]), ...[-1, 1].flatMap((x) => [bake(To(0.55, 0.08, 6, 14), W2, [x * 1.0, 0.55, 0.85], [0, 0, 0]), bake(To(0.55, 0.08, 6, 14), W2, [x * 1.0, 0.55, -0.85], [0, 0, 0])]), ...[-1, 1].map((x) => bake(Cy(0.07, 0.08, 2.2, 5), W2, [x * 1.2, 1.9, -0.6]))]; for (let i = 0; i < 6; i++) P.push(bake(B(0.5, 0.06, 1.9, 0.02), i % 2 ? 0xffd23f : 0x9a5ac8, [-1.25 + i * 0.5, 3.0, 0], [0.15, 0, 0])); P.push(bake(B(0.7, 0.5, 0.6, 0.08), W, [-0.7, 1.3, 0.1]), bake(Cy(0.3, 0.3, 0.6, 10), W2, [0.5, 1.3, 0.1]), bake(S(0.2, 6, 5), 0xa78bfa, [0.5, 1.75, 0.1])); const g = new THREE.Group(); g.add(M(merge(P), MAT.lit)); const s = sign('Thương nhân du hành', '🧳', 3.2, 0.8, '#efe0ff', '#5a3a8a'); s.position.set(0, 3.7, 0.3); g.add(s); const gl = glowSprite(0xc8a0ff, 4, 0.5); gl.position.set(0, 2, 0.4); g.add(gl); g.userData.rects = [{ x0: -1.6, x1: 1.6, z0: -1.0, z1: 1.0 }]; return g; }
export function gateBarrier(key, area) { const P = [bake(Cy(0.14, 0.16, 2.4, 6), W2, [-2.4, 1.2, 0]), bake(Cy(0.14, 0.16, 2.4, 6), W2, [2.4, 1.2, 0]), bake(Cy(0.1, 0.1, 5.2, 6), W, [0, 0.8, 0], [0, 0, Math.PI / 2]), bake(Cy(0.1, 0.1, 5.2, 6), W, [0, 1.6, 0], [0, 0, Math.PI / 2]), bake(Cy(0.09, 0.09, 3, 6), W, [0, 1.2, 0.05], [0, 0, 0.7]), bake(Cy(0.09, 0.09, 3, 6), W, [0, 1.2, 0.05], [0, 0, -0.7])]; const g = new THREE.Group(); g.add(M(merge(P), MAT.lit)); const s = sign(`${area.name} • Cấp ${area.lvl}`, '🔒', 3.4, 0.9, '#fff4dc', '#7a4a2b'); s.position.set(0, 2.9, 0.1); g.add(s); return g; }

// Quán Ăn Làng 3D theo chuẩn bố cục "Ready, Set, Cook!" trên Facebook:
// - Luôn hiển thị đầy đủ từ Cấp 1 để người chơi vào Làm Thêm bất cứ lúc nào!
// - Nửa trái: KHU BẾP (Sàn gạch xanh xám, 6 thùng nguyên liệu, 2 bàn thớt sơ chế có dao, 3 bếp nấu chảo/nồi, bồn rửa bát, chồng đĩa sạch, thùng rác, bình cứu hỏa, Quầy Trả Món màu đỏ cam ở giữa)
// - Nửa phải: PHÒNG ĂN (Sàn gỗ sáng ấm, Bàn Tiệc Oval lớn ở trung tâm với 8 ghế nệm đỏ, khay gia vị hoa, thảm vàng chào khách, cây hoa anh đào góc phòng & 3 bảng menu treo tường)
export function restaurantShell(level = 1, unlocked = false) {
  const g = new THREE.Group(), R = REST, w = R.x1 - R.x0, d = R.z1 - R.z0;
  const P = [], Bulbs = [];
  const lx = (wx) => wx - R.x, lz = (wz) => wz - R.z;

  // 1. Sàn đôi: Nửa trái Khu Bếp (x: -w/2 .. -0.4) gạch xám xanh, Nửa phải Phòng Ăn (x: -0.4 .. w/2) sàn gỗ kem ấm
  const kw = w * 0.48, dw = w - kw;
  P.push(
    bake(B(w + 0.4, 0.14, d + 0.4, 0.04), 0x56616b, [0, 0.07, 0]),
    bake(B(kw, 0.18, d, 0.03), 0x8294a5, [-w / 2 + kw / 2, 0.1, 0]),
    bake(B(dw, 0.18, d, 0.03), 0xe6d8c3, [w / 2 - dw / 2, 0.1, 0])
  );
  // Ô gạch caro trong Bếp & Đường vân gỗ bên Phòng Ăn
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 5; iz++) {
    if ((ix + iz) % 2 === 0) {
      P.push(bake(B(1.9, 0.02, 1.9, 0.01), 0x728495, [-w / 2 + 1.2 + ix * 2.0, 0.19, -d / 2 + 1.3 + iz * 2.0]));
    }
  }
  // Thảm vàng chào khách ngay cửa Phòng Ăn (như ảnh mẫu Ready, Set, Cook!)
  P.push(bake(B(1.85, 0.04, 1.15, 0.02), 0xf4c430, [lx(R.door.x), 0.2, lz(R.door.z) - 0.35], [0, -0.15, 0]));

  // 2. Tường bao sau lưng & hai bên dạng Cutaway (thấp thoáng để nhìn rõ toàn bộ bếp và bàn ăn từ trên xuống)
  P.push(
    bake(B(w + 0.2, 2.85, 0.32, 0.06), 0xeadbc5, [0, 1.5, -d / 2 + 0.16]),
    bake(B(kw, 2.85, 0.34, 0.06), 0x9aaab8, [-w / 2 + kw / 2, 1.5, -d / 2 + 0.17]),
    bake(B(w + 0.3, 0.26, 0.42, 0.05), 0xc84b37, [0, 2.98, -d / 2 + 0.16]),
    // Tường bên trái Bếp & bên phải Phòng Ăn
    bake(B(0.32, 2.2, d, 0.05), 0x8d9dad, [-w / 2 + 0.16, 1.2, 0]),
    bake(B(0.32, 2.2, d - 2.2, 0.05), 0xdfd0ba, [w / 2 - 0.16, 1.2, -0.8]),
    // Vách ngăn lửng giữa Bếp và Phòng Ăn ở sát tường bắc
    bake(B(0.28, 2.6, 2.1, 0.04), 0x6c7a89, [lx(R.passCounter.x), 1.4, -d / 2 + 1.1])
  );

  // 3 Khung tranh Thực Đơn phát sáng treo trên tường Phòng Ăn (giống hệt ảnh mẫu Ready, Set, Cook!)
  for (const dx of [-1.5, 0, 1.5]) {
    const mx = lx(R.ovalTable.x) + dx - 1.2, mz = -d / 2 + 0.36;
    P.push(
      bake(B(1.15, 1.35, 0.08, 0.02), 0x3b2a1e, [mx, 1.85, mz]),
      bake(B(0.98, 1.16, 0.09, 0.02), 0xffb74d, [mx, 1.85, mz + 0.01]),
      bake(B(0.76, 0.14, 0.1, 0.01), 0x7c3f1d, [mx, 2.15, mz + 0.02]),
      bake(B(0.76, 0.14, 0.1, 0.01), 0xc84632, [mx, 1.85, mz + 0.02]),
      bake(B(0.76, 0.14, 0.1, 0.01), 0x4ca644, [mx, 1.55, mz + 0.02])
    );
  }

  // Cây cảnh tán hồng (Pink Blossom Tree) ở góc đông bắc Phòng Ăn (chuẩn ảnh mẫu Ready, Set, Cook!)
  const tx = w / 2 - 1.45, tz = -d / 2 + 1.35;
  P.push(
    bake(Cy(0.45, 0.36, 0.65, 10), 0x8f5e38, [tx, 0.45, tz]),
    bake(Cy(0.12, 0.16, 1.45, 7), 0x6b442a, [tx, 1.25, tz]),
    bake(S(0.78, 8, 6), 0xf49ac2, [tx, 2.15, tz], [0, 0, 0], [1.25, 0.72, 1.1]),
    bake(S(0.62, 8, 6), 0xffb3d1, [tx - 0.55, 1.95, tz + 0.25], [0, 0, 0], [1.15, 0.68, 1.0]),
    bake(S(0.58, 8, 6), 0xff85b3, [tx + 0.48, 2.0, tz - 0.2], [0, 0, 0], [1.1, 0.68, 1.0])
  );

  // 3. QUẦY TRẢ MÓN MÀU ĐỎ CAM (Red-Orange Pass-Through Counter) ngăn cách Bếp và Phòng Ăn
  const px = lx(R.passCounter.x), pz = lz(R.passCounter.z);
  P.push(
    bake(B(1.05, 1.02, 5.8, 0.08), 0xd94426, [px, 0.62, pz]),
    bake(B(1.18, 0.16, 6.0, 0.05), 0xff5e3a, [px, 1.15, pz]),
    // 4 khay lót đĩa trắng trên Quầy Trả Món
    ...R.passCounter.slots.map((sl) => bake(Cy(0.36, 0.36, 0.04, 14), 0xfff8ee, [lx(sl.x), 1.25, lz(sl.z)]))
  );

  // 4. HỆ THỐNG BẾP "READY, SET, COOK!":
  // 4a. 6 Thùng Nguyên Liệu (Ingredient Crates) ở mép Bắc & Nam của Bếp
  for (const [k, cr] of Object.entries(R.crates)) {
    const cx = lx(cr.x), cz = lz(cr.z), col = RSC_CRATES[k]?.color || 0x6bbf4f;
    P.push(
      bake(B(1.85, 0.92, 1.25, 0.06), 0x5c6b7a, [cx, 0.56, cz]),
      bake(B(1.68, 0.24, 1.08, 0.04), W, [cx, 1.08, cz]),
      // Nguyên liệu 3D đầy ắp bên trong thùng
      ...[-0.42, 0, 0.42].flatMap((ox) => [-0.22, 0.22].map((oz) => bake(S(0.22, 7, 5), col, [cx + ox, 1.24, cz + oz], [0, 0, 0], [1.05, 0.82, 1.05])))
    );
    const lb = sign(cr.name.replace('Thùng ', ''), cr.icon, 1.85, 0.54, '#fff8ec', '#3b2818');
    lb.position.set(cx, 1.78, cz + (cz < 0 ? 0.45 : -0.45));
    g.add(lb);
  }

  // 4b. 2 Bàn Thớt Sơ Chế có Dao (Cutting Boards b0, b1)
  for (const [bk, bd] of Object.entries(R.boards)) {
    const bx = lx(bd.x), bz = lz(bd.z);
    P.push(
      bake(B(1.55, 0.94, 1.45, 0.06), 0x677788, [bx, 0.57, bz]),
      bake(B(1.62, 0.1, 1.52, 0.03), 0xdce4ec, [bx, 1.06, bz]),
      // Mặt thớt gỗ vàng + con dao bếp inox
      bake(B(1.05, 0.08, 0.82, 0.03), 0xf5d372, [bx, 1.14, bz]),
      bake(B(0.12, 0.04, 0.52, 0.01), 0xd8dee6, [bx + 0.36, 1.19, bz], [0, 0.25, 0]),
      bake(B(0.08, 0.05, 0.22, 0.01), 0x4a3222, [bx + 0.42, 1.19, bz + 0.28], [0, 0.25, 0])
    );
  }

  // 4c. 3 Bếp Nấu Chảo & Nồi (Stoves s0, s1, s2) dọc tường Tây của Bếp + Bình chữa cháy 🧯
  for (const [sk, stv] of Object.entries(R.stoves)) {
    const sx = lx(stv.x), sz = lz(stv.z), isPot = sk === 's1';
    P.push(
      bake(B(1.55, 0.94, 1.65, 0.06), 0x495460, [sx, 0.57, sz]),
      bake(B(1.62, 0.1, 1.72, 0.03), 0xb8c4d0, [sx, 1.06, sz]),
      // Vòng lửa bếp hồng rực
      bake(Cy(0.42, 0.44, 0.05, 14), 0x22262c, [sx + 0.08, 1.13, sz]),
      bake(To(0.32, 0.035, 6, 14), 0xff5722, [sx + 0.08, 1.15, sz], [Math.PI / 2, 0, 0])
    );
    if (isPot) {
      // Nồi súp sâu lòng có 2 quai
      P.push(
        bake(Cy(0.42, 0.38, 0.48, 14), 0xc8d2dc, [sx + 0.08, 1.38, sz]),
        bake(Cy(0.38, 0.38, 0.04, 12), 0xf4a242, [sx + 0.08, 1.59, sz])
      );
    } else {
      // Chảo rán chống dính có cán cầm
      P.push(
        bake(Cy(0.45, 0.38, 0.14, 14), 0x2c3038, [sx + 0.08, 1.22, sz]),
        bake(B(0.1, 0.06, 0.55, 0.02), 0x2c3038, [sx + 0.45, 1.24, sz], [0, 0, -0.12])
      );
    }
  }
  // Bình chữa cháy đỏ 🧯 cạnh bếp
  P.push(
    bake(Cy(0.18, 0.18, 0.68, 10), 0xe53935, [lx(R.trash.x), 0.52, lz(R.stoves.s2.z) + 0.95]),
    bake(Cy(0.06, 0.08, 0.16, 8), 0x2b2b2b, [lx(R.trash.x), 0.92, lz(R.stoves.s2.z) + 0.95])
  );

  // 4d. Bồn Rửa Bát Inox (Sink) + Chồng Đĩa Sạch + Thùng Rác Bếp
  const skx = lx(R.sink.x), skz = lz(R.sink.z);
  P.push(
    bake(B(1.5, 0.94, 1.25, 0.06), 0x677788, [skx, 0.57, skz]),
    bake(B(1.56, 0.1, 1.3, 0.03), 0xd8e2ec, [skx, 1.06, skz]),
    bake(B(1.1, 0.08, 0.85, 0.02), 0x4fc3f7, [skx, 1.12, skz]),
    bake(Cy(0.04, 0.04, 0.42, 6), 0xcfd8dc, [skx, 1.32, skz - 0.38]),
    bake(To(0.14, 0.03, 5, 10, Math.PI), 0xcfd8dc, [skx, 1.5, skz - 0.24], [0, Math.PI / 2, 0])
  );
  // Bàn đặt Chồng Đĩa Sạch
  const plx = lx(R.plates.x), plz = lz(R.plates.z);
  P.push(
    bake(B(1.1, 0.94, 1.1, 0.06), 0x677788, [plx, 0.57, plz]),
    bake(Cy(0.36, 0.34, 0.22, 14), 0xffffff, [plx, 1.16, plz])
  );
  // Thùng Rác Bếp (Trash Bin)
  const trx = lx(R.trash.x), trz = lz(R.trash.z);
  P.push(
    bake(Cy(0.38, 0.32, 0.82, 12), 0x455a64, [trx, 0.55, trz]),
    bake(To(0.39, 0.04, 6, 12), 0x263238, [trx, 0.96, trz], [Math.PI / 2, 0, 0])
  );

  // 5. BÀN TIỆC OVAL LỚN TRUNG TÂM PHÒNG ĂN (Grand Oval Dining Table + 8 Ghế Nệm Đỏ như ảnh mẫu)
  const ox = lx(R.ovalTable.x), oz = lz(R.ovalTable.z);
  P.push(
    // Chân trụ đôi gỗ sẫm
    bake(Cy(0.38, 0.48, 0.88, 12), W2, [ox, 0.55, oz - 1.35]),
    bake(Cy(0.38, 0.48, 0.88, 12), W2, [ox, 0.55, oz + 1.35]),
    // Mặt bàn Oval lớn bằng gỗ sồi vàng ấm (scale hình trụ thành hình elip chuẩn!)
    bake(Cy(1.85, 1.85, 0.14, 24), 0xf3dfb9, [ox, 1.02, oz], [0, 0, 0], [1.0, 1.0, 1.68]),
    bake(Cy(1.9, 1.9, 0.08, 24), 0xd8b888, [ox, 0.98, oz], [0, 0, 0], [1.0, 1.0, 1.68]),
    // Khay gia vị & lọ hoa trung tâm bàn Oval
    bake(B(0.72, 0.14, 1.05, 0.04), 0x5c3c20, [ox, 1.14, oz]),
    bake(Cy(0.14, 0.12, 0.28, 8), 0xe84a3a, [ox - 0.14, 1.28, oz - 0.2]),
    bake(Cy(0.14, 0.12, 0.28, 8), 0xffca28, [ox + 0.14, 1.28, oz + 0.18]),
    bake(S(0.22, 7, 5), 0x6bbf4f, [ox, 1.38, oz])
  );
  // 8 Ghế nệm đỏ + tấm lót đĩa gỗ quanh bàn Oval
  for (let i = 0; i < 8; i++) {
    const st = R.table(i), sx = lx(st.seatX), sz = lz(st.seatZ), px2 = lx(st.plateX), pz2 = lz(st.plateZ);
    P.push(
      // Khay gỗ lót đĩa trên mặt bàn Oval
      bake(B(0.58, 0.03, 0.46, 0.01), 0xd4b483, [px2, 1.1, pz2], [0, st.face, 0]),
      // Ghế ăn nệm đỏ xoay hướng vào bàn
      bake(Cy(0.34, 0.32, 0.12, 10), 0xc83e32, [sx, 0.58, sz]),
      bake(Cy(0.08, 0.1, 0.52, 6), 0x3b2818, [sx, 0.3, sz]),
      bake(B(0.56, 0.48, 0.1, 0.03), 0xb83227, [sx - Math.sin(st.face) * 0.24, 0.88, sz - Math.cos(st.face) * 0.24], [0, st.face, 0])
    );
  }

  // 6. Mái hiên sọc đỏ trắng & Bảng hiệu lớn phía trước Quán Ăn
  const dd = 2.2;
  for (let i = 0; i < 12; i++) {
    P.push(bake(B(w / 12 + 0.05, 0.12, dd, 0.04), i % 2 ? 0xffffff : 0xe85338, [-w / 2 + (i + 0.5) * (w / 12), 3.15, -d / 2 + dd / 2 + 0.2], [0.15, 0, 0]));
    Bulbs.push(bake(S(0.11, 6, 5), [0xffd23f, 0xff7aa2, 0x7ac0ff][i % 3], [-w / 2 + 0.6 + i * ((w - 1.2) / 11), 2.85, -d / 2 + dd + 0.1]));
  }

  g.add(M(merge(P), MAT.lit));
  if (Bulbs.length) g.add(M(merge(Bulbs), MAT.bulb, { cast: false, receive: false }));

  const titleText = unlocked
    ? `QUÁN ĂN GIA ĐÌNH (★${level}) • READY, SET, COOK!`
    : 'QUÁN ĂN LÀNG: READY, SET, COOK! • LÀM THÊM';
  const s = sign(titleText, '👨‍🍳', 7.2, 1.25, '#fff4dc', '#b83826');
  s.position.set(0, 3.85, -d / 2 + dd + 0.6); s.rotation.x = -0.25;
  g.add(s);

  for (const x of [-w / 4, w / 4]) {
    const gl = glowSprite(0xffd27a, 5.5, 0.6);
    gl.position.set(x, 2.8, 0);
    g.add(gl);
    (g.userData.glows ||= []).push(gl);
  }

  // Va chạm gọn gàng: chặn tường bắc, tường tây, và tâm bàn Oval để người chơi đi lại mượt mà giữa Bếp và Phòng Ăn!
  g.userData.rects = [
    { x0: -w / 2, x1: w / 2, z0: -d / 2 - 0.3, z1: -d / 2 + 0.45 },
    { x0: -w / 2 - 0.2, x1: -w / 2 + 0.45, z0: -d / 2, z1: d / 2 },
    { x0: w / 2 - 0.4, x1: w / 2 + 0.2, z0: -d / 2, z1: d / 2 - 2.2 },
    { x0: px - 0.45, x1: px + 0.45, z0: pz - 2.6, z1: pz + 2.6 },
    { x0: ox - 1.35, x1: ox + 1.35, z0: oz - 2.4, z1: oz + 2.4 },
  ];
  return g;
}

// Quảng trường Làng nâng cấp: Đài phun nước lớn + Bồn hoa 4 góc + Dây cờ lễ hội & Đèn lồng treo cao rực rỡ
export function plaza() {
  const g = new THREE.Group(), f = buildFurniture('fountain');
  f.scale.setScalar(1.32);
  g.add(f);
  const P = [], Bulbs = [];
  // Viền gạch tròn lát quảng trường & 4 trụ đèn dây cờ lễ hội
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    P.push(bake(B(1.1, 0.08, 0.55, 0.02), i % 2 ? 0xd9604c : 0xf2d27a, [Math.cos(a) * 6.8, 0.04, Math.sin(a) * 6.8], [0, -a, 0]));
  }
  const posts = [[-6.5, -5.5], [6.5, -5.5], [-6.5, 5.5], [6.5, 5.5]];
  for (const [px, pz] of posts) {
    P.push(
      bake(Cy(0.1, 0.12, 3.8, 6), W2, [px, 1.9, pz]),
      bake(S(0.16, 6, 5), 0xffd23f, [px, 3.85, pz])
    );
  }
  // Dây cờ & đèn lồng nối giữa các trụ quảng trường
  const spans = [[posts[0], posts[1]], [posts[2], posts[3]], [posts[0], posts[2]], [posts[1], posts[3]]];
  for (const [[x0, z0], [x1, z1]] of spans) {
    for (let i = 1; i < 8; i++) {
      const t = i / 8, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const sag = Math.sin(t * Math.PI) * 0.45;
      Bulbs.push(bake(S(0.13, 6, 5), [0xffcf48, 0xff6b8b, 0x5ec248, 0x5ebee3][i % 4], [x, 3.65 - sag, z]));
    }
  }
  g.add(M(merge(P), MAT.lit));
  g.add(M(merge(Bulbs), MAT.bulb, { cast: false, receive: false }));
  g.userData.fountain = f;
  g.userData.rects = [{ x0: -2.2, x1: 2.2, z0: -2.2, z1: 2.2 }];
  return g;
}

// Cánh cổng chuồng: bản lề ở trụ phía -z, mở thì xoay vào trong
export function penGate() {
  const gap = 1.35, g = new THREE.Group(), door = new THREE.Group(), L = gap * 2 - 0.3, c = 0xc8955f;
  door.add(M(merge([bake(B(0.09, 0.1, L, 0.03), c, [0, 0.38, L / 2 + 0.15]), bake(B(0.09, 0.1, L, 0.03), c, [0, 0.86, L / 2 + 0.15]), bake(B(0.08, 0.08, L, 0.02), dk(c, 0.85), [0, 0.62, L / 2 + 0.15], [-0.2, 0, 0]), ...[0.3, 1.2, 2.1].map((z) => bake(B(0.09, 0.95, 0.09, 0.03), c, [0, 0.62, z]))]), MAT.lit)); g.add(door); g.userData.door = door; return g;
}
