import * as THREE from 'three';
import { bake, merge, S, Cy, Co, Ca, To, blob } from './Kit.js';
import { CROPS } from '../data/crops.js';

const cache = new Map();
const leaf = (c, h, w, tilt, yaw, y = 0) => { const g = Co(w, h, 5); g.translate(0, h / 2, 0); return bake(g, c, [0, y, 0], [0, yaw, tilt], [1, 1, 0.5]); };
const ring = (n, fn) => Array.from({ length: n }, (_, i) => fn(i, (i / n) * Math.PI * 2));
const berry = (r, c, x, y, z) => bake(S(r, 7, 5), c, [x, y, z]);

function build(id, stage) {
  const d = CROPS[id], [fc, lc] = d.c, dark = new THREE.Color(lc).multiplyScalar(0.8).getHex(), k = [0.45, 0.8, 1][stage], P = [];
  switch (d.shape) {
    case 'root': P.push(...ring(stage ? 5 : 2, (i, a) => leaf(i % 2 ? lc : dark, 0.3 + 0.35 * k, 0.07, 0.5, a))); if (stage === 2) { if (id === 'carrot') P.push(bake(Co(0.15, 0.4, 8), fc, [0, 0.04, 0], [Math.PI, 0, 0]), bake(S(0.14, 8, 6), fc, [0, 0.1, 0], [0, 0, 0], [1, 0.4, 1])); else P.push(bake(S(0.17, 8, 6), fc, [0.1, 0.08, 0], [0, 0, 0], [1, 0.7, 1]), bake(S(0.15, 8, 6), fc, [-0.12, 0.07, 0.06], [0, 0, 0], [1, 0.7, 1]), bake(S(0.13, 8, 6), fc, [0, 0.07, -0.13], [0, 0, 0], [1, 0.7, 1])); } break;
    case 'grain': { const n = [2, 5, 8][stage], h = [0.3, 0.7, 1.1][stage]; P.push(...ring(n, (i, a) => { const r = 0.05 + (i % 3) * 0.07, x = Math.cos(a) * r, z = Math.sin(a) * r; return merge([bake(Cy(0.014, 0.02, h, 4), stage === 2 ? 0xd8c067 : lc, [x, h / 2, z]), ...(stage === 2 ? [bake(S(0.055, 6, 5), fc, [x, h + 0.04, z], [0, 0, id === 'rice' ? 0.5 : 0], [0.7, 2.2, 0.7])] : [])]); })); break; }
    case 'corn': { const h = [0.3, 0.8, 1.35][stage]; P.push(bake(Cy(0.04, 0.06, h, 6), lc, [0, h / 2, 0]), ...ring(4, (i, a) => leaf(lc, 0.5 * k + 0.2, 0.09, 0.9, a, h * 0.45 + (i % 2) * 0.2))); if (stage === 2) P.push(bake(Ca(0.07, 0.2), fc, [0.1, 0.85, 0.06], [0, 0, 0.2]), bake(Co(0.08, 0.2, 6), lc, [0.1, 0.65, 0.06], [Math.PI, 0, 0.2]), bake(Ca(0.07, 0.2), fc, [-0.1, 0.65, -0.06], [0, 0, -0.2])); break; }
    case 'bush': case 'berry': case 'chili': case 'star': {
      P.push(blob(0.26 + 0.2 * k, lc, [0, 0.22 + 0.1 * k, 0], [1.1, 0.8, 1.1], 0.14, 3), blob(0.2 * k + 0.1, dark, [0.16, 0.18, 0.08], 1, 0.12, 4), blob(0.2 * k + 0.1, lc, [-0.15, 0.2, -0.1], 1, 0.12, 5));
      if (stage === 1) P.push(...ring(3, (i, a) => berry(0.05, 0x9be07a, Math.cos(a) * 0.25, 0.3, Math.sin(a) * 0.25)));
      if (stage === 2) {
        const n = d.shape === 'berry' ? 9 : 6;
        P.push(...ring(n, (i, a) => { const r = 0.26 + (i % 2) * 0.06, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 0.2 + (i % 3) * 0.1;
          if (d.shape === 'chili') return bake(Ca(0.035, 0.16), fc, [x, y, z], [0.2, 0, 0.1]);
          if (d.shape === 'star') return merge([bake(S(0.07, 6, 5), fc, [x, y, z]), ...ring(5, (j, b) => bake(Co(0.04, 0.12, 4), fc, [x + Math.cos(b) * 0.08, y + Math.sin(b) * 0.08, z], [0, 0, b - Math.PI / 2]))]);
          return berry(d.shape === 'berry' ? 0.05 : 0.1, fc, x, y, z); }));
      } break; }
    case 'gourd': { P.push(...ring(3, (i, a) => bake(S(0.2 * k + 0.05, 7, 5), lc, [Math.cos(a) * 0.35, 0.06, Math.sin(a) * 0.35], [0, 0, 0], [1.3, 0.2, 1.1])));
      const r = [0.08, 0.2, 0.4][stage];
      if (d.stripes) P.push(...ring(6, (i, a) => bake(S(r, 8, 6), i % 2 ? 0x2f7d3a : 0x58c26e, [0, r * 0.9, 0], [0, a * 0.5, 0], [1, 0.9, 1.0]))); else P.push(...ring(6, (i, a) => bake(S(r, 8, 6), fc, [Math.cos(a) * r * 0.45, r * 0.8, Math.sin(a) * r * 0.45], [0, 0, 0], [0.62, 0.8, 0.62])), bake(S(r * 0.8, 8, 6), fc, [0, r * 0.8, 0], [0, 0, 0], [1, 0.82, 1]));
      P.push(bake(Cy(0.03, 0.04, 0.14 + r * 0.3, 5), 0x6b8f3a, [0, r * 1.6, 0], [0, 0, 0.2])); break; }
    case 'mushroom': { const s = [0.5, 0.85, 1.2][stage]; P.push(bake(Cy(0.08 * s, 0.1 * s, 0.3 * s, 8), lc, [0, 0.15 * s, 0]), bake(S(0.25 * s, 10, 7), fc, [0, 0.32 * s, 0], [0, 0, 0], [1, 0.65, 1]));
      if (stage === 2) P.push(...ring(5, (i, a) => bake(S(0.045, 5, 4), 0xffffff, [Math.cos(a) * 0.14, 0.45 * s, Math.sin(a) * 0.14])), bake(S(0.13 * s, 8, 6), 0xf06a56, [0.28, 0.1, 0.2], [0, 0, 0], [1, 0.65, 1]), bake(Cy(0.04, 0.05, 0.12, 6), lc, [0.28, 0.05, 0.2])); break; }
  }
  const g = merge(P); return g;
}
export function cropGeo(id, stage) { const k = id + stage; if (!cache.has(k)) cache.set(k, build(id, stage)); return cache.get(k); }
export const cropStage = (g) => (g >= 1 ? 2 : g >= 0.4 ? 1 : 0);
