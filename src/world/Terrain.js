import * as THREE from 'three';
import { islandR, terrainH, riverZ, WATER_Y, PENS, PLOT, HOUSE, VILLAGE, REST, DOCK, BRIDGE, SPOTS, AREAS } from '../data/layout.js';
import { noise2, smooth, lerp, clamp } from '../core/util.js';

// Đường đi (polyline) — dùng cho màu terrain, tránh đặt cây/cỏ lên đường
const RAW_PATHS = [
  [0, -12, 0, 23, 1.85], [0, 6, 40, 6, 2.1], [-26, 5, 0, 5, 1.55], [10, -12, 10, -26, 1.45], [10, -26, 0, -33, 1.45], [0, -33, 0, -52, 1.45],
  [30, 6, 30, 38, 1.65], [30, 38, 18, 49, 1.65], [8, -21, 12, -21, 1.35], [8, -11, 12, -11, 1.35], [8, -1, 12, -1, 1.35], [23, -26, 23, 6, 1.35], [-8, -11, 0, -11, 1.35],
  // Đường lát đá rộng rãi trong Làng Hạnh Phúc & nối thẳng lên Quán Ăn Ready, Set, Cook!
  [37, 6, 52, 2, 2.6], [52, -13.5, 52, 13.5, 2.8], [56.8, -13.5, 52, -6, 2.4], [42, -1.5, 62, -1.5, 2.2], [42, 5.5, 62, 5.5, 2.2], [36, -4, 36, 8, 1.55], [67, -4, 67, 8, 1.55], [-12, 12, -26, 5, 1.25], [-6, 6, -6, 12, 1.25],
];
// Tiền tính toán AABB cho từng đoạn đường để tăng tốc gấp 5 lần khi nướng texture địa hình
const PATHS = RAW_PATHS.map(([x0, z0, x1, z1, w]) => {
  const pad = w * 0.48 + 1.1;
  const dx = x1 - x0, dz = z1 - z0;
  return { x0, z0, dx, dz, len2: dx * dx + dz * dz, w, minX: Math.min(x0, x1) - pad, maxX: Math.max(x0, x1) + pad, minZ: Math.min(z0, z1) - pad, maxZ: Math.max(z0, z1) + pad };
});

export function pathAmt(x, z) {
  let a = 0;
  for (let i = 0; i < PATHS.length; i++) {
    const p = PATHS[i];
    if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) continue;
    const t = clamp(((x - p.x0) * p.dx + (z - p.z0) * p.dz) / p.len2, 0, 1);
    const d = Math.hypot(x - (p.x0 + p.dx * t), z - (p.z0 + p.dz * t));
    const v = 1 - smooth(p.w * 0.48, p.w * 0.48 + 1.05, d);
    if (v > a) a = v;
  }
  const pl = VILLAGE.plaza;
  if (Math.abs(x - pl.x) < pl.r + 1 && Math.abs(z - pl.z) < pl.r + 1) {
    a = Math.max(a, 1 - smooth(pl.r - 1.5, pl.r + 0.6, Math.hypot(x - pl.x, z - pl.z)));
  }
  return a;
}
const C = (h) => new THREE.Color(h);
const GRASS_A = C(0x8ed458), GRASS_B = C(0x68b842), GRASS_DARK = C(0x4e9c38), FOREST = C(0x3f8b3e), DIRT = C(0xdcb982), DIRT_EDGE = C(0xc49e68), COBBLE = C(0xe6d5b8), SAND = C(0xf4e3b2), WET = C(0xc5b07e), ROCK = C(0x9ea4ad), ROCK2 = C(0x848a94), SNOW = C(0xf6f9fd), UNDER = C(0x6fb098), MUD = C(0x825a38), STRAW = C(0xdfc87e), PEN = C(0x9cce66);
const tmp = new THREE.Color();
const POND = PENS.duck.pond;
const waterNear = (x, z) => Math.max(1 - smooth(5, 9, Math.abs(z - riverZ(x))), 1 - smooth(4, 7.5, Math.hypot(x - POND.x, z - POND.z)), smooth(54, 60, islandR(x, z)));

