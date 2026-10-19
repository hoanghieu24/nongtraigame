import * as THREE from 'three';
import { M, MAT, bake, B, Cy, S, Co, To, merge, glowSprite, signTexture } from '../art/Kit.js';
import { cropGeo } from '../art/CropModels.js';
import { windify } from '../world/Scatter.js';
import { PLOT, plotPos, plotId } from '../data/layout.js';
import { CROPS } from '../data/crops.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// Luống đất cày nổi 3D (4 gờ luống đất song song trên mỗi ô đã cuốc)
function buildFurrowGeo() {
  const P = [];
  for (const dz of [-0.66, -0.22, 0.22, 0.66]) {
    P.push(bake(B(1.72, 0.11, 0.3, 0.05), 0xffffff, [0, 0.22, dz]));
  }
  return merge(P);
}

export class CropView {
  constructor(ctx) {
    this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group);
    const max = PLOT.cols * PLOT.maxRows; this.max = max;
    // Nền đất từng ô
    this.soil = new THREE.InstancedMesh(B(1.88, 0.28, 1.88, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.02 }), max);
    this.soil.receiveShadow = true; this.soil.castShadow = true; this.soil.frustumCulled = false;
    // Luống đất cày 3D nổi khối khi đã cuốc/tưới
    this.furrows = new THREE.InstancedMesh(buildFurrowGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.03 }), max);
    this.furrows.receiveShadow = true; this.furrows.castShadow = true; this.furrows.frustumCulled = false;
    this.sig = new Array(max).fill('');
    this.group.add(this.soil, this.furrows);
    this.borderGroup = new THREE.Group(); this.group.add(this.borderGroup); this.borderRows = 0;
    this.plantMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.03 }), ctx.world.wind, 0.2, false);
    this.plants = new Map(); this.sparkT = 0;
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

  // Dựng toàn bộ KHU RUỘNG RIÊNG BIỆT: tự động mở rộng to ra mỗi khi người chơi nâng cấp thêm hàng ruộng!
  buildBorder(rows) {
    this.borderGroup.clear();
    this.sig.fill('');
    const x0 = PLOT.x0 - 1.52, x1 = PLOT.x0 + (PLOT.cols - 1) * PLOT.sp + 1.52;
    const z0 = PLOT.z0 - 1.52, z1 = PLOT.z0 + (rows - 1) * PLOT.sp + 1.52;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const W = 0xb88454, W2 = 0x7c502d, STONE = 0xc6baa6, MULCH = 0xa67c52;
    const P = [], Bulbs = [];

    // 1. Nền Khu Ruộng riêng biệt (bậc đá + nền đất vườn phẳng mịn tách khỏi bãi cỏ)
    P.push(
      bake(B(w + 0.52, 0.1, d + 0.52, 0.04), STONE, [cx, 0.03, cz]),
      bake(B(w + 0.14, 0.12, d + 0.14, 0.04), MULCH, [cx, 0.05, cz])
    );

    // 2. Lối đi lát đá cuội dẫn từ cổng Bắc và từ đường chính phía Đông vào Khu Ruộng
    for (let i = 0; i < 3; i++) {
      P.push(bake(Cy(0.42, 0.45, 0.07, 9), STONE, [cx + (i % 2 ? 0.12 : -0.12), 0.05, z0 - 0.55 - i * 0.85], [0, i * 0.7, 0], [1.2, 1, 0.85]));
    }
    for (let i = 0; i < 3; i++) {
      P.push(bake(Cy(0.42, 0.45, 0.07, 9), STONE, [x1 + 0.55 + i * 0.85, 0.05, cz + (i % 2 ? 0.1 : -0.1)], [0, i * 0.5, 0], [0.85, 1, 1.2]));
    }

    // 3. Khung gỗ sồi bo viền từng ô ruộng (giúp mỗi ô đất nổi bật, rõ ràng)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < PLOT.cols; c++) {
        const p = plotPos(r, c), hs = 0.98;
        P.push(
          bake(B(2.02, 0.18, 0.1, 0.03), W, [p.x, 0.12, p.z - hs]),
          bake(B(2.02, 0.18, 0.1, 0.03), W, [p.x, 0.12, p.z + hs]),
          bake(B(0.1, 0.18, 1.86, 0.03), W, [p.x - hs, 0.12, p.z]),
          bake(B(0.1, 0.18, 1.86, 0.03), W, [p.x + hs, 0.12, p.z]),
          bake(Cy(0.07, 0.075, 0.26, 6), W2, [p.x - hs, 0.16, p.z - hs]),
          bake(Cy(0.07, 0.075, 0.26, 6), W2, [p.x + hs, 0.16, p.z - hs]),
          bake(Cy(0.07, 0.075, 0.26, 6), W2, [p.x - hs, 0.16, p.z + hs]),
          bake(Cy(0.07, 0.075, 0.26, 6), W2, [p.x + hs, 0.16, p.z + hs])
        );
      }
    }

    // 4. Hàng rào gỗ bao quanh Khu Ruộng (tự động dãn dài theo số hàng `rows`)
    const addFenceSeg = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.3) return;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(bx - ax, bz - az);
      P.push(
        bake(B(0.09, 0.09, len, 0.025), W, [mx, 0.56, mz], [0, ang, 0]),
        bake(B(0.09, 0.09, len, 0.025), W, [mx, 0.30, mz], [0, ang, 0])
      );
      const steps = Math.max(1, Math.round(len / 2.2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
        P.push(
          bake(B(0.16, 0.74, 0.16, 0.04), W2, [px, 0.37, pz]),
          bake(S(0.09, 6, 5), W, [px, 0.77, pz])
        );
      }
    };

    // Cổng Bắc (chừa lối vào rộng 2.4m ở chính giữa cx)
    const gateHalf = 1.25;
    addFenceSeg(x0, z0, cx - gateHalf, z0);
    addFenceSeg(cx + gateHalf, z0, x1, z0);
    // Cạnh Nam (liền mạch, dịch dần xuống phía Nam khi mở rộng ruộng)
    addFenceSeg(x0, z1, x1, z1);
    // Cạnh Tây (liền mạch)
    addFenceSeg(x0, z0, x0, z1);
    // Cạnh Đông (chừa lối đi rộng 2.1m ở giữa cz thông ra đường chính)
    if (d > 4.6) {
      addFenceSeg(x1, z0, x1, cz - 1.05);
      addFenceSeg(x1, cz + 1.05, x1, z1);
    }

    // 5. Cổng Vòm Gỗ "Khu Ruộng" ở lối vào phía Bắc
    P.push(
      bake(Cy(0.12, 0.14, 2.55, 8), W2, [cx - gateHalf, 1.28, z0]),
      bake(Cy(0.12, 0.14, 2.55, 8), W2, [cx + gateHalf, 1.28, z0]),
      bake(B(gateHalf * 2 + 0.7, 0.2, 0.34, 0.05), W2, [cx, 2.58, z0]),
      bake(B(gateHalf * 2 + 0.95, 0.14, 0.46, 0.04), W, [cx, 2.72, z0])
    );

    // 6. 4 Cột đèn lồng ấm áp ở 4 góc Khu Ruộng
    for (const [lx, lz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      P.push(
        bake(Cy(0.09, 0.11, 1.45, 7), W2, [lx, 0.72, lz]),
        bake(Co(0.22, 0.16, 4), 0x3b322c, [lx, 1.62, lz], [0, Math.PI / 4, 0])
      );
      Bulbs.push(bake(S(0.12, 7, 5), 0xffe699, [lx, 1.46, lz]));
    }

    // 7. Thùng nước tưới bằng gỗ + Kệ hạt giống trang trí đầu Khu Ruộng
    const bx = x0 + 0.68, bz = z0 - 0.58;
    P.push(
      bake(Cy(0.38, 0.34, 0.72, 12), W, [bx, 0.36, bz]),
      bake(To(0.36, 0.03, 5, 14), 0x4a4a52, [bx, 0.52, bz], [Math.PI / 2, 0, 0]),
      bake(To(0.35, 0.03, 5, 14), 0x4a4a52, [bx, 0.22, bz], [Math.PI / 2, 0, 0]),
      bake(Cy(0.32, 0.32, 0.04, 10), 0x4fc3f7, [bx, 0.68, bz])
    );
    const sx = x1 - 0.68, sz = z0 - 0.55;
    P.push(
      bake(B(0.75, 0.42, 0.55, 0.05), W, [sx, 0.21, sz]),
      bake(S(0.18, 7, 5), 0xd8b278, [sx - 0.14, 0.48, sz], [0, 0, 0], [1, 1.2, 0.85]),
      bake(S(0.16, 7, 5), 0x7bc96a, [sx + 0.16, 0.45, sz])
    );

    // 8. Nếu chưa mở tối đa: vẽ khung cọc gỗ quy hoạch hàng ruộng tiếp theo ở phía Nam để thấy rõ hướng mở rộng!
    if (rows < PLOT.maxRows) {
      const nextZ = PLOT.z0 + rows * PLOT.sp;
      for (let c = 0; c < PLOT.cols; c++) {
        const px = PLOT.x0 + c * PLOT.sp;
        P.push(
          bake(B(1.75, 0.05, 1.75, 0.02), 0x8d6e4c, [px, 0.02, nextZ]),
          bake(Cy(0.045, 0.05, 0.32, 5), W2, [px - 0.82, 0.16, nextZ - 0.82]),
          bake(Cy(0.045, 0.05, 0.32, 5), W2, [px + 0.82, 0.16, nextZ - 0.82]),
          bake(Cy(0.045, 0.05, 0.32, 5), W2, [px - 0.82, 0.16, nextZ + 0.82]),
          bake(Cy(0.045, 0.05, 0.32, 5), W2, [px + 0.82, 0.16, nextZ + 0.82])
        );
      }
    }

    this.borderGroup.add(M(merge(P), MAT.lit), M(merge(Bulbs), MAT.bulb, { cast: false, receive: false }));

    // Bảng tên trên cổng vòm tự động cập nhật tổng số ô ruộng hiện tại
    const totalPlots = rows * PLOT.cols;
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.55, 0.68),
      new THREE.MeshBasicMaterial({
        map: signTexture(`Khu Ruộng (${totalPlots} ô)`, { bg: '#fff5e0', fg: '#5c3c20', icon: '🌱', w: 512, h: 140 }),
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

  update(dt, st, t) {
    const rows = st.farm.plotRows, rain = st.world.weather === 'rain' || st.world.weather === 'storm', wt = st.world.t;
    const activeCount = rows * PLOT.cols;
    this.soil.count = activeCount;
    this.furrows.count = activeCount;
    if (this.borderRows !== rows) { this.borderRows = rows; this.buildBorder(rows); }
    for (let r = 0; r < rows; r++) for (let c = 0; c < PLOT.cols; c++) {
      const i = r * PLOT.cols + c, id = plotId(r, c), cr = st.crops[id], wet = cr && (cr.w > wt || rain), sig = cr ? (wet ? 'w' : 't') : 'g';
      if (this.sig[i] === sig) continue; this.sig[i] = sig; const p = plotPos(r, c);
      // Mặt đất nền trong khung gỗ
      _p.set(p.x, sig === 'g' ? 0.02 : 0.08, p.z);
      _s.set(1, sig === 'g' ? 0.65 : 1, 1);
      this.soil.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
      this.soil.setColorAt(i, _c.setHex(sig === 'g' ? 0xa47d55 : sig === 'w' ? 0x432714 : 0x7e4f2b));
      // Luống đất cày nổi khối 3D (chỉ hiện khi đã cuốc 't' hoặc đã tưới 'w')
      if (sig === 'g') {
        _p.set(p.x, -2, p.z); _s.set(0.001, 0.001, 0.001);
      } else {
        _p.set(p.x, 0.04, p.z); _s.set(1, 1, 1);
      }
      this.furrows.setMatrixAt(i, _m.compose(_p, _q.identity(), _s));
      this.furrows.setColorAt(i, _c.setHex(sig === 'w' ? 0x3b2110 : 0x8e5a32));
      this.soil.instanceMatrix.needsUpdate = true;
      this.furrows.instanceMatrix.needsUpdate = true;
      if (this.soil.instanceColor) this.soil.instanceColor.needsUpdate = true;
      if (this.furrows.instanceColor) this.furrows.instanceColor.needsUpdate = true;
    }
    // cây trồng
    const seen = new Set(); const ripe = [];
    for (const id in st.crops) {
      const c = st.crops[id]; if (!c.crop) continue; seen.add(id);
      const stage = c.s === 'ripe' ? 2 : c.g >= 0.4 ? 1 : 0, sig = c.crop + stage; let pl = this.plants.get(id);
      if (!pl) {
        pl = { mesh: new THREE.Mesh(cropGeo(c.crop, stage), this.plantMat), sig, pop: 1 };
        pl.mesh.castShadow = true;
        const p = plotPos(c.r, c.c);
        pl.mesh.position.set(p.x, 0.26, p.z);
        pl.mesh.rotation.y = (c.r * 7 + c.c * 3) % 6;
        this.group.add(pl.mesh);
        this.plants.set(id, pl);
        if (CROPS[c.crop].glow) {
          pl.glow = glowSprite(CROPS[c.crop].c[0], 1.6, 0.0);
          pl.glow.userData.glow = 0;
          pl.glow.position.set(p.x, 0.95, p.z);
          this.group.add(pl.glow);
        }
      } else if (pl.sig !== sig) {
        pl.mesh.geometry = cropGeo(c.crop, stage); pl.sig = sig; pl.pop = 0;
      }
      pl.pop = Math.min(1, pl.pop + dt * 3.5);
      const within = stage === 0 ? c.g / 0.4 : stage === 1 ? (c.g - 0.4) / 0.6 : 1;
      const base = [0.55 + within * 0.45, 0.8 + within * 0.2, 1][stage];
      const pop = pl.pop < 1 ? 1 + Math.sin(pl.pop * Math.PI) * 0.25 : 1;
      pl.mesh.scale.setScalar(base * pop * (stage === 2 ? 1 + Math.sin(t * 3 + c.c) * 0.025 : 1));
      pl.mesh.position.y = 0.26 + (stage === 2 && pl.pop < 1 ? Math.sin(pl.pop * Math.PI) * 0.15 : 0);
      if (pl.glow) { pl.glow.material.opacity = stage === 2 ? 0.55 + 0.25 * Math.sin(t * 3) : 0; pl.glow.visible = stage === 2; }
      if (stage === 2) ripe.push(pl);
    }
    for (const [id, pl] of this.plants) if (!seen.has(id)) { this.group.remove(pl.mesh); if (pl.glow) this.group.remove(pl.glow); this.plants.delete(id); }
    this.sparkT -= dt; if (this.sparkT <= 0 && ripe.length) { this.sparkT = 0.9; const pl = ripe[(Math.random() * ripe.length) | 0]; this.ctx.fx.burst('sparkle', pl.mesh.position.x + (Math.random() - 0.5) * 0.5, 1.2, pl.mesh.position.z, 1); }
    if (this.ring.visible) { this.ring.material.opacity = 0.65 + 0.3 * Math.sin(t * 6); this.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.03); }
  }
}
