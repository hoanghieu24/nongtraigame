import * as THREE from 'three';
import { buildAnimal, animateAnimal, buildEggNest } from '../art/AnimalModels.js';
import { iconSprite } from '../art/Icons.js';
import { nameTexture, spriteOf } from '../art/Kit.js';
import { ANIMALS } from '../data/animals.js';
import { ITEMS } from '../data/items.js';
import { groundY, PENS } from '../data/layout.js';
import { damp, dampAngle, wrapPi, lerp } from '../core/util.js';

const yAt = (x, z) => (z > 150 ? 0 : groundY(x, z));
export class AnimalView {
  constructor(ctx) {
    this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group);
    this.rigs = new Map(); this.incMeshes = new Map(); this.zT = 0;
  }
  make(a) {
    const isBaby = (a.growth ?? 1) < 0.85;
    const rig = buildAnimal(a.type, !!a.golden, isBaby);
    rig.golden = !!a.golden; rig.baby = isBaby;
    rig.vx = a.x; rig.vz = a.z; rig.vr = a.r;
    rig.root.position.set(a.x, yAt(a.x, a.z), a.z);
    this.group.add(rig.root);
    const label = isBaby ? `🐣 ${a.name}` : a.name;
    const nm = spriteOf(nameTexture(label, isBaby ? '#ffe066' : '#fff'), 2.35, 0.56);
    nm.visible = false; nm.position.y = rig.r * 2.2 + 0.42; rig.name = nm; rig.labelStr = label;
    rig.root.add(nm);
    return rig;
  }
  update(dt, st, t, focus, camera) {
    this.group.visible = focus.z < 150;
    if (!this.group.visible) return;
    const seen = new Set();
    for (const id in st.animals) {
      const a = st.animals[id]; seen.add(id); let rig = this.rigs.get(id);
      const isBaby = (a.growth ?? 1) < 0.85;
      if (rig && (rig.golden !== !!a.golden || rig.baby !== isBaby)) {
        this.removeRig(rig); rig = null;
      }
      if (!rig) { rig = this.make(a); this.rigs.set(id, rig); }
      const prevX = rig.vx, prevZ = rig.vz;
      const far = Math.hypot(a.x - rig.vx, a.z - rig.vz) > 6;
      rig.vx = far ? a.x : damp(rig.vx, a.x, 11, dt);
      rig.vz = far ? a.z : damp(rig.vz, a.z, 11, dt);
      rig.vr = dampAngle(rig.vr, a.r, 12, dt);
      const spd = far ? 0 : Math.hypot(rig.vx - prevX, rig.vz - prevZ) / Math.max(dt, 1e-3);
      rig.root.position.set(rig.vx, yAt(rig.vx, rig.vz), rig.vz);
      rig.root.rotation.y = rig.vr;
      const d2 = (rig.vx - focus.x) ** 2 + (rig.vz - focus.z) ** 2, range = this.ctx.gfx?.q.cullDist || 30, near = d2 < range * range;
      rig.root.visible = near;
      if (!near) continue;
      rig.scale = lerp(0.58, 1, Math.min(1, a.growth ?? 1)) * (ANIMALS[a.type].scale || 1);
      let look = 0;
      if (a.st === 'funny' && a.sub === 'stare') look = Math.max(-1.1, Math.min(1.1, wrapPi(Math.atan2(camera.position.x - rig.vx, camera.position.z - rig.vz) - rig.vr)));
      animateAnimal(rig, a.st, a.sub, dt, spd, look);
      if (rig.glow) { rig.glow.material.opacity = 0.45 + 0.25 * Math.sin(t * 3); rig.glow.visible = true; }
      const label = isBaby ? `🐣 ${a.name}` : a.name;
      if (rig.labelStr !== label) {
        rig.name.material.map.dispose();
        rig.name.material.map = nameTexture(label, isBaby ? '#ffe066' : '#fff');
        rig.labelStr = label;
      }
      rig.name.visible = d2 < 8 * 8;
      // Hiển thị ổ rơm + quả trứng 3D dưới gà/vịt khi đã đẻ trứng hoặc đang ấp
      if (rig.nest) {
        rig.nest.visible = !!(a.ready || a.sub === 'incubate');
      }
      // Biểu tượng nổi: sản phẩm sẵn sàng / đang ấp / đói
      const want = a.sub === 'incubate' ? '🐣' : a.ready && ANIMALS[a.type].prod ? ITEMS[ANIMALS[a.type].prod.item].icon : a.hunger > 0.75 && a.type !== 'dog' ? '🍽️' : '';
      if (want !== rig.iconKey) {
        if (rig.icon) { rig.root.remove(rig.icon); rig.icon.material.dispose(); }
        rig.icon = want ? iconSprite(want, 0.85) : null;
        rig.iconKey = want;
        if (rig.icon) rig.root.add(rig.icon);
      }
      if (rig.icon) { rig.icon.visible = d2 < 18 * 18; rig.icon.position.y = rig.r * 2.3 + 0.9 + Math.sin(t * 3 + a.x) * 0.1; }
     
    }
    for (const [id, rig] of this.rigs) if (!seen.has(id)) { this.removeRig(rig); this.rigs.delete(id); }

    // Hiển thị quả trứng 3D rung lắc ấm áp trong Lò Ấp Trứng của Chuồng Gà / Ao Vịt
    for (const pen of ['coop', 'duck']) {
      const P = PENS[pen], inc = st.buildings[pen]?.inc;
      let m = this.incMeshes.get(pen);
      if (inc && P?.inc) {
        if (m && m.userData.incGolden !== !!inc.golden) { this.ctx.world.removeStatic(m); m = null; }
        if (!m) {
          m = buildEggNest(!!inc.golden);
          m.userData.incGolden = !!inc.golden;
          m.scale.setScalar(1.35);
          this.group.add(m);
          this.incMeshes.set(pen, m);
        }
        m.visible = (P.inc.x - focus.x) ** 2 + (P.inc.z - focus.z) ** 2 < 30 * 30;
        m.position.set(P.inc.x, yAt(P.inc.x, P.inc.z) + 0.42, P.inc.z);
        m.rotation.z = Math.sin(t * 9) * 0.12;
        m.rotation.x = Math.cos(t * 7) * 0.08;
      } else if (m) {
        m.visible = false;
      }
    }
  }
  removeRig(rig) {
    rig.name.material.map.dispose();
    this.ctx.world.removeStatic(rig.root);
  }
}
