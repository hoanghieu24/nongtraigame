import * as THREE from 'three';
import { buildFurniture } from '../art/FurnitureModels.js';
import { bake, merge, B, S, Cy, Co, M, MAT, canvasTex, signTexture, glowSprite } from '../art/Kit.js';
import { FURN, FLOORS, WALLS, LIGHTS } from '../data/furniture.js';
import { INTERIOR, interiorRoom, HOME_KITCHEN, groundY } from '../data/layout.js';

const W2k = 0xc99a6a, WOOD_DARK = 0x7a4e2d, WOOD_WARM = 0xb58352, TRIM = 0xfff8ee;

const floorTex = (kind, hex) => canvasTex(512, 512, (c) => {
  const col = '#' + new THREE.Color(hex).getHexString(), dark = (a) => `rgba(45,25,10,${a})`, light = (a) => `rgba(255,248,235,${a})`;
  c.fillStyle = col; c.fillRect(0, 0, 512, 512);
  if (kind === 'wood' || kind === 'plank') {
    for (let i = 0; i < 8; i++) {
      const y = i * 64;
      c.fillStyle = i % 2 ? light(0.05) : dark(0.04); c.fillRect(0, y, 512, 64);
      // Vân gỗ tự nhiên
      c.strokeStyle = dark(0.07); c.lineWidth = 2;
      for (let g = 0; g < 5; g++) { c.beginPath(); c.moveTo(0, y + 10 + g * 11); c.bezierCurveTo(170, y + 6 + g * 12, 340, y + 14 + g * 10, 512, y + 10 + g * 11); c.stroke(); }
      c.strokeStyle = dark(0.22); c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke();
      for (let k = 0; k < 2; k++) { const x = ((i * 173 + k * 241) % 460) + 26; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 64); c.stroke(); }
    }
  } else if (kind === 'tile') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      c.fillStyle = (i + j) % 2 ? light(0.08) : dark(0.03); c.fillRect(i * 128 + 4, j * 128 + 4, 120, 120);
    }
    c.strokeStyle = dark(0.18); c.lineWidth = 5;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 128, 0); c.lineTo(i * 128, 512); c.moveTo(0, i * 128); c.lineTo(512, i * 128); c.stroke(); }
  } else if (kind === 'check') {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) { c.fillStyle = 'rgba(255,255,255,.58)'; c.fillRect(i * 64, j * 64, 64, 64); }
  } else {
    for (let i = 0; i < 1600; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.09)'; c.fillRect(Math.random() * 512, Math.random() * 512, 4, 4); }
  }
});