export function terrainColor(x, z, h, out = tmp) {
  const n = noise2(x * 0.22, z * 0.22) * 0.5 + noise2(x * 0.7, z * 0.7) * 0.25;
  out.copy(GRASS_A).lerp(GRASS_B, clamp(0.5 + n, 0, 1));
  const f = smooth(-22, -34, x); if (f > 0) out.lerp(FOREST, f * 0.75);                   // rừng sẫm hơn
  out.lerp(GRASS_DARK, smooth(48, 62, islandR(x, z)) * 0.5);
  const m = smooth(2.5, 7, h) * smooth(-32, -40, z); if (m > 0) out.lerp(h > 10.5 ? SNOW : ROCK, m); if (h > 4 && z < -38) out.lerp(noise2(x * 0.3, z * 0.3) > 0 ? ROCK : ROCK2, 0.5);
  if (h > 10) out.lerp(SNOW, smooth(10, 11.5, h));
  const beach = smooth(36, 40, z) * smooth(1.4, 0.2, h) ; if (beach > 0 && z > 36) out.lerp(SAND, beach);
  const bank = smooth(0.22, -0.2, h) * waterNear(x, z); if (bank > 0) out.lerp(WET, bank * 0.9);
  if (h < -0.3) out.lerp(UNDER, smooth(-0.3, -1.2, h));
  for (const k in PENS) { const p = PENS[k]; if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) { out.lerp(k === 'coop' || k === 'hutch' ? STRAW : k === 'barn' ? DIRT : PEN, 0.58); if (p.mud && Math.hypot(x - p.mud.x, z - p.mud.z) < p.mud.r) out.lerp(MUD, smooth(p.mud.r, p.mud.r - 0.8, Math.hypot(x - p.mud.x, z - p.mud.z))); } }
  const pa = pathAmt(x, z);
  if (pa > 0) {
    const isVillage = x > 36.5 && x < 67 && z > -25 && z < 16;
    if (isVillage) out.lerp(COBBLE, pa * 0.94);
    else {
      out.lerp(DIRT_EDGE, Math.min(1, pa * 1.35) * 0.55);
      out.lerp(DIRT, pa * 0.94);
    }
  }
  // nền nhà hàng
  if (x > REST.x0 - 1.2 && x < REST.x1 + 1.2 && z > REST.z0 - 1.2 && z < REST.z1 + 1.8) out.lerp(COBBLE, 0.88);
  // đất ruộng (khu có thể mở rộng) hơi sẫm
  if (x > PLOT.x0 - 1.4 && x < PLOT.x0 + PLOT.cols * PLOT.sp - 0.8 && z > PLOT.z0 - 1.4 && z < PLOT.z0 + PLOT.maxRows * PLOT.sp - 0.8) out.lerp(MUD, 0.22);
  const sh = (noise2(x * 3.1, z * 2.7) * 0.028); out.offsetHSL(0, 0, sh);
  return out;
}

// Màu nền được "bake" vào texture canvas (lưới 88x88 giảm >50% số đỉnh nhưng vẫn mượt tuyệt đối)
export function buildTerrain(res = 512) {
  const SIZE = 150, SEG = 88, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, terrainH(x, z)); uv[i * 2] = (x + SIZE / 2) / SIZE; uv[i * 2 + 1] = 1 - (z + SIZE / 2) / SIZE; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals(); g.computeBoundingSphere();
  const cv = document.createElement('canvas'); cv.width = cv.height = res; const ctx = cv.getContext('2d'), img = ctx.createImageData(res, res), c = new THREE.Color();
  for (let py = 0; py < res; py++) for (let px = 0; px < res; px++) {
    const x = -SIZE / 2 + ((px + 0.5) / res) * SIZE, z = -SIZE / 2 + ((py + 0.5) / res) * SIZE, h = terrainH(x, z);
    terrainColor(x, z, h, c); c.convertLinearToSRGB(); const o = (py * res + px) * 4;
    img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex })); mesh.receiveShadow = true; mesh.name = 'terrain';
  return mesh;
}

// Nâng độ phân giải texture mặt đất dần dần (mỗi frame chỉ ~2.2ms) để iPhone 12/14 Pro Max hoàn toàn không bị khựng
export function upgradeTerrain(mesh, res = 768) {
  const SIZE = 150, cv = document.createElement('canvas'); cv.width = cv.height = res; const ctx = cv.getContext('2d'), img = ctx.createImageData(res, res), c = new THREE.Color(); let row = 0;
  const step = () => {
    const t0 = performance.now();
    while (row < res && performance.now() - t0 < 2.2) {
      const py = row++;
      for (let px = 0; px < res; px++) { const x = -SIZE / 2 + ((px + 0.5) / res) * SIZE, z = -SIZE / 2 + ((py + 0.5) / res) * SIZE; terrainColor(x, z, terrainH(x, z), c); c.convertLinearToSRGB(); const o = (py * res + px) * 4; img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255; }
    }
    if (row < res) { requestAnimationFrame(step); return; }
    ctx.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const old = mesh.material.map; mesh.material.map = tex; mesh.material.needsUpdate = true; old?.dispose();
  };
  requestAnimationFrame(step);
}
