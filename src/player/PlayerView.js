import * as THREE from 'three';
import { buildCharacter, setTool, poseCharacter } from '../art/Characters.js';
import { nameTexture, bubbleTexture, spriteOf } from '../art/Kit.js';
import { iconSprite } from '../art/Icons.js';
import { PRESETS, HATS, PLAYER_COLORS } from '../data/characters.js';
import { RECIPES, RSC_CRATES } from '../data/recipes.js';
import { damp, dampAngle } from '../core/util.js';
import { groundY, WATER_Y } from '../data/layout.js';

export const TOOLS = ['hoe', 'can', 'seeds', 'feed', 'rod', 'weapon'];
const yAt = (x, z) => (z > 150 ? 0 : groundY(x, z));

const carryIconOf = (carry) => {
  if (!carry) return '';
  if (carry.startsWith('raw:')) return RSC_CRATES[carry.slice(4)]?.icon || '🥦';
  if (carry.startsWith('prep:')) return RSC_CRATES[carry.slice(5)]?.prepIcon || '🥗';
  if (carry.startsWith('dish_')) return RECIPES[carry.slice(5)]?.icon || '🍽️';
  if (carry === 'dirty_plate') return '🍽️';
  if (carry === 'extinguisher') return '🧯';
  return '🍽️';
};

// Người chơi (local + từ xa): nhân vật, tên, bong bóng chat, cần câu, đồ bưng trên tay (Ready, Set, Cook!).
export class PlayerView {
  constructor(ctx) { this.ctx = ctx; this.group = new THREE.Group(); ctx.scene.add(this.group); this.rigs = new Map(); this.bubbles = new Map();
    this.lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3)); this.lines = new Map(); }
  say(pid, text) { const r = this.rigs.get(pid); if (!r) return; if (r.bubble) r.head.remove(r.bubble); r.bubble = spriteOf(bubbleTexture(text), 3.4, 1.13); r.bubble.position.y = 1.6; r.head.add(r.bubble); r.bubbleT = 4.5; }
  make(p) {
    const preset = PRESETS[p.char.preset % PRESETS.length], rig = buildCharacter({ skin: preset.skin, hair: preset.hair, style: preset.style, outfit: preset.outfit, hat: p.char.hat }); rig.pid = p.id; rig.vx = 0; rig.vz = 0; rig.vr = 0; rig.init = false; rig.glass = false;
    rig.tag = spriteOf(nameTexture(p.name, PLAYER_COLORS[p.slot % 4]), 2.6, 0.65); rig.tag.position.y = 3.15; rig.root.add(rig.tag); rig.tagName = p.name; this.group.add(rig.root); return rig;
  }
  update(dt, st, poses, localId, localArea, t) {
    const seen = new Set();
    for (const pid in st.players) {
      const p = st.players[pid], pose = poses[pid]; if (!p.connected || !pose) continue; seen.add(pid); let rig = this.rigs.get(pid);
      if (rig && (rig.preset !== p.char.preset)) { this.group.remove(rig.root); this.rigs.delete(pid); rig = null; }
      if (!rig) { rig = this.make(p); rig.preset = p.char.preset; this.rigs.set(pid, rig); }
      if (rig.tagName !== p.name) { rig.tag.material.map = nameTexture(p.name, PLAYER_COLORS[p.slot % 4]); rig.tagName = p.name; }
      rig.setHat(p.char.hat);
      const local = pid === localId, far = !rig.init || Math.hypot(pose.x - rig.vx, pose.z - rig.vz) > 8;
      rig.vx = local || far ? pose.x : damp(rig.vx, pose.x, 16, dt); rig.vz = local || far ? pose.z : damp(rig.vz, pose.z, 16, dt); rig.vr = local || far ? pose.rot : dampAngle(rig.vr, pose.rot, 14, dt); rig.init = true;
      rig.root.visible = (pose.area || 'out') === localArea && !(this.hideLocal && local); if (!rig.root.visible) continue;
      const gY = yAt(rig.vx, rig.vz), curY = pose.y ?? gY, airY = Math.max(0, curY - gY);
      rig.root.position.set(rig.vx, curY, rig.vz); rig.root.rotation.y = rig.vr;
      const tool = TOOLS[pose.tool ?? 0]; setTool(rig, p.carry ? 'none' : p.fishing ? 'rod' : tool, p.weapon);
      let anim = pose.anim || 'idle'; if (p.carry && (anim === 'idle' || anim === 'walk' || anim === 'run')) anim = 'carry';
      if (p.fishing && (anim === 'idle' || anim === 'walk')) anim = p.fishing.phase === 'reel' ? 'reel' : 'fish';
      poseCharacter(rig, anim, dt, pose.spd || 0, airY);
      // Hiển thị icon nguyên liệu / món ăn người chơi đang bưng trên tay
      const cIc = carryIconOf(p.carry);
      if (rig.carryIconKey !== cIc) {
        if (rig.carrySp) { rig.carry.remove(rig.carrySp); rig.carrySp = null; }
        rig.carryIconKey = cIc;
        if (cIc) { rig.carrySp = iconSprite(cIc, 0.85); rig.carrySp.position.set(0, 0.55, 0); rig.carry.add(rig.carrySp); }
      }
      if (rig.bubble && (rig.bubbleT -= dt) <= 0) { rig.head.remove(rig.bubble); rig.bubble = null; }
      this.fishLine(pid, p, rig, t);
    }
    for (const [pid, rig] of this.rigs) if (!seen.has(pid)) { this.group.remove(rig.root); this.rigs.delete(pid); this.removeLine(pid); }
  }
  removeLine(pid) { const l = this.lines.get(pid); if (l) { this.group.remove(l.line, l.bob); this.lines.delete(pid); } }
  fishLine(pid, p, rig, t) {
    const f = p.fishing; let l = this.lines.get(pid);
    if (!f || !rig.root.visible) { if (l) { l.line.visible = false; l.bob.visible = false; } return; }
    if (!l) { const g = this.lineGeo.clone(); l = { line: new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })), bob: new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a4a })) }; l.line.frustumCulled = false; this.group.add(l.line, l.bob); this.lines.set(pid, l); }
    l.line.visible = l.bob.visible = true; const dx = Math.sin(rig.vr), dz = Math.cos(rig.vr), bx = rig.vx + dx * 3.6, bz = rig.vz + dz * 3.6, dip = f.phase === 'bite' ? -0.25 + Math.sin(t * 40) * 0.05 : Math.sin(t * 2) * 0.03;
    l.bob.position.set(bx, WATER_Y + 0.08 + dip, bz); const tip = [rig.vx + dx * 1.8, rig.root.position.y + 2.5, rig.vz + dz * 1.8], arr = l.line.geometry.attributes.position.array;
    arr.set(tip, 0); arr.set([(tip[0] + bx) / 2, (tip[1] + WATER_Y) / 2 - 0.4, (tip[2] + bz) / 2], 3); l.line.geometry.setDrawRange(0, 2); l.line.geometry.attributes.position.needsUpdate = true; arr.set([bx, WATER_Y + 0.1, bz], 3);
  }
  head(pid) { return this.rigs.get(pid)?.root; }
}
