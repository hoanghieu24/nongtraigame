import * as THREE from 'three';
import { canvasTex } from './Kit.js';
// Emoji -> sprite (cache). Dùng cho biểu tượng nổi trên đầu (sản phẩm sẵn sàng, đang đói, đơn của khách...)
const cache = new Map();
export function iconTexture(emoji) {
  if (!cache.has(emoji)) cache.set(emoji, canvasTex(96, 96, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(w / 2, h / 2 + 2, 40, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(120,90,60,.35)'; ctx.lineWidth = 4; ctx.stroke();
    ctx.font = '50px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(emoji, w / 2, h / 2 + 6);
  }));
  return cache.get(emoji);
}
export function iconSprite(emoji, size = 0.9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(emoji), transparent: true, depthWrite: false, depthTest: false })); s.scale.set(size, size, 1); s.renderOrder = 15; return s;
}
