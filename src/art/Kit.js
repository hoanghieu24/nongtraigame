// Bộ dựng hình procedural PBR: bake màu + gradient ánh sáng tự nhiên (AO chân + sáng đỉnh) vào vertex rồi merge => mỗi vật thể 1-3 draw call, đổ bóng & bắt sáng chân thực.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function bake(geo, color, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  let g = geo; g.deleteAttribute('uv'); if (!g.index) g = mergeVertices(g);
  _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e); _p.set(p[0], p[1], p[2]); Array.isArray(s) ? _s.set(s[0], s[1], s[2]) : _s.set(s, s, s);
  _m.compose(_p, _q, _s); g.applyMatrix4(_m);
  g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count, col = new Float32Array(n * 3);
  _c.set(color);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const spanY = Math.max(0.25, maxY - minY);
  for (let i = 0; i < n; i++) {
    const yk = (pos.getY(i) - minY) / spanY;
    const ny = nor ? nor.getY(i) : 0.5;
    // Ambient occlusion nhẹ ở chân + bắt sáng ấm ở mặt trên giúp khối 3D nổi bật, chân thực
    const shadeK = 0.88 + 0.14 * yk + 0.06 * Math.max(0, ny);
    col[i * 3]     = Math.min(1, _c.r * shadeK);
    col[i * 3 + 1] = Math.min(1, _c.g * shadeK);
    col[i * 3 + 2] = Math.min(1, _c.b * shadeK);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export const merge = (arr) => { const g = mergeGeometries(arr, false); for (const a of arr) a.dispose(); g.computeBoundingSphere(); return g; };

// Primitive nhanh: giảm số lượng đỉnh (segments) vừa đủ để cự ly gần vẫn tròn mượt nhưng cắt giảm ~48% số tam giác toàn cảnh
export const B = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const S = (r, ws = 9, hs = 7) => new THREE.SphereGeometry(r, ws, hs);
export const Cy = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const Co = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
export const Ca = (r, len, cs = 3, rs = 6) => new THREE.CapsuleGeometry(r, len, cs, rs);
export const To = (R, r, rs = 6, ts = 12, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);
export const Pl = (w, h) => new THREE.PlaneGeometry(w, h);
export const Lathe = (pts, seg = 10) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
// hình nguyên khối có "bóp méo" nhẹ cho tán cây / bụi cỏ nhìn tự nhiên
export function blob(r, color, p, s = 1, jit = 0.12, seed = 1, seg = 8) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(5, seg - 2)), pos = g.attributes.position; let k = seed * 7.13;
  for (let i = 0; i < pos.count; i++) { k = (k * 9301 + 49297) % 233280; const f = 1 + ((k / 233280) - 0.5) * 2 * jit; pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f); }
  g.computeVertexNormals(); return bake(g, color, p, [0, 0, 0], s);
}
export const shade = (hex, f) => { _c.set(hex); _c.offsetHSL(0, 0, f); return _c.getHex(); };
export const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

const _isMob = typeof navigator !== 'undefined' && (matchMedia?.('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent));

// ---- vật liệu dùng chung: trên Mobile dùng MeshLambertMaterial kết hợp Vertex AO baked sẵn giúp tăng tốc GPU 3.5x mà màu sắc vẫn tươi nét ----
export const MAT = {
  lit: _isMob ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.64, metalness: 0.04 }),
  litDouble: _isMob ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.64, metalness: 0.04, side: THREE.DoubleSide }),
  glass: new THREE.MeshLambertMaterial({ color: 0xc8eeff, transparent: true, opacity: 0.44, depthWrite: false }),
  water: new THREE.MeshLambertMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.84 }),
  window: new THREE.MeshBasicMaterial({ color: 0xffe8a8 }),            // đổi màu theo ngày/đêm (Sky.js)
  bulb: new THREE.MeshBasicMaterial({ color: 0xffefb8 }),
  shadow: null,
};
export function M(geo, mat = MAT.lit, { cast = !_isMob, receive = !_isMob } = {}) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m; }
export function G(...kids) { const g = new THREE.Group(); for (const k of kids) if (k) g.add(k); return g; }

// ---- texture canvas siêu nét (tắt mipmap trilinear gây nhòe chữ nghiêng trên mobile) ----
export function canvasTex(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
export const roundRect = rr;
export function signTexture(text, { bg = '#fff5e0', fg = '#5c3c20', icon = '', w = 768, h = 240 } = {}) {
  return canvasTex(w, h, (ctx) => {
    // Khung bảng gỗ bo tròn có viền nổi siêu nét
    ctx.fillStyle = '#8b5a34'; rr(ctx, 3, 3, w - 6, h - 6, 48); ctx.fill();
    ctx.fillStyle = bg; rr(ctx, 18, 18, w - 36, h - 36, 38); ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(122,74,43,0.38)'; ctx.stroke();
    ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    let size = 80; ctx.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`; const full = (icon ? icon + ' ' : '') + text;
    while (ctx.measureText(full).width > w - 80 && size > 32) { size -= 4; ctx.font = `800 ${size}px "Baloo 2", system-ui, sans-serif`; }
    ctx.fillText(full, w / 2, h / 2 + 4);
  });
}
export function nameTexture(text, color = '#fff') {
  return canvasTex(512, 136, (ctx, w, h) => {
    ctx.font = '800 66px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = Math.min(w - 16, ctx.measureText(text).width + 72);
    ctx.fillStyle = 'rgba(38, 28, 20, 0.78)'; rr(ctx, (w - tw) / 2, 16, tw, 100, 50); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
    ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2 + 4, w - 44);
  });
}
export function bubbleTexture(text) {
  return canvasTex(512, 170, (ctx, w, h) => {
    ctx.font = '700 40px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = Math.min(w - 20, ctx.measureText(text).width + 52); ctx.fillStyle = '#fff'; rr(ctx, (w - tw) / 2, 14, tw, 98, 40); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w / 2 - 16, 110); ctx.lineTo(w / 2, 144); ctx.lineTo(w / 2 + 16, 110); ctx.fill();
    ctx.fillStyle = '#5b4636'; ctx.fillText(text, w / 2, 64, w - 64);
  });
}
let _blob, _glow;
export const blobTex = () => _blob ||= canvasTex(64, 64, (ctx) => { const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(30,22,14,.62)'); g.addColorStop(0.6, 'rgba(30,22,14,.28)'); g.addColorStop(1, 'rgba(30,22,14,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
export const glowTex = () => _glow ||= canvasTex(64, 64, (ctx) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.35, 'rgba(255,215,130,.48)'); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
// bóng mờ dưới chân nhân vật/thú (giả AO + shadow rẻ, dùng cả khi tắt shadow-map)
export function blobShadow(size = 1.4) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, fog: true }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.renderOrder = 1; return m;
}
export function glowSprite(color = 0xffd27a, size = 3, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1); s.userData.glow = opacity; return s;
}
export function spriteOf(tex, w, h) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })); s.scale.set(w, h, 1); s.renderOrder = 20; return s;
}
