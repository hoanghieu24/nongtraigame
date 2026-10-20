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
    this.fps = 60;
    const probe = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    this.level = pref === 'auto' ? detectQuality(probe) : pref;
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
    // Trên điện thoại, tắt ACESFilmicToneMapping nặng shader mỗi pixel để tăng tốc fill-rate và giữ màu sắc tươi tắn
    this.renderer.toneMapping = this.mobile ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
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
  setPref(pref) { this.pref = pref; this.apply(pref === 'auto' ? detectQuality(this.renderer.getContext()) : pref); }
  apply(level) {
    this.level = level; const q = this.q;
    this.renderer.shadowMap.enabled = q.shadows && !this.mode2D && !this.mobile;
    this.setPixelRatio();
    this.resize();
    for (const fn of this.listeners) fn(q, level);
  }
  setPixelRatio() {
    const q = this.q;
    const cap = this.mobile ? (q.mobilePr || 2.0) : q.pr;
    const dpr = Math.min(window.devicePixelRatio || 1, cap) * (this.mode2D ? 0.92 : 1);
    this.renderer.setPixelRatio(Math.max(1.0, dpr));
  }
  setMode2D(on) { this.mode2D = on; this.renderer.shadowMap.enabled = this.q.shadows && !on && !this.mobile; this.setPixelRatio(); this.resize(); for (const fn of this.listeners) fn(this.q, this.level); }
  resize() {
    const w = VP.vw || this.canvas.clientWidth || window.innerWidth;
    const h = VP.vh || this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    return { w, h };
  }
  // Hạ cấp tự động nhanh nhạy: FPS trung bình < 40 trong ~1.6s => xuống 1 bậc để chống giật lag ngay lập tức
  governor(dt) {
    if (this.warm > 0) { this.warm -= dt; return; }
    this.acc += dt; this.frames++; this.cool -= dt;
    if (this.acc >= 1.6) {
      const fps = this.frames / this.acc;
      this.fps = Math.round(fps);
      this.acc = 0; this.frames = 0;
      if (this.pref === 'auto' && fps < 40 && this.cool <= 0 && this.level !== 'low') {
        this.apply(this.level === 'high' ? 'medium' : 'low');
        this.cool = 4.5; this.warm = 1.2;
        this.onDowngrade?.(this.level, fps);
      }
    }
  }
}

