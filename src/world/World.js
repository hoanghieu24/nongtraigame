import * as THREE from 'three';
import { buildTerrain, upgradeTerrain } from './Terrain.js';
import { expandCost } from '../farming/FarmingSystem.js';
import { HOUSE_LEVELS } from '../data/furniture.js';
import { buildWater } from './Water.js';
import { Sky } from './Sky.js';
import { buildScatter } from './Scatter.js';
import * as Bld from '../art/Buildings.js';
import { buildFurniture } from '../art/FurnitureModels.js';
import { bake, merge, Cy, Co, S, B, To, M, MAT } from '../art/Kit.js';
import { PENS, VILLAGE, SPOTS, HOUSE, REST, AREAS, groundY, terrainH, DOCK, BRIDGE, PLOT } from '../data/layout.js';

// World = phần "cứng" của thế giới (địa hình, công trình, vùng khoá). Không giữ state game, chỉ đọc state để hiển thị.
export class World {
  constructor(gfx, fx) {
    this.gfx = gfx; this.fx = fx; this.scene = gfx.scene; this.wind = { uTime: { value: 0 } };
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.villageGroup = new THREE.Group(); this.group.add(this.villageGroup);
    this.beachGroup = new THREE.Group(); this.group.add(this.beachGroup);
    this.rects = []; this.circles = []; this.dyn = {}; this.dynRects = {}; this.gateG = {}; this.interactables = []; this.windmills = []; this.t = 0; this.smokeT = 0; this.snowK = 0;
    // Trên điện thoại dùng luôn texture địa hình 512px sắc nét ngay từ đầu, tránh chạy upgradeTerrain ngầm gây khựng khung hình lúc mới vào game
    this.terrain = buildTerrain(gfx.level === 'low' ? 384 : 512); this.group.add(this.terrain); if (!gfx.mobile && gfx.level === 'high') upgradeTerrain(this.terrain, 1024);
    const w = buildWater(); this.water = w; this.group.add(w.mesh, w.far);
    this.sky = new Sky(this.scene);
    this.scatter = buildScatter(this.wind, gfx.q); for (const o of this.scatter.objects) this.group.add(o); this.circles.push(...this.scatter.circles);
    this.buildStatic(); this.houseLevel = 0; this.restKey = ''; this.penState = {};
    gfx.onChange((q) => { this.scatter.setQuality(q); this.sky.applyQuality(q, gfx); fx.setCap(q.particles); this.applyMode(gfx.mode2D); });
  }
  place(obj, x, z, ry = 0, y, targetGroup = this.group) { obj.position.set(x, y ?? groundY(x, z), z); obj.rotation.y = ry; targetGroup.add(obj); return obj; }
  addRects(g, x, z, ry = 0) {
    for (const r of g.userData.rects || []) {
      const c = Math.cos(ry), s = Math.sin(ry), pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].map(([px, pz]) => [x + px * c + pz * s, z - px * s + pz * c]);
      this.rects.push({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), z0: Math.min(...pts.map((p) => p[1])), z1: Math.max(...pts.map((p) => p[1])) });
    }
  }
  addStatic(g, x, z, ry = 0, targetGroup = this.group) { this.place(g, x, z, ry, undefined, targetGroup); this.addRects(g, x, z, ry); for (const gl of g.userData.glows || []) this.sky.registerGlow(gl); return g; }
  addInteract(o) { this.interactables.push({ r: 2.6, ...o }); }
  buildStatic() {
    // Lối vào & vật dụng quanh nhà
    this.addStatic(Bld.chest(), SPOTS.chest.x, SPOTS.chest.z);
    this.addStatic(Bld.sellCrate(), SPOTS.crate.x, SPOTS.crate.z);
    this.addStatic(Bld.noticeBoard('Nhiệm vụ'), SPOTS.homeNotice.x, SPOTS.homeNotice.z, 0.08);
    this.addStatic(Bld.well(), SPOTS.well.x, SPOTS.well.z);
    this.addInteract({ id: 'chest', kind: 'chest', x: SPOTS.chest.x, z: SPOTS.chest.z + 1.4, icon: '📦', label: 'Rương chung' });
    this.addInteract({ id: 'crate', kind: 'sell', at: 'crate', x: SPOTS.crate.x, z: SPOTS.crate.z + 1.4, icon: '🪙', label: 'Bán hàng' });
    this.addInteract({ id: 'homeNotice', kind: 'quests', x: SPOTS.homeNotice.x, z: SPOTS.homeNotice.z + 1.4, icon: '📜', label: 'Nhiệm vụ' });
    this.addInteract({ id: 'houseUp', kind: 'houseUp', x: SPOTS.houseUp.x, z: SPOTS.houseUp.z + 1.2, r: 2.7, icon: '🏠', label: 'Nâng cấp & Trang trí Nhà' });

    // Chuồng trại: lưu toạ độ tâm để tự động ẩn (distance cull) các chuồng ở xa chưa nằm trong khung hình camera cận cảnh
    for (const [k, p] of Object.entries(PENS)) {
      const f = Bld.penFence(p, k === 'hutch' ? 0xe8d8b8 : 0xc8955f);
      this.group.add(f);
      this.rects.push(...f.userData.rects);
      // Đã xoá nhà chuồng 3D bên trong chuồng (giảm tải đồ hoạ, chuồng thoáng & dễ nhìn thú hơn)
      this.penGroups ||= {};
      this.penGroups[k] = { hutG: null, fenceG: f, signG: null, cx: (p.x0 + p.x1) * 0.5, cz: (p.z0 + p.z1) * 0.5 };
      this.addInteract({ id: 'gate:' + k, kind: 'gate', pen: k, x: p.gate.x, z: p.gate.z, r: 3.8, icon: p.icon, label: p.name });
      this.addInteract({ id: 'penManage:' + k, kind: 'penManage', pen: k, x: p.hut.x, z: p.hut.z + 2.2, r: 3.8, icon: p.icon, label: `Quản lý ${p.name}` });
      if (p.inc) {
        this.addInteract({ id: 'inc:' + k, kind: 'incubate', pen: k, x: p.inc.x, z: p.inc.z, r: 3.2, icon: '🐣', label: `Ấp trứng (${p.name})` });
      }
    }
    this.expandIt = { id: 'expand', kind: 'expand', x: PLOT.x0 + PLOT.sp, z: PLOT.z0 + PLOT.sp * 2, r: 4.0, icon: '🌾', label: 'Mở rộng Khu Ruộng' }; this.interactables.push(this.expandIt);
    // Cầu tàu + cầu
    this.group.add(Bld.dock(), Bld.bridge());
    this.addInteract({ id: 'dock', kind: 'hint', x: 0, z: 30.4, r: 4, icon: '🎣', label: 'Cầm cần câu (5) rồi nhấn Hành động' });
    // Cối xay gió trên đồi (giữ 1 chiếc chủ đạo, lược bỏ chiếc phụ thừa)
    const wm = Bld.windmill(); this.place(wm, 25, -30, -0.35); this.windmills.push(wm);
    // Làng Hạnh Phúc & Khu Ẩm Thực Ready, Set, Cook! -> gom vào villageGroup để khi người chơi ở Nông Trại (x < 12) thì tắt hoàn toàn draw call của cả ngôi làng!
    const vg = this.villageGroup;
    this.addStatic(Bld.villageArch(), VILLAGE.arch.x, VILLAGE.arch.z, 0, vg);
    for (const k of Object.keys(VILLAGE.shops)) {
      const s = VILLAGE.shops[k], g = Bld.shop(k); this.addStatic(g, s.x, s.z, s.rot, vg);
      const dz = (g.userData.dims.d / 2 + 1.4) * (s.rot ? -1 : 1);
      this.addInteract({ id: 'shop:' + k, kind: 'shop', shop: k, x: s.x, z: s.z + dz, r: 3.2, icon: s.icon, label: s.name });
    }
    const pz = Bld.plaza(); this.addStatic(pz, VILLAGE.plaza.x, VILLAGE.plaza.z, 0, vg); this.fountain = pz.userData.fountain;
    this.addStatic(Bld.marketStall(), SPOTS.market.x, SPOTS.market.z, Math.PI / 2, vg); this.addInteract({ id: 'market', kind: 'sell', at: 'market', x: SPOTS.market.x + 1.9, z: SPOTS.market.z, icon: '🛒', label: 'Bán ở chợ (+10%)' });
    // Làng tối giản: bỏ xe kem, giàn hoa, ghế đá, chậu hoa, cột đèn trang trí để chạy mượt
    this.addStatic(Bld.noticeBoard('Bảng nhiệm vụ'), SPOTS.notice.x, SPOTS.notice.z, 0, vg); this.addInteract({ id: 'notice', kind: 'quests', x: SPOTS.notice.x, z: SPOTS.notice.z + 1.4, icon: '📜', label: 'Bảng nhiệm vụ' });
    this.addStatic(Bld.noticeBoard('Làm thêm: Ready, Set, Cook!', '👨‍🍳', '#ffe9a8', '#8f2d1e'), REST.jobBoard.x, REST.jobBoard.z, 0, vg);
    this.addInteract({ id: 'jobBoard', kind: 'restShift', x: REST.jobBoard.x, z: REST.jobBoard.z + 1.5, r: 3.5, icon: '👨‍🍳', label: 'Làm thêm tại Quán Ăn (Ready, Set, Cook!)' });

    const lamp = (x, z, ry = 0, grp = this.group) => { const l = buildFurniture('streetlamp'); this.place(l, x, z, ry, undefined, grp); if (l.userData.glow) this.sky.registerGlow(l.userData.glow); this.circles.push({ x, z, r: 0.35 }); };
    lamp(-2.1, -6.2, 0.2);
    // Bãi biển -> gom vào beachGroup để chỉ render khi người chơi tiến về phía nam (z > 14)
    const bg = this.beachGroup;
    const para = (x, z, c) => { const g = new THREE.Group(); g.add(M(merge([bake(Cy(0.05, 0.05, 2.4, 5), 0xf0e6d0, [0, 1.2, 0]), bake(Co(1.5, 0.6, 8), c, [0, 2.5, 0]), bake(B(1.6, 0.04, 0.8, 0.02), 0xffffff, [1.8, 0.03, 0.3]), bake(S(0.2, 6, 5), 0xffd23f, [0, 2.85, 0])]), MAT.lit)); this.place(g, x, z, 0.4, undefined, bg); };
    para(14, 46, 0xff7aa2); para(-8, 49, 0x5ac0e8);
    const boat = new THREE.Group(); boat.add(M(merge([bake(B(3.4, 0.5, 1.3, 0.2), 0xb87a45, [0, 0.25, 0]), bake(Cy(0.05, 0.05, 2.2, 5), 0x8a5a3a, [0, 1.4, 0]), bake(Co(0.9, 1.7, 3), 0xffffff, [0.4, 1.7, 0], [0, 0, 0], [0.1, 1, 1])]), MAT.lit)); this.place(boat, -14, 53, 0.5, undefined, bg);
    // Vùng khoá
    this.gates = {};
    for (const [k, a] of Object.entries(AREAS)) { const g = Bld.gateBarrier(k, a), ry = k === 'forest' ? Math.PI / 2 : 0; this.place(g, a.gate.x, a.gate.z, ry); this.gates[k] = g; }
    // Cổng nông trại + biển hiệu
    this.farmSign = Bld.forSale({ name: 'Nông Trại Gia Đình', cost: 0, lvl: 1 }); this.farmSign.visible = false; this.group.add(this.farmSign);
    this.merchant = Bld.merchantCart(); this.merchant.visible = false; this.place(this.merchant, SPOTS.merchant.x + 1.5, SPOTS.merchant.z + 1.5, -0.6); this.addRects(this.merchant, SPOTS.merchant.x + 1.5, SPOTS.merchant.z + 1.5, -0.6); this.sky.registerGlow(this.merchant.children[this.merchant.children.length - 1]);
    this.merchantRects = this.rects.length;
  }
  // đồng bộ phần động theo state (nhà, chuồng, nhà hàng, vùng khoá)
  sync(st) {
    if (this.houseLevel !== st.farm.houseLevel) {
      if (this.houseG) { this.group.remove(this.houseG); this.rects = this.rects.filter((r) => r !== this.houseRect); }
      if (this.houseUpSign) { this.group.remove(this.houseUpSign); this.houseUpSign = null; }
      const g = Bld.house(st.farm.houseLevel), d = g.userData.dims.d, z = -13.4 - d / 2; this.houseLevel = st.farm.houseLevel; this.houseG = g; this.place(g, HOUSE.x, z, 0);
      const wr = g.userData.rects.map((r) => ({ x0: HOUSE.x + r.x0, x1: HOUSE.x + r.x1, z0: z + r.z0, z1: z + r.z1 })); this.rects.push(...wr); this.houseRect = wr[0]; this.houseRects = wr;
      for (const gl of g.userData.glows || []) this.sky.registerGlow(gl); this.chimney = new THREE.Vector3(HOUSE.x + g.userData.smoke.position.x, g.userData.smoke.position.y, z + g.userData.smoke.position.z);
      const nxt = HOUSE_LEVELS[st.farm.houseLevel];
      const hs = Bld.forSale({ name: nxt ? `Nâng cấp: ${nxt.name}` : 'Biệt Thự (Tối đa)', cost: nxt ? nxt.cost : 0, lvl: nxt ? nxt.lvl : 0 }, '🏠');
      hs.scale.setScalar(0.78);
      this.place(hs, SPOTS.houseUp.x, SPOTS.houseUp.z, -0.15);
      this.houseUpSign = hs;
    }
    for (const [k, p] of Object.entries(PENS)) {
      const owned = !!st.buildings[k]?.owned, cur = this.penState[k];
      if (cur === owned) continue;
      this.penState[k] = owned;
      const slot = this.penGroups[k];
      if (slot.signG) { this.group.remove(slot.signG); slot.signG = null; }
      if (!owned) {
        const isRightGate = Math.abs(p.gate.x - p.x1) < 0.1;
        const sx = p.gate.x + (isRightGate ? 1.35 : -1.35), sz = p.gate.z + 1.85;
        const g = Bld.forSale(p, p.icon);
        g.scale.setScalar(0.88);
        this.place(g, sx, sz, isRightGate ? 0.35 : -0.35);
        slot.signG = g;
      }
    }
    for (const [k, p] of Object.entries(PENS)) {
      const b = st.buildings[k], gx = p.gate.x, gz = p.gate.z;
      const isRightGate = Math.abs(gx - p.x1) < 0.1;
      if (!this.gateG[k]) {
        const g = Bld.penGate();
        g.position.set(gx, groundY(gx, gz), gz - 1.35);
        this.group.add(g);
        this.gateG[k] = { g, v: b?.open ? 1 : 0, dir: isRightGate ? -1 : 1 };
      }
      const isOpen = !!(b?.owned && b?.open);
      this.gateG[k].open = isOpen;
      if (isOpen) delete this.dynRects[k];
      else this.dynRects[k] = { x0: gx - 0.28, x1: gx + 0.28, z0: gz - 1.4, z1: gz + 1.4 };
    }
    const rows = st.farm.plotRows;
    if (this.rowsKey !== rows) {
      if (this.expandG) { this.group.remove(this.expandG); this.expandG = null; } this.rowsKey = rows;
      if (rows < PLOT.maxRows) {
        const cx = PLOT.x0 + ((PLOT.cols - 1) * PLOT.sp) / 2;
        const z = PLOT.z0 + (rows - 1) * PLOT.sp + 2.05;
        const g = Bld.forSale({ name: `Mở rộng Khu Ruộng (+${PLOT.cols} ô)`, cost: expandCost(rows), lvl: 0 }, '🌾');
        g.scale.setScalar(0.86);
        this.place(g, cx, z, 0);
        this.expandG = g;
        Object.assign(this.expandIt, { x: cx, z: z - 0.3, off: false });
      } else this.expandIt.off = true;
    }
    for (const [k, g] of Object.entries(this.gates)) { const open = !!st.farm.areas[k]; if (g.visible === open) { g.visible = !open; } }
    const rk = `${st.restaurant.unlocked}:${st.restaurant.stars || 1}`;
    if (this.restKey !== rk) {
      if (this.restG) { this.villageGroup.remove(this.restG); this.rects = this.rects.filter((r) => !this.restRects?.includes(r)); }
      this.restKey = rk;
      const g = Bld.restaurantShell(st.restaurant.stars || 1, st.restaurant.unlocked);
      this.restG = g;
      this.place(g, REST.x, REST.z, 0, undefined, this.villageGroup);
      const before = this.rects.length;
      this.addRects(g, REST.x, REST.z, 0);
      this.restRects = this.rects.slice(before);
      for (const gl of g.userData.glows || []) this.sky.registerGlow(gl);
    }
    this._ar = this.rects.concat(Object.values(this.dynRects));
    const mer = !!st.events.active.some((e) => e.type === 'merchant'); if (this.merchant.visible !== mer) this.merchant.visible = mer;
  }
  applyMode(is2D) { for (const o of this.scatter.objects) if (o.userData.kind === 'grass' || o.userData.kind === 'flower') o.visible = !is2D; this.water.uniforms.uSimple.value = is2D || this.gfx.level !== 'high' ? 1 : 0; }
  // va chạm: đẩy hình tròn ra khỏi hình tròn/hình chữ nhật
  resolve(pos, r) {
    for (let it = 0; it < 2; it++) {
      for (const c of this.circles) { const dx = pos.x - c.x, dz = pos.z - c.z, d2 = dx * dx + dz * dz, rr = r + c.r; if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr; } }
      for (const q of this._ar || this.rects) {
        const cx = Math.max(q.x0, Math.min(pos.x, q.x1)), cz = Math.max(q.z0, Math.min(pos.z, q.z1)), dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) { if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; } else { const l = pos.x - q.x0, rr2 = q.x1 - pos.x, t = pos.z - q.z0, b = q.z1 - pos.z, m = Math.min(l, rr2, t, b); if (m === l) pos.x = q.x0 - r; else if (m === rr2) pos.x = q.x1 + r; else if (m === t) pos.z = q.z0 - r; else pos.z = q.z1 + r; } }
      }
    }
    return pos;
  }
  update(dt, hour, weather, focus, camera, mode2D, time) {
    this.t += dt; this.wind.uTime.value = this.t;
    const indoor = focus.z > 200;
    this.group.visible = !indoor;
    if (!indoor) {
      // Culling thông minh theo vùng: khi ở nông trại (x < 14), ẩn hoàn toàn cụm Làng (x = 36..68) tiết kiệm hàng chục draw call!
      this.villageGroup.visible = mode2D || focus.x > 12;
      this.beachGroup.visible = mode2D || focus.z > 14;
      for (const k in this.penGroups) {
        const pg = this.penGroups[k], d2 = (focus.x - pg.cx) ** 2 + (focus.z - pg.cz) ** 2;
        const vis = mode2D || d2 < 38 * 38;
        pg.fenceG.visible = vis;
        if (pg.signG) pg.signG.visible = vis && d2 < 28 * 28;
        if (this.gateG[k]) this.gateG[k].g.visible = vis;
      }
    }
    for (const k in this.gateG) { const G = this.gateG[k]; if (!G.g.visible) continue; G.v += ((G.open ? 1 : 0) - G.v) * Math.min(1, dt * 7); G.g.userData.door.rotation.y = G.v * (G.dir || 1) * (Math.PI / 2); }
    for (const wm of this.windmills) if (wm.userData.blades) wm.userData.blades.rotation.z -= dt * 0.65;
    this.snowK += ((weather === 'snow' ? 1 : 0) - this.snowK) * Math.min(1, dt * 0.25); this.terrain.material.emissive.setRGB(0.55 * this.snowK, 0.58 * this.snowK, 0.64 * this.snowK); const u = this.water.uniforms; u.uTime.value = this.t; u.uCam.value.copy(camera.position);
    this.sky.update(dt, hour, weather, focus, camera.position, mode2D, indoor);
    u.uFogC.value.copy(this.scene.fog.color); u.uSky.value.copy(this.sky.domeMat.uniforms.uHor.value); u.uSun.value.copy(this.sky.sun.color); u.uFogN.value = this.scene.fog.near; u.uFogF.value = this.scene.fog.far;
    if (!this.gfx.mobile) this.gfx.renderer.toneMappingExposure = this.sky.exposure;
    // Đã bỏ khói ống khói & tia nước đài phun (hiệu ứng thừa gây giật)
  }
}
