import * as THREE from 'three';
import { MAT } from '../art/Kit.js';
import { smooth, clamp, lerp, mulberry32 } from '../core/util.js';

const K = (h, top, hor, sun, sunI, hs, hg, hi, fog, cloud, ex = 1.1) => ({ h, top: new THREE.Color(top), hor: new THREE.Color(hor), sun: new THREE.Color(sun), sunI, hs: new THREE.Color(hs), hg: new THREE.Color(hg), hi, fog: new THREE.Color(fog), cloud: new THREE.Color(cloud), ex });
const KEYS = [
  K(0,    0x0e1736, 0x26335f, 0x8fa6ff, 0.45, 0x4a5a98, 0x1c2640, 0.65, 0x1d2a52, 0x3a4770, 0.98),
  K(5,    0x2b3b7a, 0xf0a08a, 0xffa57a, 0.62, 0xc9a8c8, 0x4a5a58, 0.62, 0xe8a894, 0xd8a0a0, 1.04),
  K(6.8,  0x5caef2, 0xffe4be, 0xffd296, 1.65, 0xfff0dc, 0x7cb05e, 1.02, 0xffe6cc, 0xfff2e6, 1.12),
  K(9,    0x4da8f0, 0xdff2ff, 0xfff5e0, 2.15, 0xebf7ff, 0x84bd64, 1.08, 0xdff2ff, 0xffffff, 1.14),
  K(15,   0x4da8f0, 0xdff2ff, 0xfff5e0, 2.15, 0xebf7ff, 0x84bd64, 1.08, 0xdff2ff, 0xffffff, 1.14),
  K(17.6, 0x5ea2e8, 0xffe0b0, 0xffc67a, 1.75, 0xfff0dc, 0x96b874, 1.08, 0xffe8cc, 0xfff0dc, 1.10),
  K(19.2, 0x5260b0, 0xff9a78, 0xff8a60, 0.98, 0xffc4ac, 0x8a7a8a, 0.98, 0xffb69a, 0xffb8a8, 1.04),
  K(20.8, 0x1f2a5c, 0x6a5a8c, 0x9aa8ff, 0.48, 0x5a68a8, 0x2a3248, 0.65, 0x39406e, 0x56608c, 0.99),
  K(24,   0x0e1736, 0x26335f, 0x8fa6ff, 0.45, 0x4a5a98, 0x1c2640, 0.65, 0x1d2a52, 0x3a4770, 0.98),
];
const RAIN = { top: new THREE.Color(0x7d8fa0), hor: new THREE.Color(0xb7c3cc), fog: new THREE.Color(0xaab6c0), cloud: new THREE.Color(0x8f9aa6) };
const DOME_VS = `varying vec3 vP; void main(){ vP=position; vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; }`;
const DOME_FS = `uniform vec3 uTop,uHor,uBot,uSunDir,uSunCol; uniform float uSunK; varying vec3 vP;
void main(){ vec3 n=normalize(vP); float y=n.y; vec3 col=mix(uHor,uTop,smoothstep(0.0,0.62,y)); col=mix(col,uBot,smoothstep(0.0,-0.35,y));
  float sd=max(dot(n,uSunDir),0.0); col+=uSunCol*(pow(sd,90.0)*0.95+pow(sd,6.0)*0.22)*uSunK; gl_FragColor=vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Tái sử dụng biến tạm cố định để KHÔNG cấp phát bộ nhớ (Zero GC allocation) mỗi frame
const _b = new THREE.Color(), _top = new THREE.Color(), _hor = new THREE.Color(), _fog = new THREE.Color();
const _sunC = new THREE.Color(), _hs = new THREE.Color(), _hg = new THREE.Color(), _cloud = new THREE.Color();
const _cBot = new THREE.Color(0x7aa88a), _cFogW = new THREE.Color(0xe9eef0), _cWhite = new THREE.Color(0xffffff), _cHorF = new THREE.Color(0xdfe6ea);
const _dir = new THREE.Vector3(), _pd = new THREE.Vector3(), _md = new THREE.Vector3();
const _mat = new THREE.Matrix4(), _quat = new THREE.Quaternion(), _scl = new THREE.Vector3(), _pos = new THREE.Vector3();

export class Sky {
  constructor(scene) {
    this.scene = scene; this.glows = []; this.rain = 0; this.night = 0; this.hour = 9; this.rainK = 0;
    this.hemi = new THREE.HemisphereLight(0xeaf6ff, 0x86b866, 1.05); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3dc, 2.1); this.sun.castShadow = true; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.035;
    const sc = this.sun.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20; sc.near = 2; sc.far = 110; scene.add(this.sun, this.sun.target);
    scene.fog = new THREE.Fog(0xdff2ff, 38, 112);
    this.domeMat = new THREE.ShaderMaterial({ vertexShader: DOME_VS, fragmentShader: DOME_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color(0x9ac7a0) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSunK: { value: 1 } } });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(110, 14, 10), this.domeMat); this.dome.renderOrder = -10; this.dome.frustumCulled = false; scene.add(this.dome);
    // sao
    const r = mulberry32(5), sp = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) { const a = r() * 6.283, e = Math.acos(r() * 0.95), R = 102; sp[i * 3] = Math.sin(e) * Math.cos(a) * R; sp[i * 3 + 1] = Math.cos(e) * R; sp[i * 3 + 2] = Math.sin(e) * Math.sin(a) * R; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); this.stars.frustumCulled = false; this.stars.renderOrder = -9; scene.add(this.stars);
    // mặt trăng
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(5.5, 16), new THREE.MeshBasicMaterial({ color: 0xf4f1d8, fog: false, transparent: true, depthWrite: false })); this.moon.renderOrder = -8; this.moon.frustumCulled = false; scene.add(this.moon);
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(6.5, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c0, fog: false, transparent: true, depthWrite: false })); this.sunDisc.renderOrder = -8; scene.add(this.sunDisc);
    this.buildClouds(); this.buildRain();
    this.snowN = 180; this.snowSeed = Array.from({ length: this.snowN }, () => [Math.random() * 36 - 18, Math.random() * 20, Math.random() * 36 - 18, Math.random() * 6.28]);
    const sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.snowN * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.snowMesh = new THREE.Points(sg2, new THREE.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false })); this.snowMesh.frustumCulled = false; this.snowMesh.visible = false; this.snowMesh.renderOrder = 9; scene.add(this.snowMesh); this.flash = 0; this.dropK = 0; this.fogK = 0; this.snowK = 0;
  }
  buildClouds() {
    const puff = [[0, 0, 0, 5], [5, -0.6, 1, 4], [-5, -0.5, -0.5, 4], [2, 2.2, 0, 3.6], [-2.4, 1.6, 1, 3.2], [8, -1.2, 0, 2.6]];
    const base = new THREE.SphereGeometry(1, 7, 5);
    const geos = puff.map(([x, y, z, r]) => { const g = base.clone().scale(r * 1.15, r * 0.72, r); g.translate(x, y, z); g.deleteAttribute('uv'); return g; });
    const merged = mergeG(geos); this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.94 });
    this.clouds = new THREE.InstancedMesh(merged, this.cloudMat, 10); this.clouds.frustumCulled = false; this.clouds.renderOrder = -5;
    const r = mulberry32(99); this.cd = [];
    for (let i = 0; i < 10; i++) this.cd.push({ x: (r() - 0.5) * 180, y: 42 + r() * 22, z: (r() - 0.5) * 160 - 15, s: 0.65 + r() * 0.85, sp: 1 + r() * 1.4 });
    this.scene.add(this.clouds);
  }
  buildRain() {
    this.rainN = 200; const p = new Float32Array(this.rainN * 6);
    this.rainSeed = []; for (let i = 0; i < this.rainN; i++) this.rainSeed.push([Math.random() * 32 - 16, Math.random() * 22, Math.random() * 32 - 16, 24 + Math.random() * 8]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfe3f2, transparent: true, opacity: 0.0, depthWrite: false, fog: false })); this.rainMesh.frustumCulled = false; this.rainMesh.renderOrder = 9; this.scene.add(this.rainMesh);
  }
  registerGlow(s) { this.glows.push(s); }
  applyQuality(q, gfx) {
    this.clouds.count = Math.min(10, q.clouds); this.rainDrops = q.shadows ? this.rainN : Math.floor(this.rainN * 0.5);
    const sh = this.sun.shadow; if (sh.mapSize.x !== q.shadowMap) { sh.mapSize.set(q.shadowMap, q.shadowMap); sh.map?.dispose(); sh.map = null; }
    this.sun.castShadow = gfx.renderer.shadowMap.enabled;
    this.far = q.pr <= 1 ? 92 : 112;
  }
  update(dt, hour, weather, focus, camPos, mode2D, indoor = false) {
    this.hour = hour;
    const WX = { clear: [0, 0, 0, 0], cloudy: [0.5, 0, 0, 0], rain: [0.85, 1, 0, 0], storm: [1, 1, 0, 0], fog: [0.6, 0, 1, 0], snow: [0.55, 0, 0, 1] }, [tg, tr, tf, ts] = WX[weather] || WX.clear, wk = 1 - Math.exp(-0.8 * dt);
    this.rainK = lerp(this.rainK, tg, wk); this.dropK = lerp(this.dropK || 0, tr, wk); this.fogK = lerp(this.fogK || 0, tf, wk); this.snowK = lerp(this.snowK || 0, ts, wk); this.flash = Math.max(0, (this.flash || 0) - dt * 3.2);
    let i = 0; while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
    const A = KEYS[i], Bk = KEYS[i + 1], f = smooth(A.h, Bk.h, hour), rk = this.rainK;
    _top.copy(A.top).lerp(Bk.top, f).lerp(RAIN.top, rk * 0.8);
    _hor.copy(A.hor).lerp(Bk.hor, f).lerp(RAIN.hor, rk * 0.8);
    _fog.copy(A.fog).lerp(Bk.fog, f).lerp(RAIN.fog, rk * 0.8);
    _sunC.copy(A.sun).lerp(Bk.sun, f);
    _hs.copy(A.hs).lerp(Bk.hs, f);
    _hg.copy(A.hg).lerp(Bk.hg, f);
    _cloud.copy(A.cloud).lerp(Bk.cloud, f).lerp(RAIN.cloud, rk);
    const sunI = lerp(A.sunI, Bk.sunI, f) * (1 - rk * 0.55), hi = lerp(A.hi, Bk.hi, f) * (1 - rk * 0.15);
    this.night = clamp(smooth(19, 21, hour) + (1 - smooth(5, 6.8, hour)), 0, 1);
    const u = this.domeMat.uniforms;
    u.uTop.value.copy(_top); u.uHor.value.copy(_hor); u.uBot.value.copy(_hor).lerp(_cBot, 0.5).multiplyScalar(0.9);
    // hướng mặt trời/mặt trăng
    const day = hour >= 5.5 && hour <= 19.5, a = day ? ((hour - 5.5) / 14) * Math.PI : (((hour + (hour < 5.5 ? 24 : 0)) - 19.5) / 10) * Math.PI;
    _dir.set(Math.cos(a) * 0.85, Math.max(0.16, Math.sin(a)), -0.42).normalize();
    u.uSunDir.value.copy(_dir); u.uSunCol.value.copy(_sunC); u.uSunK.value = (day ? 1 : 0.1) * (1 - rk * 0.8);
    this.sun.color.copy(_sunC); this.sun.intensity = sunI * (mode2D ? 1.1 : 1.08);
    this.hemi.color.copy(_hs); this.hemi.groundColor.copy(_hg); this.hemi.intensity = hi * (mode2D ? 1.3 : 1.24) + this.flash * 2.2;
    this.sun.castShadow = !indoor && !mode2D && this.sun.shadow.mapSize.x > 512;
    if (!indoor) {
      const tx = Math.round(focus.x / 4) * 4, tz = Math.round(focus.z / 4) * 4;
      this.sun.target.position.set(tx, focus.y, tz);
      this.sun.position.set(tx + _dir.x * 55, focus.y + _dir.y * 55 + 6, tz + _dir.z * 55);
    }
    _fog.lerp(_cFogW, this.fogK * 0.85).lerp(_cWhite, Math.min(1, this.flash));
    u.uHor.value.lerp(_cHorF, this.fogK * 0.7);
    this.scene.fog.color.copy(_fog);
    const far = this.far || 112;
    this.scene.fog.near = mode2D || indoor ? 9999 : lerp(lerp(36, 22, rk), 5, this.fogK);
    this.scene.fog.far = mode2D || indoor ? 10000 : lerp(lerp(far, far * 0.65, rk), 44, this.fogK);
    this.dome.position.copy(camPos);
    _pd.copy(_dir).multiplyScalar(102).add(camPos);
    this.sunDisc.position.copy(_pd); this.sunDisc.lookAt(camPos); this.sunDisc.visible = day && !mode2D && !indoor; this.sunDisc.material.opacity = 1 - rk;
    _md.set(-_dir.x, Math.max(0.2, 0.9 - Math.abs(Math.sin(a)) * 0.2), 0.5).normalize().multiplyScalar(102).add(camPos);
    this.moon.position.copy(_md); this.moon.lookAt(camPos); this.moon.visible = !day && !mode2D && !indoor;
    this.stars.position.copy(camPos); this.stars.material.opacity = this.night * (1 - rk) * (mode2D || indoor ? 0 : 1);
    // mây
    this.clouds.visible = !mode2D && !indoor;
    if (this.clouds.visible) {
      for (let k = 0; k < this.clouds.count; k++) {
        const c = this.cd[k]; c.x += c.sp * dt; if (c.x > 190) c.x = -190;
        _pos.set(c.x, c.y, c.z); _scl.set(c.s, c.s, c.s);
        this.clouds.setMatrixAt(k, _mat.compose(_pos, _quat, _scl));
      }
      this.clouds.instanceMatrix.needsUpdate = true;
      this.cloudMat.color.copy(_cloud).multiplyScalar(0.5 + 0.5 * (1 - this.night * 0.6));
    }
    // cửa sổ / đèn / glow
    const nk = Math.max(0.32, this.night);
    MAT.window.color.set(0xffe9b5).lerp(_b.set(0xffd278), this.night);
    MAT.bulb.color.set(0xffefb8).lerp(_b.set(0xfff0c0), this.night).multiplyScalar(0.75 + 0.25 * this.night);
    for (const g of this.glows) { const o = g.userData.glow * nk; g.material.opacity = o; g.visible = o > 0.02; }
    this.exposure = lerp(A.ex, Bk.ex, f);
    // mưa & tuyết: tắt hoàn toàn hạt mưa/tuyết rơi khi đang ở trong nhà (!indoor)
    this.rainMesh.visible = !indoor && this.dropK > 0.03; this.rainMesh.material.opacity = 0.5 * this.dropK;
    this.snowMesh.visible = !indoor && this.snowK > 0.03; this.snowMesh.material.opacity = 0.9 * this.snowK;
    if (this.snowMesh.visible) { const sp = this.snowMesh.geometry.attributes.position.array, tt = performance.now() / 1000; for (let k = 0; k < this.snowN; k++) { const r = this.snowSeed[k]; sp[k * 3] = focus.x + r[0] + Math.sin(tt * 0.8 + r[3]) * 0.8; sp[k * 3 + 1] = 22 - ((tt * 2.4 + r[1]) % 22); sp[k * 3 + 2] = focus.z + r[2] + Math.cos(tt * 0.7 + r[3]) * 0.8; } this.snowMesh.geometry.attributes.position.needsUpdate = true; }
    if (this.rainMesh.visible) {
      const pos = this.rainMesh.geometry.attributes.position.array, t = performance.now() / 1000, n = this.rainDrops || this.rainN;
      for (let k = 0; k < n; k++) { const r = this.rainSeed[k], y = 26 - ((t * r[3] + r[1]) % 26); const x = focus.x + r[0], z = focus.z + r[2]; pos.set([x, y, z, x - 0.12, y + 1.1, z - 0.05], k * 6); }
      this.rainMesh.geometry.setDrawRange(0, n * 2); this.rainMesh.geometry.attributes.position.needsUpdate = true;
    }
  }
}
function mergeG(geos) {
  let n = 0, ni = 0; for (const g of geos) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Uint32Array(ni); let o = 0, oi = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + o; o += g.attributes.position.count; oi += g.index.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setIndex(new THREE.BufferAttribute(idx, 1)); return m;
}
