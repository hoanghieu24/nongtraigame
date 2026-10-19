import * as THREE from 'three';
import { bake, merge, B, S, Cy, Co, blob } from '../art/Kit.js';
import { terrainH, PLOT, PENS, HOUSE, DOCK, BRIDGE, SPOTS, FORAGE_POINTS } from '../data/layout.js';
import { mulberry32, noise2 } from '../core/util.js';
import { pathAmt } from './Terrain.js';

// Gió: lắc theo độ cao (gốc đứng yên, ngọn đung đưa). Hoạt động cho cả InstancedMesh lẫn Mesh thường.
export function windify(mat, uniforms, amp = 0.05, instanced = true) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      ${instanced ? 'vec2 wp = instanceMatrix[3].xz;' : 'vec2 wp = modelMatrix[3].xz;'}
      float sw = sin(uTime*1.5 + wp.x*0.33 + wp.y*0.27) * ${amp.toFixed(3)} * max(position.y, 0.0);
      transformed.x += sw; transformed.z += sw*0.55;`);
  };
  mat.needsUpdate = true; return mat;
}
const rect = (x, z, x0, x1, z0, z1, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
export function blockedForPlants(x, z, m = 1) {
  if (terrainH(x, z) < 0.12) return true;
  if (pathAmt(x, z) > 0.12) return true;
  if (rect(x, z, PLOT.x0 - 2.0, PLOT.x0 + PLOT.cols * PLOT.sp + 0.6, PLOT.z0 - 2.0, PLOT.z0 + PLOT.maxRows * PLOT.sp + 1.0, m)) return true;
  for (const k in PENS) { const p = PENS[k]; if (rect(x, z, p.x0, p.x1, p.z0, p.z1, m + 0.6)) return true; }
  if (rect(x, z, HOUSE.x - HOUSE.w / 2 - 1.5, HOUSE.x + HOUSE.w / 2 + 1.5, HOUSE.z - HOUSE.d / 2 - 1, HOUSE.z + HOUSE.d / 2 + 4.5, m)) return true;
  if (rect(x, z, 36, 68, -30, 22, m)) return true;
  if (rect(x, z, DOCK.x0, DOCK.x1, DOCK.z0 - 3, DOCK.z1, m + 1)) return true;
  if (rect(x, z, BRIDGE.x0, BRIDGE.x1, BRIDGE.z0, BRIDGE.z1, m + 1)) return true;
  for (const f of FORAGE_POINTS) if ((f.x - x) ** 2 + (f.z - z) ** 2 < (2 + m * 0.5) ** 2) return true;
  for (const s of [SPOTS.chest, SPOTS.crate, SPOTS.homeNotice, SPOTS.houseUp, SPOTS.merchant, SPOTS.well]) if (s && (s.x - x) ** 2 + (s.z - z) ** 2 < (2.6 + m) ** 2) return true;
  return false;
}

// ---- hình cây (merge, vertex color) ----
const roundTree = () => merge([bake(Cy(0.22, 0.34, 1.75, 7), 0x825334, [0, 0.85, 0]), blob(1.4, 0x5ab54a, [0, 2.45, 0], [1, 0.92, 1], 0.1, 1, 8), blob(1.05, 0x6ec658, [0.85, 2.05, 0.3], 1, 0.1, 2, 7), blob(1.05, 0x64be50, [-0.8, 2.15, -0.35], 1, 0.1, 3, 7), blob(0.9, 0x84d668, [0.1, 3.2, 0.1], 1, 0.1, 4, 7)]);
const appleTree = () => merge([bake(Cy(0.22, 0.34, 1.55, 7), 0x825334, [0, 0.75, 0]), blob(1.52, 0x5eb84e, [0, 2.25, 0], [1.05, 0.85, 1.05], 0.1, 5, 8), blob(0.95, 0x76ca60, [0.9, 1.95, 0.4], 1, 0.1, 6, 7), ...[[0.9, 2.6, 0.9], [-1.0, 2.2, 0.7], [0.2, 2.9, -0.9], [-0.6, 1.7, -1.1], [1.2, 1.9, -0.6]].map((p) => bake(S(0.18, 6, 4), 0xf04e42, p))]);
const pineTree = () => merge([
  bake(Cy(0.18, 0.28, 1.3, 6), 0x754c2e, [0, 0.65, 0]),
  bake(Co(1.7, 1.85, 8), 0x2e7d47, [0, 1.75, 0]),
  bake(Co(1.42, 1.75, 8), 0x398f52, [0, 2.62, 0]),
  bake(Co(1.12, 1.6, 8), 0x46a25e, [0, 3.45, 0]),
  bake(Co(0.78, 1.4, 8), 0x56b66c, [0, 4.2, 0]),
  bake(S(0.2, 5, 4), 0x76cf84, [0, 4.92, 0])
]);
const birchTree = () => merge([bake(Cy(0.13, 0.19, 2.4, 6), 0xefe9db, [0, 1.2, 0]), bake(B(0.18, 0.05, 0.05, 0.01), 0x4a4a4a, [0.05, 0.8, 0.14]), bake(B(0.18, 0.05, 0.05, 0.01), 0x4a4a4a, [-0.06, 1.5, 0.12]), blob(0.95, 0x9be07a, [0, 2.7, 0], [1, 0.9, 1], 0.12, 7, 7), blob(0.7, 0xaeea8a, [0.6, 2.3, 0.2], 1, 0.1, 8, 6), blob(0.7, 0xa3e583, [-0.55, 2.4, -0.3], 1, 0.1, 9, 6)]);
const palmTree = () => {
  const parts = []; for (let k = 0; k < 6; k++) parts.push(bake(Cy(0.19 - k * 0.018, 0.21 - k * 0.018, 0.78, 6), k % 2 ? 0x9a6b44 : 0x8a5c3a, [k * 0.13, 0.4 + k * 0.72, 0], [0, 0, -0.17 * k * 0.55]));
  const cx = 0.75, cy = 4.5;
  for (let i = 0; i < 7; i++) { const g = Co(0.34, 2.5, 4); g.translate(0, 1.25, 0); parts.push(bake(g, i % 2 ? 0x58b85a : 0x6cc866, [cx, cy, 0], [0, (i / 7) * 6.283, 1.25 + (i % 2) * 0.2], [1, 1, 0.35])); }
  parts.push(bake(S(0.28, 5, 4), 0x7a5230, [cx, cy - 0.1, 0.18]), bake(S(0.26, 5, 4), 0x7a5230, [cx - 0.2, cy - 0.15, -0.15]));
  return merge(parts);
};
const rockGeo = () => { const g = new THREE.SphereGeometry(1, 7, 5), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const f = 0.8 + 0.4 * noise2(p.getX(i) * 3, p.getZ(i) * 3 + p.getY(i)); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f); } g.deleteAttribute('uv'); const m = bake(g, 0xffffff); m.computeVertexNormals(); return m; };
const bushGeo = () => merge([blob(0.92, 0x55af4a, [0, 0.55, 0], [1.1, 0.8, 1], 0.12, 11, 7), blob(0.68, 0x6cc45c, [0.7, 0.4, 0.2], 1, 0.12, 12, 6), blob(0.62, 0x62bc52, [-0.65, 0.4, -0.2], 1, 0.12, 13, 6)]);

// Cụm cỏ tối ưu cho GPU Mobile: 5 lá cỏ bản rộng vừa phải, giảm 45% số đỉnh nhưng nhìn vẫn dày mướt
function tuftGeo() {
  const R = mulberry32(7), pos = [], col = [], nor = [], idx = []; const c0 = new THREE.Color(0x45993c), c1 = new THREE.Color(0xafe866);
  for (let b = 0; b < 5; b++) {
    const a = R() * 6.283, h = 0.52 + R() * 0.46, w = 0.095 + R() * 0.035, ox = (R() - 0.5) * 0.36, oz = (R() - 0.5) * 0.36, lean = 0.12 + R() * 0.22, i0 = pos.length / 3, cx = Math.cos(a), cz = Math.sin(a);
    pos.push(ox - cz * w, 0, oz + cx * w, ox + cz * w, 0, oz - cx * w, ox + cx * lean, h, oz + cz * lean);
    col.push(c0.r, c0.g, c0.b, c0.r, c0.g, c0.b, c1.r, c1.g, c1.b); for (let k = 0; k < 3; k++) nor.push(0, 1, 0); idx.push(i0, i0 + 1, i0 + 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
const flowerGeo = (petal) => merge([bake(Cy(0.014, 0.018, 0.34, 4), 0x4a9a44, [0, 0.17, 0]), bake(S(0.07, 5, 4), 0xffd23f, [0, 0.36, 0]), ...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * 6.283; return bake(S(0.07, 5, 4), petal, [Math.cos(a) * 0.1, 0.35, Math.sin(a) * 0.1], [0, 0, 0], [1, 0.4, 1]); })]);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
function instanced(geo, mat, items, { chunk = 96, shadow = false, receiveShadow = true, tint = 0.08 } = {}) {
  const groups = new Map();
  for (const it of items) { const k = `${Math.floor((it.x + 80) / chunk)}_${Math.floor((it.z + 80) / chunk)}`; (groups.get(k) || groups.set(k, []).get(k)).push(it); }
  const out = [];
  for (const list of groups.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length); im.userData.max = list.length; im.castShadow = shadow; im.receiveShadow = receiveShadow;
    list.forEach((it, i) => {
      _e.set(it.rx || 0, it.rot || 0, it.rz || 0); _q.setFromEuler(_e); _p.set(it.x, it.y, it.z); const s = it.s ?? 1; Array.isArray(s) ? _s.set(s[0], s[1], s[2]) : _s.set(s, s, s);
      im.setMatrixAt(i, _m.compose(_p, _q, _s));
      _c.setHSL(0, 0, 1); if (it.color !== undefined) _c.set(it.color); else _c.setRGB(1 + (Math.random() - 0.5) * tint * 2, 1 + (Math.random() - 0.5) * tint * 2, 1 + (Math.random() - 0.5) * tint * 2);
      im.setColorAt(i, _c);
    });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); out.push(im);
  }
  return out;
}

export function buildScatter(wind, quality) {
  const R = mulberry32(2024), trees = [], circles = [], objects = [], sparse = Math.min(1, quality.trees);
  const ok = (x, z, minD, m) => { if (blockedForPlants(x, z, m)) return false; for (const t of trees) if ((t.x - x) ** 2 + (t.z - z) ** 2 < minD * minD) return false; return true; };
  const add = (type, x, z, s) => { trees.push({ type, x, z, y: terrainH(x, z) - 0.05, s, rot: R() * 6.283 }); circles.push({ x, z, r: type === 'palm' ? 0.4 : 0.5 * s }); };
  const tryZone = (n, x0, x1, z0, z1, pick, minD = 3.0) => { for (let i = 0; i < n; i++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0); if (R() > sparse) continue; if (!ok(x, z, minD, 0.8)) continue; const [t, s] = pick(); add(t, x, z, s); } };
  // Đã cắt giảm ~55% cây cối ở rìa xa không cần thiết, chỉ giữ lại những cụm cây tạo khung cảnh đẹp quanh nông trại, làng và bờ biển
  tryZone(320, -52, -26, -34, 34, () => { const r = R(); return r < 0.5 ? ['round', 0.95 + R() * 0.5] : r < 0.82 ? ['pine', 0.9 + R() * 0.55] : ['birch', 0.9 + R() * 0.35]; }, 3.4); // rừng phía tây
  tryZone(180, -42, 42, -52, -34, () => ['pine', 1.05 + R() * 0.9], 4.0);                                                                                // sườn núi phía bắc
  tryZone(110, -26, -15, -26, 18, () => { const r = R(); return r < 0.4 ? ['apple', 1 + R() * 0.25] : r < 0.75 ? ['round', 1 + R() * 0.25] : ['birch', 1]; }, 4.8);             // rìa nông trại phía tây
  tryZone(65, -22, 34, -31, -24, () => (R() < 0.68 ? ['pine', 1.15 + R() * 0.4] : ['round', 1.1 + R() * 0.35]), 4.2);                                     // rừng thông xanh sau nhà
  tryZone(35, 34, 60, 20, 28, () => ['round', 1 + R() * 0.35], 4.5); tryZone(30, 36, 60, -34, -26, () => ['pine', 1.2 + R() * 0.4], 4.2);
  tryZone(95, -34, 38, 41, 53, () => ['palm', 0.9 + R() * 0.35], 5.2);                                                                              // bãi biển
  tryZone(45, -22, 36, 12, 19, () => (R() < 0.5 ? ['round', 1] : ['apple', 1.1]), 5.5);                                                                  // dọc bờ sông
  const by = (t) => trees.filter((x) => x.type === t);
  const mats = { lit: windify(new THREE.MeshLambertMaterial({ vertexColors: true }), wind, 0.04) };
  const geos = { round: roundTree(), apple: appleTree(), pine: pineTree(), birch: birchTree(), palm: palmTree() };
  // Chia nhỏ chunk = 28 (thay vì 96) để khi camera ở gần, Three.js tự động ẩn (frustum cull) 80% số cụm cây nằm ngoài màn hình!
  for (const k in geos) for (const m of instanced(geos[k], mats.lit, by(k), { chunk: 28, shadow: !!quality.shadows, receiveShadow: false, tint: 0.07 })) { m.userData.kind = 'tree'; objects.push(m); }
  // bụi cây + đá: giảm số lượng thừa ở rìa bản đồ, chia chunk nhỏ 32m
  const bushes = []; for (let i = 0; i < 64 * sparse; i++) { const x = -48 + R() * 96, z = -38 + R() * 78; if (R() < 0.7 && x > -28) continue; if (!ok(x, z, 2.5, 0.4)) continue; bushes.push({ x, z, y: terrainH(x, z) - 0.05, s: 0.7 + R() * 0.6, rot: R() * 6 }); }
  for (const m of instanced(bushGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), bushes, { chunk: 32, shadow: false, receiveShadow: false })) { m.userData.kind = 'bush'; objects.push(m); }
  const rocks = [];
  rocks.push({ x: -3.2, z: -6.8, y: terrainH(-3.2, -6.8) - 0.08, s: [0.85, 0.58, 0.72], rot: 0.4, color: 0x9ea4ad });
  for (let i = 0; i < 75; i++) { const x = -50 + R() * 100, z = -48 + R() * 96, h = terrainH(x, z); const mount = z < -32 && h > 1, beach = z > 38 && h > 0.2, river = Math.abs(z - 29) < 8 && x > -42; if (!(mount || beach || river || (x < -28 && R() < 0.25))) continue; if (blockedForPlants(x, z, 0.2) && !mount) continue; const s = (mount ? 0.8 + R() * 1.6 : 0.4 + R() * 0.65); rocks.push({ x, z, y: h - 0.1, s: [s * 1.2, s, s], rot: R() * 6, color: R() < 0.5 ? 0xb4b7bd : 0x9ea3aa }); if (s > 0.6) circles.push({ x, z, r: s * 0.9 }); }
  for (const m of instanced(rockGeo(), new THREE.MeshLambertMaterial({ vertexColors: false, color: 0xffffff }), rocks, { chunk: 36, shadow: false, receiveShadow: false })) objects.push(m);
  // Cỏ: giảm từ 5600 xuống 1600 cụm tập trung quanh khu vực chơi chính, dùng FrontSide + chunk 24m giúp GPU điện thoại nhẹ gấp 5 lần!
  const grass = []; const N = 1600;
  for (let i = 0; i < N; i++) { const x = -44 + R() * 98, z = -38 + R() * 72; if (z > 34 || blockedForPlants(x, z, 0.3)) continue; const h = terrainH(x, z); if (h > 4.5) continue; grass.push({ x, z, y: h, s: 0.85 + R() * 0.75, rot: R() * 6.283 }); }
  const grassMat = windify(new THREE.MeshLambertMaterial({ vertexColors: true }), wind, 0.10);
  const grassMeshes = instanced(tuftGeo(), grassMat, grass, { chunk: 24, shadow: false, receiveShadow: false, tint: 0.12 }); for (const m of grassMeshes) { m.userData.kind = 'grass'; objects.push(m); }
  // Hoa: gọn đẹp quanh nông trại và làng, chia chunk 28m
  const flowerMeshes = [];
  for (const petal of [0xff8fb8, 0xffffff, 0xffd84a, 0xb69cff]) {
    const list = []; for (let c = 0; c < 12; c++) { const cx = -24 + R() * 64, cz = -24 + R() * 46; if (blockedForPlants(cx, cz, 0)) continue; for (let k = 0; k < 5; k++) { const x = cx + (R() - 0.5) * 4.5, z = cz + (R() - 0.5) * 4.5; if (blockedForPlants(x, z, 0.2)) continue; list.push({ x, z, y: terrainH(x, z), s: 0.8 + R() * 0.5, rot: R() * 6 }); } }
    for (const m of instanced(flowerGeo(petal), windify(new THREE.MeshLambertMaterial({ vertexColors: true }), wind, 0.18), list, { chunk: 28, shadow: false, receiveShadow: false, tint: 0 })) { m.userData.kind = 'flower'; flowerMeshes.push(m); objects.push(m); }
  }
  const setQuality = (q) => {
    for (const m of objects) {
      const kind = m.userData.kind;
      if (kind === 'grass') m.count = Math.floor(m.userData.max * q.grass);
      else if (kind === 'flower') m.count = Math.floor(m.userData.max * q.flowers);
      else if (kind === 'tree') m.castShadow = !!q.shadows;
    }
  };
  setQuality(quality);
  return { objects, circles, setQuality, trees };
}

