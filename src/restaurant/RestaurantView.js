import * as THREE from 'three';
import { iconSprite } from '../art/Icons.js';
import { bubbleTexture, spriteOf, bake, merge, Cy, S, M, MAT } from '../art/Kit.js';
import { REST, HOME_KITCHEN, INTERIOR, groundY } from '../data/layout.js';
import { RECIPES, RSC_CRATES } from '../data/recipes.js';
import { rscProgress } from './RestaurantSystem.js';

// Hiển thị 3D trực quan cho Quán Ăn "Ready, Set, Cook!":
// - Bàn thớt sơ chế (b0, b1) hiện icon nguyên liệu đang thái / đã thái
// - 3 Bếp nấu (s0, s1, s2) hiện bộ đếm nguyên liệu dạng "🥦 1/2" (như ảnh mẫu), hoặc chảo đang xèo xèo / món đã chín / cảnh báo cháy 🔥
// - Quầy Trả Món màu đỏ cam (passCounter) hiện các đĩa thức ăn chờ bưng ra bàn
// - Bàn Tiệc Oval hiện đĩa thức ăn trước mặt khách đang ăn, hoặc đĩa bẩn + xu tip chờ dọn!
export class RestaurantView {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group();
    ctx.scene.add(this.group);
    this.sprites = new Map();
    this.meshes = new Map();
    this.steam = 0;
  }

  setBadge(key, text, x, y, z, visible = true, w = 2.5, h = 0.82) {
    let e = this.sprites.get(key);
    if (!e || e.text !== text) {
      if (e) this.ctx.scene.remove(e.sp);
      const sp = text.length <= 2 ? iconSprite(text, 1.05) : spriteOf(bubbleTexture(text), w, h);
      this.ctx.scene.add(sp);
      e = { text, sp };
      this.sprites.set(key, e);
    }
    e.sp.position.set(x, y, z);
    e.sp.visible = visible;
  }

  setPlateMesh(key, kind, x, y, z, visible = true) {
    let m = this.meshes.get(key);
    if (!m || m.kind !== kind) {
      if (m) this.group.remove(m.mesh);
      const isDirty = kind === 'dirty';
      const geo = merge([
        bake(Cy(0.32, 0.28, 0.05, 14), isDirty ? 0xc8beb0 : 0xffffff, [0, 0, 0]),
        bake(S(0.16, 8, 6), isDirty ? 0x8d6e63 : 0xff9a4d, [0, 0.09, 0], [0, 0, 0], [1.1, 0.55, 1.1]),
      ]);
      const mesh = M(geo, MAT.lit, { receive: false });
      this.group.add(mesh);
      m = { kind, mesh };
      this.meshes.set(key, m);
    }
    m.mesh.position.set(x, y, z);
    m.mesh.visible = visible;
  }

  update(dt, st, t, localArea) {
    const r = st.restaurant;
    const out = localArea === 'out';
    this.group.visible = out;
    const seen = new Set();
    const seenMesh = new Set();
    this.steam -= dt;

    // 1. Bàn Thớt Sơ Chế (Cutting Boards b0, b1)
    for (const bKey in r.boards || {}) {
      const b = r.boards[bKey], bPos = REST.boards[bKey];
      if (!b || !bPos) continue;
      const k = 'board_' + bKey;
      seen.add(k);
      const def = RSC_CRATES[b.ing];
      const label = b.state === 'chopping' ? `🔪 ${def?.icon || '🥦'}` : `✨ ${def?.prepIcon || '🥗'}`;
      const gy = groundY(bPos.x, bPos.z);
      this.setBadge(k, label, bPos.x, gy + 1.85 + Math.sin(t * 6) * 0.06, bPos.z, out, 2.0, 0.72);
    }

    // 2. Các Bếp Nấu (s0, s1, s2 & bếp nhà home)
    for (const key in r.stations || {}) {
      const s = r.stations[key];
      if (!s) continue;
      const k = 'st_' + key;
      seen.add(k);
      const isHome = key === 'home';
      const stPos = isHome
        ? { x: INTERIOR.ox + HOME_KITCHEN.x, z: INTERIOR.oz + HOME_KITCHEN.z, y: 1.9 }
        : { x: (REST.stoves[key]?.x ?? REST.counter.x), z: (REST.stoves[key]?.z ?? REST.counter.z), y: groundY(REST.x, REST.z) + 2.05 };
      const vis = isHome ? localArea === 'house' : out;

      let label = '🍳';
      if (s.state === 'prep') {
        const prog = rscProgress(s).map((p) => `${p.icon}${p.have}/${p.need}`).join(' ');
        label = `${RECIPES[s.recipe]?.icon || '🍲'} ${prog}`;
      } else if (s.state === 'cooking') {
        const left = Math.max(1, Math.ceil(s.t0 + s.dur - st.world.t));
        label = `${RECIPES[s.recipe]?.icon || '🍳'} ${left}s`;
      } else if (s.state === 'ready') {
        label = s.warned ? `⚠️ ${RECIPES[s.recipe]?.icon || '🍽️'}` : `${RECIPES[s.recipe]?.icon || '🍽️'}`;
      } else if (s.state === 'burning' || s.state === 'burnt') {
        label = '🔥🧯';
        if (this.steam <= 0 && vis) this.ctx.fx.burst('smoke', stPos.x, stPos.y - 0.5, stPos.z, 2);
      }
      this.setBadge(k, label, stPos.x, stPos.y + Math.sin(t * 3.5) * 0.07, stPos.z, vis, 2.5, 0.8);
    }

    // 3. Quầy Trả Món màu đỏ cam (Pass-Through Counter)
    const passList = r.pass || [];
    for (let i = 0; i < passList.length && i < REST.passCounter.slots.length; i++) {
      const item = passList[i], sl = REST.passCounter.slots[i];
      const k = 'pass_' + i;
      seen.add(k); seenMesh.add(k);
      const gy = groundY(sl.x, sl.z);
      this.setPlateMesh(k, 'food', sl.x, gy + 1.28, sl.z, out);
      this.setBadge(k, RECIPES[item.recipe]?.icon || '🍽️', sl.x, gy + 1.85 + Math.sin(t * 3 + i) * 0.06, sl.z, out);
    }

    // 4. Đĩa thức ăn của khách đang ăn & Đĩa bẩn + Tip trên Bàn Tiệc Oval
    const gyOval = groundY(REST.ovalTable.x, REST.ovalTable.z);
    for (const gid in r.guests || {}) {
      const g = r.guests[gid];
      if (g.state === 'eating') {
        const tp = REST.table(g.table), mk = 'eat_' + g.table;
        seenMesh.add(mk);
        this.setPlateMesh(mk, 'food', tp.plateX, gyOval + 1.14, tp.plateZ, out);
      }
    }
    for (const tk in r.dirtyTables || {}) {
      const info = r.dirtyTables[tk], tp = REST.table(+tk);
      const k = 'dirty_' + tk;
      seen.add(k); seenMesh.add(k);
      this.setPlateMesh(k, 'dirty', tp.plateX, gyOval + 1.14, tp.plateZ, out);
      this.setBadge(k, `🪙+${info.tip} 🍽️`, tp.plateX, gyOval + 1.75 + Math.sin(t * 4) * 0.06, tp.plateZ, out, 2.2, 0.72);
    }

    if (this.steam <= 0) this.steam = 0.35;

    for (const [k, e] of this.sprites) {
      if (!seen.has(k)) { this.ctx.scene.remove(e.sp); this.sprites.delete(k); }
    }
    for (const [k, m] of this.meshes) {
      if (!seenMesh.has(k)) { this.group.remove(m.mesh); this.meshes.delete(k); }
    }
  }
}
