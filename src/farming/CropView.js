import * as THREE from 'three';
import { M, MAT, bake, B, Cy, S, Co, To, merge, signTexture } from '../art/Kit.js';
import { cropGeo, cropStage } from '../art/CropModels.js';
import { CROPS } from '../data/crops.js';
import { PLOT, plotPos, plotId } from '../data/layout.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);
const PLANT_OFFSETS = [[-0.42, -0.34], [0.42, -0.34], [0, 0.42]];

// Luống đất cày nổi 3D siêu nhẹ (không đổ bóng để tối ưu 60 FPS tuyệt đối khi tưới nước & trồng cây)
function buildFurrowGeo() {
  const P = [];
  for (const dz of [-0.55, 0, 0.55]) {
    P.push(bake(B(1.68, 0.09, 0.34, 0.03), 0xffffff, [0, 0.20, dz]));
  }
  return merge(P);
}

export class CropView {
  constructor(ctx) {
    this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group);
    const max = PLOT.cols * PLOT.maxRows; this.max = max;
    // Nền đất từng ô (tắt castShadow để không bao giờ gây lag trên điện thoại)
    this.soil = new THREE.InstancedMesh(B(1.88, 0.24, 1.88, 0.06), new THREE.MeshLambertMaterial({ color: 0xffffff }), max);
    this.soil.receiveShadow = true; this.soil.castShadow = false; this.soil.frustumCulled = false;
    this.furrows = new THREE.InstancedMesh(buildFurrowGeo(), new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), max);
    this.furrows.receiveShadow = false; this.furrows.castShadow = false; this.furrows.frustumCulled = false;
    this.sig = new Array(max).fill('');
    this.plants = new Map();
    this.plantMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.group.add(this.soil, this.furrows);
    this.borderGroup = new THREE.Group(); this.group.add(this.borderGroup); this.borderRows = 0;
    // Khung sáng vuông bo góc báo ô đất đang chọn
    this.ring = new THREE.Mesh(
      merge([
        bake(B(2.04, 0.05, 0.1, 0.02), 0xffffff, [0, 0, -0.97]),
        bake(B(2.04, 0.05, 0.1, 0.02), 0xffffff, [0, 0, 0.97]),
        bake(B(0.1, 0.05, 1.88, 0.02), 0xffffff, [-0.97, 0, 0]),
        bake(B(0.1, 0.05, 1.88, 0.02), 0xffffff, [0.97, 0, 0]),
      ]),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
    );
    this.ring.visible = false; this.ring.renderOrder = 3; this.group.add(this.ring);
  }

  buildBorder(rows) {
    for (const child of this.borderGroup.children) {
      child.geometry?.dispose();
      if (child.material?.map) { child.material.map.dispose(); child.material.dispose(); }
    }
    this.borderGroup.clear();
    this.sig.fill('');
    const x0 = PLOT.x0 - 1.52, x1 = PLOT.x0 + (PLOT.cols - 1) * PLOT.sp + 1.52;
    const z0 = PLOT.z0 - 1.52, z1 = PLOT.z0 + (rows - 1) * PLOT.sp + 1.52;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const W = 0xb88454, W2 = 0x7c502d, STONE = 0xc6baa6, MULCH = 0xa67c52;
    const P = [], Bulbs = [];

    P.push(
      bake(B(w + 0.52, 0.1, d + 0.52, 0.04), STONE, [cx, 0.03, cz]),
      bake(B(w + 0.14, 0.12, d + 0.14, 0.04), MULCH, [cx, 0.05, cz])
    );

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < PLOT.cols; c++) {
        const p = plotPos(r, c), hs = 0.98;
        P.push(
          bake(B(2.02, 0.16, 0.09, 0.02), W, [p.x, 0.11, p.z - hs]),
          bake(B(2.02, 0.16, 0.09, 0.02), W, [p.x, 0.11, p.z + hs]),
          bake(B(0.09, 0.16, 1.86, 0.02), W, [p.x - hs, 0.11, p.z]),
          bake(B(0.09, 0.16, 1.86, 0.02), W, [p.x + hs, 0.11, p.z])
        );
      }
    }

    const addFenceSeg = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.3) return;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(bx - ax, bz - az);
      P.push(
        bake(B(0.09, 0.09, len, 0.02), W, [mx, 0.56, mz], [0, ang, 0]),
        bake(B(0.09, 0.09, len, 0.02), W, [mx, 0.30, mz], [0, ang, 0])
      );
      const steps = Math.max(1, Math.round(len / 2.4));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        P.push(bake(B(0.15, 0.72, 0.15, 0.03), W2, [px, 0.36, pz]));
      }
    };

    const gateHalf = 1.25;
    addFenceSeg(x0, z0, cx - gateHalf, z0);
    addFenceSeg(cx + gateHalf, z0, x1, z0);
    addFenceSeg(x0, z1, x1, z1);
    addFenceSeg(x0, z0, x0, z1);
    if (d > 4.6) {
      addFenceSeg(x1, z0, x1, cz - 1.05);
      addFenceSeg(x1, cz + 1.05, x1, z1);
    }

    P.push(
      bake(Cy(0.12, 0.14, 2.55, 7), W2, [cx - gateHalf, 1.28, z0]),
      bake(Cy(0.12, 0.14, 2.55, 7), W2, [cx + gateHalf, 1.28, z0]),
      bake(B(gateHalf * 2 + 0.7, 0.2, 0.34, 0.04), W2, [cx, 2.58, z0]),
      bake(B(gateHalf * 2 + 0.95, 0.14, 0.46, 0.03), W, [cx, 2.72, z0])
    );

    for (const [lx, lz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      P.push(
        bake(Cy(0.09, 0.11, 1.45, 6), W2, [lx, 0.72, lz]),
        bake(Co(0.22, 0.16, 4), 0x3b322c, [lx, 1.62, lz], [0, Math.PI / 4, 0])
      );
      Bulbs.push(bake(S(0.11, 6, 4), 0xffe699, [lx, 1.46, lz]));
    }

    this.borderGroup.add(M(merge(P), MAT.lit, { cast: false }), M(merge(Bulbs), MAT.bulb, { cast: false, receive: false }));

    const totalPlots = rows * PLOT.cols;
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.55, 0.68),
      new THREE.MeshBasicMaterial({
        map: signTexture(`Vườn Hiếu & Huyền (${totalPlots} ô)`, { bg: '#fff5e0', fg: '#5c3c20', icon: '🌱', w: 512, h: 140 }),
        transparent: true,
        side: THREE.DoubleSide,
      })
    );
    signMesh.position.set(cx, 2.22, z0 + 0.02);
    this.borderGroup.add(signMesh);
  }

  setTarget(x, z, color = 0xffffff) {
    if (x == null) { this.ring.visible = false; return; }
    this.ring.visible = true;
    this.ring.position.set(x, 0.29, z);
    this.ring.material.color.setHex(color);
  }

  syncPlants(st, rows) {
    for (const batch of this.plants.values()) batch.count = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < PLOT.cols; c++) {
      const cr = st.crops[plotId(r, c)];
      if (!cr?.crop || !CROPS[cr.crop]) continue;
      const stage = cr.s === 'ripe' ? 2 : cropStage(cr.g || 0), key = `${cr.crop}:${stage}`;
      let batch = this.plants.get(key);
      if (!batch) {
        // Một draw call cho các cây cùng loại/cùng giai đoạn, không tạo Mesh từng ô.
        batch = new THREE.InstancedMesh(cropGeo(cr.crop, stage), this.plantMat, this.max * PLANT_OFFSETS.length);
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        batch.count = 0; batch.castShadow = false; batch.receiveShadow = false;
        this.plants.set(key, batch); this.group.add(batch);
      }
      const p = plotPos(r, c);
      for (let j = 0; j < PLANT_OFFSETS.length; j++) {
        const [dx, dz] = PLANT_OFFSETS[j];
        _p.set(p.x + dx, 0.26, p.z + dz);
        _s.setScalar(0.88 + (j % 2) * 0.06);
        _q.setFromAxisAngle(_up, (r * 3 + c + j) * 1.7);
        batch.setMatrixAt(batch.count++, _m.compose(_p, _q, _s));
      }
    }
    for (const batch of this.plants.values()) {
      batch.visible = batch.count > 0;
      if (batch.visible) { batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); }
    }
  }

  update(dt, st, t) {
    const rows = st.farm.plotRows, rain = st.world.weather === 'rain' || st.world.weather === 'storm', wt = st.world.t;
    const activeCount = rows * PLOT.cols;
    this.soil.count = activeCount;
    this.furrows.count = activeCount;
    if (this.borderRows !== rows) { this.borderRows = rows; this.buildBorder(rows); }

    let matrixDirty = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < PLOT.cols; c++) {
        const i = r * PLOT.cols + c, id = plotId(r, c), cr = st.crops[id];
        const wet = cr && (cr.w > wt || rain);
        const stateCode = !cr ? 'g' : cr.s === 'ripe' ? 'r' : cr.crop ? (wet ? 'pw' : 'pd') : (wet ? 'w' : 't');
        const sig = `${stateCode}:${cr?.crop || ''}:${cr?.crop ? cropStage(cr.g || 0) : ''}`;
        if (this.sig[i] === sig) continue;
        this.sig[i] = sig;
        matrixDirty = true;
        const p = plotPos(r, c);

        // Mặt đất nền (ẩm ướt màu nâu đậm, khô màu nâu sáng)
        _p.set(p.x, stateCode === 'g' ? 0.02 : 0.07, p.z);
        _s.set(1, stateCode === 'g' ? 0.65 : 1, 1);
        this.soil.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
        this.soil.setColorAt(
          i,
          _c.setHex(stateCode === 'g' ? 0xa47d55 : (stateCode === 'w' || stateCode === 'pw') ? 0x3e2412 : 0x7e4f2b)
        );

        // Đất giữ màu tự nhiên; hình dáng cây cho biết loại cây và giai đoạn lớn.
        if (stateCode === 'g') {
          _p.set(p.x, -2, p.z); _s.set(0.001, 0.001, 0.001);
        } else {
          _p.set(p.x, 0.04, p.z); _s.set(1, 1, 1);
        }
        this.furrows.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
        const furrowColor =
          stateCode === 'r' ? 0xaa7444 :
          stateCode === 'pw' ? 0x65402a :
          stateCode === 'pd' ? 0x98623d :
          stateCode === 'w' ? 0x3b2110 : 0x8e5a32;
        this.furrows.setColorAt(i, _c.setHex(furrowColor));
      }
    }
    if (matrixDirty) {
      this.syncPlants(st, rows);
      this.soil.instanceMatrix.needsUpdate = true;
      this.furrows.instanceMatrix.needsUpdate = true;
      if (this.soil.instanceColor) this.soil.instanceColor.needsUpdate = true;
      if (this.furrows.instanceColor) this.furrows.instanceColor.needsUpdate = true;
    }
    if (this.ring.visible) {
      this.ring.material.opacity = 0.72 + 0.22 * Math.sin(t * 5);
    }
  }
}
