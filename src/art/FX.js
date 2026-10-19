// Hiệu ứng: particles (1 draw call, có pool), chữ nổi DOM (pool), rung camera, confetti.
import * as THREE from 'three';
import { canvasTex } from './Kit.js';

const KINDS = {
  dirt:    { t: 0, col: [0x8a5a35, 0xa77548], vy: [2.5, 5], spread: 2.2, g: 14, life: [0.5, 0.9], size: [0.16, 0.26] },
  water:   { t: 4, col: [0x7fd0ff, 0xbfeaff], vy: [2, 4], spread: 1.5, g: 11, life: [0.5, 0.8], size: [0.2, 0.3] },
  sparkle: { t: 1, col: [0xfff2a0, 0xffffff], vy: [0.8, 2.2], spread: 1.1, g: -1, life: [0.7, 1.1], size: [0.28, 0.45] },
  stars:   { t: 1, col: [0xffe066, 0xffffff], vy: [2, 5], spread: 3.5, g: 4, life: [0.6, 1], size: [0.3, 0.5] },
  coins:   { t: 5, col: [0xffd23f, 0xffb703], vy: [4, 7], spread: 2, g: 14, life: [0.8, 1.2], size: [0.3, 0.4] },
  hearts:  { t: 2, col: [0xff7aa2, 0xffb3c6], vy: [1.2, 2.2], spread: 0.9, g: -0.5, life: [1, 1.5], size: [0.34, 0.5] },
  leaf:    { t: 3, col: [0x7ccf5a, 0xb5e07a], vy: [1.5, 3], spread: 1.8, g: 3, life: [0.8, 1.3], size: [0.22, 0.34] },
  mud:     { t: 7, col: [0x6b4a2f, 0x8a6240], vy: [2, 4], spread: 2.6, g: 11, life: [0.5, 0.9], size: [0.22, 0.34] },
  feather: { t: 6, col: [0xffffff, 0xfff0d6], vy: [2, 4], spread: 2.2, g: 2.5, life: [0.9, 1.4], size: [0.26, 0.38] },
  smoke:   { t: 0, col: [0xdcdcdc, 0xffffff], vy: [0.8, 1.4], spread: 0.2, g: -0.5, life: [1.8, 2.6], size: [0.35, 0.7], grow: 2.2, alpha: 0.5 },
  zzz:     { t: 0, col: [0xbcd7ff, 0xffffff], vy: [0.6, 1], spread: 0.1, g: -0.3, life: [1.2, 1.8], size: [0.3, 0.45], grow: 1.5, alpha: 0.7 },
  splash:  { t: 4, col: [0xffffff, 0xcdeeff], vy: [3, 5], spread: 1.4, g: 12, life: [0.5, 0.8], size: [0.22, 0.32] },
};
const VS = `attribute float aSize; attribute vec4 aCol; attribute float aType; uniform float uScale; uniform float uOrtho; varying vec4 vCol; varying float vType;
void main(){ vCol=aCol; vType=aType; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize = uOrtho>0.5 ? aSize*uScale : aSize*uScale/max(0.1,-mv.z); }`;
const FS = `uniform sampler2D uMap; varying vec4 vCol; varying float vType;
void main(){ vec2 tile=vec2(mod(vType,4.),floor(vType/4.)); vec2 uv=(tile+vec2(gl_PointCoord.x,1.-gl_PointCoord.y))/vec2(4.,2.); vec4 t=texture2D(uMap,uv); if(t.a*vCol.a<0.02) discard; gl_FragColor=vec4(vCol.rgb*t.rgb, t.a*vCol.a); }`;

function atlas() {
  return canvasTex(256, 128, (ctx) => {
    const tile = (i, fn) => { ctx.save(); ctx.translate((i % 4) * 64 + 32, Math.floor(i / 4) * 64 + 32); fn(); ctx.restore(); };
    ctx.fillStyle = '#fff';
    tile(0, () => { const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26); g.addColorStop(0, '#fff'); g.addColorStop(0.7, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 27, 0, 7); ctx.fill(); });
    tile(1, () => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 27, a = (i / 10) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); });
    tile(2, () => { ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-34, -2, -18, -26, 0, -9); ctx.bezierCurveTo(18, -26, 34, -2, 0, 22); ctx.fill(); });
    tile(3, () => { ctx.beginPath(); ctx.ellipse(0, 0, 11, 24, 0.6, 0, 7); ctx.fill(); });
    tile(4, () => { ctx.beginPath(); ctx.moveTo(0, -26); ctx.bezierCurveTo(22, 2, 18, 24, 0, 24); ctx.bezierCurveTo(-18, 24, -22, 2, 0, -26); ctx.fill(); });
    tile(5, () => { ctx.beginPath(); ctx.arc(0, 0, 23, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); });
    tile(6, () => { ctx.beginPath(); ctx.ellipse(0, 0, 9, 26, -0.5, 0, 7); ctx.fill(); });
    tile(7, () => { ctx.beginPath(); ctx.ellipse(0, 0, 24, 20, 0, 0, 7); ctx.fill(); });
  });
}

