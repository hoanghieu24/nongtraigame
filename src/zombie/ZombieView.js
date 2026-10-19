import * as THREE from 'three';
import { buildCharacter, poseCharacter } from '../art/Characters.js';
import { glowSprite, spriteOf, canvasTex } from '../art/Kit.js';
import { damp, dampAngle } from '../core/util.js';
import { groundY } from '../data/layout.js';

const hpTex = (hp, max) => canvasTex(96, 20, (c) => { c.fillStyle = 'rgba(30,40,20,.65)'; c.fillRect(0, 0, 96, 20); c.fillStyle = '#9be26b'; c.fillRect(3, 3, 90 * Math.max(0, hp / max), 14); });
export class ZombieView {
  constructor(ctx) { this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group); this.map = new Map(); this.t = 0; }
  make(z) {
    const r = buildCharacter({ skin: 0x8fc77a, hair: 0x3d4a2c, style: 'short', outfit: 0x5a4a3a, hat: 'none' });
    r.hpBar = spriteOf(hpTex(z.hp, z.maxHp), 1.5, 0.3); r.hpBar.position.y = 3.2; r.root.add(r.hpBar); r.hpv = z.hp; r.vx = z.x; r.vz = z.z; r.vr = z.r; r.t0 = 0;
    r.glow = glowSprite(0x7aff7a, 2.6, 0.35); r.glow.userData.glow = 0; r.glow.position.y = 1.2; r.root.add(r.glow); this.group.add(r.root); return r;
  }
  update(dt, st, t, localArea) {
    const seen = new Set();
    for (const id in st.zombies) {
      const z = st.zombies[id]; seen.add(id); let r = this.map.get(id); if (!r) { r = this.make(z); this.map.set(id, r); }
      r.vx = damp(r.vx, z.x, 12, dt); r.vz = damp(r.vz, z.z, 12, dt); r.vr = dampAngle(r.vr, z.r, 8, dt); r.root.visible = localArea === 'out';
      r.root.position.set(r.vx, groundY(r.vx, r.vz), r.vz); r.root.rotation.y = r.vr; r.root.scale.setScalar(1);
      if (r.hpv !== z.hp) { r.hpv = z.hp; r.hpBar.material.map = hpTex(z.hp, z.maxHp); }
      let anim = 'zombie';
      if (z.st === 'eat') anim = 'plant'; else if (z.st === 'stun') anim = 'stumble';
      if (z.st === 'dead') { r.t0 += dt; r.root.rotation.x = -Math.min(1.5, r.t0 * 5); anim = 'sad'; }
      if (z.st === 'burn') { r.t0 += dt; r.root.scale.setScalar(Math.max(0.2, 1 - r.t0 * 0.35)); if (Math.random() < dt * 8) this.ctx.fx.burst('smoke', r.vx, 1.5, r.vz, 1); }
      poseCharacter(r, anim, dt, 0.3); r.hpBar.visible = z.st !== 'dead' && z.st !== 'burn'; r.glow.material.opacity = 0.3 + 0.12 * Math.sin(t * 4);
    }
    for (const [id, r] of this.map) if (!seen.has(id)) { this.group.remove(r.root); this.map.delete(id); }
  }
}
