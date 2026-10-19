import * as THREE from 'three';
import { bake, merge, S, Cy, Co, Ca, To, B, M, MAT, glowSprite, blob, Lathe } from '../art/Kit.js';
import { iconSprite } from '../art/Icons.js';
import { ITEMS } from '../data/items.js';
import { groundY } from '../data/layout.js';
import { lerp, smooth } from '../core/util.js';

const FG = {
  mushroom: () => merge([bake(Cy(0.07, 0.09, 0.3, 7), 0xf4ead2, [0, 0.15, 0]), bake(S(0.24, 9, 6), 0xe8593f, [0, 0.32, 0], [0, 0, 0], [1, 0.65, 1]), ...[0, 1, 2, 3].map((i) => bake(S(0.04, 4, 3), 0xffffff, [Math.cos(i * 1.6) * 0.13, 0.43, Math.sin(i * 1.6) * 0.13]))]),
  berry: () => merge([blob(0.35, 0x4f9e50, [0, 0.3, 0], [1.1, 0.8, 1.1], 0.12, 2), ...[0, 1, 2, 3, 4].map((i) => bake(S(0.07, 5, 4), 0xe03a4a, [Math.cos(i * 1.3) * 0.3, 0.3 + (i % 2) * 0.12, Math.sin(i * 1.3) * 0.3]))]),
  herb: () => merge([0, 1, 2, 3, 4].map((i) => { const g = Co(0.08, 0.5, 4); g.translate(0, 0.25, 0); return bake(g, i % 2 ? 0x5fc46a : 0x7ad87a, [0, 0, 0], [0, i * 1.3, 0.35], [1, 1, 0.4]); })),
  flower: () => merge([bake(Cy(0.015, 0.02, 0.4, 4), 0x4a9a44, [0, 0.2, 0]), bake(S(0.07, 6, 5), 0xffd23f, [0, 0.42, 0]), ...[0, 1, 2, 3, 4].map((i) => bake(S(0.08, 6, 4), 0xffb0d0, [Math.cos(i * 1.256) * 0.12, 0.42, Math.sin(i * 1.256) * 0.12], [0, 0, 0], [1, 0.4, 1]))]),
  shell: () => merge([bake(S(0.2, 8, 6), 0xffc8d8, [0, 0.1, 0], [0, 0, 0], [1.2, 0.55, 1]), bake(S(0.1, 6, 4), 0xffe3ec, [0, 0.16, 0.05], [0, 0, 0], [1.2, 0.5, 1])]),
  crystal: () => merge([bake(Co(0.14, 0.6, 5), 0x7fe0ff, [0, 0.3, 0]), bake(Co(0.1, 0.4, 5), 0xa8ecff, [0.18, 0.2, 0.05], [0, 0, -0.3]), bake(Co(0.1, 0.35, 5), 0x66d0f0, [-0.15, 0.17, -0.05], [0, 0, 0.4])]),
};
const ufoGeo = () => merge([bake(Lathe([[0, -0.5], [1.2, -0.3], [3, 0], [3.4, 0.25], [2.4, 0.5], [0, 0.6]], 18), 0xb8c0d0), bake(S(1.2, 12, 8), 0x8fe8ff, [0, 0.7, 0], [0, 0, 0], [1, 0.8, 1]), ...Array.from({ length: 8 }, (_, i) => bake(S(0.2, 6, 5), i % 2 ? 0xffe066 : 0xff6ab0, [Math.cos((i / 8) * 6.283) * 2.8, 0.15, Math.sin((i / 8) * 6.283) * 2.8]))]);
export class EventView {
  constructor(ctx) { this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group); this.pick = new Map(); this.forage = new Map(); this.geo = {}; this.sparkT = 0; this.trail = 0;
    this.ufo = null; this.meteor = null; this.crater = null; }
  fg(kind) { return (this.geo[kind] ||= FG[kind]()); }
  update(dt, st, t, focus, localArea) {
    const wt = st.world.t, out = localArea === 'out';
    // vật phẩm rơi
    const seen = new Set();
    for (const id in st.pickups) {
      const d = st.pickups[id]; seen.add(id); let e = this.pick.get(id);
      if (!e) { const g = new THREE.Group(); const sp = iconSprite(ITEMS[d.item]?.icon || '🎁', 1.0), gl = glowSprite(0xfff2a0, 2.4, 0.8); gl.userData.glow = 0; g.add(sp, gl); g.position.set(d.x, groundY(d.x, d.z), d.z); this.group.add(g); e = { g, sp, gl }; this.pick.set(id, e); }
      e.sp.position.y = 1.1 + Math.sin(t * 3 + d.x) * 0.18; e.gl.position.y = 1.0; e.gl.material.opacity = 0.5 + 0.3 * Math.sin(t * 4); e.g.visible = out;
    }
    for (const [id, e] of this.pick) if (!seen.has(id)) { this.group.remove(e.g); this.pick.delete(id); }
    // hái lượm
    const fs = new Set();
    for (const id in st.forage) {
      const f = st.forage[id]; fs.add(id); let m = this.forage.get(id);
      if (!m) { m = new THREE.Mesh(this.fg(f.kind), MAT.lit); m.castShadow = true; m.position.set(f.x, groundY(f.x, f.z), f.z); m.rotation.y = f.x * 3; this.group.add(m); this.forage.set(id, m); }
      m.visible = f.ready && out && (f.x - focus.x) ** 2 + (f.z - focus.z) ** 2 < 55 * 55; m.scale.setScalar(1 + Math.sin(t * 2 + f.x) * 0.04);
    }
    for (const [id, m] of this.forage) if (!fs.has(id)) { this.group.remove(m); this.forage.delete(id); }
    this.sparkT -= dt; if (this.sparkT <= 0) { this.sparkT = 1.1; const near = [...this.forage.entries()].filter(([, m]) => m.visible && (m.position.x - focus.x) ** 2 + (m.position.z - focus.z) ** 2 < 400); if (near.length) { const m = near[(Math.random() * near.length) | 0][1]; this.ctx.fx.burst('sparkle', m.position.x, 0.7, m.position.z, 1); } }
    // UFO + thiên thạch
    const ufoE = st.events.active.find((e) => e.type === 'ufo'), metE = st.events.active.find((e) => e.type === 'meteor');
    if (ufoE) {
      if (!this.ufo) { this.ufo = new THREE.Group(); this.ufo.add(M(ufoGeo(), MAT.lit, { receive: false })); const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.4, 16, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xaaffcc, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = -8; this.ufo.add(beam); this.ufo.userData.beam = beam; const gl = glowSprite(0x9affff, 9, 0.5); gl.userData.glow = 0; this.ufo.add(gl); this.group.add(this.ufo); }
      const k = Math.min(1, (wt - ufoE.t0) / (ufoE.until - ufoE.t0)); this.ufo.position.set(lerp(-75, 75, k), 22 + Math.sin(t * 2) * 0.8, lerp(ufoE.y0, ufoE.y1, k)); this.ufo.rotation.y = t * 2; this.ufo.rotation.z = Math.sin(t * 1.4) * 0.12;
      this.ufo.userData.beam.material.opacity = 0.35 * smooth(0.35, 0.42, k) * (1 - smooth(0.6, 0.66, k));
    } else if (this.ufo) { this.group.remove(this.ufo); this.ufo = null; }
    if (metE) {
      const k = (wt - (metE.impact - 4.4)) / 4.4;
      if (!metE.landed && k >= 0 && k < 1) { if (!this.meteor) { this.meteor = glowSprite(0xffa040, 7, 1); this.meteor.userData.glow = 0; this.group.add(this.meteor); } this.meteor.position.set(metE.x - 40 * (1 - k), 70 * (1 - k) * (1 - k) + 1.5, metE.z - 28 * (1 - k)); this.trail -= dt; if (this.trail <= 0) { this.trail = 0.04; this.ctx.fx.burst('sparkle', this.meteor.position.x, this.meteor.position.y, this.meteor.position.z, 2); } }
      else if (this.meteor) { this.group.remove(this.meteor); this.meteor = null; }
      if (metE.landed) { if (!this.crater) { this.crater = glowSprite(0xff9a50, 5, 0.9); this.crater.userData.glow = 0; this.crater.position.set(metE.x, 0.5, metE.z); this.group.add(this.crater); } this.crater.material.opacity = 0.5 + 0.3 * Math.sin(t * 3); }
    } else { if (this.meteor) { this.group.remove(this.meteor); this.meteor = null; } if (this.crater) { this.group.remove(this.crater); this.crater = null; } }
  }
}