export class FX {
  constructor(scene, ui) {
    this.scene = scene; this.ui = ui; this.max = 900; this.cap = 900; this.n = 0; this.head = 0;
    const N = this.max;
    this.pos = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.maxLife = new Float32Array(N);
    this.size0 = new Float32Array(N); this.grow = new Float32Array(N); this.g = new Float32Array(N); this.alpha = new Float32Array(N);
    this.c0 = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aType = new THREE.BufferAttribute(new Float32Array(N), 1);
    geo.setAttribute('position', this.aPos); geo.setAttribute('aSize', this.aSize); geo.setAttribute('aCol', this.aCol); geo.setAttribute('aType', this.aType);
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, uniforms: { uMap: { value: atlas() }, uScale: { value: 500 }, uOrtho: { value: 0 } } });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 10; scene.add(this.points);
    this.shake = 0; this.floats = []; this._tmp = new THREE.Vector3();
  }
  setCap(n) { this.cap = Math.min(this.max, n); }
  burst(kind, x, y, z, n = 8) {
    const k = KINDS[kind] || KINDS.sparkle, r = (a, b) => a + Math.random() * (b - a), c = new THREE.Color();
    n = Math.max(1, Math.round(n * (this.cap / this.max > 0.5 ? 1 : 0.5)));
    for (let j = 0; j < n; j++) {
      const i = this.head; this.head = (this.head + 1) % this.cap; if (i >= this.cap) continue;
      const a = Math.random() * 6.283, sp = r(0, k.spread);
      this.pos.set([x + r(-0.15, 0.15), y, z + r(-0.15, 0.15)], i * 3);
      this.vel.set([Math.cos(a) * sp, r(k.vy[0], k.vy[1]), Math.sin(a) * sp], i * 3);
      this.maxLife[i] = this.life[i] = r(k.life[0], k.life[1]); this.size0[i] = r(k.size[0], k.size[1]); this.grow[i] = k.grow || 0; this.g[i] = k.g; this.alpha[i] = k.alpha || 1;
      c.setHex(Math.random() < 0.5 ? k.col[0] : k.col[1]); this.c0.set([c.r, c.g, c.b], i * 3); this.aType.array[i] = k.t; this.aType.needsUpdate = true;
    }
  }
  // chữ nổi (DOM) bay lên rồi mờ dần
  float(x, y, z, text, color = '#fff') {
    const el = this.ui.floatEl(); if (!el) return;
    el.textContent = text; el.style.color = color; el.style.display = 'block';
    this.floats.push({ el, p: new THREE.Vector3(x, y, z), t: 0, life: 1.5 });
  }
  addShake(a) { this.shake = Math.min(1, this.shake + a); }
  update(dt, camera) {
    const { pos, vel, life, maxLife, aPos, aSize, aCol } = this;
    for (let i = 0; i < this.cap; i++) {
      if (life[i] <= 0) { if (aSize.array[i] !== 0) aSize.array[i] = 0; continue; }
      life[i] -= dt; const f = Math.max(0, life[i] / maxLife[i]);
      vel[i * 3 + 1] -= this.g[i] * dt; vel[i * 3] *= 1 - 1.2 * dt; vel[i * 3 + 2] *= 1 - 1.2 * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] = Math.max(0.05, pos[i * 3 + 1] + vel[i * 3 + 1] * dt); pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      aPos.array[i * 3] = pos[i * 3]; aPos.array[i * 3 + 1] = pos[i * 3 + 1]; aPos.array[i * 3 + 2] = pos[i * 3 + 2];
      aSize.array[i] = this.size0[i] * (this.grow[i] ? 1 + (1 - f) * this.grow[i] : 0.5 + f * 0.5);
      aCol.array[i * 4] = this.c0[i * 3]; aCol.array[i * 4 + 1] = this.c0[i * 3 + 1]; aCol.array[i * 4 + 2] = this.c0[i * 3 + 2]; aCol.array[i * 4 + 3] = Math.min(1, f * 2.2) * this.alpha[i];
    }
    aPos.needsUpdate = aSize.needsUpdate = aCol.needsUpdate = true;
    const h = this.ui.canvasHeight();
    if (camera.isOrthographicCamera) { this.mat.uniforms.uOrtho.value = 1; this.mat.uniforms.uScale.value = h / (camera.top - camera.bottom); }
    else { this.mat.uniforms.uOrtho.value = 0; this.mat.uniforms.uScale.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360)); }
    // chữ nổi
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]; f.t += dt; const k = f.t / f.life;
      if (k >= 1) { this.ui.floatFree(f.el); this.floats.splice(i, 1); continue; }
      this._tmp.copy(f.p); this._tmp.y += k * 1.6; const s = this.ui.project(this._tmp);
      if (!s) { f.el.style.opacity = 0; continue; }
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.6 : 1.2 - Math.min(0.2, (k - 0.12) * 0.5);
      f.el.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%) scale(${pop})`; f.el.style.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    }
    this.shake = Math.max(0, this.shake - dt * 2.4);
  }
}
