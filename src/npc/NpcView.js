import * as THREE from 'three';
import { buildCharacter, poseCharacter } from '../art/Characters.js';
import { buildAnimal, animateAnimal } from '../art/AnimalModels.js';
import { iconSprite } from '../art/Icons.js';
import { nameTexture, spriteOf, M, MAT, bake, B, S, merge } from '../art/Kit.js';
import { NPCS, CUSTOMERS } from '../data/npcs.js';
import { RECIPES } from '../data/recipes.js';
import { REST, groundY, SPOTS } from '../data/layout.js';
import { damp, dampAngle, lerp } from '../core/util.js';

// NPC làng + khách nhà hàng (ngồi quanh Bàn Tiệc Oval lớn đúng chuẩn Ready, Set, Cook!) + thương nhân du hành
export class NpcView {
  constructor(ctx) { this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group); this.npcs = new Map(); this.guests = new Map(); this.merchant = null; }
  makeNpc(id, def) {
    const rig = buildCharacter({ ...def.look, scale: def.scale || 1 }); rig.vx = rig.vz = rig.vr = 0; rig.init = false;
    const tag = spriteOf(nameTexture(def.name, '#ffe9a8'), 3.0, 0.75); tag.position.y = 3.15; rig.root.add(tag); this.group.add(rig.root);
    if (id === 'delivery') rig.root.add(M(merge([bake(B(0.7, 0.55, 0.6, 0.08), 0xd9a441, [0, 1.0, -0.6]), bake(S(0.12, 6, 5), 0xff6f4d, [0, 1.4, -0.6])]), MAT.lit));
    return rig;
  }
  update(dt, st, t, focus, camera, localArea) {
    const near = (x, z, R = 32) => (x - focus.x) ** 2 + (z - focus.z) ** 2 < R * R;
    for (const id in st.npcs) {
      const n = st.npcs[id], def = NPCS[id]; if (!def) continue; let rig = this.npcs.get(id); if (!rig) { rig = this.makeNpc(id, def); this.npcs.set(id, rig); }
      const far = !rig.init || Math.hypot(n.x - rig.vx, n.z - rig.vz) > 6; rig.vx = far ? n.x : damp(rig.vx, n.x, 10, dt); rig.vz = far ? n.z : damp(rig.vz, n.z, 10, dt); rig.vr = dampAngle(rig.vr, n.r, 10, dt); rig.init = true;
      rig.root.visible = localArea === 'out' && near(rig.vx, rig.vz, 32); if (!rig.root.visible) continue;
      rig.root.position.set(rig.vx, groundY(rig.vx, rig.vz), rig.vz); rig.root.rotation.y = rig.vr;
      const pl = this.ctx.localPos, close = pl && Math.hypot(pl.x - rig.vx, pl.z - rig.vz) < 5;
      poseCharacter(rig, n.st === 'scared' ? 'scared' : n.st === 'walk' ? (id === 'kid' ? 'run' : 'walk') : close ? 'wave' : 'idle', dt, n.st === 'walk' ? 0.4 : 0);
    }
    // thương nhân du hành (đứng cạnh xe)
    const mer = st.events.active.some((e) => e.type === 'merchant');
    if (mer && !this.merchant) { const r = buildCharacter({ skin: 0xe4b08a, hair: 0x2c1f18, style: 'beard', outfit: 0x8a5ac8, hat: 'cowboy' }); const tag = spriteOf(nameTexture('Thương nhân', '#e0c8ff'), 3.0, 0.75); tag.position.y = 3.2; r.root.add(tag); r.root.position.set(SPOTS.merchant.x - 0.8, 0, SPOTS.merchant.z + 1.2); r.root.rotation.y = 0.6; this.group.add(r.root); this.merchant = r; this.ctx.world.interactables.push({ id: 'merchant', kind: 'shop', shop: 'merchant', x: SPOTS.merchant.x - 0.4, z: SPOTS.merchant.z + 2.4, r: 3.5, icon: '🧳', label: 'Thương nhân du hành' }); }
    if (!mer && this.merchant) { this.group.remove(this.merchant.root); this.merchant = null; this.ctx.world.interactables = this.ctx.world.interactables.filter((i) => i.id !== 'merchant'); }
    if (this.merchant) {
      this.merchant.root.visible = localArea === 'out' && near(SPOTS.merchant.x, SPOTS.merchant.z, 32);
      if (this.merchant.root.visible) poseCharacter(this.merchant, Math.sin(t) > 0.7 ? 'wave' : 'idle', dt);
    }
    this.guestsUpdate(dt, st, t, localArea, near);
  }
  guestPos(g, wt) {
    const tp = REST.table(g.table);
    const seat = { x: tp.seatX ?? tp.x - 1.15, z: tp.seatZ ?? tp.z };
    const face = tp.face ?? Math.PI / 2;
    const k = Math.min(1, (wt - g.t0) / 3.5);
    if (g.state === 'walk_in') return { x: lerp(REST.entrance.x, seat.x, k), z: lerp(REST.entrance.z, seat.z, k), face: Math.atan2(seat.x - REST.entrance.x, seat.z - REST.entrance.z), moving: k < 1, seated: false, seat };
    if (g.state === 'leaving') return { x: lerp(seat.x, REST.entrance.x, k), z: lerp(seat.z, REST.entrance.z + 2.5, k), face: Math.atan2(REST.entrance.x - seat.x, REST.entrance.z + 2.5 - seat.z), moving: k < 1, seated: false, seat };
    return { x: seat.x, z: seat.z, face, moving: false, seated: true, seat };
  }
  guestsUpdate(dt, st, t, localArea, near) {
    const seen = new Set(), wt = st.world.t;
    const nearRest = localArea === 'out' && near(REST.x, REST.z, 40);
    for (const id in st.restaurant.guests) {
      const g = st.restaurant.guests[id], def = CUSTOMERS[g.kind]; seen.add(id); let e = this.guests.get(id);
      if (!nearRest) { if (e) e.rig.root.visible = false; continue; }
      if (!e) { const rig = def.animal ? buildAnimal(def.animal) : buildCharacter({ ...def.look, scale: def.scale || 1 }); if (def.animal) rig.root.scale.setScalar(def.animal === 'pig' ? 0.9 : 1); this.group.add(rig.root); e = { rig, animal: !!def.animal, bubble: null, key: '' }; this.guests.set(id, e); }
      const p = this.guestPos(g, wt), r = e.rig;
      r.root.visible = near(p.x, p.z, 32);
      if (!r.root.visible) continue;
      r.root.position.set(p.x, groundY(p.x, p.z) + (p.seated && !e.animal ? 0.12 : 0), p.z); r.root.rotation.y = p.face;
      if (e.animal) animateAnimal(r, p.moving ? 'walk' : p.seated ? 'idle' : 'idle', '', dt, 1, 0);
      else poseCharacter(r, p.moving ? 'walk' : g.state === 'eating' ? 'harvest' : g.angry ? 'sad' : p.seated ? 'sit' : 'idle', dt, 0.4);
      const key = g.state === 'seated' ? RECIPES[g.dish]?.icon : g.state === 'eating' ? '😋' : g.state === 'leaving' ? (g.angry ? '💢' : '💖') : '';
      if (key !== e.key) { if (e.bubble) r.root.remove(e.bubble); e.bubble = key ? iconSprite(key, 1.0) : null; e.key = key; if (e.bubble) r.root.add(e.bubble); }
      if (e.bubble) e.bubble.position.y = (e.animal ? 2.0 : 3.2) + Math.sin(t * 3) * 0.08;
    }
    for (const [id, e] of this.guests) if (!seen.has(id)) { this.group.remove(e.rig.root); this.guests.delete(id); }
  }
}