export class FurnitureView {
  constructor(ctx) {
    this.ctx = ctx; this.out = new THREE.Group(); this.room = new THREE.Group(); this.room.position.set(INTERIOR.ox, 0, INTERIOR.oz); ctx.scene.add(this.out, this.room);
    this.items = new Map(); this.roomKey = ''; this.roomBody = new THREE.Group(); this.room.add(this.roomBody); this.fitems = new THREE.Group(); this.room.add(this.fitems);
    this.light = new THREE.PointLight(0xffd9a0, 0, 28, 1.2); this.light.position.set(0, 3.3, 0); this.room.add(this.light);
    this.fireLight = new THREE.PointLight(0xff8c42, 0, 14, 1.5); this.room.add(this.fireLight);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(48, 48, 0.2, 32), new THREE.MeshLambertMaterial({ color: 0x78be62 })); ground.position.y = -0.22; ground.receiveShadow = true; this.room.add(ground);
    this.ghost = null; this.ghostKey = ''; this.sel = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, depthWrite: false })); this.sel.visible = false; this.sel.renderOrder = 4; ctx.scene.add(this.sel);
    this.walls = {};
  }

  buildWindow(P, Win, x, y, z, ry = 0, curtainCol = 0xff9ab0) {
    const c = Math.cos(ry), s = Math.sin(ry), rot = [0, ry, 0], pos = (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c];
    Win.push(bake(B(1.65, 1.45, 0.08, 0.03), 0xfff8e7, pos(0, 0, 0), rot));
    P.push(
      bake(B(1.95, 0.12, 0.16, 0.04), TRIM, pos(0, 0.78, 0.05), rot),
      bake(B(1.95, 0.12, 0.2, 0.04), WOOD_WARM, pos(0, -0.76, 0.07), rot),
      bake(B(0.12, 1.56, 0.14, 0.03), TRIM, pos(-0.86, 0, 0.05), rot),
      bake(B(0.12, 1.56, 0.14, 0.03), TRIM, pos(0.86, 0, 0.05), rot),
      bake(B(0.06, 1.45, 0.12, 0.02), TRIM, pos(0, 0, 0.05), rot),
      bake(B(1.65, 0.06, 0.12, 0.02), TRIM, pos(0, 0.05, 0.05), rot),
      bake(B(0.42, 1.52, 0.12, 0.05), curtainCol, pos(-0.92, -0.02, 0.11), rot),
      bake(B(0.42, 1.52, 0.12, 0.05), curtainCol, pos(0.92, -0.02, 0.11), rot)
    );
  }

  buildRoom(st) {
    const lvl = st.farm.houseLevel, r = interiorRoom(lvl), fl = FLOORS[st.house.floor], wl = WALLS[st.house.wall], li = LIGHTS[st.house.light];
    this.roomBody.clear(); this.lightInt = li.int; this.light.color.setHex(li.color);
    this.roomDim = r;
    const tex = floorTex(st.house.floor, fl.color); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(r.w / 3.5, r.d / 3.5);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(r.w + 0.4, 0.22, r.d + 0.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 }));
    floor.position.y = -0.11; floor.receiveShadow = true; this.roomBody.add(floor);

    const H = 3.7, T = 0.32;
    // ---- 1. BỨC TƯỜNG BẮC (North Wall: z = -r.d/2) + Khu Bếp & Cửa sổ ----
    const PN = [], WN = [];
    PN.push(
      bake(B(r.w + 0.64, H, T, 0.06), wl.color, [0, H / 2, -r.d / 2 - T / 2]),
      bake(B(r.w + 0.1, 0.92, 0.09, 0.03), WOOD_WARM, [0, 0.46, -r.d / 2 + 0.04]), // ốp chân tường gỗ (wainscoting)
      bake(B(r.w + 0.1, 0.16, 0.12, 0.03), TRIM, [0, 0.94, -r.d / 2 + 0.05]),
      bake(B(r.w + 0.2, 0.18, 0.14, 0.03), WOOD_DARK, [0, H - 0.08, -r.d / 2 + 0.05]), // phào trần
      bake(Cy(0.22, 0.24, H + 0.1, 8), WOOD_DARK, [-r.w / 2, H / 2, -r.d / 2]),
      bake(Cy(0.22, 0.24, H + 0.1, 8), WOOD_DARK, [r.w / 2, H / 2, -r.d / 2])
    );
    this.buildWindow(PN, WN, -0.8, 2.25, -r.d / 2 + 0.02, 0, 0xff9ab0);
    // Khu Bếp sang trọng (Tủ lạnh, Bếp đôi, Bồn rửa, Máy hút mùi, Kệ gia vị)
    const kx = HOME_KITCHEN.x, kz = -r.d / 2 + 0.72;
    PN.push(
      // Tủ bếp chính
      bake(B(2.8, 0.96, 1.25, 0.06), 0xf5ead4, [kx, 0.48, kz]),
      bake(B(2.92, 0.1, 1.35, 0.04), 0xeae0cc, [kx, 1.0, kz]),
      // Bếp từ / bếp ga đôi + nồi súp
      bake(Cy(0.28, 0.28, 0.04, 14), 0x2c2c34, [kx - 0.65, 1.07, kz]),
      bake(Cy(0.28, 0.28, 0.04, 14), 0x2c2c34, [kx + 0.05, 1.07, kz]),
      bake(Cy(0.26, 0.22, 0.36, 12), 0xe05a47, [kx - 0.65, 1.28, kz]),
      bake(Cy(0.28, 0.28, 0.05, 12), 0xd04a38, [kx - 0.65, 1.48, kz]),
      // Bồn rửa inox + vòi nước
      bake(B(0.75, 0.06, 0.65, 0.02), 0x9aa4b0, [kx + 0.85, 1.04, kz]),
      bake(Cy(0.03, 0.03, 0.32, 6), 0xcfd6df, [kx + 0.85, 1.22, kz - 0.24]),
      // Máy hút mùi & kệ treo tường
      bake(B(2.4, 0.32, 0.68, 0.05), W2k, [kx - 0.2, 2.85, -r.d / 2 + 0.36]),
      bake(B(0.8, 0.85, 0.45, 0.04), 0xd8dee6, [kx - 0.3, 3.3, -r.d / 2 + 0.25]),
      // Tủ lạnh cao bên trái bếp
      bake(B(1.1, 2.25, 1.15, 0.08), 0xf4f7fa, [kx - 2.05, 1.13, kz]),
      bake(B(0.06, 0.55, 0.06, 0.02), 0x9aa4b0, [kx - 1.62, 1.6, kz + 0.58]),
      bake(B(0.06, 0.55, 0.06, 0.02), 0x9aa4b0, [kx - 1.62, 0.85, kz + 0.58])
    );
    this.northWall = new THREE.Group();
    this.northWall.add(M(merge(PN), MAT.lit), M(merge(WN), MAT.window, { cast: false, receive: false }));
    this.roomBody.add(this.northWall);

    // ---- 2. BỨC TƯỜNG TÂY (West Wall: x = -r.w/2) + Lò sưởi gạch ấm cúng & Cửa sổ ----
    const PW = [], WW = [];
    PW.push(
      bake(B(T, H, r.d + 0.32, 0.06), wl.color, [-r.w / 2 - T / 2, H / 2, 0]),
      bake(B(0.09, 0.92, r.d, 0.03), WOOD_WARM, [-r.w / 2 + 0.04, 0.46, 0]),
      bake(B(0.12, 0.16, r.d, 0.03), TRIM, [-r.w / 2 + 0.05, 0.94, 0]),
      bake(B(0.14, 0.18, r.d + 0.2, 0.03), WOOD_DARK, [-r.w / 2 + 0.05, H - 0.08, 0])
    );
    // Lò sưởi gạch đỏ (Fireplace) ở tường Tây
    const fz = -1.6, fx = -r.w / 2 + 0.45;
    PW.push(
      bake(B(0.95, 1.65, 2.1, 0.06), 0xb85242, [fx, 0.82, fz]),
      bake(B(1.1, 0.18, 2.35, 0.05), WOOD_DARK, [fx + 0.04, 1.72, fz]),
      bake(B(0.65, 2.0, 1.1, 0.05), 0xa84838, [fx - 0.1, 2.68, fz]),
      bake(B(0.5, 0.85, 1.1, 0.04), 0x2a1e1a, [fx + 0.26, 0.45, fz]),
      bake(Cy(0.1, 0.1, 0.8, 6), 0x5a3822, [fx + 0.3, 0.18, fz], [0.2, 0, 0]),
      bake(S(0.24, 7, 6), 0xff6b2b, [fx + 0.32, 0.34, fz], [0, 0, 0], [0.8, 1.3, 1.1]),
      bake(S(0.16, 6, 5), 0xffd23f, [fx + 0.36, 0.42, fz], [0, 0, 0], [0.8, 1.4, 0.9])
    );
    this.fireLight.position.set(fx + 0.8, 0.8, fz);
    this.buildWindow(PW, WW, -r.w / 2 + 0.02, 2.15, r.d * 0.24, Math.PI / 2, 0x8fd3e8);
    this.westWall = new THREE.Group();
    this.westWall.add(M(merge(PW), MAT.lit), M(merge(WW), MAT.window, { cast: false, receive: false }));
    this.roomBody.add(this.westWall);

    // ---- 3. BỨC TƯỜNG ĐÔNG (East Wall: x = +r.w/2) + 2 Cửa sổ nắng ấm ----
    const PE = [], WE = [];
    PE.push(
      bake(B(T, H, r.d + 0.32, 0.06), wl.color, [r.w / 2 + T / 2, H / 2, 0]),
      bake(B(0.09, 0.92, r.d, 0.03), WOOD_WARM, [r.w / 2 - 0.04, 0.46, 0]),
      bake(B(0.12, 0.16, r.d, 0.03), TRIM, [r.w / 2 - 0.05, 0.94, 0]),
      bake(B(0.14, 0.18, r.d + 0.2, 0.03), WOOD_DARK, [r.w / 2 - 0.05, H - 0.08, 0])
    );
    this.buildWindow(PE, WE, r.w / 2 - 0.02, 2.15, -r.d * 0.22, -Math.PI / 2, 0xffb87a);
    this.buildWindow(PE, WE, r.w / 2 - 0.02, 2.15, r.d * 0.22, -Math.PI / 2, 0xffb87a);
    this.eastWall = new THREE.Group();
    this.eastWall.add(M(merge(PE), MAT.lit), M(merge(WE), MAT.window, { cast: false, receive: false }));
    this.roomBody.add(this.eastWall);

    // ---- 4. BỨC TƯỜNG NAM (South Wall: z = +r.d/2) — ĐẦY ĐỦ BỨC TƯỜNG THỨ 4 + CỬA CHÍNH + CỬA SỔ + BẢNG NÂNG CẤP NHÀ ----
    const PS = [], WS = [], sz = r.d / 2 + T / 2, sideW = (r.w - 2.2) / 2;
    PS.push(
      // Hai mảng tường hai bên cửa chính + mảng tường phía trên cửa
      bake(B(sideW + 0.32, H, T, 0.06), wl.color, [-r.w / 2 + sideW / 2 - 0.16, H / 2, sz]),
      bake(B(sideW + 0.32, H, T, 0.06), wl.color, [r.w / 2 - sideW / 2 + 0.16, H / 2, sz]),
      bake(B(2.4, H - 2.55, T, 0.06), wl.color, [0, 2.55 + (H - 2.55) / 2, sz]),
      // Ốp chân tường gỗ & phào chỉ mặt trong bức tường thứ 4
      bake(B(sideW, 0.92, 0.09, 0.03), WOOD_WARM, [-r.w / 2 + sideW / 2, 0.46, r.d / 2 - 0.04]),
      bake(B(sideW, 0.92, 0.09, 0.03), WOOD_WARM, [r.w / 2 - sideW / 2, 0.46, r.d / 2 - 0.04]),
      bake(B(sideW, 0.16, 0.12, 0.03), TRIM, [-r.w / 2 + sideW / 2, 0.94, r.d / 2 - 0.05]),
      bake(B(sideW, 0.16, 0.12, 0.03), TRIM, [r.w / 2 - sideW / 2, 0.94, r.d / 2 - 0.05]),
      bake(B(r.w + 0.2, 0.18, 0.14, 0.03), WOOD_DARK, [0, H - 0.08, r.d / 2 - 0.05]),
      // Cột trụ góc Nam
      bake(Cy(0.22, 0.24, H + 0.1, 8), WOOD_DARK, [-r.w / 2, H / 2, r.d / 2]),
      bake(Cy(0.22, 0.24, H + 0.1, 8), WOOD_DARK, [r.w / 2, H / 2, r.d / 2]),
      // Khung cửa chính & cánh cửa gỗ sang trọng
      bake(B(0.22, 2.65, 0.38, 0.04), TRIM, [-1.15, 1.32, r.d / 2]),
      bake(B(0.22, 2.65, 0.38, 0.04), TRIM, [1.15, 1.32, r.d / 2]),
      bake(B(2.6, 0.24, 0.4, 0.04), TRIM, [0, 2.62, r.d / 2]),
      bake(B(2.1, 2.5, 0.16, 0.05), 0x8a5432, [0, 1.25, r.d / 2 + 0.02]),
      bake(B(0.75, 0.9, 0.2, 0.03), 0x6f4124, [-0.46, 1.72, r.d / 2 + 0.01]),
      bake(B(0.75, 0.9, 0.2, 0.03), 0x6f4124, [0.46, 1.72, r.d / 2 + 0.01]),
      bake(B(0.75, 0.85, 0.2, 0.03), 0x6f4124, [-0.46, 0.65, r.d / 2 + 0.01]),
      bake(B(0.75, 0.85, 0.2, 0.03), 0x6f4124, [0.46, 0.65, r.d / 2 + 0.01]),
      bake(S(0.08, 6, 5), 0xffd23f, [0.78, 1.18, r.d / 2 - 0.1]), // tay nắm cửa đồng vàng
      // Bảng quy hoạch / nâng cấp nhà gắn cạnh cửa
      bake(B(1.4, 0.95, 0.08, 0.03), WOOD_DARK, [-2.1, 1.65, r.d / 2 - 0.06]),
      bake(B(1.22, 0.78, 0.09, 0.02), 0xfff4dc, [-2.1, 1.65, r.d / 2 - 0.07])
    );
    this.buildWindow(PS, WS, -r.w * 0.33, 2.15, r.d / 2 - 0.02, Math.PI, 0xff9ab0);
    this.buildWindow(PS, WS, r.w * 0.33, 2.15, r.d / 2 - 0.02, Math.PI, 0xff9ab0);
    this.southWall = new THREE.Group();
    this.southWall.add(M(merge(PS), MAT.lit), M(merge(WS), MAT.window, { cast: false, receive: false }));
    const upgSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.45),
      new THREE.MeshBasicMaterial({ map: signTexture('Nâng cấp Nhà', { bg: '#fff4dc', fg: '#7a4a2b', icon: '🏠', w: 512, h: 184 }), transparent: true })
    );
    upgSign.position.set(-2.1, 1.65, r.d / 2 - 0.13);
    upgSign.rotation.y = Math.PI;
    this.southWall.add(upgSign);
    this.roomBody.add(this.southWall);

    // Thảm chùi chân chào mừng ở cửa (luôn hiện trên sàn)
    const matMesh = M(merge([
      bake(B(2.2, 0.04, 1.05, 0.02), 0xc98a52, [0, 0.02, r.d / 2 - 0.65]),
      bake(B(1.9, 0.045, 0.8, 0.02), 0xe6b87a, [0, 0.025, r.d / 2 - 0.65])
    ]), MAT.lit);
    this.roomBody.add(matMesh);

    // ---- 5. DẦM GỖ TRẦN NHÀ, ĐÈN CHÙM & TRẦN KÍN (hiển thị tuyệt đẹp khi ở góc nhìn thứ nhất FP) ----
    const PC = [], BC = [];
    for (let z = -r.d / 2 + 2; z < r.d / 2; z += 3.2) {
      PC.push(bake(B(r.w + 0.1, 0.18, 0.22, 0.03), WOOD_DARK, [0, H - 0.05, z]));
    }
    // Đèn chùm gỗ & bóng đèn ấm giữa nhà
    PC.push(
      bake(Cy(0.04, 0.04, 0.65, 6), WOOD_DARK, [0, H - 0.32, 0]),
      bake(Cy(0.65, 0.65, 0.08, 12), WOOD_WARM, [0, H - 0.65, 0])
    );
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      BC.push(bake(S(0.11, 7, 5), 0xffe9b0, [Math.cos(a) * 0.58, H - 0.72, Math.sin(a) * 0.58]));
    }
    this.ceilingBeams = new THREE.Group();
    this.ceilingBeams.add(M(merge(PC), MAT.lit), M(merge(BC), MAT.bulb, { cast: false, receive: false }));
    this.ceilingRoof = new THREE.Mesh(new THREE.BoxGeometry(r.w + 0.5, 0.18, r.d + 0.5), new THREE.MeshLambertMaterial({ color: 0xf5e9d4 }));
    this.ceilingRoof.position.y = H + 0.08;
    this.ceilingRoof.visible = false;
    this.roomBody.add(this.ceilingBeams, this.ceilingRoof);
  }

  update(dt, st, t, localArea, camTarget) {
    const key = `${st.farm.houseLevel}|${st.house.floor}|${st.house.wall}|${st.house.light}`;
    if (key !== this.roomKey) { this.roomKey = key; this.buildRoom(st); }
    const inHouse = localArea === 'house';
    this.room.visible = inHouse;
    this.light.visible = inHouse;
    this.fireLight.visible = inHouse;
    this.light.intensity = inHouse ? (this.lightInt || 1) * 24 : 0;
    this.fireLight.intensity = inHouse ? (10 + Math.sin(t * 11) * 2.5 + Math.cos(t * 17) * 1.5) : 0;

    // Hiển thị đủ cả 4 bức tường:
    // - Ở góc nhìn thứ nhất (FP): cả 4 bức tường (Bắc, Nam, Đông, Tây) + dầm trần + mái trần hiển thị đầy đủ 100% cao 3.7m, không bao giờ mất tường!
    // - Ở góc nhìn thứ ba (3D): cả 4 bức tường vẫn hiển thị, chỉ bức tường nằm ngay sát hướng camera mới tự động hạ thấp dạng cutaway (cao ~28%) để không che tầm nhìn!
    if (inHouse && this.southWall) {
      const isFP = this.ctx.world?.gfx ? (document.getElementById('app')?.dataset.view === 'FP') : false;
      this.ceilingRoof.visible = isFP;
      this.ceilingBeams.visible = isFP;
      if (isFP) {
        this.northWall.scale.y = 1;
        this.southWall.scale.y = 1;
        this.westWall.scale.y = 1;
        this.eastWall.scale.y = 1;
      } else {
        const cam = this.ctx.scene?.parent || null;
        // Dựa theo vị trí camera tương đối so với tâm phòng (INTERIOR.ox, INTERIOR.oz)
        const camPos = this.ctx.world?.water?.uniforms?.uCam?.value;
        const dx = camPos ? camPos.x - INTERIOR.ox : 0;
        const dz = camPos ? camPos.z - INTERIOR.oz : 12;
        const r = this.roomDim || { w: 12, d: 10 };
        this.southWall.scale.y = dz > r.d * 0.35 ? 0.26 : 1;
        this.northWall.scale.y = dz < -r.d * 0.35 ? 0.26 : 1;
        this.eastWall.scale.y  = dx > r.w * 0.38 ? 0.26 : 1;
        this.westWall.scale.y  = dx < -r.w * 0.38 ? 0.26 : 1;
      }
    }

    const seen = new Set();
    for (const id in st.furniture) {
      const f = st.furniture[id], def = FURN[f.item]; if (!def) continue; seen.add(id); let it = this.items.get(id);
      if (!it || it.item !== f.item) { if (it) it.g.parent.remove(it.g); const g = buildFurniture(f.item); (f.area === 'house' ? this.fitems : this.out).add(g); it = { g, item: f.item, area: f.area }; this.items.set(id, it); if (g.userData.glow) this.ctx.world.sky.registerGlow(g.userData.glow); }
      const y = f.area === 'house' ? 0 : groundY(f.x, f.z); it.g.position.set(f.x, y, f.z); it.g.rotation.y = f.rot * (Math.PI / 2);
      if (f.item === 'fountain' || (it.g.userData.update && (f.area === 'house' ? localArea === 'house' : localArea === 'out' && Math.hypot(f.x - camTarget.x, f.z - camTarget.z) < 40))) it.g.userData.update?.(t);
      if (f.item === 'fountain' && localArea === 'out' && Math.random() < dt * 10) this.ctx.fx.burst('splash', f.x, 1.9, f.z, 1);
    }
    for (const [id, it] of this.items) if (!seen.has(id)) { it.g.parent?.remove(it.g); this.items.delete(id); }
    this.out.visible = localArea === 'out';
  }
  // ---- ghost preview cho chế độ xây ----
  showGhost(item, area, x, z, rot, valid) {
    const def = FURN[item]; if (!def) return;
    if (this.ghostKey !== item) { if (this.ghost) this.ghost.parent?.remove(this.ghost); this.ghost = buildFurniture(item); this.ghost.traverse((o) => { if (o.material && !o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.62; o.material.depthWrite = false; o.castShadow = false; } }); this.ghostKey = item; }
    const host = area === 'house' ? this.fitems : this.out; if (this.ghost.parent !== host) host.add(this.ghost);
    this.ghost.visible = true; this.ghost.position.set(x, area === 'house' ? 0 : groundY(x, z), z); this.ghost.rotation.y = rot * (Math.PI / 2);
    this.ghost.traverse((o) => { if (o.material && !o.isSprite && o.material.color) o.material.color.setHex(valid ? 0xa8ffc0 : 0xff8a8a); });
  }
  hideGhost() { if (this.ghost) this.ghost.visible = false; }
  highlight(id) { const f = this.ctx.store.state.furniture[id]; if (!f) { this.sel.visible = false; return; } this.sel.visible = true; const ox = f.area === 'house' ? INTERIOR.ox : 0, oz = f.area === 'house' ? INTERIOR.oz : 0; this.sel.position.set(ox + f.x, (f.area === 'house' ? 0 : groundY(f.x, f.z)) + 0.08, oz + f.z); this.sel.scale.setScalar(Math.max(FURN[f.item].w, FURN[f.item].d) * 0.8); }
  clearHighlight() { this.sel.visible = false; }
}
