import * as THREE from 'three';
import { QUALITY } from './Config.js';
import { VP } from './Viewport.js';

const isMobileDevice = () => matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

// Renderer + preset Low/Medium/High + tối ưu băng thông GPU cho điện thoại Android & iOS đạt 60 FPS mượt mà.
export function detectQuality(gl) {
  const mobile = isMobileDevice();
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  let r = ''; try { const ext = gl?.getExtension('WEBGL_debug_renderer_info'); if (ext) r = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''; } catch { /* ignore */ }
  if (/swiftshader|llvmpipe|software|mali-4|adreno \(tm\) 3|powervr/i.test(r)) return 'low';
  if (mobile) return mem <= 3 || cores <= 4 ? 'low' : 'medium';
  return cores >= 6 && mem >= 6 ? 'high' : 'medium';
}

export class Gfx {
  constructor(canvas, pref = 'auto') {
    this.canvas = canvas; this.pref = pref; this.listeners = [];
    this.mobile = isMobileDevice();
    this.fps = 60; this.renderScale = 1; this.fastWindows = 0;
    const probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    this.level = pref === 'auto' ? detectQuality(probe) : pref;
    // Không giữ một WebGL context phụ chiếm bộ nhớ sau khi dò cấu hình.
    probe?.getExtension('WEBGL_lose_context')?.loseContext();
    // Khử răng cưa (MSAA) rất tốn GPU trên điện thoại -> chỉ bật trên máy tính
    const useAA = !this.mobile && this.level !== 'low';
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: useAA,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });
    // Cùng cách xử lý màu trên điện thoại và máy tính để cỏ, da và quần áo không cháy sáng.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.scene = new THREE.Scene();
    if (!this.mobile && this.level === 'high') this.buildEnvMap();
    this.mode2D = false; this.acc = 0; this.frames = 0; this.warm = 2.0; this.cool = 0;
    this.apply(this.level);
  }
  buildEnvMap() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      const skyGeo = new THREE.SphereGeometry(20, 10, 6);
      const pos = skyGeo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
      const top = new THREE.Color(0x6ec3f5), hor = new THREE.Color(0xfff0d4), bot = new THREE.Color(0x76b85c);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 20;
        if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, 0.7));
        else c.copy(hor).lerp(bot, Math.min(1, -y * 1.4));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      skyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      this.scene.environmentIntensity = 0.38;
      pmrem.dispose();
    } catch { /* ignore on fallback WebGL */ }
  }
  get q() { return QUALITY[this.level] || QUALITY.medium; }
  onChange(fn) { this.listeners.push(fn); fn(this.q, this.level); }
  setPref(pref) { this.pref = pref; this.renderScale = 1; this.fastWindows = 0; this.warm = 2; this.apply(pref === 'auto' ? detectQuality(this.renderer.getContext()) : pref); }
  apply(level) {
    this.level = QUALITY[level] ? level : 'medium'; const q = this.q;
    this.renderer.shadowMap.enabled = q.shadows && !this.mode2D && !this.mobile;
    this.setPixelRatio();
    this.resize();
    for (const fn of this.listeners) fn(q, this.level);
  }
  setPixelRatio() {
    const q = this.q;
    const cap = this.mobile ? (q.mobilePr || 1.25) : q.pr;
    const w = VP.vw || window.innerWidth, h = VP.vh || window.innerHeight;
    const pixelBudget = this.mobile ? 1400000 : 3200000;
    const budgetRatio = Math.sqrt(pixelBudget / Math.max(1, w * h));
    const dpr = Math.min(window.devicePixelRatio || 1, cap, budgetRatio) * this.renderScale;
    this.renderer.setPixelRatio(Math.max(0.65, dpr));
  }
  setMode2D(on) { if (this.mode2D === on) return; this.mode2D = on; this.renderer.shadowMap.enabled = this.q.shadows && !on && !this.mobile; this.setPixelRatio(); this.resize(); for (const fn of this.listeners) fn(this.q, this.level); }
  resize() {
    const w = VP.vw || this.canvas.clientWidth || window.innerWidth;
    const h = VP.vh || this.canvas.clientHeight || window.innerHeight;
    this.setPixelRatio();
    this.renderer.setSize(w, h, false);
    return { w, h };
  }
  // Hạ số pixel trước khi giảm chi tiết; chỉ phục hồi sau nhiều cửa sổ ổn định để tránh nhấp nháy.
  governor(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25 || document.hidden) { this.acc = 0; this.frames = 0; return; }
    if (this.warm > 0) { this.warm -= dt; return; }
    this.acc += dt; this.frames++; this.cool -= dt;
    if (this.acc >= 1.6) {
      const fps = this.frames / this.acc;
      this.fps = Math.round(fps);
      this.acc = 0; this.frames = 0;
      if (this.pref !== 'auto' || this.cool > 0) return;
      if (fps < 45) {
        this.fastWindows = 0;
        if (this.renderScale > 0.8) {
          this.renderScale = Math.max(0.8, this.renderScale - 0.1);
          this.resize();
        } else if (this.level !== 'low') {
          this.renderScale = 1;
          this.apply(this.level === 'high' ? 'medium' : 'low');
          this.onDowngrade?.(this.level, fps);
        } else if (fps < 32 && this.renderScale > 0.7) {
          this.renderScale = 0.7; this.resize();
        }
        this.cool = 3.2; this.warm = 0.5;
      } else if (fps > 57 && this.renderScale < 1) {
        if (++this.fastWindows >= 4) {
          this.renderScale = Math.min(1, this.renderScale + 0.05);
          this.resize(); this.fastWindows = 0; this.cool = 5;
        }
      } else {
        this.fastWindows = 0;
      }
    }
  }
}

