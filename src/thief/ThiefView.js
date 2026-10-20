import * as THREE from 'three';
import { buildCharacter, poseCharacter } from '../art/Characters.js';
import { M, MAT, bake, B, S, merge, spriteOf, canvasTex } from '../art/Kit.js';
import { damp, dampAngle } from '../core/util.js';
import { groundY } from '../data/layout.js';

const hpTex = (hp, max) => canvasTex(128, 24, (c) => { c.fillStyle = 'rgba(40,30,20,.6)'; c.fillRect(0, 0, 128, 24); c.fillStyle = '#ff6b6b'; c.fillRect(3, 3, 122 * Math.max(0, hp / max), 18); });
export class ThiefView {
  constructor(ctx) { this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group); this.map = new Map(); this.starT = 0; }
  make(t) {
    const r = buildCharacter({ skin: 0xd8a27c, hair: 0x222, style: 'short', outfit: 0x35353f, hat: 'beanie' });
    r.head.add(M(bake(B(0.9, 0.2, 0.1, 0.05), 0x111111, [0, 0.1, 0.52]), MAT.lit)); r.torso.add(M(merge([bake(S(0.34, 8, 6), 0xb89a6a, [0, 0.45, -0.45], [0, 0, 0], [1, 1.15, 0.9]), bake(S(0.08, 5, 4), 0x7a5a3a, [0, 0.8, -0.45])]), MAT.lit));
    r.hpBar = spriteOf(hpTex(t.hp, t.maxHp), 1.8, 0.34); r.hpBar.position.y = 3.2; r.root.add(r.hpBar); r.hpv = t.hp; r.vx = t.x; r.vz = t.z; r.vr = t.r; r.fly = 0; this.group.add(r.root); return r;
  }
  update(dt, st, t, localArea) {
    const seen = new Set();
    for (const id in st.thieves) {
      const th = st.thieves[id]; seen.add(id); let r = this.map.get(id); if (!r) { r = this.make(th); this.map.set(id, r); }
      r.vx = damp(r.vx, th.x, 14, dt); r.vz = damp(r.vz, th.z, 14, dt); r.vr = dampAngle(r.vr, th.r, 12, dt); r.root.visible = localArea === 'out';
      r.root.position.set(r.vx, groundY(r.vx, r.vz), r.vz); r.root.rotation.y = r.vr;
      if (r.hpv !== th.hp) { r.hpv = th.hp; r.hpBar.material.map = hpTex(th.hp, th.maxHp); }
      let anim = th.st === 'sneak' ? 'walk' : th.st === 'steal' ? 'plant' : th.st === 'flee' ? 'run' : th.st === 'stun' ? 'stumble' : 'surprised';
      if (th.st === 'caught') { r.fly += dt; r.root.position.y += r.fly * r.fly * 14; r.root.rotation.y += r.fly * 18; r.root.scale.setScalar(Math.max(0.1, 1 - r.fly * 0.4)); anim = 'surprised'; }
      if (th.st === 'stun' && (this.starT -= dt) < 0) { this.starT = 0.5; this.ctx.fx.burst('stars', r.vx, 3, r.vz, 1); }
      
      poseCharacter(r, anim, dt, th.st === 'flee' ? 0.9 : 0.4); r.hpBar.visible = th.st !== 'caught';
      if (th.st === 'sneak') r.torso.rotation.x = 0.45;
    }
    for (const [id, r] of this.map) if (!seen.has(id)) { this.group.remove(r.root); this.map.delete(id); }
  }
}
