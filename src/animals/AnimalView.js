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
    const seen = new Set(), thing = this.ctx;
    for (const id in st.animals) {
      const a = st.animals[id]; seen.add(id); let rig = this.rigs.get(id);
      const isBaby = (a.growth ?? 1) < 0.85;
      if (rig && (rig.golden !== !!a.golden || rig.baby !== isBaby)) {
        this.group.remove(rig.root); rig = null;
      }
      if (!rig) { rig = this.make(a); this.rigs.set(id, rig); }
      const far = Math.hypot(a.x - rig.vx, a.z - rig.vz) > 6;
      rig.vx = far ? a.x : damp(rig.vx, a.x, 11, dt);
      rig.vz = far ? a.z : damp(rig.vz, a.z, 11, dt);
      rig.vr = dampAngle(rig.vr, a.r, 12, dt);
      const spd = Math.hypot(a.x - rig.vx, a.z - rig.vz) / Math.max(dt, 1e-3);
      rig.root.position.set(rig.vx, yAt(rig.vx, a.z), rig.vz);
      rig.root.rotation.y = rig.vr;
      const d2 = (rig.vx - focus.x) ** 2 + (rig.vz - focus.z) ** 2, near = d2 < 30 * 30;
      rig.root.visible = near;
      if (!near) continue;
      rig.scale = lerp(0.58, 1, Math.min(1, a.growth ?? 1)) * (ANIMALS[a.type].scale || 1);
      let look = 0;
      if (a.st === 'funny' && a.sub === 'stare') look = Math.max(-1.1, Math.min(1.1, wrapPi(Math.atan2(camera.position.x - rig.vx, camera.position.z - rig.vz) - rig.vr)));
      animateAnimal(rig, a.st, a.sub, dt, spd, look);
      if (rig.glow) { rig.glow.material.opacity = 0.45 + 0.25 * Math.sin(t * 3); rig.glow.visible = true; }
      rig.name.visible = d2 < 24 * 24;
      // Hiển thị ổ rơm + quả trứng 3D dưới gà/vịt khi đã đẻ trứng hoặc đang ấp
      if (rig.nest) {
        rig.nest.visible = !!(a.ready || a.sub === 'incubate');
      }
      // Biểu tượng nổi: sản phẩm sẵn sàng / đang ấp / đói
      const want = a.sub === 'incubate' ? '🐣' : a.ready && ANIMALS[a.type].prod ? ITEMS[ANIMALS[a.type].prod.item].icon : a.hunger > 0.75 && a.type !== 'dog' ? '🍽️' : '';
      if (want !== rig.iconKey) {
        if (rig.icon) rig.root.remove(rig.icon);
        rig.icon = want ? iconSprite(want, 0.85) : null;
        rig.iconKey = want;
        if (rig.icon) rig.root.add(rig.icon);
      }
      if (rig.icon) rig.icon.position.y = rig.r * 2.3 + 0.9 + Math.sin(t * 3 + a.x) * 0.1;
     
    }
    for (const [id, rig] of this.rigs) if (!seen.has(id)) { this.group.remove(rig.root); this.rigs.delete(id); }

    // Hiển thị quả trứng 3D rung lắc ấm áp trong Lò Ấp Trứng của Chuồng Gà / Ao Vịt
    for (const pen of ['coop', 'duck']) {
      const P = PENS[pen], inc = st.buildings[pen]?.inc;
      let m = this.incMeshes.get(pen);
      if (inc && P?.inc) {
        if (!m) {
          m = buildEggNest(!!inc.golden);
          m.scale.setScalar(1.35);
          this.group.add(m);
          this.incMeshes.set(pen, m);
        }
        m.visible = true;
        m.position.set(P.inc.x, yAt(P.inc.x, P.inc.z) + 0.42, P.inc.z);
        m.rotation.z = Math.sin(t * 9) * 0.12;
        m.rotation.x = Math.cos(t * 7) * 0.08;
      } else if (m) {
        m.visible = false;
      }
    }
  }
}
